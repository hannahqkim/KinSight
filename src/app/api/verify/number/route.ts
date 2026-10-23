import { parseBody, ok, handleError, nowIso } from "@/lib/http";
import { VerifyNumberRequest, NumberVerification } from "@/lib/schema";
import { lookupNumber, isInContacts, verdictFor } from "@/lib/registry";

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, VerifyNumberRequest);
    if ("response" in parsed) return parsed.response;
    const { phoneNumber, claimedCategory } = parsed.data;

    const lookup = await lookupNumber(phoneNumber);
    const verdict = verdictFor(lookup, claimedCategory);

    const data = NumberVerification.parse({
      phoneNumber,
      verdict,
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
      // Registry hits are deterministic; absence of evidence is weak evidence.
      confidence: lookup.match || lookup.spamReportCount > 0 ? 0.95 : 0.3,
      officialCallbackNumber: lookup.match?.officialCallbackNumber ?? null,
      checkedAt: nowIso(),
    });

    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
