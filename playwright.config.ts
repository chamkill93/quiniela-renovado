import { defineConfig } from "@playwright/test";

const QA_VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

const QA_THEMES = ["dark", "light"] as const;

const visualProjects = QA_VIEWPORTS.flatMap(({ name, width, height }) =>
  QA_THEMES.map((theme) => ({
    name: `qa-${name}-${theme}`,
    testMatch: "**/shell.spec.ts",
    use: {
      browserName: "chromium" as const,
      channel: process.env.PLAYWRIGHT_CHANNEL === "chrome" ? "chrome" : undefined,
      viewport: { width, height },
      screen: { width, height },
      colorScheme: theme,
      deviceScaleFactor: 1,
      hasTouch: width <= 430,
      isMobile: width <= 430,
      locale: "es-PY",
      timezoneId: "America/Asuncion",
    },
  })),
);

const functionalProjects = [
  {
    name: "functional-1366x768-dark",
    width: 1366,
    height: 768,
    theme: "dark" as const,
    hasTouch: false,
    isMobile: false,
  },
  {
    name: "functional-390x844-light",
    width: 390,
    height: 844,
    theme: "light" as const,
    hasTouch: true,
    isMobile: true,
  },
].map(({ name, width, height, theme, hasTouch, isMobile }) => ({
  name,
  testMatch: "**/product-flows.spec.ts",
  use: {
    browserName: "chromium" as const,
    channel: process.env.PLAYWRIGHT_CHANNEL === "chrome" ? "chrome" : undefined,
    viewport: { width, height },
    screen: { width, height },
    colorScheme: theme,
    deviceScaleFactor: 1,
    hasTouch,
    isMobile,
    locale: "es-PY",
    timezoneId: "America/Asuncion",
  },
}));

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: process.env.CI
      ? "npm run start"
      : "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [...visualProjects, ...functionalProjects],
});
