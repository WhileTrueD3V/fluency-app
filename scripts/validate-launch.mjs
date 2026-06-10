import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const appJson = readJson('app.json');
const pkg = readJson('package.json');
const expo = appJson.expo ?? {};

assert(expo.name === 'Kibbo', 'app.json expo.name should be Kibbo.');
assert(Boolean(expo.slug), 'app.json expo.slug is required.');
assert(Boolean(expo.version), 'app.json expo.version is required.');
assert(expo.userInterfaceStyle === 'automatic', 'app.json userInterfaceStyle should be automatic for light/dark support.');
assert(Boolean(expo.icon), 'App icon is required.');
assert(Boolean(expo.splash?.image), 'Splash image is required.');
assert(Boolean(expo.ios?.bundleIdentifier), 'iOS bundleIdentifier is required.');
assert(Boolean(expo.ios?.buildNumber), 'iOS buildNumber is required.');
assert(Boolean(expo.android?.package), 'Android package is required.');
assert(Number.isInteger(expo.android?.versionCode), 'Android versionCode is required.');
assert(expo.ios?.infoPlist?.NSMicrophoneUsageDescription, 'iOS microphone permission text is required.');
assert(expo.ios?.infoPlist?.NSSpeechRecognitionUsageDescription, 'iOS speech-recognition permission text is required.');
assert(Array.isArray(expo.android?.permissions) && expo.android.permissions.includes('RECORD_AUDIO'), 'Android RECORD_AUDIO permission is required.');

for (const route of ['app/legal/privacy.tsx', 'app/legal/terms.tsx', 'app/__mobile-demo.tsx']) {
  assert(fs.existsSync(path.join(root, route)), `${route} is missing.`);
}

for (const route of ['components/FirstCompletionFeedbackModal.tsx', 'utils/feedbackApi.ts', 'scripts/feedback-report.mjs']) {
  assert(fs.existsSync(path.join(root, route)), `${route} is missing.`);
}

for (const route of ['PRODUCTION_AI_DEPLOYMENT.md', 'NATIVE_QA_CHECKLIST.md', 'TEACHER_BETA_DEPLOYMENT.md', 'APP_STORE_OWNER_TASKS.md']) {
  assert(fs.existsSync(path.join(root, route)), `${route} is missing.`);
}

for (const route of [
  'api/health.mjs',
  'api/generate-daily-plan.mjs',
  'api/generate-practice-content.mjs',
  'api/review-speaking-attempt.mjs',
  'api/grade-ap-session.mjs',
  'api/submit-feedback.mjs',
]) {
  assert(fs.existsSync(path.join(root, route)), `${route} is missing.`);
}

assert(Boolean(pkg.scripts?.['build:web']), 'package.json needs build:web.');
assert(Boolean(pkg.scripts?.['validate:launch']), 'package.json needs validate:launch.');
assert(Boolean(pkg.scripts?.['feedback:report']), 'package.json needs feedback:report.');

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
assert(envExample.includes('EXPO_PUBLIC_AP_GRADING_URL'), '.env.example should document EXPO_PUBLIC_AP_GRADING_URL.');
assert(envExample.includes('KIBBO_FEEDBACK_LOG_PATH'), '.env.example should document KIBBO_FEEDBACK_LOG_PATH.');

const aiProductionExample = fs.readFileSync(path.join(root, 'server/ai-production.env.example'), 'utf8');
assert(aiProductionExample.includes('AI_ENFORCE_COST_CAP=1'), 'server/ai-production.env.example should enforce AI cost caps.');
assert(aiProductionExample.includes('KIBBO_AI_USAGE_LOG_PATH'), 'server/ai-production.env.example should document AI usage logging.');

const vercelConfig = readJson('vercel.json');
assert(vercelConfig.buildCommand === 'npm run build:web', 'vercel.json should build the Expo web export.');
assert(vercelConfig.outputDirectory === 'dist', 'vercel.json should publish dist.');
assert(JSON.stringify(vercelConfig).includes('/api/'), 'vercel.json should preserve /api routes for teacher beta AI endpoints.');

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(rel);
    } else if (/\.(ts|tsx|mjs|js|json|md)$/.test(entry.name)) {
      sourceFiles.push(rel);
    }
  }
}

for (const dir of ['app', 'components', 'constants', 'data', 'server', 'utils']) {
  if (fs.existsSync(path.join(root, dir))) walk(dir);
}

const secretPattern = /(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,})/;
for (const file of sourceFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (secretPattern.test(text)) {
    fail(`Potential API key found in ${file}.`);
  }
}

if (!fs.existsSync(path.join(root, 'assets/icon.png'))) warn('assets/icon.png is missing.');
if (!fs.existsSync(path.join(root, 'assets/splash.png'))) warn('assets/splash.png is missing.');
if (expo.ios?.bundleIdentifier === 'com.kibbo.language') {
  warn('Confirm com.kibbo.language is the final bundle identifier before App Store Connect setup.');
}

console.log('Launch validation');
for (const message of warnings) console.log(`WARN: ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  process.exit(1);
}
console.log('PASS: launch config checks completed.');
