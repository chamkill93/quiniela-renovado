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

const HOME_HERO_GUARDIAN_PROJECT = "qa-320x568-dark";

const HOME_HERO_VIEWPORTS = [
  { name: "fold-portrait", width: 280, height: 653, maxHeroHeight: 240 },
  { name: "small-portrait", width: 320, height: 568, maxHeroHeight: 260 },
  { name: "samsung-360", width: 360, height: 800, maxHeroHeight: 280 },
  { name: "samsung-384", width: 384, height: 854, maxHeroHeight: 295 },
  { name: "samsung-412", width: 412, height: 915, maxHeroHeight: 310 },
  { name: "samsung-430", width: 430, height: 932, maxHeroHeight: 320 },
  { name: "short-landscape", width: 568, height: 280, maxHeroHeight: 225 },
  { name: "wide-landscape", width: 844, height: 390, maxHeroHeight: 225 },
] as const;

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

  const liveIndicator = page.getByTestId("draw-live-indicator");
  await expect(liveIndicator).toBeVisible();
  await expect(liveIndicator).toHaveRole("status");
  await expect(liveIndicator).toHaveAccessibleName("Estado LIVE del sorteo");
  await expectInsideHorizontalViewport(liveIndicator, page);
  if (page.viewportSize()!.width >= 980) {
    const context = await page.locator(".q-topbar__context").boundingBox();
    const indicator = await liveIndicator.boundingBox();
    expect(indicator!.x).toBeGreaterThanOrEqual(context!.x + context!.width);
  }

  const hero = page.getByTestId("home-hero");
  const reel = hero.locator("[data-reel-source]");
  const artwork = reel.locator('img[src*="rodillo-fuego"]');
  const heroHeading = hero.getByRole("heading", { level: 1, name: "Tu jugada empieza acá." });
  const heroCta = hero.getByRole("link", { name: "Jugar Quiniela" });
  await expect(hero).toBeVisible();
  await expect(heroHeading).toBeVisible();
  await expect(hero.getByRole("link", { name: /^Jugar/ })).toHaveCount(1);
  await expect(heroCta).toHaveAttribute("href", "/quinielas");
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
    const heroBox = element.getBoundingClientRect();
    const reelBox = reelColumn.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    const visual = element.querySelector<HTMLElement>("[data-reel-source]")!;
    const visualStyle = getComputedStyle(visual);
    const visualBox = visual.getBoundingClientRect();
    const heading = element.querySelector<HTMLElement>("h1")!;
    const headingBox = heading.getBoundingClientRect();
    const cta = element.querySelector<HTMLElement>('a[href="/quinielas"]')!;
    const ctaBox = cta.getBoundingClientRect();
    const insideHero = (box: DOMRect) => box.left >= heroBox.left - 1
      && box.right <= heroBox.right + 1
      && box.top >= heroBox.top - 1
      && box.bottom <= heroBox.bottom + 1;
    return {
      actionsY: actionsBox.y,
      ctaFits: cta.scrollWidth <= cta.clientWidth + 1 && cta.scrollHeight <= cta.clientHeight + 1,
      ctaInside: insideHero(ctaBox),
      fireAlpha: Number.parseFloat(visualStyle.getPropertyValue("--hero-fire-alpha")),
      headingFits: heading.scrollWidth <= heading.clientWidth + 1,
      headingInside: insideHero(headingBox),
      heroHeight: heroBox.height,
      reelBottom: reelBox.bottom,
      reelInside: insideHero(visualBox),
      visualRight: visualBox.right,
      visualWidth: visualBox.width,
    };
  });
  expect(heroMetrics.fireAlpha).toBeGreaterThanOrEqual(0.75);
  expect(heroMetrics.fireAlpha).toBeLessThanOrEqual(1);
  expect(heroMetrics.visualWidth).toBeLessThanOrEqual(761);
  expect(heroMetrics.visualRight).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(heroMetrics.headingInside).toBe(true);
  expect(heroMetrics.headingFits).toBe(true);
  expect(heroMetrics.ctaInside).toBe(true);
  expect(heroMetrics.ctaFits).toBe(true);
  if (page.viewportSize()!.width <= 979) {
    expect(heroMetrics.reelInside).toBe(true);
    expect(heroMetrics.heroHeight).toBeLessThanOrEqual(400);
  }
  if (page.viewportSize()!.width <= 1180 && page.viewportSize()!.height > 600) {
    expect(heroMetrics.actionsY).toBeGreaterThanOrEqual(heroMetrics.reelBottom - 1);
  }

  await expectInsideHorizontalViewport(shell, page);
  await expectNoHorizontalOverflow(page);

  const drawCards = page.getByTestId("home-draw-card");
  await expect(drawCards).toHaveCount(4);
  await expect(drawCards.getByTestId("home-draw-label"))
    .toHaveText(["Tempranero", "Matutino", "Vespertino", "Nocturno"]);
  for (const card of await drawCards.all()) {
    await expectInsideHorizontalViewport(card, page);
    if (page.viewportSize()!.width < 768) {
      for (const field of [card.getByTestId("home-draw-label"), card.getByTestId("home-draw-time")]) {
        await expect(field).toBeVisible();
        const bounds = await field.evaluate((element) => {
          const card = element.closest('[data-testid="home-draw-card"]')!.getBoundingClientRect();
          const field = element.getBoundingClientRect();
          return {
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            left: field.left - card.left,
            right: card.right - field.right,
          };
        });
        expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeGreaterThanOrEqual(0);
      }
    }
  }
  const drawGrid = await page.getByTestId("home-draw-grid").evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    height: element.getBoundingClientRect().height,
  }));
  expect(drawGrid.columns).toBe(page.viewportSize()!.width >= 1280 ? 4 : 2);
  expect(drawGrid.scrollWidth).toBeLessThanOrEqual(drawGrid.clientWidth + 1);
  if (page.viewportSize()!.width < 768) {
    expect(drawGrid.height).toBeLessThanOrEqual(204);
    const countdown = page.getByTestId("home-draw-countdown");
    await expect(countdown).toBeVisible();
    await expect(countdown).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
    await expect(page.getByTestId("home-next-draw-action")).toBeHidden();
  }

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

