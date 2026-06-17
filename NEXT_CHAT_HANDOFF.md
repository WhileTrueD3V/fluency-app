# Kibbo Next Chat Handoff

This is the latest handoff for continuing work in:

`/Users/chocolate_god/Documents/Apps/fluency-app`

Read this file first in the next chat. Use `PROJECT_HANDOFF.md`, `DESIGN_HANDOFF.md`, and `KIBBO_RESET_HANDOFF.md` only as supporting context. This file overrides older design drift.

## Top Goals

When the user asks "what are our goals?" answer from this section immediately.

1. Deploy the AI server for production, not just localhost.
2. Run real QA cycles to confirm generated drills are high quality, varied, non-repeating, AP-shaped, and genuinely personalized to weak spots.
3. Test native app behavior, especially iPhone recording, playback, speech recognition, and speaking naturalness comparison.
4. Make first-completion feedback trackable beyond local storage, with a backend/admin-readable feedback pipeline or equivalent product analytics plan.
5. Fix desktop responsive behavior across Home, Library, Mini Mock, analytics, settings, and drills: when the desktop window is narrowed from any reasonable size, the UI should gracefully reflow and stay organized with no clipping, overlap, awkward empty space, or elements drifting out of place.
6. Add gems as a second currency with a real gem economy and shop:
   - Add gem count and shop icons side by side in the desktop sidebar.
   - The gem count should be clickable and open a page explaining how to earn gems.
   - Gems should come from things like completing the daily plan, reaching level benchmarks/titles, completing levels, streak/consistency achievements, and daily gem tasks.
   - Add a gem-task list similar to the home daily plan, but focused on earning gems.
   - Add a shop page where gems can buy things like streak freezes, XP boosters, bonus credits, and other retention/reward items.
7. Redesign the mobile app experience so it reaches the same quality as the desktop design: Home, Library, Mini Mock, settings, drills, popups, navigation, spacing, typography, and responsiveness should feel purpose-built for phone instead of a squeezed desktop layout.
8. Implement Apple in-app purchases and receipt validation for the real credit/subscription system.
9. Add the missing full AP task coverage:
   - Presentational Writing: compare/contrast article, 300-400+ characters.
   - Presentational Speaking: cultural perspective presentation with prep and timed response.
10. Finish legal/privacy/App Store launch setup, including terms/privacy review, store assets, screenshots, and submission prep.

## Current AI Billing / Live Audit Status

The local `.env.local` exists and contains the safe OpenAI cost-control route:

- `AI_PROVIDER=openai`
- `AI_MAX_COST_CENTS_PER_CREDIT=1`
- `AI_ENFORCE_COST_CAP=1`
- `OPENAI_MODEL=gpt-4.1-nano`
- `OPENAI_CONTENT_MODEL=gpt-4.1-nano`
- `OPENAI_DAILY_PLAN_MODEL=gpt-4.1-nano`
- `OPENAI_REVIEW_MODEL=gpt-4.1-mini`
- `OPENAI_ELITE_REVIEW_MODEL=gpt-4.1-mini`

The user added an OpenAI API key locally. Do not print it. The user also added a small $5 OpenAI API Platform test credit balance. Treat it carefully and do not run repeated live audits unless needed.

Latest live cost audit status:

- `npm run audit:ai-cost:live` passed all 9 live calls after adding OpenAI Responses JSON mode.
- Total estimated provider cost for the successful 9-call live audit was about `0.784` cents total.
- The cost target `1 credit <= 1 cent` is holding with nano for generation/daily plan and mini for reviews.
- Daily plan was about `0.0276` cents, generated drill calls were about `0.05-0.10` cents, and AP reviews were about `0.07-0.19` cents in the successful run.

Latest quality audit work:

- Daily plan prompt now requires exactly one AP rubric string, and the server normalizes combined rubric strings before the app sees them.
- OpenAI Responses JSON mode is enabled for server calls to reduce malformed JSON failures.
- AP conversation/texting content is now normalized server-side so prompts/model answers are app-shaped string arrays and mode matches the request.
- If AP prompt-set normalization produces zero valid sets, the server returns `502 AI_CONTENT_SCHEMA` so the app can fall back instead of accepting an empty AI result.
- A targeted two-call verification passed for `conversation` and `texting`: both returned 2 valid app-shaped AP prompt sets, costing about `0.0896` cents total.
- Latest tiny live QA attempt on June 10, 2026 used an isolated server on port `8799`, added only about `0.0838` cents, and stopped early because the content repeat guard caught a repeated club/schedule-change reading frame. That was a useful failure, not a runaway spend.
- `server/grading-server.mjs` now retries generated content once when the first result fails novelty checks, with explicit "same skill, different situation" guidance. If the retry still fails, the server rejects the content instead of letting stale content into the app.
- `npm run audit:ai-quality` now runs offline prompt/guard checks by default and includes a gate proving the retry prompt changes scenario and answer logic.
- No live paid AI calls were made after that tiny QA attempt. Latest logged usage remains 48 calls / about `4.2491` cents lifetime provider spend.
- On June 11, 2026, production `/api/health` was checked again at `https://kibbo-language-master.vercel.app/api/health` and returned safe OpenAI config:
  - `provider: openai`
  - `hasKey: true`
  - `contentModel: gpt-4.1-nano`
  - `eliteReviewModel: gpt-4.1-mini`
  - `costControls.enforceCostCap: true`
- A tiny production sampler was started with `AI_SERVER_URL=https://kibbo-language-master.vercel.app/api npm run audit:ai-tiny-live`. It stopped early on the texting generation step because production returned `502 AI_CONTENT_REPEAT` for a repeated late-arrival plus what-to-bring frame after retry. That means the server guard correctly blocked stale content instead of letting it into the app.
- After that failure, `server/grading-server.mjs` was tightened again:
  - `blockedFrameGuidance(payload)` now adds explicit blocked-frame terms when recent history contains late-arrival plus what-to-bring or club/schedule-change patterns.
  - For late/bring history, content prompts now explicitly forbid late/遅れ/遅刻/遅い and bring/持って/持ち物/what-to-bring terms in title, situation, prompts, model answers, questions, choices, and quality notes.
  - Retry prompts now include the same explicit ban when the rejected issue is late-arrival plus what-to-bring.
- `scripts/ai-tiny-live-qa.mjs` now writes partial JSON/Markdown reports even when a live sampler fails, instead of losing the successful earlier cases.
- A second tiny production sampler passed all checks after deploy, but manual inspection showed the texting set still used standalone `遅れそう` in a homework-deadline scenario. That avoided the full late+bring repeat but violated the stricter blocked-frame intent.
- The deterministic server novelty guard was tightened again after that:
  - If recent history contains late-arrival plus what-to-bring, `generatedContentNoveltyIssues` now rejects any standalone late/遅れ/遅刻/遅い or bring/持って/持ち物/what-to-bring surface element, not only the combined frame.
  - `scripts/ai-tiny-live-qa.mjs` now fails the same standalone blocked terms.
  - `scripts/ai-quality-review.mjs` added an offline case proving standalone blocked late/bring surface terms are rejected.
