import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-only-never-use-in-production-123456789",
      CORS_ORIGIN: "http://localhost:3000",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        "postgresql://unused:unused@127.0.0.1:1/unused",
    },
  },
});