test("keeps the Home hero compact and unclipped across narrow Samsung and landscape viewports", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== HOME_HERO_GUARDIAN_PROJECT,
    `Viewport matrix runs only in ${HOME_HERO_GUARDIAN_PROJECT}`,
  );
  test.slow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const hero = page.getByTestId("home-hero");
  for (const viewport of HOME_HERO_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(hero, viewport.name).toBeVisible();

    for (const topbarItem of [
      page.locator(".q-topbar__mobile-brand"),
      page.locator(".q-balance"),
      page.getByTestId(E2E_SELECTORS.themeToggle),
      page.getByTestId(E2E_SELECTORS.soundToggle),
      page.getByTestId("draw-live-indicator"),
    ]) {
      await expectInsideHorizontalViewport(topbarItem, page);
    }

    const metrics = await hero.evaluate((element) => {
      const heroBox = element.getBoundingClientRect();
      const heading = element.querySelector<HTMLElement>("h1")!;
      const reel = element.querySelector<HTMLElement>("[data-reel-source]")!;
      const cta = element.querySelector<HTMLElement>('a[href="/quinielas"]')!;
      const headingBox = heading.getBoundingClientRect();
      const reelBox = reel.getBoundingClientRect();
      const ctaBox = cta.getBoundingClientRect();
      const insideHero = (box: DOMRect) => box.left >= heroBox.left - 1
        && box.right <= heroBox.right + 1
        && box.top >= heroBox.top - 1
        && box.bottom <= heroBox.bottom + 1;
      return {
        ctaInside: insideHero(ctaBox),
        ctaFits: cta.scrollWidth <= cta.clientWidth + 1 && cta.scrollHeight <= cta.clientHeight + 1,
        headingBottom: headingBox.bottom,
        headingFits: heading.scrollWidth <= heading.clientWidth + 1,
        headingInside: insideHero(headingBox),
        height: heroBox.height,
        reelBottom: reelBox.bottom,
        reelInside: insideHero(reelBox),
        reelTop: reelBox.top,
        ctaTop: ctaBox.top,
      };
    });

    expect(metrics.height, `${viewport.name}: hero height`).toBeLessThanOrEqual(viewport.maxHeroHeight);
    expect(metrics.headingInside, `${viewport.name}: title inside hero`).toBe(true);
    expect(metrics.headingFits, `${viewport.name}: title text fits`).toBe(true);
    expect(metrics.reelInside, `${viewport.name}: reel inside hero`).toBe(true);
    expect(metrics.ctaInside, `${viewport.name}: CTA inside hero`).toBe(true);
    expect(metrics.ctaFits, `${viewport.name}: CTA text fits`).toBe(true);
    if (viewport.height >= viewport.width) {
      expect(metrics.headingBottom, `${viewport.name}: title before reel`).toBeLessThanOrEqual(metrics.reelTop + 1);
      expect(metrics.reelBottom, `${viewport.name}: reel before CTA`).toBeLessThanOrEqual(metrics.ctaTop + 1);
    }

    const drawCards = page.getByTestId("home-draw-card");
    const resultCards = page.getByTestId("home-result-card");
    const megaBanner = page.getByTestId("home-megaloto-banner");
    await expect(drawCards).toHaveCount(4);
    await expect(resultCards).toHaveCount(14);
    for (const item of [
      ...await drawCards.all(),
      ...await resultCards.all(),
      megaBanner,
      megaBanner.getByRole("img", { name: "Logo oficial de Mega Loto" }),
      megaBanner.getByRole("heading", { name: "Sorteo exclusivo con 6 números." }),
      megaBanner.getByRole("link", { name: /sitio oficial de Mega Loto/i }),
    ]) {
      await expectInsideHorizontalViewport(item, page);
    }
    await expectNoHorizontalOverflow(page);
  }
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

