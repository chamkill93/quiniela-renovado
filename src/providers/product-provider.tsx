"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RegisterUserRequest } from "@/lib/backoffice";
import type { AccountGateway, AccountRequestOptions } from "@/lib/account/contracts";
import type { GamingCatalog, WalletMovement } from "@/lib/gaming/types";
import type {
  MockPlay,
  MockResult,
  MockSession,
  MockTicket,
  PlayResponse,
} from "@/lib/product/api-types";
import { publicProductErrorMessage } from "@/lib/product/public-error";
import {
  createProductGateway,
  createProductIdempotencyKey,
  assertTopUpResponseMatchesInput,
  assertWithdrawalResponseMatchesInput,
  isProductGatewayUnauthorizedError,
  ProductGatewayCapabilityError,
  ProductGatewayProtocolError,
  ProductOperationSupersededError,
  ProductRequestEpoch,
  ProductSessionUnavailableError,
  requireAuthenticatedProductSnapshot,
  type ProductGateway,
  type ProductGatewayMode,
  type ProductPlayCommand,
  type ProductRequestScope,
  type ProductSnapshot,
  type ProductTopUpInput,
  type ProductTopUpResponse,
  type ProductWithdrawalInput,
  type ProductWithdrawalResponse,
} from "@/lib/product/gateway";

