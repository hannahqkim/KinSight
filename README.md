# KinSight

Fraud detection for independent older adults living alone.

An elder gets a call. KinSight scores it for fraud in real time, checks whether
the number is really the police department / hospital / delivery service it
claims to be, and — if it was a scam — drafts the incident report so filing one
is not another barrier.

## The three pieces

| Piece | What it does | Endpoint |
|---|---|---|
| **Call detection** | transcript → P(fraud), named tactics, plain-language warning | `POST /api/calls/analyze` |
| **Verification engine** | number → trusted registry lookup; claims → supported/contradicted | `POST /api/verify/number`, `POST /api/verify/claim` |
| **Report drafting** | call + analysis → filable police / FTC report | `POST /api/reports/police` |

Transcription (`POST /api/transcribe`) feeds the first one.

Calls the system is built to tell apart: spam, deliveries, law enforcement,
family and friends, doctors and hospitals, and strangers it has no prior on.
Flagging a real doctor as a scam is not a free mistake — it isolates the person
the product exists to protect — so the detector is tuned to be calibrated, not
merely cautious.

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your key
npm run dev
```

Get a Gemini key at <https://aistudio.google.com/apikey>. `.env.local` is
gitignored; never commit a real key.

Model availability varies by key — `gemini-2.5-*` is already retired for newly
issued ones. Defaults are `gemini-3.8-flash` (scoring, claims, transcription) and
`gemini-pro-latest` (report drafting), both overridable in `.env.local`. To see
what a key can actually call:

```bash
curl -s -H "x-goog-api-key: $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models | jq -r '.models[].name'
```

```bash
npm run typecheck   # tsc --noEmit
npm run build
npm run lint
```

## Layout

```
src/lib/schema.ts      the API contract — zod schemas + inferred types
src/lib/gemini.ts      Gemini client, model selection, structured output
src/lib/registry.ts    trusted-number lookup (DEMO SEED — replace before pilot)
src/lib/http.ts        request parsing, response envelope, error mapping
src/app/api/…          one route per endpoint
docs/API.md            the contract, explained
```

Both sides of the stack import types from `src/lib/schema.ts`. Change a shape
there and anything that disagrees fails to compile — that is the point. Frontend
can mock against those types without waiting on the backend.

## Known gaps

The registry is a seed table, not real data. Nothing is authenticated, nothing is
persisted, and `partial: true` call scoring has no streaming transport behind it
yet. `docs/API.md` lists these in full under "Not in the contract yet" — read it
before building on top.

## Try one endpoint

```bash
curl -s localhost:3000/api/verify/number \
  -H 'content-type: application/json' \
  -d '{"phoneNumber":"+12025550147","claimedCategory":"law_enforcement"}' | jq
```