test("keeps six detailed rules expandable and their game links accessible", async ({ page }, testInfo) => {
  const { MEGA_LOTO_LOGO, MEGA_LOTO_URL } = await import("@/features/product/product-links");
  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Cómo jugar", level: 1 })).toBeVisible();
  const grid = page.getByTestId("rules-grid");
  await expect(grid.getByRole("article")).toHaveCount(6);
  await expect(grid.locator('button[aria-expanded="false"]')).toHaveCount(6);
  const mega = grid.getByTestId("rule-card-megaloto");
  const official = mega.getByRole("link", { name: /^Sitio oficial de Mega Loto/ });
  await expect(official).toHaveAttribute("href", MEGA_LOTO_URL);
  await expect(official).toHaveAttribute("target", "_blank");
  await expect(official).toHaveAttribute("rel", /noopener/);
  await expect(official).toHaveAttribute("rel", /noreferrer/);
  await expect(mega.getByRole("link", { name: /Jugar/ })).toHaveCount(0);
  await expect(grid.locator('a[href="/quinielas/megaloto"]')).toHaveCount(0);
  const logo = mega.locator("img");
  await expect(logo).toBeVisible();
  expect(decodeURIComponent((await logo.getAttribute("src"))!)).toContain(MEGA_LOTO_LOGO);
  await expect.poll(() => logo.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  const redoblona = page.getByTestId("rule-card-redoblona");
  const toggle = redoblona.getByRole("button");
  await expect(toggle).toHaveAccessibleName("Ver reglas de Redoblona");
  const detail = redoblona.locator("#" + await toggle.getAttribute("aria-controls"));
  const collapsedHeight = (await redoblona.boundingBox())!.height;
  await expect(toggle).toHaveText("Ver reglas");
  await expect(detail).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("rules-collapsed.png"), fullPage: true });
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAccessibleName("Contraer reglas de Redoblona");
  await expect(toggle).toHaveText("Ver menos");
  await expect(detail).toBeVisible();
  for (const name of ["Paso a paso", "Condiciones del acierto", "Ejemplo"]) {
    await expect(redoblona.getByRole("heading", { name, level: 3 })).toBeVisible();
  }
  expect(await redoblona.locator("ol > li").count()).toBeGreaterThanOrEqual(4);
  expect(await redoblona.locator("ul > li").count()).toBeGreaterThanOrEqual(3);
  expect((await redoblona.boundingBox())!.height).toBeGreaterThan(collapsedHeight);
  await expect(redoblona.getByRole("heading", { name: "Premio" })).toHaveCount(0);
  await expect(redoblona.getByRole("complementary")).toHaveCount(0);
  expect(await grid.textContent()).not.toMatch(/×|multiplicador|cuánto paga|premio total|tabla de pagos|\bGs\.|pdf|art[ií]culo|reglamento|vista previa|formulario actual/i);
  await expect(grid.locator('button[aria-expanded="false"]')).toHaveCount(5);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("rules-expanded.png"), fullPage: true });
  await toggle.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAccessibleName("Ver reglas de Redoblona");
  await expect(toggle).toHaveText("Ver reglas");
  await expect(detail).toBeHidden();
  await expect(toggle).toBeFocused();
  await redoblona.getByRole("link", { name: "Jugar Redoblona", exact: true }).click();
  await expect(page).toHaveURL(/\/quinielas\/redoblona$/);
});

