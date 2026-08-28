import { expect, test } from "@playwright/test";
import { DAILY_DRAW_SLOTS } from "@/lib/gaming/daily-draw-schedule";
import { drawDateKey, drawWallTime } from "@/lib/gaming/draw-calendar";
import {
  activeNavigation,
  E2E_SELECTORS,
  expectInsideHorizontalViewport,
  expectNoHorizontalOverflow,
  installThemePreference,
  themeFromProjectName,
} from "../helpers/e2e-contract";

test.beforeEach(async ({ page }, testInfo) => {
  const theme = themeFromProjectName(testInfo.project.name);
  await installThemePreference(page, theme);
});

function latestGenericResultDate(now: number) {
  const today = drawDateKey(now)!;
  const firstDraw = DAILY_DRAW_SLOTS[0];
  return now >= drawWallTime(today, firstDraw.hour, firstDraw.minute)
    ? today : drawDateKey(now - 86_400_000)!;
}

test("renders the accessible product shell without horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/quinie\.LA/i);
  await expect(page.locator("html")).toHaveAttribute("lang", /^es(?:-|$)/i);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const visibleBrand = page.locator(
    'a[aria-label="Ir al inicio de quinie.LA"]:visible',
  );
  await expect(visibleBrand).toBeVisible();
  await expect(
    visibleBrand.getByRole("img", { name: "quinie.LA", exact: true }),
  ).toBeVisible();

  const shell = page.getByTestId(E2E_SELECTORS.appShell);
  const navigation = activeNavigation(page);
  const themeToggle = page.getByTestId(E2E_SELECTORS.themeToggle);
  const soundToggle = page.getByTestId(E2E_SELECTORS.soundToggle);

  await expect(shell).toBeVisible();
  await expect(navigation).toBeVisible();
  expect(await navigation.getByRole("link").count()).toBeGreaterThanOrEqual(4);
  await expect(themeToggle).toHaveRole("button");
  await expect(themeToggle).toHaveAccessibleName(/tema|claro|oscuro/i);
  await expect(themeToggle).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await expect(soundToggle).toHaveRole("button");
  await expect(soundToggle).toHaveAccessibleName(/sonido|audio/i);
  await expect(soundToggle).toHaveAttribute("aria-pressed", /^(true|false)$/);

  const hero = page.getByTestId("home-hero");
  const reel = hero.locator("[data-reel-source]");
  const artwork = reel.locator('img[src*="rodillo-fuego"]');
  await expect(hero).toBeVisible();
  await expect(hero.getByRole("heading", { level: 1, name: "Tu jugada empieza acá." })).toBeVisible();
  await expect(hero.getByRole("link", { name: /^Jugar/ })).toHaveCount(1);
  await expect(hero.getByRole("link", { name: "Jugar Quiniela" })).toHaveAttribute("href", "/quinielas");
  await expect(hero.getByRole("link", { name: "Jugar Sapy’aite" })).toHaveCount(0);
  await expect(hero.getByText(/^Próximo sorteo$/i)).toHaveCount(0);
  await expect(artwork).toBeVisible();
  await expect(artwork).toHaveCSS("opacity", "1");
  await expect(artwork).toHaveCSS("filter", "saturate(1.08) contrast(1.03)");
  await expect.poll(() => artwork.evaluate(
    (element) => (element as HTMLImageElement).naturalWidth,
  )).toBeGreaterThan(0);
  const artworkMetrics = await artwork.evaluate((element) => ({
    height: (element as HTMLImageElement).naturalHeight,
    objectFit: getComputedStyle(element).objectFit,
    width: (element as HTMLImageElement).naturalWidth,
  }));
  expect(artworkMetrics.objectFit).toBe("contain");
  expect(artworkMetrics.width / artworkMetrics.height).toBeCloseTo(2162 / 727, 1);

  const heroMetrics = await hero.evaluate((element) => {
    const [, reelColumn, actions] = Array.from(element.children);
    const reelBox = reelColumn.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    const visual = element.querySelector<HTMLElement>("[data-reel-source]")!;
    const visualStyle = getComputedStyle(visual);
    const visualBox = visual.getBoundingClientRect();
    return {
      actionsY: actionsBox.y,
      fireAlpha: Number.parseFloat(visualStyle.getPropertyValue("--hero-fire-alpha")),
      reelBottom: reelBox.bottom,
      visualRight: visualBox.right,
      visualWidth: visualBox.width,
    };
  });
  expect(heroMetrics.fireAlpha).toBeGreaterThanOrEqual(0.75);
  expect(heroMetrics.fireAlpha).toBeLessThanOrEqual(1);
  expect(heroMetrics.visualWidth).toBeLessThanOrEqual(761);
  expect(heroMetrics.visualRight).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  if (page.viewportSize()!.width <= 1180) {
    expect(heroMetrics.actionsY).toBeGreaterThanOrEqual(heroMetrics.reelBottom - 1);
  }

  await expectInsideHorizontalViewport(shell, page);
  await expectNoHorizontalOverflow(page);

  const drawCards = page.getByTestId("home-draw-card");
  await expect(drawCards).toHaveCount(4);
  for (const card of await drawCards.all()) {
    await expectInsideHorizontalViewport(card, page);
  }
  const drawGrid = await page.getByTestId("home-draw-grid").evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    height: element.getBoundingClientRect().height,
  }));
  expect(drawGrid.columns).toBe(page.viewportSize()!.width >= 1280 ? 4 : 2);
  expect(drawGrid.scrollWidth).toBeLessThanOrEqual(drawGrid.clientWidth + 1);
  if (page.viewportSize()!.width < 768) expect(drawGrid.height).toBeLessThanOrEqual(212);

  const footer = page.locator(".q-site-footer");
  const footerNavigation = footer.getByRole("navigation", { name: "Información y ayuda" });
  const footerLinks = footer.getByRole("link");
  await expect(footerLinks).toHaveCount(5);
  // Different OS fallback fonts have wider labels; keep the complete links visible.
  for (const fontFamily of ["", "Verdana, sans-serif"]) {
    await footerNavigation.evaluate((element, font) => {
      (element as HTMLElement).style.fontFamily = font;
    }, fontFamily);
    const linkLayout = await footerLinks.evaluateAll((links) =>
      links.map((link) => ({
        top: Math.round(link.getBoundingClientRect().top),
        height: link.getBoundingClientRect().height,
        clientWidth: link.clientWidth,
        scrollWidth: link.scrollWidth,
      })),
    );
    expect(new Set(linkLayout.map((link) => link.top)).size).toBe(1);
    for (const link of linkLayout) {
      expect(link.height).toBeGreaterThanOrEqual(44);
      expect(link.scrollWidth).toBeLessThanOrEqual(link.clientWidth + 1);
    }
    for (const link of await footerLinks.all()) {
      await expectInsideHorizontalViewport(link, page);
    }
    await expectNoHorizontalOverflow(page);
  }
  await footerNavigation.evaluate((element) => {
    (element as HTMLElement).style.removeProperty("font-family");
  });
  const footerGap = await page.getByRole("main").evaluate((element) => {
    const footer = document.querySelector(".q-site-footer")!;
    return footer.getBoundingClientRect().top - element.lastElementChild!.getBoundingClientRect().bottom;
  });
  expect(footerGap).toBeGreaterThanOrEqual(0);
  expect(footerGap).toBeLessThanOrEqual(20);
  await page.screenshot({ path: testInfo.outputPath("home-responsive.png"), fullPage: true });
});

