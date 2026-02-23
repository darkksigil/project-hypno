import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     false,           // explicit imports only (already the case in your tests)
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include:  ['src/**/*.ts'],
      exclude:  ['src/tests/**', 'src/**/*.d.ts'],
    },
  },
});