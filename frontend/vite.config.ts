import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
    // Without this, Playwright's own output (test-results/, playwright-report/)
    // landing inside this directory during an e2e run triggers a dev-server
    // restart mid-test, which looks like a flaky test but is actually Vite
    // reacting to its own test's output.
    watch: {
      ignored: ["**/test-results/**", "**/playwright-report/**", "**/e2e/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ["recharts"],
          vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
        },
      },
    },
  },
});
