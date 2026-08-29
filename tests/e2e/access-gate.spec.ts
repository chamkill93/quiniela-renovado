import { expect, test } from "@playwright/test";

import { DEFAULT_DEV_ACCESS_CODE } from "@/lib/dev-access";

test("blocks deep links until the DEV code is accepted for the browser session", async ({
  context,
  page,
}) => {
  await page.goto("/quinielas", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("dev-access-gate")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Bienvenido a la página DEV de Quiniela",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveCount(0);
  await expect(page.getByLabel("Código de acceso")).toHaveAttribute("type", "password");
  expect(await page.content()).not.toContain(DEFAULT_DEV_ACCESS_CODE);
  expect((await context.cookies()).some(({ name }) => name === "quinie_mock_session")).toBe(false);

  await page.getByLabel("Código de acceso").fill("Código incorrecto");
  await page.getByLabel("Código de acceso").press("Enter");
  await expect(page.locator("#dev-access-error")).toContainText("El código no es correcto");
  await expect(page.getByTestId("app-shell")).toHaveCount(0);

  await page.getByLabel("Código de acceso").fill(DEFAULT_DEV_ACCESS_CODE);
  await page.getByRole("button", { name: "Entrar a la página" }).click();

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page).toHaveURL(/\/quinielas$/);
  await expect(page.getByTestId("dev-access-gate")).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("dev-access-gate")).toHaveCount(0);
});