test("keeps six rules responsive in both themes without multipliers, calculators or creating plays", async ({ page }, testInfo) => {
  test.slow();
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/reglas", { waitUntil: "domcontentloaded" });
  const grid = page.getByTestId("rules-grid");
  await expect(grid.getByRole("article")).toHaveCount(6);
  await expect(page.getByTestId("prize-calculator")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Calculadora rápida" })).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(grid.getByRole("link")).toHaveCount(6);
  await expect(grid.getByRole("link", { name: /^Jugar / })).toHaveCount(5);
  const gameIds = ["head", "prizes", "invert", "redoblona", "sapyaite", "megaloto"];
  for (const id of gameIds) {
    const card = grid.getByTestId("rule-card-" + id);
    await expect(card.locator("dt")).toHaveCount(2);
    await expect(card.locator("dd")).toHaveCount(2);
    const text = await card.textContent();
    if (id !== "head") expect(text).not.toMatch(/A la Cabeza/i);
    if (id !== "sapyaite") expect(text).not.toMatch(/Sapy[’']?aite/i);
  }
  expect(await page.getByRole("main").textContent())
    .not.toMatch(/×|multiplicador|cuánto paga|calculadora|premio total|tabla de pagos|\bGs\./i);

  const initialTheme = themeFromProjectName(testInfo.project.name);
  const themes = [initialTheme, initialTheme === "dark" ? "light" : "dark"];
  for (const [index, theme] of themes.entries()) {
    if (index > 0) await page.getByTestId(E2E_SELECTORS.themeToggle).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(grid.getByRole("article")).toHaveCount(6);
      const columns = await grid.evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
      );
      expect(columns).toBe(width === 320 ? 1 : width === 768 ? 2 : 3);
      for (const button of await grid.getByRole("button").all()) {
        if (await button.getAttribute("aria-expanded") === "true") await button.click();
      }
      await expect(grid.locator('button[aria-expanded="false"]')).toHaveCount(6);
      for (const card of await grid.getByRole("article").all()) {
        await expect(card).toBeVisible();
        await expectInsideHorizontalViewport(card, page);
        for (const action of await card.locator("button, a").all()) {
          await expect(action).toBeVisible();
          await expectInsideHorizontalViewport(action, page);
          const target = (await action.boundingBox())!;
          expect(target.height).toBeGreaterThanOrEqual(44);
          expect(target.width).toBeGreaterThanOrEqual(44);
        }
      }
      await expectNoHorizontalOverflow(page);

      for (const button of await grid.getByRole("button").all()) await button.click();
      await expect(grid.locator('button[aria-expanded="true"]')).toHaveCount(6);
      for (const name of ["Paso a paso", "Condiciones del acierto", "Ejemplo"]) {
        await expect(grid.getByRole("heading", { name, level: 3 })).toHaveCount(6);
      }
      for (const card of await grid.getByRole("article").all()) {
        await expect(card).toBeVisible();
        await expectInsideHorizontalViewport(card, page);
      }
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath("rules-detailed-" + theme + "-" + width + ".png"),
        fullPage: true,
      });
    }
  }

  expect(posts.filter((url) => /\/(instant|traditional|plays|wallet)\b/.test(url))).toEqual([]);
});

