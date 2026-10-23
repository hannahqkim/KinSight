/**
 * Durable state for the feedback loop: the spam database and the evals log.
 *
 * One JSON document, not a database. It exists so the loop on the whiteboard is
 * real rather than mimed — a number reported during the demo is still flagged
 * after a restart, and the kin's feedback is still counted. Swap this module for
 * Postgres (or Firestore) and nothing above it changes.
 *
 * Where the document lives:
 * - Redis, when the Upstash / Vercel KV REST credentials are set. This is the
 *   only option that is durable on Vercel.
 * - Otherwise a file. Locally that is `.data/`; on Vercel the deployment's
 *   filesystem is read-only, so it falls back to the OS temp dir, which works
 *   but only lasts as long as one warm server instance.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { EvalStats, EvalVerdict, FraudTactic, SpamReport } from "@/lib/schema";

const FILE = process.env.VERCEL
  ? join(tmpdir(), "kinsight", "kinsight.json")
  : join(process.cwd(), ".data", "kinsight.json");

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = "kinsight:db";

type EvalRow = {
  callId: string;
  phoneNumber: string | null;
  modelProbability: number;
  modelRiskLevel: string;
  kinVerdict: EvalVerdict;
  notes: string | null;
  submittedAt: string;
};

type Db = {
  spam: Record<string, SpamReport>;
  evals: EvalRow[];
};

const EMPTY = (): Db => ({ spam: {}, evals: [] });

/** One command against the Upstash REST API, e.g. `["GET", key]`. */
async function redis(command: string[]): Promise<unknown> {
  const response = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const json = (await response.json()) as { result?: unknown; error?: string };
  if (!response.ok || json.error) {
    throw new Error(`store: redis ${command[0]} failed: ${json.error ?? response.status}`);
  }
  return json.result;
}

async function read(): Promise<Db> {
  if (REDIS_URL && REDIS_TOKEN) {
    const raw = await redis(["GET", REDIS_KEY]);
    return typeof raw === "string" ? (JSON.parse(raw) as Db) : EMPTY();
  }
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as Db;
  } catch {
    // Missing or unreadable file is the empty state, not an error.
    return EMPTY();
  }
}

async function write(db: Db): Promise<void> {
  if (REDIS_URL && REDIS_TOKEN) {
    await redis(["SET", REDIS_KEY, JSON.stringify(db)]);
    return;
  }
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(db, null, 2));
}

/**
 * Record a number as fraudulent. Idempotent per call: re-reporting the same
 * callId does not inflate the count, because a demo that is run five times
 * should not claim five independent victims.
 */
export async function recordSpamReport(input: {
  phoneNumber: string;
  callId: string;
  tactics: FraudTactic[];
}): Promise<SpamReport> {
  const db = await read();
  const now = new Date().toISOString();
  const existing = db.spam[input.phoneNumber];

  const report: SpamReport = existing
    ? {
        ...existing,
        reportCount: existing.callIds.includes(input.callId)
          ? existing.reportCount
          : existing.reportCount + 1,
        callIds: existing.callIds.includes(input.callId)
          ? existing.callIds
          : [...existing.callIds, input.callId],
        tactics: Array.from(new Set([...existing.tactics, ...input.tactics])),
        lastReportedAt: now,
      }
    : {
        phoneNumber: input.phoneNumber,
        reportCount: 1,
        callIds: [input.callId],
        tactics: input.tactics,
        firstReportedAt: now,
        lastReportedAt: now,
      };

  db.spam[input.phoneNumber] = report;
  await write(db);
  return report;
}

export async function getSpamReport(phoneNumber: string): Promise<SpamReport | null> {
  return (await read()).spam[phoneNumber] ?? null;
}

export async function listSpamReports(): Promise<SpamReport[]> {
  return Object.values((await read()).spam).sort((a, b) =>
    b.lastReportedAt.localeCompare(a.lastReportedAt),
  );
}

export async function recordEval(row: Omit<EvalRow, "submittedAt">): Promise<EvalStats> {
  const db = await read();
  db.evals.push({ ...row, submittedAt: new Date().toISOString() });
  await write(db);
  return statsFrom(db.evals);
}

export async function evalStats(): Promise<EvalStats> {
  return statsFrom((await read()).evals);
}

/**
 * The honest version of "model retrained".
 *
 * Gemini's weights cannot be updated from here, so kin feedback does two things
 * that are real: it scores the detector, and it moves the alert threshold. A
 * run of false alarms raises the bar for waking the family; a missed scam lowers
 * it. Labelled rows also accumulate as the eval set a fine-tune or a few-shot
 * prompt would need later.
 */
function statsFrom(rows: EvalRow[]): EvalStats {
  const total = rows.length;
  const correct = rows.filter((r) => r.kinVerdict === "correct").length;
  const falseAlarms = rows.filter((r) => r.kinVerdict === "false_alarm").length;
  const missedScams = rows.filter((r) => r.kinVerdict === "missed_scam").length;

  // Nudge the threshold by the imbalance, clamped so it can never silence the
  // alert entirely or fire on every call.
  const drift = total ? (falseAlarms - missedScams) / total : 0;
  const suggestedThreshold = Math.min(0.8, Math.max(0.25, 0.5 + drift * 0.2));

  return {
    total,
    correct,
    falseAlarms,
    missedScams,
    accuracy: total ? correct / total : null,
    suggestedThreshold: Number(suggestedThreshold.toFixed(2)),
  };
}