test("shows six compact Quinielas cards with Sapy’aite and green Mega Loto", async ({
  page,
}, testInfo) => {
  await page.goto("/quinielas", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { level: 1, name: "Quinielas" }),
  ).toBeVisible();

  const grid = page.getByTestId(E2E_SELECTORS.traditionalGamesGrid);
  const cards = grid.getByTestId(E2E_SELECTORS.instantGameCard);

  await expect(grid).toBeVisible();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toBeVisible();
  await expect(cards.first().getByText("Sapy’aite", { exact: true })).toBeVisible();
  await expect(
    cards.first().getByText("Elegí las 3 cifras exactas.", { exact: true }),
  ).toBeVisible();
  await expectInsideHorizontalViewport(cards.first(), page);

  const allCards = grid.getByRole("link");
  await expect(allCards).toHaveCount(6);
  await expect(grid.getByTestId("mega-loto-card")).toHaveAttribute("data-tone", "green");
  const megaDescription = grid.getByTestId("mega-loto-card").locator("p");
  await expect(megaDescription).toHaveText("Elegí 6 números del 1 al 40 y ganá el Megapozo.");
  const descriptionSize = await megaDescription.evaluate((element) => ({
    contentHeight: element.scrollHeight,
    visibleHeight: element.clientHeight,
  }));
  expect(descriptionSize.contentHeight).toBeLessThanOrEqual(descriptionSize.visibleHeight + 1);
  const instantCategory = grid.getByRole("region", { name: "Instantáneas", exact: true });
  const lotosCategory = grid.getByRole("region", { name: "Lotos", exact: true });
  for (const category of [instantCategory, lotosCategory]) {
    const subtitle = category.getByRole("heading", { level: 2 });
    await expect(subtitle).toBeVisible();
    await expectInsideHorizontalViewport(subtitle, page);
    const subtitleBox = (await subtitle.boundingBox())!;
    const cardBox = (await category.getByRole("link").boundingBox())!;
    expect(subtitleBox.y + subtitleBox.height).toBeLessThanOrEqual(cardBox.y);
    expect(cardBox.y - subtitleBox.y - subtitleBox.height).toBeLessThanOrEqual(8);
    expect(Math.abs(subtitleBox.x - cardBox.x)).toBeLessThanOrEqual(1);
  }
  const instantCardBox = (await instantCategory.getByRole("link").boundingBox())!;
  const megaLotoCardBox = (await lotosCategory.getByRole("link").boundingBox())!;
  expect(Math.abs(instantCardBox.y - megaLotoCardBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(instantCardBox.width - megaLotoCardBox.width)).toBeLessThanOrEqual(1);
  const redoblona = grid.getByRole("link", { name: "Jugar Redoblona", exact: true });
  const head = grid.getByRole("link", { name: "Jugar A la Cabeza", exact: true });
  await expect(redoblona).toHaveAttribute("data-tone", "teal");
  expect(await redoblona.evaluate((element) => getComputedStyle(element).backgroundImage))
    .not.toBe(await head.evaluate((element) => getComputedStyle(element).backgroundImage));
  await expect(page.locator('nav a[href="/instantaneas"]')).toHaveCount(0);
  const columns = await grid.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columns).toBe(2);
  for (const card of await allCards.all()) {
    await expectInsideHorizontalViewport(card, page);
  }
  if (page.viewportSize()!.width < 980) {
    const navigation = page.locator(".mobileNavInner");
    await expect(navigation.getByRole("link")).toHaveCount(5);
    await expect(navigation.getByRole("link").nth(2)).toHaveAttribute("href", "/quinielas");
  }
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("quinielas-responsive.png"), fullPage: true });
});

