import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/react/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/react/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
