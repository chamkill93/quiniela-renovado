import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";
import { request, type FullConfig } from "@playwright/test";

import { DEFAULT_DEV_ACCESS_CODE } from "@/lib/dev-access";

const ACCESS_STATE_PATH = resolve("work/e2e-dev-access.json");

export default async function globalSetup(config: FullConfig) {
  loadEnvConfig(process.cwd());

  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("Playwright necesita una baseURL para preparar el acceso DEV.");
  }

  const context = await request.newContext({ baseURL });

  try {
    const response = await context.post("/api/dev-access", {
      data: { code: process.env.DEV_ACCESS_CODE || DEFAULT_DEV_ACCESS_CODE },
    });

    if (!response.ok()) {
      throw new Error(`No se pudo preparar el acceso DEV para E2E (${response.status()}).`);
    }

    await mkdir(dirname(ACCESS_STATE_PATH), { recursive: true });
    await context.storageState({ path: ACCESS_STATE_PATH });
  } finally {
    await context.dispose();
  }
}