test("opens Reglas from mobile navigation while Jugar still opens Quinielas", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 980, "Mobile navigation is hidden on desktop");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const navigation = page.getByRole("navigation", { name: "Navegación móvil", exact: true });
  const links = navigation.getByRole("link");
  await expect(navigation).toBeVisible();
  await expect(links).toHaveText(["Inicio", "Reglas", "Jugar", "Resultados", "Cuenta"]);
  await expect(navigation.locator('a[href="/quinielas"]')).toHaveCount(1);
  await expect(navigation.getByRole("link", { name: /Quiniela/i })).toHaveCount(0);
  for (const link of await links.all()) {
    await expectInsideHorizontalViewport(link, page);
  }

  const rules = navigation.getByRole("link", { name: "Reglas", exact: true });
  await expect(rules).toHaveAttribute("href", "/reglas");
  await rules.click();
  await expect(page).toHaveURL(/\/reglas$/);
  await expect(page.getByRole("heading", { name: "Cómo jugar", level: 1 })).toBeVisible();
  await expect(rules).toHaveAttribute("aria-current", "page");

  await navigation.getByRole("link", { name: "Jugar", exact: true }).click();
  await expect(page).toHaveURL(/\/quinielas$/);
  await expect(page.getByRole("heading", { name: "Quinielas", level: 1 })).toBeVisible();
  await expect(rules).not.toHaveAttribute("aria-current", "page");
});

