/**
 * Gemini client + helpers shared by every route handler.
 *
 * The key is read lazily so that `next build` and unit tests do not need a
 * real credential — only an actual request does.
 */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key from https://aistudio.google.com/apikey",
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Fast path: call scoring, claim checks, transcription.
 *
 * Pinned rather than aliased because Google's own deprecation notice names this
 * model. Note that `gemini-3.5-transcribe` looks like the obvious choice for the
 * transcription route but rejects JSON mode ("JSON mode is not enabled for this
 * model"), and every route here depends on structured output.
 */
export const FAST_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

/**
 * Deep path: police report drafting, where quality beats latency.
 *
 * Aliased on purpose. The gemini-2.5-* pins this project started on were retired
 * mid-build ("no longer available to new users"); the alias survives that.
 */
export const DEEP_MODEL = process.env.GEMINI_MODEL_DEEP ?? "gemini-pro-latest";

/**
 * zod schema -> the JSON Schema dialect Gemini accepts.
 * Strips the keywords the API rejects and inlines nothing else.
 */
export function geminiSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "output", target: "draft-7" }) as Record<string, unknown>;
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "$schema" || k === "additionalProperties" || k === "default") continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(json) as Record<string, unknown>;
}

/**
 * Generate JSON and validate it against `schema`.
 * Throws if Gemini returns something the schema rejects — callers turn that
 * into an `upstream_error`, never into a silently wrong risk score.
 */
export async function generateStructured<T extends z.ZodTypeAny>({
  model,
  systemInstruction,
  prompt,
  schema,
  parts,
}: {
  model: string;
  systemInstruction: string;
  prompt: string;
  schema: T;
  parts?: Array<{ inlineData: { mimeType: string; data: string } }>;
}): Promise<z.infer<T>> {
  const response = await withRetry(() =>
    gemini().models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }, ...(parts ?? [])] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: geminiSchema(schema),
        temperature: 0.1,
      },
    }),
  );

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return schema.parse(JSON.parse(text));
}

/** Transient upstream failures seen in practice: 500 INTERNAL, 503 UNAVAILABLE,
 *  429 RESOURCE_EXHAUSTED. Anything else (404 retired model, 400 bad schema,
 *  403 bad key) is a real bug and must surface immediately, not after 3 waits. */
function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(429|500|503)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|Internal error|overloaded/i.test(
    message,
  );
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i === attempts - 1 || !isTransient(error)) throw error;
      // 400ms, 1200ms — enough for a blip, short enough for a live demo.
      await new Promise((resolve) => setTimeout(resolve, 400 * 3 ** i));
    }
  }
  throw lastError;
}
