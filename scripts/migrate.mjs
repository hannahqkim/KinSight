import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run database migrations");
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