test("keeps current rules brief and expands their details accessibly", async ({ page }, testInfo) => {
  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Cómo jugar", level: 1 })).toBeVisible();
  const grid = page.getByTestId("rules-grid");
  await expect(grid.getByRole("article")).toHaveCount(5);
  await expect(grid.locator('button[aria-expanded="false"]')).toHaveCount(5);
  const redoblona = page.getByTestId("rule-card-redoblona");
  const toggle = redoblona.getByRole("button");
  const collapsedHeight = (await redoblona.boundingBox())!.height;
  expect(collapsedHeight).toBeLessThan(310);
  await page.screenshot({ path: testInfo.outputPath("rules-collapsed.png"), fullPage: true });
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(redoblona.getByRole("heading", { name: "Premio" })).toBeVisible();
  await expect(redoblona.getByText("Elegí una posición de 2 a 14, el sorteo y el importe.", { exact: true })).toBeVisible();
  await expect(redoblona.getByRole("listitem")).toHaveCount(2);
  await expect(redoblona.getByRole("complementary")).toHaveCount(0);
  expect(await grid.textContent()).not.toMatch(/pdf|art[ií]culo|reglamento|vista previa|formulario actual/i);
  await expect(grid.locator('button[aria-expanded="false"]')).toHaveCount(4);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("rules-expanded.png"), fullPage: true });
  await toggle.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(redoblona.getByRole("heading", { name: "Premio" })).toBeHidden();
  await expect(toggle).toBeFocused();
  await redoblona.getByRole("link", { name: "Jugar Redoblona", exact: true }).click();
  await expect(page).toHaveURL(/\/quinielas\/redoblona$/);
});

