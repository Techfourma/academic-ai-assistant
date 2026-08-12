import { defineConfig } from 'vitest/config';

/**
 * Config for AI-dependent integration tests.
 * Run with: `npm run test:ai`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.ai.test.ts'],
    testTimeout: 60000,
  },
});