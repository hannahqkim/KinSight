# KinSight design audit: simple flow

October 23, 2026. Live version with comments:
<https://claude.ai/artifact/LrKeuhAR2NiBpcCs5QvxkS> (ask Purvi for access).

## Summary

The flow now tells one story from invite to hang up, but it breaks at the moment that matters most: Margaret answers with the phone at her ear and never sees KinSight's prompt.

The five biggest problems:

1. **The answer prompt is invisible.** With the phone at her ear the screen is off. KinSight should answer on speaker and speak one line only she hears.
2. **The setup that makes it work is missing.** Someone has to silence unknown callers and set up call forwarding on Margaret's iPhone. Natalie's flow never asks her to.
3. **Dead ends.** "They said it" led nowhere, and nothing happened after Margaret hung up. (Fixed in round 2: screens 9b and 11.)
4. **Promises we can't keep.** "Keep me safe" and "She will call you" overpromised; "KinSight call" taught Margaret to trust anyone claiming to be KinSight. (Fixed in round 2.)
5. **Contrast.** Text on Burnt Peach and Muted Teal fails accessibility checks in both white and Dark Slate.

## How screen 1 knows it's Mom

It didn't. Screen 1 said "Invite your mom" and "Her name" to everyone, so a son protecting his dad, or someone protecting a grandparent, got the wrong words from the first second.

**Fix:** Natalie's first tap is who she is inviting: Mom, Dad, a grandparent, or someone else. Every later line follows that choice:

- "Mom" or "Dad"; "her" or "his" in every line.
- Margaret's screens use the inviter's name, so they never depend on the relationship.
- Natalie's alert says "Call Mom" or "Call Dad". For "someone else", it uses the name typed in.

KinSight does not guess from Natalie's contacts. "Pick from my contacts" fills the name and number only if she taps it, and iPhone asks her permission first.

## Walkthrough as Natalie

Natalie can invite her mom in under a minute, but the step that actually makes KinSight work, routing Mom's unknown calls, is missing from her flow entirely.

| Step | What Natalie sees | What goes wrong | Fix |
| --- | --- | --- | --- |
| 1 | "Invite your mom" | Assumes Mom for everyone. | Fixed: relationship picker. |
| 2 | Name and phone fields | No idea what Mom will receive, or from whom. | Fixed: "She'll get a text from you with a link." |
| 3 | No family word step | The word the whole Ask screen depends on is never set. | Fixed: family word screen. |
| 4 | Voice message row | Good human touch. Length and retake are unclear. | Fixed: "Up to 30 seconds". |
| 5 | Taps send, then nothing | No "waiting for Mom" state, no nudge if Mom never opens it. | Recommended: a status card on Natalie's home. |
| 6 | (missing) | Mom's iPhone must silence unknown callers and forward them to KinSight. Natalie has to do this on Mom's phone, about 2 minutes. | Recommended: one guided screen, done in person or on FaceTime. |
| 7 | Alert, weeks later | The push notification itself isn't designed. "62%" has no meaning yet. | Fixed: "Likely scam" leads, "62% risk" small. Lock screen alert still to design. |
| 8 | "Text Mom: Hang up" | Mom is mid-call and may not see a text. | Fixed: "Tell Mom to hang up" shows on her KinSight screen. |
| 9 | After the call | No outcome. Natalie never learns if Mom hung up. | Recommended: "Mom hung up at 3:41" update. |
| 10 | A false alarm | A real doctor flagged; no way to tell KinSight. | Recommended: "This call was fine" button. |

## Walkthrough as Margaret

The biggest break is when she answers. With the phone at her ear the screen goes dark, and she never sees the prompt that the rest of the flow depends on.

