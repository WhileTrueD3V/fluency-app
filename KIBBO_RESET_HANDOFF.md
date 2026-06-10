# Kibbo Reset Handoff: Ultra-Personalized AP Japanese Coach

This is the current clean-slate product and design reset for Kibbo.

Read order for a new chat:

1. `PROJECT_HANDOFF.md`
2. `DESIGN_HANDOFF.md`
3. `KIBBO_RESET_HANDOFF.md`

When older notes conflict with this file, this file wins.

Working directory:

```text
/Users/chocolate_god/Downloads/fluency-app
```

## North Star

Kibbo is the ultra-personalized AP Japanese coach that does not give students a lesson library. It diagnoses their exact AP rubric weak spots and generates today's work for the goal of earning a 5.

Short version:

```text
Kibbo does not give you lessons. Kibbo creates today's AP Japanese work from your exact weak spots.
```

## Why The Product Pivoted

The original version was too close to existing language apps: lessons, AI chat, mock practice, streaks, review, and generic progress. That is not defensible.

Memrise already has exam prep modes and AI chatbot practice. Duolingo Max already has AI roleplay and answer explanations. So "AI plus exam prep" is no longer enough.

Kibbo's real differentiator must be:

- AP Japanese first, not generic language learning.
- Rubric-aware, not just adaptive.
- Personalized around recurring error patterns.
- Generated around today's weak spot, schedule, device, and exam timeline.
- Coach-like, not course-catalog-like.

Do not drift back toward "Memrise but AP." That version loses.

## Product Positioning

Use this as the product sentence:

```text
The AP Japanese coach that builds today's work from your exact rubric weak spots.
```

Good supporting copy:

- Built for a 5, not generic fluency.
- Every drill exists because Kibbo saw a pattern.
- Your AP Japanese plan changes after every scored attempt.
- Practice generated from your rubric profile.

Avoid:

- Generic language learning.
- Lesson library as the main idea.
- "AI chat" as the differentiator.
- Streaks, XP, or games as the emotional center.

## Target User

Primary user:

- High school student preparing for AP Japanese.
- May also be preparing for Japanese placement tests at ASIJ/YIS.
- Uses iPhone for speaking and MacBook for Japanese IME typing.
- Wants score improvement, not generic app engagement.

The product should feel serious, focused, energetic, and app-store polished.

## AP Japanese Scope

Kibbo should optimize around the real AP Japanese task types:

1. Interpersonal Writing / Text-Chat
   - 6 prompts, 10 minutes.
   - Respond to text messages.

2. Presentational Writing / Compare-Contrast Article
   - 300-400+ Japanese characters.
   - Compare two topics/sides and express an opinion.

3. Interpersonal Speaking / Simulated Conversation
   - 4 prompts.
   - 20 seconds per response.

4. Presentational Speaking / Cultural Perspective
   - 1 minute read.
   - 4 minutes prep.
   - 2 minutes speaking about Japanese culture.

Core rubric dimensions:

- Task completion
- Delivery
- Language use
- Cultural knowledge

Every scoring feature, dashboard, plan, and generated drill should tie back to these dimensions.

## Core Product Loop

1. Diagnostic
   - The student completes a short assessment across the four AP task types.
   - Kibbo creates an initial rubric profile.

2. Rubric Profile
   - Shows strengths, weaknesses, and recurring error patterns.
   - Example: "You answer the prompt, but miss supporting detail in 64% of text-chat turns."

3. Dynamic Plan
   - Kibbo creates today's plan based on:
     - Rubric weak dimensions
     - Exam date/countdown
     - Available time
     - Energy level
     - Device context
     - Recent mistakes

4. Generated Work
   - No fixed lesson library as the core experience.
   - Prompts are generated for the student's current weak pattern.
   - Each drill should explain why it exists.

5. Rubric Feedback
   - AI scores using AP-style rubric dimensions.
   - Feedback explains patterns, not just one mistake.
   - Bad: "Your grammar is wrong."
   - Good: "You keep using casual endings in presentational writing. This is hurting Language Use on formal AP prompts."

6. Replan
   - After each scored attempt, Kibbo updates the next best action.
   - The student should feel the coach is paying attention.

## What Memrise Gets Right

Memrise feels modern, spacious, full, and interactive because it has strong design discipline. Do not copy the website. Learn the rules underneath it.

### Clear Palette

Memrise mostly uses:

- Yellow for primary actions, reward, upgrade.
- Mint/teal for learning panels and friendly highlights.
- Navy/black for structure and text.
- White for clean surfaces.
- Light gray for borders and inactive states.

The colors have jobs. They do not use every accent everywhere.

Kibbo has felt worse when it uses coral, teal, blue, yellow, gray, cream, red, and navy all at once. Low-opacity rainbow colors make the UI feel muddy and unfocused.

### Full-Screen Composition

