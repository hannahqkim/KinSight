"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ReportBody } from "@/components/ReportBody";
import { ListeningWave, RiskMeter } from "@/components/RiskMeter";
import { KinPanel } from "@/components/KinPanel";
import { MicSource, ScriptedSource, type ScriptedSegment } from "@/lib/audio-sources";
import { useCallSession } from "@/lib/use-call-session";
import { BRAND, KIN_ALERT_THRESHOLD, TACTIC_LABEL, ZONE, zoneFor } from "@/lib/risk";

type Scenario = {
  id: string;
  label: string;
  blurb: string;
  callerNumber: string;
  inContacts: boolean;
  segments: ScriptedSegment[];
};

type Screen = "setup" | "incoming" | "listening" | "ask" | "verdict" | "report";
type Mode = "live" | "scripted";

const SAFE_WORD_KEY = "kinsight.safeWord";

/**
 * The stored safe word is client-only state. Reading it through
 * useSyncExternalStore (rather than in an effect) gives the server and the
 * hydrating client the same empty snapshot, so there is no mismatch.
 */
const neverChanges = () => () => {};
const readStoredSafeWord = () => {
  try {
    return localStorage.getItem(SAFE_WORD_KEY) ?? "";
  } catch {
    return "";
  }
};
const noSafeWordOnServer = () => "";

const LABEL = "text-[13px] font-medium uppercase tracking-[0.06em]";
const BTN = "w-full font-bold font-[inherit]";

function IconWarning() {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={BRAND.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5 L22.5 20.5 H1.5 Z" />
      <path d="M12 9.5 V14" />
      <path d="M12 17.5 V17.6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={BRAND.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M7.5 12.5 L10.5 15.5 L16.5 9" />
    </svg>
  );
}

function IconQuestion() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={BRAND.slate} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9.5 C9.5 6.5, 14.5 6.5, 14.5 9.5 C14.5 11.5, 12 11.5, 12 14" />
      <path d="M12 17.5 V17.6" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={BRAND.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4 H9 L11 9 L8.5 10.5 C9.5 12.5 11.5 14.5 13.5 15.5 L15 13 L20 15 V19 C20 20 19 21 18 21 C10 20.5 3.5 14 3 6 C3 5 4 4 5 4 Z" />
    </svg>
  );
}