export interface ProductContextValue {
  account?: AccountGateway;
  session: MockSession | null;
  catalog: GamingCatalog | null;
  plays: MockPlay[];
  results: MockResult[];
  movements: WalletMovement[];
  movementsLoading: boolean;
  movementsError: string | null;
  loading: boolean;
  error: string | null;
  unauthorized: boolean;
  gatewayMode: ProductGatewayMode;
  walletAvailable: boolean;
  withdrawalAvailable: boolean;
  persistentRegistration: boolean;
  refresh: () => Promise<void>;
  refreshMovements: () => Promise<void>;
  requestPlay: (command: ProductPlayCommand) => Promise<PlayResponse>;
  getTicket: (ticketId: string) => Promise<MockTicket>;
  getPendingWalletOperationKey: (kind: "topup" | "withdrawal", input: ProductTopUpInput) => string | undefined;
  requestTopUp: (input: ProductTopUpInput, idempotencyKey?: string) => Promise<ProductTopUpResponse>;
  requestWithdrawal: (input: ProductWithdrawalInput, idempotencyKey?: string) => Promise<ProductWithdrawalResponse>;
  login: (documentOrPhone: string, password: string) => Promise<void>;
  register: (input: RegisterUserRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const ProductContext = createContext<ProductContextValue | null>(null);

function errorMessage(reason: unknown, fallback: string) {
  return publicProductErrorMessage(reason, fallback);
}

function isAbortError(reason: unknown) {
  return reason instanceof DOMException && reason.name === "AbortError";
}

function supersededError() {
  return new ProductOperationSupersededError();
}

function isSupersededError(reason: unknown) {
  return reason instanceof ProductOperationSupersededError;
}

function isExplicitSessionExpiredError(reason: unknown) {
  if (reason === null || typeof reason !== "object") return false;
  const failure = reason as { status?: unknown; code?: unknown };
  return (
    failure.status === 419 ||
    failure.status === 440 ||
    failure.code === "SESSION_EXPIRED"
  );
}

function cloneTicket(ticket: MockTicket): MockTicket {
  return {
    ...ticket,
    resultNumbers: ticket.resultNumbers
      ? [...ticket.resultNumbers]
      : ticket.resultNumbers,
  };
}

function walletOperationFingerprint(kind: "topup" | "withdrawal", input: ProductTopUpInput) {
  return `wallet:${kind}:${JSON.stringify({ amount: input.amount, method: input.method })}`;
}

export interface ProductProviderProps {
  children: React.ReactNode;
  /** Optional host composition seam; normal app usage resolves from public env. */
  gateway?: ProductGateway;
}

export function ProductProvider({ children, gateway: providedGateway }: ProductProviderProps) {
  const gateway = useMemo(
    () => providedGateway ?? createProductGateway(),
    [providedGateway],
  );
  const [coordinator] = useState(() => new ProductRequestEpoch());
  const bootstrapRequestRef = useRef(0);
  const movementsRequestRef = useRef(0);
  const resultsRequestRef = useRef(0);
  const stateRevisionRef = useRef(0);
  const authGenerationRef = useRef(0);
  const activeSessionIdRef = useRef<string | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const mutationKeysRef = useRef(new Map<string, string>());
  const inFlightMutationsRef = useRef(new Map<string, Promise<unknown>>());
  const ticketCacheRef = useRef(new Map<string, MockTicket>());
  const inFlightTicketRequestsRef = useRef(
    new Map<string, Promise<MockTicket>>(),
  );

  const [session, setSession] = useState<MockSession | null>(null);
  const [catalog, setCatalog] = useState<GamingCatalog | null>(null);
  const [plays, setPlays] = useState<MockPlay[]>([]);
  const [results, setResults] = useState<MockResult[]>([]);
  const [movements, setMovements] = useState<WalletMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const resetMovements = useCallback(() => {
    movementsRequestRef.current += 1;
    setMovements([]);
    setMovementsLoading(false);
    setMovementsError(null);
  }, []);

  const clearUserState = useCallback(() => {
    authGenerationRef.current += 1;
    activeSessionIdRef.current = null;
    inFlightMutationsRef.current.clear();
    inFlightTicketRequestsRef.current.clear();
    ticketCacheRef.current.clear();
    stateRevisionRef.current += 1;
    bootstrapRequestRef.current += 1;
    setSession(null);
    setPlays([]);
    setResults((current) =>
      current.filter((result) => result.source === "DRAW"),
    );
    resetMovements();
  }, [resetMovements]);

  const handleGatewayError = useCallback(
    (reason: unknown) => {
      if (!isProductGatewayUnauthorizedError(reason)) return false;
      coordinator.advance();
      mutationKeysRef.current.clear();
      clearUserState();
      setLoading(false);
      setError(null);
      setUnauthorized(true);
      return true;
    },
    [clearUserState, coordinator],
  );

  const applySnapshot = useCallback((data: ProductSnapshot) => {
    const nextSessionId = data.session?.id ?? null;
    if (activeSessionIdRef.current !== nextSessionId) {
      authGenerationRef.current += 1;
      activeSessionIdRef.current = nextSessionId;
      inFlightMutationsRef.current.clear();
      mutationKeysRef.current.clear();
      resetMovements();
    }
    inFlightTicketRequestsRef.current.clear();
    ticketCacheRef.current.clear();
    setSession(data.session);
    setCatalog(data.catalog);
    setPlays([...data.plays]);
    setResults([...data.results]);
    setUnauthorized(false);
  }, [resetMovements]);

  const loadMovements = useCallback(
    async (
      scope: ProductRequestScope,
      failureMessage: string,
    ): Promise<void> => {
      if (!gateway.capabilities.wallet) {
        if (scope.isCurrent()) resetMovements();
        return;
      }

      const requestId = ++movementsRequestRef.current;
      const authGeneration = authGenerationRef.current;
      if (scope.isCurrent()) {
        setMovementsLoading(true);
        setMovementsError(null);
      }

      try {
        const data = await gateway.getMovements({ signal: scope.signal });
        scope.assertCurrent();
        if (authGeneration !== authGenerationRef.current) return;
        if (requestId !== movementsRequestRef.current) return;
        setMovements([...data]);
        setMovementsError(null);
      } catch (reason) {
        if (!scope.isCurrent() || isAbortError(reason) || authGeneration !== authGenerationRef.current) return;
        const sessionUnavailable = handleGatewayError(reason);
        if (!sessionUnavailable && requestId === movementsRequestRef.current) {
          setMovementsError(errorMessage(reason, failureMessage));
        }
      } finally {
        if (
          scope.isCurrent() &&
          requestId === movementsRequestRef.current
        ) {
          setMovementsLoading(false);
        }
      }
    },
    [gateway, handleGatewayError, resetMovements],
  );

  const refreshMovements = useCallback(async () => {
    if (!activeSessionIdRef.current || !gateway.capabilities.wallet) {
      resetMovements();
      return;
    }
    const scope = coordinator.open();
    try {
      await loadMovements(scope, "No pudimos cargar los movimientos.");
    } finally {
      scope.close();
    }
  }, [coordinator, gateway, loadMovements, resetMovements]);

  const refresh = useCallback(async () => {
    const scope = coordinator.open();
    const requestId = ++bootstrapRequestRef.current;
    const revision = stateRevisionRef.current;
    setLoading(true);
    setError(null);

    try {
      const data = await gateway.bootstrap({ signal: scope.signal });
      scope.assertCurrent();
      if (
        requestId !== bootstrapRequestRef.current ||
        revision !== stateRevisionRef.current
      ) return;
      applySnapshot(data);
      if (data.session) {
        await loadMovements(scope, "No pudimos cargar los movimientos.");
      } else {
        resetMovements();
      }
    } catch (reason) {
      if (!scope.isCurrent() || isAbortError(reason)) return;
      if (revision !== stateRevisionRef.current) return;
      const sessionUnavailable = handleGatewayError(reason);
      if (!sessionUnavailable && requestId === bootstrapRequestRef.current) {
        setError(errorMessage(reason, "No pudimos cargar tu sesión."));
      }
    } finally {
      if (
        scope.isCurrent() &&
        requestId === bootstrapRequestRef.current
      ) {
        setLoading(false);
      }
      scope.close();
    }
  }, [applySnapshot, coordinator, gateway, handleGatewayError, loadMovements, resetMovements]);

  useEffect(() => {
    coordinator.advance();
    authGenerationRef.current += 1;
    inFlightMutationsRef.current.clear();
    mutationKeysRef.current.clear();
    const scope = coordinator.open();
    const requestId = ++bootstrapRequestRef.current;
    const revision = stateRevisionRef.current;

    const hydrate = async () => {
      // Keep effect setup free of synchronous React state updates.
      await Promise.resolve();
      if (!scope.isCurrent()) return;
      setLoading(true);
      setError(null);

      try {
        const data = await gateway.bootstrap({ signal: scope.signal });
        scope.assertCurrent();
        if (
          requestId !== bootstrapRequestRef.current ||
          revision !== stateRevisionRef.current
        ) return;
        applySnapshot(data);

        // Preview bootstrap may establish its cookie. Private wallet reads follow
        // only when the gateway confirmed an authenticated session.
        if (data.session) {
          await loadMovements(scope, "No pudimos cargar los movimientos.");
        } else {
          resetMovements();
        }
      } catch (reason) {
        if (!scope.isCurrent() || isAbortError(reason)) return;
        if (revision !== stateRevisionRef.current) return;
        const sessionUnavailable = handleGatewayError(reason);
        if (!sessionUnavailable && requestId === bootstrapRequestRef.current) {
          setError(errorMessage(reason, "No pudimos cargar tu sesión."));
        }
      } finally {
        if (
          scope.isCurrent() &&
          requestId === bootstrapRequestRef.current
        ) {
          setLoading(false);
        }
        scope.close();
      }
    };

    void hydrate();

    return () => {
      coordinator.advance();
      scope.close();
    };
  }, [applySnapshot, coordinator, gateway, handleGatewayError, loadMovements, resetMovements]);

  const refreshAfterAcceptedPlay = useCallback(
    (kind: ProductPlayCommand["kind"]) => {
      const scope = coordinator.open();
      const authGeneration = authGenerationRef.current;
      const resultsRequestId = ++resultsRequestRef.current;
      const run = async () => {
        if (kind === "instant") {
          try {
            const nextResults = await gateway.getResults({ signal: scope.signal });
            scope.assertCurrent();
            if (authGeneration !== authGenerationRef.current) return;
            if (resultsRequestId === resultsRequestRef.current) {
              setResults([...nextResults]);
            }
          } catch (reason) {
            if (!scope.isCurrent() || isAbortError(reason) || authGeneration !== authGenerationRef.current) return;
            handleGatewayError(reason);
          }
        }

        if (scope.isCurrent() && authGeneration === authGenerationRef.current) {
          await loadMovements(
            scope,
            "No pudimos actualizar los movimientos.",
          );
        }
      };

      void run().finally(() => scope.close());
    },
    [coordinator, gateway, handleGatewayError, loadMovements],
  );

  const enqueueMutation = useCallback(<T,>(operation: () => Promise<T>) => {
    const result = mutationQueueRef.current.then(operation, operation);
    mutationQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const refreshBalanceAfterReplay = useCallback(() => {
    const scope = coordinator.open();
    const revision = stateRevisionRef.current;
    const bootstrapRequestId = bootstrapRequestRef.current;
    const isLatest = () =>
      scope.isCurrent() &&
      revision === stateRevisionRef.current &&
      bootstrapRequestId === bootstrapRequestRef.current;

    const reconcile = async () => {
      try {
        const data = await gateway.bootstrap({ signal: scope.signal });
        if (!isLatest()) return;
        const snapshot = requireAuthenticatedProductSnapshot(data);
        setSession((current) => current?.id === snapshot.session.id
          ? { ...current, balance: snapshot.session.balance, currency: snapshot.session.currency }
          : current);
        setError(null);
      } catch (reason) {
        if (!isLatest() || isAbortError(reason)) return;
        if (!handleGatewayError(reason)) {
          setError("La operación fue confirmada, pero no pudimos actualizar el saldo. Actualizá la sesión antes de volver a jugar.");
        }
      } finally {
        scope.close();
      }
    };

    // An idempotent response contains the original balance, which may precede
    // another payment. Reconcile it without delaying or rejecting the receipt.
    void reconcile();
  }, [coordinator, gateway, handleGatewayError]);

  const requestPlay = useCallback(
    (command: ProductPlayCommand) => {
      const sessionId = session?.id;
      if (!sessionId) return Promise.reject(new ProductSessionUnavailableError());
      if (activeSessionIdRef.current !== sessionId) return Promise.reject(supersededError());
      const logicalOperation = `play:${JSON.stringify(command)}`;
      const existing = inFlightMutationsRef.current.get(logicalOperation) as
        | Promise<PlayResponse>
        | undefined;
      if (existing) return existing;
      const authGeneration = authGenerationRef.current;
      const result = enqueueMutation(async () => {
        if (authGeneration !== authGenerationRef.current || activeSessionIdRef.current !== sessionId) throw supersededError();
        const scope = coordinator.open();
        const idempotencyKey =
          mutationKeysRef.current.get(logicalOperation) ??
          createProductIdempotencyKey();
        mutationKeysRef.current.set(logicalOperation, idempotencyKey);
        try {
          const data = await gateway.requestPlay(command, {
            idempotencyKey,
            signal: scope.signal,
            expectedSessionId: sessionId,
          });
          scope.assertCurrent();
          if (authGeneration !== authGenerationRef.current || activeSessionIdRef.current !== sessionId) throw supersededError();
          if (data.session.id !== undefined && data.session.id !== sessionId) {
            throw new ProductGatewayProtocolError("La jugada no corresponde a la sesión actual.");
          }
          mutationKeysRef.current.delete(logicalOperation);
          stateRevisionRef.current += 1;
          const acceptedTicket = cloneTicket(data.ticket);
          ticketCacheRef.current.set(acceptedTicket.id, acceptedTicket);
          if (data.play.ticketId) {
            ticketCacheRef.current.set(data.play.ticketId, acceptedTicket);
          }
          setSession((current) =>
            current?.id === sessionId && !data.replayed
              ? {
                  ...current,
                  balance: data.session.balance,
                  currency: data.session.currency ?? current.currency,
                }
              : current,
          );
          setPlays((current) => {
            const existing = current.some((play) => play.id === data.play.id);
            return existing ? current : [data.play, ...current];
          });

          // Histories are secondary reads. They must never turn an accepted play
          // into a visible failure or delay its ticket/reel response.
          refreshAfterAcceptedPlay(command.kind);
          if (data.replayed) refreshBalanceAfterReplay();
          return data;
        } catch (reason) {
          if (isSupersededError(reason)) throw reason;
          if (!scope.isCurrent() || isAbortError(reason) || authGeneration !== authGenerationRef.current || activeSessionIdRef.current !== sessionId) throw supersededError();
          handleGatewayError(reason);
          throw reason;
        } finally {
          scope.close();
        }
      });
      inFlightMutationsRef.current.set(logicalOperation, result);
      void result.then(
        () => {
          if (inFlightMutationsRef.current.get(logicalOperation) === result) {
            inFlightMutationsRef.current.delete(logicalOperation);
          }
        },
        () => {
          if (inFlightMutationsRef.current.get(logicalOperation) === result) {
            inFlightMutationsRef.current.delete(logicalOperation);
          }
        },
      );
      return result;
    },
    [coordinator, enqueueMutation, gateway, handleGatewayError, refreshAfterAcceptedPlay, refreshBalanceAfterReplay, session?.id],
  );

  const getTicket = useCallback(
    (ticketId: string) => {
      const normalizedTicketId = ticketId.trim();
      if (!normalizedTicketId) {
        return Promise.reject(new TypeError("ticketId no puede estar vacío."));
      }

      const cached = ticketCacheRef.current.get(normalizedTicketId);
      if (cached) return Promise.resolve(cloneTicket(cached));

      const existing = inFlightTicketRequestsRef.current.get(normalizedTicketId);
      if (existing) return existing;

      const authGeneration = authGenerationRef.current;
      const scope = coordinator.open();
      const request = (async () => {
        try {
          if (authGeneration !== authGenerationRef.current) {
            throw supersededError();
          }
          const ticket = await gateway.getTicket(normalizedTicketId, {
            signal: scope.signal,
          });
          scope.assertCurrent();
          if (authGeneration !== authGenerationRef.current) {
            throw supersededError();
          }

          const storedTicket = cloneTicket(ticket);
          ticketCacheRef.current.set(normalizedTicketId, storedTicket);
          ticketCacheRef.current.set(storedTicket.id, storedTicket);
          return cloneTicket(storedTicket);
        } catch (reason) {
          if (isSupersededError(reason)) throw reason;
          if (!scope.isCurrent() || isAbortError(reason)) {
            throw supersededError();
          }
          handleGatewayError(reason);
          throw reason;
        } finally {
          scope.close();
        }
      })();

      inFlightTicketRequestsRef.current.set(normalizedTicketId, request);
      const clearRequest = () => {
        if (
          inFlightTicketRequestsRef.current.get(normalizedTicketId) === request
        ) {
          inFlightTicketRequestsRef.current.delete(normalizedTicketId);
        }
      };
      void request.then(clearRequest, clearRequest);
      return request;
    },
    [coordinator, gateway, handleGatewayError],
  );

  const getPendingWalletOperationKey = useCallback(
    (kind: "topup" | "withdrawal", input: ProductTopUpInput) => {
      const sessionId = session?.id;
      if (!sessionId || activeSessionIdRef.current !== sessionId) return undefined;
      return mutationKeysRef.current.get(walletOperationFingerprint(kind, input));
    },
    [session?.id],
  );

  const requestWalletOperation = useCallback(
    (kind: "topup" | "withdrawal", input: ProductTopUpInput, providedKey?: string) => {
      if (!gateway.capabilities.wallet) {
        return Promise.reject(new ProductGatewayCapabilityError("wallet"));
      }
      if (kind === "withdrawal" && (!gateway.capabilities.withdrawal || !gateway.withdraw)) {
        return Promise.reject(new ProductGatewayCapabilityError("withdrawal"));
      }
      const sessionId = session?.id;
      if (!sessionId) return Promise.reject(new ProductSessionUnavailableError());
      if (activeSessionIdRef.current !== sessionId) return Promise.reject(supersededError());
      if (providedKey !== undefined && !providedKey.trim()) {
        return Promise.reject(new TypeError("La referencia de la operación no puede estar vacía."));
      }
      // Copy the command before queueing so the caller cannot change the
      // amount or channel while another mutation is pending.
      const command: ProductTopUpInput = { amount: input.amount, method: input.method };
      // An unresolved payment belongs to the session, not to one mounted dialog.
      // A reopened form must recover it even when it supplies a newly generated key.
      const logicalOperation = walletOperationFingerprint(kind, command);
      const existing = inFlightMutationsRef.current.get(logicalOperation) as
        | Promise<ProductTopUpResponse>
        | undefined;
      if (existing) return existing;
      const authGeneration = authGenerationRef.current;
      const result = enqueueMutation(async () => {
        if (authGeneration !== authGenerationRef.current || activeSessionIdRef.current !== sessionId) throw supersededError();
        const scope = coordinator.open();
        const idempotencyKey =
          mutationKeysRef.current.get(logicalOperation) ??
          providedKey ??
          createProductIdempotencyKey();
        mutationKeysRef.current.set(logicalOperation, idempotencyKey);
        try {
          const options = { idempotencyKey, signal: scope.signal, expectedSessionId: sessionId };
          const data = kind === "topup"
            ? assertTopUpResponseMatchesInput(await gateway.topUp(command, options), command)
            : assertWithdrawalResponseMatchesInput(await gateway.withdraw!(command, options), command);
          scope.assertCurrent();
          if (authGeneration !== authGenerationRef.current || activeSessionIdRef.current !== sessionId) throw supersededError();
          if (data.session.id !== sessionId) {
            throw new ProductGatewayProtocolError("La operación no corresponde a la sesión actual.");
          }
          mutationKeysRef.current.delete(logicalOperation);
          stateRevisionRef.current += 1;
          movementsRequestRef.current += 1;
          setMovementsLoading(false);
          if (!data.replayed) {
            setSession((current) => current?.id === sessionId
              ? { ...current, balance: data.session.balance, currency: data.session.currency }
              : current);
          }
          setMovementsError(null);
          setMovements((current) => {
            const existing = current.some(
              (movement) => movement.id === data.balanceEntry.id,
            );
            return existing ? current : [{ ...data.balanceEntry }, ...current];
          });
          if (data.replayed) refreshBalanceAfterReplay();
          return data;
        } catch (reason) {
          if (isSupersededError(reason)) throw reason;
          if (!scope.isCurrent() || isAbortError(reason) || authGeneration !== authGenerationRef.current || activeSessionIdRef.current !== sessionId) throw supersededError();
          handleGatewayError(reason);
          throw reason;
        } finally {
          scope.close();
        }
      });
      inFlightMutationsRef.current.set(logicalOperation, result);
      void result.then(
        () => {
          if (inFlightMutationsRef.current.get(logicalOperation) === result) {
            inFlightMutationsRef.current.delete(logicalOperation);
          }
        },
        () => {
          if (inFlightMutationsRef.current.get(logicalOperation) === result) {
            inFlightMutationsRef.current.delete(logicalOperation);
          }
        },
      );
      return result;
    },
    [coordinator, enqueueMutation, gateway, handleGatewayError, refreshBalanceAfterReplay, session?.id],
  );

  const requestTopUp = useCallback(
    (input: ProductTopUpInput, idempotencyKey?: string) => requestWalletOperation("topup", input, idempotencyKey),
    [requestWalletOperation],
  );

  const requestWithdrawal = useCallback(
    (input: ProductWithdrawalInput, idempotencyKey?: string) => requestWalletOperation("withdrawal", input, idempotencyKey),
    [requestWalletOperation],
  );

  const hydrateAfterAuthentication = useCallback(
    (requestId: number) => {
      const scope = coordinator.open();
      const revision = stateRevisionRef.current;
      const run = async () => {
        try {
          const rawSnapshot = await gateway.bootstrap({ signal: scope.signal });
          scope.assertCurrent();
          if (
            requestId !== bootstrapRequestRef.current ||
            revision !== stateRevisionRef.current
          ) return;
          const snapshot = requireAuthenticatedProductSnapshot(rawSnapshot);
          applySnapshot(snapshot);
          await loadMovements(scope, "No pudimos cargar los movimientos.");
        } catch (reason) {
          if (!scope.isCurrent() || isAbortError(reason)) return;
          if (revision !== stateRevisionRef.current) return;
          const sessionUnavailable = handleGatewayError(reason);
          if (!sessionUnavailable && requestId === bootstrapRequestRef.current) {
            setError(
              errorMessage(
                reason,
                "La sesión fue aceptada, pero no pudimos actualizar sus datos.",
              ),
            );
          }
        }
      };

      void run().finally(() => scope.close());
    },
    [applySnapshot, coordinator, gateway, handleGatewayError, loadMovements],
  );

  const applyAuthentication = useCallback(
    (authenticatedSession: MockSession) => {
      authGenerationRef.current += 1;
      activeSessionIdRef.current = authenticatedSession.id;
      inFlightMutationsRef.current.clear();
      inFlightTicketRequestsRef.current.clear();
      ticketCacheRef.current.clear();
      stateRevisionRef.current += 1;
      setSession(authenticatedSession);
      setPlays([]);
      setResults([]);
      resetMovements();
      setUnauthorized(false);
      setError(null);
    },
    [resetMovements],
  );

  const login = useCallback(
    async (documentOrPhone: string, password: string) => {
      const scope = coordinator.advanceAndOpen();
      authGenerationRef.current += 1;
      inFlightMutationsRef.current.clear();
      const requestId = ++bootstrapRequestRef.current;
      movementsRequestRef.current += 1;
      mutationKeysRef.current.clear();
      setLoading(true);
      setMovementsLoading(false);
      setError(null);

      try {
        const data = await gateway.login(
          { documentOrPhone, password },
          { signal: scope.signal },
        );
        scope.assertCurrent();
        if (requestId !== bootstrapRequestRef.current) throw supersededError();
        applyAuthentication(data.session);
        hydrateAfterAuthentication(requestId);
      } catch (reason) {
        if (isSupersededError(reason)) throw reason;
        if (!scope.isCurrent() || isAbortError(reason)) throw supersededError();
        if (isExplicitSessionExpiredError(reason)) {
          handleGatewayError(reason);
        } else {
          setUnauthorized(false);
          setLoading(false);
        }
        throw reason;
      } finally {
        if (
          scope.isCurrent() &&
          requestId === bootstrapRequestRef.current
        ) {
          setLoading(false);
        }
        scope.close();
      }
    },
    [
      coordinator,
      gateway,
      handleGatewayError,
      applyAuthentication,
      hydrateAfterAuthentication,
    ],
  );

  const register = useCallback(
    async (input: RegisterUserRequest) => {
      const scope = coordinator.advanceAndOpen();
      authGenerationRef.current += 1;
      inFlightMutationsRef.current.clear();
      const requestId = ++bootstrapRequestRef.current;
      movementsRequestRef.current += 1;
      mutationKeysRef.current.clear();
      setLoading(true);
      setMovementsLoading(false);
      setError(null);

      try {
        const data = await gateway.register(input, { signal: scope.signal });
        scope.assertCurrent();

        if (requestId !== bootstrapRequestRef.current) throw supersededError();
        applyAuthentication(data.session);
        if (data.source === "backoffice" || data.source === "preview-session") hydrateAfterAuthentication(requestId);
      } catch (reason) {
        if (isSupersededError(reason)) throw reason;
        if (!scope.isCurrent() || isAbortError(reason)) throw supersededError();
        if (isExplicitSessionExpiredError(reason)) {
          handleGatewayError(reason);
        } else {
          setUnauthorized(false);
          setLoading(false);
        }
        throw reason;
      } finally {
        if (
          scope.isCurrent() &&
          requestId === bootstrapRequestRef.current
        ) {
          setLoading(false);
        }
        scope.close();
      }
    },
    [
      coordinator,
      gateway,
      handleGatewayError,
      applyAuthentication,
      hydrateAfterAuthentication,
    ],
  );

  const logout = useCallback(async () => {
    const scope = coordinator.advanceAndOpen();
    authGenerationRef.current += 1;
    inFlightMutationsRef.current.clear();
    bootstrapRequestRef.current += 1;
    movementsRequestRef.current += 1;
    mutationKeysRef.current.clear();
    setLoading(false);
    setMovementsLoading(false);

    try {
      await gateway.logout({ signal: scope.signal });
      scope.assertCurrent();
      // Invalidate work that may have started while logout was pending.
      coordinator.advance();
      clearUserState();
      setLoading(false);
      setError(null);
      setUnauthorized(false);
    } catch (reason) {
      if (isSupersededError(reason)) throw reason;
      if (!scope.isCurrent() || isAbortError(reason)) throw supersededError();
      handleGatewayError(reason);
      throw reason;
    } finally {
      scope.close();
    }
  }, [clearUserState, coordinator, gateway, handleGatewayError]);

  const requestAccount = useCallback(
    async <T,>(sessionId: string, operation: (options: AccountRequestOptions) => Promise<T>, options?: AccountRequestOptions) => {
      const scope = coordinator.open();
      try {
        const signal = options?.signal ? AbortSignal.any([scope.signal, options.signal]) : scope.signal;
        signal.throwIfAborted();
        const response = await operation({ ...options, signal, expectedSessionId: sessionId });
        signal.throwIfAborted();
        scope.assertCurrent();
        return response;
      } catch (reason) {
        if (!scope.isCurrent() || options?.signal?.aborted || isAbortError(reason)) throw supersededError();
        handleGatewayError(reason);
        throw reason;
      } finally { scope.close(); }
    },
    [coordinator, handleGatewayError],
  );

  const mutateAccount = useCallback(
    <T,>(sessionId: string, kind: string, input: unknown, operation: (options: AccountRequestOptions) => Promise<T>, options?: AccountRequestOptions) => {
      const generation = authGenerationRef.current;
      const logicalKey = `account:${kind}:${JSON.stringify(input)}`;
      return enqueueMutation(async () => {
        if (generation !== authGenerationRef.current) throw supersededError();
        const idempotencyKey = options?.idempotencyKey ?? mutationKeysRef.current.get(logicalKey) ?? createProductIdempotencyKey();
        mutationKeysRef.current.set(logicalKey, idempotencyKey);
        const response = await requestAccount(sessionId, operation, { ...options, idempotencyKey });
        mutationKeysRef.current.delete(logicalKey);
        return response;
      });
    },
    [enqueueMutation, requestAccount],
  );

  const getAccountSettings = useCallback<AccountGateway["getSettings"]>(async (options) => {
    const service = gateway.account;
    const sessionId = session?.id;
    if (!service || !sessionId) throw supersededError();
    return requestAccount(sessionId, async (next) => {
      const settings = await service.getSettings(next);
      if (settings.sessionId !== sessionId) throw new Error("No pudimos validar los datos de tu cuenta.");
      return settings;
    }, options);
  }, [gateway, requestAccount, session?.id]);

  const saveAccountLimits = useCallback<AccountGateway["saveLimits"]>(async (input, options) => {
    const service = gateway.account;
    const sessionId = session?.id;
    if (!service || !sessionId) throw supersededError();
    return mutateAccount(sessionId, "limits", input, async (next) => {
      const settings = await service.saveLimits(input, next);
      if (settings.sessionId !== sessionId) throw new Error("No pudimos validar los datos de tu cuenta.");
      return settings;
    }, options);
  }, [gateway, mutateAccount, session?.id]);

  const pauseAccount = useCallback<AccountGateway["pause"]>(async (input, options) => {
    const service = gateway.account;
    const sessionId = session?.id;
    if (!service || !sessionId) throw supersededError();
    return mutateAccount(sessionId, "pause", input, async (next) => {
      const settings = await service.pause(input, next);
      if (settings.sessionId !== sessionId) throw new Error("No pudimos validar los datos de tu cuenta.");
      return settings;
    }, options);
  }, [gateway, mutateAccount, session?.id]);

  const updateAccountProfile = useCallback<AccountGateway["updateProfile"]>(async (input, options) => {
    const service = gateway.account;
    const sessionId = session?.id;
    if (!service || !sessionId) throw supersededError();
    const updated = await mutateAccount(sessionId, "profile", input, async (next) => {
      const result = await service.updateProfile(input, next);
      if (result.id !== sessionId) throw new Error("No pudimos validar los datos de tu cuenta.");
      return result;
    }, options);
    stateRevisionRef.current += 1;
    // Profile updates must not overwrite a balance received from a concurrent play.
    setSession((current) => current?.id === updated.id ? { ...current, displayName: updated.displayName } : current);
    return updated;
  }, [gateway, mutateAccount, session?.id]);

  const account = useMemo<AccountGateway | undefined>(() => (
    gateway.account && session?.id ? {
      getSettings: getAccountSettings,
      saveLimits: saveAccountLimits,
      pause: pauseAccount,
      updateProfile: updateAccountProfile,
    } : undefined
  ), [gateway, getAccountSettings, pauseAccount, saveAccountLimits, session?.id, updateAccountProfile]);

  const value = useMemo(
    () => ({
      account,
      session,
      catalog,
      plays,
      results,
      movements,
      movementsLoading,
      movementsError,
      loading,
      error,
      unauthorized,
      gatewayMode: gateway.mode,
      walletAvailable: gateway.capabilities.wallet,
      withdrawalAvailable: Boolean(gateway.capabilities.wallet && gateway.capabilities.withdrawal && gateway.withdraw),
      persistentRegistration: gateway.capabilities.persistentRegistration,
      refresh,
      refreshMovements,
      requestPlay,
      getTicket,
      getPendingWalletOperationKey,
      requestTopUp,
      requestWithdrawal,
      login,
      register,
      logout,
    }),
    [
      account,
      session,
      catalog,
      plays,
      results,
      movements,
      movementsLoading,
      movementsError,
      loading,
      error,
      unauthorized,
      gateway,
      refresh,
      refreshMovements,
      requestPlay,
      getTicket,
      getPendingWalletOperationKey,
      requestTopUp,
      requestWithdrawal,
      login,
      register,
      logout,
    ],
  );

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProduct() {
  const context = useContext(ProductContext);
  if (!context) throw new Error("useProduct debe usarse dentro de ProductProvider");
  return context;
}
