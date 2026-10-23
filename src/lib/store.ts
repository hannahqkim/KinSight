/** PostgreSQL-backed durable state for scam reports and kin feedback. */
import type { QueryResultRow } from "pg";
import type { EvalStats, EvalVerdict, FraudTactic, SpamReport } from "./schema.ts";
import { queryDatabase } from "./db.ts";

type EvalRow = {
  callId: string;
  phoneNumber: string | null;
  modelProbability: number;
  modelRiskLevel: string;
  kinVerdict: EvalVerdict;
  notes: string | null;
  submittedAt: string;
};

type SpamRow = QueryResultRow & {
  phone_number: string;
  call_id: string;
  tactics: FraudTactic[];
  reported_at: Date | string;
};

type StoredEvalRow = QueryResultRow & {
  call_id: string;
  phone_number: string | null;
  model_probability: number;
  model_risk_level: string;
  kin_verdict: EvalVerdict;
  notes: string | null;
  submitted_at: Date | string;
};

export type QueryExecutor = <Row extends QueryResultRow>(
  text: string,
  values?: readonly unknown[],
) => Promise<{ rows: Row[] }>;

const executeDatabaseQuery: QueryExecutor = (text, values) => queryDatabase(text, values);

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function reportFromRows(phoneNumber: string, rows: SpamRow[]): SpamReport | null {
  if (rows.length === 0) return null;

  return {
    phoneNumber,
    reportCount: rows.length,
    callIds: rows.map((row) => row.call_id),
    tactics: Array.from(new Set(rows.flatMap((row) => row.tactics))),
    firstReportedAt: iso(rows[0].reported_at),
    lastReportedAt: iso(rows.at(-1)!.reported_at),
  };
}

/** Record one scam report. Replaying the same phone/call pair is idempotent. */
export async function recordSpamReport(
  input: { phoneNumber: string; callId: string; tactics: FraudTactic[] },
  execute: QueryExecutor = executeDatabaseQuery,
): Promise<SpamReport> {
  await execute(
    `INSERT INTO spam_call_reports (phone_number, call_id, tactics)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (phone_number, call_id)
     DO UPDATE SET tactics = EXCLUDED.tactics`,
    [input.phoneNumber, input.callId, JSON.stringify(input.tactics)],
  );

  const report = await getSpamReport(input.phoneNumber, execute);
  if (!report) throw new Error("spam report was not available after it was recorded");
  return report;
}

export async function getSpamReport(
  phoneNumber: string,
  execute: QueryExecutor = executeDatabaseQuery,
): Promise<SpamReport | null> {
  const { rows } = await execute<SpamRow>(
    `SELECT phone_number, call_id, tactics, reported_at
     FROM spam_call_reports
     WHERE phone_number = $1
     ORDER BY reported_at ASC, call_id ASC`,
    [phoneNumber],
  );
  return reportFromRows(phoneNumber, rows);
}

export async function listSpamReports(
  execute: QueryExecutor = executeDatabaseQuery,
): Promise<SpamReport[]> {
  const { rows } = await execute<SpamRow>(
    `SELECT phone_number, call_id, tactics, reported_at
     FROM spam_call_reports
     ORDER BY phone_number ASC, reported_at ASC, call_id ASC`,
  );
  const grouped = Map.groupBy(rows, (row) => row.phone_number);

  return Array.from(grouped, ([phoneNumber, reports]) => reportFromRows(phoneNumber, reports)!)
    .sort((a, b) => b.lastReportedAt.localeCompare(a.lastReportedAt));
}

export async function recordEval(
  row: Omit<EvalRow, "submittedAt">,
  execute: QueryExecutor = executeDatabaseQuery,
): Promise<EvalStats> {
  await execute(
    `INSERT INTO eval_feedback
       (call_id, phone_number, model_probability, model_risk_level, kin_verdict, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (call_id) DO UPDATE SET
       phone_number = EXCLUDED.phone_number,
       model_probability = EXCLUDED.model_probability,
       model_risk_level = EXCLUDED.model_risk_level,
       kin_verdict = EXCLUDED.kin_verdict,
       notes = EXCLUDED.notes,
       submitted_at = NOW()`,
    [
      row.callId,
      row.phoneNumber,
      row.modelProbability,
      row.modelRiskLevel,
      row.kinVerdict,
      row.notes,
    ],
  );
  return evalStats(execute);
}

export async function evalStats(
  execute: QueryExecutor = executeDatabaseQuery,
): Promise<EvalStats> {
  const { rows } = await execute<StoredEvalRow>(
    `SELECT call_id, phone_number, model_probability, model_risk_level,
            kin_verdict, notes, submitted_at
     FROM eval_feedback
     ORDER BY submitted_at ASC, call_id ASC`,
  );

  return statsFrom(
    rows.map((row) => ({
      callId: row.call_id,
      phoneNumber: row.phone_number,
      modelProbability: row.model_probability,
      modelRiskLevel: row.model_risk_level,
      kinVerdict: row.kin_verdict,
      notes: row.notes,
      submittedAt: iso(row.submitted_at),
    })),
  );
}

/** Derive detector quality and an alert-threshold suggestion from kin labels. */
function statsFrom(rows: EvalRow[]): EvalStats {
  const total = rows.length;
  const correct = rows.filter((row) => row.kinVerdict === "correct").length;
  const falseAlarms = rows.filter((row) => row.kinVerdict === "false_alarm").length;
  const missedScams = rows.filter((row) => row.kinVerdict === "missed_scam").length;
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