| Step | What Margaret sees | What goes wrong | Fix |
| --- | --- | --- | --- |
| 1 | A text from Natalie with a link | Installing from the App Store (Apple ID, password) stops many people her age. | Recommended: Natalie installs it on Mom's phone, in person. |
| 2 | Natalie's invite | After "Yes" she didn't learn the family word, or that unknown calls will look different. | Fixed: family word screen; "Calls from your contacts ring like always." |
| 3 | Phone rings | "KinSight call" read as if KinSight itself is calling her. The mock shows brand coloured Accept and Decline; iPhone's real buttons are green and red and can't be changed. | Fixed: "Through KinSight", "Unknown number". Recommended: redraw buttons as iPhone's. |
| 4 | Push banner after answering | Phone is at her ear, screen is off; the banner also vanishes after a few seconds. | Recommended: KinSight answers on speaker and says one short line only she hears: "KinSight is listening. Look at your screen." |
| 5 | "Listening." with a moving meter | She is hearing a stressful story and reading at once. "Sounds OK so far" can relax her too early. | Recommended: slow the meter. |
| 6 | The family word question | She may forget the word under pressure. "Him" assumed a man. Only fits callers who claim to be family. | Fixed: the answer shows on her screen; "Ask:". Recommended: other questions for bank, police and doctor claims. |
| 7 | Caller knew the word | Nothing followed. Dead end. | Fixed: screen 9b. |
| 8 | "Hang up. Natalie knows. She will call you." | A promise KinSight can't keep if Natalie is busy. | Fixed: "KinSight sent Natalie a message." |
| 9 | After hanging up | No closure, no next step. | Fixed: "You did the right thing. Don't call that number back." |

## Designer audit

The screens are short and readable, but three things need decisions: text contrast on peach and teal, the missing states below, and what happens when Margaret never looks at the screen.

### Colour and type

- **Contrast fails on two brand colours.** White on Burnt Peach is 2.95:1 and white on Muted Teal is 2.4:1. Large text needs 3:1, body text 4.5:1. Dark Slate on peach is 2.99:1, so it fails too. Screen 9b uses Dark Slate on teal (3.68:1, passes for large text only).
- **SF Pro at 20pt and up is right for Margaret.** It follows her iPhone text size. At the largest accessibility sizes, 48pt headlines wrap to four or more lines; every screen needs a test at that size.
- **Initials instead of faces.** Margaret trusts Natalie's face more than an "N". Natalie should add a photo in onboarding.

### Missing states

| State | Why it matters |
| --- | --- |
| Caller claims bank, police, doctor or delivery | The family word question doesn't fit, and asking only reveals that a word exists. Each needs its own question or "hang up and call the number on your card". |
| Margaret never opens the app | Natalie still gets messaged, but Margaret gets no guidance. A spoken line in her ear covers this. |
| Natalie doesn't respond | No second contact. An earlier design had a backup helper. |
| KinSight is down | Calls must still reach Margaret, or she misses real calls from unknown numbers like a new doctor. |
| The first KinSight call ever | Margaret should hear or see one sentence explaining why her phone looks different. |

### What iPhone allows, screen by screen

| Screen | Possible? | Note |
| --- | --- | --- |
| 6 Ring | Yes | CallKit lets KinSight set the caller name. The Accept and Decline buttons are Apple's own. |
| 7 Answer prompt | Partly | A push banner during a call works. KinSight can set the call to speaker and speak to Margaret only. It cannot open itself. |
| 8 to 11 In app | Yes | The app shows live state and can end its own call. |
| 12 Natalie alert | Yes | Push alert. A Live Activity could keep the risk on her lock screen. |
| Setup | Partly | No app can turn on Silence Unknown Callers; someone has to switch it on in Margaret's Settings. Call forwarding codes differ by carrier, and some prepaid plans block them. |

## Copy review

This review came from a separate AI reviewer briefed as a copywriter for older adults. It is applied to the canvas.

### Terminology

