import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Loads the root .env to find the local Postgres (CI sets DATABASE_URL itself).
// The integration tests then use a separate <database>_test (see tests/integration/global-setup.ts).
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile) && !process.env.CI) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: ['tests/integration/global-setup.ts'],
  },
});
