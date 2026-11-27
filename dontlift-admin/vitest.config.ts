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
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    setupFiles: ["tests/helpers/unit-safety-setup.ts"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
