import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    exclude: [...configDefaults.exclude, "**/.worktrees/**"],
    // The admin dashboard suites drive long userEvent sequences and sit close
    // to the 5s default, so they flake on a loaded machine rather than on any
    // real regression.
    testTimeout: 15_000,
  },
});
