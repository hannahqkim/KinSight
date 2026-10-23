# KinSight design

Brand, user journey, and elder-app screens. The live canvas is at
<https://claude.ai/artifact/KKcoveao7heVyVnKYxY6Sh> (ask Purvi for access);
the sources for every board are in [`canvas/`](canvas/).

## Palette

Five colours plus white. Nothing else.

| Colour | Hex | Role |
|---|---|---|
| Banana Cream | `#FFF07C` | "Ask first" screen, highlights, caught-tactic chips |
| Dark Slate Grey | `#1C5253` | Primary: text, buttons, headers |
| Burnt Peach | `#E07A5F` | Likely scam, hang up |
| Muted Teal | `#81B29A` | Looks safe, reassurance |
| Cool Horizon | `#79ADDC` | Listening, family-side info |
| White | `#FFFFFF` | Backgrounds, cards |

- Text is Dark Slate Grey on white and on Banana Cream.
- White text on Burnt Peach, Muted Teal and Cool Horizon is for large headlines
  only (it is under 3:1). Small text on those colours goes in a white card in
  Dark Slate Grey.

## Type

**Inter Tight** only (Google Fonts).

| Use | Weight | Style |
|---|---|---|
| Headlines, verdicts, wordmark | 900 Black | letter-spacing `-0.05em`, line-height ~0.9, end with a full stop |
| Sub-heads, buttons | 700–800 | letter-spacing `-0.02em` to `-0.035em` |
| Body | 500 Medium | 17–22px in the elder app, never below 16px |
| Labels | 500 Medium | UPPERCASE, 12–14px, letter-spacing `0.06em` |

Wordmark: **KinSight.** in Dark Slate Grey, Black weight, tight tracking.

## Call signals

Every state is a colour **and** an icon **and** a word, and it fills the whole
screen.

| State | Colour | Icon | Headline |
|---|---|---|---|
| Likely scam | Burnt Peach | warning triangle | "This is likely a scam." |
| Ask first | Banana Cream | question mark | "Say this out loud." |
| Looks safe | Muted Teal | check circle | "This looks safe." |

The live risk meter on the listening screen is a row of 24 bars that grow left
to right and light up teal → banana → peach as `fraudProbability` rises. It
shows words ("Sounds normal." / "Something's off." / "Likely a scam."), never a
percentage.

## Rules for the elder app

- One main action per screen. Buttons 64px+ tall, 18px radius, full width.
- Plain words at a 6th-grade reading level; show `plainLanguageWarning` verbatim.
- No gradients, no emoji, no grey text.
- "Looks safe" is always softer than "Hang up": a wrong "safe" is the worst
  mistake the product can make.

## Journey

1. **Family sets up** — installs, links the elder's phone, picks a safe word.
2. **Unknown caller** — prompt to open KinSight and answer on speaker.
3. **KinSight listens** — live transcript, risk meter, caught tactics.
4. **Ask the right question** — one question to say out loud.
5. **Verdict** — full-screen "Hang up" or "Looks safe".

## Open questions against the API

- The API has 4 risk levels (`safe`, `caution`, `likely_fraud`, `critical`);
  the meter has 3 zones.
- Safe word and family setup have no endpoint, auth, or storage yet.
- The live meter needs streaming (`partial: true` has no transport yet).
- A web app cannot detect incoming calls, so screen 2 needs a native app or a
  habit of opening KinSight before answering.
- No screen yet for `/api/reports/police` or for `officialCallbackNumber`.

## Files

- [`canvas/`](canvas/) — `.dc.html` source for each board. They need the
  canvas runtime (`support.js`) to render, so open them in the canvas, not a
  browser.
- [`stitch-prompt.md`](stitch-prompt.md) — prompts for generating the screens
  in Google Stitch.
