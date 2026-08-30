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
  expectInsideHorizontalViewport,
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
    selection: { initialNumber: "45", initialUntil: 1, redoblonaNumber: "12", redoblonaUntil: 7 },
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

const PUBLIC_PAGE_ROUTES = [
  "/",
  "/ayuda",
  "/cuenta",
  "/gestion",
  "/instantaneas",
  "/instantaneas/sapyaite",
  "/instantaneas/pyae",
  "/instantaneas/petei",
  "/instantaneas/mokoi",
  "/instantaneas/mbohapy",
  "/instantaneas/poa",
  "/instantaneas/poa5",
  "/instantaneas/poa10",
  "/instantaneas/racha5",
  "/legal/juego-responsable",
  "/legal/privacidad",
  "/legal/terminos",
  "/mis-jugadas",
  "/quinielas",
  "/quinielas/head",
  "/quinielas/prizes",
  "/quinielas/invert",
  "/quinielas/redoblona",
  "/quinielas/sapyaite",
  "/reglas",
  "/resultados",
  "/saldos",
  "/sorteos/tempranero",
  "/sorteos/matutino",
  "/sorteos/vespertino",
  "/sorteos/nocturno",
] as const;

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

async function prepareTraditionalCheckout(page: Page, catalog: GamingCatalog) {
  // Functional clicks must not race smooth scrolling or the real sales cutoff.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const firstCutoff = Math.min(...catalog.draws.map((draw) => Date.parse(draw.closesAt)));
  await page.clock.setFixedTime(new Date(firstCutoff - 60_000));
}

async function postPlay(
  page: Page,
  path: "/api/mock/instant" | "/api/mock/traditional",
  data: InstantPlayRequest | TraditionalPlayRequest,
  idempotencyKey: string,
) {
  const { session } = await bootstrap(page);
  const response = await page.request.post(path, {
    data,
    headers: {
      "Idempotency-Key": idempotencyKey,
      "X-Account-Session": session.id,
    },
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

test.describe("all public pages", () => {
  for (const path of PUBLIC_PAGE_ROUTES) {
    test(`loads ${path} without a page crash`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("crash", () => pageErrors.push("page crash"));

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(response, `${path} did not return a document response`).not.toBeNull();
      expect(response?.status(), `${path} returned an HTTP error`).toBeLessThan(400);
      await expect(page.getByRole("main")).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.readyState)).toBe("complete");
      expect(pageErrors, `${path} emitted a browser page error`).toEqual([]);
    });
  }
});

test("renders the promotional Home hero in dark, light and responsive layouts", async ({
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
    hero.getByRole("heading", { level: 1, name: "Tu jugada empieza acá." }),
  ).toBeVisible();
  await expect(hero.getByRole("link", { name: "Jugar Quiniela" })).toHaveAttribute(
    "href",
    "/quinielas",
  );
  await expect(hero.getByRole("link", { name: /^Jugar/ })).toHaveCount(1);
  await expect(hero.getByRole("link", { name: "Jugar Sapy’aite" })).toHaveCount(0);
  await expect(hero.locator("[data-reel-column]")).toHaveCount(3);
  const promotionalReel = hero.locator('[data-reel-source="promotional"]');
  await expect(promotionalReel).toHaveAttribute("data-reel-result", /^\d{3}$/);
  await expect(promotionalReel).toHaveAttribute("aria-label", /^Combinación aleatoria \d{3}$/);
  const firstPromotionalResult = await promotionalReel.getAttribute("data-reel-result");
  expect(firstPromotionalResult).not.toBe("000");

  const fire = hero.getByTestId("home-hero-fire");
  await expect(fire).toBeVisible();
  const reelArtwork = hero.locator('img[src*="rodillo-fuego"]');
  await expect(reelArtwork).toBeVisible();
  await expect.poll(() => reelArtwork.evaluate(
    (element) => (element as HTMLImageElement).naturalWidth,
  )).toBeGreaterThan(0);
  const artworkMetrics = await reelArtwork.evaluate((element) => ({
    naturalHeight: (element as HTMLImageElement).naturalHeight,
    naturalWidth: (element as HTMLImageElement).naturalWidth,
    objectFit: getComputedStyle(element).objectFit,
  }));
  expect(artworkMetrics.objectFit).toBe("contain");
  expect(artworkMetrics.naturalWidth / artworkMetrics.naturalHeight).toBeCloseTo(2162 / 727, 1);
  await expect(hero.getByText("En vivo", { exact: false })).toHaveCount(0);
  await expect(hero.getByText("Ganaste", { exact: false })).toHaveCount(0);
  await expect(page.locator('[aria-label="Accesos rápidos"]')).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    themeFromProjectName(testInfo.project.name),
  );

  const layout = await hero.evaluate((element) => {
    const [copy, reel, actions] = Array.from(element.children);
    const heroBox = element.getBoundingClientRect();
    const copyBox = copy.getBoundingClientRect();
    const reelBox = reel.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    return {
      heroHeight: heroBox.height,
      copyRight: copyBox.right,
      copyBottom: copyBox.bottom,
      reelBottom: reelBox.bottom,
      reelRight: reelBox.right,
      actionsY: actionsBox.y,
      reelX: reelBox.x,
      reelY: reelBox.y,
    };
  });

  if (testInfo.project.name.includes("1366x768")) {
    expect(layout.reelX).toBeGreaterThanOrEqual(layout.copyRight - 1);
    expect(layout.heroHeight).toBeLessThanOrEqual(380);
  } else {
    expect(layout.reelY).toBeGreaterThanOrEqual(layout.copyBottom - 1);
    expect(layout.actionsY).toBeGreaterThanOrEqual(layout.reelBottom - 1);
  }
  expect(layout.reelRight).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await expectNoHorizontalOverflow(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() => promotionalReel.getAttribute("data-reel-result"))
    .not.toBe(firstPromotionalResult);
});

