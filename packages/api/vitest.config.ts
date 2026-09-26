import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    env: {
      DATABASE_URL: 'postgresql://bandstr:bandstr_dev@localhost:5432/bandstr',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-1234567890',
      BETTER_AUTH_URL: 'http://localhost:3001',
      CORS_ORIGINS: 'http://localhost:9000',
      NODE_ENV: 'test',
    },
  },
})
