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

test("completes Home with scheduled draws, tabbed results and the official Mega Loto banner", async ({
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
  const homeUrl = page.url();

  await expect(drawCards).toHaveCount(4);
  await expect(inlineStream).toBeHidden();
  await expect(inlineStream).toHaveAttribute("id", "home-draw-stream");
  await expect(page.getByTestId("draw-preview-video")).toHaveCount(0);
  await expect(resultCards).toHaveCount(1);
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
  await expect(resultMetadata).toHaveCount(1);
  await expect(resultMetadata).toContainText("Nocturno");
  await expect(resultMetadata).toContainText("26/08/2026");
  await expect(resultMetadata).toContainText("20:30");
  await expect(resultCards.first()).toHaveAttribute("data-position", "1");
  await expect(resultCards.first().getByTestId("home-result-value")).toHaveText("497");
  await expect(resultsSection.getByText("999", { exact: true })).toHaveCount(0);
  await expect(resultsSection.getByText(/muestra|demostración|demo/i)).toHaveCount(0);
  await expect(resultsSection.getByRole("link", { name: /ver todos/i })).toHaveAttribute(
    "href",
    "/resultados",
  );

  const tabs = resultsSection.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await expect(tabs.nth(0)).toHaveText("A LA CABEZA");
  await expect(tabs.nth(1)).toHaveText("A LOS PREMIOS");
  await expect(tabs.nth(2)).toHaveText("REDOBLONA");
  await expect(tabs.nth(3)).toHaveText("INVERTIDA");

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(resultCards).toHaveCount(13);
  for (const [index, value] of nightValues.slice(1).entries()) {
    await expect(resultCards.nth(index)).toHaveAttribute("data-position", String(index + 2));
    await expect(resultCards.nth(index).getByTestId("home-result-value")).toHaveText(value);
  }
  await expect(resultMetadata).toHaveCount(1);
  await expect(resultMetadata).toContainText("Nocturno");
  await expect(resultMetadata).toContainText("26/08/2026");

  await tabs.nth(1).press("ArrowRight");
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(resultCards).toHaveCount(13);
  await expect(resultsSection.getByTestId("home-redoblona-head")).toHaveCount(1);
  await expect(resultsSection.getByTestId("home-redoblona-head")).toContainText("497");
  for (const [index, value] of nightValues.slice(1).entries()) {
    await expect(resultCards.nth(index)).toHaveAttribute("data-position", String(index + 2));
    await expect(resultCards.nth(index).getByTestId("home-result-value")).toHaveText(value.slice(-2));
    await expect(resultCards.nth(index).getByText(`Del número ${value}`, { exact: true })).toBeVisible();
  }
  await expect(resultMetadata).toContainText("20:30");

  await tabs.nth(3).click();
  await expect(resultCards).toHaveCount(14);
  for (const [index, value] of nightValues.entries()) {
    await expect(resultCards.nth(index)).toHaveAttribute("data-position", String(index + 1));
    await expect(resultCards.nth(index).getByTestId("home-result-value")).toHaveText(value);
  }
  const headCombinations = (await resultCards.first().getByTestId("home-result-combinations").textContent())
    ?.match(/\d{3}/g) ?? [];
  expect(new Set(headCombinations)).toEqual(new Set(["497", "479", "947", "974", "749", "794"]));
  expect(headCombinations).toHaveLength(6);
  const zeroCombinations = (await resultCards.nth(2).getByTestId("home-result-combinations").textContent())
    ?.match(/\d{3}/g) ?? [];
  expect(zeroCombinations).toEqual(["000"]);
  const repeatedCombinations = (await resultCards.nth(4).getByTestId("home-result-combinations").textContent())
    ?.match(/\d{3}/g) ?? [];
  expect(new Set(repeatedCombinations)).toEqual(new Set(["112", "121", "211"]));
  expect(repeatedCombinations).toHaveLength(3);
  await expect(resultMetadata).toHaveCount(1);
  await expect(resultMetadata).toContainText("Nocturno");
  await expect(resultMetadata).toContainText("26/08/2026");
  await expect(resultMetadata).toContainText("20:30");

  await tabs.nth(0).click();
  await expect(resultCards).toHaveCount(1);
  await expect(resultCards.first().getByTestId("home-result-value")).toHaveText("497");
  for (const excludedValue of ["666", "777", "999", "998", "997"]) {
    await expect(resultsSection.getByText(excludedValue, { exact: true })).toHaveCount(0);
  }

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
  for (const card of await resultCards.all()) {
    await expectInsideHorizontalViewport(card, page);
  }
  const resultGrid = await resultsSection.getByRole("tabpanel").locator('[data-modality="head"]').evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    display: getComputedStyle(element).display,
  }));
  expect(resultGrid.display).toBe("grid");
  expect(resultGrid.scrollWidth).toBeLessThanOrEqual(resultGrid.clientWidth + 1);

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
  await expect(previewVideo).toBeVisible();
  await expect(previewVideo).toHaveCount(1);
  await expect(previewVideo).toHaveAttribute("src", "/assets/video/quinie-streaming-simulado.mp4");
  await expect(previewVideo).toHaveAttribute("autoplay", "");
  await expect(previewVideo).toHaveAttribute("loop", "");
  await expect(previewVideo).toHaveAttribute("playsinline", "");
  await expect(previewVideo).toHaveJSProperty("muted", true);
  await expect(inlineStream.getByTestId("draw-countdown")).toHaveText("01:15:00");
  await expect(inlineStream.getByRole("heading")).toHaveCount(1);
  await expect(inlineStream.getByText("Último resultado", { exact: true })).toHaveCount(0);
  await expect(inlineStream.getByText("Historial reciente", { exact: true })).toHaveCount(0);
  await expect(drawsSection.locator("main")).toHaveCount(0);
  await expect(drawsSection.getByRole("link")).toHaveCount(0);
  await expect(inlineStream.locator("iframe")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await earlyCard.click();
  await expect(inlineStream).toBeHidden();
  await expect(previewVideo).toHaveCount(0);
  await expect(earlyCard).toHaveAttribute("aria-expanded", "false");
  await expect(earlyCard.getByTestId("home-next-draw-action")).toHaveText("Ver sorteo");
  await expect(page).toHaveURL(homeUrl);

  await earlyCard.focus();
  await earlyCard.press("Enter");
  await expect(inlineStream).toBeVisible();
  await expect(previewVideo).toHaveCount(1);
  await expect(earlyCard).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL(homeUrl);

  await earlyCard.press("Space");
  await expect(inlineStream).toBeHidden();
  await expect(previewVideo).toHaveCount(0);
  await expect(earlyCard).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(homeUrl);

  await earlyCard.press("Space");
  await expect(inlineStream).toBeVisible();
  await expect(previewVideo).toHaveCount(1);
  await morningCard.click();
  await expect(inlineStream.getByRole("heading", { level: 3, name: "Matutino" })).toBeVisible();
  await expect(inlineStream).toHaveAttribute("data-draw-target-at", "2026-08-27T16:00:00.000Z");
  await expect(inlineStream.getByTestId("draw-countdown")).toHaveText("03:45:00");
  await expect(previewVideo).toHaveCount(1);
  await expect(previewVideo).toHaveAttribute("aria-label", "Streaming de Matutino");
  await expect(earlyCard).toHaveAttribute("aria-expanded", "false");
  await expect(morningCard).toHaveAttribute("aria-expanded", "true");
  await expect(drawsSection.locator('[data-testid="home-draw-card"][aria-expanded="true"]'))
    .toHaveCount(1);
  await expect(page).toHaveURL(homeUrl);

  await morningCard.press("Enter");
  await expect(inlineStream).toBeHidden();
  await expect(previewVideo).toHaveCount(0);
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
    expect(new Set(rows).size, route).toBe(1);
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
  await expect(page.locator('main button[aria-expanded="false"]')).toHaveCount(5);
  await expect(page.getByText("Sapy’aite tradicional", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Megaloto", { exact: true })).toHaveCount(0);
  await expect(page.locator('main a[href^="/quinielas/"], main a[href^="/instantaneas/"]')).toHaveCount(5);
  const headRule = page.getByRole("link", { name: "Jugar A la Cabeza", exact: true });
  const sapyaiteRule = page.getByRole("link", { name: "Jugar Sapy’aite", exact: true });
  await expect(headRule).toHaveAttribute("href", "/quinielas/head");
  await expect(sapyaiteRule).toHaveAttribute("href", "/quinielas/sapyaite");
  await expect(page.getByText("Multiplicador de referencia", { exact: true })).toHaveCount(4);
  await expect(page.getByTestId("rule-card-sapyaite").getByText("700× el importe", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver reglas de Sapy’aite", exact: true }).click();
  await expect(page.getByTestId("rule-card-sapyaite")).toContainText("Si acertás con Gs. 500, el premio total es Gs. 350.000.");
  await expect(
    page.getByText("Como A la Cabeza, pero instantáneo: acertá las tres cifras exactas.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ganás si las tres cifras coinciden en el mismo orden. No tenés que esperar un sorteo.", { exact: true }),
  ).toBeVisible();
  const ruleColumns = await page.getByTestId("rules-grid").evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(ruleColumns).toBe((page.viewportSize()?.width ?? 0) <= 820 ? 1 : 2);
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
    let paymentRequests = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/mock/traditional") paymentRequests += 1;
    });
    const money = (value: number) => `Gs. ${new Intl.NumberFormat("es-PY").format(value)}`;
    await page.goto(`/quinielas/${gameId}`, { waitUntil: "domcontentloaded" });
    const reviewButton = page.getByRole("button", { name: "Revisar y pagar", exact: true });
    await expect(reviewButton).toBeDisabled();
    await page.getByRole("button", { name: "Números aleatorios", exact: true }).click();
    if (gameId === "redoblona") {
      await expect(page.getByLabel("Número de cabeza", { exact: true })).toHaveValue(/^(?!000)\d{3}$/);
      await expect(page.getByLabel("Número redoblona", { exact: true })).toHaveValue(/^\d{2}$/);
    } else {
      await expect(page.getByLabel("Número de tres cifras", { exact: true })).toHaveValue(/^(?!000)\d{3}$/);
    }
    await page.getByRole("button", { name: money(1_000), exact: true }).click();
    if (gameId !== "head") await page.getByRole("combobox", { name: "Hasta la posición", exact: true }).selectOption("10");
    await expect(page.getByTestId("traditional-balance")).toHaveText(money(initial.session.balance));
    expect(paymentRequests).toBe(0);

    await reviewButton.click();
    const reviewDialog = page.getByRole("dialog", { name: "Confirmá tu jugada", exact: true });
    await expect(reviewDialog).toBeVisible();
    await expect(reviewDialog).toContainText("Se descontará Gs. 1.000 de tu saldo al confirmar.");
    expect(paymentRequests).toBe(0);
    await reviewDialog.getByRole("button", { name: "Volver a editar", exact: true }).click();
    await expect(reviewDialog).toBeHidden();
    await expect(page.getByTestId("traditional-balance")).toHaveText(money(initial.session.balance));
    await expectNoHorizontalOverflow(page);

    await reviewButton.click();
    const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/mock/traditional" && response.request().method() === "POST");
    await reviewDialog.getByRole("button", { name: "Pagar Gs. 1.000", exact: true }).click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    const payment = await response.json() as PlacePlayResponse;
    expect(payment.play.gameId).toBe(gameId);
    expect(payment.play.amount).toBe(1_000);
    expect(payment.session.balance).toBe(initial.session.balance - 1_000);
    expect(paymentRequests).toBe(1);
    const success = page.getByRole("dialog", { name: "Jugada registrada", exact: true });
    await expect(success).toBeVisible();
    await expect(success).toContainText(money(payment.session.balance));
    await expect(page.getByTestId("traditional-balance")).toHaveText(money(payment.session.balance));
    await success.getByRole("link", { name: "Ver en Mis jugadas", exact: true }).click();
    await expect(page).toHaveURL(/\/mis-jugadas$/);
    await expect(page.getByRole("main")).toContainText(money(payment.play.amount));
  });
}

test("traditional checkout fits small phones and keeps payment above navigation", async ({ page }) => {
  await page.goto("/quinielas/redoblona", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Números aleatorios", exact: true })).toBeEnabled();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
    const pay = page.getByRole("button", { name: "Revisar y pagar", exact: true });
    await expectInsideHorizontalViewport(pay, page);
    for (const label of ["Número de cabeza", "Número redoblona"]) {
      const bounds = await page.getByLabel(label, { exact: true }).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    }
    if (width <= 390) {
      const payBounds = await pay.boundingBox();
      const navBounds = await page.getByRole("navigation", { name: "Navegación móvil", exact: true }).boundingBox();
      expect(payBounds).not.toBeNull();
      expect(navBounds).not.toBeNull();
      expect(payBounds!.y + payBounds!.height).toBeLessThanOrEqual(navBounds!.y);
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
  await expect(page.getByRole("status")).toContainText("Registro completado");
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
