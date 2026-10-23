"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ReportBody } from "@/components/ReportBody";
import { ListeningWave, MicLevel, RiskMeter } from "@/components/RiskMeter";
import { KinPanel } from "@/components/KinPanel";
import { MicSource, ScriptedSource, type ScriptedSegment } from "@/lib/audio-sources";
import { useCallSession } from "@/lib/use-call-session";
import { BRAND, KIN_ALERT_THRESHOLD, zoneFor } from "@/lib/risk";

type Scenario = {
  id: string;
  label: string;
  blurb: string;
  callerNumber: string;
  inContacts: boolean;
  segments: ScriptedSegment[];
};

/**
 * The simple flow from docs/design/README.md. Screens 1-3 are on the family
 * member's phone; everything after is on the elder's.
 */
type Screen =
  | "who" // 1 Natalie: who are you inviting?
  | "word" // 2 Natalie: pick the KinCode (the family code)
  | "send" // 3 Natalie: hello, call first, send
  | "yes" // 4 Margaret: turns it on
  | "learn" // 5 Margaret: learns the KinCode
  | "incoming" // 6 Margaret: phone rings through KinSight
  | "answered" // 7 Margaret: answers, KinSight prompts her
  | "listening" // 8 Margaret: listening, live meter
  | "ask" // 9 Margaret: ask for the KinCode
  | "knew" // 9b Margaret: Kinfirmed, they knew it
  | "hangup" // 10 Margaret: hang up
  | "done" // 11 Margaret: after the call
  | "report"; // police report draft, from screen 11
type Mode = "live" | "scripted";
type Relation = "Mom" | "Dad" | "Grandparent" | "Someone else";

const KIN = "Natalie";
const SAFE_WORD_KEY = "kinsight.safeWord";
const SUGGESTED_WORDS = ["Bluebird", "Lighthouse", "Peppermint", "Sunflower", "Harbor"];
const NATALIE_SCREENS: Screen[] = ["who", "word", "send"];

