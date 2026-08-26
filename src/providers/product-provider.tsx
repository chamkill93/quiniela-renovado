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
  isProductGatewayUnauthorizedError,
  ProductOperationSupersededError,
  ProductRequestEpoch,
  requireAuthenticatedProductSnapshot,
  type ProductGateway,
  type ProductGatewayMode,
  type ProductPlayCommand,
  type ProductRequestScope,
  type ProductSnapshot,
  type ProductTopUpInput,
  type ProductTopUpResponse,
} from "@/lib/product/gateway";

export interface ProductContextValue {
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
  persistentRegistration: boolean;
  refresh: () => Promise<void>;
  refreshMovements: () => Promise<void>;
  requestPlay: (command: ProductPlayCommand) => Promise<PlayResponse>;
  getTicket: (ticketId: string) => Promise<MockTicket>;
  requestTopUp: (input: ProductTopUpInput) => Promise<ProductTopUpResponse>;
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
    inFlightTicketRequestsRef.current.clear();
    ticketCacheRef.current.clear();
    setSession(data.session);
    setCatalog(data.catalog);
    setPlays([...data.plays]);
    setResults([...data.results]);
    setUnauthorized(false);
  }, []);

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
      if (scope.isCurrent()) {
        setMovementsLoading(true);
        setMovementsError(null);
      }

      try {
        const data = await gateway.getMovements({ signal: scope.signal });
        scope.assertCurrent();
        if (requestId !== movementsRequestRef.current) return;
        setMovements([...data]);
        setMovementsError(null);
      } catch (reason) {
        if (!scope.isCurrent() || isAbortError(reason)) return;
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
    if (!session || !gateway.capabilities.wallet) {
      resetMovements();
      return;
    }
    const scope = coordinator.open();
    try {
      await loadMovements(scope, "No pudimos cargar los movimientos.");
    } finally {
      scope.close();
    }
  }, [coordinator, gateway, loadMovements, resetMovements, session]);

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
      const resultsRequestId = ++resultsRequestRef.current;
      const run = async () => {
        if (kind === "instant") {
          try {
            const nextResults = await gateway.getResults({ signal: scope.signal });
            scope.assertCurrent();
            if (resultsRequestId === resultsRequestRef.current) {
              setResults([...nextResults]);
            }
          } catch (reason) {
            if (!scope.isCurrent() || isAbortError(reason)) return;
            handleGatewayError(reason);
          }
        }

        if (scope.isCurrent()) {
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

  const requestPlay = useCallback(
    (command: ProductPlayCommand) => {
      const logicalOperation = `play:${JSON.stringify(command)}`;
      const existing = inFlightMutationsRef.current.get(logicalOperation) as
        | Promise<PlayResponse>
        | undefined;
      if (existing) return existing;
      const authGeneration = authGenerationRef.current;
      const result = enqueueMutation(async () => {
        if (authGeneration !== authGenerationRef.current) throw supersededError();
        const scope = coordinator.open();
        const idempotencyKey =
          mutationKeysRef.current.get(logicalOperation) ??
          createProductIdempotencyKey();
        mutationKeysRef.current.set(logicalOperation, idempotencyKey);
        try {
          const data = await gateway.requestPlay(command, {
            idempotencyKey,
            signal: scope.signal,
          });
          scope.assertCurrent();
          mutationKeysRef.current.delete(logicalOperation);
          stateRevisionRef.current += 1;
          const acceptedTicket = cloneTicket(data.ticket);
          ticketCacheRef.current.set(acceptedTicket.id, acceptedTicket);
          if (data.play.ticketId) {
            ticketCacheRef.current.set(data.play.ticketId, acceptedTicket);
          }
          setSession((current) =>
            current
              ? {
                  ...current,
                  ...data.session,
                  balance: data.session.balance,
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
          return data;
        } catch (reason) {
          if (isSupersededError(reason)) throw reason;
          if (!scope.isCurrent() || isAbortError(reason)) throw supersededError();
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
    [coordinator, enqueueMutation, gateway, handleGatewayError, refreshAfterAcceptedPlay],
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

  const requestTopUp = useCallback(
    (input: ProductTopUpInput) => {
      const logicalOperation = `topup:${JSON.stringify(input)}`;
      const existing = inFlightMutationsRef.current.get(logicalOperation) as
        | Promise<ProductTopUpResponse>
        | undefined;
      if (existing) return existing;
      const authGeneration = authGenerationRef.current;
      const result = enqueueMutation(async () => {
        if (authGeneration !== authGenerationRef.current) throw supersededError();
        const scope = coordinator.open();
        const idempotencyKey =
          mutationKeysRef.current.get(logicalOperation) ??
          createProductIdempotencyKey();
        mutationKeysRef.current.set(logicalOperation, idempotencyKey);
        try {
          const data = await gateway.topUp(input, {
            idempotencyKey,
            signal: scope.signal,
          });
          scope.assertCurrent();
          mutationKeysRef.current.delete(logicalOperation);
          stateRevisionRef.current += 1;
          movementsRequestRef.current += 1;
          setMovementsLoading(false);
          setSession(data.session);
          setMovementsError(null);
          setMovements((current) => {
            const existing = current.some(
              (movement) => movement.id === data.balanceEntry.id,
            );
            return existing ? current : [data.balanceEntry, ...current];
          });
          return data;
        } catch (reason) {
          if (isSupersededError(reason)) throw reason;
          if (!scope.isCurrent() || isAbortError(reason)) throw supersededError();
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
    [coordinator, enqueueMutation, gateway, handleGatewayError],
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
        if (data.source === "backoffice") hydrateAfterAuthentication(requestId);
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

  const value = useMemo(
    () => ({
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
      persistentRegistration: gateway.capabilities.persistentRegistration,
      refresh,
      refreshMovements,
      requestPlay,
      getTicket,
      requestTopUp,
      login,
      register,
      logout,
    }),
    [
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
      requestTopUp,
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
