import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    globals: false,
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not Vitest
    // ones — Vitest's default include pattern matches *.spec.ts too, and
    // Playwright's test() throws if it's ever imported outside its own runner.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
