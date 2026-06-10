# Kibbo Project Handoff

Use this file as the compact project context for future chats. The current working directory is:

```text
/Users/chocolate_god/Downloads/fluency-app
```

The app is a React Native + Expo Router language trainer for AP language mastery. It started as AP Japanese and is now branded as **Kibbo**. We are preparing it for app-store launch as a free app with in-app purchases. We also want to use the same structure to build a Mandarin version for a friend.

## Current App Identity

- User-facing app name: **Kibbo**
- Bundle ID chosen for now: `com.kibbo.language`
- Domain direction chosen for now: `.language`
- Brand values: clean, professional, memorable, AP-focused, but still fun and attractive enough to compete in the language-learning market.
- Required disclaimer: **"Kibbo is not affiliated with or endorsed by College Board."**
- The app is not supposed to feel like a random website. It should feel like a real mobile app first, then adapt cleanly to desktop.

Branding is centralized in:

```text
constants/brand.ts
```

If the app name changes later, update it there first.

## Local Demo Setup

We are testing locally through Expo/web.

Important:

- The user often has a browser demo already open.
- Do **not** keep opening new browser tabs unless the user explicitly asks.
- If a live dev server is running, reloading the existing browser page should show updates.
- If using the static preview/export server, rebuild first or reload may show old exported files.

Current browser context seen recently:

```text
http://localhost:8082/onboarding
```

Earlier route-aware static preview has also used:

```text
http://127.0.0.1:8083/
http://127.0.0.1:8083/__mobile-demo
```

Use the live Expo dev server when possible for iterative UI work. Use the route-aware static preview only when validating exported web behavior.

Common validation commands:

```bash
npx tsc --noEmit
npm run validate:launch
npm run build:web
```

## Latest Implementation Status

Last validated on 2026-06-03:

```bash
npx tsc --noEmit
npm run validate:launch
npm run build:web
```

All passed. `validate:launch` currently warns only that `com.kibbo.language` must be confirmed as the final bundle identifier before App Store Connect setup.

Recent local fix:

- `components/APPracticeSession.tsx` no longer saves placeholder Library items for AP Conversation/Text Chat when the user taps Save before scoring finishes. It now treats that as "save after review" intent and writes the full `AP_REVIEW_JSON` scored review once grading completes.
- Listening, Reading, and Speaking saves were audited and already store enough information for Library review:
  - Listening saves transcript + correct answer.
  - Reading saves the passage id so the Library can rehydrate the passage.
  - Speaking saves the English prompt + target answer.
- Pro and Elite both route through the `elite` AI feedback tier on the client. Basic routes through `standard`.
- The required disclaimer is centralized in `constants/brand.ts` and appears in legal/disclosure surfaces.

Remaining client-side work worth auditing before launch:

- Do a complete dark-mode pass across every modal, drill, Library, Mock, Development, legal screens, and mobile preview shell.
- Do a full mobile safe-area/touch audit on real device dimensions, especially footer placement, modals, and drill action bars.
- Confirm daily-limit/subscription modal stack behavior on both desktop and mobile after repeated plan comparisons.
- Finish final bug pass on all drill flows: start, answer, feedback, save, review, exit, footer navigation, and session cap.
- Replace preview/legal placeholder language with launch-ready legal copy before submission.

## Major Project Goal

Build a language-learning app that takes over the AP language-prep whitespace, similar to how focused education creators dominate AP niches. The app should be:

- AP-specific
- mobile-first
- clean and professional
- interactive and satisfying
- easier to understand than a textbook
- better for AP mastery than generic language apps
- polished enough that users trust it immediately

The user often compares the standard to Duolingo, not because the app should copy Duolingo, but because Duolingo is simple, smooth, playful, clear, and habit-forming.

## Core Product Structure

Main tabs:

- Practice/Home
- Library
- Mock

Important screens/routes:

```text
app/(home)/index.tsx
app/(home)/library.tsx
app/(home)/mock.tsx
app/ap/reading.tsx
app/ap/texting.tsx
app/ap/conversation.tsx
app/listening/session.tsx
app/speaking/translation.tsx
app/development.tsx
app/onboarding.tsx
app/legal/privacy.tsx
app/legal/terms.tsx
app/__mobile-demo.tsx
```

