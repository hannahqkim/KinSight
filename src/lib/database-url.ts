/**
 * Work out the Postgres connection string.
 *
 * `DATABASE_URL` is what this project asks for, but nothing sets it by default.
 * Vercel's Supabase integration writes `POSTGRES_URL`, `POSTGRES_PRISMA_URL`
 * and `POSTGRES_URL_NON_POOLING`, and it prefixes all of them with the store's
 * name — on this project they arrive as `kinsight_POSTGRES_URL` and so on. So
 * the suffix is matched rather than the whole name, and any prefix works.
 *
 * Pooling matters and the two callers want opposite things:
 *
 *  - The app runs on serverless instances that each open their own pool, so it
 *    wants the transaction pooler (port 6543). Direct connections run the
 *    database out of slots long before they run out of traffic.
 *  - Migrations want a direct connection (port 5432). DDL through a transaction
 *    pooler is at best unreliable, and a migration is a one-off from a laptop
 *    where pooling buys nothing.
 *
 * An explicit DATABASE_URL always wins, so this can be overridden.
 */
type Mode = "runtime" | "migration";

const RUNTIME_ORDER = ["POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"];
const MIGRATION_ORDER = ["POSTGRES_URL_NON_POOLING", "POSTGRES_URL", "POSTGRES_PRISMA_URL"];

export function resolveDatabaseUrl(mode: Mode = "runtime"): string | undefined {
  const explicit = process.env.DATABASE_URL;
  if (explicit) return explicit;

  const order = mode === "migration" ? MIGRATION_ORDER : RUNTIME_ORDER;
  for (const suffix of order) {
    // Exact name first, then any prefixed variant the integration created.
    const key =
      process.env[suffix] !== undefined
        ? suffix
        : Object.keys(process.env).find((name) => name.endsWith(`_${suffix}`));
    const value = key ? process.env[key] : undefined;
    if (value) return value;
  }
  return undefined;
}

/** What to tell someone when nothing is set, naming what we actually looked for. */
export function missingDatabaseUrlMessage(mode: Mode = "runtime"): string {
  const order = mode === "migration" ? MIGRATION_ORDER : RUNTIME_ORDER;
  return (
    `No Postgres connection string. Set DATABASE_URL, or connect a Supabase store ` +
    `in Vercel, which provides ${order.join(", ")} (a prefix such as ` +
    `"kinsight_" in front of those names is fine).`
  );
}
