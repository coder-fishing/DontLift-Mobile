import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "src"),
      "server-only": resolve(process.cwd(), "tests/helpers/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts", "tests/integration/**/*.test.tsx"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
