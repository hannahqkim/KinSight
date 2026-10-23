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

## Happy path

```
record audio
  -> POST /api/transcribe          -> Transcript
  -> POST /api/verify/number       -> NumberVerification   (parallel, no model call)
  -> POST /api/calls/analyze       -> CallAnalysis
  -> POST /api/verify/claim        -> ClaimVerdict[]        (uses extractedClaims)
  -> POST /api/reports/police      -> PoliceReport          (only if user asks)
```

## Not in the contract yet

Decide these before building on them:

- **Auth.** Every route is currently open. Needs at minimum a session before any
  real audio touches it.
- **Persistence.** Nothing is stored; each call is stateless. A `calls` table has
  to exist before history, family alerts, or repeat-caller detection work.
- **Live streaming.** `partial: true` exists in the schema but the transport is
  request/response. Real-time scoring needs WebSocket or SSE.
- **Family alert fan-out.** `hang_up_and_alert_family` is a recommended action with
  no delivery mechanism behind it.
- **Contacts.** `inContacts` is passed by the client today and always `false`
  server-side. Contacts should stay on device.
