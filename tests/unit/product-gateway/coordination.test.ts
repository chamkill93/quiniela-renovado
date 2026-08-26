import { describe, expect, it } from "vitest";
import type { GamingCatalog } from "@/lib/gaming/types";
import {
  ProductOperationSupersededError,
  ProductRequestEpoch,
  ProductSessionUnavailableError,
  requireAuthenticatedProductSnapshot,
} from "@/lib/product/gateway";

const catalog = {
  amounts: [],
  draws: [],
  traditional: [],
  instant: [],
} as unknown as GamingCatalog;

describe("ProductRequestEpoch", () => {
  it("aborts and invalidates every request from an older auth epoch", () => {
    const epoch = new ProductRequestEpoch();
    const bootstrap = epoch.open();
    const movements = epoch.open();

    expect(bootstrap.isCurrent()).toBe(true);
    expect(movements.isCurrent()).toBe(true);

    epoch.advance();

    expect(bootstrap.signal.aborted).toBe(true);
    expect(movements.signal.aborted).toBe(true);
    expect(bootstrap.isCurrent()).toBe(false);
    expect(movements.isCurrent()).toBe(false);
    expect(() => bootstrap.assertCurrent()).toThrow(
      ProductOperationSupersededError,
    );
  });

  it("keeps the new epoch current when an ignored older response resolves", () => {
    const epoch = new ProductRequestEpoch();
    const stale = epoch.open();
    const current = epoch.advanceAndOpen();

    expect(stale.isCurrent()).toBe(false);
    expect(current.isCurrent()).toBe(true);
    expect(() => current.assertCurrent()).not.toThrow();

    current.close();
    expect(current.isCurrent()).toBe(false);
  });

  it("lets an auth commit invalidate work started while logout was pending", () => {
    const epoch = new ProductRequestEpoch();
    const logout = epoch.advanceAndOpen();
    const concurrentRefresh = epoch.open();

    logout.assertCurrent();
    epoch.advance();

    expect(logout.isCurrent()).toBe(false);
    expect(concurrentRefresh.signal.aborted).toBe(true);
    expect(concurrentRefresh.isCurrent()).toBe(false);
  });
});

describe("requireAuthenticatedProductSnapshot", () => {
  it("returns a confirmed authenticated snapshot", () => {
    const snapshot = {
      session: {
        id: "session-1",
        displayName: "Ana",
        role: "PLAYER" as const,
        balance: 100_000,
        currency: "PYG",
      },
      catalog,
      plays: [],
      results: [],
    };

    expect(requireAuthenticatedProductSnapshot(snapshot)).toBe(snapshot);
  });

  it("turns a successful bootstrap without session into a propagated 401", () => {
    const snapshot = { session: null, catalog, plays: [], results: [] };

    const error = (() => {
      try {
        requireAuthenticatedProductSnapshot(snapshot);
      } catch (reason) {
        return reason;
      }
    })();

    expect(error).toBeInstanceOf(ProductSessionUnavailableError);
    expect(error).toMatchObject({ status: 401, code: "SESSION_REQUIRED" });
  });
});
