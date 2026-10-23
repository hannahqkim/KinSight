import { z } from "zod";
import { randomUUID } from "node:crypto";
import { parseBody, ok, handleError } from "@/lib/http";
import { TranscribeRequest, Transcript, TranscriptSegment } from "@/lib/schema";
import { FAST_MODEL, generateStructured } from "@/lib/gemini";

const ModelOutput = z.object({
  durationMs: z.number().int().nonnegative(),
  segments: z.array(TranscriptSegment),
});

const SYSTEM = `Transcribe this recorded phone call verbatim with speaker diarization.

- speaker "caller" is the inbound party; "user" is the older adult who answered.
  Use "unknown" only when the audio genuinely does not say.
- Transcribe exactly what was said, including hesitations and self-corrections.
  Downstream fraud scoring quotes these words as evidence — do not clean them up.
- Timestamps in milliseconds from the start of the recording.
- Spell out any phone numbers, dollar amounts, case numbers, and badge numbers
  as spoken.`;

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, TranscribeRequest);
    if ("response" in parsed) return parsed.response;
    const { callId, audioBase64, mimeType, language } = parsed.data;

    const result = await generateStructured({
      model: FAST_MODEL,
      systemInstruction: SYSTEM,
      prompt: `Transcribe the attached call audio. Expected language: ${language}.`,
      schema: ModelOutput,
      parts: [{ inlineData: { mimeType, data: audioBase64 } }],
    });

    return ok(
      Transcript.parse({
        transcriptId: randomUUID(),
        callId,
        language,
        durationMs: result.durationMs,
        segments: result.segments,
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}