Shared components of interest:

```text
components/MainTabHeader.tsx
components/AppFooterTabs.tsx
components/APPracticeSession.tsx
components/Icons.tsx
constants/colors.ts
constants/brand.ts
utils/storage.ts
utils/aiFeedback.ts
utils/questionGenerators.ts
```

## Design Direction

Current visual direction:

- cream/off-white background
- red AP Edition palette
- elegant serif headings
- clean rounded cards
- large but controlled kanji background glyphs
- professional app-store-quality mobile design
- desktop should feel like a centered app canvas, not a stretched website

Avoid:

- clutter
- tiny cramped cards
- inconsistent footers
- random formats between drills
- text pushing against borders
- buttons or icons getting clipped
- huge text blocks on mobile
- screens where users must scroll just to start practicing
- mismatched icon sizes or visual styles

Mobile design principles the user emphasized:

- clear primary action immediately visible
- good whitespace, but not wasted space
- touch targets at least around 44px
- no text crushed against card borders
- no one-word-per-line bad wrapping
- bottom tabs always accessible
- drill pages should usually fit without needing question-by-question scrolling
- if content is long, scroll inside the content card rather than breaking the whole layout

Desktop design principles:

- main content should usually be centered with a consistent max width
- Home, Library, and Mock should use identical header/footer structure
- no full-width random layouts unless intentional
- settings/subscription modals must fit inside the viewport and scroll internally

## Header/Footer Rules

The user strongly wants:

- one shared main tab header across Home, Library, Mock
- one shared footer/tab bar across Home, Library, Mock
- the same footer reused inside drills
- footer icons vertically centered
- mobile footer not too tall, not too low, not clipped
- desktop footer should match the main-page footer exactly
- footer backgrounds must be opaque enough that underlying drill content does not show through under/behind the footer
- avoid floating footer transforms that expose a visible gap at the bottom of the mobile phone frame

If a drill user taps a footer tab:

- show a warning that drill progress/XP will not be saved
- clarify Library saves remain saved
- no warning needed on non-drill pages such as Development

The drill header X button should use this same leave-drill confirmation instead of exiting instantly.
That shared leave-drill confirmation has separate compact mobile styling, using a bottom-card layout rather than a squeezed desktop-centered alert.

## Settings And Subscription Work

Settings icon exists in the main header.

Settings should include:

- Theme: light/dark
- Privacy policy
- Terms of use
- AI disclosure
- Share app
- Subscriptions
- Restore purchases
- Study reminders
- Sound effects
- Haptics
- Reading text size: Normal, Large, XL

Subscription popup should be opened from inside settings.

Tiers:

- Basic: free, 3 session types/day, standard AI feedback
- Pro: 20 sessions/day, strongest AI review
- Elite: unlimited sessions/day, strongest AI review

The current-plan hero card should not show the price in the blank badge area. The empty badge space is intentional.

Subscription comparison should show:

- an example prompt
- a user answer
- standard AI feedback
- elite AI feedback

Both standard and elite feedback should be genuinely useful. Standard should not sound dumb. Elite should add native-like nuance, register, and explanation of why a native speaker would phrase something differently.

Recent settings work:

- Settings/subscription modals were updated to use a soft animated modal shell.
- Toggle switches were updated to use a more Apple-like oval switch with springy thumb movement.
- Desktop settings modal cutoff was fixed by constraining modal height to the actual browser viewport and making the modal body scroll internally.
- Mobile settings/subscription modals have extra top safe-area padding and reduced compact max height so the simulated phone notch/dynamic island does not cover the modal title.
- A Reading text size setting was added. It is stored in app settings and used by AP Reading/Furigana passage rendering on both mobile and desktop.
- Subscription current-plan hero is tier-aware: Basic, Pro, and The Elite use different hero styling, background glyphs, and badge icons while keeping the price area blank.
- Current-plan hero cards now have compact-specific sizing on mobile so the badge/icon and decorative glyph do not clip against the right edge.
- Daily session-limit notices use their own polished centered modal, with compact mobile sizing, a usage badge, Pro/Elite upgrade preview tiles, entrance animation, a subtle usage-badge pulse, and a pressed button animation.
- Pro/Elite tiles and helper text inside the daily session-limit notice open the current screen's Settings subscription comparison directly through a local header signal, not a global broadcast. This prevents multiple mounted tab headers from stacking several settings/subscription modals.
- When subscriptions are opened from the daily-limit notice, closing the subscription modal should return directly to the app instead of leaving the Settings modal behind.

