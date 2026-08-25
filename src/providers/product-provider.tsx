"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  ApiErrorBody,
  BootstrapResponse,
  MockPlay,
  MockResult,
  MockSession,
  PlayResponse,
} from "@/lib/product/api-types";

interface ProductContextValue {
  session: MockSession | null;
  plays: MockPlay[];
  results: MockResult[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  requestPlay: (path: "/api/mock/instant" | "/api/mock/traditional", body: unknown) => Promise<PlayResponse>;
  login: (documentOrPhone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const ProductContext = createContext<ProductContextValue | null>(null);

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & ApiErrorBody;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operación.");
  }
  return body;
}

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MockSession | null>(null);
  const [plays, setPlays] = useState<MockPlay[]>([]);
  const [results, setResults] = useState<MockResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/mock/bootstrap", { cache: "no-store" });
      const data = await readJson<BootstrapResponse>(response);
      setSession(data.session);
      setPlays(data.plays ?? []);
      setResults(data.results ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos cargar tu sesión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch("/api/mock/bootstrap", { cache: "no-store", signal: controller.signal })
      .then((response) => readJson<BootstrapResponse>(response))
      .then((data) => {
        if (!active) return;
        setSession(data.session);
        setPlays(data.plays ?? []);
        setResults(data.results ?? []);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "No pudimos cargar tu sesión.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const requestPlay = useCallback(
    async (path: "/api/mock/instant" | "/api/mock/traditional", body: unknown) => {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      const data = await readJson<PlayResponse>(response);
      setSession((current) =>
        current ? { ...current, ...data.session, balance: data.session.balance } : (data.session as MockSession),
      );
      setPlays((current) => {
        const existing = current.some((play) => play.id === data.play.id);
        return existing ? current : [data.play, ...current];
      });
      if (path === "/api/mock/instant") {
        const resultsResponse = await fetch("/api/mock/results", { cache: "no-store" });
        if (resultsResponse.ok) {
          const resultsBody = (await resultsResponse.json()) as { results?: MockResult[] };
          setResults(resultsBody.results ?? []);
        }
      }
      return data;
    },
    [],
  );

  const login = useCallback(
    async (documentOrPhone: string, password: string) => {
      const response = await fetch("/api/mock/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentOrPhone, password }),
      });
      const data = await readJson<{ session: MockSession }>(response);
      setSession(data.session);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    const response = await fetch("/api/mock/session/logout", { method: "POST" });
    await readJson<{ ok: true }>(response);
    setSession(null);
    setPlays([]);
    setResults([]);
  }, []);

  const value = useMemo(
    () => ({ session, plays, results, loading, error, refresh, requestPlay, login, logout }),
    [session, plays, results, loading, error, refresh, requestPlay, login, logout],
  );

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProduct() {
  const context = useContext(ProductContext);
  if (!context) throw new Error("useProduct debe usarse dentro de ProductProvider");
  return context;
}
