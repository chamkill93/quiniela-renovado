// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildGamingCatalog } from "@/lib/gaming";
import type { PlacePlayResponse } from "@/lib/gaming/types";
import {
  createPreviewProductGateway,
  type ProductPlayCommand,
} from "@/lib/product/gateway";
import { ProductProvider, useProduct } from "@/providers/product-provider";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const session = {
  id: "preview-timeout-user",
  displayName: "Preview Timeout",
  role: "PLAYER" as const,
  balance: 25_000,
  currency: "PYG" as const,
};

const catalog = buildGamingCatalog(
  "REFUND",
  new Date("2026-08-25T12:00:00.000Z"),
);

const firstCommand = {
  kind: "instant",
  input: { gameId: "sapyaite", amount: 500, selection: "PAR" },
} as const satisfies ProductPlayCommand;

const secondCommand = {
  kind: "instant",
  input: { gameId: "sapyaite", amount: 500, selection: "IMPAR" },
} as const satisfies ProductPlayCommand;

function acceptedSecondPlay(): PlacePlayResponse {
  return {
    play: {
      id: "play-after-timeout",
      ticketId: "ticket-after-timeout",
      family: "INSTANT",
      gameId: "sapyaite",
      gameName: "Sapy’aite",
      selection: "IMPAR",
      drawId: null,
      amount: 500,
      currency: "PYG",
      prize: 0,
      status: "LOST",
      result: "497",
      resultNumbers: ["497"],
      ruleResult: "ODD",
      matches: null,
      payoutMultiplier: 0,
      createdAt: "2026-08-25T12:00:00.000Z",
    },
    ticket: {
      id: "ticket-after-timeout",
      code: "QL-AFTER-TIMEOUT",
      playId: "play-after-timeout",
      gameId: "sapyaite",
      gameName: "Sapy’aite",
      family: "INSTANT",
      selection: "IMPAR",
      drawId: null,
      amount: 500,
      currency: "PYG",
      status: "LOST",
      result: "497",
      resultNumbers: ["497"],
      ruleResult: "ODD",
      prize: 0,
      issuedAt: "2026-08-25T12:00:00.000Z",
    },
    session: { balance: 24_500, currency: "PYG" },
    replayed: false,
  };
}

function ProviderStateProbe() {
  const { error, loading, requestPlay, session: activeSession } = useProduct();
  const [firstResult, setFirstResult] = useState("idle");
  const [secondResult, setSecondResult] = useState("idle");

  const submitQueuedPlays = () => {
    setFirstResult("pending");
    setSecondResult("pending");
    void requestPlay(firstCommand).then(
      () => setFirstResult("unexpected-success"),
      (reason: unknown) =>
        setFirstResult(
          typeof reason === "object" && reason !== null && "code" in reason
            ? String(reason.code)
            : "unknown-error",
        ),
    );
    void requestPlay(secondCommand).then(
      (response) => setSecondResult(response.play.id),
      () => setSecondResult("unexpected-error"),
    );
  };

  return (
    <div>
      <span data-testid="provider-loading">{loading ? "loading" : "idle"}</span>
      <span data-testid="provider-error">{error ?? "no-error"}</span>
      <span>{activeSession?.displayName ?? "no-session"}</span>
      <span data-testid="first-result">{firstResult}</span>
      <span data-testid="second-result">{secondResult}</span>
      <button onClick={submitQueuedPlays} type="button">
        Encolar jugadas
      </button>
    </div>
  );
}

afterEach(cleanup);

describe("PreviewProductGateway timeout in ProductProvider", () => {
  it("clears bootstrap loading when an injected fetch never settles", async () => {
    const gateway = createPreviewProductGateway({
      fetch: vi.fn(() => new Promise<Response>(() => undefined)),
      timeoutMs: 20,
    });

    render(
      <ProductProvider gateway={gateway}>
        <ProviderStateProbe />
      </ProductProvider>,
    );

    expect(screen.getByTestId("provider-loading").textContent).toBe("loading");
    await waitFor(() => {
      expect(screen.getByTestId("provider-loading").textContent).toBe("idle");
    });
    expect(screen.getByTestId("provider-error").textContent).toContain(
      "no respondió dentro de 20 ms",
    );
  });

  it("releases the mutation queue after a never-settling play times out", async () => {
    let instantRequests = 0;
    let markFirstRequestStarted!: () => void;
    const firstRequestStarted = new Promise<void>((resolve) => {
      markFirstRequestStarted = resolve;
    });
    const gateway = createPreviewProductGateway({
      timeoutMs: 100,
      fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/bootstrap")) {
          return jsonResponse({ session, catalog, plays: [], results: [] });
        }
        if (url.endsWith("/movements")) {
          return jsonResponse({ movements: [] });
        }
        if (url.endsWith("/results")) return jsonResponse({ results: [] });
        if (url.endsWith("/instant")) {
          instantRequests += 1;
          const body = JSON.parse(String(init?.body)) as { selection: string };
          if (body.selection === "PAR") {
            markFirstRequestStarted();
            return await new Promise<Response>(() => undefined);
          }
          return jsonResponse(acceptedSecondPlay());
        }
        throw new Error(`Unexpected preview request: ${url}`);
      }),
    });

    render(
      <ProductProvider gateway={gateway}>
        <ProviderStateProbe />
      </ProductProvider>,
    );
    await screen.findByText(session.displayName);

    fireEvent.click(screen.getByRole("button", { name: "Encolar jugadas" }));
    await firstRequestStarted;
    expect(instantRequests).toBe(1);
    expect(screen.getByTestId("second-result").textContent).toBe("pending");

    await waitFor(() => {
      expect(screen.getByTestId("first-result").textContent).toBe(
        "GATEWAY_TIMEOUT",
      );
      expect(screen.getByTestId("second-result").textContent).toBe(
        "play-after-timeout",
      );
    });
    expect(instantRequests).toBe(2);
  });
});