## Dark Mode

Dark mode exists but must be audited carefully.

Dark mode must:

- remain visually appealing
- preserve text contrast
- make cards, outlines, glyphs, buttons, and icons readable
- not simply invert everything awkwardly

Palette is in:

```text
constants/colors.ts
```

## Library Requirements

Library must support:

- save/unsave across all question screens
- clicking a saved item opens review-style view, not an XP-earning live lesson
- star delete should open confirmation instantly
- no flicker when removing an item
- bulk select/delete
- search/filter
- review modal
- review should not award XP

Review behavior by type:

- Listening review needs something to listen to.
- Reading review needs the passage/context to read.
- Speaking review should show prompt, allow speaking, then show model answer.
- Conversation and text-chat saved results should show the saved full result: each question/turn, user's answers, feedback, things to work on, and overall AP score.
- Final review button should say **Complete**, not “Complete Review.”
- Listening review button should say **Listen**, not “Listen again.”

## Drill Requirements

All drill types should have consistent layout:

- top segmented progress bars, one segment per question
- consistent top save/XP controls
- consistent footer
- consistent prompt/card spacing
- no elements cut off
- no prompt text truncated
- enough padding inside cards
- prompt/question difficulty should scale with user level

Listening session:

- instant local prompt
- AI background refill only
- segmented progress bars
- 2 plays max
- answer stops audio
- speed button cycles 0.75x / 1.00x / 1.25x
- left speed label is display-only
- remove script toggle

Reading:

- text should be thinner/easier to read
- use space well for passage card
- if passage is too long, make passage card scroll internally
- at low levels, passages should start easier
- furigana should appear only where useful, especially non-AP or above-level kanji
- prompt difficulty and kanji difficulty must scale with level
- reading passage text size is user-configurable from Settings: Normal, Large, XL
- Japanese FuriganaText supports scaling so larger reading text does not only affect non-Japanese/plain text

Speaking/conversation/texting:

- avoid cramped headers
- no prompt truncation
- bottom controls need breathing room
- correct/wrong/skip challenge states need smooth animation

Skip challenge:

- thin “skip levels” card under level card
- opens checkpoint picker
- checkpoints at intervals of 10 levels, starting above current level
- start with 100 levels
- each 10-level interval has a rank/topic
- selecting a checkpoint opens mini test
- mini test should include 2 questions of each drill type across skipped level topics
- can miss only 2
- hearts/lives icon
- correct answer gets satisfying animation
- wrong answer shakes and heart shakes/takes damage
- leaving should not corrupt progress
- listening skip-challenge questions must not reveal the transcript; show an English question plus a Listen button/icon that plays the Japanese audio prompt

Skip-level cards should say only level + rank, no long mini description.

Recent drill/footer fixes:

- Global footer now uses an opaque card background so mobile drill content does not peek through under the footer.
- Mobile drill footer no longer uses the prior floating upward transform that could expose weird bottom gaps.
- Skip-challenge listening questions now store `audioText` separately and render only the English question plus a Listen button.
- Skip-challenge listening questions allow exactly one listen. The button must visibly change from Listen to Playing/Played and disable after playback starts.
- AP Reading now reads `readingTextSize` from settings and scales Japanese furigana passage text through `FuriganaText`.
- Daily session limit failures must never be silent. Home and Mini Mock now use an in-app `SessionLimitNotice` modal instead of relying on web/native alert behavior when Basic users hit the 3-session daily cap.
- AP Conversation/Text Chat no longer use an absolute fixed red action dock inside the drill screen. The Next Prompt/Review Session button sits in the normal scroll content flow to avoid overlaying captured answers or text inputs on mobile.

