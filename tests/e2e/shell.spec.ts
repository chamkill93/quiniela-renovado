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
}) => {
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

  await expectInsideHorizontalViewport(shell, page);
  await expectNoHorizontalOverflow(page);
});

test("shows the nine instant games in the required responsive grid", async ({
  page,
}) => {
  await page.goto("/instantaneas", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { level: 1, name: "Instantáneas" }),
  ).toBeVisible();

  const grid = page.getByTestId(E2E_SELECTORS.instantGamesGrid);
  const cards = grid.getByTestId(E2E_SELECTORS.instantGameCard);

  await expect(grid).toBeVisible();
  await expect(cards).toHaveCount(9);
  for (let index = 0; index < 9; index += 1) {
    await expect(cards.nth(index)).toBeVisible();
    await expectInsideHorizontalViewport(cards.nth(index), page);
  }

  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth >= 1366) {
    const boxes = await Promise.all(
      Array.from({ length: 9 }, (_, index) => cards.nth(index).boundingBox()),
    );
    expect(boxes.every(Boolean)).toBe(true);

    const columns = new Set(
      boxes.map((box) => Math.round((box?.x ?? 0) / 4) * 4),
    );
    const rows = new Set(
      boxes.map((box) => Math.round((box?.y ?? 0) / 4) * 4),
    );
    expect(columns.size).toBe(3);
    expect(rows.size).toBe(3);
  }

  await expectNoHorizontalOverflow(page);
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
