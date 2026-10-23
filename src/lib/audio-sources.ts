/**
 * Audio sources for a call session.
 *
 * Both sources emit the same `AudioChunk` shape, so everything downstream — the
 * transcribe/analyze pipeline, the UI — cannot tell them apart. The scripted
 * source is not a mock of the demo; it is the same pipeline with a different
 * microphone.
 */

export type AudioChunk = {
  base64: string;
  mimeType: string;
  /** Milliseconds from the start of the call, for transcript ordering. */
  offsetMs: number;
  durationMs: number;
};

export interface AudioSource {
  start(onChunk: (chunk: AudioChunk) => void): Promise<void>;
  stop(): void;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Chunked to avoid blowing the argument limit on large recordings.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Pick a container the browser can record AND the API accepts. */
function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

/** Normalise "audio/webm;codecs=opus" -> "audio/webm" for the API enum. */
function baseMime(type: string): string {
  return type.split(";")[0];
}

/**
 * Live microphone.
 *
 * The recorder is restarted every window rather than using a timeslice: chunks
 * from a timeslice after the first carry no container header and will not decode
 * on their own. Restarting costs a few milliseconds of audio at each boundary and
 * buys us chunks that are each a complete, standalone file.
 */
export class MicSource implements AudioSource {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private offsetMs = 0;

  constructor(private readonly windowMs = 8000) {}

  async start(onChunk: (chunk: AudioChunk) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    this.running = true;
    const mimeType = pickMimeType();

    const cycle = () => {
      if (!this.running || !this.stream) return;
      const recorder = new MediaRecorder(this.stream, { mimeType });
      this.recorder = recorder;
      const startedAt = this.offsetMs;

      recorder.ondataavailable = async (event) => {
        if (!event.data.size) return;
        onChunk({
          base64: await blobToBase64(event.data),
          mimeType: baseMime(mimeType),
          offsetMs: startedAt,
          durationMs: this.windowMs,
        });
      };
      recorder.onstop = () => {
        this.offsetMs = startedAt + this.windowMs;
        cycle();
      };

      recorder.start();
      this.timer = setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, this.windowMs);
    };

    cycle();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

export type ScriptedSegment = { url: string; text: string; durationMs: number };

/**
 * Pre-recorded call, played out loud through `audioEl` so the room hears it
 * while the same bytes go to the API. The fallback when the venue's wifi, the
 * room noise, or a denied microphone permission would otherwise end the demo.
 */
export class ScriptedSource implements AudioSource {
  private running = false;

  constructor(
    private readonly segments: ScriptedSegment[],
    private readonly audioEl: HTMLAudioElement | null,
  ) {}

  async start(onChunk: (chunk: AudioChunk) => void): Promise<void> {
    this.running = true;
    let offsetMs = 0;

    for (const segment of this.segments) {
      if (!this.running) return;

      const response = await fetch(segment.url);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      // Send and play at the same instant, so the number on screen tracks what
      // the room is hearing.
      onChunk({ base64, mimeType: "audio/wav", offsetMs, durationMs: segment.durationMs });

      if (this.audioEl) {
        this.audioEl.src = segment.url;
        await this.audioEl.play().catch(() => undefined);
        await new Promise<void>((resolve) => {
          const done = () => {
            this.audioEl?.removeEventListener("ended", done);
            resolve();
          };
          this.audioEl?.addEventListener("ended", done);
          // Belt and braces: never hang the demo on a missing "ended" event.
          setTimeout(done, segment.durationMs + 1500);
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, segment.durationMs));
      }

      offsetMs += segment.durationMs;
    }
  }

  stop(): void {
    this.running = false;
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute("src");
    }
  }
}