/**
 * The stored KinCode is client-only state. Reading it through
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

function pronouns(relation: Relation) {
  if (relation === "Mom") return { subj: "she", obj: "her", poss: "her" };
  if (relation === "Dad") return { subj: "he", obj: "him", poss: "his" };
  return { subj: "they", obj: "them", poss: "their" };
}

const BTN = "w-full font-[inherit] tracking-[-0.01em]";
const ELDER_BTN = `${BTN} h-20 rounded-[16px] text-[24px] font-bold`;
const KIN_BTN = `${BTN} h-14 rounded-[16px] text-[18px] font-semibold`;
const FIELD = "h-14 rounded-[16px] px-4 text-[18px] font-medium outline-none";

function Svg({ size, children, stroke }: { size: number; children: ReactNode; stroke: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const PHONE_PATH = "M8.2 4.5 H5.6 C4.9 4.5 4.4 5.1 4.5 5.8 C5.3 13.2 10.8 18.7 18.2 19.5 C18.9 19.6 19.5 19.1 19.5 18.4 V15.8 L15.9 14.4 L14.2 16.1 C11.6 14.9 9.1 12.4 7.9 9.8 L9.6 8.1 Z";
const HANG_UP_PATH = "M2.5 14 C7.6 9.3 16.4 9.3 21.5 14 L19.4 16.6 L16 15.2 V12.6 C13.4 11.8 10.6 11.8 8 12.6 V15.2 L4.6 16.6 Z";

/** One honest line where the real action needs the iPhone app, instead of a dead button. */
function DemoNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[12px] px-4 py-2 text-[15px] font-semibold" style={{ background: BRAND.wash, color: BRAND.slate }}>
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back"
      className="flex h-11 w-11 items-center justify-center rounded-[12px]"
      style={{ background: BRAND.wash }}
    >
      <Svg size={20} stroke={BRAND.slate}>
        <path d="M15 5 L8 12 L15 19" />
      </Svg>
    </button>
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
  const screen = screenOverride ?? (safeWord ? "incoming" : "who");
  const setScreen = setScreenOverride;

  // Onboarding (Natalie's phone)
  const [relation, setRelation] = useState<Relation>("Mom");
  const [firstName, setFirstName] = useState("Margaret");
  const [elderPhone, setElderPhone] = useState("(847) 392-6618");
  const [wordInput, setWordInput] = useState("");
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [toldFamily, setToldFamily] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // The call
  const [safeWordFailed, setSafeWordFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("scripted");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState("grandparent-scam");
  const [micError, setMicError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [kinJoined, setKinJoined] = useState(false);
  const [kinSaysHangUp, setKinSaysHangUp] = useState(false);
  const [kinfirmed, setKinfirmed] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [endedAsScam, setEndedAsScam] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const session = useCallSession();
  const scenario = useMemo(
    () => scenarios.find((s) => s.id === scenarioId) ?? scenarios[0] ?? null,
    [scenarios, scenarioId],
  );

  const p = pronouns(relation);
  const elderCall =
    relation === "Mom" || relation === "Dad" ? relation : firstName.trim() || "them";
  const elderName = firstName.trim() || "Margaret";

  useEffect(() => {
    fetch("/demo/manifest.json")
      .then((r) => r.json())
      .then(setScenarios)
      .catch(() => undefined);
  }, []);

  const go = useCallback(
    (next: Screen) => {
      setNote(null);
      setScreen(next);
    },
    [setScreen],
  );

  const resetCall = useCallback(() => {
    session.reset();
    setSafeWordFailed(false);
    setKinJoined(false);
    setKinSaysHangUp(false);
    setKinfirmed(false);
    setCallEnded(false);
    setEndedAsScam(false);
    setMicError(null);
  }, [session]);

  const startCall = useCallback(
    async (requested: Mode, next: Screen) => {
      if (!scenario) return;
      resetCall();
      setMode(requested);
      go(next);

      const source =
        requested === "live"
          ? new MicSource(8000, setMicLevel)
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
    [scenario, session, safeWord, go, resetCall],
  );

  const ringPhone = useCallback(() => {
    resetCall();
    go("incoming");
  }, [resetCall, go]);

  // One keystroke to recover a dying demo: S drops to the scripted call.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        session.stop();
        void startCall("scripted", "listening");
      } else if (key === "l") {
        session.stop();
        void startCall("live", "listening");
      } else if (key === "r") {
        ringPhone();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, startCall, ringPhone]);

  const { analysis, segments, report, pending,
    silentWindows, error, verification } = session;
  const knownScam = verification?.verdict === "known_fraud";
  /**
   * The registry deliberately does NOT set the zone.
   *
   * /api/verify/number answers in milliseconds, long before a word is recorded,
   * so letting it force "scam" skipped the call entirely: no meter, no
   * transcript, no question to ask, and Natalie's panel reading "Likely scam"
   * beside the model's actual 5%. It also hard-blocks on an unauthenticated
   * crowd list — numbers get recycled and anyone can file a report, so a wrong
   * entry would hang up on a real caller forever, which is the failure that
   * isolates the person this is for.
   *
   * A registry hit is strong evidence, so it warns loudly and wakes the family
   * (see `kinAlerted`). What it does not do is decide the verdict on its own.
   */
  const zone = safeWordFailed ? "scam" : zoneFor(analysis?.riskLevel ?? null);

  /** Above the threshold the family is notified. */
  const kinAlerted =
    (analysis?.fraudProbability ?? 0) >= KIN_ALERT_THRESHOLD || safeWordFailed || knownScam;

  /**
   * Screen 10 takes over the call screen on its own: when the risk reaches the
   * scam zone, or when Natalie taps "Tell Mom to hang up". Derived rather than
   * set in an effect, so it can never lag a render behind.
   */
  const shown: Screen =
    screen === "listening" && (zone === "scam" || kinSaysHangUp) ? "hangup" : screen;

  const questions = analysis?.suggestedQuestions ?? [];
  const fallbackQuestion = questions[0] ?? "Can I call you back on the number I have for you?";

  /**
   * Ending the call is where the loop closes: the number goes back to the spam
   * database and the family gets their summary. Both only fire on a scam
   * verdict — a legitimate call must never be written to a fraud list.
   */
  const finish = () => {
    const scam = knownScam || safeWordFailed || kinSaysHangUp || analysis?.shouldAlert === true;
    session.stop();
    setCallEnded(true);
    setEndedAsScam(scam);
    go("done");
    if (scam) {
      void session.reportNumber();
      void session.generateKinSummary();
    }
  };

  const restartSetup = () => {
    resetCall();
    try {
      localStorage.removeItem(SAFE_WORD_KEY);
    } catch {
      // Nothing stored to clear.
    }
    setSafeWordOverride("");
    setWordInput("");
    setToldFamily(false);
    go("who");
  };

  const onNatalieScreen = NATALIE_SCREENS.includes(shown);
  const background =
    shown === "incoming" || shown === "answered"
      ? BRAND.slate
      : shown === "ask"
        ? BRAND.banana
        : shown === "knew"
          ? BRAND.teal
          : shown === "hangup"
            ? BRAND.peach
            : BRAND.white;
  const foreground =
    shown === "incoming" || shown === "answered" || shown === "hangup" ? BRAND.white : BRAND.slate;

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-neutral-950 p-8 lg:flex-row lg:items-start lg:justify-center">
      <audio ref={audioRef} className="hidden" />

      <PhoneFrame
        owner={onNatalieScreen ? KIN : elderName}
        background={background}
        foreground={foreground}
      >
        {/* 1 — Natalie: who are you inviting? */}
        {shown === "who" && (
          <div className="flex min-h-full flex-col gap-6 px-6 pb-8 pt-6">
            <div className="flex items-center justify-between">
              <div className="text-[20px] font-bold tracking-[-0.02em]">
                KinSight<span style={{ color: BRAND.peach }}>.</span>
              </div>
              <div className="text-[16px] font-semibold">1 of 3</div>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-[36px] font-bold leading-[40px] tracking-[-0.02em]">
                Who are you inviting?
              </h1>
              <p className="m-0 text-[18px] font-medium leading-[28px]">
                When a number {p.subj} {p.subj === "they" ? "don't" : "doesn't"} know calls,
                KinSight listens with {p.obj}, tells {p.obj} what to do, and alerts you if it
                sounds like a scam.
              </p>
            </div>
            <div role="radiogroup" aria-label="Who you are inviting" className="grid grid-cols-2 gap-2">
              {(["Mom", "Dad", "Grandparent", "Someone else"] as Relation[]).map((r) => (
                <button
                  key={r}
                  role="radio"
                  aria-checked={relation === r}
                  onClick={() => setRelation(r)}
                  className={`${BTN} h-14 rounded-[16px] text-[18px] font-semibold`}
                  style={
                    relation === r
                      ? { background: BRAND.slate, color: BRAND.white }
                      : { background: BRAND.wash, color: BRAND.slate }
                  }
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="first-name" className="text-[16px] font-semibold">
                  First name
                </label>
                <input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={FIELD}
                  style={{ border: `2px solid ${BRAND.slate}`, color: BRAND.slate }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="elder-phone" className="text-[16px] font-semibold">
                  iPhone number
                </label>
                <input
                  id="elder-phone"
                  type="tel"
                  value={elderPhone}
                  onChange={(e) => setElderPhone(e.target.value)}
                  className={`${FIELD} tabular-nums`}
                  style={{ border: `2px solid ${BRAND.slate}`, color: BRAND.slate }}
                />
              </div>
            </div>
            <div className="flex-grow" />
            <button
              disabled={!firstName.trim() || !elderPhone.trim()}
              onClick={() => go("word")}
              className={`${KIN_BTN} disabled:opacity-30`}
              style={{ background: BRAND.slate, color: BRAND.white }}
            >
              Next
            </button>
          </div>
        )}

        {/* 2 — Natalie: pick the KinCode */}
        {shown === "word" && (
          <div className="flex min-h-full flex-col gap-6 px-6 pb-8 pt-6">
            <div className="flex items-center justify-between">
              <BackButton onClick={() => go("who")} />
              <div className="text-[16px] font-semibold">2 of 3</div>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-[36px] font-bold leading-[40px] tracking-[-0.02em]">
                Pick your KinCode
              </h1>
              <p className="m-0 text-[18px] font-medium leading-[28px]">
                Your KinCode is a family code. If a caller says they&apos;re family, KinSight has{" "}
                {elderCall} ask for it. Real family knows it. Scammers don&apos;t.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="family-word" className="text-[16px] font-semibold">
                  KinCode
                </label>
                <button
                  onClick={() => {
                    setWordInput(SUGGESTED_WORDS[suggestIndex % SUGGESTED_WORDS.length]);
                    setSuggestIndex((i) => i + 1);
                  }}
                  className="text-[16px] font-bold underline underline-offset-2"
                >
                  Suggest one
                </button>
              </div>
              <input
                id="family-word"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                placeholder="e.g. Bluebird"
                className={`${FIELD} text-[20px] font-semibold`}
                style={{ border: `2px solid ${BRAND.slate}`, color: BRAND.slate }}
              />
              <div className="text-[16px] font-medium leading-[24px]">
                Easy for {p.obj} to remember, hard to guess. Skip pet names, streets and
                birthdays, because those are online. It stays on this phone and is never sent
                to the AI.
              </div>
            </div>
            <label
              className="flex cursor-pointer items-start gap-3 rounded-[24px] p-4"
              style={{ background: BRAND.banana }}
            >
              <input
                id="told-family"
                type="checkbox"
                checked={toldFamily}
                onChange={(e) => setToldFamily(e.target.checked)}
                className="mt-0.5 h-6 w-6 shrink-0"
                style={{ accentColor: BRAND.slate }}
              />
              <span className="flex flex-col text-[16px] leading-[24px]">
                <span className="font-bold">Tell family who might call {p.obj}</span>
                <span className="font-medium">
                  Say it out loud, not in a text or post. Real family who don&apos;t know it will
                  fail the check.
                </span>
              </span>
            </label>
            <div className="flex-grow" />
            <button
              disabled={!wordInput.trim()}
              onClick={() => go("send")}
              className={`${KIN_BTN} disabled:opacity-30`}
              style={{ background: BRAND.slate, color: BRAND.white }}
            >
              Next
            </button>
          </div>
        )}

        {/* 3 — Natalie: record a hello, call first, send */}
        {shown === "send" && (
          <div className="flex min-h-full flex-col gap-6 px-6 pb-8 pt-6">
            <div className="flex items-center justify-between">
              <BackButton onClick={() => go("word")} />
              <div className="text-[16px] font-semibold">3 of 3</div>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-[36px] font-bold leading-[40px] tracking-[-0.02em]">
                Record a hello for {elderCall}
              </h1>
              <p className="m-0 text-[18px] font-medium leading-[28px]">
                {p.subj === "they" ? "They'll" : p.subj === "she" ? "She'll" : "He'll"} hear this
                first. Say why you set this up, in your own words.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-[24px] p-4" style={{ background: BRAND.wash }}>
              <div className="flex items-center gap-4">
                <button
                  disabled
                  aria-label="Record"
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px] opacity-60"
                  style={{ background: BRAND.banana }}
                >
                  <Svg size={28} stroke={BRAND.slate}>
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5.5 11 C5.5 14.6 8.4 17.5 12 17.5 C15.6 17.5 18.5 14.6 18.5 11" />
                    <path d="M12 17.5 V21" />
                  </Svg>
                </button>
                <div className="flex flex-col">
                  <span className="text-[18px] font-bold">Record</span>
                  <span className="text-[16px] font-medium">Recording comes with the iPhone app</span>
                </div>
              </div>
              <div className="text-[16px] font-semibold leading-[24px]">
                Don&apos;t say the KinCode. KinSight shows it to {p.obj} privately.
              </div>
            </div>
            <div className="flex flex-col gap-1 rounded-[24px] p-4" style={{ background: BRAND.horizon }}>
              <div className="text-[20px] font-bold">Call {p.obj} first</div>
              <div className="text-[16px] font-semibold leading-[24px]">
                {p.subj === "they" ? "They'll" : p.subj === "she" ? "She'll" : "He'll"} get a text
                from you with a link. A surprise link can look like a scam, so tell {p.obj}{" "}
                it&apos;s coming.
              </div>
            </div>
            <div className="flex-grow" />
            <button
              onClick={() => {
                const word = wordInput.trim();
                setSafeWordOverride(word);
                try {
                  localStorage.setItem(SAFE_WORD_KEY, word);
                } catch {
                  // Not fatal — the word simply will not survive a reload.
                }
                go("yes");
              }}
              className={KIN_BTN}
              style={{ background: BRAND.slate, color: BRAND.white }}
            >
              Send invite to {elderCall}
            </button>
          </div>
        )}

        {/* 4 — Margaret: turns it on */}
        {shown === "yes" && (
          <div className="flex min-h-full flex-col gap-6 px-6 pb-8 pt-6">
            <div className="flex items-center gap-4">
              <div
                role="img"
                aria-label={KIN}
                className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] text-[36px] font-bold"
                style={{ background: BRAND.horizon }}
              >
                {KIN[0]}
              </div>
              <div className="text-[24px] font-bold">From {KIN}</div>
            </div>
            <h1 className="m-0 text-[36px] font-bold leading-[40px] tracking-[-0.02em]">
              {KIN} wants to help you spot phone scams.
            </h1>
            <div className="flex flex-col gap-4 text-[20px] font-semibold leading-[28px]">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px]" style={{ background: BRAND.wash }}>
                  <Svg size={26} stroke={BRAND.slate}>
                    <path d={PHONE_PATH} />
                  </Svg>
                </div>
                When a number you don&apos;t know calls, KinSight listens too.
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px]" style={{ background: BRAND.wash }}>
                  <Svg size={26} stroke={BRAND.slate}>
                    <circle cx="12" cy="8.5" r="3.5" />
                    <path d="M5 19.5 C5.8 16 8.6 14 12 14 C15.4 14 18.2 16 19 19.5" />
                  </Svg>
                </div>
                Calls from your contacts ring like always.
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] text-[22px] font-bold" style={{ background: BRAND.wash }}>
                  {KIN[0]}
                </div>
                If it sounds like a scam, it tells you and {KIN}.
              </div>
            </div>
            <div className="flex-grow" />
            <div className="flex flex-col gap-2">
              {note && <DemoNote>{note}</DemoNote>}
              <button onClick={() => go("learn")} className={ELDER_BTN} style={{ background: BRAND.slate, color: BRAND.white }}>
                Yes, turn it on
              </button>
              <button
                onClick={() => setNote(`In the iPhone app, this calls ${KIN}.`)}
                className="h-12 text-[20px] font-bold"
              >
                Call {KIN} first
              </button>
            </div>
          </div>
        )}

        {/* 5 — Margaret: learns the KinCode */}
        {shown === "learn" && (
          <div className="flex min-h-full flex-col gap-6 px-6 pb-10 pt-16">
            <div className="flex flex-col">
              <div className="text-[24px] font-bold">Your KinCode</div>
              <div className="text-[18px] font-semibold">Your family code</div>
            </div>
            <div className="flex flex-col gap-2 rounded-[24px] px-6 py-8" style={{ background: BRAND.banana }}>
              <div className="break-words text-[48px] font-bold leading-[48px] tracking-[-0.02em]">
                {safeWord}
              </div>
              <div className="text-[18px] font-semibold">Chosen by {KIN}</div>
            </div>
            <p className="m-0 text-[30px] font-bold leading-[36px]">
              Never say it first. Let the caller say it.
            </p>
            <div className="flex flex-col gap-2 text-[20px] font-semibold leading-[28px]">
              <div>KinSight will show it when you need it.</div>
              <div>KinSight never calls you itself.</div>
            </div>
            <div className="flex-grow" />
            <button onClick={ringPhone} className={ELDER_BTN} style={{ background: BRAND.slate, color: BRAND.white }}>
              Got it
            </button>
          </div>
        )}

        {/* 6 — Margaret: the phone rings through KinSight */}
        {shown === "incoming" && (
          <div className="flex min-h-full flex-col items-center gap-3 px-8 pb-14 pt-20 text-center">
            <div className="text-[18px] font-medium">Through KinSight</div>
            <div className="text-[36px] font-bold leading-[40px] tracking-[-0.02em]">Unknown number</div>
            <div className="text-[20px] font-medium tabular-nums">{scenario?.callerNumber ?? ""}</div>
            <div
              className="mt-6 rounded-[16px] px-4 py-3 text-[20px] font-bold"
              style={{ background: BRAND.banana, color: BRAND.slate }}
            >
              KinSight will listen with you
            </div>
            <div className="flex-grow" />
            <div className="flex w-full justify-between">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={ringPhone}
                  aria-label="Decline"
                  className="flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: BRAND.peach }}
                >
                  <Svg size={36} stroke={BRAND.white}>
                    <path d={HANG_UP_PATH} />
                  </Svg>
                </button>
                <span className="text-[18px] font-semibold">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => void startCall(mode, "answered")}
                  disabled={!scenario}
                  aria-label="Accept"
                  className="flex h-20 w-20 items-center justify-center rounded-full disabled:opacity-40"
                  style={{ background: BRAND.teal }}
                >
                  <Svg size={34} stroke={BRAND.white}>
                    <path d={PHONE_PATH} />
                  </Svg>
                </button>
                <span className="text-[18px] font-semibold">Accept</span>
              </div>
            </div>
          </div>
        )}

        {/* 7 — Margaret: answered, KinSight prompts her to look */}
        {shown === "answered" && (
          <div className="flex min-h-full flex-col gap-8 px-4 pb-10 pt-4">
            <button
              onClick={() => go("listening")}
              className="flex flex-col gap-2 rounded-[24px] p-4 text-left"
              style={{ background: BRAND.white, color: BRAND.slate }}
            >
              <span className="flex w-full items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[16px] font-bold" style={{ background: BRAND.banana }}>
                  K
                </span>
                <span className="flex-grow text-[16px] font-semibold">KinSight</span>
                <span className="text-[16px] font-medium">now</span>
              </span>
              <span className="text-[24px] font-bold leading-[32px]">KinSight is listening</span>
              <span className="text-[20px] font-medium leading-[28px]">Tap for help with this call.</span>
            </button>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="text-[30px] font-bold leading-[36px] tracking-[-0.02em]">Unknown number</div>
              <div className="text-[20px] font-medium">On the call</div>
            </div>
            <div className="flex-grow" />
            <div className="grid grid-cols-3 gap-4 px-4">
              {["Mute", "Speaker"].map((label) => (
                <div key={label} className="flex flex-col items-center gap-2" aria-hidden="true">
                  <div className="h-[72px] w-[72px] rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
                  <span className="text-[16px] font-semibold">{label}</span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => go("listening")}
                  aria-label="Open KinSight"
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-[30px] font-bold"
                  style={{ background: BRAND.banana, color: BRAND.slate }}
                >
                  K
                </button>
                <span className="text-[16px] font-bold">KinSight</span>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={finish}
                aria-label="End call"
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{ background: BRAND.peach }}
              >
                <Svg size={36} stroke={BRAND.white}>
                  <path d={HANG_UP_PATH} />
                </Svg>
              </button>
            </div>
          </div>
        )}

        {/* 8 — Margaret: KinSight open, listening */}
        {shown === "listening" && (
          <div className="flex min-h-full flex-col gap-8 px-6 pb-10 pt-8">
            <div className="flex flex-col gap-1">
              <div className="text-[20px] font-semibold">Unknown number</div>
              <div className="text-[24px] font-bold tabular-nums">{scenario?.callerNumber ?? ""}</div>
            </div>
            <div className="flex flex-col gap-6">
              <h1 className="m-0 text-[60px] font-bold leading-[60px] tracking-[-0.02em]">Listening.</h1>
              <RiskMeter
                probability={analysis?.fraudProbability ?? null}
                zone={zone}
                listening={pending > 0 || !analysis}
              />
            </div>

            {kinAlerted && (
              <div role="status" className="flex items-center gap-4 rounded-[24px] p-4" style={{ background: BRAND.banana }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] text-[24px] font-bold" style={{ background: BRAND.horizon }}>
                  {KIN[0]}
                </div>
                <div className="text-[24px] font-bold leading-[32px]">
                  {kinJoined ? `${KIN} joined the call.` : `KinSight sent ${KIN} a message.`}
                </div>
              </div>
            )}

            {mode === "live" && !micError && (
              <div className="rounded-[14px] px-4 py-3" style={{ background: BRAND.wash }}>
                <MicLevel level={micLevel} />
                {silentWindows >= 2 && (
                  <div className="mt-2 text-[16px] font-medium">
                    Nothing has come through the microphone yet. Check it is not muted, or
                    press S for the recorded call.
                  </div>
                )}
              </div>
            )}

            {knownScam && verification && (
              <div
                role="status"
                className="flex flex-col gap-1 rounded-[24px] p-4"
                style={{ background: BRAND.peach, color: BRAND.white }}
              >
                <div className="text-[24px] font-bold leading-[32px]">
                  Other families reported this number.
                </div>
                <div className="text-[18px] font-semibold">
                  {verification.spamReportCount}{" "}
                  {verification.spamReportCount === 1 ? "report" : "reports"}. Be careful, and
                  do not send money.
                </div>
              </div>
            )}

            {micError && (
              <div className="rounded-[14px] px-4 py-3 text-[16px] font-medium" style={{ background: BRAND.wash }}>
                {micError}. Press S for the recorded call.
              </div>
            )}

            <div className="flex-grow" />
            <div className="flex flex-col gap-3">
              {zone !== "normal" && (
                <button onClick={() => go("ask")} className={ELDER_BTN} style={{ background: BRAND.banana, color: BRAND.slate }}>
                  Ask the caller a question
                </button>
              )}
              <button onClick={finish} className={ELDER_BTN} style={{ background: BRAND.slate, color: BRAND.white }}>
                Hang up
              </button>
            </div>
          </div>
        )}

        {/* 9 — Margaret: ask for the KinCode. Said out loud as "family code",
            because a real relative may not know the app's name for it. */}
        {shown === "ask" && (
          <div className="flex min-h-full flex-col gap-6 px-6 pb-10 pt-12">
            <div className="text-[30px] font-bold">Ask:</div>
            <h1 className="m-0 text-[48px] font-bold leading-[48px] tracking-[-0.02em]">
              &ldquo;{safeWord ? "What's our family code?" : fallbackQuestion}&rdquo;
            </h1>
            {safeWord && (
              <div className="flex flex-col gap-1 rounded-[24px] px-6 py-4" style={{ background: BRAND.white }}>
                <div className="text-[18px] font-semibold">Your KinCode. Only you can see this.</div>
                <div aria-hidden="true" className="break-words text-[36px] font-bold leading-[40px] tracking-[-0.02em]">
                  {safeWord}
                </div>
              </div>
            )}
            <div className="flex-grow" />
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setKinfirmed(true);
                  go("knew");
                }}
                className={ELDER_BTN}
                style={{ background: BRAND.slate, color: BRAND.white }}
              >
                {safeWord ? `They said “${safeWord}”` : "They answered"}
              </button>
              <button
                onClick={() => {
                  setSafeWordFailed(true);
                  go("hangup");
                }}
                className={ELDER_BTN}
                style={{ background: BRAND.white, color: BRAND.slate }}
              >
                They didn&apos;t
              </button>
            </div>
          </div>
        )}

        {/* 9b — Margaret: Kinfirmed. Knowing the code proves only that they know
            the code, so the screen still asks her to check before sending money. */}
        {shown === "knew" && (
          <div className="flex min-h-full flex-col gap-6 px-6 pb-10 pt-16">
            <Svg size={72} stroke={BRAND.slate}>
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5 L10.8 15 L16 9.5" />
            </Svg>
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-[60px] font-bold leading-[60px] tracking-[-0.02em]">Kinfirmed.</h1>
              <div className="text-[24px] font-bold leading-[32px]">They knew your KinCode.</div>
            </div>
            <div className="rounded-[24px] p-6 text-[24px] font-bold leading-[32px]" style={{ background: BRAND.white }}>
              Before you send money, check with {KIN}.
            </div>
            <div className="flex items-center gap-3 rounded-[16px] px-4 py-3" style={{ background: BRAND.white }}>
              <ListeningWave active={!callEnded} />
              <div className="text-[20px] font-bold">Listening.</div>
            </div>
            <div className="flex-grow" />
            <div className="flex flex-col gap-2">
              <button onClick={() => go("listening")} className={ELDER_BTN} style={{ background: BRAND.slate, color: BRAND.white }}>
                Back to call
              </button>
              <button onClick={finish} className="h-12 text-[20px] font-bold">
                Hang up anyway
              </button>
            </div>
          </div>
        )}

        {/* 10 — Margaret: hang up */}
        {shown === "hangup" && (
          <div className="flex min-h-full flex-col gap-6 px-6 pb-10 pt-16">
            <Svg size={72} stroke={BRAND.white}>
              <path d="M12 3.5 L21.5 20 H2.5 Z" />
              <path d="M12 10 V14" />
              <path d="M12 17 V17.1" />
            </Svg>
            <h1 className="m-0 text-[72px] font-bold leading-[72px] tracking-[-0.02em]">Hang up.</h1>
            <div className="text-[30px] font-bold leading-[36px]">
              {knownScam
                ? `This number is in KinSight's scam database (${verification.spamReportCount} ${verification.spamReportCount === 1 ? "report" : "reports"}).`
                : kinSaysHangUp
                  ? `${KIN} says: Hang up.`
                  : `KinSight sent ${KIN} a message.`}
            </div>
            <div className="flex-grow" />
            <button onClick={finish} className={ELDER_BTN} style={{ background: BRAND.slate, color: BRAND.white }}>
              Hang up
            </button>
          </div>
        )}

        {/* 11 — Margaret: after the call */}
        {shown === "done" && (
          <div className="flex min-h-full flex-col gap-6 px-6 pb-10 pt-16">
            <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[24px]" style={{ background: BRAND.teal }}>
              <Svg size={56} stroke={BRAND.white}>
                <path d="M5 12.5 L10 17 L19 7" />
              </Svg>
            </div>
            <h1 className="m-0 text-[48px] font-bold leading-[48px] tracking-[-0.02em]">
              {endedAsScam ? "You did the right thing." : "Call ended."}
            </h1>
            <p className="m-0 text-[30px] font-bold leading-[36px]">
              {endedAsScam
                ? "Don't call that number back."
                : analysis
                  ? "Nothing worrying came up."
                  : "KinSight didn't get to check this call."}
            </p>
            <div className="flex-grow" />
            <div className="flex flex-col gap-2">
              {note && <DemoNote>{note}</DemoNote>}
              {endedAsScam && (
                <>
                  <button
                    onClick={() => setNote(`In the iPhone app, this calls ${KIN}.`)}
                    className={ELDER_BTN}
                    style={{ background: BRAND.slate, color: BRAND.white }}
                  >
                    Call {KIN}
                  </button>
                  <button
                    onClick={() => {
                      go("report");
                      void session.generateReport();
                    }}
                    className="h-12 text-[20px] font-bold"
                  >
                    Write a report for the police
                  </button>
                </>
              )}
              <button onClick={ringPhone} className="h-12 text-[20px] font-bold">
                Close
              </button>
            </div>
          </div>
        )}

        {/* Report, reached from screen 11 */}
        {shown === "report" && (
          <div className="flex min-h-full flex-col gap-4 px-6 pb-8 pt-6">
            <h1 className="m-0 text-[36px] font-bold leading-[40px] tracking-[-0.02em]">Your report</h1>
            {!report && <div className="text-[20px] font-medium">Writing it now…</div>}
            {report && (
              <>
                <div className="rounded-[18px] p-4 text-[16px] font-medium leading-[1.4]" style={{ background: BRAND.banana }}>
                  {report.summary}
                </div>
                <div className="flex-1 overflow-y-auto text-[14px] font-medium leading-relaxed">
                  <ReportBody markdown={report.markdown} />
                </div>
                <div className="text-[14px] font-semibold">
                  Send to {report.recommendedAgencies.map((a) => a.name).join(" · ")}
                </div>
              </>
            )}
            <button onClick={ringPhone} className={`${KIN_BTN} h-16`} style={{ background: BRAND.slate, color: BRAND.white }}>
              Done
            </button>
          </div>
        )}
      </PhoneFrame>

      <div className="flex w-full max-w-sm shrink-0 flex-col gap-6">
        <KinPanel
          kinName={KIN}
          elderCall={elderCall}
          alerted={kinAlerted}
          joined={kinJoined}
          ended={callEnded}
          zone={zone}
          analysis={analysis}
          summary={session.kinSummary}
          spamReport={session.spamReport}
          stats={session.stats}
          toldHangUp={kinSaysHangUp}
          kinfirmed={kinfirmed}
          onJoin={() => setKinJoined(true)}
          onTellHangUp={() => setKinSaysHangUp(true)}
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

          <div className="flex gap-2">
            <button
              onClick={ringPhone}
              disabled={!safeWord}
              className="flex-1 rounded-lg bg-emerald-500 py-3 text-[15px] font-bold text-black disabled:opacity-40"
            >
              Ring {elderName}&apos;s phone
            </button>
            <button
              onClick={restartSetup}
              className="rounded-lg bg-neutral-800 px-3 py-3 text-[14px] font-semibold text-neutral-300"
            >
              Restart setup
            </button>
          </div>

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

          {segments.length > 0 && (
            <div className="rounded-lg bg-neutral-800 px-3 py-2 text-[13px] leading-snug text-neutral-300">
              <div className="text-neutral-500">Caller just said</div>
              {segments.at(-1)?.text}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-950 px-3 py-2 text-[12px] leading-snug text-red-300">
              {error}
            </div>
          )}

          <div className="border-t border-white/10 pt-4 text-[12px] leading-relaxed text-neutral-500">
            <div><span className="font-mono text-neutral-300">S</span> — restart as scripted call</div>
            <div><span className="font-mono text-neutral-300">L</span> — restart on live mic</div>
            <div><span className="font-mono text-neutral-300">R</span> — ring the phone again</div>
          </div>
        </aside>
      </div>
    </main>
  );
}
