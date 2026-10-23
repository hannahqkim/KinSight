import { z } from "zod";
import { parseBody, ok, handleError, nowIso } from "@/lib/http";
import { AnalyzeCallRequest, CallAnalysis, CallerCategory, FraudSignal } from "@/lib/schema";
import { FAST_MODEL, generateStructured } from "@/lib/gemini";
import { shouldAlertForRisk } from "@/lib/alerts";

/** What the model produces. The server owns callId, modelVersion, analyzedAt. */
const ModelOutput = CallAnalysis.omit({
  callId: true,
  callerNumber: true,
  shouldAlert: true,
  modelVersion: true,
  analyzedAt: true,
}).extend({
  claimedCategory: CallerCategory,
  signals: z.array(FraudSignal),
});

const SYSTEM = `You are KinSight's fraud analyst. You score phone calls received by
independent older adults for the probability that the caller is running a scam.

Rules:
- Score only on what is in the transcript. Do not invent details.
- A legitimate caller can sound urgent; urgency alone is not fraud. Fraud is the
  combination of pressure, an unverifiable identity, and a request for money,
  credentials, remote access, or secrecy.
- Deliveries, doctors' offices, family, and real police do call older adults.
  Scoring a real caller as fraud has a cost: it isolates the person. Be calibrated.
- Every signal you emit must quote the exact words from the transcript as evidence.
- plainLanguageWarning: one short sentence, 6th-grade reading level, second person,
  no jargon. If the call looks safe, say so plainly.
- Escalate recommendedAction to report_to_authorities only when money or credentials
  have already changed hands.
- suggestedQuestions: two or three things to ask the caller right now, written in
  the user's own voice ("Can you give me your case number?"). Shortest first. Pick
  questions a legitimate caller answers easily and a scammer cannot. If the call
  looks safe, return an empty list rather than manufacturing suspicion.
- If a family code is available, and the caller claims to be a relative or close
  contact, make asking for it the FIRST suggested question, worded as "What's our
  family code?". The app calls it the KinCode on screen, but the question is said
  out loud to the caller, who may not know that name. Never call it a "safe word"
  or "password". ("Safe word" carries a sexual meaning for many adults, and
  "password" is the thing she must never give out to a caller.) You are never told
  what the code is and must not guess.
- Refer to the caller as "the caller" or "they", never "he" or "she". Nothing in
  a phone call tells you who is actually on the line.`;

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, AnalyzeCallRequest);
    if ("response" in parsed) return parsed.response;
    const { callId, text, segments, callerNumber, inContacts, partial, safeWordAvailable } =
      parsed.data;

    const transcriptText =
      text ?? (segments ?? []).map((s) => `${s.speaker}: ${s.text}`).join("\n");

    const prompt = [
      `Caller number: ${callerNumber ?? "withheld / unknown"}`,
      `In the user's contacts: ${inContacts ? "yes" : "no"}`,
      `Family code available: ${safeWordAvailable ? "yes" : "no"}`,
      partial ? "This call is STILL IN PROGRESS — score what is available so far." : "",
      "",
      "Transcript:",
      transcriptText,
    ]
      .filter(Boolean)
      .join("\n");

    const analysis = await generateStructured({
      model: FAST_MODEL,
      systemInstruction: SYSTEM,
      prompt,
      schema: ModelOutput,
    });

    return ok(
      CallAnalysis.parse({
        ...analysis,
        callId,
        callerNumber,
        shouldAlert: shouldAlertForRisk(analysis.riskLevel),
        modelVersion: FAST_MODEL,
        analyzedAt: nowIso(),
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}
