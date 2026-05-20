import { defineConfig } from "vitest/config"

const testDb =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:5432/atleta_test"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",

    // Los tests de integración usan una DB real — correr en un solo fork
    // evita condiciones de carrera entre archivos de test.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },

    // Exponer la DB de test a todos los workers antes de que carguen módulos
    env: {
      DATABASE_URL: testDb,
    },

    // Las migraciones corren una sola vez antes de todos los tests
    globalSetup: "./src/__tests__/global-setup.ts",

    // Mocks globales (Anthropic, Cloudflare)
    setupFiles: ["./src/__tests__/setup.ts"],

    include: ["src/__tests__/**/*.test.ts"],

    testTimeout: 30_000,
    hookTimeout: 30_000,

    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts", "src/migrate.ts"],
      reporter: ["text", "lcov"],
    },
  },
})
