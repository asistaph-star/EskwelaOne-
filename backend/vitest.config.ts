import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Pre-load dedicated test environment before test runners initialize
const testEnvPath = path.resolve(__dirname, '.env.test');
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
} else {
  dotenv.config({ path: path.resolve(__dirname, '.env') });
}

process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    fileParallelism: false,
    setupFiles: ['tests/setup/testEnvGuard.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || '',
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || '',
    },
  },
});
