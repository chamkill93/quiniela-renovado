import { expect, type Locator, type Page } from "@playwright/test";

export const E2E_SELECTORS = {
  appShell: "app-shell",
  primaryNavigation: "primary-navigation",
  themeToggle: "theme-toggle",
  soundToggle: "sound-toggle",
  instantGamesGrid: "instant-games-grid",
  instantGameCard: "instant-game-card",
  traditionalGamesGrid: "traditional-games-grid",
  traditionalGameCard: "traditional-game-card",
} as const;

export const THEME_STORAGE_KEY = "quinie_theme";

export type QaTheme = "dark" | "light";

export function activeNavigation(page: Page) {
  return page.locator(
    '[data-testid="primary-navigation"]:visible, nav[aria-label="Navegación móvil"]:visible',
  );
}

export function themeFromProjectName(projectName: string): QaTheme {
  if (projectName.endsWith("-light")) return "light";
  if (projectName.endsWith("-dark")) return "dark";
  throw new Error(`Playwright project does not declare a QA theme: ${projectName}`);
}

export async function installThemePreference(page: Page, theme: QaTheme) {
  await page.addInitScript(
    ({ storageKey, initialTheme }) => {
      const storedTheme = localStorage.getItem(storageKey);
      const activeTheme =
        storedTheme === "dark" || storedTheme === "light"
          ? storedTheme
          : initialTheme;

      if (!storedTheme) localStorage.setItem(storageKey, activeTheme);
      const applyTheme = () => {
        const root = document.documentElement;
        if (!root) return;
        root.dataset.theme = activeTheme;
        root.style.colorScheme = activeTheme;
      };

      if (document.documentElement) applyTheme();
      else document.addEventListener("DOMContentLoaded", applyTheme, { once: true });
    },
    { storageKey: THEME_STORAGE_KEY, initialTheme: theme },
  );
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          Math.max(
            document.documentElement.scrollWidth,
            document.body?.scrollWidth ?? 0,
          ) - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

export async function expectInsideHorizontalViewport(
  locator: Locator,
  page: Page,
) {
  const box = await locator.boundingBox();
  expect(box, "Expected the element to have a layout box").not.toBeNull();

  const viewportWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
}
