import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    // Pins the timezone so "today" / midnight assertions are deterministic.
    globalSetup: ["./tests/global-setup.ts"],
    // The suite is small; running files one at a time keeps startup reliable on low-memory machines and CI.
    fileParallelism: false,
  },
});
