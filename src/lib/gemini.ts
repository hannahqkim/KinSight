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

/** Fast path: call scoring, claim checks, transcription. */
export const FAST_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
/** Slow path: police report drafting, where quality beats latency. */
export const DEEP_MODEL = process.env.GEMINI_MODEL_DEEP ?? "gemini-2.5-pro";

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
  const response = await gemini().models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }, ...(parts ?? [])] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: geminiSchema(schema),
      temperature: 0.1,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return schema.parse(JSON.parse(text));
}
