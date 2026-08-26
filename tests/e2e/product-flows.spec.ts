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
import { buildGamingCatalog } from "@/lib/gaming";
import {
  activeNavigation,
  E2E_SELECTORS,
  expectNoHorizontalOverflow,
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

test("renders the authoritative Home hero in dark, light and responsive layouts", async ({
  page,
}, testInfo) => {
  const now = new Date();
  const catalog = buildGamingCatalog("REFUND", now);
  const authoritativeResult = {
    id: "external-home-result-246",
    source: "DRAW" as const,
    gameId: "head" as const,
    gameName: "A la Cabeza",
    drawId: "previous-quiniela-home",
    result: "246",
    resultNumbers: ["246"],
    occurredAt: new Date(now.getTime() - 3_600_000).toISOString(),
  };

  await page.route("**/api/mock/bootstrap", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: "home-fixture-player",
          displayName: "Jugador",
          role: "PLAYER",
          balance: 250_000,
          currency: "PYG",
        },
        catalog,
        plays: [],
        results: [authoritativeResult],
      }),
    });
  });
  await page.route("**/api/mock/results", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [authoritativeResult] }),
    });
  });
  await page.route("**/api/mock/wallet/movements", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ movements: [] }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const hero = page.getByTestId("home-hero");
  await expect(hero).toBeVisible();
  await expect(
    hero.getByRole("heading", { level: 1, name: "Tus números. Tu momento." }),
  ).toBeVisible();
  await expect(hero.getByRole("link", { name: "Jugar Quiniela" })).toHaveAttribute(
    "href",
    "/quinielas",
  );
  await expect(hero.getByRole("link", { name: "Ver Instantáneas" })).toHaveAttribute(
    "href",
    "/instantaneas",
  );
  await expect(hero.locator("[data-reel-column]")).toHaveCount(3);
  await expect(hero.locator('[data-reel-result="246"]')).toHaveAttribute(
    "aria-label",
    "Último resultado publicado 246",
  );
  await expect(hero.getByTestId("home-hero-fire")).toBeVisible();
  await expect(hero.getByText("En vivo", { exact: false })).toHaveCount(0);
  await expect(hero.getByText("Ganaste", { exact: false })).toHaveCount(0);
  await expect(page.locator('[aria-label="Accesos rápidos"]')).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    themeFromProjectName(testInfo.project.name),
  );

  const layout = await hero.evaluate((element) => {
    const [copy, reel] = Array.from(element.children);
    const heroBox = element.getBoundingClientRect();
    const copyBox = copy.getBoundingClientRect();
    const reelBox = reel.getBoundingClientRect();
    return {
      heroHeight: heroBox.height,
      copyRight: copyBox.right,
      copyBottom: copyBox.bottom,
      reelX: reelBox.x,
      reelY: reelBox.y,
    };
  });

  if (testInfo.project.name.includes("1366x768")) {
    expect(layout.reelX).toBeGreaterThanOrEqual(layout.copyRight - 1);
    expect(layout.heroHeight).toBeLessThanOrEqual(380);
  } else {
    expect(layout.reelY).toBeGreaterThanOrEqual(layout.copyBottom - 1);
  }
  await expectNoHorizontalOverflow(page);
});

