import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldAlertForRisk } from "../src/lib/alerts.ts";
import { AnalyzeCallResponse } from "../src/lib/schema.ts";
import type { CallAnalysis, RiskLevel } from "../src/lib/schema.ts";

const cases: Array<{ riskLevel: RiskLevel; expected: boolean }> = [
  { riskLevel: "safe", expected: false },
  { riskLevel: "caution", expected: false },
  { riskLevel: "likely_fraud", expected: true },
  { riskLevel: "critical", expected: true },
];

for (const { riskLevel, expected } of cases) {
  test(`shouldAlert is ${expected} for ${riskLevel}`, () => {
    const mockedAnalysis = { riskLevel } satisfies Pick<CallAnalysis, "riskLevel">;
    const response = AnalyzeCallResponse.parse({
      ok: true,
      data: {
        callId: "call-test",
        callerNumber: null,
        fraudProbability: expected ? 0.9 : 0.1,
        riskLevel,
        shouldAlert: shouldAlertForRisk(mockedAnalysis.riskLevel),
        claimedCategory: "unknown",
        signals: [],
        extractedClaims: [],
        plainLanguageWarning: "Test warning.",
        suggestedQuestions: [],
        recommendedAction: expected ? "hang_up" : "no_action",
        modelVersion: "mock-model",
        analyzedAt: "2026-10-23T12:00:00.000Z",
      },
    });

    assert.equal(response.data.shouldAlert, expected);
  });
}
