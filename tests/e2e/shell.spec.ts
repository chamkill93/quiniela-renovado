import { expect, test } from "@playwright/test";
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
  await expect(artwork).toBeVisible();
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
  const theme = themeFromProjectName(testInfo.project.name);
  expect(heroMetrics.fireAlpha).toBeGreaterThanOrEqual(theme === "dark" ? 0.75 : 0.25);
  expect(heroMetrics.fireAlpha).toBeLessThanOrEqual(theme === "dark" ? 1 : 0.45);
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
  const footerLinks = footer.getByRole("link");
  await expect(footerLinks).toHaveCount(5);
  const linkRows = await footerLinks.evaluateAll((links) =>
    links.map((link) => Math.round(link.getBoundingClientRect().top)),
  );
  expect(new Set(linkRows).size).toBe(1);
  for (const link of await footerLinks.all()) {
    await expectInsideHorizontalViewport(link, page);
  }
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

test("calculates reference prizes without creating plays", async ({ page }, testInfo) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  const calculator = page.getByTestId("prize-calculator");
  const game = calculator.getByRole("combobox", { name: "Juego", exact: true });
  const amount = calculator.getByLabel("Importe (Gs.)", { exact: true });
  const total = calculator.getByTestId("estimate-total");
  const net = calculator.getByTestId("estimate-net");
  await expect(total).toHaveText("Gs. 350.000");
  await amount.fill("1000");
  await expect(total).toHaveText("Gs. 700.000");
  await expect(net).toHaveText("Gs. 699.000");
  await game.selectOption("prizes");
  await calculator.getByRole("combobox", { name: "Postura", exact: true }).selectOption("10");
  await expect(total).toHaveText("Gs. 70.000");
  await game.selectOption("invert");
  await expect(total).toHaveText("Gs. 116.666");
  await calculator.getByLabel("Tus tres cifras").fill("111");
  await expect(total).toHaveText("Gs. 700.000");
  await game.selectOption("redoblona");
  await calculator.getByRole("combobox", { name: "Postura", exact: true }).selectOption("10");
  await expect(total).toHaveText("Gs. 5.600.000");
  await game.selectOption("sapyaite");
  await expect(calculator.getByLabel("Postura")).toHaveCount(0);
  await expect(total).toHaveText("Gs. 700.000");
  await amount.fill("-500");
  await expect(calculator.getByRole("status")).toBeVisible();
  await expect(total).toHaveCount(0);
  await amount.fill("500");
  await expect(total).toHaveText("Gs. 350.000");
  await expectNoHorizontalOverflow(page);
  expect(posts.filter((url) => /\/(instant|traditional|plays|wallet)\b/.test(url))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("rules-calculator.png"), fullPage: true });
});

test("fills a responsive grid with six sample results per modality", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const section = page.getByTestId("home-results-section");
  await expect(section.getByText("Resultados de muestra", { exact: true })).toBeVisible();
  for (const tab of await section.getByRole("tab").all()) {
    await tab.click();
    await expect(section.getByTestId("home-result-card")).toHaveCount(6);
  }
  const columns = await section.getByRole("tabpanel").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  const width = page.viewportSize()!.width;
  expect(columns).toBe(width >= 1280 ? 6 : width >= 768 ? 3 : 2);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("home-six-results.png"), fullPage: true });
});

test("groups results by date into four responsive colored draws", async ({ page }, testInfo) => {
  await page.goto("/resultados", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Resultados", level: 1 })).toBeVisible();
  const days = page.getByTestId("results-day");
  await expect(days).toHaveCount(5);
  const dates = await days.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-date")!));
  expect(dates).toEqual([...dates].sort().reverse());
  for (const day of await days.all()) {
    const cards = day.getByTestId("daily-draw-card");
    await expect(cards).toHaveCount(4);
    expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-draw-id"))))
      .toEqual(["early", "morning", "evening", "night"]);
    await expect(day.getByText("4 de 4 sorteos publicados")).toBeVisible();
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
  const dateInput = page.getByLabel("Buscar por fecha");
  await dateInput.fill(dates[0]);
  await expect(days).toHaveCount(1);
  await expect(days.first()).toHaveAttribute("data-date", dates[0]);
  const card = days.first().getByTestId("daily-draw-card").first();
  await card.locator("summary").click();
  await expect(card.getByRole("heading", { name: "A los Premios", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("results-by-date.png"), fullPage: true });
  await dateInput.fill("2000-01-01");
  await expect(days).toHaveCount(1);
  await expect(days.getByText("Sin publicar", { exact: true })).toHaveCount(4);
  await expect(days.getByTestId("daily-draw-number")).toHaveCount(0);
  await page.getByRole("button", { name: "Ver todas las fechas" }).click();
  await expect(days).toHaveCount(5);
});

test("pages through ten days without showing more than five at once", async ({ page }, testInfo) => {
  await page.goto("/resultados", { waitUntil: "domcontentloaded" });
  const top = page.getByRole("navigation", { name: "Paginación de fechas", exact: true });
  const bottom = page.getByRole("navigation", { name: "Paginación de fechas inferior", exact: true });
  const days = page.getByTestId("results-day");
  await expect(top.getByText("Página 1 de 2")).toBeVisible();
  await expect(days).toHaveCount(5);
  await expect(page.getByTestId("daily-draw-card")).toHaveCount(20);
  const newestDates = await days.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-date")));
  await expect(top.getByRole("button", { name: /Más recientes/ })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("results-pagination-controls.png"), fullPage: false });
  await bottom.getByRole("button", { name: /Días anteriores/ }).click();
  await expect(top.getByText("Página 2 de 2")).toBeVisible();
  await expect(days).toHaveCount(5);
  const olderDates = await days.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-date")));
  expect(new Set([...newestDates, ...olderDates]).size).toBe(10);
  expect(olderDates.every((date) => date! < newestDates[4]!)).toBe(true);
  await expect(top.getByRole("button", { name: /Días anteriores/ })).toBeDisabled();
  await expect(page.locator("#daily-results-history")).toBeFocused();
  await expect(days.first().getByRole("heading", { level: 2 })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  for (const control of await top.getByRole("button").all()) {
    await expectInsideHorizontalViewport(control, page);
  }
  await page.screenshot({ path: testInfo.outputPath("results-page-two.png"), fullPage: false });
  await page.getByLabel("Buscar por fecha").fill(olderDates[4]!);
  await expect(days).toHaveCount(1);
  await expect(top).toHaveCount(0);
  await page.getByRole("button", { name: "Ver todas las fechas" }).click();
  await expect(top.getByText("Página 1 de 2")).toBeVisible();
  expect(await days.first().getAttribute("data-date")).toBe(newestDates[0]);
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
