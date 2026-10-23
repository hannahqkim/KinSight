# Google Stitch prompts

Paste the base prompt first, then add one screen prompt at a time. If Stitch
drifts on colour or type, paste the base prompt again before the next screen.

## Base prompt

```
Design a mobile app called KinSight: real-time scam-call protection for older adults (70+) who live alone. While a call is on speakerphone, the app listens, turns speech into text, scores the chance of fraud, and tells the elder in plain words what to do.

Audience: older adults with weaker eyesight and hands, often stressed by a caller pressuring them. The screen must be the calmest thing in the room.

Colours: use ONLY these five plus white, no tints, no extra shades:
- Banana Cream #FFF07C (ask first, highlights)
- Dark Slate Grey #1C5253 (primary: all text on white, buttons, headers)
- Burnt Peach #E07A5F (likely scam, hang up)
- Muted Teal #81B29A (safe)
- Cool Horizon #79ADDC (listening, family info)
- White #FFFFFF (backgrounds, cards)
White text on peach, teal and blue only for large headlines; small text on those colours sits in a white card in Dark Slate Grey.

Type: Inter Tight only. Headlines in Black (900) weight, very large, very tight letter-spacing (-0.05em), line-height 0.9, ending with a full stop ("This looks safe."). Body in Medium (500), 18px minimum. Small labels in UPPERCASE Medium, 13px, wide letter-spacing (0.06em).

Logo: the wordmark "KinSight." in Dark Slate Grey, Inter Tight Black, tight tracking.

Rules:
- One main action per screen, buttons at least 64px tall, full width, 18px radius.
- Plain words, never percentages or jargon. 6th-grade reading level.
- Every risk state uses a colour AND an icon AND a word, and fills the whole screen.
- No gradients, no emoji, no grey text. Flat cards, white or 2px outlined in a palette colour.
```

## Screens

```
Screen: Family setup. Caregiver onboarding, white background, "STEP 2 OF 4" label and a progress bar (slate filled, Cool Horizon remaining). Headline: "Choose a family safe word." Body: "KinSight will remind Mom to ask for it when a caller says they're family." A "SAFE WORD" label over a text field with a 2px slate border. A card outlined in Cool Horizon with "BACKUP QUESTIONS", two questions with blue checkmarks, and "+ Add a question". Full-width slate button: "Next: trusted contacts".
```

```
Screen: Before you answer. Full-screen Dark Slate Grey. Top: a white notification card with "KINSIGHT · NOW", "Unknown number calling" and "Tap here before you answer. I'll listen with you." Center: a phone icon in a Cool Horizon circle, the caller number in huge Black type, "NOT IN YOUR CONTACTS". A card outlined in Cool Horizon: "Answer on speaker so KinSight can hear the caller too." Banana Cream button with slate text: "Answer with KinSight". Banana text link: "Ignore this call".
```

```
Screen: Listening live. White background. Header: a small animated waveform in Cool Horizon and "LISTENING WITH YOU". Hero: a Dark Slate Grey card, "SCAM RISK, LIVE", a big Black-weight status word that changes colour ("Sounds normal." in teal / "Something's off." in banana / "Likely a scam." in peach), one instruction line, and a level meter of 24 vertical bars getting taller left to right, lit teal, then banana, then peach as risk rises. Below: a card outlined in slate, "THE CALLER IS SAYING", the previous sentence in Cool Horizon and the latest in bold slate, plus a Banana Cream chip like "HEARD: ASKS FOR MONEY". Three outlined check rows with coloured dots: "The story", "Who they are", "Call back". Bottom outlined slate button: "Call my family instead".
```

```
Screen: Ask first. Full-screen Banana Cream, slate text. Question-mark icon and "ASK FIRST". Huge headline: "Say this out loud." A white card holding one question in bold slate: "Before I do anything, what's our family word?" and "Only your real family knows it." Two big buttons: slate filled "Yes, they knew it" and slate outlined "No, or they dodged it". Text link: "Give me a different question".
```

```
Screen: Likely scam. Full-screen Burnt Peach, white headline. Large white warning-triangle icon. Huge headline: "This is likely a scam." Subline: "Hang up now. You haven't done anything wrong." A white card in slate text: "WHY KINSIGHT THINKS SO", "They didn't know the family word.", "They asked for money and secrecy." Slate button: "Hang up". White text link: "Call Sarah (your daughter)".
```

```
Screen: Looks safe. Full-screen Muted Teal, white headline. Large white check-circle icon. Huge headline: "This looks safe." Subline: "They knew the family word. Still, never send money on this call." A white card in slate text: "IF THEY ASK FOR MONEY LATER", "Hang up and call them back on the number saved in your phone." Slate button: "Keep listening with me". White text link: "I'm done, close KinSight".
```
