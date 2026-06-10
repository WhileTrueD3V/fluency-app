import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const logPath = process.env.KIBBO_AI_USAGE_LOG_PATH ?? path.resolve(root, 'data/ai-usage.jsonl');
const RECENT_LIMIT = Number.isFinite(Number(process.env.AI_USAGE_RECENT_LIMIT))
  ? Math.max(1, Math.round(Number(process.env.AI_USAGE_RECENT_LIMIT)))
  : 20;

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function cents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCents(value) {
  return `${value.toFixed(4)} cents`;
}

async function main() {
  let raw = '';
  try {
    raw = await fs.readFile(logPath, 'utf8');
  } catch {
    console.log(`No AI usage log found at ${logPath}`);
    return;
  }

  const entries = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter(Boolean);

  if (entries.length === 0) {
    console.log(`AI usage log is empty: ${logPath}`);
    return;
  }

  const lifetimeTotal = entries.reduce((sum, entry) => sum + cents(entry.estimatedCostCents), 0);
  const recent = entries.slice(-RECENT_LIMIT);
  const recentTotal = recent.reduce((sum, entry) => sum + cents(entry.estimatedCostCents), 0);
  const byTask = new Map();
  for (const entry of recent) {
    const current = byTask.get(entry.task) ?? { count: 0, cents: 0 };
    current.count += 1;
    current.cents += cents(entry.estimatedCostCents);
    byTask.set(entry.task, current);
  }

  console.log(`AI usage log: ${logPath}`);
  console.log(`Total logged calls: ${entries.length}`);
  console.log(`Estimated lifetime total: ${formatCents(lifetimeTotal)}`);
  console.log(`Showing last ${recent.length} calls`);
  console.log(`Estimated recent subtotal: ${formatCents(recentTotal)}`);
  console.log('');
  for (const [task, summary] of byTask.entries()) {
    console.log(`${task}: ${summary.count} call(s), ${formatCents(summary.cents)}`);
  }
  console.log('');
  for (const entry of recent) {
    console.log([
      entry.createdAt ?? 'unknown-time',
      entry.task,
      entry.provider,
      entry.model,
      `${entry.inputTokens}/${entry.outputTokens} tokens`,
      formatCents(cents(entry.estimatedCostCents)),
      entry.status ?? 'ok',
    ].join(' | '));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
