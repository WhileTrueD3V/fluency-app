# Kibbo Production AI Deployment

This checklist is for deploying the grading/generation server behind the real app. It keeps API keys server-side and preserves the `1 credit <= 1 cent` cost guardrail.

## Server

- Deploy `server/grading-server.mjs` with Node.js.
- Use `npm run grade-server` or an equivalent process manager command.
- Expose the service over HTTPS.
- Keep provider keys only in the server environment.
- Do not ship provider API keys in Expo, EAS, web, or native client bundles.

## Required Environment

Use `server/ai-production.env.example` as the production template.

Required production values:

- `AI_PROVIDER=openai`
- `AI_MAX_COST_CENTS_PER_CREDIT=1`
- `AI_ENFORCE_COST_CAP=1`
- `AI_COST_SAFETY_MULTIPLIER=1.25`
- `EXPOSE_AI_COSTS=0`
- `OPENAI_API_KEY=<server-side key>`
- `OPENAI_MODEL=gpt-4.1-nano`
- `OPENAI_DAILY_PLAN_MODEL=gpt-4.1-nano`
- `OPENAI_CONTENT_MODEL=gpt-4.1-nano`
- `OPENAI_REVIEW_MODEL=gpt-4.1-mini`
- `OPENAI_ELITE_REVIEW_MODEL=gpt-4.1-mini`
- `KIBBO_AI_USAGE_LOG_PATH=<durable log path>`
- `KIBBO_FEEDBACK_LOG_PATH=<durable log path>`

## Client Build Environment

Set this in EAS or the deployed web client environment:

- `EXPO_PUBLIC_KIBBO_AI_URL=https://your-production-ai-domain`

`EXPO_PUBLIC_AP_GRADING_URL` still works as a legacy alias, but new setup should use `EXPO_PUBLIC_KIBBO_AI_URL`.

## Smoke Test

Before pointing a TestFlight build at the production server:

1. Open `GET /health`.
2. Confirm `provider` is `openai`.
3. Confirm `hasKey` is `true`.
4. Confirm `costControls.enforceCostCap` is `true`.
5. Confirm `costControls.exposeCosts` is `false`.
6. Run `npm run audit:ai-cost` locally.
7. Run one tiny live QA sampler only if the server is capped and the user's test budget allows it.

## Production Hardening Still Needed

- Add app authentication or app attestation before public scale.
- Add tier-aware rate limits.
- Store AI usage and feedback logs in durable infrastructure, not an ephemeral filesystem.
- Monitor cost per user and per endpoint.
- Alert on repeated `AI_COST_CAP`, `AI_CONTENT_REPEAT`, and `AI_CONTENT_SCHEMA` failures.
