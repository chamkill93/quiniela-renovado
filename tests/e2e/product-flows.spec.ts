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
  const now = new Date();
  const catalog = buildGamingCatalog("REFUND", now);
  const publishedResults: GamingResult[] = [
    ["home-result-497", "497", "early", 1],
    ["home-result-208", "208", "morning", 2],
    ["home-result-731", "731", "evening", 3],
    ["home-result-044", "044", "night", 4],
    ["home-result-912", "912", "early", 5],
    ["home-result-083", "83", "morning", 6],
    ["home-result-006", "6", "evening", 7],
    ["home-result-325", "325", "night", 8],
  ].map(([id, result, drawId, hoursAgo]) => ({
    id: String(id),
    source: "DRAW",
    gameId: "head",
    gameName: "A la Cabeza",
    drawId: String(drawId),
    result: String(result),
    resultNumbers: [String(result)],
    occurredAt: new Date(
      now.getTime() - Number(hoursAgo) * 3_600_000,
    ).toISOString(),
  }));
  publishedResults.push(
    {
      id: "home-prizes-all",
      source: "DRAW",
      gameId: "prizes",
      gameName: "A los Premios",
      drawId: "morning",
      result: "44",
      resultNumbers: ["44", "208", "7", "83", "731"],
      occurredAt: new Date(now.getTime() - 9 * 3_600_000).toISOString(),
    },
    {
      id: "home-redoblona",
      source: "DRAW",
      gameId: "redoblona",
      gameName: "Redoblona",
      drawId: "evening",
      result: "12",
      resultNumbers: ["12"],
      occurredAt: new Date(now.getTime() - 10 * 3_600_000).toISOString(),
    },
    {
      id: "home-invert",
      source: "DRAW",
      gameId: "invert",
      gameName: "Invertida",
      drawId: "night",
      result: "8",
      resultNumbers: ["8"],
      occurredAt: new Date(now.getTime() - 11 * 3_600_000).toISOString(),
    },
  );
  publishedResults.unshift({
    id: "home-megaloto-excluded",
    source: "DRAW",
    gameId: "megaloto",
    gameName: "Megaloto",
    drawId: "early",
    result: "999",
    resultNumbers: ["999"],
    occurredAt: new Date(now.getTime() - 30_000).toISOString(),
  });

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

  await expect(drawCards).toHaveCount(4);
  await expect(resultCards).toHaveCount(8);
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
    await expect(card).toHaveAttribute("href", `/sorteos/${slug}`);
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
  ).toHaveText(/^EN \d{2}H \d{2}M \d{2}S$/);
  await expect(drawsSection.locator("time")).toHaveCount(1);

  for (const [index, value] of ["497", "208", "731", "044", "912", "083", "006", "325"].entries()) {
    await expect(resultCards.nth(index).getByText(value, { exact: true })).toBeVisible();
  }
  await expect(resultsSection.getByText("999", { exact: true })).toHaveCount(0);
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
  await expect(resultCards).toHaveCount(5);
  for (const value of ["044", "208", "007", "083", "731"]) {
    await expect(resultsSection.getByText(value, { exact: true })).toBeVisible();
  }
  await expect(resultsSection.getByText(/POSICIÓN \d+/)).toHaveCount(0);

  await tabs.nth(1).press("ArrowRight");
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(resultCards).toHaveCount(1);
  await expect(resultsSection.getByText("012", { exact: true })).toBeVisible();
  await tabs.nth(0).click();
  await expect(resultCards).toHaveCount(8);

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
  if (viewportWidth >= 1_280) {
    const drawColumns = await drawsSection.locator("div").nth(1).evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    expect(drawColumns).toBe(4);
  } else if (viewportWidth < 768) {
    const activePosition = await page.locator('[data-testid="home-draw-card"][data-active="true"]').evaluate(
      (element) => {
        const card = element.getBoundingClientRect();
        const scroller = element.parentElement?.parentElement?.getBoundingClientRect();
        return scroller ? card.left - scroller.left : Number.POSITIVE_INFINITY;
      },
    );
    expect(activePosition).toBeLessThanOrEqual(18);
  }

  if (viewportWidth >= 768) {
    const nextButton = resultsSection.getByRole("button", { name: "Ver más resultados" });
    await expect(nextButton).toBeEnabled();
    const initialScroll = await resultsSection.locator('[role="tabpanel"]').evaluate((element) => element.scrollLeft);
    await nextButton.click();
    await expect.poll(() => resultsSection.locator('[role="tabpanel"]').evaluate((element) => element.scrollLeft)).toBeGreaterThan(initialScroll);
  } else {
    const widths = await Promise.all([
      megaBanner.evaluate((element) => element.getBoundingClientRect().width),
      megaCta.evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(Math.abs(widths[0] - widths[1])).toBeLessThan(35);
  }
  await expectNoHorizontalOverflow(page);

  await drawCards.first().click();
  await expect(page).toHaveURL(/\/sorteos\/tempranero$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tempranero" }),
  ).toBeVisible();
  await expect(
    page.getByText("Transmisión disponible al inicio del sorteo", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
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
  await expect(grid.getByText("Quiniela tradicional", { exact: true })).toHaveCount(0);
  await expect(grid.getByText("Desde", { exact: true })).toHaveCount(0);
  await expect(grid.getByText("Gs. 500", { exact: true })).toHaveCount(0);

  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });
  const instantGrid = page.getByTestId(E2E_SELECTORS.instantGamesGrid);
  await expect(instantGrid.getByText("Sapy’aite", { exact: true })).toBeVisible();

  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Reglas claras, paso a paso" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Cómo registrar una jugada" }),
  ).toBeVisible();
  await expect(page.getByText("Sapy’aite tradicional", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Megaloto", { exact: true })).toHaveCount(0);
  await expect(page.locator('main a[href^="/quinielas/"], main a[href^="/instantaneas/"]')).toHaveCount(5);
  const headRule = page.getByRole("link", { name: "Jugar A la Cabeza", exact: true });
  const sapyaiteRule = page.getByRole("link", { name: "Jugar Sapy’aite", exact: true });
  await expect(headRule).toHaveAttribute("href", "/quinielas/head");
  await expect(sapyaiteRule).toHaveAttribute("href", "/instantaneas/sapyaite");
  await expect(page.getByText("Qué tenés que hacer", { exact: true })).toHaveCount(5);
  await expect(page.getByText("Cuánto ganás", { exact: true })).toHaveCount(5);
  await expect(page.getByText("Premio según tabla oficial vigente", { exact: true })).toHaveCount(4);
  await expect(page.getByText("Premio total actual: 700× el importe", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Ejemplo con Gs. 500: recibís Gs. 350.000 en total y la ganancia neta es Gs. 349.500.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Elegí un número completo de 000 a 999.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ganás únicamente si las tres cifras coinciden exactamente y en el mismo orden.", { exact: true }),
  ).toBeVisible();
  const ruleColumns = await page.getByTestId("traditional-rules-grid").evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(ruleColumns).toBe((page.viewportSize()?.width ?? 0) <= 820 ? 1 : 2);
  await expectNoHorizontalOverflow(page);

  await headRule.click();
  await expect(page).toHaveURL(/\/quinielas\/head$/);
  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Jugar Sapy’aite", exact: true }).click();
  await expect(page).toHaveURL(/\/instantaneas\/sapyaite$/);

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
  const grid = page.getByTestId(E2E_SELECTORS.instantGamesGrid);
  const icons = grid.locator("[data-game-icon]");
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
  expect(columnCount).toBe(3);
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

test("publishes only Sapy’aite and rejects disabled instant games", async ({
  page,
}) => {
  const initial = await bootstrap(page);
  expect(initial.catalog.instant.map((game) => game.id)).toEqual(["sapyaite"]);

  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Instantáneas" }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId(E2E_SELECTORS.instantGamesGrid)
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
    headers: { "Idempotency-Key": "e2e-disabled-poa-001" },
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
}) => {
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
  await expect(
    ticket.getByRole("heading", { level: 2, name: "Jugada registrada" }),
  ).toBeVisible();

  await page.goto("/resultados", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Resultados" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Sapy’aite", exact: true }),
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
    hasText: "No se pudo conectar con el servicio de vista previa.",
  });
  await expect(alert).toContainText("No se pudo conectar con el servicio de vista previa.");
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
    await page.locator('a[href="/instantaneas"]:visible').first().click();
    await expect(page).toHaveURL(/\/instantaneas$/);

    await page.locator('main a[href="/instantaneas/sapyaite"]:visible').first().click();
    await expect(page).toHaveURL(/\/instantaneas\/sapyaite$/);
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
