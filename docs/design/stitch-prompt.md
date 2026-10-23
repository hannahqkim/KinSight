# Google Stitch prompts

Paste the base prompt first, then one screen prompt at a time. If Stitch drifts
on colour, type or wording, paste the base prompt again before the next screen.

## Base prompt

```
Design an iPhone app called KinSight. An adult daughter, Natalie (34), invites her mother, Margaret (70s), who lives alone. Calls from unknown numbers ring Margaret through the KinSight app; KinSight listens, tells her in plain words what to do, and messages Natalie if scam risk passes 50%.

Colours: only these five plus white, no other shades:
- Banana Cream #FFF07C (ask first, the family word)
- Dark Slate Grey #1C5253 (all text on white, buttons)
- Burnt Peach #E07A5F (hang up)
- Muted Teal #81B29A (they knew the word)
- Cool Horizon #79ADDC (family, people)
- White #FFFFFF backgrounds; card surfaces #F1F5F5
Text on peach or teal must be very large; small text sits on white cards.

Type: SF Pro, the iPhone system font. Margaret's screens: headings 36-48pt bold, verdicts 60-72pt bold, body and buttons 20-30pt semibold. Natalie's screens: body 16-18pt.

Rules for Margaret's screens: one instruction, one big button (80pt tall, full width, 16pt radius), twelve words at most per line, never a percentage, no gradients, no emoji, no grey text.

Words: say "family word", never "safe word". Say "the caller" or "they", never "he". KinSight never calls her itself: write "Through KinSight", never "KinSight call". Never promise safety: "help you spot scams", not "keep you safe".
```

## Natalie's onboarding

```
Screen 1, Natalie: white. "1 of 3". Heading "Who are you inviting?". Line: "When a number she doesn't know calls, KinSight listens with her, tells her what to do, and alerts you if it sounds like a scam." Four choice buttons in a 2x2 grid: Mom (selected, slate), Dad, Grandparent, Someone else. Fields "First name" (Margaret) and "iPhone number". Link "Pick from my contacts". Slate button "Next".
```

```
Screen 2, Natalie: white. Back button, "2 of 3". Heading "Pick a family word". Line: "If a caller says they're family, KinSight has Mom ask for this word. Real family knows it. Scammers don't." Field "Family word" (Bluebird) with "Suggest one" link. Hint: "Easy for her to remember, hard to guess. Skip pet names, streets and birthdays, because those are online." A banana card with a checkbox: "Tell family who might call her. Say it out loud, not in a text or post." Slate button "Next".
```

```
Screen 3, Natalie: white. Back button, "3 of 3". Heading "Record a hello for Mom". Line: "She'll hear this first. Say why you set this up, in your own words." A card with a banana microphone button, "Record", "Up to 30 seconds", and "Don't say the family word. KinSight shows it to her privately." A blue card: "Call her first. She'll get a text from you with a link. A surprise link can look like a scam, so tell her it's coming." Slate button "Send invite to Mom", link "Skip the hello".
```

## Margaret's onboarding

```
Screen 4, Margaret: white. Natalie's photo and "From Natalie". Heading "Natalie wants to help you spot phone scams." Banana button "Hear her message". Three icon rows: "When a number you don't know calls, KinSight listens too." / "Calls from your contacts ring like always." / "If it sounds like a scam, it tells you and Natalie." Slate button "Yes, turn it on", link "Call Natalie first".
```

```
Screen 5, Margaret: white. Label "Your family word". A banana card with "Bluebird" very large and "Chosen by Natalie". Line: "Never say it first. Let the caller say it." Small lines: "KinSight will show it when you need it." and "KinSight never calls you itself." Slate button "Got it".
```

## The call

```
Screen 6, Margaret: iPhone's incoming call screen, dark slate. "Through KinSight", "Unknown number", "(312) 847-1928", and a banana pill "KinSight will listen with you". Decline and Accept buttons.
```

```
Screen 7, Margaret: iPhone in-call screen, dark slate. A white notification at the top: "KinSight is listening" / "Tap for help with this call." "Unknown number", "0:04". Buttons Mute, Speaker, and a banana KinSight button. End call.
```

```
Screen 8, Margaret: white. "Unknown number" and the number. Huge "Listening." A meter of 20 bars growing taller left to right, lit teal, then banana, then peach as risk rises, with no numbers. A status line that changes: "Sounds OK so far." / "Be careful. Don't give money or personal details." / "This sounds like a scam." When risk passes 50%, a banana card with Natalie's photo: "KinSight sent Natalie a message." Slate button "Hang up".
```

```
Screen 9, Margaret: banana. "Ask:" then huge "'What's our family word?'". A white card: "Only you can see this" / "Bluebird". Slate button 'They said "Bluebird"', white button "They didn't".
```

```
Screen 9b, Margaret: muted teal, slate text. Check icon. Heading "They knew the word." White card: "Before you send money, check with Natalie." A small white strip with a low meter and "Listening." Slate button "Back to call".
```

```
Screen 10, Margaret: burnt peach, white text. Warning icon. Huge "Hang up." Line "KinSight sent Natalie a message." Slate button "Hang up".
```

```
Screen 11, Margaret: white. Teal check tile. Heading "You did the right thing." Line "Don't call that number back." Slate button "Call Natalie", link "Close".
```

## Natalie's alert

```
Screen 12, Natalie: white. Peach flag "Live now". Heading "Mom may be on a scam call". A slate card with "Likely scam" large in banana and "62% risk" small. Line: "The caller says he's Danny. He wants $2,400 for bail today." Slate button "Call Mom", banana button "Tell Mom to hang up", and under it: "She sees 'Natalie says: Hang up' on her KinSight screen."
```
