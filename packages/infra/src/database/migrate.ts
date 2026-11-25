import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getEnv } from '../env';
import { createDatabase } from './client';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

const { db, close } = createDatabase(getEnv().DATABASE_URL);
try {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log('Migrations aplicadas.');
} finally {
  await close();
}
