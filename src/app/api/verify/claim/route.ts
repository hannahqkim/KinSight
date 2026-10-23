import { z } from "zod";
import { parseBody, ok, handleError, nowIso } from "@/lib/http";
import { VerifyClaimRequest, ClaimVerdict } from "@/lib/schema";
import { FAST_MODEL, generateStructured } from "@/lib/gemini";
import { lookupNumber } from "@/lib/registry";

const ModelOutput = z.object({ verdicts: z.array(ClaimVerdict) });

const SYSTEM = `You check factual claims a phone caller made to an older adult.

For each claim return one of:
- supported: the claim is consistent with the registry evidence provided.
- contradicted: the registry evidence says otherwise (e.g. caller claims to be the
  police but the number belongs to a different organization).
- unsupported: plausible but nothing backs it up.
- unverifiable: cannot be checked from a phone call at all.

Never mark a claim "supported" on the strength of the caller's own assertion.
Agencies do not ask for gift cards, wire transfers, crypto, or one-time codes —
treat any such demand as contradicting a claim of official authority.
Keep each evidence string to one sentence.`;

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, VerifyClaimRequest);
    if ("response" in parsed) return parsed.response;
    const { callId, claims, callerNumber } = parsed.data;

    const lookup = callerNumber ? await lookupNumber(callerNumber) : null;
    const registryEvidence = lookup?.match
      ? `Registry: ${callerNumber} is listed as "${lookup.match.name}" (${lookup.match.category}), source ${lookup.match.source}.`
      : lookup && lookup.spamReportCount > 0
        ? `Registry: ${callerNumber} appears on a fraud list with ${lookup.spamReportCount} reports.`
        : `Registry: no record for ${callerNumber ?? "an unknown number"}.`;

    const { verdicts } = await generateStructured({
      model: FAST_MODEL,
      systemInstruction: SYSTEM,
      prompt: [registryEvidence, "", "Claims to check:", ...claims.map((c, i) => `${i + 1}. ${c}`)].join("\n"),
      schema: ModelOutput,
    });

    return ok({ callId: callId ?? null, verdicts, checkedAt: nowIso() });
  } catch (error) {
    return handleError(error);
  }
}
