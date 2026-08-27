import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    name: "unit",
    // Bound jsdom concurrency so local/CI CPU contention does not cause false timeouts.
    maxWorkers: 2,
    environment: "node",
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "tests/e2e/**",
      "tests/helpers/**",
      "reference/**",
      "docs/**",
      "project-docs/**",
      "CODEX_PROMPTS/**",
    ],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      enabled: false,
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
    },
  },
});