- No third paid sampler was run after the stricter deterministic blocker yet. Deploy this stricter guard first, then rerun only the tiny sampler if the user approves.
- Offline verification after the fix:
  - `node --check server/grading-server.mjs` passed.
  - `node --check scripts/ai-tiny-live-qa.mjs` passed.
  - `npm run audit:ai-quality` passed, including the new blocked late/bring prompt and standalone surface-term checks.
  - `npx tsc --noEmit` passed.
  - `npm run build:web` passed.
  - `npm run validate:launch` passed with the existing bundle-id warning.

Before another broad live QA pass, prefer targeted two-call checks or inspect generated outputs first to avoid wasting the user's prepaid test credits.

## Git / GitHub Status

This folder was not originally a Git repository. On June 10, 2026, a local Git repository was created in `/Users/chocolate_god/Documents/Apps/fluency-app`.

- Current branch: `main`
- Initial commit: `a352c63` (`Initial Kibbo app repository`)
- GitHub remote: `origin` -> `https://github.com/WhileTrueD3V/fluency-app.git`
- `main` is pushed and tracking `origin/main`.
- `.env.local`, `.expo/`, `dist/`, `node_modules/`, `.vercel/`, `.claude/`, and local JSONL usage logs are ignored.
- `validate:launch` and `npx tsc --noEmit` passed before the initial commit.
- `gh` is not installed in the Codex environment, but pushing via Git HTTPS worked after the user provided the repo URL.

Deployment setup details are documented in `TEACHER_BETA_DEPLOYMENT.md`.

## Vercel Teacher Beta Deployment Status

The GitHub repo was connected to Vercel and deployed on June 10, 2026.

- Vercel project: `dashbrier-9197s-projects/fluency-app`
- Production URL: `https://kibbo-language-master.vercel.app`
- Previous URL `https://fluency-app-five.vercel.app` redirects to the current production alias.
- Deployment inspector: `https://vercel.com/dashbrier-9197s-projects/fluency-app/13KvXDHNdQbvvXGUEF8QbJyVU2cX`
- GitHub integration is connected to `https://github.com/WhileTrueD3V/fluency-app.git`.
- Production environment variables are configured, including server-side `OPENAI_API_KEY`, OpenAI nano/mini model split, and cost caps.
- `/api/health` was checked after deploy and returned:
  - `ok: true`
  - `provider: openai`
  - `hasKey: true`
  - `costControls.enforceCostCap: true`
  - `costControls.exposeCosts: false`
- Frontend root returned HTTP 200.
- A tiny live daily-plan generation call returned HTTP 200, confirming deployed AI generation works. That sampler exposed a repeated school-notice/change frame, so `server/grading-server.mjs` was tightened with broader daily-plan novelty guidance and a broader deterministic daily-plan sanitizer. Latest production deploy after that fix is ready and `/api/health` still passes.

Important: Only Production env vars were added through the CLI. Preview/Development Vercel env setup hit a Vercel agent-mode branch prompt and can be filled later in the dashboard if preview deployments need AI access. The teacher beta production URL works with the configured Production env vars.

## Product Direction

Kibbo is an ultra-personalized AP Japanese coach, not a generic language app, not a Memrise clone, and not a fixed lesson library.

The core promise:

> Kibbo creates the exact AP Japanese work the learner needs today from level, weak rubric patterns, recent mistakes, repeated prompt patterns, today completed work, and the goal of reaching a 5.

The app should feel like a coach deciding the next best rep, not a course catalog. Avoid generic language-learning features unless they clearly support AP Japanese score growth.

## Hard Design Rules

- Do not use graphs.
- Do not use decimal scores like `2.6/5`.
- Do not make the UI a pile of cards.
- Do not drift into yellow-heavy Memrise copying.
- Gold/yellow is only for credits/rewards.
- Use Kibbo logo palette:
  - Deep navy: main text, dark panels, main buttons.
  - Coral red: brand accent, weak signals, selected states.
  - Teal/mint: coach-picked work, progress, positive coaching.
  - Warm white: surfaces.
  - Ice gray: app background and secondary panels.
- Design should feel modern, tactile, polished, unique, and app-store quality.
- Buttons and cards need real hover/press motion and alignment polish.
- Text should not overflow, clip, or be excessively bold everywhere.

## AP Scope

Kibbo should optimize for actual AP Japanese tasks:

- Interpersonal Writing: text-chat, 6 prompts, 10 minutes.
- Interpersonal Speaking: simulated conversation, 4 prompts, 20 seconds each.
- Presentational Writing: compare/contrast article, 300-400+ characters. This is still a major missing task.
- Presentational Speaking: cultural perspective, prep and 2-minute response. This is still a major missing task.

Rubric language is central:

- Task completion
- Delivery
- Language use
- Cultural knowledge

Feedback should be pattern-specific, for example: "You keep overusing formal register in casual text-chat prompts," not generic "grammar is wrong."

## Current App State

This is an Expo Router / React Native app.

Important current files:

- Home: `app/(home)/index.tsx`
- Library: `app/(home)/library.tsx`
- Analytics: `app/analytics.tsx`
- Listening drill: `app/listening/session.tsx`
- Reading drill: `app/ap/reading.tsx`
- Speaking translation drill: `app/speaking/translation.tsx`
- AP conversation/texting shared session: `components/APPracticeSession.tsx`
- Icons: `components/Icons.tsx`
- Colors: `constants/colors.ts`
- AI endpoint helper: `utils/aiApi.ts`
- AI daily plan: `utils/aiPlan.ts`
- AI content generation client/parsing: `utils/aiContent.ts`
- Generated content queue: `utils/practiceContentQueue.ts`
- Personalization profile: `utils/personalization.ts`
- Route target-skill helper: `utils/targetSkills.ts`
- Storage/credits/attempt memory: `utils/storage.ts`
- First completion feedback popup: `components/FirstCompletionFeedbackModal.tsx`
- AI grading/generation server: `server/grading-server.mjs`

Latest validation passed:

- `npx tsc --noEmit`
- `npm run build:web`
- `npm run validate:launch`
- `npm run audit:ai-cost`
- `npm run audit:ai-quality`
- `npm run feedback:report`
- `npm run ai:usage`
- `node --check server/grading-server.mjs`

Latest web export wrote:

- `dist/_expo/static/js/web/entry-21b266e20b8e23aec3607bec94e2dd6a.js`

The preview server for the latest pass was available at `http://127.0.0.1:8083`. If it looks stale, rebuild with `npm run build:web` and restart `npm run preview:web`. The user wants the demo kept current without repeated permission prompts.

## Latest Drill Reload / Credit Safety Fix - June 16, 2026

User reported a serious exploit/inconvenience: refreshing a drill route generated a new question set without spending another credit. Fix applied locally and pushed after validation:

