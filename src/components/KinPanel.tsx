"use client";

import { useState } from "react";
import { BRAND, TACTIC_LABEL, type Zone } from "@/lib/risk";
import type { CallAnalysis, EvalStats, EvalVerdict, KinSummary, SpamReport } from "@/lib/schema";

const VERDICTS: { value: EvalVerdict; label: string }[] = [
  { value: "correct", label: "KinSight got it right" },
  { value: "false_alarm", label: "False alarm, it was fine" },
  { value: "missed_scam", label: "It missed something" },
];

/** What the family member reads first: words lead, the number follows small. */
const KIN_HEADLINE: Record<Zone, string> = {
  normal: "Probably fine",
  ask: "Something's off",
  scam: "Likely scam",
};

/**
 * The family member's phone (screen 12 of the simple flow).
 *
 * Unlike the elder's screens, this one may show the percentage: Natalie is
 * 34 and reading it calmly, Margaret is mid-call with a stranger.
 */
export function KinPanel({
  kinName,
  elderCall,
  alerted,
  joined,
  ended,
  zone,
  analysis,
  summary,
  spamReport,
  stats,
  toldHangUp,
  onJoin,
  onTellHangUp,
  onFeedback,
}: {
  kinName: string;
  /** How the family member refers to the elder: "Mom", "Dad", or a first name. */
  elderCall: string;
  alerted: boolean;
  joined: boolean;
  ended: boolean;
  zone: Zone;
  analysis: CallAnalysis | null;
  summary: KinSummary | null;
  spamReport: SpamReport | null;
  stats: EvalStats | null;
  toldHangUp: boolean;
  onJoin: () => void;
  onTellHangUp: () => void;
  onFeedback: (verdict: EvalVerdict, notes: string | null) => void;
}) {
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState<EvalVerdict | null>(null);
  const risk = analysis ? Math.round(analysis.fraudProbability * 100) : null;

  return (
    <section
      className="w-full max-w-sm shrink-0 overflow-hidden rounded-[28px]"
      style={{ background: BRAND.white }}
    >
      <div
        className="flex items-center justify-between px-5 py-3 text-[14px] font-bold"
        style={{ background: BRAND.horizon, color: BRAND.slate }}
      >
        <div>{kinName}&apos;s phone</div>
        <div className="font-semibold">KinSight</div>
      </div>

      <div className="flex flex-col gap-4 p-5" style={{ color: BRAND.slate }}>
        {!alerted && !ended && (
          <div className="text-[16px] font-medium leading-snug">
            Watching over {elderCall}&apos;s calls. You&apos;ll only hear from KinSight if
            something looks wrong.
          </div>
        )}

        {/* The >50% trigger: the alert and an invitation onto the call. */}
        {alerted && !ended && (
          <>
            <span
              className="self-start rounded-[6px] px-2 py-1 text-[14px] font-bold"
              style={{ background: BRAND.peach, color: BRAND.white }}
            >
              Live now
            </span>
            <div className="text-[24px] font-bold leading-[32px] tracking-[-0.02em]">
              {elderCall} may be on a scam call
            </div>
            <div
              className="flex flex-col gap-1 rounded-[20px] p-5"
              style={{ background: BRAND.slate, color: BRAND.white }}
            >
              <div
                className="text-[36px] font-bold leading-[40px] tracking-[-0.02em]"
                style={{ color: BRAND.banana }}
              >
                {KIN_HEADLINE[zone]}
              </div>
              {risk !== null && (
                <div className="text-[16px] font-semibold tabular-nums">{risk}% risk</div>
              )}
            </div>
            {analysis?.plainLanguageWarning && (
              <p className="m-0 text-[16px] font-medium leading-snug">
                {analysis.plainLanguageWarning}
              </p>
            )}

            {joined ? (
              <div
                className="flex flex-col gap-1 rounded-[16px] p-4"
                style={{ background: BRAND.wash }}
              >
                <div className="text-[16px] font-bold">You&apos;re on the call</div>
                <div className="text-[15px] font-medium leading-snug">
                  {elderCall} can hear you. KinSight is still listening.
                </div>
                {analysis && analysis.signals.length > 0 && (
                  <div className="mt-1 text-[14px] font-medium">
                    {analysis.signals.map((s) => TACTIC_LABEL[s.tactic]).join(" · ")}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onJoin}
                className="h-14 w-full rounded-[16px] text-[17px] font-semibold"
                style={{ background: BRAND.slate, color: BRAND.white }}
              >
                Join the call
              </button>
            )}

            <button
              onClick={onTellHangUp}
              disabled={toldHangUp}
              className="h-14 w-full rounded-[16px] text-[17px] font-semibold disabled:opacity-60"
              style={{ background: BRAND.banana, color: BRAND.slate }}
            >
              {toldHangUp ? `${elderCall} sees: ${kinName} says, hang up` : `Tell ${elderCall} to hang up`}
            </button>
          </>
        )}

        {/* After the call: the AI summary, then the survey that scores it. */}
        {ended && (
          <>
            {spamReport && (
              <div
                className="rounded-[14px] px-4 py-3 text-[15px] font-medium leading-snug"
                style={{ background: BRAND.banana }}
              >
                This number is now flagged for every KinSight household:{" "}
                {spamReport.reportCount} {spamReport.reportCount === 1 ? "report" : "reports"},
                last seen {new Date(spamReport.lastReportedAt).toLocaleTimeString()}.
              </div>
            )}

            {alerted && !summary && (
              <div className="text-[16px] font-medium">Writing your summary…</div>
            )}

            {!alerted && (
              <div className="text-[16px] font-medium leading-snug">
                {elderCall} had a call from an unknown number.
                {analysis ? " Nothing worrying came up." : ""}
              </div>
            )}

            {summary && (
              <div className="flex flex-col gap-3">
                <div className="text-[20px] font-bold leading-tight tracking-[-0.02em]">
                  {summary.headline}
                </div>
                <p className="m-0 text-[15px] font-medium leading-snug">
                  {summary.whatHappened}
                </p>
                <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] font-medium leading-snug">
                  {summary.whatToDo.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary && !sent && (
              <div
                className="flex flex-col gap-2.5 rounded-[18px] p-4"
                style={{ background: BRAND.wash }}
              >
                <label htmlFor="kin-notes" className="text-[14px] font-semibold">
                  Was this right?
                </label>
                <textarea
                  id="kin-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything KinSight missed? (optional)"
                  rows={2}
                  className="w-full rounded-[12px] px-3 py-2 text-[14px] font-medium outline-none"
                  style={{ border: `2px solid ${BRAND.slate}`, color: BRAND.slate, background: BRAND.white }}
                />
                {VERDICTS.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => {
                      setSent(v.value);
                      onFeedback(v.value, notes.trim() || null);
                    }}
                    className="h-12 w-full rounded-[14px] text-[15px] font-semibold"
                    style={{
                      background: v.value === "correct" ? BRAND.slate : BRAND.white,
                      color: v.value === "correct" ? BRAND.white : BRAND.slate,
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}

            {sent && (
              <div
                className="flex flex-col gap-1.5 rounded-[18px] p-4 text-[15px] font-medium leading-snug"
                style={{ background: BRAND.wash }}
              >
                <div className="text-[14px] font-bold">Thank you</div>
                {stats ? (
                  <>
                    <div>
                      {stats.correct} of {stats.total} calls graded correct
                      {stats.accuracy !== null && ` (${Math.round(stats.accuracy * 100)}%)`}.
                    </div>
                    <div>
                      Alert threshold is now {Math.round(stats.suggestedThreshold * 100)}%
                      {stats.falseAlarms > stats.missedScams
                        ? ", raised to wake you less often."
                        : stats.missedScams > stats.falseAlarms
                          ? ", lowered to catch more."
                          : "."}
                    </div>
                  </>
                ) : (
                  <div>Saved.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
