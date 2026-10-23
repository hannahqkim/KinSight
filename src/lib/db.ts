import { Pool, type QueryResultRow } from "pg";
import { missingDatabaseUrlMessage, resolveDatabaseUrl } from "./database-url.ts";

const globalForDatabase = globalThis as typeof globalThis & {
  kinsightPostgresPool?: Pool;
};

export function databaseConfigured(): boolean {
  return Boolean(resolveDatabaseUrl("runtime"));
}

function databasePool(): Pool {
  const connectionString = resolveDatabaseUrl("runtime");
  if (!connectionString) throw new Error(missingDatabaseUrlMessage("runtime"));

  if (!globalForDatabase.kinsightPostgresPool) {
    globalForDatabase.kinsightPostgresPool = new Pool({
      connectionString,
      // Serverless instances each own a pool; keep one connection per instance.
      max: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return globalForDatabase.kinsightPostgresPool;
}

export async function queryDatabase<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<{ rows: Row[] }> {
  return databasePool().query<Row>(text, [...values]);
}
