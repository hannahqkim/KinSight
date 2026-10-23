"use client";

import { useState } from "react";
import { BRAND, TACTIC_LABEL } from "@/lib/risk";
import type { CallAnalysis, EvalStats, EvalVerdict, KinSummary, SpamReport } from "@/lib/schema";

const VERDICTS: { value: EvalVerdict; label: string }[] = [
  { value: "correct", label: "KinSight got it right" },
  { value: "false_alarm", label: "False alarm — it was fine" },
  { value: "missed_scam", label: "It missed something" },
];

/**
 * The family member's phone.
 *
 * Cool Horizon throughout, per the design system's "family-side info" role, so
 * it never competes with the elder's screen for the same meaning.
 */
export function KinPanel({
  alerted,
  joined,
  ended,
  analysis,
  summary,
  spamReport,
  stats,
  onJoin,
  onFeedback,
}: {
  alerted: boolean;
  joined: boolean;
  ended: boolean;
  analysis: CallAnalysis | null;
  summary: KinSummary | null;
  spamReport: SpamReport | null;
  stats: EvalStats | null;
  onJoin: () => void;
  onFeedback: (verdict: EvalVerdict, notes: string | null) => void;
}) {
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState<EvalVerdict | null>(null);

  return (
    <section
      className="w-full max-w-sm shrink-0 overflow-hidden rounded-[28px]"
      style={{ background: BRAND.white, border: `3px solid ${BRAND.horizon}` }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: BRAND.horizon, color: BRAND.white }}
      >
        <div className="text-[13px] font-bold uppercase tracking-[0.06em]">Sarah&apos;s phone</div>
        <div className="text-[12px] font-medium opacity-90">Mom&apos;s kin</div>
      </div>

      <div className="flex flex-col gap-4 p-5" style={{ color: BRAND.slate }}>
        {!alerted && !ended && (
          <div className="text-[16px] font-medium leading-snug">
            Watching over Mom&apos;s calls. You&apos;ll only hear from KinSight if
            something looks wrong.
          </div>
        )}

        {/* The >50% trigger from the whiteboard. */}
        {alerted && !joined && !ended && (
          <>
            <div
              className="flex flex-col gap-1.5 rounded-[18px] p-4"
              style={{ border: `2px solid ${BRAND.peach}` }}
            >
              <div className="text-[12px] font-bold uppercase tracking-[0.06em]">
                KinSight · now
              </div>
              <div className="text-[19px] font-extrabold leading-tight tracking-[-0.03em]">
                Mom is on a call that looks like a scam.
              </div>
              <div className="text-[15px] font-medium leading-snug">
                {analysis?.plainLanguageWarning}
              </div>
            </div>
            <button
              onClick={onJoin}
              className="h-14 w-full rounded-[16px] text-[17px] font-bold"
              style={{ background: BRAND.slate, color: BRAND.white }}
            >
              Join the call
            </button>
          </>
        )}

        {joined && !ended && (
          <div
            className="flex flex-col gap-1.5 rounded-[18px] p-4"
            style={{ background: BRAND.horizon, color: BRAND.white }}
          >
            <div className="text-[12px] font-bold uppercase tracking-[0.06em]">
              You&apos;re on the call
            </div>
            <div className="text-[16px] font-medium leading-snug">
              Mom can hear you. KinSight is still listening.
            </div>
            {analysis && (
              <div className="mt-1 text-[14px] font-medium">
                {analysis.signals.map((s) => TACTIC_LABEL[s.tactic]).join(" · ")}
              </div>
            )}
          </div>
        )}

        {/* After the call: the AI summary, then the survey that scores it. */}
        {ended && (
          <>
            {spamReport && (
              <div
                className="rounded-[14px] px-4 py-3 text-[15px] font-medium leading-snug"
                style={{ background: BRAND.banana }}
              >
                This number is now flagged for every KinSight household —{" "}
                {spamReport.reportCount} {spamReport.reportCount === 1 ? "report" : "reports"},
                last seen {new Date(spamReport.lastReportedAt).toLocaleTimeString()}.
              </div>
            )}

            {!summary && (
              <div className="text-[16px] font-medium">Writing your summary…</div>
            )}

            {summary && (
              <div className="flex flex-col gap-3">
                <div className="text-[19px] font-extrabold leading-tight tracking-[-0.03em]">
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
                style={{ border: `2px solid ${BRAND.horizon}` }}
              >
                <div className="text-[12px] font-bold uppercase tracking-[0.06em]">
                  Was this right?
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything KinSight missed? (optional)"
                  rows={2}
                  className="w-full rounded-[12px] px-3 py-2 text-[14px] font-medium outline-none"
                  style={{ border: `2px solid ${BRAND.horizon}`, color: BRAND.slate }}
                />
                {VERDICTS.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => {
                      setSent(v.value);
                      onFeedback(v.value, notes.trim() || null);
                    }}
                    className="h-12 w-full rounded-[14px] text-[15px] font-bold"
                    style={{
                      background: v.value === "correct" ? BRAND.slate : BRAND.white,
                      color: v.value === "correct" ? BRAND.white : BRAND.slate,
                      border: `2px solid ${BRAND.slate}`,
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
                style={{ background: BRAND.teal, color: BRAND.white }}
              >
                <div className="text-[12px] font-bold uppercase tracking-[0.06em]">
                  Thank you
                </div>
                {stats ? (
                  <>
                    <div>
                      {stats.correct} of {stats.total} calls graded correct
                      {stats.accuracy !== null && ` (${Math.round(stats.accuracy * 100)}%)`}.
                    </div>
                    <div>
                      Alert threshold is now {Math.round(stats.suggestedThreshold * 100)}%
                      {stats.falseAlarms > stats.missedScams
                        ? " — raised, to wake you less often."
                        : stats.missedScams > stats.falseAlarms
                          ? " — lowered, to catch more."
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