export default function Page() {
  const persistedSafeWord = useSyncExternalStore(
    neverChanges,
    readStoredSafeWord,
    noSafeWordOnServer,
  );
  const [safeWordOverride, setSafeWordOverride] = useState<string | null>(null);
  const safeWord = safeWordOverride ?? persistedSafeWord;

  const [screenOverride, setScreenOverride] = useState<Screen | null>(null);
  const screen = screenOverride ?? (safeWord ? "incoming" : "setup");
  const setScreen = setScreenOverride;

  const [safeWordInput, setSafeWordInput] = useState("");
  const [revealWord, setRevealWord] = useState(false);
  const [safeWordFailed, setSafeWordFailed] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("scripted");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState("grandparent-scam");
  const [micError, setMicError] = useState<string | null>(null);
  const [kinJoined, setKinJoined] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const session = useCallSession();
  const scenario = useMemo(
    () => scenarios.find((s) => s.id === scenarioId) ?? scenarios[0] ?? null,
    [scenarios, scenarioId],
  );

  useEffect(() => {
    fetch("/demo/manifest.json")
      .then((r) => r.json())
      .then(setScenarios)
      .catch(() => undefined);
  }, []);

  const startCall = useCallback(
    async (requested: Mode) => {
      if (!scenario) return;
      setMicError(null);
      setSafeWordFailed(false);
      setQuestionIndex(0);
      setKinJoined(false);
      setCallEnded(false);
      setMode(requested);
      setScreen("listening");

      const source =
        requested === "live"
          ? new MicSource(8000)
          : new ScriptedSource(scenario.segments, audioRef.current);

      try {
        await session.start({
          source,
          callerNumber: scenario.callerNumber,
          inContacts: scenario.inContacts,
          safeWordAvailable: Boolean(safeWord),
        });
      } catch (cause) {
        setMicError(cause instanceof Error ? cause.message : "could not start audio");
      }
    },
    [scenario, session, safeWord, setScreen],
  );

  // One keystroke to recover a dying demo: S drops to the scripted call.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        session.stop();
        void startCall("scripted");
      } else if (key === "l") {
        session.stop();
        void startCall("live");
      } else if (key === "r") {
        session.reset();
        setScreen("incoming");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, startCall, setScreen]);

  const { analysis, verification, segments, report, pending, error } = session;
  const zone = safeWordFailed ? "scam" : zoneFor(analysis?.riskLevel ?? null);
  const zoneStyle = ZONE[zone];

  const questions = analysis?.suggestedQuestions ?? [];
  const question = questions[questionIndex % Math.max(1, questions.length)] ?? null;

  const lines = segments.map((s) => s.text);
  const currentLine = lines.at(-1) ?? null;
  const previousLine = lines.at(-2) ?? null;
  const tactics = analysis?.signals.slice(0, 3) ?? [];

  /** Above the threshold the family is notified — the ★ trigger on the board. */
  const kinAlerted =
    (analysis?.fraudProbability ?? 0) >= KIN_ALERT_THRESHOLD || safeWordFailed;

  /**
   * Ending the call is where the loop closes: the number goes back to the spam
   * database and the family gets their summary. Both only fire on a scam
   * verdict — a legitimate call must never be written to a fraud list.
   */
  const finish = (failedSafeWord: boolean) => {
    const finalZone = failedSafeWord ? "scam" : zoneFor(analysis?.riskLevel ?? null);
    if (failedSafeWord) setSafeWordFailed(true);
    session.stop();
    setCallEnded(true);
    setScreen("verdict");
    if (finalZone === "scam") {
      void session.reportNumber();
      void session.generateKinSummary();
    }
  };

  const endCall = () => finish(false);

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-neutral-950 p-8 lg:flex-row lg:items-start lg:justify-center">
      <audio ref={audioRef} className="hidden" />

      <PhoneFrame
        background={
          screen === "incoming"
            ? BRAND.slate
            : screen === "ask"
              ? BRAND.banana
              : screen === "verdict"
                ? zone === "scam"
                  ? BRAND.peach
                  : BRAND.teal
                : BRAND.white
        }
        foreground={
          screen === "incoming" || (screen === "verdict" && zone !== "ask")
            ? BRAND.white
            : BRAND.slate
        }
      >
        {/* S1 — family setup */}
        {screen === "setup" && (
          <div className="flex h-full flex-col gap-6 px-6 pb-8 pt-6">
            <div className={LABEL}>Step 2 of 4</div>
            <div className="flex gap-1.5">
              {[BRAND.slate, BRAND.slate, BRAND.horizon, BRAND.horizon].map((c, i) => (
                <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: c }} />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <h1 className="text-[40px] font-black leading-[0.95] tracking-[-0.05em]">
                Choose a family safe word.
              </h1>
              <p className="text-[18px] font-medium leading-[1.45]">
                KinSight will remind Mom to ask for it when a caller says they&apos;re family.
                Pick it together.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="sw" className={LABEL}>Safe word</label>
              <input
                id="sw"
                value={safeWordInput}
                onChange={(e) => setSafeWordInput(e.target.value)}
                placeholder="Blueberry pancakes"
                className="h-[60px] rounded-[14px] px-4 text-[20px] font-medium outline-none"
                style={{ border: `2px solid ${BRAND.slate}`, color: BRAND.slate }}
              />
              <div className="text-[15px] font-medium">
                Easy to say, hard to guess. It stays on this phone — never sent to our
                servers, never shown to the AI.
              </div>
            </div>
            <div className="flex-grow" />
            <button
              disabled={!safeWordInput.trim()}
              onClick={() => {
                const word = safeWordInput.trim();
                setSafeWordOverride(word);
                try {
                  localStorage.setItem(SAFE_WORD_KEY, word);
                } catch {
                  // Not fatal — the word simply will not survive a reload.
                }
                setScreen("incoming");
              }}
              className={`${BTN} h-16 rounded-[18px] text-[19px] disabled:opacity-30`}
              style={{ background: BRAND.slate, color: BRAND.white }}
            >
              Next: trusted contacts
            </button>
          </div>
        )}

        {/* S2 — unknown caller */}
        {screen === "incoming" && scenario && (
          <div className="flex h-full flex-col gap-5 px-5 pb-8 pt-6">
            <div
              className="flex flex-col gap-1.5 rounded-[22px] p-[18px]"
              style={{ background: BRAND.white, color: BRAND.slate }}
            >
              <div className={LABEL}>KinSight · now</div>
              <div className="text-[20px] font-extrabold leading-tight tracking-[-0.03em]">
                Unknown number calling
              </div>
              <div className="text-[17px] font-medium leading-[1.35]">
                Tap here before you answer. I&apos;ll listen with you.
              </div>
            </div>

            <div className="flex flex-grow flex-col items-center justify-center gap-3.5 text-center">
              <div
                className="flex h-[120px] w-[120px] items-center justify-center rounded-full"
                style={{ background: BRAND.horizon }}
              >
                <IconPhone />
              </div>
              <div className="text-[38px] font-black leading-none tracking-[-0.045em]">
                {scenario.callerNumber}
              </div>
              <div className={LABEL}>
                {scenario.inContacts ? "In your contacts" : "Not in your contacts"}
              </div>
            </div>

            <div
              className="rounded-[18px] p-4 text-[18px] font-medium leading-[1.4]"
              style={{ border: `2px solid ${BRAND.horizon}` }}
            >
              Answer on speaker so KinSight can hear the caller too.
            </div>

            <button
              onClick={() => startCall(mode)}
              className={`${BTN} h-[72px] rounded-[20px] text-[21px] tracking-[-0.02em]`}
              style={{ background: BRAND.banana, color: BRAND.slate }}
            >
              Answer with KinSight
            </button>
          </div>
        )}

        {/* S3 — listening */}
        {screen === "listening" && (
          <div className="flex h-full flex-col gap-4 px-6 pb-8 pt-5">
            <div className="flex items-center gap-3">
              <ListeningWave active={pending > 0 || !analysis} />
              <div className={LABEL}>Listening with you</div>
            </div>

            <RiskMeter
              probability={analysis?.fraudProbability ?? null}
              zone={zone}
              listening={pending > 0 || !analysis}
            />

            <div
              className="flex min-h-[124px] shrink-0 flex-col gap-2 rounded-[18px] px-[18px] py-4"
              style={{ border: `2px solid ${BRAND.slate}` }}
            >
              <div className={LABEL}>The caller is saying</div>
              {previousLine && (
                <p
                  className="m-0 text-[16px] font-medium leading-[1.4]"
                  style={{ color: BRAND.horizon }}
                >
                  {previousLine}
                </p>
              )}
              <p className="m-0 text-[21px] font-bold leading-[1.35] tracking-[-0.01em]">
                {currentLine ?? "…"}
              </p>
              {tactics[0] && (
                <div
                  className="self-start rounded-full px-3 py-[5px] text-[13px] font-bold uppercase tracking-[0.04em]"
                  style={{ background: BRAND.banana, color: BRAND.slate }}
                >
                  Heard: {TACTIC_LABEL[tactics[0].tactic]}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              {tactics.map((t) => (
                <div
                  key={t.tactic}
                  className="flex shrink-0 items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[16px] font-medium"
                  style={{ border: `2px solid ${zoneStyle.color}` }}
                >
                  <div
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{ background: zoneStyle.color }}
                  />
                  <div className="flex-grow">
                    <b>{TACTIC_LABEL[t.tactic]}</b> · {t.evidence.slice(0, 60)}
                  </div>
                </div>
              ))}
              {verification?.verdict === "known_fraud" && (
                <div
                  className="shrink-0 rounded-[14px] px-3.5 py-2.5 text-[16px] font-medium"
                  style={{ border: `2px solid ${BRAND.peach}` }}
                >
                  <b>Reported number</b> · {verification.spamReportCount} people reported this
                  number.
                </div>
              )}
              {verification?.officialCallbackNumber && verification.verdict === "verified" && (
                <div
                  className="shrink-0 rounded-[14px] px-3.5 py-2.5 text-[16px] font-medium"
                  style={{ border: `2px solid ${BRAND.teal}` }}
                >
                  <b>{verification.registryMatch?.name}</b> · real number{" "}
                  {verification.officialCallbackNumber}
                </div>
              )}
            </div>

            {micError && (
              <div
                className="rounded-[14px] px-3.5 py-2.5 text-[15px] font-medium"
                style={{ border: `2px solid ${BRAND.peach}` }}
              >
                {micError} — press S for the recorded call.
              </div>
            )}

            <div className="flex-grow" />

            {question ? (
              <button
                onClick={() => setScreen("ask")}
                className={`${BTN} h-16 shrink-0 rounded-[18px] text-[19px]`}
                style={{ background: BRAND.banana, color: BRAND.slate }}
              >
                Ask them a question
              </button>
            ) : null}
            <button
              onClick={endCall}
              className={`${BTN} h-16 shrink-0 rounded-[18px] text-[19px]`}
              style={{ border: `2px solid ${BRAND.slate}`, background: BRAND.white, color: BRAND.slate }}
            >
              End the call
            </button>
          </div>
        )}

        {/* S4 — say this out loud */}
        {screen === "ask" && (
          <div className="flex h-full flex-col gap-5 px-6 pb-8 pt-6">
            <div className="flex items-center gap-2.5">
              <IconQuestion />
              <div className={LABEL}>Ask first</div>
            </div>
            <h1 className="m-0 text-[48px] font-black leading-[0.92] tracking-[-0.055em]">
              Say this out loud.
            </h1>
            <div
              className="flex flex-col gap-3 rounded-[22px] p-6"
              style={{ background: BRAND.white }}
            >
              <p className="m-0 text-[28px] font-extrabold leading-[1.15] tracking-[-0.035em]">
                &ldquo;{question ?? "Before I do anything, what's our family word?"}&rdquo;
              </p>
              <div className="text-[16px] font-medium">
                {safeWord ? "Only your real family knows it." : "A real caller can answer this."}
              </div>
              {safeWord && (
                <button
                  onClick={() => setRevealWord((v) => !v)}
                  className="self-start text-[15px] font-bold underline"
                >
                  {revealWord ? "Hide the word" : "Remind me of the word"}
                </button>
              )}
              {safeWord && revealWord && (
                <div className="text-[26px] font-black tracking-[-0.03em]">{safeWord}</div>
              )}
            </div>
            <div className="text-[18px] font-medium leading-[1.45]">
              Did they say the right word?
            </div>
            <div className="flex-grow" />
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setScreen("listening")}
                className={`${BTN} h-[68px] rounded-[18px] text-[20px]`}
                style={{ background: BRAND.slate, color: BRAND.white }}
              >
                Yes, they knew it
              </button>
              <button
                onClick={() => finish(true)}
                className={`${BTN} h-[68px] rounded-[18px] bg-transparent text-[20px]`}
                style={{ border: `3px solid ${BRAND.slate}`, color: BRAND.slate }}
              >
                No, or they dodged it
              </button>
            </div>
            {questions.length > 1 && (
              <button
                onClick={() => setQuestionIndex((i) => i + 1)}
                className="py-2 text-center text-[16px] font-bold"
              >
                Give me a different question
              </button>
            )}
          </div>
        )}

        {/* S5 / S6 — verdict */}
        {screen === "verdict" && (
          <div className="flex h-full flex-col gap-5 px-6 pb-8 pt-10">
            {zone === "scam" ? <IconWarning /> : <IconCheck />}
            <h1 className="m-0 text-[60px] font-black leading-[0.9] tracking-[-0.055em]">
              {zone === "scam" ? "This is likely a scam." : "This looks safe."}
            </h1>
            <p className="m-0 text-[21px] font-medium leading-[1.4]">
              {zone === "scam"
                ? "Hang up now. You haven't done anything wrong."
                : analysis?.plainLanguageWarning ?? "Still, never send money on this call."}
            </p>
            <div
              className="flex flex-col gap-2.5 rounded-[18px] p-[18px] text-[17px] font-medium leading-[1.4]"
              style={{ background: BRAND.white, color: BRAND.slate }}
            >
              <div className={LABEL}>
                {zone === "scam" ? "Why KinSight thinks so" : "If they ask for money later"}
              </div>
              {zone === "scam" ? (
                <>
                  {safeWordFailed && <div>They didn&apos;t know the family word.</div>}
                  {tactics.map((t) => (
                    <div key={t.tactic}>{TACTIC_LABEL[t.tactic]}.</div>
                  ))}
                  {!safeWordFailed && !tactics.length && (
                    <div>The caller pressed you for money or details.</div>
                  )}
                </>
              ) : (
                <div>
                  Hang up and call them back on the number saved in your phone.
                </div>
              )}
            </div>
            <div className="flex-grow" />
            <button
              onClick={() => {
                setScreen("report");
                void session.generateReport();
              }}
              className={`${BTN} h-[76px] rounded-[20px] text-[23px] tracking-[-0.02em]`}
              style={{ background: BRAND.slate, color: BRAND.white }}
            >
              {zone === "scam" ? "Write a report for me" : "Keep a note of this"}
            </button>
            <button
              onClick={() => {
                session.reset();
                setSafeWordFailed(false);
                setKinJoined(false);
                setCallEnded(false);
                setScreen("incoming");
              }}
              className="py-2.5 text-center text-[18px] font-bold"
            >
              I&apos;m done, close KinSight
            </button>
          </div>
        )}

        {/* Report */}
        {screen === "report" && (
          <div className="flex h-full flex-col gap-4 px-6 pb-8 pt-6">
            <h1 className="m-0 text-[34px] font-black leading-[0.95] tracking-[-0.05em]">
              Your report.
            </h1>
            {!report && <div className="text-[18px] font-medium">Writing it now…</div>}
            {report && (
              <>
                <div
                  className="rounded-[18px] p-4 text-[16px] font-medium leading-[1.4]"
                  style={{ background: BRAND.banana, color: BRAND.slate }}
                >
                  {report.summary}
                </div>
                <div className="flex-1 overflow-y-auto text-[14px] font-medium leading-relaxed">
                  <ReportBody markdown={report.markdown} />
                </div>
                <div className={LABEL}>
                  Send to {report.recommendedAgencies.map((a) => a.name).join(" · ")}
                </div>
              </>
            )}
            <button
              onClick={() => {
                session.reset();
                setSafeWordFailed(false);
                setKinJoined(false);
                setCallEnded(false);
                setScreen("incoming");
              }}
              className={`${BTN} h-16 rounded-[18px] text-[19px]`}
              style={{ background: BRAND.slate, color: BRAND.white }}
            >
              Done
            </button>
          </div>
        )}
      </PhoneFrame>

      <div className="flex w-full max-w-sm shrink-0 flex-col gap-6">
      <KinPanel
        alerted={kinAlerted}
        joined={kinJoined}
        ended={callEnded}
        analysis={analysis}
        summary={session.kinSummary}
        spamReport={session.spamReport}
        stats={session.stats}
        onJoin={() => setKinJoined(true)}
        onFeedback={(verdict, notes) => void session.submitFeedback(verdict, notes)}
      />

      {/* Demo console — operator side, deliberately not in the brand. */}
      <aside className="w-full space-y-5 rounded-2xl bg-neutral-900 p-6 text-neutral-200 ring-1 ring-white/10">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
            Demo console
          </div>
          <p className="mt-1 text-[13px] leading-snug text-neutral-400">
            Both modes run the identical pipeline. Scripted swaps the microphone for a
            recording — it is not a mock.
          </p>
        </div>

        <div className="flex gap-2">
          {(["scripted", "live"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg px-3 py-2 text-[14px] font-semibold ${
                mode === m ? "bg-white text-black" : "bg-neutral-800 text-neutral-300"
              }`}
            >
              {m === "live" ? "Live mic" : "Scripted"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenarioId(s.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-[14px] ${
                scenarioId === s.id ? "bg-neutral-700 text-white" : "bg-neutral-800 text-neutral-400"
              }`}
            >
              <div className="font-semibold">{s.label}</div>
              <div className="text-[12px] leading-snug text-neutral-400">{s.blurb}</div>
            </button>
          ))}
        </div>

        <button
          onClick={() => startCall(mode)}
          className="w-full rounded-lg bg-emerald-500 py-3 text-[15px] font-bold text-black"
        >
          Start call
        </button>

        <dl className="space-y-1 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Windows in flight</dt>
            <dd className="tabular-nums">{pending}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Transcript lines</dt>
            <dd className="tabular-nums">{segments.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Model score</dt>
            <dd className="tabular-nums">
              {analysis ? analysis.fraudProbability.toFixed(2) : "—"} → {zone}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Kin alert (≥{KIN_ALERT_THRESHOLD})</dt>
            <dd>{kinAlerted ? (kinJoined ? "joined" : "sent") : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Spam DB</dt>
            <dd className="tabular-nums">
              {session.spamReport ? `${session.spamReport.reportCount} reports` : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Evals</dt>
            <dd className="tabular-nums">
              {session.stats
                ? `${session.stats.correct}/${session.stats.total} → ${session.stats.suggestedThreshold}`
                : "—"}
            </dd>
          </div>
        </dl>

        {error && (
          <div className="rounded-lg bg-red-950 px-3 py-2 text-[12px] leading-snug text-red-300">
            {error}
          </div>
        )}

        <div className="border-t border-white/10 pt-4 text-[12px] leading-relaxed text-neutral-500">
          <div><span className="font-mono text-neutral-300">S</span> — restart as scripted call</div>
          <div><span className="font-mono text-neutral-300">L</span> — restart on live mic</div>
          <div><span className="font-mono text-neutral-300">R</span> — reset to incoming call</div>
        </div>
      </aside>
      </div>
    </main>
  );
}