- **"Family word" everywhere, on both phones.** "Safe word" has a sexual meaning for many adults, and "password" is the thing we teach her never to give out.
- **"The caller", or "they" on buttons. Never "he".** Natalie's screen can repeat the claim ("says he's Danny").
- **KinSight never calls her itself.** Drop "KinSight call"; use "Through KinSight". Teach the rule "KinSight never calls you" so a scammer can't pose as KinSight.
- **"Unknown number"** is the one name for the caller.
- **"Safe" is never a promise.** Say what KinSight did, not how things will turn out.

### Line by line

| Screen | Before | After | Why |
| --- | --- | --- | --- |
| 1 | Her name / Her phone number | First name / iPhone number | No pronoun; KinSight only works on iPhone. |
| 4 | Natalie wants to keep you safe from phone scams. | Natalie wants to help you spot phone scams. | No promise; keeps her in charge. |
| 4 | KinSight listens when a stranger calls. | When a number you don't know calls, KinSight listens too. | "Too" means alongside her. |
| 4 | (new) | Calls from your contacts ring like always. | Answers her worry about family calls. |
| 4 | If it's a scam, Natalie is told. | If it sounds like a scam, it tells you and Natalie. | She hears first; "is told" sounds like being reported. |
| 4 | Yes, keep me safe | Yes, turn it on | Plain action, no promise. |
| 6 | KinSight call / Unknown caller | Through KinSight / Unknown number | Doesn't read as KinSight calling. |
| 7 | Tap here to see what it hears. | Tap for help with this call. | She won't see a transcript; "help" says why to tap. |
| 8 | Something is off. | Be careful. Don't give money or personal details. | Worry without an action is the most anxious state. |
| 8, 10 | Natalie knows. / She will call you. | KinSight sent Natalie a message. | Avoids shame, and we can only promise we sent it. |
| 9 | Ask him: / He knew it | Ask: / They said "Bluebird" | No gender; she checks against the word on screen. |
| 11 | (none) | You did the right thing. Don't call that number back. | Heads off shame and callback scams. |
| 12 | 62% / scam risk | Likely scam (large), 62% risk (small) | 62% reads like a coin flip. |
| 12 | Text Mom: "Hang up" | Tell Mom to hang up | Shows "Natalie says: Hang up" on her KinSight screen, not as a text. |

Lines judged fine as written: "Call Natalie first" (the best line in the flow), "KinSight will listen with you", "Listening.", "This sounds like a scam.", "Hang up", "What's our family word?", "Call Mom".

### Flags

- The invite is a surprise text with a link, exactly what we teach older adults to ignore. Send it from Natalie's own number, and have her call first.
- Showing the word during a call risks it being read aloud, by Margaret or by iPhone's Spoken Content on speaker. Keep it out of what VoiceOver reads automatically.
- Real family who don't know the word will fail the check. Telling relatives the word is a required step.
- The live meter must carry no numbers or tick labels, or it's a percentage in disguise.
- After screen 9b, the warnings must come back if risk climbs again: a leaked word, a request for money, or pressure to keep it secret.

## Open questions for the team

- [ ] **Text on peach and teal.** Neither white nor Dark Slate passes contrast. Keep large text only, darken the two shades, or put text on white cards?
- [ ] **Call routing.** Unknown callers silenced, forwarded by the carrier to a KinSight number, rung through the app. This needs a native iPhone app and a phone number service.
- [ ] **Consent to transcribe.** Some US states require everyone on a call to agree to recording. Does KinSight need to tell callers the call is screened? Check with a lawyer before any pilot.
- [ ] **Who installs it on Margaret's phone.** Natalie in person, or guided over FaceTime?
- [ ] **Backup contact.** Who gets the message if Natalie doesn't respond within a minute?
- [ ] **The 50% line.** Fixed for everyone, or set by the family?
- [ ] **Non-family callers.** Which questions for bank, police, doctor and delivery claims?
- [ ] **Android.** Android lets apps screen calls directly, so the flow would differ. In scope for the first version?
