/** Request parsing + envelope helpers so every route answers the same shape. */
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ApiError } from "@/lib/schema";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true as const, data }, { status });
}

export function fail(
  code: ApiError["error"]["code"],
  message: string,
  details?: unknown,
  status = 400,
) {
  return NextResponse.json({ ok: false as const, error: { code, message, details } }, { status });
}

/** Parse a JSON body against `schema`, or return a 400 envelope. */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: fail("bad_request", "body must be valid JSON") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: fail("bad_request", "request failed schema validation", parsed.error.issues),
    };
  }
  return { data: parsed.data };
}

/** Map a thrown error onto the envelope without leaking internals. */
export function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "unexpected error";
  if (message.includes("GEMINI_API_KEY")) return fail("internal_error", message, undefined, 500);
  console.error("[kinsight]", error);
  return fail("upstream_error", message, undefined, 502);
}

export const nowIso = () => new Date().toISOString();
