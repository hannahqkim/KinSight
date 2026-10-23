import { parseBody, ok, handleError, nowIso } from "@/lib/http";
import { ReportNumberRequest, NumberVerification } from "@/lib/schema";
import { lookupNumber, isInContacts, verdictFor } from "@/lib/registry";
import { recordSpamReport } from "@/lib/store";

/**
 * Write a number back to the spam database.
 *
 * Called when a call ends in a scam verdict. Deterministic, no model call —
 * the analysis already happened; this just records what it concluded, with a
 * timestamp, so the next household's lookup starts ahead.
 */
export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, ReportNumberRequest);
    if ("response" in parsed) return parsed.response;
    const { phoneNumber, callId, tactics } = parsed.data;

    const report = recordSpamReport({ phoneNumber, callId, tactics });

    // Re-read through the normal path so the client sees exactly what a fresh
    // /api/verify/number call would now return for this number.
    const lookup = lookupNumber(phoneNumber);
    const verification = NumberVerification.parse({
      phoneNumber,
      verdict: verdictFor(lookup),
      registryMatch: lookup.match
        ? {
            name: lookup.match.name,
            category: lookup.match.category,
            source: lookup.match.source,
            sourceUrl: lookup.match.sourceUrl,
          }
        : null,
      inContacts: isInContacts(phoneNumber),
      spamReportCount: lookup.spamReportCount,
      confidence: 0.95,
      officialCallbackNumber: lookup.match?.officialCallbackNumber ?? null,
      checkedAt: nowIso(),
    });

    return ok({ report, verification });
  } catch (error) {
    return handleError(error);
  }
}
