import fs from 'node:fs';
import path from 'node:path';

const SERVER_URL = process.env.AI_SERVER_URL ?? 'http://127.0.0.1:8787';
const REVIEW_ONLY = process.env.AI_NATIVE_CASUAL_REVIEW_ONLY === '1';

const profile = {
  languageCode: 'ja',
  currentLevel: 9,
  rank: 'Beginner',
  weakestRubric: 'Language use',
  recentMistakes: [
    {
      type: 'texting',
      promptId: 'ja-text-classmate-practice',
      score: 62,
      correct: false,
      daysAgo: 1,
      question: 'Tell a classmate you want to practice a little before the presentation and ask if they have time.',
      userAnswer: '少し練習したいです。時間がありますか。',
      expectedAnswer: '発表の前にちょっとだけ練習したいんだけど、今日時間ある？',
      context: 'Casual classmate text chat.',
      weakSkills: ['stiff casual register', 'message softness', 'task completion'],
    },
  ],
  weakMemory: [
    {
      type: 'texting',
      topic: 'school presentation',
      vocab: ['発表', '練習', '時間', 'クラスメート'],
      rubric: 'Language use',
      mistakeType: 'textbook-casual phrasing',
      missCount: 3,
      priority: 58,
      daysAgo: 1,
      evidence: ['Learner uses polite textbook phrasing with classmates instead of warmer peer text style.'],
    },
  ],
  recentPromptIdsByType: {
    texting: ['ja-text-classmate-practice'],
  },
  doNotRepeatIds: ['ja-text-classmate-practice'],
  generatedPromptSummaries: [
    {
      type: 'texting',
      id: 'ja-text-classmate-practice',
      category: 'school presentation',
      prompt: 'Ask a classmate to practice before a presentation.',
      answerLogic: 'Use soft casual request and mention time availability.',
      source: 'Avoid repeating the same practice-before-presentation task frame.',
    },
  ],
  personalizationRules: [
    'Coach casual classmate text messages toward native peer softness, not textbook polite phrasing.',
    'Use patterns like 〜んだけど, 〜かな, 〜かも, 〜しようか, or 〜てくれる？ only when the relationship supports them.',
    'For classmate texting, light youth-casual words like りょ, おけ, まじ, めっちゃ, それな, いい感じ, やばい, or a light 笑 are allowed when they make the message sound natural and still AP-appropriate.',
    'Use slang as seasoning only: the answer still needs the requested action, reason, detail, or question.',
    'Avoid forced slang, dialect, anime phrasing, or over-casualizing teachers/staff.',
  ],
};

const contentPayload = {
  mode: 'texting',
  languageCode: 'ja',
  level: profile.currentLevel,
  difficulty: 'intermediate',
  count: 1,
  recentPromptIds: profile.doNotRepeatIds,
  targetSkills: [
    'native casual classmate phrasing',
    'light peer slang where it naturally fits',
    'soft request and message warmth',
    'avoid stiff textbook casual register',
  ],
  profile,
};

const reviewPayload = {
  feedbackLevel: 'elite',
  set: {
    id: 'native-casual-review',
    title: 'Classmate Festival Prep',
    situation: 'A classmate texts about preparing for the school festival booth.',
    mode: 'texting',
    languageCode: 'ja',
    prompts: [
      '文化祭の準備、今日ちょっと手伝える？',
      '買い出しも必要なんだけど、行けそう？',
      'ポスター、もう少し直した方がいいかな？',
      '最後に、友だちに一言送ってください。',
    ],
    suggestedKeywords: [['手伝う'], ['買い出し'], ['ポスター'], ['ありがとう']],
    modelAnswers: [
      'うん、放課後なら手伝えるよ。',
      '行けると思う。何を買えばいい？',
      'そうだね、タイトルをもう少し大きくした方がよさそう。',
      '今日はありがとね。明日も一緒にがんばろう。',
    ],
  },
  answers: [
    '今日は手伝うことができます。',
    '買い出しに行けます。',
    'ポスターを直した方がいいと思います。',
    'ありがとうございました。',
  ],
};

