# Kibbo Teacher Beta URL Plan

Goal: create a shareable web URL for AP Japanese teachers to test Kibbo without localhost.

## Current Recommended Path

Use one Vercel project for both:

1. The static Expo web app from `dist`.
2. The AI endpoints under `/api`.

The repo now includes Vercel API function entrypoints in `api/*.mjs`. They reuse `server/grading-server.mjs`, so the deployed web app can call same-origin endpoints such as:

- `/api/health`
- `/api/generate-daily-plan`
- `/api/generate-practice-content`
- `/api/review-speaking-attempt`
- `/api/grade-ap-session`
- `/api/submit-feedback`

`utils/aiApi.ts` automatically uses `/api` on deployed web hosts. Local web development still uses `http://localhost:8787`.

## Vercel Settings

Project settings:

- Framework preset: Other
- Build command: `npm run build:web`
- Output directory: `dist`
- Install command: default / `npm install`

The repo already has `vercel.json` with:

- `buildCommand`
- `outputDirectory`
- SPA fallback rewrites
- `/api/*` preservation

## Required Vercel Environment Variables

Add these in Vercel Project Settings -> Environment Variables for Production, Preview, and Development as needed:

- `AI_PROVIDER=openai`
- `AI_MAX_COST_CENTS_PER_CREDIT=1`
- `AI_ENFORCE_COST_CAP=1`
- `AI_COST_SAFETY_MULTIPLIER=1.25`
- `EXPOSE_AI_COSTS=0`
- `OPENAI_API_KEY=<server-side OpenAI key>`
- `OPENAI_MODEL=gpt-4.1-nano`
- `OPENAI_DAILY_PLAN_MODEL=gpt-4.1-nano`
- `OPENAI_CONTENT_MODEL=gpt-4.1-nano`
- `OPENAI_REVIEW_MODEL=gpt-4.1-mini`
- `OPENAI_ELITE_REVIEW_MODEL=gpt-4.1-mini`

Optional but recommended:

- `AI_DAILY_PLAN_MAX_OUTPUT_TOKENS=900`
- `AI_CONTENT_MAX_OUTPUT_TOKENS=2600`
- `AI_SPEAKING_REVIEW_MAX_OUTPUT_TOKENS=900`
- `AI_AP_REVIEW_MAX_OUTPUT_TOKENS=1600`
- `AI_ELITE_REVIEW_MAX_OUTPUT_TOKENS=1800`

Do not add `OPENAI_API_KEY` to Expo public env vars. It belongs only in Vercel server/runtime environment variables.

## After Deploy

Open:

```txt
https://your-vercel-domain.vercel.app/api/health
```

Confirm:

- `provider` is `openai`.
- `hasKey` is `true`.
- `costControls.enforceCostCap` is `true`.
- `costControls.exposeCosts` is `false`.

Then open:

```txt
https://your-vercel-domain.vercel.app
```

Try:

- Home daily plan.
- One generated drill.
- One AP conversation or text-chat review.
- Library Recent Work and saved review.

## Keep Spend Safe During Teacher Beta

Before sharing:

```sh
npm run validate:launch
npm run audit:ai-cost
npm run audit:ai-quality
npm run ai:usage
```

During beta:

- Watch OpenAI dashboard usage.
- Keep the initial teacher group small.
- Stop sharing the URL if repeated content or unexpected usage spikes appear.
- Avoid broad live QA loops; use tiny targeted samplers.

## Teacher Test Notes To Send

Ask teachers to look for:

- Does the daily plan feel personalized?
- Do generated drills feel AP-shaped rather than generic language app content?
- Does Japanese sound natural for the relationship/context?
- Are weak spots specific and useful?
- Are any prompts repetitive?
- Are any scoring/review notes misleading?
- Where does the UI feel confusing on phone?

## Current Limitation

The current web beta is good for teacher preview and product feedback. It is not yet a complete public launch because Apple IAP, production auth/rate limits, real iPhone QA, final legal URLs, and App Store setup are still unfinished.

Also note: Vercel serverless logs and filesystem are not a durable analytics database. For beta, OpenAI dashboard usage and Vercel logs are enough to watch cost qualitatively. Before public scale, move feedback and AI usage logs to durable storage.
