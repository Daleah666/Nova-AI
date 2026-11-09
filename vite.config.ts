import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { subliminalDevApi } from "./server/devApi";

export default defineConfig({
  plugins: [react(), subliminalDevApi()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