- Added paid-session content caching in `utils/storage.ts` via `getDrillSessionContent` / `saveDrillSessionContent`, keyed by language, drill type, and route `sessionId`.
- Home launchers now pass fresh `sessionId` values for listening, reading, speaking, conversation, and texting sessions after the credit confirmation.
- Mini Mock uses stable per-mock/per-section session ids like `mockId:listening`, so refreshing a mock part resumes the same paid part while a new mock attempt can still get fresh content.
- Listening, Reading, Speaking, Conversation, and Texting routes now check the session cache before generated/local selection and save the selected/generated content for that session.
- Challenge/Astro boost state is still computed before session-cache resume where it affects rewards, so refresh should not quietly drop boost behavior.
- Verification passed: `npx tsc --noEmit` and `npm run build:web`.

## Latest Reading Evidence Polish - June 17, 2026

User reported that after a wrong reading answer, the main passage was not highlighting the specific answer spot and the passage meaning appeared too early. Fix applied:

- `app/ap/reading.tsx` now prefers a question's shorter `keyword` phrase for the passage highlight when that phrase appears in the passage, instead of highlighting the full evidence sentence.
- The passage meaning reveal is now controlled by `shouldShowPassageMeaning` and only appears during feedback on the final question for that passage.
- `data/japanese.ts` now adds explicit evidence/keyword metadata for the local `After-school message` questions, so wrong answers highlight `宿題をしてから` / `六時ごろ` instead of relying on heuristic guessing.
- Verification passed: `npx tsc --noEmit` and `npm run build:web`. Preview reading route returned HTTP 200 at `http://127.0.0.1:8083/ap/reading`.

## Latest Drill Refresh Progress Fix - June 16, 2026

User later reported that refresh no longer created free new drill sets, but still reset answered questions and timers. Follow-up fix applied locally:

- Added `getDrillSessionProgress` / `saveDrillSessionProgress` in `utils/storage.ts`, keyed by language, drill type, and route `sessionId`, with an 80-entry cap.
- Listening refresh now restores current question index, selected/answered feedback state, play counts, streaks, XP, and selected answer.
- Reading refresh now restores current passage/question, selected answer, feedback/complete phase, streaks, XP, and remaining timer; restored indices are clamped to the cached passage shape.
- Speaking translation refresh now restores current prompt, phase, result, XP, transcript, saved hint state, heard-target state, and recording URI. Active `recording` / `evaluating` phases resume as transcript review to avoid duplicate recording or duplicate AI scoring.
- AP conversation/texting refresh now restores turn index, countdown, draft/answers, recording URIs, conversation phase, review result, and save-after-review state.
- `components/AnswerChoice.tsx` was simplified to use a normal `Pressable` inside an animated wrapper and removed web CSS transition props that could fight React Native animation and cause hover flicker/jiggle.
- Verification passed: `npx tsc --noEmit` and `npm run build:web`. Fresh preview route checks returned HTTP 200 for `/`, `/ap/reading`, `/listening/session`, and `/speaking/translation`. Browser automation was unavailable in this session because the Browser runtime failed to start and Playwright was not installed in the moved workspace, so visual interaction QA still needs a manual/in-browser pass.

## Latest Reading Drill Fixes - June 16, 2026

User reported three reading-drill failures: repeated Study Spot Advice prompt, wrong evidence highlight for "What does the writer recommend?", and incomplete furigana after a wrong answer. Fixes applied:

- Local Study Spot Advice reading questions in `data/japanese.ts` now include explicit `evidence` and `keyword` metadata. For the recommendation question, the highlighted evidence is now `静かに勉強したいなら、少し遠くても公園の近くのカフェのほうがいいでしょう。`, not the unrelated weekend crowding sentence.
- `app/ap/reading.tsx` evidence fallback no longer picks arbitrary clauses on zero-score ties. It uses explicit evidence first, then Japanese cue terms derived from the correct answer; if evidence confidence is zero, it highlights nothing instead of highlighting nonsense.
- Reading prompt exposure now records passage IDs, question IDs, passage signatures, and question/evidence signatures via `readingExposureIds`, so repeat suppression has more than just the passage ID.
- `data/index.ts` local reading fallback now filters by those repeat signatures before selecting static readings, reducing repeats when generated content/cache is unavailable.
- `utils/furigana.ts` got broader dictionary coverage for the Study Spot and cashless passages, including `店`, `少し遠くても`, `公園の近く`, `長い時間`, `店員に急がされる`, etc. This improves full-review furigana, but it is still dictionary-based rather than a full morphological analyzer.
- Verification after these fixes: `npx tsc --noEmit` passed and `npm run build:web` passed.

## Latest Placement / Boost Work

The newest completed work added first-open placement and fixed two launcher-state bugs:

- Home now shows a mandatory starting-level modal until the learner answers it. Existing testers will see it once unless their browser/app storage already has `@fluent:startingLevelProfile`.
- The modal states that Kibbo is for Japanese learners chasing AP-level mastery, not a first-day alphabet course.
- Four starting choices are implemented in `utils/storage.ts`:
  - `Absolute Novice`: target level 1, no XP boost.
  - `Classroom Starter`: target level 4, `+25% XP`.
  - `Course Ready`: target level 8, `+50% XP`.
  - `AP-bound`: target level 12, `2x XP`.
- Higher choices create an `Astro Boost`. It is guaranteed for 15 non-Mini-Mock drills, then remains active only while the learner has not hit the chosen target level, failed 5 questions, or received 2 AP review scores below 4.
- Astro Boost now feeds both reward XP and generated-practice calibration:
  - Home combines Astro Boost with the existing performance-based Challenge Boost and shows the strongest active boost.
  - Listening, Reading, Speaking translation, AP Conversation, and AP Texting use the strongest boost for XP.
  - Generated practice requests use Astro Boost to set a fair higher generation level without adding extra AI calls.
  - Mini Mock remains unboosted so it stays a clean readiness signal.
- The boost badge now appears above the credits chip on mobile and tight desktop, and next to weak-spot work on full desktop when space allows.
- The first Home coach-picked fallback no longer says `Run the AP diagnostic` / level-test copy before AI plan loading finishes. For zero sessions, it now starts with a real `Text-chat register repair` AP warmup.
- Home and Mini Mock interactive launchers now reset pressed state before opening credit confirmation, preventing the stuck pressed/animation state if the user cancels the credit modal.
- Verification run:
  - `npx tsc --noEmit` passed.
  - `npm run build:web` passed.
  - `npm run validate:launch` passed before the final tiny badge visibility tweak; `npx tsc --noEmit` and `npm run build:web` passed again after it.
- Browser preview check:
  - `http://127.0.0.1:8083/` showed the mandatory placement modal before selection.
  - Selecting `AP-bound` dismissed it and showed `Astro · 2x XP` above the credits chip in the tight preview.
- The local in-app browser preview now has AP-bound selected because it was used for verification. Reset app storage if the user wants to see the modal again locally.