test("shows game multipliers without a quick calculator or creating plays", async ({ page }, testInfo) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  const grid = page.getByTestId("rules-grid");
  await expect(grid.getByRole("article")).toHaveCount(5);
  await expect(page.getByTestId("prize-calculator")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Calculadora rápida" })).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(grid.getByRole("link")).toHaveCount(5);
  for (const [gameId, multiplier] of [
    ["head", "700× el importe"],
    ["prizes", "700× ÷ postura"],
    ["invert", "700× ÷ combinaciones ÷ postura"],
    ["redoblona", "700× · 80× ÷ postura"],
    ["sapyaite", "700× el importe"],
  ]) {
    await expect(grid.getByTestId(`rule-card-${gameId}`).getByText(multiplier, { exact: true })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
  expect(posts.filter((url) => /\/(instant|traditional|plays|wallet)\b/.test(url))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("rules-without-calculator.png"), fullPage: true });
});

test("keeps all positions of the latest draw responsive in each modality", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const section = page.getByTestId("home-results-section");
  await expect(section.getByText("Resultados de muestra", { exact: true })).toHaveCount(0);
  await expect(section.getByTestId("home-results-draw")).toBeVisible();
  const latestDraw = await section.getByTestId("home-results-draw").innerText();
  const width = page.viewportSize()!.width;
  const regularColumns = width >= 1280 ? 7 : width >= 768 ? 4 : 3;
  const cases = [
    { name: "A LA CABEZA", modality: "head", count: 1, firstPosition: 1, columns: 1 },
    { name: "A LOS PREMIOS", modality: "prizes", count: 13, firstPosition: 2, columns: regularColumns },
    { name: "REDOBLONA", modality: "redoblona", count: 13, firstPosition: 2, columns: regularColumns },
    { name: "INVERTIDA", modality: "invert", count: 14, firstPosition: 1, columns: width >= 1280 ? 4 : width >= 768 ? 3 : 2 },
  ];
  for (const expected of cases) {
    const tab = section.getByRole("tab", { name: expected.name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const cards = section.getByTestId("home-result-card");
    await expect(cards).toHaveCount(expected.count);
    expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-position"))))
      .toEqual(Array.from({ length: expected.count }, (_, index) => String(index + expected.firstPosition)));
    await expect(section.getByTestId("home-results-draw")).toHaveText(latestDraw, { useInnerText: true });
    const grid = section.getByRole("tabpanel").locator(`[data-modality="${expected.modality}"]`);
    const metrics = await grid.evaluate((element) => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(metrics.columns).toBe(expected.columns);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    await expectInsideHorizontalViewport(grid, page);
    await expectNoHorizontalOverflow(page);
  }
  await page.screenshot({ path: testInfo.outputPath("home-latest-draw-results.png"), fullPage: true });
});

test("groups results by date into four responsive colored draws", async ({ page }, testInfo) => {
  const openedAt = Date.now();
  await page.goto("/resultados", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Resultados", level: 1 })).toBeVisible();
  const days = page.getByTestId("results-day");
  await expect(days).toHaveCount(5);
  await expect(page.getByRole("region", { name: "Resultados instantáneos de la cuenta" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Resultados instantáneos" })).toHaveCount(0);
  const dates = await days.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-date")!));
  expect(dates).toEqual([...dates].sort().reverse());
  expect([latestGenericResultDate(openedAt), latestGenericResultDate(Date.now())]).toContain(dates[0]);
  for (const [dayIndex, day] of (await days.all()).entries()) {
    const cards = day.getByTestId("daily-draw-card");
    await expect(cards).toHaveCount(4);
    expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-draw-id"))))
      .toEqual(["early", "morning", "evening", "night"]);
    const publishedCount = await day.locator('[data-testid="daily-draw-card"][data-state="published"]').count();
    expect(publishedCount).toBeGreaterThanOrEqual(1);
    expect(publishedCount).toBeLessThanOrEqual(4);
    if (dayIndex > 0) expect(publishedCount).toBe(4);
    await expect(day.getByText(`${publishedCount} de 4 sorteos publicados`)).toBeVisible();
    const colors = await cards.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).borderTopColor));
    expect(new Set(colors).size).toBe(4);
    for (const card of await cards.all()) {
      await expect(card.getByRole("img")).toBeVisible();
      await expectInsideHorizontalViewport(card, page);
    }
  }
  const firstGrid = days.first().getByTestId("daily-results-grid");
  const columns = await firstGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(page.viewportSize()!.width >= 1280 ? 4 : 2);
  await expect(page.getByLabel("Buscar por fecha")).toHaveCount(0);
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver todas las fechas" })).toHaveCount(0);
  await expect(days.first()).toHaveAttribute("data-date", dates[0]);
  const card = days.first().getByTestId("daily-draw-card").first();
  const detail = card.locator("details");
  const summary = detail.locator("summary");
  const table = detail.getByRole("table", { name: "Posturas de Tempranero", exact: true });
  const headNumber = await card.getByTestId("daily-draw-number").innerText();
  await expect(detail).toHaveJSProperty("open", false);
  await summary.click();
  await expect(detail).toHaveJSProperty("open", true);
  await expect(table).toBeVisible();
  await expect(detail.getByRole("table")).toHaveCount(1);
  await expect(table.getByRole("columnheader")).toHaveText(["Postura", "Número"]);
  const postures = table.locator("tbody > tr");
  await expect(postures).toHaveCount(14);
  expect(await postures.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-position"))))
    .toEqual(Array.from({ length: 14 }, (_, index) => String(index + 1)));
  expect(await postures.getByRole("cell").allTextContents())
    .toEqual(Array.from({ length: 14 }, () => expect.stringMatching(/^\d{3}$/)));
  await expect(postures.first()).toHaveAttribute("data-head", "true");
  await expect(table.locator('[data-head="true"]')).toHaveCount(1);
  await expect(postures.first().getByText("A la cabeza", { exact: true })).toBeVisible();
  await expect(postures.first().getByRole("cell")).toHaveText(headNumber);
  const postureColors = await postures.getByRole("cell").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor));
  expect(postureColors[0]).not.toBe(postureColors[1]);
  await expect(detail.getByRole("heading")).toHaveText(["Posturas del sorteo"]);
  await expectInsideHorizontalViewport(table, page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("results-by-date.png"), fullPage: true });
  await summary.click();
  await expect(detail).toHaveJSProperty("open", false);
  await expect(table).not.toBeVisible();
  await expect(card.getByTestId("daily-draw-number")).toHaveText(headNumber);
  await expect(days).toHaveCount(5);
});

test("pages through ten days without showing more than five at once", async ({ page }, testInfo) => {
  await page.goto("/resultados", { waitUntil: "domcontentloaded" });
  const header = page.getByRole("main").locator(":scope > header");
  const navigation = header.getByRole("navigation", { name: "Paginación de fechas", exact: true });
  const moreRecent = navigation.getByRole("button", { name: "← Más recientes", exact: true });
  const older = navigation.getByRole("button", { name: "Días anteriores →", exact: true });
  await expect(header.getByRole("heading", { name: "Resultados", level: 1 })).toBeVisible();
  await expect(header).toHaveText(/^\s*Resultados\s*← Más recientes\s*Días anteriores →\s*$/);
  await expect(navigation.getByRole("button")).toHaveText(["← Más recientes", "Días anteriores →"]);
  await expect(page.getByLabel("Buscar por fecha")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver todas las fechas" })).toHaveCount(0);
  await expect(page.getByText(/Página \d+ de \d+|Días \d+[–-]\d+ de \d+/)).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: /Paginación de fechas/ })).toHaveCount(1);
  await expect(page.getByText(/Fechas y horas de Paraguay|Resultados de muestra/)).toHaveCount(0);
  const days = page.getByTestId("results-day");
  await expect(days).toHaveCount(5);
  await expect(page.getByTestId("daily-draw-card")).toHaveCount(20);
  const newestDates = await days.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-date")));
  await expect(moreRecent).toBeDisabled();
  await expect(older).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("results-pagination-controls.png"), fullPage: false });
  await older.click();
  await expect(older).toBeDisabled();
  await expect(moreRecent).toBeEnabled();
  await expect(days).toHaveCount(5);
  await expect(page.getByTestId("daily-draw-card")).toHaveCount(20);
  const olderDates = await days.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-date")));
  expect(new Set([...newestDates, ...olderDates]).size).toBe(10);
  expect(olderDates.every((date) => date! < newestDates[4]!)).toBe(true);
  await expect(page.locator("#daily-results-history")).toBeFocused();
  await expect(days.first().getByRole("heading", { level: 2 })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  for (const control of await navigation.getByRole("button").all()) {
    await expectInsideHorizontalViewport(control, page);
  }
  await page.screenshot({ path: testInfo.outputPath("results-page-two.png"), fullPage: false });
  await moreRecent.click();
  await expect(moreRecent).toBeDisabled();
  await expect(older).toBeEnabled();
  await expect(days).toHaveCount(5);
  expect(await days.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-date"))))
    .toEqual(newestDates);
  await expect(page.locator("#daily-results-history")).toBeFocused();
});

