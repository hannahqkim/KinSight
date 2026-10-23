# KinSight API contract

**Source of truth is [`src/lib/schema.ts`](../src/lib/schema.ts), not this file.**
This document explains the shapes; the zod schemas enforce them. If the two
disagree, the code wins — open a PR against the schema, not against the doc.

Base URL in development: `http://localhost:3000`

## Ground rules

1. Every route is `POST`, takes JSON, returns JSON.
2. Every response is one of exactly two shapes:
   ```ts
   { ok: true,  data: <endpoint payload> }
   { ok: false, error: { code, message, details? } }
   ```
   Frontend: branch on `ok` first, always. Never read `data` without the check.
3. `error.code` is one of `bad_request | unauthorized | not_found | rate_limited |
   upstream_error | internal_error`. Validation failures are `bad_request` with
   `details` set to the zod issue list.
4. Phone numbers are **E.164 strings** (`+14155550123`) everywhere, or `null` for
   withheld caller ID. No other format is accepted.
5. Timestamps are ISO-8601 UTC strings.
6. Money is **integer cents**. No floats.
7. Probabilities and confidences are floats in `[0, 1]`.

## Importing the types

```ts
import type { CallAnalysis, NumberVerification } from "@/lib/schema";
import { AnalyzeCallRequest } from "@/lib/schema"; // runtime schema, for forms
```

Frontend work does not need to wait on the backend: mock against these types and
the swap is a one-line change in the fetch call.

---

## 1. `POST /api/calls/analyze` — call text to P(fraud)

The core detector. Accepts a finished or in-progress call.

**Request**

| field | type | notes |
|---|---|---|
| `callId` | `string` | your correlation id, any format |
| `text` | `string?` | raw transcript — provide this **or** `segments` |
| `segments` | `TranscriptSegment[]?` | diarized form, preferred |
| `callerNumber` | `E164 \| null` | default `null` |
| `inContacts` | `boolean` | default `false`; big signal, pass it if you know |
| `partial` | `boolean` | default `false`; `true` while the call is live |

**Response `data`: `CallAnalysis`**

| field | type | notes |
|---|---|---|
| `fraudProbability` | `0..1` | the number the UI shows |
| `riskLevel` | `safe \| caution \| likely_fraud \| critical` | thresholded bucket |
| `claimedCategory` | `CallerCategory` | what the caller claims to be |
| `signals` | `FraudSignal[]` | `{ tactic, evidence, confidence }`, evidence is a verbatim quote |
| `extractedClaims` | `string[]` | feed straight into `/api/verify/claim` |
| `plainLanguageWarning` | `string` | one sentence, 6th-grade reading level, show verbatim |
| `recommendedAction` | enum | see schema; drives the primary button |
| `callerNumber`, `callId`, `modelVersion`, `analyzedAt` | | server-set |

`FraudTactic` is a **closed enum** (18 values). The UI maps each to an
explanation and an icon — adding a tactic means updating both sides.

---

## 2. `POST /api/verify/number` — is this number who it says it is?

Deterministic registry lookup. No model call, so it is fast and cheap — call it
before `analyze` when you have the number.

**Request:** `{ phoneNumber, claimedIdentity?, claimedCategory? }`

**Response `data`: `NumberVerification`**

- `verdict`: `verified` (in a trusted registry and matches the claim) ·
  `mismatch` (registry says a *different* org — strong spoof tell) ·
  `unknown` (no record) · `known_fraud` (on a fraud list)
- `registryMatch`: `{ name, category, source, sourceUrl? } | null`
- `spamReportCount`, `inContacts`, `confidence`
- `officialCallbackNumber`: the number the user should dial **instead**. When this
  is non-null the UI should offer "hang up and call them back" as the primary action.

> Backed by a seed table in `src/lib/registry.ts`. Swap the lookup for real data
> (NPPES, state police directories, FTC Sentinel) without touching this contract.

---

## 3. `POST /api/verify/claim` — does the story hold up?

**Request:** `{ claims: string[], callerNumber?, callId? }`
Pass `extractedClaims` from step 1 straight in.

**Response `data`:** `{ callId, verdicts: ClaimVerdict[], checkedAt }`
where `ClaimVerdict = { claim, status, evidence[], confidence }` and `status` is
`supported | unsupported | contradicted | unverifiable`.

A claim is never `supported` on the caller's own say-so.

---

