import { BRAND, ZONE, type Zone } from "@/lib/risk";

const BAR_COUNT = 20;

/**
 * The live risk meter: 20 bars that grow taller left to right and light teal →
 * banana → peach, with the state in words underneath.
 *
 * Deliberately no percentage and no tick labels. "68 out of 100" invites an
 * older adult to argue with the number while a scammer is still talking; "Be
 * careful." does not.
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
      className="flex shrink-0 flex-col gap-6"
    >
      <div className="flex h-[72px] items-end gap-1" aria-hidden="true">
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const on = i < filled;
          // Bars colour by their own position, so the ramp itself reads as a
          // scale rather than the whole row flipping to one colour.
          const colour =
            i < BAR_COUNT * 0.35 ? BRAND.teal : i < BAR_COUNT * 0.65 ? BRAND.banana : BRAND.peach;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 20 + i * 2.6,
                borderRadius: 3,
                background: on ? colour : BRAND.wash,
                transition: "background 300ms cubic-bezier(0.32,0.72,0,1)",
              }}
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <div
          className="text-[30px] font-bold leading-[36px] transition-colors duration-700"
          style={{ color: zone === "scam" ? BRAND.peach : BRAND.slate }}
        >
          {probability === null ? (listening ? "Listening for anything wrong." : "Ready.") : style.label}
        </div>
        {probability !== null && style.sub && (
          <div className="text-[20px] font-semibold leading-[28px]">{style.sub}</div>
        )}
      </div>
    </div>
  );
}

/** The small animated bars that show KinSight is hearing something. */
export function ListeningWave({ active }: { active: boolean }) {
  return (
    <div className="flex h-6 w-16 items-center gap-[3px]" aria-hidden="true">
      {[14, 22, 10, 24, 18, 20, 12, 16].map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: active ? h : 4,
            borderRadius: 2,
            background: BRAND.teal,
            transition: "height 140ms",
            animation: active ? `kin-wave 900ms ease-in-out ${i * 90}ms infinite` : undefined,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Live microphone input level.
 *
 * The risk meter cannot move until a window has been recorded and a model has
 * answered, which is fifteen seconds or so into a call. Until then this is the
 * only thing on screen that proves KinSight is hearing anything — it tracks the
 * waveform, so it moves while you talk and sits flat when the microphone is
 * muted, dead, or pointed at a silent room.
 */
export function MicLevel({ level }: { level: number }) {
  const lit = Math.round(level * 12);
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 items-end gap-[3px]" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            style={{
              width: 5,
              height: 8 + (i / 12) * 20,
              borderRadius: 2,
              background: i < lit ? BRAND.teal : BRAND.wash,
              transition: "background 90ms linear",
            }}
          />
        ))}
      </div>
      <div className="text-[16px] font-medium">
        {lit > 0 ? "I can hear you." : "I can't hear anything yet."}
      </div>
    </div>
  );
}
