We are working in `/Users/chocolate_god/Documents/Apps/fluency-app`.

Read `NEXT_CHAT_HANDOFF.md` first. It is the latest handoff and overrides older design drift. Only use `PROJECT_HANDOFF.md`, `DESIGN_HANDOFF.md`, and `KIBBO_RESET_HANDOFF.md` as supporting context.

Important direction:

- Kibbo is an ultra-personalized AP Japanese coach, not a generic language app or Memrise clone.
- Focus on level-based AP Japanese coaching, rubric weak spots, generated daily work, strong repeat prevention, and a clear credit system.
- Do not use graphs.
- Do not use decimal scores like `2.6/5`.
- Do not make the UI a pile of cards.
- Keep the design modern, tactile, polished, unique, and based on Kibbo's logo palette: deep navy, coral red, teal/mint, warm white, ice gray, with gold only as a small credit/reward accent.

Current state:

- AI personalization plumbing is implemented: daily plan target skills flow into drills, drills record attempt memory, the AI profile includes recent mistakes / answer patterns / generated prompt summaries, and server prompts use those fields to avoid repeated topics and answer logic.
- Speaking now has editable transcript review before scoring and a Naturalness comparison section with user/model playback support.
- Library/icon/start-button visual cleanup was recently done.
- Validation recently passed: `npx tsc --noEmit`, `npm run build:web`, and `node --check server/grading-server.mjs`.
- The preview was rebuilt and served from `dist`; `http://127.0.0.1:8082` was listening from this workspace.
- The AI server on `8787` was running from this repo, but server prompt changes need a restart/deploy to take effect. Be careful not to kill a keyed server and restart it without API keys.

What is left:

1. Real AI QA and prompt tuning with the live server.
2. Missing AP task coverage: Presentational Writing compare/contrast and Presentational Speaking cultural perspective.
3. Production launch work: deploy AI server, set `EXPO_PUBLIC_KIBBO_AI_URL`, native audio QA, Apple IAP/receipt validation, App Store prep.
4. Ongoing visual polish and better AI fallback/loading states.

Please continue seamlessly from the previous chat and start implementing the highest-value remaining work, not re-explaining the plan unless I ask.
