"use client";

import { useCallback, useRef, useState } from "react";
import type { AudioChunk, AudioSource } from "@/lib/audio-sources";
import type {
  CallAnalysis,
  NumberVerification,
  PoliceReport,
  Transcript,
  TranscriptSegment,
} from "@/lib/schema";

export type SessionStatus = "idle" | "listening" | "stopped";

type StartOptions = {
  source: AudioSource;
  callerNumber: string | null;
  inContacts: boolean;
  safeWordAvailable: boolean;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error?.message ?? `${path} failed`);
  return json.data as T;
}

/**
 * Drives one call: audio in, risk score out.
 *
 * Chunks are queued and drained serially. Recording is deliberately NOT blocked
 * on the model round-trip — if analysis falls behind, audio keeps being captured
 * and the queue catches up, rather than the call developing holes.
 */
export function useCallSession() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const [verification, setVerification] = useState<NumberVerification | null>(null);
  const [report, setReport] = useState<PoliceReport | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const callIdRef = useRef<string>("");
  const sourceRef = useRef<AudioSource | null>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const queueRef = useRef<AudioChunk[]>([]);
  const drainingRef = useRef(false);
  const optionsRef = useRef<StartOptions | null>(null);

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;

    while (queueRef.current.length) {
      const chunk = queueRef.current.shift()!;
      try {
        const transcript = await postJson<Transcript>("/api/transcribe", {
          callId: callIdRef.current,
          audioBase64: chunk.base64,
          mimeType: chunk.mimeType,
          language: "en-US",
        });

        const shifted = transcript.segments.map((segment) => ({
          ...segment,
          startMs: segment.startMs + chunk.offsetMs,
          endMs: segment.endMs + chunk.offsetMs,
        }));
        if (!shifted.length) continue;

        segmentsRef.current = [...segmentsRef.current, ...shifted];
        setSegments(segmentsRef.current);

        const options = optionsRef.current;
        const next = await postJson<CallAnalysis>("/api/calls/analyze", {
          callId: callIdRef.current,
          segments: segmentsRef.current,
          callerNumber: options?.callerNumber ?? null,
          inContacts: options?.inContacts ?? false,
          safeWordAvailable: options?.safeWordAvailable ?? false,
          partial: true,
        });
        setAnalysis(next);
        setError(null);
      } catch (cause) {
        // One bad window must not end the call. Surface it and keep listening.
        setError(cause instanceof Error ? cause.message : "analysis failed");
      } finally {
        setPending((n) => Math.max(0, n - 1));
      }
    }

    drainingRef.current = false;
  }, []);

  const start = useCallback(
    async (options: StartOptions) => {
      callIdRef.current = `call-${Date.now()}`;
      segmentsRef.current = [];
      queueRef.current = [];
      optionsRef.current = options;
      sourceRef.current = options.source;

      setSegments([]);
      setAnalysis(null);
      setVerification(null);
      setReport(null);
      setError(null);
      setPending(0);
      setStatus("listening");

      // Registry lookup is deterministic and has no model call, so it lands
      // well before the first transcript window.
      if (options.callerNumber) {
        postJson<NumberVerification>("/api/verify/number", {
          phoneNumber: options.callerNumber,
        })
          .then(setVerification)
          .catch(() => undefined);
      }

      await options.source.start((chunk) => {
        queueRef.current.push(chunk);
        setPending((n) => n + 1);
        void drain();
      });
    },
    [drain],
  );

  const stop = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    setStatus("stopped");
  }, []);

  const generateReport = useCallback(async () => {
    if (!analysis) return;
    const transcript: Transcript = {
      transcriptId: `t-${callIdRef.current}`,
      callId: callIdRef.current,
      language: "en-US",
      durationMs: segmentsRef.current.at(-1)?.endMs ?? 0,
      segments: segmentsRef.current,
    };
    try {
      setReport(await postJson<PoliceReport>("/api/reports/police", {
        callId: callIdRef.current,
        transcript,
        analysis,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "report failed");
    }
  }, [analysis]);

  const reset = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    segmentsRef.current = [];
    queueRef.current = [];
    setStatus("idle");
    setSegments([]);
    setAnalysis(null);
    setVerification(null);
    setReport(null);
    setPending(0);
    setError(null);
  }, []);

  return {
    status,
    segments,
    analysis,
    verification,
    report,
    pending,
    error,
    start,
    stop,
    reset,
    generateReport,
  };
}