async function postJson(endpoint, payload) {
  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${endpoint} failed: HTTP ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function textFrom(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textFrom).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(textFrom).join(' ');
  return '';
}

function hasNativeCasualSignal(value) {
  return /んだけど|なんだけど|かな|かも|しようか|てくれる|だよね|ありがとね/.test(textFrom(value));
}

function hasPeerSlangSignal(value) {
  return /まじ|マジ|それな|わかる|りょ|了解|おけ|オッケー|めっちゃ|やばい|普通に|いい感じ|びみょう|だるい|やっぱ|とりま|じゃん|笑/.test(textFrom(value));
}

const health = await fetch(`${SERVER_URL}/health`).then((res) => res.json());
const previousReportPath = path.resolve('dist/ai-native-casual-sample.json');
const previousReport = REVIEW_ONLY && fs.existsSync(previousReportPath)
  ? JSON.parse(fs.readFileSync(previousReportPath, 'utf8'))
  : null;
const content = REVIEW_ONLY && previousReport?.content
  ? previousReport.content
  : await postJson('/generate-practice-content', contentPayload);
const review = await postJson('/grade-ap-session', reviewPayload);

const report = {
  generatedAt: new Date().toISOString(),
  serverUrl: SERVER_URL,
  health: {
    provider: health.provider,
    contentModel: health.openai?.contentModel,
    reviewModel: health.openai?.reviewModel,
    eliteReviewModel: health.openai?.eliteReviewModel,
    costControls: health.costControls,
  },
  checks: {
    generatedTextingHasNativeCasualSignal: hasNativeCasualSignal(content),
    generatedTextingHasPeerSlangSignal: hasPeerSlangSignal(content),
    eliteReviewHasNativeCasualUpgrade: hasNativeCasualSignal(review),
    eliteReviewHasPeerSlangUpgrade: hasPeerSlangSignal(review),
  },
  content,
  review,
};

fs.mkdirSync(path.resolve('dist'), { recursive: true });
fs.writeFileSync(path.resolve('dist/ai-native-casual-sample.json'), `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  '# Native Casual AI Sample',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## Checks',
  '',
  `- Generated texting has native casual signal: ${report.checks.generatedTextingHasNativeCasualSignal ? 'yes' : 'no'}`,
  `- Generated texting has peer slang signal: ${report.checks.generatedTextingHasPeerSlangSignal ? 'yes' : 'no'}`,
  `- Elite review has native casual upgrade: ${report.checks.eliteReviewHasNativeCasualUpgrade ? 'yes' : 'no'}`,
  `- Elite review has peer slang upgrade: ${report.checks.eliteReviewHasPeerSlangUpgrade ? 'yes' : 'no'}`,
  '',
  '## Generated Texting',
  '',
  '```json',
  JSON.stringify(content, null, 2),
  '```',
  '',
  '## Elite Review',
  '',
  '```json',
  JSON.stringify(review, null, 2),
  '```',
  '',
];
fs.writeFileSync(path.resolve('dist/ai-native-casual-sample.md'), `${lines.join('\n')}\n`);

console.log(JSON.stringify({
  checks: report.checks,
  generatedTextingTitle: content.items?.[0]?.title,
  reviewScore: review.score,
  wrote: [
    path.resolve('dist/ai-native-casual-sample.json'),
    path.resolve('dist/ai-native-casual-sample.md'),
  ],
}, null, 2));

if (
  !report.checks.generatedTextingHasNativeCasualSignal
  || !report.checks.generatedTextingHasPeerSlangSignal
  || !report.checks.eliteReviewHasNativeCasualUpgrade
  || !report.checks.eliteReviewHasPeerSlangUpgrade
) {
  process.exitCode = 1;
}
