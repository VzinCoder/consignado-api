import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  close: () => Promise<void>;
}

export function createDatabase(url: string): DatabaseConnection {
  const pool = new pg.Pool({ connectionString: url });
  return {
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  };
}