test("shows only four traditional games and retires the former direct routes", async ({
  page,
}) => {
  await page.goto("/quinielas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Elegí cómo querés jugar" }),
  ).toBeVisible();

  const grid = page.getByTestId(E2E_SELECTORS.traditionalGamesGrid);
  const cards = grid.getByTestId(E2E_SELECTORS.traditionalGameCard);
  await expect(cards).toHaveCount(4);
  await expect(grid.getByText("A la Cabeza", { exact: true })).toBeVisible();
  await expect(grid.getByText("A los Premios", { exact: true })).toBeVisible();
  await expect(grid.getByText("Invertida", { exact: true })).toBeVisible();
  await expect(grid.getByText("Redoblona", { exact: true })).toBeVisible();
  await expect(grid.getByText("Sapy’aite", { exact: true })).toHaveCount(0);
  await expect(grid.getByText("Megaloto", { exact: true })).toHaveCount(0);

  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });
  const instantGrid = page.getByTestId(E2E_SELECTORS.instantGamesGrid);
  await expect(instantGrid.getByText("Sapy’aite", { exact: true })).toBeVisible();

  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Sapy’aite tradicional", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Megaloto", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sapy’aite: par o impar.", { exact: true })).toBeVisible();

  for (const path of [
    "/quinielas/sapyaite-traditional",
    "/quinielas/megaloto",
  ]) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should be retired`).toBe(404);
  }
});

test("uses the approved 3D icon theme and responsive catalog grid", async ({
  page,
}, testInfo) => {
  const initialTheme = themeFromProjectName(testInfo.project.name);
  const nextTheme = initialTheme === "dark" ? "light" : "dark";

  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });
  const grid = page.getByTestId(E2E_SELECTORS.instantGamesGrid);
  const icons = grid.locator("[data-game-icon]");
  await expect(icons).toHaveCount(9);
  await expect(icons.first()).toHaveAttribute("data-game-icon", "sapyaite");
  await expect(icons.first()).toHaveAttribute("data-game-icon-family", "instant");
  await expect(icons.first()).toHaveAttribute("data-game-icon-slug", "sapyaite");

  const expectedInitialPath = `/assets/quinie-icons-v2/games/instant/${initialTheme}/sapyaite.webp`;
  await expect
    .poll(() => icons.first().evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain(expectedInitialPath);

  const columnCount = await grid.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columnCount).toBe((page.viewportSize()?.width ?? 0) >= 768 ? 3 : 2);
  await expectNoHorizontalOverflow(page);

  await page.getByTestId(E2E_SELECTORS.themeToggle).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", nextTheme);
  const expectedNextPath = `/assets/quinie-icons-v2/games/instant/${nextTheme}/sapyaite.webp`;
  await expect
    .poll(() => icons.first().evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain(expectedNextPath);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", nextTheme);
  await expect
    .poll(() =>
      page
        .getByTestId(E2E_SELECTORS.instantGamesGrid)
        .locator('[data-game-icon="sapyaite"]')
        .evaluate((element) => getComputedStyle(element).backgroundImage),
    )
    .toContain(expectedNextPath);

  await page.goto("/instantaneas/sapyaite", { waitUntil: "domcontentloaded" });
  const amountChip = page.locator('[data-amount-chip-asset="500"] span');
  await expect
    .poll(() => amountChip.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain(`/assets/quinie-icons-v2/chips/${nextTheme}/500.webp`);

  await page.goto("/quinielas/head", { waitUntil: "domcontentloaded" });
  const drawIcon = page.locator('[data-draw-icon="early"]');
  const activePseudoElement = nextTheme === "dark" ? "::before" : "::after";
  await expect
    .poll(() =>
      drawIcon.evaluate(
        (element, pseudoElement) => getComputedStyle(element, pseudoElement).backgroundImage,
        activePseudoElement,
      ),
    )
    .toContain(`/assets/quinie-icons-v2/draws/${nextTheme}/tempranero.webp`);
  await expect
    .poll(() =>
      drawIcon.evaluate(
        (element, pseudoElement) => getComputedStyle(element, pseudoElement).opacity,
        activePseudoElement,
      ),
    )
    .toBe("1");
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

test("keeps the reel active and opens the receipt only from Mis Jugadas", async ({
  page,
}) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/instantaneas/racha5", { waitUntil: "domcontentloaded" });

  const reelStage = page.getByLabel("Rodillos numéricos");
  const playButton = page.getByRole("button", { name: "Jugar", exact: true });
  await expect(reelStage).toHaveAttribute("data-state", "preview");
  await expect(reelStage).toHaveAttribute("data-variant", "classic");
  await expect(page.getByRole("button", { name: "Gs. 10.000", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gs. 20.000", exact: true })).toHaveCount(0);
  await expect(page.getByText("La jugada se registra una sola vez y el resultado se define antes de animar.", { exact: true })).toHaveCount(0);

  const viewport = page.viewportSize();
  const playButtonBox = await playButton.boundingBox();
  if (!viewport || !playButtonBox) throw new Error("No se pudo medir el botón Jugar.");
  expect(playButtonBox.y).toBeGreaterThanOrEqual(0);
  expect(playButtonBox.y + playButtonBox.height).toBeLessThanOrEqual(viewport.height);

  await playButton.click();

  await expect(reelStage.locator('[data-spinning="false"]')).toHaveCount(5);
  await expect(page.getByRole("dialog", { name: "Jugada registrada" })).toHaveCount(0);
  await expect(page.getByText("Comprobante en 5 s", { exact: true })).toHaveCount(0);

  await page.goto("/mis-jugadas", { waitUntil: "domcontentloaded" });
  const playItem = page.getByRole("article").filter({
    has: page.getByRole("heading", { level: 3, name: "Racha 5", exact: true }),
  });
  await playItem.getByRole("button", { name: "Ver mi comprobante" }).click();

  const ticket = page.getByRole("dialog", { name: "Jugada registrada" });
  await expect(ticket).toBeVisible({ timeout: 45_000 });
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

test("renders an authoritative fixture result without invoking local game logic", async ({
  page,
}) => {
  const occurredAt = "2026-08-25T15:00:00.000Z";
  const session = {
    id: "external-fixture-player",
    displayName: "Jugador Fixture",
    role: "PLAYER" as const,
    balance: 250_000,
    currency: "PYG" as const,
  };
  const catalog = buildGamingCatalog(
    "REFUND",
    new Date("2026-08-25T12:00:00.000Z"),
  );
  const play = {
    id: "external-play-246",
    ticketId: "external-ticket-246",
    family: "INSTANT" as const,
    gameId: "sapyaite" as const,
    gameName: "Sapy’aite",
    selection: "PAR",
    drawId: null,
    amount: 10_000,
    currency: "PYG" as const,
    status: "WON" as const,
    result: "246",
    resultNumbers: ["246"],
    ruleResult: "PAR",
    matches: 1,
    payoutMultiplier: 2,
    prize: 20_000,
    createdAt: occurredAt,
  };
  const ticket = {
    id: play.ticketId,
    code: "FIXTURE-246",
    playId: play.id,
    gameId: play.gameId,
    gameName: play.gameName,
    family: play.family,
    selection: play.selection,
    drawId: null,
    amount: play.amount,
    currency: play.currency,
    status: play.status,
    result: play.result,
    resultNumbers: play.resultNumbers,
    ruleResult: play.ruleResult,
    prize: play.prize,
    issuedAt: occurredAt,
  };
  const result = {
    id: "external-result-246",
    source: "INSTANT" as const,
    gameId: play.gameId,
    gameName: play.gameName,
    drawId: null,
    result: play.result,
    resultNumbers: play.resultNumbers,
    occurredAt,
  };
  let acceptedPlays = 0;

  await page.route("**/api/mock/bootstrap", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session,
        catalog,
        plays: acceptedPlays > 0 ? [play] : [],
        results: [],
      }),
    });
  });
  await page.route("**/api/mock/wallet/movements", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ movements: [] }),
    });
  });
  await page.route("**/api/mock/results", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [result] }),
    });
  });
  await page.route("**/api/mock/instant", async (route) => {
    const request = route.request();
    expect(request.headers()["idempotency-key"]).toBeTruthy();
    expect(request.postDataJSON()).toEqual({
      gameId: "sapyaite",
      amount: 10_000,
      selection: "PAR",
    });
    acceptedPlays += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        play,
        ticket,
        session: { balance: 240_000, currency: "PYG" },
        replayed: false,
      }),
    });
  });
  await page.route("**/api/mock/tickets/external-ticket-246", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ticket }),
    });
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/instantaneas/sapyaite", {
    waitUntil: "domcontentloaded",
  });
  const reelStage = page.getByLabel("Rodillos numéricos");
  const betPanel = page.getByTestId("instant-bet-panel");
  const reelBoxBefore = await reelStage.boundingBox();
  const betPanelBoxBefore = await betPanel.boundingBox();
  const scrollYBefore = await page.evaluate(() => window.scrollY);
  if (!reelBoxBefore || !betPanelBoxBefore) throw new Error("No se pudo medir el juego instantáneo.");
  expect(Math.abs(reelBoxBefore.width - betPanelBoxBefore.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(reelBoxBefore.x - betPanelBoxBefore.x)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Jugar", exact: true }).click();

  await expect(page.getByLabel("Rodillo 1: 246")).toBeVisible();
  await expect(page.getByText("Premio Gs. 20.000", { exact: true })).toBeVisible();
  const resultPopout = page.getByTestId("instant-result-popout");
  await expect(resultPopout).toHaveCSS("position", "fixed");
  const betPanelBoxAfter = await betPanel.boundingBox();
  const scrollYAfter = await page.evaluate(() => window.scrollY);
  if (!betPanelBoxAfter) throw new Error("No se pudo volver a medir el panel de jugada.");
  expect(
    Math.abs((betPanelBoxAfter.y + scrollYAfter) - (betPanelBoxBefore.y + scrollYBefore)),
  ).toBeLessThanOrEqual(1);
  await resultPopout.getByRole("button", { name: "Cerrar resultado" }).click();
  await expect(resultPopout).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Jugada registrada" })).toHaveCount(0);

  await page.goto("/mis-jugadas", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Ver mi comprobante" }).click();
  await expect(
    page.getByRole("dialog", { name: "Jugada registrada" }),
  ).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText("FIXTURE-246", { exact: true })).toBeVisible();
  expect(acceptedPlays).toBe(1);
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

test("keeps administration outside the frontend, authenticates, and logs out", async ({
  page,
}) => {
  expect(ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(8);

  await page.goto("/", { waitUntil: "domcontentloaded" });
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
  await expect(page.getByText("Sesión de operador", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Gestión",
      exact: true,
      includeHidden: true,
    }),
  ).toHaveCount(0);

  await page.goto("/cuenta", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ingresá a tu cuenta" }),
  ).toBeVisible();
});

test("registers through the explicit non-persistent preview fixture", async ({
  page,
}) => {
  await page.goto("/cuenta", { waitUntil: "domcontentloaded" });
  const logout = page.getByRole("button", { name: "Cerrar sesión", exact: true });
  await expect(logout).toBeVisible();
  await logout.click();

  await page.getByRole("button", { name: "Registrarme", exact: true }).click();
  await page.getByLabel("Nombre visible").fill("Ana Preview");
  await page.getByLabel("Documento o teléfono").fill("0981000000");
  await page.getByLabel("Contraseña").fill("segura-2026");
  await page
    .getByLabel("Acepto los términos de uso y la política de privacidad.")
    .check();
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Ana Preview" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Registro simulado");
});

test("renders an unauthorized state when the backoffice session expires", async ({
  page,
}) => {
  await page.route("**/api/mock/bootstrap", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "SESSION_EXPIRED", message: "Sesión vencida" },
      }),
    });
  });

  await page.goto("/mis-jugadas", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Iniciá sesión para consultar tus jugadas.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir a iniciar sesión" })).toBeVisible();
});

test("offers a safe retry when the preview transport is unavailable", async ({
  page,
}) => {
  await page.route("**/api/mock/bootstrap", async (route) => {
    await route.abort("failed");
  });

  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });
  const alert = page.getByRole("alert").filter({
    hasText: "No se pudo conectar con el servicio de vista previa.",
  });
  await expect(alert).toContainText("No se pudo conectar con el servicio de vista previa.");
  await expect(alert.getByRole("button", { name: "Reintentar" })).toBeVisible();
});