Follow-up refinement after that:

- The placement popup no longer tells users they will receive an XP boost. It only shows calibration language such as `Level 4 calibration`; the Astro Boost is still granted silently after selection.
- The placement modal is now more responsive, with compact padding/title sizing and an internal scroll area for shorter phone screens.
- Home now supports multiple visible active boost badges at once. If the learner has Astro Boost from placement and also earns the performance Challenge Boost, both compact boost badges can render cleanly:
  - Mobile/tight desktop: badges wrap above the credits chip.
  - Full desktop: badges render next to the weak-spots shelf title.
- Reward math and generation routing still use the strongest active boost, not runaway stacked multipliers.
- Verification after this refinement:
  - `npx tsc --noEmit` passed.
  - `npm run build:web` passed.
  - `npm run validate:launch` passed.

Latest placement-modal repair:

- The first-open placement modal had a bad web layout regression where option cards collapsed into skinny columns. Root cause: the animated child view had the option width while the outer `Pressable` wrapper did not, so the row layout sized the pressables too narrowly.
- Fixed by adding `wrapperStyle` support to Home's `InteractivePressable`, putting desktop/tight option widths on the press wrapper, and keeping the animated child at `width: '100%'`.
- The modal layer now uses a fixed-position web overlay with high z-index/elevation so it sits above app chrome.
- Desktop placement options are intended to render as a clean 2x2 grid; mobile placement options render as stacked full-width cards with internal scrolling on short screens.
- The mobile preview route no longer has its own fake dock. `app/__mobile-demo.tsx` now iframes the real app with `mobilePreview=1`, and `scripts/preview-web.mjs` no longer injects an outer preview dock or `hideFooter=1`.
- `AppFooterTabs` hides the real compact footer on main tabs until the required starting-level setup is answered, and its z-index was reduced so modals can cover it.
- Verification after this repair:
  - `npx tsc --noEmit` passed.
  - `npm run build:web` passed.
  - `npm run validate:launch` passed with the existing bundle-id warning.
  - `rg -n "Mobile preview navigation|preview-dock|hideFooter=1" dist scripts app components` returns no matches.
- Preview server is running again at `http://127.0.0.1:8083` from `npm run preview:web` (latest observed PID `7358`). Local curl from the sandbox may fail with `Operation not permitted`, but `lsof` confirmed the Node server is listening on `127.0.0.1:8083`.

Newest popup design refinement:

- The starting-level modal was redesigned from a plain stacked list into a cleaner calibration sheet.
- Desktop now uses a modern 2-by-2 option tile layout; mobile/short screens use compact sizing and a stacked native-sheet style list.
- Desktop option tiles were refined again on June 13, 2026 so labels and descriptions do not show `...`: the level calibration pill moved out of the title row, titles/descriptions can breathe, and metadata sits in the tile footer.
- Mobile option tiles were tightened so the first-open calibration sheet feels less like squished desktop: shorter summaries, smaller level orbs, reduced padding/gaps, no blue/gold focus outline, and cleaner in-card metadata.
- Option tiles now use `InteractivePressable`, so they have hover lift, shadow, border feedback, pressed feedback, and animated arrow motion.
- The popup still does not advertise XP boosts; it only shows calibration language and short readiness descriptions.
- Verification after this redesign:
  - `npx tsc --noEmit` passed.
  - `npm run build:web` passed.
  - `npm run validate:launch` passed.
- Latest local preview after the June 13 refinement was checked in both narrow/mobile preview and a temporary 1440x900 desktop viewport. The browser viewport override was reset afterward.

The AI server on port `8787` was running from this repo as PID `36107`, attached to another terminal. Server prompt changes require a grading-server restart to take effect. Do not casually kill/restart it from a shell that lacks API keys, because that can replace a keyed server with an unkeyed one.

Latest AI/content behavior changes:

- Generated practice requests now include explicit level-pressure guidance from `utils/practiceContentQueue.ts`.
- Level 1-3 start easy but not childish: short prompts, familiar contexts, high-frequency vocab, light kanji, and a small confidence-check stretch.
- To avoid early-user churn from work feeling too easy, generated practice now has performance-based challenge calibration. Strong recent completions can raise the generation target above the displayed XP level without adding another paid call.
- The calibration uses recent session scores already stored locally: two strong samples create early stretch, three excellent samples create stronger stretch, and five excellent samples can fast-track toward AP pressure.
- Level 4-7 stays beginner only until recent performance proves it should stretch; Level 8-19 ramps into intermediate pressure; Level 20+ can use advanced AP pressure.
- Challenge Boost is now a shared product mechanic in `utils/challengeBoost.ts`. When recent scores show the learner is clearly crushing level-fit work, generated practice can calibrate upward and normal drills award `2x XP` while the boost is active.
- The boost applies to regular Listening, Reading, Speaking, AP Conversation, and AP Text Chat drills. It intentionally does not apply to Mini Mock or saved prompt replays.
- Home shows the active boost: desktop displays a `Challenge Boost · 2x XP` badge next to `Built for your weak spots`; mobile shows a compact boost badge above the credits chip.
- `server/grading-server.mjs` now respects challenge calibration/effective generation level signals and tells the model to avoid churn from boring beginner work while staying within the requested difficulty.
- After the user saw an apparent 3-cent charge from one reading drill, the likely issue was hidden/repeated background calls and/or coarse OpenAI dashboard deltas, not the projected cost of one reading generation call. Offline audit still projects reading content at about `0.0992` cents typical and `0.1542` cents worst-case on `gpt-4.1-nano`.
- Daily plan generation now caches the same learner state for 6 hours in `utils/aiPlan.ts`, so Home reloads do not keep spending provider money.
- Home prewarm now fills only the first non-mock daily-plan mode and no longer falls back to default listening/speaking prewarm when the plan has no drill modes.
- `server/grading-server.mjs` now writes every AI usage log entry to `data/ai-usage.jsonl` by default via `KIBBO_AI_USAGE_LOG_PATH`.
- New command: `npm run ai:usage` summarizes the most recent logged AI calls without making API requests.

## Recent UI Changes Already Done

Shared drill loading:

- Listening, Reading, Speaking, AP Conversation, and AP Text Chat now use a shared `DrillLoadingState`.
- The loader is intentionally shared across desktop and mobile, not mobile-only.
- It replaces plain loading text with a coach-prep surface, animated activity rail, mode-colored icon, and rotating setup steps such as level fit, weak spot, fresh prompt, and no repeats.
- It includes honest cache copy: first build takes the longest, then warmed fresh sets usually open faster.

Mobile-only pass:

