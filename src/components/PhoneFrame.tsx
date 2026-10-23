import type { ReactNode } from "react";
import { BRAND } from "@/lib/risk";

/**
 * iPhone-proportioned chrome (390x844 points). `background` is full-bleed so a
 * verdict screen can own the whole display, which is the point of the colour
 * system: the state is the screen, not a badge on it.
 */
export function PhoneFrame({
  children,
  owner,
  background = BRAND.white,
  foreground = BRAND.slate,
}: {
  children: ReactNode;
  /** Whose phone this is (a first name), shown in the status bar: onboarding starts on the family member's. */
  owner: string;
  background?: string;
  foreground?: string;
}) {
  return (
    <div className="relative shrink-0" style={{ width: 390, height: 844 }}>
      <div className="absolute inset-0 rounded-[3.2rem] bg-black shadow-[0_40px_120px_rgba(0,0,0,0.6)] ring-1 ring-white/15" />
      <div
        className="absolute inset-[3px] overflow-hidden rounded-[3.05rem]"
        style={{ background, color: foreground, transition: "background 400ms ease" }}
      >
        <div className="relative flex h-full flex-col">
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-[26px] w-[104px] -translate-x-1/2 rounded-full bg-black" />
          <div
            className="flex items-center justify-between px-8 pb-1 pt-3 text-[13px] font-bold"
            style={{ color: foreground }}
          >
            <span>9:41</span>
            <span>{owner}</span>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
          <div className="flex justify-center pb-2 pt-1">
            <div
              className="h-[5px] w-[134px] rounded-full"
              style={{ background: foreground, opacity: 0.25 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
