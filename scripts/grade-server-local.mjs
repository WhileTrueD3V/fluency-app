import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const envFiles = [
  path.join(root, '.env.local'),
  path.join(root, '.env'),
  path.join(root, 'server/.env.local'),
  path.join(root, 'server/.env'),
];

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const index = trimmed.indexOf('=');
  if (index < 1) return null;
  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

for (const file of envFiles) {
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    process.env[parsed.key] = parsed.value;
  }
  console.log(`Loaded local server env from ${path.relative(root, file)}`);
}

const provider = process.env.AI_PROVIDER || 'auto';
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
const hasGemini = Boolean(process.env.GEMINI_API_KEY);
const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

console.log(`AI provider: ${provider}`);
console.log(`Provider key available: ${hasOpenAI || hasGemini || hasAnthropic ? 'yes' : 'no'}`);

const { startServer } = await import(pathToFileURL(path.join(root, 'server/grading-server.mjs')).href);
startServer();