- Important boundary: the latest visual cleanup intentionally targets phone/mobile branches only. The desktop design should remain visually unchanged.
- Home now passes a true `mobile` flag into the learning dashboard instead of treating narrowed desktop and phone as the same thing.
- Mobile Home was calmed down: the coach-picked action and generated plan panel are lighter warm-white/ice-gray surfaces on phone, with smaller accent use instead of large saturated teal/navy blocks.
- Mobile Home quick reps now use mostly white tiles with small accent strips and softer shadows, so each drill remains distinct without overwhelming the screen.
- Mobile Home weak-signal and credit chips were softened so coral/gold do not compete with the main task.
- Mobile Mini Mock now has a phone-only calm layout pass: smaller title/action surfaces, a compact readiness strip, a softer ladder panel, a lighter AP parts grid, and a smaller segmented readiness ring. Desktop Mini Mock remains on the existing desktop styling.
- The shared drill header now has mobile-specific progress bar styling with a smoother pill rail, shine/cap treatment, and more breathing room below the phone notch area.
- Listening and reading answer choices now receive a `mobile` prop and have stronger mobile hover/press feedback in the web preview.
- Speaking translation drills now use a teal mobile progress accent, a calmer prompt card, and a less cramped mobile record area with a softer stage background. Desktop speaking remains on the existing accent treatment.
- Rubric profile tiles on Home/Analytics should stay neutral by default, matching the Cultural Knowledge tile style. Only the single current next weak spot gets the soft coral/red highlight and coral accent.

Onboarding / landing page:

- Landing/onboarding was redesigned to match the newer Home language instead of the older course-picker look.
- The page now uses the shared `KanjiBackdrop` texture, Kibbo logo lockup, AP Edition pill, warm-white hero surface, and deep-navy coach loop panel.
- The main promise is Japanese-first: `Japanese 日本語`, with copy focused on coach-personalized AP drills from weak spots instead of a generic AP language trainer.
- The hero no longer contains a nested Japanese course card. It now has the direct deep-navy `Start coach` CTA inside the hero.
- The course list below the hero shows Japanese plus future languages in the same card format. Japanese is live; Mandarin and Spanish are visible immediately with `Coming soon` states.
- Course cards have hover/press motion: lift, slight scale, image zoom/mark focus, teal border/background feedback, and a one-way arrow nudge when actionable.
- Mid-width and mobile layouts stack the hero, coach panel, and course list to avoid clipping or cramped text. Flex is only applied to the wide two-column layout so stacked layouts size naturally.

Library:

- Saved item stars now use one consistent teal accent.
- Yellow saved-item icon circles were removed.
- Type headers use one consistent color.
- Text chat uses a message icon instead of book icon.
- Saved lessons now use tactile warm-white row surfaces with teal icon wells.
- Saved lessons have web hover/focus/press lift and border/shadow feedback. The extra library row chevrons were removed.
- Saved tab controls now sit in a modern "Saved controls" tray instead of loose Search/Select pills.
- Selected saved lessons now wrap fully with the coral border, including the bottom edge.
- AP review saved cards do not show the AP score pill on the main card.
- Library backdrop now has 15 more-visible scattered kanji glyphs using stronger navy/coral/teal/gold alpha values.
- Library header is now tabbed: Recently completed, Saved, and Review.
- Library Recent Work subtitle now says `N most recent completion(s)`, for example `3 most recent completions`.
- Recently completed uses the latest three `SessionRecord`s from session history, independent of saved items.
- Recently completed cards were redesigned as clickable activity cards with saved-status pills, reviewable item counts, hover lift, and score/XP footers.
- Clicking a Recently completed card opens a detail modal showing whether the available review items are already saved. Each drill/review item inside that modal can now be individually toggled: tap once to save it into Library, tap again to unsave it. The flow reconstructs saved items from `AttemptMemory` when available, including AP review JSON-style summaries for conversation/text-chat, and falls back to a session summary if detail memory is missing.
- Saved keeps search/select/delete behavior.
- Review is now an inline review-builder tab with a light mint/home-palette builder, larger "Fast pool selection" filters, separate count badges inside each filter, Start Review, and a separate "Selection review" mode for manually adding/removing saved work. The old "Current pool" summary strip was removed. Saved items are only shown in the Review tab while Selection review is open, and cards there only toggle pool membership; Start Review is the only path into the actual review flow.
- Library review now closes immediately when the final review item is completed. The extra "Review finished / Done" modal was removed.
- Library desktop header/tabs/Saved controls/list/review/empty states now use shared desktop inset constants so Recent, Saved, and Review align to one grid. The shared streak/settings header was not moved.
- Saved tab table header (`Saved item / Answer-review / Actions`) is now outside the saved-items ScrollView, so it stays fixed while saved rows scroll.

Mini mock:

- Product decision: Mini Mock should be AP-exam-shaped but not a fixed static test. The section structure should replicate AP tasks, while generated content should scale by learner level/rubric readiness until the learner is ready for true full-AP difficulty. At AP-ready levels, it should feel like a real AP mini exam. Do not let low-level users see a misleading `AP 5` from level-scaled content and assume they are done.
- Mini Mock score box now avoids false confidence: below Level 21 it shows a `Level signal` label with status text like `Baseline`, `Building`, `Ready`, or `Strong`; at Level 21+ it can show `AP estimate`.
- Mini Mock now has a visible challenge ladder: `Level signal -> AP estimate -> 5-proof -> Consistency`. This is the retention loop after a good mock: an AP 5 unlocks harder pressure rather than ending the product journey.
- The Mini Mock `?` explainer modal now explains that a 5 is a checkpoint, not the finish, and defines Level signal, AP estimate, 5-proof, and Consistency. Consistency copy says it aims beyond an AP 5 estimate by pairing harder mocks with daily plans and personalized weak-spot drills that move the learner to higher Kibbo levels.
- Mini Mock reads prior mock session history to keep ladder progress after reset. One completed AP 5 mock unlocks `5-proof`; two AP 5 mocks unlock `Consistency`.
- Mini Mock routes now pass harder `targetSkills` into section drills based on ladder tier, including `5-proof pressure`, `denser evidence`, `register nuance traps`, `less beginner support`, and `AP 5 retention`.
- Mini mock was restyled toward the newer home/dashboard language: warm-white framed surfaces, deep navy primary action, calmer body text weights, and teal up-next/completed states.
- Latest Mini Mock pass removed the forced tall/stretching dashboard cards. The summary and parts columns now size to content, the left side is a tight stack of smaller purposeful surfaces, and the right "Mock parts" panel no longer has a large empty bottom.
- Mock background now uses 16 more-visible scattered exam/practice kanji glyphs so the open space feels intentionally filled without using extra cards.
- Mini Mock no longer uses the large outer background board around the two main panels; the summary and task-order panels now sit as standalone surfaces lower on the page.
- Mini mock section tiles now use the same hover/focus/press lift and nudging chevron behavior as the home screen.
- Mini mock remains compact enough for desktop, but the latest structure uses standalone left/right panels instead of a single enclosing board.
- The readiness wheel is now a four-segment ring with the completed part count centered inside it.
- Latest Mini Mock pass moved the structure closer to the home screen: left summary/readiness/next-action panel and right deep-navy "Mock parts" checklist panel.
- Mini Mock no longer repeats `0/4 parts` outside the wheel and no longer repeats the estimated AP score in the helper sentence.
- Mini Mock part rows are vertically contained in the checklist panel, fixing the Part 3/4 overflow.
- Mini Mock part-row subtext descriptions were removed, and the bottom "Next: finish..." helper sentence was removed.
- Mini Mock desktop body content was nudged left by about half the old gap between the content and the desktop side rail, while leaving the shared top header controls in their cross-page position.
- Desktop content alignment target is the Mini Mock body gutter. Library desktop content now uses a `272px` left inset, and Home wraps its promo/main learning body in the same `translateX: -42` body nudge as Mini Mock, while keeping the shared top header controls in place.

