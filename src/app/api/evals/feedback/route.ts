import { parseBody, ok, handleError } from "@/lib/http";
import { EvalFeedbackRequest } from "@/lib/schema";
import { recordEval } from "@/lib/store";

/**
 * Human in the loop: the family member's verdict on the detector's verdict.
 *
 * Returns the updated stats, including where the kin-alert threshold should sit
 * given everything reported so far.
 */
export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, EvalFeedbackRequest);
    if ("response" in parsed) return parsed.response;

    return ok(recordEval(parsed.data));
  } catch (error) {
    return handleError(error);
  }
}
