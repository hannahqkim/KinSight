import { BRAND, ZONE, type Zone } from "@/lib/risk";

const BAR_COUNT = 24;

/**
 * The live risk meter: 24 bars that fill left to right and shift teal → banana
 * → peach, captioned with words.
 *
 * Deliberately no percentage. "68 out of 100" invites an older adult to argue
 * with the number while a scammer is still talking; "Something's off." does not.
 */
export function RiskMeter({
  probability,
  zone,
  listening,
}: {
  probability: number | null;
  zone: Zone;
  listening: boolean;
}) {
  const style = ZONE[zone];
  const filled = probability === null ? 0 : Math.round(probability * BAR_COUNT);

  return (
    <div
      role="meter"
      aria-label="Scam risk"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={probability === null ? 0 : Math.round(probability * 100)}
      aria-valuetext={style.label}
      style={{ borderRadius: 22, background: BRAND.slate, color: BRAND.white }}
      className="flex shrink-0 flex-col gap-3.5 px-5 pb-4 pt-5"
    >
      <div className="flex flex-col gap-1">
        <div className="text-[13px] font-medium uppercase tracking-[0.06em]">
          Scam risk, live
        </div>
        <div
          className="text-[34px] font-black leading-none tracking-[-0.045em] transition-colors duration-300"
          style={{ color: style.color }}
        >
          {probability === null ? (listening ? "Listening." : "Ready.") : style.label}
        </div>
        <div className="text-[17px] font-medium">
          {probability === null ? "I'll tell you if something sounds wrong." : style.sub}
        </div>
      </div>

      <div className="flex h-16 items-end gap-1" aria-hidden="true">
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const on = i < filled;
          // Bars colour by their own position, so the ramp itself reads as a
          // scale rather than the whole row flipping to one colour.
          const colour =
            i < BAR_COUNT * 0.42 ? BRAND.teal : i < BAR_COUNT * 0.72 ? BRAND.banana : BRAND.peach;
          return (
            <div
              key={i}
              style={{
                width: 9,
                height: 18 + (i / BAR_COUNT) * 46,
                borderRadius: 3,
                background: on ? colour : BRAND.white,
                opacity: on ? 1 : 0.18,
                transition: "background 120ms, opacity 120ms",
              }}
            />
          );
        })}
      </div>

      <div
        className="grid grid-cols-3 gap-1 text-[12px] font-medium uppercase tracking-[0.06em]"
        aria-hidden="true"
      >
        <div>Normal</div>
        <div className="text-center">Ask first</div>
        <div className="text-right">Scam</div>
      </div>
    </div>
  );
}

/** The small animated bars that show KinSight is hearing something. */
export function ListeningWave({ active }: { active: boolean }) {
  return (
    <div className="flex h-8 w-[72px] items-center gap-[3px]" aria-hidden="true">
      {[14, 22, 10, 28, 18, 24, 12, 20].map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: active ? h : 4,
            borderRadius: 2,
            background: BRAND.horizon,
            transition: "height 140ms",
            animation: active ? `kin-wave 900ms ease-in-out ${i * 90}ms infinite` : undefined,
          }}
        />
      ))}
    </div>
  );
}
