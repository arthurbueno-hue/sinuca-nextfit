import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "src/test/empty.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    env: { DATA_BACKEND: "memory", ADMIN_EMAILS: "adm@nextfit.com.br", ALLOWED_DOMAIN: "nextfit.com.br" },
  },
});