Home/icons:

- The shared desktop header controls (`3 days`, Switch, Settings) were resized to a consistent mid-size and aligned through the same top shell on Home, Library, and Mini Mock.
- Home now uses the shared `KanjiBackdrop` with a fuller scattered background: 13 glyphs across the screen, tuned lighter than Library/Mini Mock so the main homepage keeps a calmer texture.
- App popups now open instantly instead of fading in: remaining `animationType="fade"` modal shells were changed to `animationType="none"`.
- The credit-check popup CTA now has web hover/press animation: slight lift/scale, stronger shadow, and a one-way chevron nudge.
- Settings/subscription popups were redesigned as a brighter Kibbo control-center sheet: instant open, branded icon badge, subtle background glyph, stronger close control, and more polished subscription plan cards.
- Settings no longer repeats the same plan metadata in three places. The duplicate Credits and Coach snapshot tiles were removed, leaving the Current Plan hero as the single summary.
- Subscription prices are now Pro `$9.99/mo` and Elite `$19.99/mo`. Plan cards also show approximate daily price (`about $0.33/day`, `about $0.67/day`) and per-credit value (`$0.10/credit`, `$0.07/credit`).
- Subscription plan cards now have distinct tier colors: Starter is white, Pro is light blue, and Elite is light purple. The active plan is marked with a teal `Current plan` pill instead of turning the whole card coral.
- Paid-to-Starter subscription changes are intentionally scheduled downgrades. The UI now makes this visible: if a paid user selects Starter, the Starter card shows `Switches at cycle end` and the Current Plan hero says it will switch to Starter at cycle end. Clicking the current paid plan again cancels the pending downgrade because `changeSubscriptionPlan` clears `pendingSubscriptionPlan` when selecting the active paid plan.
- Settings is now light-only. The visible Light/Dark theme segmented control and palette helper text were removed from `components/MainTabHeader.tsx`.
- `constants/colors.ts` forces `ActiveTheme = 'light'` and exports only the light palette/gradients for active app use.
- `utils/storage.ts` normalizes any old saved `theme: 'dark'` setting back to `light`, so stale local storage cannot keep the app dark.
- `app/_layout.tsx` always uses dark status bar icons against the light UI.
- Home recalibrate now routes directly to `/mock` without opening the credit-start flow or charging credits for navigation. The fallback diagnostic card also no longer advertises a mini-mock credit cost.
- Recalibrate, weak-signal chip, analytics weak spot, and mini mock no longer all reuse the same target icon.
- Added local icons in `components/Icons.tsx`: `MessageCircleIcon`, `CompassIcon`, `SwitchIcon`.
- Generated plan Start button text/arrow alignment was tightened.
- Utility card hover icon shift was softened so it does not jump straight red.
- Global first-completion feedback prompt is now mounted in `app/_layout.tsx`.
- `utils/storage.ts` marks `@fluent:firstCompletionFeedback` as pending the first time any drill completion records a `SessionRecord`. Because all drill types flow through `appendSession`, this covers listening, reading, speaking, conversation, and text-chat without per-screen modal wiring.
- `components/FirstCompletionFeedbackModal.tsx` flies up from the bottom into the center of the screen. It first asks for a 1-5 star rating, then reveals a text box: 3 stars or lower asks what could be better; 4-5 asks what the learner liked. Submit stores the local feedback. The tiny low-emphasis `not now` action dismisses the one-time prompt.
- Feedback is no longer local-only when an AI endpoint is configured. `utils/feedbackApi.ts` submits first-completion feedback to `/submit-feedback`, tracks `remoteStatus`, stores remote ids/errors in local storage, and retries pending/failed/skipped submissions on modal mount.
- `server/grading-server.mjs` logs first-completion feedback to `KIBBO_FEEDBACK_LOG_PATH` / `data/feedback-submissions.jsonl`.
- `npm run feedback:report` writes `dist/feedback-report.json` and `dist/feedback-report.md` for beta/admin-readable review.

Text chat:

- The AP text-chat drill now behaves more like a real message composer.
- Typing no longer mirrors directly into the visible outgoing bubble.
- Text lives in a draft composer until Send/Review is pressed or the timer expires.
- Sending commits the draft as a chat bubble, clears the composer, reduces Messages left, and briefly shows partner typing dots before the next prompt appears.
- The thread keeps the previous exchange visible with the current prompt instead of clearing the whole chat between turns.
- Text chat now shows a rolling three-bubble message window; the fourth visible message pushes the first one out, the fifth pushes the second, etc.
- Translate and Hint controls were removed from text chat.
- The text-chat composer now grows with typed line breaks up to about five lines, then enables internal scrolling.
- Text-chat rubric/register logic was corrected: friend/classmate/party/casual prompts should not recommend です/ます for clarity. Local scoring now infers casual vs polite register from situation + prompt, treats short-but-complete replies as a depth/detail issue rather than a "complete sentence" issue, and client-side AI review sanitation rewrites bad casual-register advice before display.
- `server/grading-server.mjs` prompt now explicitly tells remote grading that casual/friend text chat should prefer plain/casual Japanese and that です/ます is not a universal clarity fix. Server prompt changes still require restarting/deploying the AI server to affect remote grading.

Conversation:

- Conversation drills now follow the AP-style turn flow: the prompt is spoken first, the prompt text is hidden while audio plays, and once playback finishes the prompt text appears.
- The 20-second timer now starts only after the spoken prompt finishes.
- Microphone capture and speech recognition start automatically when the 20-second answer window begins.
- The recording/status area says whether the app is listening to the prompt, recording automatically, saving, or starting the mic.
- Conversation turns auto-advance at zero; the old manual "Next Prompt" behavior was replaced with an informational auto-advance button state.
- Native audio recording is stopped and saved per turn for naturalness review when available; web still depends on browser speech recognition/audio limitations.

Speaking:

- Transcript now pauses for user review/edit after speaking before scoring.
- The edited transcript is what scoring and AI review use.
- Naturalness feedback section includes "Compare the sound" with:
  - Play/stop user recording when native recording URI exists.
  - Play/stop model response via TTS.
- Web can show transcript/model playback, but "Play yours" depends on native audio capture.
- AI speaking feedback is filtered to reject "long initial pause / hit record" style feedback. Naturalness should focus on word choice, register, sentence ending, pronunciation/rhythm, and blocky in-answer segmentation.

