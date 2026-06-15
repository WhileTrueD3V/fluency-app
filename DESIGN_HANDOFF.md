# Kibbo Design Handoff

Current reset note: the design/product direction has pivoted. Read `KIBBO_RESET_HANDOFF.md` after this file and treat it as the source of truth when these older notes conflict. Kibbo is now an ultra-personalized AP Japanese coach, not a generic language-learning app or Memrise-style course dashboard.

Use this file when starting a new chat focused primarily on design.

Working directory:

```text
/Users/chocolate_god/Documents/Apps/fluency-app
```

Also read:

```text
PROJECT_HANDOFF.md
```

## Product

Kibbo is a React Native + Expo Router AP language trainer. It started as AP Japanese and should eventually support more AP language courses, including Mandarin.

Current brand name:

```text
Kibbo
```

The user may change the name later, so do not hard-code branding in random files. Main brand constants live in:

```text
constants/brand.ts
```

Required disclaimer:

```text
Kibbo is not affiliated with or endorsed by College Board.
```

## Design Goal

The next design pass should make Kibbo feel like a real app-store-quality mobile app, not a patched web demo.

The target feeling:

- professional
- clean
- premium
- modern
- AP-focused
- easy to understand instantly
- visually memorable
- smooth and interactive
- less boring than the current cream/red-only version
- not cluttered
- not childish

The user often references Duolingo as a benchmark for clarity, simplicity, habit-forming interaction, and polish. Do not copy Duolingo visually. Use the lesson: simple flows, obvious actions, satisfying feedback, strong hierarchy, consistent spacing.

## Current Direction

Current visual foundation:

- cream/off-white paper background
- red AP Edition palette
- elegant serif headings
- kanji background glyphs
- mobile-first app shell
- bottom tab navigation
- drill progress bars
- cards with soft borders

This foundation is acceptable, but it currently feels too static/boring in places. The design chat should explore how to add more style, color, depth, interaction, and personality while preserving a premium AP-prep feel.

## Major Design Problems To Solve

1. Mobile screens must fit and breathe.
   - Avoid cramped drill layouts.
   - Avoid huge blocks that force scrolling before the user can act.
   - Keep bottom actions visible and reachable.
   - Respect safe areas and phone cutouts.

2. Headers and footers must be one system.
   - Home, Library, Mock, Development, Settings, and drills should not look like separate apps.
   - Main tab footer and in-drill footer should share the same component/style.
   - Icons must be vertically centered.
   - Desktop and mobile should feel related, not like two different products.

3. Drills are the core product.
   - Listening, Reading, Speaking, Conversation, and Text Chat need consistent structure.
   - Progress bars should match across drill types.
   - Save/points/header controls should feel consistent.
   - Feedback states should be satisfying and readable.
   - Prompts must never be visually cut off.
   - Reading passages should use available space, with internal scrolling only when necessary.

4. Modals need a real system.
   - Settings
   - Subscriptions
   - Daily limit reached
   - Leave drill confirmation
   - Library review
   - Skip-level challenge
   - Delete confirmation

   These should have consistent animation, spacing, close-button placement, safe-area handling, and desktop/mobile adaptations.

5. Library review must feel polished.
   - Saved Listening must include something to listen to.
   - Saved Reading must include passage content.
   - Saved Speaking should let users rehearse, then reveal the target.
   - Saved Conversation/Text Chat should show the full saved AP review, all turns, user answers, model answers, things to work on, and overall AP score.
   - Review should not award XP.

6. Dark mode needs design attention.
   - Do not just invert colors.
   - Make sure all text, cards, borders, toggles, modals, drill states, and kanji backgrounds remain readable and attractive.

7. Animations should be clean.
   - Star/save should not flicker.
   - Correct answer should feel satisfying.
   - Wrong answer should shake subtly.
   - Hearts/damage in skip challenge should animate.
   - Toggle switches should slide smoothly.
   - Plan selection should feel responsive.
   - Modal entrance/exit should feel intentional.

## User Preferences

Important:

- Do not open browser demos unless the user explicitly asks.
- If the user asks to open a demo, use the existing local demo route when possible.
- The user often reloads the same localhost tab to see changes.
- If using static export/dist preview, rebuild first or reload may show old code.
- The user wants implementation, not just vague design talk, unless they explicitly ask for brainstorming or a plan.
- The user gets frustrated by “almost matching” components. Use shared components/styles rather than recreating near-copies.
- Do not claim a visual issue is fixed unless the code clearly changed and validation passed.
- Run validation after changes.

Useful validation:

```bash
npx tsc --noEmit
npm run build:web
npm run validate:launch
```

## Local Demo Context

Common live/dev server:

```text
http://localhost:8082/
```

Common mobile preview route:

```text
http://localhost:8082/__mobile-demo
```

Older route-aware static preview has used:

```text
http://127.0.0.1:8083/
http://127.0.0.1:8083/__mobile-demo
```

Prefer live Expo dev server for iterative UI work. Use static export only when validating exported web behavior.

## Key Files For Design Work

Main screens:

```text
app/(home)/index.tsx
app/(home)/library.tsx
app/(home)/mock.tsx
app/development.tsx
app/onboarding.tsx
```

Drills:

```text
app/listening/session.tsx
app/ap/reading.tsx
app/speaking/translation.tsx
components/APPracticeSession.tsx
```

Shared UI:

```text
components/MainTabHeader.tsx
components/AppFooterTabs.tsx
components/DrillHeader.tsx
components/SessionLimitNotice.tsx
components/Icons.tsx
constants/colors.ts
constants/brand.ts
```

Storage/settings/subscription:

```text
utils/storage.ts
```

## Suggested Design Chat Opening Prompt

Paste this into the new chat:

```text
We are working in /Users/chocolate_god/Documents/Apps/fluency-app.

Read PROJECT_HANDOFF.md and DESIGN_HANDOFF.md first. This chat should focus primarily on design for Kibbo, a React Native + Expo Router AP language trainer.

The goal is to make the app-store mobile design polished, professional, consistent, smooth, and visually memorable. Start by auditing the current UI code and design system. Do not restart from scratch. Do not open browser demos unless I explicitly ask. After you understand the current design, propose the highest-impact design pass, then implement it screen by screen with validation.
```

## First Design Pass Recommendation

Start with a system audit before changing random screens:

1. Identify repeated headers/footers/modals/cards/buttons.
2. Create or tighten shared components.
3. Define mobile spacing tokens and footer/header dimensions.
4. Fix drill layout consistency.
5. Fix modal system.
6. Improve Home/Library/Mock visual personality.
7. Improve dark mode.
8. Add microinteractions.

The highest priority is not “make it prettier.” The highest priority is making the app feel like one intentional product.