## Development / Progress Page

The Development card on Home should open a dedicated progress/development page.

Development page should include:

- actual graph, not just a red pill
- explanation of what the graph means
- footer tabs instead of a “Back to Practice” button
- no confirmation when leaving this page via footer
- balanced bottom spacing
- not too much empty space

Development index idea:

- positive/improving means recent scores trend above earlier work
- steady means flat
- detraining means recent sessions are slipping

Need to present this visually in a way that makes sense, with axes and graph positioning that do not imply “steady” is the lowest possible state.

## Home / Onboarding Polish

Desired copy/design:

- red AP Edition palette
- “Ultimate Language Slayer”
- “Ace Your AP Language”
- readable Japanese card
- thin white 日 icon
- varied background kanji angles
- Today’s Plan red fade with different kanji
- bigger streak flame

Mobile home must make it easy to start practicing without scrolling a lot.

## Mock Tab

Mock requirements:

- readiness circle/card
- completed cards should use solid done style
- show “Estimated AP score: #”
- completed part redo warning
- no unnecessary score pills
- mobile should use compact grid/card style, not giant vertical cards requiring endless scroll
- headers/footers should match Home and Library

## AI Question Generators

Question generators should:

- avoid repeats
- be level-aware
- always have local content ready
- generate next content in background
- not block the drill on AI generation

There should be separate AI agents/prompts by drill type and subscription level.

AI feedback by subscription:

- Standard: useful AP coaching, meaning, grammar, better model answer
- Elite: all of standard plus native-level phrasing, register, tone, naturalness, and explanation

Need special Mandarin prompts later.

## App Store / Launch Plan

The app is free with in-app purchases.

Owner tasks before launch:

- enroll in Apple Developer Program
- create App Store Connect app
- confirm final bundle ID
- configure in-app purchases
- prepare privacy policy/terms/support URL
- fill privacy nutrition labels
- prepare screenshots
- run TestFlight
- submit for review

Developer tasks:

- finish QA
- connect real billing
- connect restore purchases
- final privacy/terms text
- final dark mode pass
- final mobile safe area pass
- fix remaining bugs
- EAS build/submit setup

Validation:

```bash
npx tsc --noEmit
npm run validate:launch
npm run build:web
npx expo-doctor
eas build --platform ios
eas submit --platform ios
```

## Mandarin Version Plan

The Mandarin version should reuse the app shell but have its own language content.

Reuse:

- Home/Practice shell
- Library
- Mock
- settings
- subscriptions
- footer/header system
- review system
- development/progress system

Mandarin-specific work:

- language config for Mandarin
- AP Mandarin themes
- local Mandarin prompt bank
- Mandarin reading/listening/speaking/texting/conversation drills
- pinyin/tone display rules
- character difficulty ladder
- Mandarin-specific AI feedback prompts
- pronunciation feedback focusing on tones, initials/finals, rhythm
- cultural topics and AP-style prompts

Mandarin should be built as a first-class language, not just a translated Japanese version.

## Things To Remember About The User’s Preferences

- The user wants direct implementation, not hand-wavy “plans,” unless they explicitly ask for a plan.
- They care intensely about visual consistency.
- They dislike repeated browser tabs.
- They want app-store-grade mobile UI.
- They want clear, simple, professional app design, not clutter.
- They prefer seeing real changes plus validation.
- They will reload an existing local browser demo to see changes.
- Do not say something is fixed unless validation or code inspection supports it.
- If opening a browser, only do it when explicitly requested.

## Useful Existing Docs

```text
APP_BUILDING_STEPS.md
APP_STORE_OWNER_TASKS.md
APP_STORE_RELEASE_PLAN.md
APP_STORE_REQUIREMENTS.md
LAUNCH_CHECKLIST.md
LAUNCH_STATUS.md
PROJECT_HANDOFF.md
```

If this file becomes stale, update this one first so future chats can continue cleanly.
