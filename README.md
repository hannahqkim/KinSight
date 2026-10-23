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

Natalie (34) invites her mom Margaret, they agree a family word, and when an
unknown number calls Margaret, KinSight listens with her and messages Natalie
once scam risk passes 50%. Twelve screens, following
[`docs/design/`](docs/design/).

**Natalie sets it up (1–3)** — who she's inviting, the family word, and a
recorded hello. The family word is written to `localStorage` and never leaves
the device: not to our server, not to the model. The analyze endpoint is told
only that one *exists*, which is enough for it to suggest asking.

**Margaret accepts (4–5)** — the invite, then her family word, with the one rule
that matters: never say it first, let the caller say it.

**The call (6–8)** — it rings *through KinSight*, she answers on speaker, and a
banner offers help. The listening screen shows a 20-bar meter and a word —
never a percentage. A score invites her to argue with it while the caller is
still talking. Past 50%, "KinSight sent Natalie a message."

**The question (9, 9b)** — one line to say out loud, the family word first when
the caller claims to be family. The word is shown only to her. If they knew it,
she gets a softer screen that still says to check with Natalie before sending
money; if they didn't, she goes to the verdict.

**Verdict and after (10–11)** — "Hang up." then "You did the right thing."

**Natalie's side (12)** — the live alert carries the percentage, because she is
34 and reading on a commute, and it helps her judge how hard to interrupt. She
can call Mom or push "Natalie says: Hang up" onto Margaret's screen.

**The loop closes** — a scam verdict writes the number back to the registry with
a timestamp and the tactics seen (`POST /api/registry/report`), so the next
family's lookup already knows. `/api/reports/kin` writes Natalie a summary, and
she answers one question: was this right?

> **What "model retrained" actually means here.** Gemini's weights are Google's
> and cannot be updated from this app, so saying otherwise would be a lie told to
> judges. What the feedback really does: it scores the detector
> (`EvalStats.accuracy`), and it moves the alert threshold — false alarms raise
> the bar for waking the family, a missed scam lowers it. The labelled rows also
> accumulate as the eval set that a fine-tune or a few-shot prompt would need
> later. The threshold, the eval set, and the registry are ours; the weights
> are not.

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

Built to [`docs/design/`](docs/design/): five colours plus white and a slate
wash, **SF Pro** (`-apple-system`, so it follows the text size Margaret set on
her iPhone), one instruction and one 80pt button per screen, and the words from
that document's copy table — "family word" never "safe word", "the caller" never
"he", "Unknown number" everywhere.

Design decisions made here, which that document left open:

- **Four risk levels, three meter zones.** `likely_fraud` and `critical` both
  read as "Likely a scam." The difference changes `recommendedAction`, not what
  Margaret is told; a fourth wording would only slow her down.
- **Contrast on peach and teal.** White on peach is 2.95:1 and white on teal is
  2.4:1, so small text never sits on either — the teal screen uses Dark Slate,
  and anything below 24pt goes in a white card.
- **The ask screen is a tap, not automatic.** It keeps the presenter in control
  of when that screen lands rather than having it fire mid-sentence. One line to
  flip if the team prefers it automatic.

Closed from that document's open list: `partial: true` now has a transport
(~8 second windows, queued and drained serially); `/api/reports/police` and
`officialCallbackNumber` both have screens.

Still open and worth deciding before a pilot: the schema field is still
`safeWordAvailable` while the UI says "family word" — renaming a published
contract field is the team's call, not mine. Consent to transcribe callers is a
legal question. Call routing needs a native app and a phone number service.

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
