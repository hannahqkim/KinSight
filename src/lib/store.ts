/**
 * Durable state for the feedback loop: the spam database and the evals log.
 *
 * A JSON file, not a database. It exists so the loop on the whiteboard is real
 * rather than mimed — a number reported during the demo is still flagged after
 * a restart, and the kin's feedback is still counted. Swap this module for
 * Postgres (or Firestore) and nothing above it changes.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EvalStats, EvalVerdict, FraudTactic, SpamReport } from "@/lib/schema";

const FILE = join(process.cwd(), ".data", "kinsight.json");

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

function read(): Db {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as Db;
  } catch {
    // Missing or unreadable file is the empty state, not an error.
    return { spam: {}, evals: [] };
  }
}

function write(db: Db): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(db, null, 2));
}

/**
 * Record a number as fraudulent. Idempotent per call: re-reporting the same
 * callId does not inflate the count, because a demo that is run five times
 * should not claim five independent victims.
 */
export function recordSpamReport(input: {
  phoneNumber: string;
  callId: string;
  tactics: FraudTactic[];
}): SpamReport {
  const db = read();
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
  write(db);
  return report;
}

export function getSpamReport(phoneNumber: string): SpamReport | null {
  return read().spam[phoneNumber] ?? null;
}

export function listSpamReports(): SpamReport[] {
  return Object.values(read().spam).sort((a, b) =>
    b.lastReportedAt.localeCompare(a.lastReportedAt),
  );
}

export function recordEval(row: Omit<EvalRow, "submittedAt">): EvalStats {
  const db = read();
  db.evals.push({ ...row, submittedAt: new Date().toISOString() });
  write(db);
  return statsFrom(db.evals);
}

export function evalStats(): EvalStats {
  return statsFrom(read().evals);
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