Memrise uses the full desktop canvas without cramming:

- Strong left navigation.
- Wide horizontal bands.
- Cards with clear roles.
- Background illustration/image used as atmosphere, not as random filler.
- Enough modules to feel alive, but each module has room.

Kibbo often feels like "a bunch of cards" because every section becomes another bordered rectangle with the same visual weight.

### Consistent Scale

Memrise keeps type, cards, buttons, and layout scale consistent across pages.

Kibbo should stop having:

- One page with giant elements.
- Another page with tiny sidebar items.
- Huge mobile hero blocks that require endless scroll.
- Randomly centered desktop pages that ignore available space.

### Tactile Interactions

Memrise buttons feel clickable because they use:

- Rounded shapes.
- Bottom-edge shadows.
- Pressed states.
- Icon/text pairing.
- Clear hierarchy between primary and secondary actions.

Kibbo should use tactile controls too, but not every surface needs to be dark navy or oversized.

### Variety Without Chaos

Memrise avoids repetition by varying modules:

- Score band
- Activity card
- Carousel
- Promo banner
- Language cards
- Popups
- Charts and lists

Kibbo should avoid pages where five cards all share the same border, shape, typography, and spacing.

## Kibbo's Visual Direction

Kibbo should not become yellow Memrise. Build from Kibbo's logo and AP coach identity.

Palette roles:

- Ink/navy: primary text, structure, app chrome.
- Coral/red: AP urgency, weak signals, brand accent.
- Teal/mint: coaching, improvement, progress, success.
- Soft gray/ice: page background and neutral surfaces.
- Warm white: cards and readable content.
- Gold/yellow: credits/rewards only, used sparingly.

Logo-led palette:

- Deep navy
- Coral red
- Teal accent
- Small gold accent

Avoid:

- Old-timey cream/red/serif brochure feel.
- Yellow dominance that looks like Memrise.
- Random pastel tints across the same screen.
- Decorative Japanese scenery images unless they serve the product.

## Typography Direction

Use a strong, rounded, modern sans-serif feel. The UI should feel like a learning platform and coach dashboard, not an academic brochure.

Guidelines:

- H1 should be bold and readable, but not absurdly huge.
- Card titles should not compete with page titles.
- Uppercase labels should be used sparingly for rubric dimensions and section markers.
- Avoid excessive letter spacing.
- Keep Japanese text highly legible.
- Avoid serif as the main personality unless there is a specific, isolated reason.

## Backgrounds And Motifs

Kanji backgrounds can work, but only with discipline:

- Scatter across the page.
- Keep very low contrast.
- Vary scale and position.
- Avoid clustering only on the right.
- Never put heavy glyphs behind dense text.
- Do not make kanji backgrounds the main brand idea.

Better Kibbo motifs:

- Rubric graphs.
- Score path lines.
- Error memory chips.
- Calendar/countdown marks.
- Coach-generated plan modules.
- AP task icons.
- Progress trajectories from Diagnostic to Now to Goal.

Use visuals to explain coaching, not to decorate randomly.

## First Redesign Target: Home Page

The home page should become the "AP Coach Dashboard."

It should answer above the fold:

1. What is my current AP score path?
2. What weak rubric signal matters most today?
3. What exactly should I do next?
4. Why did Kibbo choose it?

Recommended desktop layout:

- Top app chrome:
  - Logo/nav.
  - Credits/streak/settings.
  - No huge subscription ad dominating the page.

- Main dashboard band:
  - Left: score path summary, goal, weakest rubric signal.
  - Right: a real line chart from Diagnostic -> Now -> Goal.
  - No fake random shapes pretending to be a graph.

- Today plan panel:
  - "Today's generated plan"
  - 2-3 coach-picked actions.
  - Each action includes AP task type, rubric target, time estimate, credit cost, and why it was generated.

- Rubric profile:
  - Four dimensions: task completion, delivery, language use, cultural knowledge.
  - Show score, trend, and one short pattern.

- Error memory / next check:
  - A compact coach note that feels specific.

Recommended mobile layout:

- No large subscription ad at the top.
- Compact header.
- First card is the next coach-picked action.
- Rubric profile fits as compact chips or a 2x2 grid.
- Generated work cards are compact.
- Activity is a small top-right trophy/quarter-circle trigger, not a vertical rail that overlaps text.

## Activity Surface

Activity should show AP-relevant progress, not generic app stats.

It should include:

- Credits used and remaining.
- Generated work completed.
- Rubric score trend over time.
- AP task distribution.
- Error patterns improving or worsening.
- Recent scored attempts.

If it slides in from the right:

- The arrow must not overlap the text.
- On mobile, use a small trophy/quarter-circle trigger.
- The drawer should feel like a secondary dashboard, not a cramped side rail.

## Real Graph Requirements

Do not fake a graph with random blobs.

A Kibbo graph should include:

