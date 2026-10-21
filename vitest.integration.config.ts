import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    reporters: ['default', ['junit', { outputFile: 'test-results/integration-junit.xml' }]],
    hookTimeout: 20_000,
    testTimeout: 20_000,
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