## 4. `POST /api/transcribe` — audio to transcript

**Request:** `{ callId, audioBase64, mimeType, language? }`
`mimeType` ∈ `audio/wav | audio/mp3 | audio/mpeg | audio/webm | audio/ogg | audio/m4a`.

Keep inline uploads under ~15 MB. Longer recordings need the Gemini Files API —
not wired yet.

**Response `data`: `Transcript`** = `{ transcriptId, callId, language, durationMs, segments[] }`

Transcription is verbatim on purpose: `analyze` quotes these words as evidence,
so cleaning them up would break the audit trail.

---

## 5. `POST /api/reports/police` — incident report draft

**Request:** `{ callId, transcript, analysis, reporter?, financialLossCents? }`
Pass the **whole** `Transcript` and `CallAnalysis` objects from steps 4 and 1.

**Response `data`: `PoliceReport`** — `markdown` is the filable body, plus
`summary`, `suspectDetails`, `financialLossCents`, `recommendedAgencies[]`.

Unknown fields come back `null` rather than guessed. A report with gaps is
filable; a report with invented facts is not.

---

---

## 6. `POST /api/registry/report` — close the loop

Called when a call ends in a scam verdict. Deterministic, no model call.

**Request:** `{ phoneNumber, callId, tactics[] }`
**Response `data`:** `{ report: SpamReport, verification: NumberVerification }`

`SpamReport` carries `reportCount`, `callIds[]`, `tactics[]`, `firstReportedAt`
and `lastReportedAt`. Reports are deduplicated by `callId`, so replaying one call
during a demo cannot inflate the count.

The returned `verification` is what a fresh `/api/verify/number` would now give
for that number — the proof the loop closed.

> Never call this for a legitimate call. A number written to a fraud list is hard
> to unwrite, and the cost lands on whoever actually owns it.

---

## 7. `POST /api/reports/kin` — the summary the family gets

**Request:** `{ callId, transcript, analysis, elderName? }`
**Response `data`: `KinSummary`** — `{ headline, whatHappened, whatToDo[] }`

Written to the family member about their relative, never to the elder. If nothing
was lost, that goes in the first sentence — it is what the reader most needs.

---

## 8. `POST /api/evals/feedback` — human in the loop

**Request:** `{ callId, phoneNumber, modelProbability, modelRiskLevel, kinVerdict, notes? }`
where `kinVerdict` is `correct | false_alarm | missed_scam`.

**Response `data`: `EvalStats`** — `{ total, correct, falseAlarms, missedScams,
accuracy, suggestedThreshold }`.

`suggestedThreshold` is where the kin-alert bar should sit given all feedback so
far, clamped to `[0.25, 0.8]` so it can neither silence the alert nor fire on
every call. This is the honest extent of "the model learns": the weights are
Google's, but the threshold, the eval set and the registry are ours.

---

## Happy path

```
record audio
  -> POST /api/transcribe          -> Transcript
  -> POST /api/verify/number       -> NumberVerification   (parallel, no model call)
  -> POST /api/calls/analyze       -> CallAnalysis
  -> POST /api/verify/claim        -> ClaimVerdict[]        (uses extractedClaims)
  -> POST /api/reports/police      -> PoliceReport          (only if user asks)

on a scam verdict, the loop closes:
  -> POST /api/registry/report     -> SpamReport + fresh NumberVerification
  -> POST /api/reports/kin         -> KinSummary
  -> POST /api/evals/feedback      -> EvalStats (moves the alert threshold)
```

## Not in the contract yet

Decide these before building on them:

- **Auth.** Every route is currently open. Needs at minimum a session before any
  real audio touches it.
- **Persistence.** Nothing is stored; each call is stateless. A `calls` table has
  to exist before history, family alerts, or repeat-caller detection work.
- **Live streaming.** `partial: true` exists in the schema but the transport is
  request/response. Real-time scoring needs WebSocket or SSE.
- **Family alert fan-out.** The kin alert fires in the UI above
  `KIN_ALERT_THRESHOLD`, but there is no push delivery behind it — no APNs, no SMS.
- **The spam DB is a JSON file** (`src/lib/store.ts`, gitignored at `.data/`). It
  survives restarts, which is enough to demo the loop, and is not a database.
  Nothing authenticates a report, so anyone could poison the list.
- **Contacts.** `inContacts` is passed by the client today and always `false`
  server-side. Contacts should stay on device.