- Axes or labeled anchors.
- A clear plotted line.
- Meaningful points.
- Labels such as Diagnostic, Now, Goal.
- A scale, for example 1-5 or rubric score.
- A restrained grid.

Good example:

- X-axis: Diagnostic, Last Week, Now, Goal.
- Y-axis: AP score estimate or rubric dimension score.
- Highlight current point.
- Use coral for weak/urgent and teal for improving.

## Credit System Direction

Credits should support monetization without feeling random.

Current intended model:

- Starter begins with 10 credits.
- Standard generated drill costs 1 credit.
- Mini mock costs 3 credits.
- Subscription gives more credits and deeper coaching.

When clicking a drill:

- Show a credit confirmation modal.
- Include:
  - Drill name
  - Why Kibbo generated it
  - Credit cost
  - Credits remaining
  - Start button

If insufficient credits:

- Disable Start.
- Show "Upgrade for more credits."

Subscription tiers should probably be:

- Pro: more credits and full rubric feedback.
- Premium: highest credit allowance, deeper error memory, mock readiness planning.

The paywall should feel like unlocking a stronger AP coach, not like a generic sales page.

## Page-Level Direction

### Home

Coach dashboard. Main question: "What should I do today and why?"

### Mock

AP readiness, not a generic mini-game. Keep scale consistent with Home. The user should not need to scroll just because this page uses bigger components.

### Library

Saved AP evidence:

- Saved feedback
- Model answers
- Recurring error patterns
- Useful generated prompts

Avoid generic "Saved work" emptiness.

### Drills

All drills should share one modern session shell:

- Clean top progress.
- Compact exit/save/score/credits.
- Main task content.
- Desktop coach panel.
- Mobile prioritizes prompt and answer controls.

Listening, reading, speaking, and text chat should feel like siblings, not separate design eras.

### Completion / Results

Results pages should not be stretched, empty, or hard to read.

They should include:

- Clear score/rubric result.
- One strong coach takeaway.
- Specific error patterns.
- Next generated action.
- Continue button.

Use celebration only when earned, and keep it useful.

## What To Remove Or Avoid

Avoid these unless there is a direct AP-rubric reason:

- Generic "Learn words / Hear words / Use words" categories.
- Big static language image cards.
- Streak as primary motivator.
- Huge subscription banner as first mobile content.
- Every module as a bordered card.
- Old cream/red serif design.
- Random activity rails that overlap words.
- Fake graphs.
- Generic empty states.
- Repetition of logo plus AP badge in multiple places.
- Low-opacity colors everywhere.

## Current Code Reality

The app is React Native + Expo Router with web/mobile demo surfaces.

Important files for design reset:

- `app/(home)/index.tsx`
- `app/(home)/library.tsx`
- `app/(home)/mock.tsx`
- `components/MainTabHeader.tsx`
- `components/KibboLogo.tsx`
- `components/APPracticeSession.tsx`
- `components/CreditStartNotice.tsx`
- `components/SessionLimitNotice.tsx`
- `components/ui/Button.tsx`
- `components/AnswerChoice.tsx`
- `constants/colors.ts`
- `utils/storage.ts`

Recent experiments added tactile raised buttons and credit modals, but the larger visual system is still unresolved. A new chat should not feel obligated to preserve the current home layout.

## Validation

Use these after meaningful code changes:

```bash
npx tsc --noEmit
npm run build:web
```

For broader launch-sensitive work:

```bash
npm run validate:launch
```

Do not open browser demos unless the user explicitly asks.

## Suggested Opening Prompt For A New Chat

```text
We are working in /Users/chocolate_god/Downloads/fluency-app.

Read PROJECT_HANDOFF.md, DESIGN_HANDOFF.md, and KIBBO_RESET_HANDOFF.md first. KIBBO_RESET_HANDOFF.md is the current product/design direction when older notes conflict.

This is a clean-slate design reset for Kibbo, a React Native + Expo Router AP Japanese coach. We are no longer making a generic language app or Memrise clone. The product is an ultra-personalized AP Japanese coach that diagnoses AP rubric weak spots and generates today's work for the user.

Start by auditing the current UI code and design system. Do not restart the repo from scratch. Do not open browser demos unless I explicitly ask. After you understand the current design debt, propose the highest-impact redesign pass for the home page first, with a clear palette and layout system, then implement carefully with validation.
```

## Acceptance Bar

The next design pass is not good enough until:

- The first screen immediately communicates "AP Japanese coach that generated today's work for me."
- The palette is obvious within five seconds.
- The home page feels like a coherent learning platform, not a stack of cards.
- The graph is a real graph with meaningful labels and data points.
- Mobile has a clean first action without overwhelming scroll.
- Desktop uses space well without cramming.
- Every major module has a reason tied to AP rubric improvement.
- The app no longer feels old-timey, generic, or like copied Memrise.

