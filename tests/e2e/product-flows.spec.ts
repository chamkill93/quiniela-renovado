import { expect, test, type APIResponse, type Page } from "@playwright/test";

import type {
  GamingCatalog,
  GamingPlay,
  GamingResult,
  MockSessionView,
  PlacePlayResponse,
  WalletMovement,
} from "@/lib/gaming/types";
import type {
  InstantPlayRequest,
  TraditionalPlayRequest,
} from "@/lib/gaming/schemas";
import {
  activeNavigation,
  E2E_SELECTORS,
  installThemePreference,
  themeFromProjectName,
} from "../helpers/e2e-contract";

interface BootstrapPayload {
  session: MockSessionView;
  catalog: GamingCatalog;
  plays: readonly GamingPlay[];
  results: readonly GamingResult[];
}

const TRADITIONAL_CASES = [
  {
    gameId: "head",
    amount: 500,
    drawId: "early",
    selection: { number: "123" },
  },
  {
    gameId: "prizes",
    amount: 500,
    drawId: "early",
    selection: { number: "234", position: 2 },
  },
  {
    gameId: "invert",
    amount: 500,
    drawId: "early",
    selection: { number: "345", position: 2 },
  },
  {
    gameId: "redoblona",
    amount: 500,
    drawId: "early",
    selection: { head: "456", redoblona: "12", position: 2 },
  },
  {
    gameId: "sapyaite-traditional",
    amount: 500,
    drawId: "early",
    selection: { number: "567" },
  },
  {
    gameId: "megaloto",
    amount: 500,
    drawId: "early",
    selection: {
      numbers: [1, 2, 3, 4, 5, 6],
      modality: "MEGA_FULL" as const,
    },
  },
] satisfies readonly TraditionalPlayRequest[];

const TRADITIONAL_NAMES = [
  "A la Cabeza",
  "A los Premios",
  "Invertida",
  "Redoblona",
  "Sapy’aite",
  "Megaloto",
] as const;

const MULTI_REEL_CASES = [
  {
    request: {
      gameId: "poa5",
      amount: 500,
      selection: { numbers: ["001", "002", "003"] },
    },
    reels: 5,
  },
  {
    request: {
      gameId: "poa10",
      amount: 500,
      selection: { numbers: ["001", "002", "003"] },
    },
    reels: 10,
  },
  {
    request: { gameId: "racha5", amount: 500, selection: "PAR" },
    reels: 5,
  },
] satisfies readonly { request: InstantPlayRequest; reels: 5 | 10 }[];

const ADMIN_PASSWORD = "ficticia-2026";

async function readOkJson<T>(response: APIResponse): Promise<T> {
  const body = (await response.json()) as T;
  expect(
    response.ok(),
    `${response.url()} returned ${response.status()}: ${JSON.stringify(body)}`,
  ).toBe(true);
  return body;
}

async function bootstrap(page: Page): Promise<BootstrapPayload> {
  return readOkJson<BootstrapPayload>(
    await page.request.get("/api/mock/bootstrap"),
  );
}

async function postPlay(
  page: Page,
  path: "/api/mock/instant" | "/api/mock/traditional",
  data: InstantPlayRequest | TraditionalPlayRequest,
  idempotencyKey: string,
) {
  const response = await page.request.post(path, {
    data,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  const body = await readOkJson<PlacePlayResponse>(response);
  return { body, response };
}

test.beforeEach(async ({ page }, testInfo) => {
  await installThemePreference(
    page,
    themeFromProjectName(testInfo.project.name),
  );
});

test("accepts all six traditional games and exposes server-backed balance and Mis Jugadas", async ({
  page,
}) => {
  const initial = await bootstrap(page);
  const acceptedPlayIds: string[] = [];

  for (const [index, request] of TRADITIONAL_CASES.entries()) {
    const { body } = await postPlay(
      page,
      "/api/mock/traditional",
      request,
      `e2e-traditional-${index + 1}`,
    );

    expect(body.replayed).toBe(false);
    expect(body.play.gameId).toBe(request.gameId);
    expect(body.play.status).toBe("PENDING");
    acceptedPlayIds.push(body.play.id);
  }

  expect(new Set(acceptedPlayIds).size).toBe(6);

  const after = await bootstrap(page);
  expect(after.session.balance).toBe(initial.session.balance - 3_000);
  expect(after.plays).toHaveLength(6);
  expect(new Set(after.plays.map((play) => play.gameId))).toEqual(
    new Set(TRADITIONAL_CASES.map((request) => request.gameId)),
  );

  await page.goto("/mis-jugadas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Mis Jugadas" }),
  ).toBeVisible();
  for (const gameName of TRADITIONAL_NAMES) {
    await expect(
      page.getByRole("heading", { level: 3, name: gameName, exact: true }),
    ).toBeVisible();
  }

  await page.goto("/saldos", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Saldo y movimientos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: /247[.\s]?000/,
    }),
  ).toBeVisible();
});

