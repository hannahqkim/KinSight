import { parseBody, ok, handleError, nowIso } from "@/lib/http";
import { KinSummaryRequest, KinSummary } from "@/lib/schema";
import { FAST_MODEL, generateStructured } from "@/lib/gemini";

/** The model writes the body; the server owns the id and timestamp. */
const ModelOutput = KinSummary.omit({ callId: true, generatedAt: true });

const SYSTEM = `You write the message a family member receives when KinSight has
flagged a call to their older relative.

- Write to the family member about their relative, never to the elder.
- headline: one line, as it would appear on a lock screen. Say what happened and
  who it involves. No alarm words beyond what the facts carry.
- whatHappened: two or three sentences. What the caller claimed, what they asked
  for, and whether anything was given up. If nothing was lost, say so plainly in
  the first sentence — that is the thing the reader most needs to know.
- whatToDo: two or three concrete steps for the family member. Calling their
  relative to check on them comes before any paperwork.
- Never imply the elder did something foolish. They were targeted, and they
  hung up.`;

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, KinSummaryRequest);
    if ("response" in parsed) return parsed.response;
    const { callId, transcript, analysis, elderName } = parsed.data;

    const summary = await generateStructured({
      model: FAST_MODEL,
      systemInstruction: SYSTEM,
      prompt: [
        `Relative: ${elderName ?? "your relative"}`,
        `Caller number: ${analysis.callerNumber ?? "withheld / unknown"}`,
        `Scam probability: ${analysis.fraudProbability} (${analysis.riskLevel})`,
        `Tactics detected: ${analysis.signals.map((s) => s.tactic).join(", ") || "none"}`,
        "",
        "Transcript:",
        transcript.segments.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
      ].join("\n"),
      schema: ModelOutput,
    });

    return ok(KinSummary.parse({ ...summary, callId, generatedAt: nowIso() }));
  } catch (error) {
    return handleError(error);
  }
}
