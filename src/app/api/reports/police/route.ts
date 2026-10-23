import { randomUUID } from "node:crypto";
import { parseBody, ok, handleError, nowIso } from "@/lib/http";
import { PoliceReportRequest, PoliceReport } from "@/lib/schema";
import { DEEP_MODEL, generateStructured } from "@/lib/gemini";

/** The model drafts the narrative; the server owns ids and timestamps. */
const ModelOutput = PoliceReport.omit({
  reportId: true,
  callId: true,
  generatedAt: true,
});

const SYSTEM = `You draft an incident report an older adult can file with local police
or the FTC after a suspected fraud call.

- Write in the third person, past tense, factual. No speculation, no adjectives
  about the suspect's character.
- The markdown body must contain, in order: Reporting Party, Incident Summary,
  Timeline of the Call, Suspect Information, Requests Made by Suspect, Financial
  Loss, Evidence Retained, Requested Action.
- Quote the suspect directly where the transcript supports it. Mark anything the
  victim could not confirm as "reported by the caller, unverified".
- Leave unknown fields as null rather than guessing. A report with gaps is filable;
  a report with invented facts is not.
- recommendedAgencies: always include the FTC (reportfraud.ftc.gov) and the FBI
  IC3 (ic3.gov) when money was lost, plus the local police non-emergency line.`;

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, PoliceReportRequest);
    if ("response" in parsed) return parsed.response;
    const { callId, transcript, analysis, reporter, financialLossCents } = parsed.data;

    const prompt = [
      `Reporting party: ${JSON.stringify(reporter ?? {})}`,
      `Financial loss (cents): ${financialLossCents ?? "none reported"}`,
      `Caller number: ${analysis.callerNumber ?? "withheld / unknown"}`,
      `Fraud probability: ${analysis.fraudProbability} (${analysis.riskLevel})`,
      `Claimed caller category: ${analysis.claimedCategory}`,
      `Detected tactics: ${analysis.signals.map((s) => s.tactic).join(", ") || "none"}`,
      "",
      "Transcript:",
      transcript.segments.map((s) => `[${s.startMs}ms] ${s.speaker}: ${s.text}`).join("\n"),
    ].join("\n");

    const draft = await generateStructured({
      model: DEEP_MODEL,
      systemInstruction: SYSTEM,
      prompt,
      schema: ModelOutput,
    });

    return ok(
      PoliceReport.parse({
        ...draft,
        reportId: randomUUID(),
        callId,
        financialLossCents: financialLossCents ?? null,
        generatedAt: nowIso(),
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}