## AI Personalization Work Already Done

This is no longer just "cache refill." AI generation is now wired as the primary path where possible, with local fallback kept for offline/timeouts.

Implemented:

- `utils/aiPlan.ts` calls `/generate-daily-plan` from the profile.
- `server/grading-server.mjs` supports `/generate-daily-plan`.
- Daily plan actions include `targetSkills`.
- Home maps AI daily plan actions to real routes.
- `utils/targetSkills.ts` encodes/parses route target skills.
- Home passes AI plan `targetSkills` into listening, reading, speaking, conversation, and texting routes.
- Each drill parses `targetSkills`; drill entry now serves from a fresh generated queue/cache first and refills AI generation in the background instead of blocking the learner for ~7 seconds on every start.
- `utils/practiceContentQueue.ts` now dedupes and filters by content fingerprints/topic fingerprints, not just prompt IDs, so regenerated AI items with new IDs but repeated prompt text/situation are rejected.
- Home now calls `prewarmGeneratedPracticeQueues(...)` after daily-plan generation, so listening, reading, speaking, conversation, and texting queues can fill before the user clicks a drill.
- Listening, reading, speaking, conversation, and texting loaders now choose ready cached/generated content first, then rotate local fallback away from recent IDs as a last resort, and then trigger background refill.
- `utils/storage.ts` has `AttemptMemory`, `recordAttemptMemory`, and `getAttemptMemory`.
- Listening, reading, speaking, conversation, and texting now record attempt memory after completion.
- `utils/personalization.ts` now includes:
  - `recentMistakes`
  - `recentAnswerPatterns`
  - `generatedPromptSummaries`
  - `todayWork`
  - `recentAttempts`
  - `missedAttempts`
  - `savedWeakSpots`
  - `recentPromptIdsByType`
  - `generatedPromptIdsByType`
  - `doNotRepeatIds`
- `server/grading-server.mjs` tells the model to use those profile fields as source-of-truth inputs and avoid repeated topics, source types, surface wording, prompt IDs, and answer logic.
- Conversation/texting now refill generated cache when immediate AI generation misses.
- `utils/aiApi.ts` reads direct Expo public env vars:
  - `EXPO_PUBLIC_KIBBO_AI_URL`
  - legacy `EXPO_PUBLIC_AP_GRADING_URL`
- Web localhost still auto-discovers `http://localhost:8787`.
- Native app builds must use a real LAN/deployed URL; localhost on a phone points to the phone, not the Mac.

Known AI caveat:

- The plumbing is implemented, but AI quality still needs real session QA with the live server.
- The server must be restarted/deployed for the latest server prompts to take effect.
- Local fallback still exists intentionally, but generated AI should be the main path when the endpoint is available.

## Credit System State

Direction:

- Starter/basic: 10 credits total.
- Drill: 1 credit.
- Mini mock: 3 credits.
- Pro: 100 credits/month, non-stacking.
- Elite: 300 credits/month, non-stacking.
- Upgrading free to paid should update immediately.
- Downgrading paid to free should take effect at cycle end.
- Pro <-> Elite should update immediately while accounting for leftover credits.
- Copy should use Pro and Elite, not Premium.

Current credit system is local/prototype. Production launch needs Apple IAP and receipt validation.

## Launch / QA Scaffolding Added

No-account/no-device launch work completed in the latest pass:

- `PRODUCTION_AI_DEPLOYMENT.md` now documents how to deploy the server, required environment variables, `/health` checks, client `EXPO_PUBLIC_KIBBO_AI_URL`, and production hardening still needed.
- `TEACHER_BETA_DEPLOYMENT.md` now explains the teacher-shareable URL plan. Latest implementation supports a one-project Vercel deployment: the static Expo web app is served from `dist`, while Vercel API functions in `api/*.mjs` call the shared `server/grading-server.mjs` handler under `/api`.
- `utils/aiApi.ts` now defaults to same-origin `/api` on deployed web hosts, while local web still auto-discovers `http://localhost:8787`. This means the Vercel frontend does not need to know its final domain at build time.
- `server/grading-server.mjs` now exports `handleRequest` and understands both root server paths (`/health`) and Vercel API paths (`/api/health`).
- `vercel.json` keeps `npm run build:web`, `dist`, SPA fallback rewrites, and an `/api/*` preservation rewrite for the one-project teacher beta.
- `NATIVE_QA_CHECKLIST.md` now gives a concrete real-iPhone QA pass for Home, Library, Mini Mock, Listening, Reading, Speaking, AP Conversation, AP Text Chat, AI cost behavior, and fail conditions.
- `server/ai-production.env.example` now includes `KIBBO_AI_USAGE_LOG_PATH` and the client build URL reminder.
- `README.md` now points local AI development at the safe OpenAI cost-capped route (`npm run grade-server:local`) instead of the older Anthropic command.
- `scripts/validate-launch.mjs` now checks that production AI deployment docs, native QA docs, app-store owner docs, feedback reporting, Vercel API endpoints, Vercel config, and server AI usage logging env docs exist.
- `LAUNCH_STATUS.md` now records AI cost docs, usage reporting, first-completion feedback reporting, production AI deployment checklist, and native iPhone QA checklist as repo-side launch setup completed.
- `AI_COST_CONTROLS.md` now documents the no-repeat guard, one-time novelty retry, and default offline behavior of `npm run audit:ai-quality`.

Things still impossible to truthfully finish without the user/account/device:

- Apple Developer enrollment and App Store Connect app record.
- Final bundle identifier decision.
- Real iPhone microphone/speech-recognition/recording-playback QA.
- Production hosting account/domain/secrets for the AI server.
- Apple IAP product setup and receipt validation decisions.
- Final legal review and public Privacy/Terms URLs.

## Latest Daily Plan / Drill Quality Fixes

Latest local pass completed without paid AI calls:

- Daily plan cache signatures are now stable for the day in `utils/aiPlan.ts`, so completing a drill no longer immediately regenerates/restocks the three daily plan sessions.
- Home daily-plan actions now carry stable per-day `rewardKey` values through listening, reading, speaking, conversation, and texting routes. Completed daily-plan sessions are matched by reward key, so each item can become complete and stay complete for that day.
- Mobile keeps the coach-picked item separate from the `Next` list after completion. When all daily-plan actions are done, the day can show complete instead of endlessly replacing work.
- Reading AI schema now includes per-question `evidence`, `keyword`, and `explanation`. Wrong-answer feedback in `app/ap/reading.tsx` shows the correct answer, the evidence line from the passage with full furigana, the key cue, and a short explanation.
- Reading repeat prevention now includes question text, choices, correct answers, evidence, and keywords in generated prompt history matching.
- Speaking naturalness scoring in `app/speaking/translation.tsx` is less exact-answer based and more focused on Japanese-script shape, natural endings, register fit, length balance, and delivery confidence.
- Browser/mobile-preview recording and `Play yours` were fixed through web `MediaRecorder` support in `hooks/useVoiceRecorder.ts` and browser audio playback in `app/speaking/translation.tsx`.
- Server reading prompts now explicitly require evidence/key cue/explanation and avoid repeated answer logic/evidence cues.