test("completes Home with scheduled draws, fourteen result balls and the official Mega Loto banner", async ({
  page,
}) => {
  const now = new Date("2026-08-27T12:15:00.000Z");
  await page.clock.setFixedTime(now);
  const baseCatalog = buildGamingCatalog("REFUND", now);
  const catalog: GamingCatalog = {
    ...baseCatalog,
    draws: [
      ...baseCatalog.draws,
      { ...baseCatalog.draws.find((draw) => draw.id === "night")!, id: "quiniela-night", label: "Nocturno" },
      { ...baseCatalog.draws.find((draw) => draw.id === "evening")!, id: "quiniela-evening", label: "Vespertino" },
    ],
  };
  const nightValues = [
    "497", "208", "000", "731", "112", "005", "830",
    "701", "550", "909", "123", "888", "010", "044",
  ];
  const latestNight: GamingResult = {
    id: "home-latest-night",
    source: "DRAW",
    gameId: "prizes",
    gameName: "A los Premios",
    drawId: "quiniela-night",
    result: "999",
    resultNumbers: ["999", "998", "997"],
    drawNumbers: nightValues.map((value, index) => ({ position: index + 1, value })).reverse(),
    occurredAt: "2026-08-26T23:30:00.000Z",
  };
  const publishedResults: GamingResult[] = [
    {
      ...latestNight,
      id: "home-previous-night",
      drawNumbers: nightValues.map((_, index) => ({ position: index + 1, value: "666" })),
      occurredAt: "2026-08-25T23:30:00.000Z",
    },
    {
      ...latestNight,
      id: "home-legacy-head",
      drawId: "nocturno",
      gameId: "head",
      gameName: "A la Cabeza",
      drawNumbers: undefined,
    },
    {
      ...latestNight,
      id: "home-earlier-vespertino",
      drawId: "quiniela-evening",
      drawNumbers: nightValues.map((_, index) => ({ position: index + 1, value: "777" })),
      occurredAt: "2026-08-26T19:30:00.000Z",
    },
    latestNight,
    {
      ...latestNight,
      id: "home-legacy-prizes",
      drawId: "nocturno",
      drawNumbers: undefined,
      resultNumbers: ["998", "997", "996"],
    },
    {
      id: "home-megaloto-excluded",
      source: "DRAW",
      gameId: "megaloto",
      gameName: "Megaloto",
      drawId: "early",
      result: "999",
      resultNumbers: ["999"],
      occurredAt: new Date(now.getTime() - 30_000).toISOString(),
    },
  ];

  await page.route("**/api/mock/bootstrap", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: "home-sections-player",
          displayName: "Jugador",
          role: "PLAYER",
          balance: 187_500,
          currency: "PYG",
        },
        catalog,
        plays: [],
        results: publishedResults,
      }),
    });
  });
  await page.route("**/api/mock/results", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: publishedResults }),
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
  const drawsSection = page.getByTestId("home-draws-section");
  const resultsSection = page.getByTestId("home-results-section");
  const megaBanner = page.getByTestId("home-megaloto-banner");
  const megaCta = megaBanner.getByRole("link", { name: /sitio oficial de Mega Loto/i });
  const siteFooter = page.locator(".q-site-footer");
  const drawCards = page.getByTestId("home-draw-card");
  const resultCards = page.getByTestId("home-result-card");
  const inlineStream = drawsSection.getByTestId("home-draw-stream");
  const liveIndicator = page.getByTestId("draw-live-indicator");
  const homeUrl = page.url();

  await expect(drawCards).toHaveCount(4);
  await expect(drawsSection.locator('[data-testid="home-draw-card"]:enabled')).toHaveCount(1);
  await expect(liveIndicator).toBeVisible();
  await expect(liveIndicator).toHaveAttribute("data-active", "false");
  await expect(liveIndicator).toHaveAttribute("aria-haspopup", "dialog");
  await liveIndicator.click();
  const liveDialog = page.getByRole("dialog", { name: "LIVE de Quiniela" });
  await expect(liveDialog).toBeVisible();
  await expect(liveIndicator).toHaveAttribute("aria-expanded", "true");
  await expect(liveDialog.getByText("PROGRAMACIÓN PUBLICITARIA", { exact: true })).toBeVisible();
  const popoutAdvertising = liveDialog.getByTestId("draw-advertising-player");
  await expect(popoutAdvertising).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/Z3eXyAIz65I/);
  await expect(popoutAdvertising).toHaveAttribute("src", /JV9ajM_6Rsc/);
  await liveDialog.getByRole("button", { name: "Cerrar transmisión LIVE" }).click();
  await expect(liveDialog).toHaveCount(0);
  await expect(liveIndicator).toBeFocused();
  await expect(liveIndicator).toHaveAttribute("aria-expanded", "false");
  await expect(inlineStream).toBeHidden();
  await expect(inlineStream).toHaveAttribute("id", "home-draw-stream");
  await expect(page.getByTestId("draw-preview-video")).toHaveCount(0);
  await expect(resultCards).toHaveCount(14);
  await expect(
    page.getByRole("heading", { name: "Instantáneas habilitadas" }),
  ).toHaveCount(0);

  const expectedDraws = [
    ["early", "tempranero", "Tempranero", "10:30"],
    ["morning", "matutino", "Matutino", "13:00"],
    ["evening", "vespertino", "Vespertino", "16:30"],
    ["night", "nocturno", "Nocturno", "20:30"],
  ] as const;

  for (let index = 0; index < expectedDraws.length; index += 1) {
    const [drawId, slug, label, time] = expectedDraws[index];
    const card = drawCards.nth(index);
    await expect(card).toHaveAttribute("data-draw-id", drawId);
    await expect(card).toHaveAttribute("data-draw-slug", slug);
    await expect(card).toHaveRole("button");
    await expect(card).toHaveAttribute("type", "button");
    await expect(card).not.toHaveAttribute("href");
    await expect(card).toHaveAttribute("aria-expanded", "false");
    await expect(card).toHaveAttribute("aria-controls", "home-draw-stream");
    await expect(card).toHaveAttribute("aria-label", new RegExp(`^Ver sorteo: ${label},`));
    if (drawId === "early") await expect(card).toBeEnabled();
    else await expect(card).toBeDisabled();
    await expect(card.getByText(label, { exact: true })).toBeVisible();
    await expect(card.getByText(time, { exact: true })).toBeVisible();
    const icon = card.getByRole("img", { name: `Sorteo ${label}` });
    await expect(icon).toHaveAttribute("data-draw-icon", drawId);
    await expect(icon).toHaveAttribute("data-draw-icon-slug", slug);
  }
  await expect(
    page.locator('[data-testid="home-draw-card"][data-active="true"]'),
  ).toHaveCount(1);
  await expect(drawsSection.getByText("PRÓXIMO", { exact: true })).toHaveCount(1);
  await expect(
    page.locator('[data-testid="home-draw-card"][data-active="true"] time'),
  ).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  await expect(drawsSection.locator("time")).toHaveCount(1);
  await expect(drawsSection.getByRole("button")).toHaveCount(4);
  await expect(drawsSection.getByRole("link")).toHaveCount(0);
  await expect(drawsSection.getByTestId("home-next-draw-action")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="home-draw-card"][data-active="true"] [data-testid="home-draw-countdown"] + [data-testid="home-next-draw-action"]'),
  ).toHaveText("Ver sorteo");
  await expect(drawsSection.getByText("El próximo es", { exact: true })).toHaveCount(0);
  await expect(drawsSection.getByText("Ver transmisión", { exact: true })).toHaveCount(0);

  const resultMetadata = resultsSection.getByTestId("home-results-draw");
  const resultBalls = resultsSection.getByRole("list", {
    name: "Las 14 posturas del último sorteo publicado",
    exact: true,
  });
  const expectedPositions = Array.from({ length: 14 }, (_, index) => String(index + 1));
  const expectedEntryOrder = Array.from({ length: 14 }, (_, index) => String(14 - index));

  await expect(resultsSection.getByRole("heading", {
    level: 2,
    name: "Último sorteo publicado",
    exact: true,
  })).toBeVisible();
  await expect(resultMetadata).toHaveCount(1);
  await expect(resultMetadata).toContainText("Nocturno");
  await expect(resultMetadata).toContainText("26/08/2026");
  await expect(resultMetadata).toContainText("20:30");
  await expect(resultBalls).toHaveAttribute("data-testid", "home-results-balls");
  await expect(resultBalls).toHaveAttribute("tabindex", "0");
  await expect(resultBalls).toHaveAttribute("aria-roledescription", "carrusel");
  await expect(resultCards).toHaveCount(14);
  expect(await resultCards.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-position")),
  )).toEqual(expectedPositions);
  expect(await resultCards.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-entry-order")),
  )).toEqual(expectedEntryOrder);
  expect(await resultCards.getByTestId("home-result-value").allTextContents()).toEqual(nightValues);
  expect(await resultCards.getByTestId("home-result-posture").allTextContents())
    .toEqual(expectedPositions.map((position) => `${position}ª POSTURA`));

  for (const [index, value] of nightValues.entries()) {
    const position = index + 1;
    const card = resultCards.nth(index);
    await expect(card).toHaveAttribute("data-position", String(position));
    await expect(card).toHaveAttribute("data-entry-order", String(15 - position));
    await expect(card.getByTestId("home-result-value")).toHaveText(value);
    await expect(card.getByTestId("home-result-posture")).toHaveText(`${position}ª POSTURA`);
    await expect(card).toHaveAccessibleName(`${position}.ª postura: número ${value}`);
  }

  for (const [index, tone] of ["gold", "silver", "bronze"].entries()) {
    const card = resultCards.nth(index);
    await expect(card).toHaveAttribute("data-tone", tone);
    expect(decodeURIComponent(await card.locator("img").getAttribute("src") ?? ""))
      .toContain(`/assets/results/balls/ball-${tone}.webp`);
    await expect(card.locator("img")).toHaveAttribute("alt", "");
  }
  await expect(resultsSection.locator('[data-testid="home-result-card"][data-tone="red"]')).toHaveCount(11);
  await expect(resultCards.getByTestId("home-result-rank")).toHaveCount(0);

  await expect(resultsSection.getByRole("tab")).toHaveCount(0);
  await expect(resultsSection.getByRole("tablist")).toHaveCount(0);
  await expect(resultsSection.getByRole("tabpanel")).toHaveCount(0);
  await expect(resultsSection.getByTestId("home-results-carousel")).toHaveCount(1);
  await expect(resultsSection.getByTestId("home-results-previous")).toHaveCount(1);
  await expect(resultsSection.getByTestId("home-results-next")).toHaveCount(1);
  await expect(resultsSection.getByTestId("home-results-pagination-segment")).toHaveCount(4);
  await expect(resultsSection.getByTestId("home-results-pagination-segment").first())
    .toHaveAttribute("data-active", "true");
  await expect(resultsSection.getByText(/desliz|swipe|arrastr/i)).toHaveCount(0);
  for (const formerModality of ["A LA CABEZA", "A LOS PREMIOS", "REDOBLONA", "INVERTIDA"]) {
    await expect(resultsSection.getByText(formerModality, { exact: true })).toHaveCount(0);
  }

  await resultBalls.scrollIntoViewIfNeeded();
  await expect(resultBalls).not.toHaveAttribute("data-animate");
  const entryMotion = await resultCards.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return {
      customIndex: style.getPropertyValue("--result-entry-index").trim(),
      delayMs: Number.parseFloat(style.animationDelay) * 1_000,
      name: style.animationName,
    };
  }));
  expect(entryMotion.map(({ customIndex }) => customIndex))
    .toEqual(Array.from({ length: 14 }, () => ""));
  expect(entryMotion.map(({ delayMs }) => Math.round(delayMs)))
    .toEqual(Array.from({ length: 14 }, () => 0));
  expect(entryMotion.every(({ name }) => name === "none")).toBe(true);

  await expect(resultsSection.getByText("999", { exact: true })).toHaveCount(0);
  await expect(resultsSection.getByText(/muestra|demostración|demo/i)).toHaveCount(0);
  for (const excludedValue of ["666", "777", "998", "997"]) {
    await expect(resultsSection.getByText(excludedValue, { exact: true })).toHaveCount(0);
  }
  await expect(resultsSection.getByRole("link", { name: /ver todos/i })).toHaveAttribute(
    "href",
    "/resultados",
  );
  await expect(resultMetadata).toHaveCount(1);
  await expect(resultMetadata).toContainText("Nocturno");
  await expect(resultMetadata).toContainText("26/08/2026");
  await expect(resultMetadata).toContainText("20:30");
  await expect(megaCta).toHaveAttribute(
    "href",
    "https://lotoqr.megaloto.com.py/",
  );
  await expect(megaCta).toHaveAttribute("target", "_blank");
  await expect(megaCta).toHaveAttribute("rel", /noopener/);
  await expect(megaCta).toHaveAttribute("rel", /noreferrer/);
  await expect(megaBanner.getByText("Sorteo exclusivo con 6 números.", { exact: true })).toBeVisible();
  await expect(megaBanner.getByText(/Un producto de Lotería Mega Loto/i)).toHaveCount(0);
  await expect(megaBanner.getByText(/1 al 45/i)).toHaveCount(0);
  await expect(megaBanner.getByRole("img", { name: "Logo oficial de Mega Loto" })).toHaveAttribute(
    "src",
    "/assets/quinie-home-final/megaloto/logo-mega-loto-circular-transparente.png",
  );
  const megaBalls = megaBanner.getByRole("img", { name: "Bolillas de Mega Loto" });
  await expect(megaBalls).toHaveAttribute(
    "src",
    "/assets/quinie-home-final/megaloto/bolillas-visual-mockup.png",
  );
  await expect(megaBalls).toBeVisible();
  await expect(megaBanner.getByText("IR A MEGA LOTO", { exact: true })).toBeVisible();

  const verticalOrder = await Promise.all(
    [hero, drawsSection, resultsSection, megaBanner, siteFooter].map((locator) =>
      locator.evaluate((element) => element.getBoundingClientRect().top),
    ),
  );
  expect(verticalOrder).toEqual([...verticalOrder].sort((a, b) => a - b));

  const viewportWidth = page.viewportSize()?.width ?? 0;
  const drawColumns = await page.getByTestId("home-draw-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(drawColumns).toBe(viewportWidth >= 1_280 ? 4 : 2);
  for (const card of await drawCards.all()) {
    await expectInsideHorizontalViewport(card, page);
  }

  await expect(resultsSection.getByRole("button", { name: "Ver más resultados" })).toHaveCount(0);
  await expectInsideHorizontalViewport(resultBalls, page);
  const ballTrack = await resultBalls.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      direction: style.direction,
      display: style.display,
      flexWrap: style.flexWrap,
      overflowX: style.overflowX,
      scrollbarWidth: style.scrollbarWidth,
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(ballTrack.display).toBe("flex");
  expect(ballTrack.flexWrap).toBe("nowrap");
  expect(ballTrack.direction).toBe("ltr");
  expect(ballTrack.overflowX).toBe("auto");
  expect(ballTrack.scrollbarWidth).toBe("none");
  expect(ballTrack.scrollLeft).toBeLessThanOrEqual(1);
  expect(ballTrack.scrollWidth).toBeGreaterThan(ballTrack.clientWidth);

  const previousResults = resultsSection.getByTestId("home-results-previous");
  const nextResults = resultsSection.getByTestId("home-results-next");
  if (viewportWidth < 768) {
    await expect(previousResults).toBeHidden();
    await expect(nextResults).toBeHidden();
    const mobileGeometry = await resultBalls.evaluate((element) => {
      const track = element.getBoundingClientRect();
      const cards = Array.from(
        element.querySelectorAll(':scope > [data-testid="home-result-card"]'),
        (child) => child.getBoundingClientRect(),
      );
      const visibleFraction = (box: DOMRect) => (
        Math.max(0, Math.min(track.right, box.right) - Math.max(track.left, box.left)) / box.width
      );
      return cards.slice(0, 4).map((box) => visibleFraction(box));
    });
    expect(mobileGeometry.slice(0, 3).every((fraction) => fraction >= 0.99)).toBe(true);
    expect(mobileGeometry[3]).toBeGreaterThanOrEqual(0.28);
    expect(mobileGeometry[3]).toBeLessThanOrEqual(0.42);
  } else {
    await expect(previousResults).toBeHidden();
    await expect(nextResults).toBeVisible();
  }

  await resultBalls.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
  await expect(resultsSection.getByTestId("home-results-pagination-segment").nth(3))
    .toHaveAttribute("data-active", "true");
  await resultBalls.evaluate((element) => element.scrollTo({ left: 0 }));

  if (viewportWidth < 768) {
    const widths = await Promise.all([
      megaBanner.evaluate((element) => element.getBoundingClientRect().width),
      megaCta.evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(Math.abs(widths[0] - widths[1])).toBeLessThan(35);
  }
  await expectNoHorizontalOverflow(page);

  const earlyCard = drawCards.first();
  const morningCard = drawCards.nth(1);
  await earlyCard.click();
  await expect(page).toHaveURL(homeUrl);
  await expect(inlineStream).toBeVisible();
  await expect(inlineStream).toHaveAttribute("data-draw-target-at", "2026-08-27T13:30:00.000Z");
  await expect(inlineStream.getByRole("heading", { level: 3, name: "Tempranero" })).toBeVisible();
  await expect(earlyCard).toHaveAttribute("aria-expanded", "true");
  await expect(earlyCard).toHaveAttribute("aria-label", /^Ocultar sorteo: Tempranero,/);
  await expect(earlyCard.getByTestId("home-next-draw-action")).toHaveText("Ocultar");
  const previewVideo = page.getByTestId("draw-preview-video");
  const advertisingPlayer = page.getByTestId("draw-advertising-player");
  await expect(previewVideo).toHaveCount(0);
  await expect(advertisingPlayer).toBeVisible();
  await expect(advertisingPlayer).toHaveCount(1);
  await expect(advertisingPlayer).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/Z3eXyAIz65I/);
  await expect(advertisingPlayer).toHaveAttribute("src", /JV9ajM_6Rsc/);
  await expect(advertisingPlayer).toHaveAttribute("allow", /autoplay/);
  await expect(inlineStream.getByTestId("draw-countdown")).toHaveText("01:15:00");
  await expect(inlineStream.getByRole("heading")).toHaveCount(1);
  await expect(inlineStream.getByText("Último resultado", { exact: true })).toHaveCount(0);
  await expect(inlineStream.getByText("Historial reciente", { exact: true })).toHaveCount(0);
  await expect(drawsSection.locator("main")).toHaveCount(0);
  await expect(drawsSection.getByRole("link")).toHaveCount(0);
  await expect(inlineStream.locator("iframe")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await earlyCard.click();
  await expect(inlineStream).toBeHidden();
  await expect(advertisingPlayer).toHaveCount(0);
  await expect(earlyCard).toHaveAttribute("aria-expanded", "false");
  await expect(earlyCard.getByTestId("home-next-draw-action")).toHaveText("Ver sorteo");
  await expect(page).toHaveURL(homeUrl);

  await earlyCard.focus();
  await earlyCard.press("Enter");
  await expect(inlineStream).toBeVisible();
  await expect(advertisingPlayer).toHaveCount(1);
  await expect(earlyCard).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL(homeUrl);

  await earlyCard.press("Space");
  await expect(inlineStream).toBeHidden();
  await expect(advertisingPlayer).toHaveCount(0);
  await expect(earlyCard).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(homeUrl);

  await earlyCard.press("Space");
  await expect(inlineStream).toBeVisible();
  await expect(advertisingPlayer).toHaveCount(1);
  await expect(morningCard).toBeDisabled();
  await page.clock.setFixedTime(new Date("2026-08-27T13:20:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(liveIndicator).toHaveAttribute("data-active", "true");
  await expect(liveIndicator).toHaveAttribute("data-draw-id", "early");
  await expect(advertisingPlayer).toHaveCount(0);
  await expect(previewVideo).toBeVisible();
  await expect(previewVideo).toHaveCount(1);
  await expect(previewVideo).toHaveAttribute("src", "/assets/video/quinie-streaming-simulado.mp4");
  await expect(previewVideo).toHaveAttribute("autoplay", "");
  await expect(previewVideo).toHaveAttribute("loop", "");
  await expect(previewVideo).toHaveAttribute("playsinline", "");
  await expect(previewVideo).toHaveJSProperty("muted", true);
  await expect(earlyCard).toBeEnabled();
  await page.clock.setFixedTime(new Date("2026-08-27T13:30:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(liveIndicator).toHaveAttribute("data-active", "true");
  await expect(earlyCard).toBeDisabled();
  await expect(morningCard).toBeEnabled();
  await expect(previewVideo).toHaveAttribute("aria-label", "Streaming de Tempranero");
  await expect(inlineStream.getByRole("button", { name: "Cerrar sorteo de Tempranero" })).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-08-27T14:00:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(liveIndicator).toHaveAttribute("data-active", "false");
  await expect(previewVideo).toHaveCount(0);
  await expect(advertisingPlayer).toHaveCount(1);
  await morningCard.click();
  await expect(inlineStream.getByRole("heading", { level: 3, name: "Matutino" })).toBeVisible();
  await expect(inlineStream).toHaveAttribute("data-draw-target-at", "2026-08-27T16:00:00.000Z");
  await expect(inlineStream.getByTestId("draw-countdown")).toHaveText("02:00:00");
  await expect(previewVideo).toHaveCount(0);
  await expect(advertisingPlayer).toHaveCount(1);
  await expect(advertisingPlayer).toHaveAttribute("title", "Publicidad de Quiniela");
  await expect(earlyCard).toHaveAttribute("aria-expanded", "false");
  await expect(morningCard).toHaveAttribute("aria-expanded", "true");
  await expect(drawsSection.locator('[data-testid="home-draw-card"][aria-expanded="true"]'))
    .toHaveCount(1);
  await expect(page).toHaveURL(homeUrl);

  await morningCard.press("Enter");
  await expect(inlineStream).toBeHidden();
  await expect(previewVideo).toHaveCount(0);
  await expect(advertisingPlayer).toHaveCount(0);
  await expect(morningCard).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(homeUrl);
});

test("keeps a compact footer with all legal links together across the menus", async ({ page }) => {
  test.setTimeout(120_000);
  for (const route of [
    "/quinielas", "/instantaneas", "/instantaneas/sapyaite", "/mis-jugadas",
    "/cuenta", "/reglas", "/resultados", "/saldos", "/ayuda",
    "/legal/terminos", "/legal/privacidad",
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const footer = page.locator(".q-site-footer");
    const links = footer.getByRole("navigation").getByRole("link");
    await expect(links).toHaveCount(5);
    await expect(footer.getByRole("link", { name: "Términos", exact: true })).toHaveAttribute("href", "/legal/terminos");
    await expect(footer.getByRole("link", { name: "Privacidad", exact: true })).toHaveAttribute("href", "/legal/privacidad");
    const rows = await links.evaluateAll((elements) => elements.map((element) =>
      Math.round(element.getBoundingClientRect().top),
    ));
    const rowCount = new Set(rows).size;
    expect(rowCount, route).toBe(page.viewportSize()!.width < 360 ? 2 : 1);
    await expect(footer.getByRole("link", { name: "Juego responsable", exact: true }))
      .toHaveText("Juego responsable");
    const gap = await page.getByRole("main").evaluate((element) => {
      const footer = document.querySelector(".q-site-footer")!;
      return footer.getBoundingClientRect().top - element.lastElementChild!.getBoundingClientRect().bottom;
    });
    expect(gap, route).toBeGreaterThanOrEqual(0);
    expect(gap, route).toBeLessThanOrEqual(24);
    await footer.scrollIntoViewIfNeeded();
    for (const link of await links.all()) await expectInsideHorizontalViewport(link, page);
    if (page.viewportSize()!.width < 980) {
      // Wallet/session content can grow after hydration; check the settled layout.
      await expect(async () => {
        await footer.scrollIntoViewIfNeeded();
        const legalBottom = await links.last().evaluate((element) => element.getBoundingClientRect().bottom);
        const navTop = await page.getByRole("navigation", { name: "Navegación móvil", exact: true }).evaluate((element) => element.getBoundingClientRect().top);
        expect(legalBottom, route).toBeLessThanOrEqual(navTop);
      }).toPass({ timeout: 10_000 });
    }
    await expectNoHorizontalOverflow(page);
  }
});

test("groups Sapy’aite and green Mega Loto in Quinielas and redirects legacy links", async ({
  page,
}) => {
  await page.goto("/quinielas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Quinielas" }),
  ).toBeVisible();

  const grid = page.getByTestId(E2E_SELECTORS.traditionalGamesGrid);
  const cards = grid.getByTestId(E2E_SELECTORS.traditionalGameCard);
  await expect(cards).toHaveCount(4);
  await expect(grid.getByText("A la Cabeza", { exact: true })).toBeVisible();
  await expect(grid.getByText("A los Premios", { exact: true })).toBeVisible();
  await expect(grid.getByText("Invertida", { exact: true })).toBeVisible();
  await expect(grid.getByText("Redoblona", { exact: true })).toBeVisible();
  await expect(grid.getByText("Sapy’aite", { exact: true })).toBeVisible();
  const megaCard = grid.getByTestId("mega-loto-card");
  await expect(megaCard.getByText("Mega Loto", { exact: true })).toBeVisible();
  await expect(megaCard).toHaveAttribute("data-tone", "green");
  await expect(megaCard).toHaveAttribute("href", "https://lotoqr.megaloto.com.py/");
  await expect(megaCard).toHaveAttribute("target", "_blank");
  await expect(grid.getByRole("link")).toHaveCount(6);
  await expect(page.locator('nav a[href="/instantaneas"]')).toHaveCount(0);
  await expect(grid.getByText("Quiniela tradicional", { exact: true })).toHaveCount(0);
  await expect(grid.getByText("Desde", { exact: true })).toHaveCount(0);
  await expect(grid.getByText("Gs. 500", { exact: true })).toHaveCount(0);

  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/quinielas$/);
  await expect(page.getByTestId(E2E_SELECTORS.instantGameCard)).toBeVisible();
  await page.goto("/instantaneas/sapyaite", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/quinielas\/sapyaite$/);
  await expect(page.getByRole("textbox", { name: "Número exacto" })).toBeVisible();
  await page.getByRole("link", { name: "← Volver a Quinielas" }).click();
  await expect(page).toHaveURL(/\/quinielas$/);

  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Cómo jugar" }),
  ).toBeVisible();
  const rulesGrid = page.getByTestId("rules-grid");
  await expect(rulesGrid.getByRole("article")).toHaveCount(6);
  await expect(page.locator('main button[aria-expanded="false"]')).toHaveCount(6);
  await expect(page.getByText("Sapy’aite tradicional", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Megaloto", { exact: true })).toHaveCount(0);
  await expect(page.locator('main a[href^="/quinielas/"], main a[href^="/instantaneas/"]')).toHaveCount(5);
  await expect(rulesGrid.getByRole("link")).toHaveCount(6);
  const megaRule = rulesGrid.getByTestId("rule-card-megaloto");
  await expect(megaRule.getByRole("heading", { name: "Mega Loto", exact: true })).toBeVisible();
  const officialMegaRule = megaRule.getByRole("link", { name: /^Sitio oficial de Mega Loto/ });
  await expect(officialMegaRule).toHaveAttribute("href", "https://lotoqr.megaloto.com.py/");
  await expect(officialMegaRule).toHaveAttribute("target", "_blank");
  await expect(officialMegaRule).toHaveAttribute("rel", /noopener/);
  await expect(officialMegaRule).toHaveAttribute("rel", /noreferrer/);
  await expect(megaRule.getByRole("link", { name: /^Jugar/ })).toHaveCount(0);
  const headRule = page.getByRole("link", { name: "Jugar A la Cabeza", exact: true });
  const sapyaiteRule = page.getByRole("link", { name: "Jugar Sapy’aite", exact: true });
  await expect(headRule).toHaveAttribute("href", "/quinielas/head");
  await expect(sapyaiteRule).toHaveAttribute("href", "/quinielas/sapyaite");
  await expect(page.getByText("Multiplicador de referencia", { exact: true })).toHaveCount(0);
  expect(await rulesGrid.textContent()).not.toMatch(/×|multiplicador|cuánto paga|premio total|tabla de pagos|\bGs\./i);
  const sapyaiteRuleCard = rulesGrid.getByTestId("rule-card-sapyaite");
  await expect(sapyaiteRuleCard.getByText("000 a 999", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver reglas de Sapy’aite", exact: true }).click();
  await expect(sapyaiteRuleCard.getByRole("button", { name: "Contraer reglas de Sapy’aite", exact: true })).toHaveAttribute("aria-expanded", "true");
  for (const name of ["Paso a paso", "Condiciones del acierto", "Ejemplo"]) {
    await expect(sapyaiteRuleCard.getByRole("heading", { name, level: 3 })).toBeVisible();
  }
  await expect(
    sapyaiteRuleCard.getByText("Elegí tres cifras y comparalas con un resultado inmediato.", { exact: true }),
  ).toBeVisible();
  await expect(
    sapyaiteRuleCard.getByText("Para acertar, las tres cifras deben coincidir exactamente y en el mismo orden.", { exact: true }),
  ).toBeVisible();
  await expect(
    sapyaiteRuleCard.getByText("Cada jugada se compara con un único resultado de tres cifras, sin esperar un sorteo programado ni elegir una postura.", { exact: true }),
  ).toBeVisible();
  const ruleColumns = await rulesGrid.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  const ruleViewportWidth = page.viewportSize()!.width;
  expect(ruleColumns).toBe(ruleViewportWidth < 640 ? 1 : ruleViewportWidth < 1200 ? 2 : 3);
  await expectNoHorizontalOverflow(page);

  await headRule.click();
  await expect(page).toHaveURL(/\/quinielas\/head$/);
  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Jugar Sapy’aite", exact: true }).click();
  await expect(page).toHaveURL(/\/quinielas\/sapyaite$/);

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

  await page.goto("/quinielas", { waitUntil: "domcontentloaded" });
  const traditionalGrid = page.getByTestId(E2E_SELECTORS.traditionalGamesGrid);
  const traditionalColumnCount = await traditionalGrid.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(traditionalColumnCount).toBe(2);
  await expectNoHorizontalOverflow(page);

  if ((page.viewportSize()?.width ?? 0) > 1_000) {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto("/quinielas", { waitUntil: "domcontentloaded" });
    const tabletGrid = page.getByTestId(E2E_SELECTORS.traditionalGamesGrid);
    const tabletCard = tabletGrid.getByTestId(E2E_SELECTORS.traditionalGameCard).first();
    const tabletColumns = await tabletGrid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    expect(tabletColumns).toBe(2);
    expect(
      await tabletCard.locator("strong").evaluate((element) => element.getBoundingClientRect().width),
    ).toBeGreaterThan(100);
    expect(
      await tabletCard.locator("p").evaluate((element) => element.getBoundingClientRect().width),
    ).toBeGreaterThan(100);
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1_366, height: 768 });
  }

  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });
  const grid = page.getByTestId(E2E_SELECTORS.traditionalGamesGrid);
  const icons = grid.getByTestId(E2E_SELECTORS.instantGameCard).locator("[data-game-icon]");
  await expect(icons).toHaveCount(1);
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
  expect(columnCount).toBe(2);
  await expect(grid.getByText("Resultado inmediato", { exact: true })).toHaveCount(0);
  await expect(grid.getByText("Desde", { exact: true })).toHaveCount(0);
  await expect(grid.getByText("Gs. 500", { exact: true })).toHaveCount(0);
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
        .getByTestId(E2E_SELECTORS.traditionalGamesGrid)
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

for (const gameId of ["head", "prizes", "invert", "redoblona"] as const) {
  test(`traditional checkout reviews ${gameId} and pays once from the server balance`, async ({ page }) => {
    const initial = await bootstrap(page);
    await prepareTraditionalCheckout(page, initial.catalog);
    let paymentRequests = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/mock/traditional") paymentRequests += 1;
    });
    const money = (value: number, symbol = "Gs.") => `${symbol} ${new Intl.NumberFormat("es-PY").format(value)}`;
    await page.goto(`/quinielas/${gameId}`, { waitUntil: "domcontentloaded" });
    const headerBalance = page.getByRole("banner").getByRole("link", { name: /^Saldo:/ }).locator(".q-balance__value");
    const reviewButton = page.getByRole("button", { name: "Revisar y pagar", exact: true });
    const stake = page.getByTestId("traditional-stake");
    await expect(page.getByRole("combobox", { name: "Importe por sorteo", exact: true })).toHaveCount(0);
    await expect(stake).toHaveText(money(0));
    await expect(page.getByTestId("traditional-total")).toHaveText(money(0));
    await expect(reviewButton).toBeDisabled();
    await page.getByRole("button", { name: "Números aleatorios", exact: true }).click();
    if (gameId === "redoblona") {
      await expect(page.getByLabel("Número de apuesta inicial", { exact: true })).toHaveValue(/^\d{2}$/);
      await expect(page.getByLabel("Número de Redoblona", { exact: true })).toHaveValue(/^\d{2}$/);
      await expect(page.getByRole("combobox", { name: "Alcance de apuesta inicial", exact: true })).toHaveValue("1");
      await page.getByRole("combobox", { name: "Alcance de Redoblona", exact: true }).selectOption("10");
    } else {
      await expect(page.getByLabel("Número de tres cifras", { exact: true })).toHaveValue(/^(?!000)\d{3}$/);
      await expect(page.getByRole("heading", { level: 2, name: "Número", exact: true })).toBeVisible();
      await expect(page.locator('label[for="traditional-number"]')).toHaveClass(/q-sr-only/);
    }
    await expect(reviewButton).toBeDisabled();
    expect(paymentRequests).toBe(0);
    await page.getByRole("button", { name: "Sumar Gs. 1.000", exact: true }).click();
    await page.getByRole("button", { name: "Sumar Gs. 500", exact: true }).click();
    await expect(stake).toHaveText(money(1_500));
    if (gameId !== "head" && gameId !== "redoblona") await page.getByRole("combobox", { name: "Hasta la posición", exact: true }).selectOption("10");
    await expect(headerBalance).toHaveText(money(initial.session.balance, "₲"));
    expect(paymentRequests).toBe(0);

    await reviewButton.click();
    const reviewDialog = page.getByRole("dialog", { name: "Confirmá tu jugada", exact: true });
    await expect(reviewDialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Borrar importe", exact: true })).toBeDisabled();
    await expect(reviewDialog).toContainText("Se descontará Gs. 1.500 de tu saldo al confirmar.");
    expect(paymentRequests).toBe(0);
    await reviewDialog.getByRole("button", { name: "Volver a editar", exact: true }).click();
    await expect(reviewDialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Borrar importe", exact: true })).toBeEnabled();
    await expect(stake).toHaveText(money(1_500));
    await expect(headerBalance).toHaveText(money(initial.session.balance, "₲"));
    await expectNoHorizontalOverflow(page);

    await reviewButton.click();
    const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/mock/traditional" && response.request().method() === "POST");
    await reviewDialog.getByRole("button", { name: "Pagar Gs. 1.500", exact: true }).click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    const payment = await response.json() as PlacePlayResponse;
    expect(payment.play.gameId).toBe(gameId);
    expect(payment.play.amount).toBe(1_500);
    expect(payment.session.balance).toBe(initial.session.balance - 1_500);
    expect(paymentRequests).toBe(1);
    const success = page.getByRole("dialog", { name: "Jugada registrada", exact: true });
    await expect(success).toBeVisible();
    await expect(success).toContainText(money(payment.session.balance));
    await expect(headerBalance).toHaveText(money(payment.session.balance, "₲"));
    await success.getByRole("link", { name: "Ver en Mis jugadas", exact: true }).click();
    await expect(page).toHaveURL(/\/mis-jugadas$/);
    await expect(page.getByRole("main")).toContainText(money(payment.play.amount));
  });
}

test("traditional checkout accepts 40,000 across four draws and a separate identical play", async ({ page }) => {
  const initial = await bootstrap(page);
  await prepareTraditionalCheckout(page, initial.catalog);
  const submissions: TraditionalPlayRequest[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/mock/traditional") {
      submissions.push(request.postDataJSON() as TraditionalPlayRequest);
    }
  });
  await page.goto("/quinielas/redoblona", { waitUntil: "domcontentloaded" });
  const stake = page.getByTestId("traditional-stake");
  await expect(stake).toHaveText("Gs. 0");
  await expect(page.getByRole("checkbox")).toHaveCount(4);
  for (const draw of await page.getByRole("checkbox").all()) await draw.check();
  await page.getByRole("button", { name: "Números aleatorios", exact: true }).click();
  await page.getByRole("combobox", { name: "Alcance de apuesta inicial", exact: true }).selectOption("8");
  await page.getByRole("combobox", { name: "Alcance de Redoblona", exact: true }).selectOption("10");
  const selection = {
    initialNumber: await page.getByLabel("Número de apuesta inicial", { exact: true }).inputValue(),
    initialUntil: 8,
    redoblonaNumber: await page.getByLabel("Número de Redoblona", { exact: true }).inputValue(),
    redoblonaUntil: 10,
  };
  const reviewButton = page.getByRole("button", { name: "Revisar y pagar", exact: true });
  const review = page.getByRole("dialog", { name: "Confirmá tu jugada", exact: true });
  const success = page.getByRole("dialog", { name: "Jugadas registradas", exact: true });
  for (let batch = 1; batch <= 2; batch += 1) {
    await expect(stake).toHaveText("Gs. 0");
    await expect(reviewButton).toBeDisabled();
    await page.getByRole("button", { name: "Sumar Gs. 5.000", exact: true }).click();
    await page.getByRole("button", { name: "Sumar Gs. 5.000", exact: true }).click();
    await expect(stake).toHaveText("Gs. 10.000");
    await expect(page.getByTestId("traditional-total")).toHaveText("Gs. 40.000");
    for (const chip of await page.getByRole("button", { name: /^Sumar Gs[.]/ }).all()) await expect(chip).toBeDisabled();
    expect(submissions).toHaveLength((batch - 1) * 4);
    await reviewButton.click();
    for (const draw of ["Tempranero", "Matutino", "Vespertino", "Nocturno"]) await expect(review).toContainText(draw);
    await expect(review).toContainText("Se descontará Gs. 40.000 de tu saldo al confirmar.");
    if (batch === 1) {
      await review.getByRole("button", { name: "Volver a editar", exact: true }).click();
      expect(submissions).toHaveLength(0);
      expect((await bootstrap(page)).session.balance).toBe(initial.session.balance);
      await reviewButton.click();
    }
    await review.getByRole("button", { name: "Pagar Gs. 40.000", exact: true }).click();
    await expect(success).toBeVisible();
    expect(submissions).toHaveLength(batch * 4);
    for (const input of submissions) expect(input).toMatchObject({ gameId: "redoblona", amount: 10_000, selection });
    const after = await bootstrap(page);
    expect(after.session.balance).toBe(initial.session.balance - batch * 40_000);
    expect(after.plays).toHaveLength(initial.plays.length + batch * 4);
    expect(new Set(after.plays.map((play) => play.id)).size).toBe(after.plays.length);
    await expect(page.getByRole("banner").getByRole("link", { name: /^Saldo:/ }).locator(".q-balance__value"))
      .toHaveText("₲ " + new Intl.NumberFormat("es-PY").format(after.session.balance));
    if (batch === 1) {
      expect(new Set(submissions.map((input) => input.drawId))).toEqual(new Set(["early", "morning", "evening", "night"]));
      await success.getByRole("button", { name: "Nueva jugada", exact: true }).click();
      await expect(success).toBeHidden();
      await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(4);
      await page.getByLabel("Número de apuesta inicial", { exact: true }).fill(selection.initialNumber);
      await page.getByLabel("Número de Redoblona", { exact: true }).fill(selection.redoblonaNumber);
      await page.getByRole("combobox", { name: "Alcance de apuesta inicial", exact: true }).selectOption(String(selection.initialUntil));
      await page.getByRole("combobox", { name: "Alcance de Redoblona", exact: true }).selectOption(String(selection.redoblonaUntil));
    }
  }
  await success.getByRole("link", { name: "Ver en Mis jugadas", exact: true }).click();
  await expect(page).toHaveURL(/\/mis-jugadas$/);
});

test("traditional checkout fits a single phone screen and keeps payment above navigation", async ({ page }, testInfo) => {
  async function mobileNavigationTop() {
    const navigation = page.getByRole("navigation", { name: "Navegación móvil", exact: true });
    await expect(navigation).toBeVisible();
    // The central Jugar action extends above the container. Include every
    // rendered descendant so the checkout stays clear of its actual bounds.
    return navigation.evaluate((element) => Math.min(
      ...[element, ...element.querySelectorAll("*")]
        .map((node) => node.getBoundingClientRect())
        .filter((bounds) => bounds.width > 0 && bounds.height > 0)
        .map((bounds) => bounds.top),
    ));
  }

  await prepareTraditionalCheckout(page, (await bootstrap(page)).catalog);
  const bootstrapResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/mock/bootstrap" && response.request().method() === "GET",
  );
  await page.goto("/quinielas/redoblona", { waitUntil: "domcontentloaded" });
  const response = await bootstrapResponse;
  expect(response.ok()).toBe(true);
  const checkoutBootstrap = await response.json() as BootstrapPayload;
  await expect(page.getByRole("button", { name: "Números aleatorios", exact: true })).toBeEnabled();
  const stake = page.getByTestId("traditional-stake");
  await expect(stake).toHaveText("Gs. 0");
  await expect(page.getByRole("combobox", { name: "Importe por sorteo", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("traditional-total")).toHaveText("Gs. 0");
  await expect(page.getByRole("checkbox").first()).toBeEnabled();
  const initiallySelected = page.getByRole("checkbox", { checked: true });
  await expect(initiallySelected).toHaveCount(1);
  const selectedDrawId = await initiallySelected.inputValue();
  const selectedDraw = checkoutBootstrap.catalog.draws.find((draw) => draw.id === selectedDrawId);
  expect(selectedDraw).toBeDefined();
  const selectedCheckbox = page.locator('input[name="traditional-draw"][value="' + selectedDrawId + '"]');
  await expect(page.getByRole("navigation", { name: "Modalidades de quiniela", exact: true })).toHaveCount(0);
  await expect(page.getByRole("main").getByText("Saldo disponible", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Varios a la vez", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Por sorteo · Gs.", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-draw-icon]")).toHaveCount(4);
  await expect(page.locator("[data-amount-chip-asset]")).toHaveCount(5);
  for (const [width, height] of [[320, 568], [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await expectNoHorizontalOverflow(page);
    const pay = page.getByRole("button", { name: "Revisar y pagar", exact: true });
    await expectInsideHorizontalViewport(pay, page);
    const randomBounds = await page.getByRole("button", { name: "Números aleatorios", exact: true }).boundingBox();
    expect(randomBounds).not.toBeNull();
    const numberBounds = [];
    for (const label of ["Número de apuesta inicial", "Número de Redoblona"]) {
      const bounds = await page.getByLabel(label, { exact: true }).boundingBox();
      expect(bounds).not.toBeNull();
      numberBounds.push(bounds!);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(randomBounds!.y).toBeGreaterThanOrEqual(bounds!.y + bounds!.height);
    }
    expect(Math.abs(randomBounds!.x - numberBounds[0].x)).toBeLessThanOrEqual(1);
    if (width <= 430) {
      const payBounds = await pay.boundingBox();
      const navigationTop = await mobileNavigationTop();
      expect(payBounds).not.toBeNull();
      expect(payBounds!.y + payBounds!.height).toBeLessThanOrEqual(navigationTop);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const controls = page.getByRole("form", { name: "Preparar jugada", exact: true }).locator("input, select, button");
      for (const control of await controls.all()) {
        const bounds = await control.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(navigationTop);
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Número de apuesta inicial", { exact: true }).fill("35");
  await page.getByLabel("Número de Redoblona", { exact: true }).fill("45");
  const reviewButton = page.getByRole("button", { name: "Revisar y pagar", exact: true });
  await expect(reviewButton).toBeDisabled();
  await page.getByRole("button", { name: "Sumar Gs. 500", exact: true }).click();
  await expect(reviewButton).toBeEnabled();

  await page.clock.setFixedTime(new Date(selectedDraw!.closesAt));
  await expect(selectedCheckbox).toBeDisabled();
  await expect(selectedCheckbox).toBeChecked();
  await expect(reviewButton).toBeDisabled();
  const removeClosed = page.getByRole("button", { name: "Quitar cerrados", exact: true });
  await expect(removeClosed).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("expired-draw.png") });

  await removeClosed.click();
  await expect(selectedCheckbox).toBeDisabled();
  await expect(selectedCheckbox).not.toBeChecked();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await expect(reviewButton).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  for (const gameId of ["head", "prizes", "invert"] as const) {
    await prepareTraditionalCheckout(page, (await bootstrap(page)).catalog);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/quinielas/" + gameId, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Números aleatorios", exact: true })).toBeEnabled();

    for (const [width, height] of [[320, 568], [390, 844]]) {
      await test.step(gameId + " at " + width + "x" + height, async () => {
        await page.setViewportSize({ width, height });
        await expectNoHorizontalOverflow(page);
        const heading = page.getByRole("heading", { level: 2, name: "Número", exact: true });
        await expect(heading).toBeVisible();
        await expect(heading).not.toHaveClass(/q-sr-only/);
        const headingBounds = await heading.boundingBox();
        expect(headingBounds).not.toBeNull();
        expect(headingBounds!.height).toBeGreaterThan(10);
        expect(headingBounds!.width).toBeGreaterThan(40);

        await expect(page.getByTestId("traditional-stake")).toHaveText("Gs. 0");
        await expect(page.getByTestId("traditional-total")).toHaveText("Gs. 0");
        await expect(page.getByRole("button", { name: "Revisar y pagar", exact: true })).toBeDisabled();
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        const navigationTop = await mobileNavigationTop();
        const controls = page.getByRole("form", { name: "Preparar jugada", exact: true }).locator("input, select, button");
        for (const control of await controls.all()) {
          const bounds = await control.boundingBox();
          expect(bounds).not.toBeNull();
          expect(bounds!.x).toBeGreaterThanOrEqual(0);
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
          expect(bounds!.y).toBeGreaterThanOrEqual(0);
          expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(navigationTop);
        }
      });
    }
  }
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
  const formattedBalance = new Intl.NumberFormat("es-PY").format(after.session.balance);
  const displayedBalance = page
    .getByRole("region", { name: "Resumen de tu billetera", exact: true })
    .getByLabel(`Saldo disponible: Gs. ${formattedBalance}`, { exact: true });
  await expect(displayedBalance).toBeVisible();
  await expect(displayedBalance).toHaveText(`₲${formattedBalance}`);
});

test("publishes only Sapy’aite and rejects disabled instant games", async ({
  page,
}) => {
  const initial = await bootstrap(page);
  expect(initial.catalog.instant.map((game) => game.id)).toEqual(["sapyaite"]);

  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Quinielas" }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId(E2E_SELECTORS.traditionalGamesGrid)
      .getByTestId(E2E_SELECTORS.instantGameCard),
  ).toHaveCount(1);

  const activePlay = await postPlay(
    page,
    "/api/mock/instant",
    { gameId: "sapyaite", amount: 500, selection: "007" },
    "e2e-sapyaite-active-001",
  );
  expect(activePlay.body.play.gameId).toBe("sapyaite");
  expect(activePlay.body.play.selection).toBe("007");
  const afterActivePlay = await bootstrap(page);

  const disabledResponse = await page.request.post("/api/mock/instant", {
    data: { gameId: "poa", amount: 500, selection: "001-099" },
    headers: {
      "Idempotency-Key": "e2e-disabled-poa-001",
      "X-Account-Session": afterActivePlay.session.id,
    },
  });
  expect(disabledResponse.status()).toBe(404);
  const disabledBody = await disabledResponse.json();
  expect(disabledBody).toMatchObject({
    error: { code: "GAME_NOT_FOUND" },
  });

  const afterDisabledPlay = await bootstrap(page);
  expect(afterDisabledPlay.session.balance).toBe(afterActivePlay.session.balance);
  expect(afterDisabledPlay.plays).toHaveLength(afterActivePlay.plays.length);

  await page.goto("/instantaneas/poa", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("disabled-instant-game")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Juego no disponible" }),
  ).toBeVisible();
  await expect(page.getByLabel("Rodillos numéricos")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toHaveCount(0);
});

test("keeps the reel active and opens the receipt only from Mis Jugadas", async ({
  page,
}, testInfo) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/instantaneas/sapyaite", { waitUntil: "domcontentloaded" });

  const reelStage = page.getByLabel("Rodillos numéricos");
  const playButton = page.getByRole("button", { name: "Jugar", exact: true });
  const exactNumber = page.getByRole("textbox", { name: "Número exacto" });
  await expect(reelStage).toHaveAttribute("data-state", "preview");
  await expect(reelStage).toHaveAttribute("data-variant", "classic");
  await expect(exactNumber).toHaveValue("000");
  await exactNumber.fill("7");
  await expect(playButton).toBeDisabled();
  await exactNumber.fill("000");
  await expect(playButton).toBeEnabled();
  await exactNumber.fill("007");
  await expect(exactNumber).toHaveValue("007");
  await expect(page.getByRole("button", { name: "Gs. 10.000", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gs. 20.000", exact: true })).toHaveCount(0);
  await expect(page.getByText("La jugada se registra una sola vez y el resultado se define antes de animar.", { exact: true })).toHaveCount(0);

  const viewport = page.viewportSize();
  const playButtonBox = await playButton.boundingBox();
  if (!viewport || !playButtonBox) throw new Error("No se pudo medir el botón Jugar.");
  expect(playButtonBox.y).toBeGreaterThanOrEqual(0);
  expect(playButtonBox.y + playButtonBox.height).toBeLessThanOrEqual(viewport.height);

  await playButton.click();

  await expect(reelStage.locator('[data-spinning="false"]')).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "Jugada registrada" })).toHaveCount(0);
  await expect(page.getByText("Comprobante en 5 s", { exact: true })).toHaveCount(0);

  await page.goto("/mis-jugadas", { waitUntil: "domcontentloaded" });
  const playItem = page.getByRole("article").filter({
    has: page.getByRole("heading", { level: 3, name: "Sapy’aite", exact: true }),
  });
  await playItem.getByRole("button", { name: "Ver mi comprobante" }).click();

  const ticket = page.getByRole("dialog", { name: "Jugada registrada" });
  await expect(ticket).toBeVisible({ timeout: 45_000 });
  const receiptLogo = ticket.locator(".q-logo");
  await expect(receiptLogo.locator(".q-logo__letters")).toHaveCSS("fill", "rgb(23, 25, 29)");
  await expect(receiptLogo.locator(".q-logo__ring")).toHaveCSS("fill", "rgb(230, 36, 60)");
  await expectInsideHorizontalViewport(receiptLogo, page);
  await ticket.screenshot({ path: testInfo.outputPath("original-logo-receipt.png") });
  await expect(
    ticket.getByRole("heading", { level: 2, name: "Jugada registrada" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => ticket.locator(".q-modal__body").evaluate(
    (body) => body.scrollHeight - body.clientHeight,
  )).toBeLessThanOrEqual(1);
  await expectInsideHorizontalViewport(ticket, page);
  await expect(ticket.getByText("Código de comprobante", { exact: true })).toBeInViewport();
  await expect(ticket.getByRole("button", { name: "Listo", exact: true })).toBeInViewport();
  await ticket.screenshot({ path: testInfo.outputPath("compact-receipt-mobile.png") });
  await page.setViewportSize(viewport);

  await page.goto("/resultados", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Resultados" }),
  ).toBeVisible();
  await expect(page.getByTestId("results-day").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Resultados instantáneos de la cuenta" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 3, name: "Sapy’aite", exact: true }),
  ).toHaveCount(0);

  await page.goto("/mis-jugadas", { waitUntil: "domcontentloaded" });
  await expect(playItem).toBeVisible();
  await expect(playItem.getByRole("button", { name: "Ver mi comprobante" })).toBeVisible();
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
    selection: "246",
    drawId: null,
    amount: 10_000,
    currency: "PYG" as const,
    status: "WON" as const,
    result: "246",
    resultNumbers: ["246"],
    ruleResult: "246",
    matches: 1,
    payoutMultiplier: 700,
    prize: 7_000_000,
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
      selection: "246",
    });
    acceptedPlays += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        play,
        ticket,
        session: { balance: 7_240_000, currency: "PYG" },
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

  const exactNumber = page.getByRole("textbox", { name: "Número exacto" });
  await exactNumber.fill("246");
  await expect(exactNumber).toHaveValue("246");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();

  await expect(page.getByLabel("Rodillo 1: 246")).toBeVisible();
  await expect(page.getByText("Premio Gs. 7.000.000", { exact: true })).toBeVisible();
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

test("records deposits and withdrawals and preserves the wallet history", async ({ page }) => {
  await page.goto("/saldos", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Saldo y movimientos" })).toBeVisible();
  const initial = await bootstrap(page);

  await page.getByRole("button", { name: "Cargar saldo", exact: true }).click();
  const deposit = page.getByRole("dialog", { name: "Cargar saldo", exact: true });
  await deposit.getByRole("radio", { name: "QR", exact: true }).check();
  await deposit.getByRole("button", { name: "Continuar", exact: true }).click();
  expect((await bootstrap(page)).session.balance).toBe(initial.session.balance);
  await deposit.getByRole("button", { name: "Confirmar depósito", exact: true }).click();
  await expect(deposit.getByRole("heading", { name: "Depósito realizado" })).toBeVisible();
  expect((await bootstrap(page)).session.balance).toBe(initial.session.balance + 50_000);
  await deposit.getByRole("button", { name: "Ver movimientos" }).click();

  await page.getByRole("button", { name: "Retirar saldo", exact: true }).click();
  const withdrawal = page.getByRole("dialog", { name: "Retirar saldo", exact: true });
  await withdrawal.getByRole("radio", { name: "Telefonía", exact: true }).check();
  await withdrawal.getByRole("radio", { name: "Personal", exact: true }).check();
  await withdrawal.getByRole("textbox", { name: "Importe a retirar" }).fill("20.000");
  await withdrawal.getByRole("button", { name: "Continuar", exact: true }).click();
  await withdrawal.getByRole("button", { name: "Confirmar retiro", exact: true }).click();
  await expect(withdrawal.getByRole("heading", { name: "Retiro realizado" })).toBeVisible();
  expect((await bootstrap(page)).session.balance).toBe(initial.session.balance + 30_000);
  await withdrawal.getByRole("button", { name: "Ver movimientos" }).click();

  await page.reload({ waitUntil: "domcontentloaded" });
  const history = page.getByRole("list", { name: "Historial de movimientos" });
  await expect(history.getByRole("button", { name: "Ver detalle: Depósito, QR, Gs. 50.000" })).toBeVisible();
  await expect(history.getByRole("button", { name: "Ver detalle: Retiro, Personal, Gs. 20.000" })).toBeVisible();
  await page.getByRole("button", { name: "Retiros", exact: true }).click();
  await expect(history.getByRole("button")).toHaveCount(1);
  await history.getByRole("button").click();
  const details = page.getByRole("dialog", { name: "Detalle del movimiento" });
  await expect(details.getByText(/^RET-/)).toBeVisible();
  expect((await bootstrap(page)).session.balance).toBe(initial.session.balance + 30_000);
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

test("registers through the session service with normal account copy", async ({
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
  await expect(
    page.getByRole("status").filter({ hasText: "Registro completado" }),
  ).toContainText("Registro completado");
});

test("renders an unauthorized state when the session expires", async ({
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
    hasText: "No se pudo conectar con el servicio. Intentá nuevamente.",
  });
  await expect(alert).toContainText("No se pudo conectar con el servicio. Intentá nuevamente.");
  await expect(alert.getByRole("button", { name: "Reintentar" })).toBeVisible();
});

test("keeps implementation vocabulary out of public copy", async ({ page }) => {
  const forbiddenCopy = /\b(?:backoffice|proveedor|codexa|kodexa)\b/i;
  const publicRoutes = [
    "/",
    "/instantaneas",
    "/instantaneas/sapyaite",
    "/quinielas",
    "/reglas",
    "/resultados",
    "/mis-jugadas",
    "/cuenta",
    "/saldos",
    "/ayuda",
    "/gestion",
  ] as const;

  for (const path of publicRoutes) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("main")).toBeVisible();
    await page.waitForLoadState("networkidle");

    const publicCopy = await page.evaluate(() => ({
      ariaLabels: Array.from(document.querySelectorAll<HTMLElement>("[aria-label]"))
        .map((element) => element.getAttribute("aria-label") ?? "")
        .join("\n"),
      visibleText: document.body.innerText,
    }));

    expect(publicCopy.visibleText, `visible copy at ${path}`).not.toMatch(forbiddenCopy);
    expect(publicCopy.ariaLabels, `aria-label copy at ${path}`).not.toMatch(forbiddenCopy);
  }
});

test("stays stable through repeated Home and instant-game navigation", async ({ page }) => {
  const clientErrors: string[] = [];
  let bootstrapRequests = 0;

  page.on("pageerror", (error) =>
    clientErrors.push(`pageerror: ${error.stack ?? error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") clientErrors.push(`console: ${message.text()}`);
  });
  page.on("crash", () => clientErrors.push("page crash"));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/mock/bootstrap") {
      bootstrapRequests += 1;
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("home-hero")).toBeVisible();
  await expect(page.locator("[data-reel-row]")).toHaveCount(150);
  await expect(page.getByTestId("home-results-section")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const initialHomeNodeCount = await page.locator("body *").count();

  for (let cycle = 0; cycle < 4; cycle += 1) {
    await page.locator('a[href="/quinielas"]:visible').first().click();
    await expect(page).toHaveURL(/\/quinielas$/);

    await page.locator('main a[href="/quinielas/sapyaite"]:visible').first().click();
    await expect(page).toHaveURL(/\/quinielas\/sapyaite$/);
    await expect(page.locator('[data-continuous="true"]')).toHaveAttribute(
      "data-motion-active",
      "true",
    );

    await page.locator('a[href="/"]:visible').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("home-hero")).toBeVisible();
    await expect(page.getByTestId("home-results-section")).toHaveAttribute(
      "aria-busy",
      "false",
    );
  }

  const finalHomeNodeCount = await page.locator("body *").count();
  expect(Math.abs(finalHomeNodeCount - initialHomeNodeCount)).toBeLessThanOrEqual(2);
  expect(bootstrapRequests).toBe(1);
  expect(clientErrors).toEqual([]);
});
