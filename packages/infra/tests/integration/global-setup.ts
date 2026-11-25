/**
 * Integration tests run against `<database>_test`, never against the development database.
 * Runs once before the test workers: creates the test database if needed, applies the migrations
 * and hands its URL to the tests (`inject('testDatabaseUrl')`).
 */
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { createDatabase } from '../../src/database/client';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));
const TEST_SUFFIX = '_test';
const SAFE_NAME = /^\w+$/;

function testDatabaseUrl(url: string): { url: string; name: string } {
  const parsed = new URL(url);
  const name = `${parsed.pathname.slice(1)}${TEST_SUFFIX}`;
  if (!SAFE_NAME.test(name)) throw new Error(`Nome de banco inesperado: ${name}`);
  parsed.pathname = `/${name}`;
  return { url: parsed.toString(), name };
}

export default async function setup(project: TestProject): Promise<void> {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    project.provide('testDatabaseUrl', null);
    return;
  }
  const test = testDatabaseUrl(devUrl);

  const admin = new pg.Client({ connectionString: devUrl });
  await admin.connect();
  try {
    const found = await admin.query('select 1 from pg_database where datname = $1', [test.name]);
    if (found.rowCount === 0) await admin.query(`create database "${test.name}"`);
  } finally {
    await admin.end();
  }

  const { db, close } = createDatabase(test.url);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await close();
  }
  project.provide('testDatabaseUrl', test.url);
}

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string | null;
  }
}
