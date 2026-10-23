# KinSight design

The simple flow: Natalie (34) invites her mom Margaret, they agree a family
word, and when an unknown number calls Margaret, KinSight listens with her and
messages Natalie once scam risk passes 50%.

- Live canvas: <https://claude.ai/artifact/KKcoveao7heVyVnKYxY6Sh> (Simple flow
  page; ask Purvi for access). Board sources are in [`canvas/`](canvas/).
- Audit report: [`audit.md`](audit.md), walkthroughs as Natalie and Margaret,
  designer audit, copy review and open questions.
- Stitch prompts: [`stitch-prompt.md`](stitch-prompt.md).

## Palette

Five colours plus white. Card surfaces use Slate wash.

| Colour | Hex | Role |
|---|---|---|
| Banana Cream | `#FFF07C` | Ask first, the family word, Natalie messaged |
| Dark Slate Grey | `#1C5253` | Text, buttons, calls |
| Burnt Peach | `#E07A5F` | Hang up |
| Muted Teal | `#81B29A` | They knew the word, sounds OK |
| Cool Horizon | `#79ADDC` | Family, people |
| White | `#FFFFFF` | Backgrounds |
| Slate wash | `#F1F5F5` | Card surfaces (Dark Slate Grey at 6% on white) |

White text on Burnt Peach (2.95:1) and Muted Teal (2.4:1) fails WCAG contrast,
and Dark Slate on peach (2.99:1) fails too. Until the team decides, keep text on
those colours large, and put small text on white cards.

## Type

**SF Pro, the iPhone system font** (`-apple-system` on the web). Margaret reads
it every day, and it follows the text size she set on her iPhone (Dynamic Type).

| Use | Size | Weight |
|---|---|---|
| Verdicts ("Hang up.") | 60 to 72pt | Bold |
| Margaret's headings | 36 to 48pt | Bold |
| Margaret's body, buttons | 20 to 30pt | Semibold |
| Natalie's body | 16 to 18pt | Medium |

Test every screen at the largest accessibility text size.

## Rules for Margaret's screens

- One instruction and one big button (80pt tall) per screen.
- Twelve words at most per line, sixth grade reading level.
- Never a percentage. The live meter has no numbers or tick labels.

## Words

| Use | Never | Why |
|---|---|---|
| family word | safe word, password | "Safe word" has a sexual meaning for many adults; "password" is what she must never give out. |
| the caller, they | he, him | KinSight can't know who is calling. Natalie's screen may repeat a claim: "says he's Danny". |
| Through KinSight | KinSight call | KinSight never calls her itself, so a scammer can't pose as KinSight. |
| Unknown number | Unknown caller, stranger | A fact, and the same on every screen. |
| KinSight sent Natalie a message | Natalie knows, She will call you | We can only promise that we sent it. |
| help you spot | keep you safe | No promise of an outcome. |

## The simple flow

Twelve screens plus one branch. File names starting `K1-Sarah` and `K6-Sarah`
are legacy; the screens say Natalie.

| # | Who | File | Screen |
|---|---|---|---|
| 1 | Natalie | `K1-SarahSetup` | "Who are you inviting?" Mom, Dad, Grandparent, Someone else; first name; iPhone number |
| 2 | Natalie | `K1b-FamilyWord` | "Pick a family word"; required "Tell family who might call her" |
| 3 | Natalie | `K1c-Send` | "Record a hello for Mom"; "Call her first"; "Send invite to Mom" |
| 4 | Margaret | `K2-MomInvite` | "Natalie wants to help you spot phone scams."; "Yes, turn it on"; "Call Natalie first" |
| 5 | Margaret | `K2b-MomWord` | "Your family word: Bluebird"; "Never say it first. Let the caller say it." |
| 6 | Margaret | `J1-Ringing` | iPhone's call screen: "Through KinSight", "Unknown number", "KinSight will listen with you" |
| 7 | Margaret | `J2-Answered` | Push banner: "KinSight is listening. Tap for help with this call." |
| 8 | Margaret | `K3-Listening` | "Listening." with the live meter; past 50% "KinSight sent Natalie a message." |
| 9 | Margaret | `K4-Ask` | "Ask: 'What's our family word?'"; answer under "Only you can see this" |
| 9b | Margaret | `K4b-KnewWord` | "They knew the word. Before you send money, check with Natalie." |
| 10 | Margaret | `K5-HangUp` | "Hang up. KinSight sent Natalie a message." |
| 11 | Margaret | `K5b-AfterHangUp` | "You did the right thing. Don't call that number back." |
| 12 | Natalie | `K6-SarahAlert` | "Mom may be on a scam call"; "Likely scam", 62% risk; "Call Mom" |

## How it works on iPhone

No app can listen to a normal phone call, use the microphone during one, show
a prompt when one rings, or read the caller's number. So KinSight becomes the
phone line for unknown numbers only:

1. Margaret's iPhone silences unknown callers (Settings), and her carrier
   forwards them to a KinSight number instead of voicemail.
2. KinSight rings her through its own app with CallKit, like a WhatsApp call,
   so it carries the audio.
3. Contacts ring as normal and stay private.

This needs a native iPhone app and a phone number service. The app can set the
caller name on the ring screen, switch the call to speaker, show a push banner
during the call and end the call, but it cannot open itself when she answers.

## Differences from the demo in `src/`

The clickable demo follows this flow, screens 1 to 12 and 9b, in SF Pro with
the copy above. Where it still differs:

- Live capture uses the browser microphone or a recorded call, which is fine
  for a demo but not possible during a real iPhone call.
- Recording Natalie's hello and the "Call Natalie" buttons need the iPhone
  app; the demo says so on screen instead.
- The family word stays in the browser and is never sent to the server; the
  schema's `safeWordAvailable` field keeps its name.
- Natalie's panel keeps the demo's "Join the call" and after-call feedback,
  which go beyond screen 12.

## Open questions

Full list in [`audit.md`](audit.md#open-questions-for-the-team). The ones that
block building: contrast on peach and teal, confirming the call routing above,
consent rules for transcribing callers, and who installs KinSight on
Margaret's phone.
