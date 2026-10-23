/**
 * KinSight shared API schema.
 *
 * Single source of truth for every request/response crossing the network.
 * Frontend imports the inferred types; route handlers parse with the zod
 * schemas. If you change a shape here, both sides break at compile time —
 * that is the point.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** E.164, e.g. "+14155550123". Unknown/withheld caller ID is `null`. */
export const PhoneNumber = z.string().regex(/^\+[1-9]\d{6,14}$/, {
  message: "phone number must be E.164, e.g. +14155550123",
});

/** ISO-8601 UTC timestamp. */
export const Timestamp = z.string();

export const RiskLevel = z.enum(["safe", "caution", "likely_fraud", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

/** What the caller claims to be. Drives which registry we verify against. */
export const CallerCategory = z.enum([
  "law_enforcement",
  "healthcare",
  "government",
  "financial_institution",
  "delivery",
  "utility",
  "known_contact",
  "telemarketer",
  "unknown",
]);
export type CallerCategory = z.infer<typeof CallerCategory>;

/** Fraud tactics the detector is trained to name. Closed set on purpose: the
 *  UI maps each one to a plain-language explanation for the user. */
export const FraudTactic = z.enum([
  "urgency_pressure",
  "authority_impersonation",
  "threat_of_arrest",
  "secrecy_request",
  "payment_request",
  "gift_card_payment",
  "wire_transfer",
  "crypto_payment",
  "remote_access_request",
  "personal_info_request",
  "banking_credential_request",
  "otp_code_request",
  "prize_or_lottery",
  "tech_support_scam",
  "grandparent_scam",
  "romance_scam",
  "charity_scam",
  "caller_id_spoof_indicator",
]);
export type FraudTactic = z.infer<typeof FraudTactic>;

export const Speaker = z.enum(["caller", "user", "unknown"]);

export const TranscriptSegment = z.object({
  speaker: Speaker,
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegment>;

export const Transcript = z.object({
  transcriptId: z.string(),
  callId: z.string(),
  language: z.string().default("en-US"),
  durationMs: z.number().int().nonnegative(),
  segments: z.array(TranscriptSegment),
});
export type Transcript = z.infer<typeof Transcript>;

/* ------------------------------------------------------------------ */
/* Envelope — every route returns exactly one of these                 */
/* ------------------------------------------------------------------ */

export const ApiError = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum([
      "bad_request",
      "unauthorized",
      "not_found",
      "rate_limited",
      "upstream_error",
      "internal_error",
    ]),
    message: z.string(),
    /** zod issue list when code === "bad_request". */
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export function apiOk<T extends z.ZodTypeAny>(data: T) {
  return z.object({ ok: z.literal(true), data });
}

export type ApiResponse<T> = { ok: true; data: T } | ApiError;

/* ------------------------------------------------------------------ */
/* 1. POST /api/calls/analyze — call text -> P(fraud)                  */
/* ------------------------------------------------------------------ */

export const FraudSignal = z.object({
  tactic: FraudTactic,
  /** Verbatim span from the transcript that triggered this signal. */
  evidence: z.string(),
  /** 0..1 — how sure the model is this tactic is present. */
  confidence: z.number().min(0).max(1),
});
export type FraudSignal = z.infer<typeof FraudSignal>;

export const AnalyzeCallRequest = z.object({
  callId: z.string(),
  /** Either raw text or structured segments. At least one required. */
  text: z.string().optional(),
  segments: z.array(TranscriptSegment).optional(),
  callerNumber: PhoneNumber.nullable().default(null),
  /** True if callerNumber matches an entry in the user's contacts. */
  inContacts: z.boolean().default(false),
  /** Set when the call is still live and we are scoring incrementally. */
  partial: z.boolean().default(false),
  /**
   * True if the household agreed a family code during setup. Deliberately a
   * boolean: the code itself is never sent to the server or the model. The app
   * asks the question, the user confirms the answer locally.
   *
   * The UI calls this the KinCode, and "family code" when it is said out loud
   * (see docs/design/README.md — "safe word" carries a sexual meaning for many
   * adults). The field name is kept as `safeWordAvailable` because teammates
   * already code against it; renaming the contract is a separate call for the
   * team to make.
   */
  safeWordAvailable: z.boolean().default(false),
}).refine((v) => Boolean(v.text) || Boolean(v.segments?.length), {
  message: "provide `text` or non-empty `segments`",
});
export type AnalyzeCallRequest = z.input<typeof AnalyzeCallRequest>;

export const CallAnalysis = z.object({
  callId: z.string(),
  /** The number that was scored, echoed back so downstream consumers
   *  (police report, family alert) do not have to re-join on callId. */
  callerNumber: PhoneNumber.nullable(),
  /** 0..1. The single number the UI shows. */
  fraudProbability: z.number().min(0).max(1),
  riskLevel: RiskLevel,
  claimedCategory: CallerCategory,
  signals: z.array(FraudSignal),
  /** Factual assertions worth checking, e.g. "I am Officer Reed, badge 4471". */
  extractedClaims: z.array(z.string()),
  /** One sentence, 6th-grade reading level, shown to the elder directly. */
  plainLanguageWarning: z.string(),
  /**
   * What to ask the caller RIGHT NOW, in the user's own voice. Two or three,
   * shortest first. A real caller answers these without friction; a scammer
   * stalls, deflects, or escalates — which is the point.
   *
   * When the household has a family code (the KinCode), the model is told only
   * that one EXISTS (see `safeWordAvailable`) so it can suggest asking for it.
   * The code itself never leaves the device.
   */
  suggestedQuestions: z.array(z.string()),
  recommendedAction: z.enum([
    "no_action",
    "stay_alert",
    "hang_up",
    "hang_up_and_call_back_official_number",
    "hang_up_and_alert_family",
    "report_to_authorities",
  ]),
  modelVersion: z.string(),
  analyzedAt: Timestamp,
});
export type CallAnalysis = z.infer<typeof CallAnalysis>;

export const AnalyzeCallResponse = apiOk(CallAnalysis);

/* ------------------------------------------------------------------ */
/* 2. POST /api/verify/number — is this number who it says it is?      */
/* ------------------------------------------------------------------ */

export const RegistryMatch = z.object({
  name: z.string(),
  category: CallerCategory,
  /** Which dataset produced the match, e.g. "ca_police_directory". */
  source: z.string(),
  sourceUrl: z.string().optional(),
});

export const VerifyNumberRequest = z.object({
  phoneNumber: PhoneNumber,
  /** What the caller said they were, if known. Enables mismatch detection. */
  claimedIdentity: z.string().optional(),
  claimedCategory: CallerCategory.optional(),
});
export type VerifyNumberRequest = z.input<typeof VerifyNumberRequest>;

export const NumberVerification = z.object({
  phoneNumber: PhoneNumber,
  verdict: z.enum([
    /** Number is in a trusted registry and matches the claim. */
    "verified",
    /** Number is in a trusted registry but NOT the claimed org — spoof tell. */
    "mismatch",
    /** No record either way. */
    "unknown",
    /** Number appears on a fraud/spam list. */
    "known_fraud",
  ]),
  registryMatch: RegistryMatch.nullable(),
  inContacts: z.boolean(),
  spamReportCount: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  /** The number the user should dial instead, when we know the real one. */
  officialCallbackNumber: PhoneNumber.nullable(),
  checkedAt: Timestamp,
});
export type NumberVerification = z.infer<typeof NumberVerification>;

export const VerifyNumberResponse = apiOk(NumberVerification);

/* ------------------------------------------------------------------ */
/* 3. POST /api/verify/claim — does the story hold up?                 */
/* ------------------------------------------------------------------ */

export const VerifyClaimRequest = z.object({
  callId: z.string().optional(),
  claims: z.array(z.string()).min(1),
  callerNumber: PhoneNumber.nullable().default(null),
});
export type VerifyClaimRequest = z.input<typeof VerifyClaimRequest>;

export const ClaimVerdict = z.object({
  claim: z.string(),
  status: z.enum(["supported", "unsupported", "contradicted", "unverifiable"]),
  /** Short human-readable reasons, each ideally citing a source. */
  evidence: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type ClaimVerdict = z.infer<typeof ClaimVerdict>;

export const VerifyClaimResponse = apiOk(
  z.object({
    callId: z.string().nullable(),
    verdicts: z.array(ClaimVerdict),
    checkedAt: Timestamp,
  }),
);

/* ------------------------------------------------------------------ */
/* 4. POST /api/transcribe — audio -> transcript                       */
/* ------------------------------------------------------------------ */

export const TranscribeRequest = z.object({
  callId: z.string(),
  /** Base64 audio payload. Keep under ~15MB; larger uploads need the Files API. */
  audioBase64: z.string(),
  mimeType: z.enum([
    "audio/wav",
    "audio/mp3",
    "audio/mpeg",
    "audio/webm",
    "audio/ogg",
    "audio/m4a",
    // Safari's MediaRecorder emits this one.
    "audio/mp4",
  ]),
  language: z.string().default("en-US"),
});
export type TranscribeRequest = z.input<typeof TranscribeRequest>;

export const TranscribeResponse = apiOk(Transcript);

/* ------------------------------------------------------------------ */
/* 5. POST /api/reports/police — incident report draft                 */
/* ------------------------------------------------------------------ */

export const PoliceReportRequest = z.object({
  callId: z.string(),
  transcript: Transcript,
  analysis: CallAnalysis,
  reporter: z
    .object({
      name: z.string().optional(),
      phone: PhoneNumber.optional(),
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
  /** Money already lost, in cents. Omit if none. */
  financialLossCents: z.number().int().nonnegative().optional(),
});
export type PoliceReportRequest = z.input<typeof PoliceReportRequest>;

export const PoliceReport = z.object({
  reportId: z.string(),
  callId: z.string(),
  /** Full report body, markdown. Printable / attachable as-is. */
  markdown: z.string(),
  summary: z.string(),
  incidentAt: Timestamp,
  suspectDetails: z.object({
    claimedName: z.string().nullable(),
    claimedOrganization: z.string().nullable(),
    callerNumber: PhoneNumber.nullable(),
    paymentInstructions: z.array(z.string()),
  }),
  financialLossCents: z.number().int().nonnegative().nullable(),
  recommendedAgencies: z.array(
    z.object({ name: z.string(), url: z.string().optional(), phone: z.string().optional() }),
  ),
  generatedAt: Timestamp,
});
export type PoliceReport = z.infer<typeof PoliceReport>;

export const PoliceReportResponse = apiOk(PoliceReport);

/* ------------------------------------------------------------------ */
/* 6. POST /api/registry/report — the loop closes here                 */
/* ------------------------------------------------------------------ */

/**
 * A number reported by a household that escaped a scam. This is what makes the
 * registry get better: every call that ends in a scam verdict writes the number
 * back, so the next household's `/api/verify/number` lookup already knows.
 */
export const SpamReport = z.object({
  phoneNumber: PhoneNumber,
  reportCount: z.number().int().positive(),
  /** Deduplicated, so replaying one call cannot inflate the count. */
  callIds: z.array(z.string()),
  tactics: z.array(FraudTactic),
  firstReportedAt: Timestamp,
  lastReportedAt: Timestamp,
});
export type SpamReport = z.infer<typeof SpamReport>;

export const ReportNumberRequest = z.object({
  phoneNumber: PhoneNumber,
  callId: z.string(),
  tactics: z.array(FraudTactic).default([]),
});
export type ReportNumberRequest = z.input<typeof ReportNumberRequest>;

export const ReportNumberResponse = apiOk(
  z.object({ report: SpamReport, verification: NumberVerification }),
);

/* ------------------------------------------------------------------ */
/* 7. POST /api/reports/kin — the summary the family receives          */
/* ------------------------------------------------------------------ */

export const KinSummaryRequest = z.object({
  callId: z.string(),
  transcript: Transcript,
  analysis: CallAnalysis,
  /** What the elder is called, for a summary that reads like a person wrote it. */
  elderName: z.string().optional(),
});
export type KinSummaryRequest = z.input<typeof KinSummaryRequest>;

export const KinSummary = z.object({
  callId: z.string(),
  /** One line, as it would appear in a push notification. */
  headline: z.string(),
  whatHappened: z.string(),
  /** Concrete next steps for the family member, not the elder. */
  whatToDo: z.array(z.string()),
  generatedAt: Timestamp,
});
export type KinSummary = z.infer<typeof KinSummary>;

export const KinSummaryResponse = apiOk(KinSummary);

/* ------------------------------------------------------------------ */
/* 8. POST /api/evals/feedback — human in the loop                     */
/* ------------------------------------------------------------------ */

/**
 * The kin's verdict on the detector's verdict. Three options rather than a
 * star rating, because the two ways of being wrong have opposite fixes: a false
 * alarm should raise the alert threshold, a missed scam should lower it.
 */
export const EvalVerdict = z.enum(["correct", "false_alarm", "missed_scam"]);
export type EvalVerdict = z.infer<typeof EvalVerdict>;

export const EvalFeedbackRequest = z.object({
  callId: z.string(),
  phoneNumber: PhoneNumber.nullable().default(null),
  modelProbability: z.number().min(0).max(1),
  modelRiskLevel: RiskLevel,
  kinVerdict: EvalVerdict,
  notes: z.string().nullable().default(null),
});
export type EvalFeedbackRequest = z.input<typeof EvalFeedbackRequest>;

export const EvalStats = z.object({
  total: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  falseAlarms: z.number().int().nonnegative(),
  missedScams: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1).nullable(),
  /**
   * Where the kin-alert threshold should sit given the feedback so far. This is
   * what "the model gets better" actually means here: the weights are Google's
   * and cannot be updated from this app, but the threshold, the eval set and
   * the registry are all ours.
   */
  suggestedThreshold: z.number().min(0).max(1),
});
export type EvalStats = z.infer<typeof EvalStats>;

export const EvalFeedbackResponse = apiOk(EvalStats);
