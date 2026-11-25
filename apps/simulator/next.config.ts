import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// Single .env at the monorepo root, shared by every app and script.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  transpilePackages: ['@zelafin/core', '@zelafin/infra'],
  serverExternalPackages: ['pg', 'pino'],
};

export default nextConfig;
