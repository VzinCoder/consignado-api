import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Carrega o .env da raiz para localizar o Postgres local (o CI define DATABASE_URL por conta própria).
// Os testes de integração usam um banco separado <database>_test (ver tests/integration/global-setup.ts).
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile) && !process.env.CI) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: ['tests/integration/global-setup.ts'],
  },
});
