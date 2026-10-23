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

## User journey

The five steps the demo walks through, and what the product is doing at each.

**1 · Family sets up the app** — they agree a safe word together. It is written to
`localStorage` and never leaves the device: not to our server, not to the model.
The analyze endpoint is told only that one *exists* (`safeWordAvailable: true`),
which is enough for it to suggest asking.

**2 · The phone rings** — an unknown number. `POST /api/verify/number` checks it
against the trusted registry and the fraud list. No model call, so the verdict is
on screen before the caller finishes their first sentence.

**3 · The elder hears a story** — they put the call on speaker and tap one button.

> **Gap #1 (the notification question).** No mobile OS hands a third-party app the
> audio of a live call — iOS forbids it outright. So the transcript half cannot be
> automatic; it needs speakerphone and a tap, and the UI is built around that one
> big button rather than pretending otherwise. The *number* half can be automatic:
> iOS 18's Live Caller ID Lookup API lets an app supply caller ID and blocking
> information for incoming calls, which maps directly onto `/api/verify/number`.
> That is the shipping path, and it is the honest answer when a judge asks.

**4 · Safe intervention** — audio is captured in ~8 second windows and run through
`/api/transcribe` → `/api/calls/analyze`. The screen shows three things, in order
of how fast a frightened person can use them:

- the probability, climbing as the caller escalates
- **what to ask right now** (`suggestedQuestions`) — a real caller answers these
  without friction; a scammer stalls, deflects, or escalates
- the named tactics behind the score, each quoting the caller's own words

When the caller claims to be family, the safe-word challenge appears. The word is
masked until tapped, and the yes/no comparison happens locally.

**5 · Escapes the scam** — hang up, and `/api/reports/police` drafts a filable
incident report from the transcript and the analysis.

**6 · The family is pulled in** — the moment `fraudProbability` crosses 50%
(`KIN_ALERT_THRESHOLD`), the kin's phone gets the alert and an invitation to join
the call. The elder does not have to decide to ask for help while being pressured,
which is the point: that decision is the hardest one to make mid-scam.

**7 · The number goes back to the registry** — a scam verdict writes the caller's
number to the spam database with a timestamp and the tactics seen
(`POST /api/registry/report`). The next household's `/api/verify/number` already
knows. This is what turns the registry from a static seed table into something
that compounds: each escape makes the next lookup better.

**8 · The kin grades the result (HITL)** — `/api/reports/kin` writes the family a
summary, and they answer one question: was this right? Three answers, not a star
rating, because the two ways of being wrong have opposite fixes.

> **What "model retrained" actually means here.** Gemini's weights are Google's
> and cannot be updated from this app, so saying otherwise would be a lie told to
> judges. What the feedback really does: it scores the detector
> (`EvalStats.accuracy`), and it moves the alert threshold —
> false alarms raise the bar for waking the family, a missed scam lowers it. The
> labelled rows also accumulate as the eval set that a fine-tune or a few-shot
> prompt would need later. The threshold, the eval set, and the registry are ours;
> the weights are not.

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

## Running the demo

```bash
npm run dev
```

The console beside the phone is for the operator; the phone itself stays clean.

**Scripted** (default) plays a pre-recorded call out loud and sends the same bytes
to the API. **Live mic** captures the room instead. Both run the *identical*
pipeline — scripted swaps the microphone for a recording and changes nothing
downstream, so it is a fallback rather than a mock.

Rehearse on live, and keep scripted one keystroke away. Venue wifi and a room of
200 people is how live demos die.

| Key | Does |
|---|---|
| `S` | restart as the scripted call |
| `L` | restart on the live microphone |
| `R` | reset to the incoming call screen |

Two scenarios ship in `public/demo/`, generated with macOS `say`:

- **Grandparent scam** — six segments, escalates to a wire transfer. Triggers the
  safe-word challenge.
- **Doctor's office** — a legitimate appointment reminder. Scores ~0.01 and names
  no tactics. Show this one: a detector that flags a real doctor isolates the
  person it exists to protect, and the quiet result is the harder thing to build.

Expect a fresh score roughly every 6–8 seconds — transcription and analysis are
two sequential model calls per window. Recording never blocks on them, so if
analysis falls behind the queue catches up rather than the call developing holes.

## Layout

```
src/lib/schema.ts          the API contract — zod schemas + inferred types
src/lib/gemini.ts          Gemini client, model selection, structured output
src/lib/registry.ts        trusted-number lookup (DEMO SEED — replace before pilot)
src/lib/http.ts            request parsing, response envelope, error mapping
src/lib/risk.ts            brand tokens, risk-zone mapping, tactic labels
src/lib/audio-sources.ts   microphone and scripted playback, one interface
src/lib/use-call-session.ts  the pipeline: chunk -> transcribe -> analyze
src/app/page.tsx           the six screens
src/components/            phone frame, risk meter, report renderer
src/app/api/…              one route per endpoint
docs/API.md                the contract, explained
docs/design/               brand, journey and screen designs
```

Both sides of the stack import types from `src/lib/schema.ts`. Change a shape
there and anything that disagrees fails to compile — that is the point. Frontend
can mock against those types without waiting on the backend.

## Design

Screens follow [`docs/design/`](docs/design/) — five colours, Inter Tight, and
one main action per screen. Three of the open questions that document raises are
now closed:

- **Four risk levels, three meter zones.** Mapped in `src/lib/risk.ts`:
  `likely_fraud` and `critical` both read as "Likely a scam." The difference
  between them changes `recommendedAction`, not what the elder is told — at that
  point the advice is identical, and a fourth wording would only slow them down.
- **`partial: true` had no transport.** It does now: ~8 second windows, queued and
  drained serially, re-scoring the accumulated transcript each time.
- **No screen for `/api/reports/police` or `officialCallbackNumber`.** Both are
  built — the report after the scam verdict, the callback number as a teal row on
  the listening screen when the registry knows the real one.

Still open: safe word and family setup have no endpoint, auth or storage; the
safe word lives in `localStorage` and is deliberately never sent anywhere.

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
