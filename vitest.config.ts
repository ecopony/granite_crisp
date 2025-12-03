import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // No jsdom needed - bloc tests are pure TypeScript, no React
    environment: "node",
    // Include source files for coverage
    include: ["src/**/*.test.ts"],
  },
});
