# Kibbo AI Cost Controls

Target: every 1-credit AI fulfillment should cost 1 cent or less in provider spend.

## Pricing Posture

- A credit is the user-facing budget unit. The server treats credit-bearing AI work as budgeted.
- Default generation uses `gpt-4.1-nano` because most drill generation should be cheap, structured JSON.
- Review can use `gpt-4.1-mini` by default for better coaching quality, but it is capped by output tokens and the same per-credit guardrail.
- Anthropic and Gemini are explicit provider choices, not accidental defaults. If `OPENAI_API_KEY` exists and `AI_PROVIDER` is unset, the server chooses OpenAI.
- Frontier or expensive models should be reserved for internal QA/evals, not normal 1-credit fulfillment.

## Environment Controls

- `AI_MAX_COST_CENTS_PER_CREDIT=1`
  - Default target budget. Increase only for testing or a deliberate premium feature.
- `AI_ENFORCE_COST_CAP=1`
  - Default behavior. Set to `0` only when intentionally testing an over-budget call.
- `AI_COST_SAFETY_MULTIPLIER=1.25`
  - Default conservative cushion applied to estimated provider spend before enforcing the cap.
- `EXPOSE_AI_COSTS=1`
  - Adds `_usage` metadata to AI responses for debugging. Keep off in production client responses.
- `KIBBO_AI_USAGE_LOG_PATH=./data/ai-usage.jsonl`
  - Optional path for local per-call AI usage logs. Defaults to `data/ai-usage.jsonl`.
- `OPENAI_MODEL=gpt-4.1-nano`
  - Default OpenAI model.
- `OPENAI_DAILY_PLAN_MODEL=gpt-4.1-nano`
- `OPENAI_CONTENT_MODEL=gpt-4.1-nano`
- `OPENAI_REVIEW_MODEL=gpt-4.1-mini`
- `OPENAI_ELITE_REVIEW_MODEL=gpt-4.1-mini`
- `AI_DAILY_PLAN_MAX_OUTPUT_TOKENS=900`
- `AI_CONTENT_MAX_OUTPUT_TOKENS=2600`
- `AI_SPEAKING_REVIEW_MAX_OUTPUT_TOKENS=900`
- `AI_AP_REVIEW_MAX_OUTPUT_TOKENS=1600`
- `AI_ELITE_REVIEW_MAX_OUTPUT_TOKENS=1800`

## Operational Rules

- Watch server logs for `event: "ai_cost"`.
- If a request logs `status: "projected_over_budget"`, the default server behavior rejects it with `AI_COST_CAP`.
- Daily plan generation is treated as free overhead, but it is still output-capped and logged.
- Home prewarming should stay narrow: at most one daily-plan mode and small batches.
- Do not prewarm all five drill modes from the home screen; that burns AI spend before the learner chooses a task.
- Daily plan generation is cached for the same learner state so reloads do not repeatedly spend provider money.
- Generated content has a no-repeat guard. If the first generation repeats a recent scenario too closely, the server rejects it or retries once with a stronger "same skill, different situation" instruction.
- A novelty retry can add one extra nano generation call, but the projected worst case remains under the 1-cent credit budget when cost caps are enforced.
- Do not deploy with `AI_PROVIDER=anthropic` and `claude-haiku-4-5-20251001` for normal content generation unless the cap remains enforced; current projections show some content calls can exceed 1 cent on that route.

## Audit Commands

- `npm run audit:ai-cost`
  - Estimates prompt/input size, expected output cost, worst-case capped output cost, and pass/fail status for representative Kibbo AI calls.
  - Writes `dist/ai-cost-audit.json` and `dist/ai-cost-audit.md`.
  - Includes a provider risk matrix so expensive accidental routes are visible before launch.
- `npm run audit:ai-cost:cap`
  - Runs an in-process smoke test proving over-budget credit calls are blocked with `AI_COST_CAP`.
  - Does not require API keys or network access.
- `npm run grade-server`
  - Starts the local AI server.
- `npm run audit:ai-cost:live`
  - Calls the local AI server endpoints and includes `_usage` data when `EXPOSE_AI_COSTS=1`.
  - Requires provider API keys, network access, and a safe cost-capped server. It refuses risky live servers by default.
- `npm run audit:ai-quality`
  - Runs offline prompt/guard checks by default.
  - Runs live daily plan, generated content, speaking review, and AP review samples only when `--live` or `AI_QUALITY_REVIEW_LIVE=1` is used and the server is on the recommended OpenAI cost-capped route.
  - Writes `dist/ai-quality-review.json` and `dist/ai-quality-review.md`.
  - Refuses non-cost-capped or expensive-provider servers unless `AI_QUALITY_REVIEW_ALLOW_RISK=1` is explicitly set.
- `npm run feedback:report`
  - Reads `KIBBO_FEEDBACK_LOG_PATH` or `data/feedback-submissions.jsonl`.
  - Writes `dist/feedback-report.json` and `dist/feedback-report.md` so first-completion feedback is admin-readable during beta.
- `npm run ai:usage`
  - Reads `KIBBO_AI_USAGE_LOG_PATH` or `data/ai-usage.jsonl`.
  - Shows the most recent AI calls and their estimated provider cost without making any API requests.

## Margin Check

With Apple taking 30%, current plans roughly net:

- Pro: `$9.99` -> about `$6.99`, or about 7 cents per included credit.
- Elite: `$19.99` -> about `$13.99`, or about 4.7 cents per included credit.

Keeping AI fulfillment at or below 1 cent per credit leaves room for Apple fees, infra, failed calls, support, and profit.
