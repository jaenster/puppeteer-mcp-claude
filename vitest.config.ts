import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e.ts', 'tests/claude-*.ts'],
    environment: 'node',
    globals: true,
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/index.ts',      // Server bootstrap - tested via E2E
        'src/logging.ts',    // Infrastructure - tested via E2E
        'src/tools.ts',      // Tool definitions - data only
        'src/types.ts',      // Type definitions - no runtime code
      ],
      thresholds: {
        lines: 95,
        functions: 90,
        branches: 90,
        statements: 95,
      },
    },
    testTimeout: 5000,
    hookTimeout: 10000,
  },
});