test("renders the latest draw as fourteen responsive balls in position order", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const viewportWidth = page.viewportSize()!.width;
  const expectedColumns = viewportWidth >= 1_280 ? 14 : viewportWidth >= 768 ? 7 : viewportWidth > 420 ? 5 : 4;
  const expectedRows = Math.ceil(14 / expectedColumns);
  const section = page.getByTestId("home-results-section");
  const balls = section.getByRole("list", {
    name: "Las 14 posturas del último sorteo publicado",
    exact: true,
  });
  const cards = balls.getByRole("listitem");
  const positions = Array.from({ length: 14 }, (_, index) => String(index + 1));
  const reverseEntryOrder = Array.from({ length: 14 }, (_, index) => String(14 - index));

  await expect(section.getByRole("heading", { level: 2, name: "Último sorteo publicado", exact: true })).toBeVisible();
  await expect(section.getByText("Resultados de muestra", { exact: true })).toHaveCount(0);
  await expect(section.getByTestId("home-results-draw")).toBeVisible();
  await expect(balls).toHaveAttribute("data-testid", "home-results-balls");
  await expect(balls).not.toHaveAttribute("tabindex");
  await expect(cards).toHaveCount(14);
  await expect(cards.getByTestId("home-result-value")).toHaveCount(14);
  await expect(cards.getByTestId("home-result-posture")).toHaveCount(14);

  expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-position"))))
    .toEqual(positions);
  expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-entry-order"))))
    .toEqual(reverseEntryOrder);
  expect(await cards.getByTestId("home-result-value").allTextContents())
    .toEqual(Array.from({ length: 14 }, () => expect.stringMatching(/^\d{3}$/)));
  expect(await cards.getByTestId("home-result-posture").allTextContents())
    .toEqual(positions.map((position) => `${position}.ª postura`));

  await expect(section.getByRole("tab")).toHaveCount(0);
  await expect(section.getByRole("tablist")).toHaveCount(0);
  await expect(section.getByRole("tabpanel")).toHaveCount(0);
  await expect(section.getByTestId("home-results-carousel")).toHaveCount(0);
  await expect(section.getByTestId("home-results-carousel-track")).toHaveCount(0);
  await expect(section.getByTestId("home-results-previous")).toHaveCount(0);
  await expect(section.getByTestId("home-results-next")).toHaveCount(0);
  for (const formerModality of ["A LA CABEZA", "A LOS PREMIOS", "REDOBLONA", "INVERTIDA"]) {
    await expect(section.getByText(formerModality, { exact: true })).toHaveCount(0);
  }

  const cardDetails = await cards.evaluateAll((elements) => elements.map((element) => {
    const value = element.querySelector<HTMLElement>('[data-testid="home-result-value"]')!;
    const posture = element.querySelector<HTMLElement>('[data-testid="home-result-posture"]')!;
    const icon = element.querySelector<SVGElement>('[data-testid="home-result-rank"]');
    const cardBox = element.getBoundingClientRect();
    const valueBox = value.getBoundingClientRect();
    const postureBox = posture.getBoundingClientRect();
    const iconBox = icon?.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      borderRadius: style.borderRadius,
      customEntryIndex: style.getPropertyValue("--result-entry-index").trim(),
      height: cardBox.height,
      label: element.getAttribute("aria-label"),
      left: cardBox.left,
      opacity: style.opacity,
      position: Number(element.getAttribute("data-position")),
      posture: posture.textContent,
      rank: icon?.getAttribute("data-rank") ?? null,
      rankFocusable: icon?.getAttribute("focusable") ?? null,
      rankHidden: icon?.getAttribute("aria-hidden") ?? null,
      rankInside: !iconBox || (iconBox.left >= cardBox.left - 1 && iconBox.right <= cardBox.right + 1
        && iconBox.top >= cardBox.top - 1 && iconBox.bottom <= cardBox.bottom + 1),
      top: cardBox.top,
      transform: style.transform,
      value: value.textContent?.trim(),
      valueInside: valueBox.left >= cardBox.left - 1 && valueBox.right <= cardBox.right + 1
        && valueBox.top >= cardBox.top - 1 && valueBox.bottom <= cardBox.bottom + 1,
      postureInside: postureBox.left >= cardBox.left - 1 && postureBox.right <= cardBox.right + 1
        && postureBox.top >= cardBox.top - 1 && postureBox.bottom <= cardBox.bottom + 1,
      width: cardBox.width,
    };
  }));

  for (const [index, card] of cardDetails.entries()) {
    const position = index + 1;
    expect(card.position).toBe(position);
    expect(card.value).toMatch(/^\d{3}$/);
    expect(card.posture).toBe(`${position}.ª postura`);
    expect(card.label).toBe(`${position}.ª postura: número ${card.value}`);
    expect(card.customEntryIndex).toBe(String(14 - position));
    expect(card.rank).toBe(position <= 3 ? ["gold", "silver", "bronze"][position - 1] : null);
    if (position <= 3) {
      expect(card.rankHidden).toBe("true");
      expect(card.rankFocusable).toBe("false");
      expect(card.rankInside).toBe(true);
    }
    expect(card.animationName).toBe("none");
    expect(card.opacity).toBe("1");
    expect(card.transform).toBe("none");
    expect(card.borderRadius).toBe("50%");
    expect(Math.abs(card.width - card.height)).toBeLessThanOrEqual(1);
    expect(card.valueInside).toBe(true);
    expect(card.postureInside).toBe(true);
  }

  expect(new Set(cardDetails.map((card) => Math.round(card.top))).size).toBe(expectedRows);
  for (const [index, card] of cardDetails.entries()) {
    const column = index % expectedColumns;
    if (column === 0) {
      expect(card.left).toBeCloseTo(cardDetails[0].left, 0);
      if (index > 0) expect(card.top).toBeGreaterThan(cardDetails[index - expectedColumns].top);
    } else {
      expect(card.left).toBeGreaterThan(cardDetails[index - 1].left);
      expect(card.top).toBeCloseTo(cardDetails[index - 1].top, 0);
    }
  }

  const trackMetrics = await balls.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      direction: style.direction,
      columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
      display: style.display,
      overflowX: style.overflowX,
      rows: new Set(Array.from(element.children, (child) => Math.round(child.getBoundingClientRect().top))).size,
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(trackMetrics.columns).toBe(expectedColumns);
  expect(trackMetrics.direction).toBe("ltr");
  expect(trackMetrics.display).toBe("grid");
  expect(trackMetrics.overflowX).toBe("hidden");
  expect(trackMetrics.rows).toBe(expectedRows);
  expect(trackMetrics.scrollLeft).toBeLessThanOrEqual(1);
  expect(trackMetrics.scrollWidth).toBeLessThanOrEqual(trackMetrics.clientWidth + 1);
  await expectInsideHorizontalViewport(balls, page);
  for (const card of await cards.all()) await expectInsideHorizontalViewport(card, page);
  await expectNoHorizontalOverflow(page);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  const motion = await cards.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return {
      delayMs: Number.parseFloat(style.animationDelay) * 1_000,
      name: style.animationName,
    };
  }));
  expect(motion.every(({ name }) => name.includes("resultBallGather"))).toBe(true);
  expect(motion.map(({ delayMs }) => Math.round(delayMs)))
    .toEqual(Array.from({ length: 14 }, (_, index) => (13 - index) * 45));

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await cards.evaluateAll((elements) => elements.every((element) => {
    const style = getComputedStyle(element);
    return style.animationName === "none" && style.opacity === "1" && style.transform === "none";
  }))).toBe(true);
  await expectNoHorizontalOverflow(page);
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
  const completeDay = days.nth(1);
  const publishedCards = completeDay.getByTestId("daily-draw-card");
  await expect(completeDay.getByTestId("daily-draw-pair")).toHaveCount(2);
  const headNumbers = await publishedCards.getByTestId("daily-draw-number").allTextContents();
  const labels = ["Tempranero", "Matutino", "Vespertino", "Nocturno"];
  await expect(page.getByTestId("draw-postures-panel")).toHaveCount(0);
  for (const [index, label] of labels.entries()) {
    const card = publishedCards.nth(index);
    const toggle = card.getByRole("button", { name: `Ver todos los números de ${label}`, exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const panelId = await toggle.getAttribute("aria-controls");
    if (index === 0) await toggle.press("Enter");
    else if (index === 1) await card.click();
    else await toggle.click();
    const selectedToggle = card.getByRole("button", { name: `Ocultar números de ${label}`, exact: true });
    await expect(selectedToggle).toHaveAttribute("aria-expanded", "true");
    const panel = completeDay.getByRole("region", { name: `Posturas de ${label}`, exact: true });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("id", panelId!);
    await expect(completeDay.getByTestId("draw-postures-panel")).toHaveCount(1);
    const pairLayout = await completeDay.evaluate((element, pairIndex) => {
      const grid = element.querySelector('[data-testid="daily-results-grid"]')!;
      const gridBounds = grid.getBoundingClientRect();
      const allCards = Array.from(grid.querySelectorAll('[data-testid="daily-draw-card"]'));
      const pairs = element.querySelectorAll('[data-testid="daily-draw-pair"]');
      const activePair = pairs[pairIndex];
      const pairCards = Array.from(activePair.querySelectorAll('[data-testid="daily-draw-card"]'));
      const panel = activePair.querySelector('[data-testid="draw-postures-panel"]')!.getBoundingClientRect();
      const secondPairCards = Array.from(pairs[1].querySelectorAll('[data-testid="daily-draw-card"]'));
      return {
        cardCount: pairCards.length,
        cardsBottom: Math.max(...pairCards.map((card) => card.getBoundingClientRect().bottom)),
        allCardsBottom: Math.max(...allCards.map((card) => card.getBoundingClientRect().bottom)),
        gridLeft: gridBounds.left,
        gridRight: gridBounds.right,
        panelLeft: panel.left,
        panelRight: panel.right,
        panelTop: panel.top,
        panelBottom: panel.bottom,
        secondPairTop: Math.min(...secondPairCards.map((card) => card.getBoundingClientRect().top)),
      };
    }, Math.floor(index / 2));
    expect(pairLayout.cardCount).toBe(2);
    expect(pairLayout.panelTop).toBeGreaterThanOrEqual(pairLayout.cardsBottom - 1);
    if (columns === 2 && index < 2) expect(pairLayout.panelBottom).toBeLessThanOrEqual(pairLayout.secondPairTop + 1);
    if (columns === 4) {
      expect(Math.abs(pairLayout.panelLeft - pairLayout.gridLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs(pairLayout.panelRight - pairLayout.gridRight)).toBeLessThanOrEqual(1);
      expect(pairLayout.panelTop).toBeGreaterThanOrEqual(pairLayout.allCardsBottom - 1);
    }
    expect(await completeDay.getByTestId("daily-draw-toggle").evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-expanded"))))
      .toEqual(labels.map((_, drawIndex) => String(drawIndex === index)));
    const carousel = panel.getByRole("list", { name: `Números de ${label}`, exact: true });
    await expect(carousel).toHaveAttribute("aria-roledescription", "carrusel");
    await expect(carousel).toHaveAttribute("tabindex", "0");
    const postures = carousel.getByRole("listitem");
    await expect(postures).toHaveCount(14);
    expect(await postures.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-position"))))
      .toEqual(Array.from({ length: 14 }, (_, position) => String(position + 1)));
    expect(await postures.getByTestId("draw-posture-number").allTextContents())
      .toEqual(Array.from({ length: 14 }, () => expect.stringMatching(/^\d{3}$/)));
    await expect(postures.first()).toHaveAttribute("data-head", "true");
    await expect(carousel.locator('[data-head="true"]')).toHaveCount(1);
    await expect(postures.first().getByText("A la cabeza", { exact: true })).toBeVisible();
    await expect(postures.first().getByTestId("draw-posture-number")).toHaveText(headNumbers[index]);
    const crowns = carousel.getByTestId("draw-posture-rank");
    await expect(crowns).toHaveCount(3);
    await carousel.scrollIntoViewIfNeeded();
    for (const [rankIndex, rank] of ["gold", "silver", "bronze"].entries()) {
      const crown = postures.nth(rankIndex).getByTestId("draw-posture-rank");
      await expect(crown).toHaveAttribute("data-rank", rank);
      await expect(crown).toHaveAttribute("aria-hidden", "true");
      await crown.scrollIntoViewIfNeeded();
      await expect(crown).toBeInViewport();
    }
    await carousel.press("Home");
    await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(1);
    const crownColors = await crowns.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color));
    expect(new Set(crownColors).size).toBe(3);
    const postureRows = await postures.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top)));
    expect(new Set(postureRows).size).toBe(1);
    await expect(panel.getByRole("heading")).toHaveText([`Posturas de ${label}`]);
    await expect(panel.getByRole("table")).toHaveCount(0);
    await expect(carousel).toHaveCSS("overflow-x", "auto");
    await expect(carousel).toHaveCSS("touch-action", /pan-x|auto|manipulation/);
    await expectInsideHorizontalViewport(carousel, page);
    await expectNoHorizontalOverflow(page);
    if (index === 0) {
      const trackSize = await carousel.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
      if (page.viewportSize()!.width < 768) expect(trackSize.scrollWidth).toBeGreaterThan(trackSize.clientWidth);
      if (trackSize.scrollWidth > trackSize.clientWidth + 1) {
        const previous = panel.getByRole("button", { name: `Posturas anteriores de ${label}`, exact: true });
        const next = panel.getByRole("button", { name: `Posturas siguientes de ${label}`, exact: true });
        await expect(next).toBeEnabled();
        await next.click();
        await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        await previous.click();
        await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(1);
        await carousel.press("End");
        await expect.poll(() => carousel.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft)).toBeLessThanOrEqual(1);
        await expect(postures.last().getByTestId("draw-posture-number")).toBeInViewport();
        await carousel.press("Home");
        await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(1);
      }
    }
  }
  await page.screenshot({ path: testInfo.outputPath("results-by-date.png"), fullPage: true });
  await publishedCards.last().getByRole("button", { name: "Ocultar números de Nocturno", exact: true }).click();
  await expect(page.getByTestId("draw-postures-panel")).toHaveCount(0);
  expect(await publishedCards.getByTestId("daily-draw-number").allTextContents()).toEqual(headNumbers);
  await publishedCards.first().getByTestId("daily-draw-toggle").click();
  await expect(page.getByTestId("draw-postures-panel")).toHaveCount(1);
  await page.getByRole("button", { name: "Días anteriores →", exact: true }).click();
  await expect(page.getByTestId("draw-postures-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "← Más recientes", exact: true }).click();
  await expect(page.getByTestId("draw-postures-panel")).toHaveCount(0);
  await expect(days.first()).toHaveAttribute("data-date", dates[0]);
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
