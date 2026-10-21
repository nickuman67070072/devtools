import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['default', ['junit', { outputFile: 'test-results/vitest-junit.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: [
        'src/lib/trust-score.ts',
        'src/lib/validation.ts',
        'src/lib/boundaries.ts',
        'src/features/meetups/utils.ts',
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
