import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/tests/**/*.test.ts', 'backend/src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['backend/src/**/*.ts'],
      exclude: ['backend/src/**/*.test.ts'],
    },
  },
});
