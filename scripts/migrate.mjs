import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";

/*
 * Mirrors resolveDatabaseUrl("migration") in src/lib/database-url.ts. Kept
 * inline rather than imported: this is plain .mjs, and importing a .ts needs
 * Node's type stripping (22.6+), which not everyone on the team will have.
 *
 * Migrations prefer a direct connection — DDL through Supabase's transaction
 * pooler is unreliable, and pooling buys a one-off script nothing.
 */
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const suffix of ["POSTGRES_URL_NON_POOLING", "POSTGRES_URL", "POSTGRES_PRISMA_URL"]) {
    const key =
      process.env[suffix] !== undefined
        ? suffix
        : Object.keys(process.env).find((name) => name.endsWith(`_${suffix}`));
    if (key && process.env[key]) return process.env[key];
  }
  return undefined;
}

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  throw new Error(
    "No Postgres connection string. Put DATABASE_URL in .env.local, or any of " +
      "POSTGRES_URL_NON_POOLING / POSTGRES_URL / POSTGRES_PRISMA_URL (a prefix " +
      'such as "kinsight_" in front of those names is fine). Vercel writes the ' +
      "prefixed ones when you connect a Supabase store; copy one into .env.local " +
      "to migrate from here, or run `vercel env pull .env.local`.",
  );
}

const migrationsUrl = new URL("../db/migrations/", import.meta.url);
const migrations = (await readdir(migrationsUrl)).filter((name) => name.endsWith(".sql")).sort();
const pool = new Pool({ connectionString, max: 1 });

try {
  for (const migration of migrations) {
    await pool.query(await readFile(new URL(migration, migrationsUrl), "utf8"));
    console.log(`Applied database migration: ${migration}`);
  }
} finally {
  await pool.end();
}
