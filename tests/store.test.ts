import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResultRow } from "pg";
import {
  getSpamReport,
  recordEval,
  recordSpamReport,
  type QueryExecutor,
} from "../src/lib/store.ts";

test("recordSpamReport upserts one call and returns the durable aggregate", async () => {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  const execute: QueryExecutor = async <Row extends QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ) => {
    calls.push({ text, values });
    if (text.includes("SELECT phone_number")) {
      return {
        rows: [
          {
            phone_number: "+12025550198",
            call_id: "call-1",
            tactics: ["urgency_pressure", "authority_impersonation"],
            reported_at: new Date("2026-10-23T12:00:00.000Z"),
          },
          {
            phone_number: "+12025550198",
            call_id: "call-2",
            tactics: ["urgency_pressure"],
            reported_at: new Date("2026-10-23T12:01:00.000Z"),
          },
        ] as unknown as Row[],
      };
    }
    return { rows: [] };
  };

  const report = await recordSpamReport(
    { phoneNumber: "+12025550198", callId: "call-2", tactics: ["urgency_pressure"] },
    execute,
  );

  assert.match(calls[0].text, /ON CONFLICT \(phone_number, call_id\)/);
  assert.deepEqual(calls[0].values, ["+12025550198", "call-2", '["urgency_pressure"]']);
  assert.equal(report.reportCount, 2);
  assert.deepEqual(report.callIds, ["call-1", "call-2"]);
  assert.deepEqual(report.tactics, ["urgency_pressure", "authority_impersonation"]);
});

test("getSpamReport returns null for a number that has never been reported", async () => {
  const execute: QueryExecutor = async () => ({ rows: [] });
  assert.equal(await getSpamReport("+12025550199", execute), null);
});

test("recordEval upserts feedback and calculates updated statistics", async () => {
  const calls: string[] = [];
  const execute: QueryExecutor = async <Row extends QueryResultRow>(text: string) => {
    calls.push(text);
    if (text.includes("SELECT call_id")) {
      return {
        rows: [
          {
            call_id: "call-1",
            phone_number: "+12025550198",
            model_probability: 0.9,
            model_risk_level: "likely_fraud",
            kin_verdict: "correct",
            notes: null,
            submitted_at: "2026-10-23T12:00:00.000Z",
          },
          {
            call_id: "call-2",
            phone_number: null,
            model_probability: 0.7,
            model_risk_level: "caution",
            kin_verdict: "false_alarm",
            notes: "Known caller",
            submitted_at: "2026-10-23T12:01:00.000Z",
          },
        ] as unknown as Row[],
      };
    }
    return { rows: [] };
  };

  const stats = await recordEval(
    {
      callId: "call-2",
      phoneNumber: null,
      modelProbability: 0.7,
      modelRiskLevel: "caution",
      kinVerdict: "false_alarm",
      notes: "Known caller",
    },
    execute,
  );

  assert.match(calls[0], /ON CONFLICT \(call_id\)/);
  assert.deepEqual(stats, {
    total: 2,
    correct: 1,
    falseAlarms: 1,
    missedScams: 0,
    accuracy: 0.5,
    suggestedThreshold: 0.6,
  });
});
