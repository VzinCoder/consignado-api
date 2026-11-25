import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Loads the root .env so repository tests can reach the local Postgres (CI sets DATABASE_URL itself).
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile) && !process.env.CI) process.loadEnvFile(envFile);

export default defineConfig({
  test: { fileParallelism: false },
});