test("publishes exactly nine instant games and returns 5, 10, and 5 reel results", async ({
  page,
}) => {
  const state = await bootstrap(page);
  expect(state.catalog.instant).toHaveLength(9);

  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Instantáneas" }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId(E2E_SELECTORS.instantGamesGrid)
      .getByTestId(E2E_SELECTORS.instantGameCard),
  ).toHaveCount(9);

  for (const [index, { request, reels }] of MULTI_REEL_CASES.entries()) {
    const definition = state.catalog.instant.find(
      (game) => game.id === request.gameId,
    );
    expect(definition, `${request.gameId} must exist in the catalog`).toBeDefined();
    expect(definition?.reels).toBe(reels);

    const { body } = await postPlay(
      page,
      "/api/mock/instant",
      request,
      `e2e-multi-reel-${index + 1}`,
    );
    expect(body.play.resultNumbers).toHaveLength(reels);
  }
});

test("shows the five-second countdown, ticket, and persisted instant result", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/instantaneas/racha5", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Jugar ahora", exact: true }).click();

  const reels = page.getByLabel("Rodillos numéricos").locator("[data-spinning]");
  await expect(reels).toHaveCount(5);
  await expect(page.getByText("Comprobante en 5 s", { exact: true })).toBeVisible({
    timeout: 4_000,
  });

  const ticket = page.getByRole("dialog", { name: "Jugada registrada" });
  await expect(ticket).toBeVisible({ timeout: 8_000 });
  await expect(
    ticket.getByRole("heading", { level: 2, name: "Jugada registrada" }),
  ).toBeVisible();

  await page.goto("/resultados", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Resultados" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Racha 5", exact: true }),
  ).toBeVisible();
});

test("replays the same Idempotency-Key without a second debit", async ({
  page,
}) => {
  const initial = await bootstrap(page);
  const request = {
    gameId: "head",
    amount: 1_000,
    drawId: "early",
    selection: { number: "321" },
  } satisfies TraditionalPlayRequest;
  const idempotencyKey = "e2e-replay-key-01";

  const first = await postPlay(
    page,
    "/api/mock/traditional",
    request,
    idempotencyKey,
  );
  const replay = await postPlay(
    page,
    "/api/mock/traditional",
    request,
    idempotencyKey,
  );

  expect(first.body.replayed).toBe(false);
  expect(first.response.headers()["idempotency-replayed"]).toBe("false");
  expect(replay.body.replayed).toBe(true);
  expect(replay.response.headers()["idempotency-replayed"]).toBe("true");
  expect(replay.body.play.id).toBe(first.body.play.id);
  expect(replay.body.session.balance).toBe(first.body.session.balance);

  const after = await bootstrap(page);
  expect(after.session.balance).toBe(initial.session.balance - request.amount);
  expect(after.plays).toHaveLength(1);

  const movements = await readOkJson<{ movements: readonly WalletMovement[] }>(
    await page.request.get("/api/mock/wallet/movements"),
  );
  expect(movements.movements).toHaveLength(1);
  expect(movements.movements[0]).toMatchObject({
    type: "STAKE",
    amount: -request.amount,
    referenceId: first.body.play.id,
  });
});

test("credits a top-up through the UI and confirms the server balance", async ({
  page,
}) => {
  await page.goto("/saldos", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Saldo y movimientos" }),
  ).toBeVisible();
  const initial = await bootstrap(page);

  await page.getByRole("button", { name: "Recargar saldo", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Recargar saldo" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Confirmar recarga", exact: true })
    .click();
  await expect(
    dialog.getByRole("status").filter({
      hasText: "Recarga acreditada correctamente.",
    }),
  ).toBeVisible();

  const after = await bootstrap(page);
  expect(after.session.balance).toBe(initial.session.balance + 50_000);
});

test("hides Gestión from PLAYER, authenticates ADMIN, and logs out", async ({
  page,
}) => {
  expect(ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(8);

  await page.goto("/gestion", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Acceso restringido" }),
  ).toBeVisible();
  const playerNavigation = activeNavigation(page);
  await expect(playerNavigation).toBeVisible();
  await expect(
    playerNavigation.getByRole("link", { name: "Gestión", exact: true }),
  ).toHaveCount(0);

  await page.goto("/cuenta", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ingresá a tu cuenta" }),
  ).toBeVisible();

  await page.getByLabel("Documento o teléfono").fill("admin");
  await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
  await page
    .getByRole("button", { name: "Ingresar", exact: true })
    .last()
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Cuenta" }),
  ).toBeVisible();
  await expect(page.getByText("Gestión habilitada", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Gestión",
      exact: true,
      includeHidden: true,
    }),
  ).toHaveCount(1);

  await page.goto("/gestion", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Gestión de juegos" }),
  ).toBeVisible();

  await page.goto("/cuenta", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ingresá a tu cuenta" }),
  ).toBeVisible();
});