test("keeps the original HD logo crisp and its ring red across both themes", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const logo = page.locator('a[aria-label="Ir al inicio de quinie.LA"]:visible .q-logo');
  await expect(logo).toHaveCount(1);
  const asset = await page.request.get("/assets/brand/quinie-la-original-hd.png");
  expect(asset.ok()).toBe(true);
  const bytes = await asset.body();
  expect(bytes.readUInt32BE(16)).toBe(1919);
  expect(bytes.readUInt32BE(20)).toBe(820);
  const initialTheme = themeFromProjectName(testInfo.project.name);
  const themes = [initialTheme, initialTheme === "dark" ? "light" : "dark"];
  for (const [index, theme] of themes.entries()) {
    if (index > 0) await page.getByTestId(E2E_SELECTORS.themeToggle).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(logo.locator(".q-logo__letters")).toHaveCSS("fill", theme === "dark" ? "rgb(255, 255, 255)" : "rgb(23, 25, 29)");
    await expect(logo.locator(".q-logo__ring")).toHaveCSS("fill", "rgb(230, 36, 60)");
    await expect(logo.locator("svg")).toHaveAttribute("viewBox", "0 0 1919 820");
    await expectInsideHorizontalViewport(logo, page);
    await expectNoHorizontalOverflow(page);
    await logo.screenshot({ path: testInfo.outputPath(`original-logo-${theme}.png`) });
    await page.screenshot({ path: testInfo.outputPath(`original-logo-shell-${theme}.png`), fullPage: false });
  }
  const ids = await page.locator(".q-logo [id]").evaluateAll((elements) => elements.map((element) => element.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(pageErrors).toEqual([]);
});

test("persists theme and sound preferences", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const initialTheme = themeFromProjectName(testInfo.project.name);
  const nextTheme = initialTheme === "dark" ? "light" : "dark";
  const root = page.locator("html");
  const themeToggle = page.getByTestId(E2E_SELECTORS.themeToggle);
  const soundToggle = page.getByTestId(E2E_SELECTORS.soundToggle);

  await expect(themeToggle).toBeEnabled();
  await expect(soundToggle).toBeEnabled();
  await expect(root).toHaveAttribute("data-theme", initialTheme);

  const initialThemePressed = await themeToggle.getAttribute("aria-pressed");
  await themeToggle.click();
  await expect(root).toHaveAttribute("data-theme", nextTheme);
  await expect(themeToggle).toHaveAttribute(
    "aria-pressed",
    initialThemePressed === "true" ? "false" : "true",
  );

  const initialSoundPressed = await soundToggle.getAttribute("aria-pressed");
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute(
    "aria-pressed",
    initialSoundPressed === "true" ? "false" : "true",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(themeToggle).toBeEnabled();
  await expect(root).toHaveAttribute("data-theme", nextTheme);
  await expect(soundToggle).toHaveAttribute(
    "aria-pressed",
    initialSoundPressed === "true" ? "false" : "true",
  );
});
