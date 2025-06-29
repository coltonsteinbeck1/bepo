import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use Node.js environment for Discord.js compatibility
    environment: 'node',
    
    // Test file patterns
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'build', 'coverage', 'tests/setup.js'],
    
    // Global test timeout (30 seconds for integration tests)
    testTimeout: 30000,
    
    // Coverage configuration
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'coverage/**',
        'dist/**',
        'packages/*/test/**',
        '**/*.d.ts',
        'cypress/**',
        'test/**',
        'tests/**',
        '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}',
        '**/*{.,-}spec.{js,cjs,mjs,ts,tsx,jsx}',
        '**/__tests__/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress}.config.*',
        '**/.*rc.*',
        'scripts/**',
        'logs/**'
      ]
    },
    
    // Global setup for mocks and test environment
    setupFiles: ['./tests/setup.js'],
    
    // Mock external services by default
    globals: true,
    
    // Disable console output during tests (reduce log spam)
    silent: true,
    
    // Run tests in sequence to avoid database conflicts
    sequence: {
      concurrent: false
    }
  }
});
