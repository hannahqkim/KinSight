import type { FraudTactic, RiskLevel } from "@/lib/schema";

/**
 * Brand tokens from docs/design/README.md. Five colours plus white, nothing
 * else. Applied as inline styles because the values are chosen at runtime from
 * the risk level, and Tailwind cannot see class names it never gets to read.
 */
export const BRAND = {
  banana: "#FFF07C",
  slate: "#1C5253",
  peach: "#E07A5F",
  teal: "#81B29A",
  horizon: "#79ADDC",
  white: "#FFFFFF",
} as const;

/**
 * The meter has three zones; the API has four risk levels. Mapping here, which
 * answers the first open question in the design README: `likely_fraud` and
 * `critical` both read as "Likely a scam." The difference between them changes
 * `recommendedAction`, not what the elder is told — at that point the advice is
 * the same, and a fourth wording would only slow them down.
 */
export type Zone = "normal" | "ask" | "scam";

/**
 * Above this probability the family is notified and invited onto the call.
 * The default is the 50% on the whiteboard; kin feedback moves it, which is
 * what `EvalStats.suggestedThreshold` reports back.
 */
export const KIN_ALERT_THRESHOLD = 0.5;

export const ZONE: Record<
  Zone,
  { label: string; sub: string; color: string; background: string; onBackground: string }
> = {
  normal: {
    label: "Sounds normal.",
    sub: "Nothing has set off a warning yet.",
    color: BRAND.teal,
    background: BRAND.teal,
    onBackground: BRAND.white,
  },
  ask: {
    label: "Something's off.",
    sub: "Ask a question before you do anything.",
    color: BRAND.banana,
    background: BRAND.banana,
    onBackground: BRAND.slate,
  },
  scam: {
    label: "Likely a scam.",
    sub: "Do not send money or share details.",
    color: BRAND.peach,
    background: BRAND.peach,
    onBackground: BRAND.white,
  },
};

export function zoneFor(level: RiskLevel | null): Zone {
  if (level === "critical" || level === "likely_fraud") return "scam";
  if (level === "caution") return "ask";
  return "normal";
}

/** Plain-language tactic names. The enum is closed, so this map is exhaustive. */
export const TACTIC_LABEL: Record<FraudTactic, string> = {
  urgency_pressure: "Rushing you",
  authority_impersonation: "Pretending to be an official",
  threat_of_arrest: "Threatening arrest",
  secrecy_request: "Telling you to keep it secret",
  payment_request: "Asking for money",
  gift_card_payment: "Asking for gift cards",
  wire_transfer: "Asking for a wire transfer",
  crypto_payment: "Asking for crypto",
  remote_access_request: "Wants control of your device",
  personal_info_request: "Asking for personal details",
  banking_credential_request: "Asking for bank details",
  otp_code_request: "Asking for a security code",
  prize_or_lottery: "Prize or lottery claim",
  tech_support_scam: "Fake tech support",
  grandparent_scam: "Pretending to be family",
  romance_scam: "Romance scam",
  charity_scam: "Fake charity",
  caller_id_spoof_indicator: "Caller ID looks faked",
};
