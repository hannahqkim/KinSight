import { Pool, type QueryResultRow } from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  kinsightPostgresPool?: Pool;
};

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function databasePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

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
