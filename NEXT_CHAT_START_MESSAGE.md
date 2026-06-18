We are working in `/Users/chocolate_god/Documents/Apps/fluency-app`.

Read `NEXT_CHAT_HANDOFF.md` first. It is the latest handoff and overrides older design drift. Only use `PROJECT_HANDOFF.md`, `DESIGN_HANDOFF.md`, and `KIBBO_RESET_HANDOFF.md` as supporting context.

Important: the repo was moved from Downloads to `Documents/Apps`; do not work from the old path. Current branch is `main`, GitHub remote is `https://github.com/WhileTrueD3V/fluency-app.git`, and the latest pushed commit at handoff time is `bb5bd9e Collapse mobile onboarding explainer`.

Kibbo direction:

- Kibbo is an ultra-personalized AP Japanese coach, not a generic language app or Memrise clone.
- Keep the focus on AP Japanese level calibration, generated daily work, rubric weak spots, Mini Mock readiness, repeat prevention, natural Japanese, and a clear credit system.
- Design rules still matter: no graphs, no decimal scores, no pile of cards, no unfinished words/ellipsis on important labels, no yellow-heavy Memrise drift.
- Palette: deep navy, coral red, teal/mint, warm white, ice gray, with gold only for small credit/reward accents.
- Desktop design is mostly strong. Be careful not to change desktop when the user is asking for mobile-only polish.

Latest completed work:

- Mobile onboarding was redesigned and then simplified again.
- The mobile `How Kibbo starts / One plan...` explanation is now collapsed by default into a tappable `How Kibbo Works` card. Tapping it expands weak-spot memory, daily AP work, mock readiness, and mode details.
- Desktop onboarding should be visually unchanged.
- `NEXT_CHAT_HANDOFF.md` was updated with this detail.
- Local preview was rebuilt and restarted on `http://127.0.0.1:8083`.
- Mobile demo URL to check: `http://127.0.0.1:8083/__mobile-demo?path=/onboarding&fresh=how-kibbo-works-dropdown`.
- Validation after the latest change: `npx tsc --noEmit` passed, `npm run build:web` passed, preview served fresh bundle `entry-f05d751f5e5278e2144d70d1e273aa97.js`.

Current likely next work:

- If the user says the mobile onboarding still looks too busy, continue simplifying that page, mobile-only.
- If the user reports stale UI, rebuild with `npm run build:web`, restart `npm run preview:web -- --host 127.0.0.1 --port 8083`, and use a fresh cache-buster.
- Ongoing high-priority issues are in `NEXT_CHAT_HANDOFF.md`: AI repeat prevention, generated reading grounding, mobile UI clarity, real QA cycles, production deployment, missing AP tasks, native iPhone QA, gems/shop, IAP, and launch setup.
- Do not run paid live AI calls unless the user explicitly approves or the task truly requires it. The user has a small OpenAI test balance and does not want it wasted.

Please continue seamlessly from the previous chat and implement the next concrete user request. Do not re-explain the whole plan unless asked.