Verification after this pass:

- `npx tsc --noEmit` passed.
- `node --check server/grading-server.mjs` passed.
- `npm run build:web` passed and exported `dist/_expo/static/js/web/entry-58cab59dbb83dc5873f7005e2d069ee4.js`.

## Latest Repeat Suppression / Reading Evidence Tightening - June 17, 2026

User reported two still-open quality issues:

- Repeat prompts are still appearing across drill types.
- Reading wrong-answer highlights can select too much text instead of the critical phrase.

Fix applied locally:

- Added `utils/practiceRepeatKeys.ts` as the shared repeat-memory helper for listening, speaking, reading, AP conversation, and AP texting.
- Repeat history now stores more than raw IDs:
  - `fp:` normalized full-content fingerprints.
  - `topic:` normalized topic/source fingerprints.
  - `passage:` reading passage fingerprints.
  - `family:` deterministic topic-family blockers such as late/bring, club schedule change, train delay, cafe study, bag exchange, and cashless trend.
  - Reading question-level signatures containing question text, correct answer, evidence, and keyword.
- Japanese repeat matching now includes character n-grams, because Japanese scenarios often have no spaces and the older token matcher missed near-duplicates.
- Listening, speaking, reading, conversation, and texting now record `practiceRepeatKeys(...)` on exposure instead of only prompt IDs.
- `utils/storage.ts` increased recent prompt memory from `80` to `240`, because each prompt now records multiple repeat signatures.
- `utils/practiceContentQueue.ts` now dedupes by shared repeat keys and no longer backfills with stale last-resort repeated generated items when fresh content is short.
- `data/index.ts` no longer refills local fallback pools with stale items after the fresh local pool is exhausted.
- `components/APPracticeSession.tsx` no longer falls back to `localSets[0]` when all AP texting/conversation sets are blocked as stale.
- `server/grading-server.mjs` now labels `fp:`, `topic:`, `passage:`, and `family:` signals for the AI and includes more novelty signals in generation prompts.
- Server reading-generation guidance now requires evidence to be the shortest exact Japanese phrase/clause, not a broad sentence. For intent/request questions it explicitly says to isolate the request clause, e.g. `できれば交換していただきたいです`.
- `app/ap/reading.tsx` now splits evidence on Japanese sentence punctuation and commas before picking a highlight, so a broad evidence chain can still reduce to the decisive request/intent clause.
- Local `ja-rd-07` exchange-request metadata now sets q1 evidence/keyword to `できれば交換していただきたいです`, q2 to `まだ一度しか使っていないので`, and q3 to `チャックがこわれてしまいました`.

Important caveat:

- This stops silent stale refill and catches many near-duplicate scenarios, but if the learner has exhausted all fresh local content and the AI endpoint is unavailable, a drill may have no fresh set ready instead of repeating. That is intentional until a better "generating fresh work" state is built.
- Full furigana in reading feedback depends on `utils/furigana.ts` knowing the readings. It shows all known kanji readings in feedback mode, but generated/unknown kanji still need a real analyzer or an expanded reading dictionary later.

Verification after this pass:

- `npx tsc --noEmit` passed.
- `node --check server/grading-server.mjs` passed.
- `npm run build:web` passed and exported `dist/_expo/static/js/web/entry-d923205bb5c906b4f2d5013967504eee.js`.

## Latest Drill Loading Notice Polish - June 17, 2026

User said the warmup notice on the shared drill loading surface was too easy to miss. Fix applied:

- `components/DrillLoadingState.tsx` now renders the warmup copy as a stronger callout with a coral accent rail, animated flame badge, uppercase `First-time build` label, bolder copy, and a soft shadow.
- The copy remains honest: first build takes longest, warmed drills usually open faster.
- The change is centralized in the shared loading component used by listening, reading, speaking, AP conversation, and AP text chat loading states.

Verification after this pass:

- `npx tsc --noEmit` passed.
- `npm run build:web` passed and exported `dist/_expo/static/js/web/entry-a93c1f8623e26d9a54c7248675c1b040.js`.
- Browser sanity check loaded `http://127.0.0.1:8083/` with the new bundle and meaningful Kibbo content. The only browser warnings observed were the existing React Native Web `useNativeDriver` fallback warnings.

## What Is Still Left

The main remaining work is not the core personalization plumbing. It is:

1. Real AI QA and prompt tuning
   - Restart/deploy the grading/generation server.
   - Run many daily-plan cycles.
   - Confirm drills vary based on misses.
   - Confirm repeat prevention is aggressive.
   - Confirm generated Japanese feels AP-shaped, natural, and level-aware.

2. Missing full AP task coverage
   - Add Presentational Writing: compare/contrast article.
   - Add Presentational Speaking: cultural perspective presentation.
   - Add generated prompts, scoring/review, route UI, attempt memory, credits, and possibly mini mock integration for these.

3. Production app launch work
   - Deploy the AI server.
   - Set `EXPO_PUBLIC_KIBBO_AI_URL` for app builds.
   - Test iOS/native recording playback.
   - Implement Apple IAP and receipt validation.
   - Final privacy/terms review.
   - App Store build, assets, screenshots, submission.

4. Visual polish
   - Continue user-requested UI fixes.
   - Improve loading/fallback states.
   - Make completion/results pages feel designed.
   - Keep typography less uniformly bold where readability suffers.
   - Keep hover/press animation polished and aligned.

5. Clear AI fallback UX
   - If AI endpoint is unavailable, local fallback should not feel broken.
   - But users should not think fallback/static content is the final product promise.

## Suggested Next Engineering Task

If the user says "keep going without paid AI," start with missing AP task coverage:

1. Add presentational writing compare/contrast.
2. Add presentational speaking cultural perspective.
3. Extend AI content schema/parser/server prompts for these modes.
4. Add routes/screens with credit cost and completion handling.
5. Add attempt memory for these tasks.
6. Feed them into the daily plan and mini mock.
7. Validate with `npx tsc --noEmit`, `npm run build:web`, and `node --check server/grading-server.mjs`.

If the user says "run another tiny paid QA," do not run a broad audit. Use the smallest targeted live sampler against a known cost-capped OpenAI server, then immediately run `npm run ai:usage` and report exact cost/output quality. Stop if usage approaches `2` cents or repeated calls appear.

## Tone / User Preference

The user wants decisive implementation, not a long abstract plan. They care deeply and can be blunt when frustrated. Do not defend the current UI. Treat issues as prototype flaws to improve.

Use direct language like:

- "Yep, I see it."
- "I will patch that now."
- "That should be generated from the profile, not pulled from a fixed pool."

Avoid vague reassurance. If something is not complete, say so plainly and then implement the next concrete piece.
