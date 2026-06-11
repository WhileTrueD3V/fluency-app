import fs from 'node:fs';
import path from 'node:path';

const SERVER_URL = process.env.AI_SERVER_URL ?? 'http://127.0.0.1:8787';

const profile = {
  languageCode: 'ja',
  currentLevel: 9,
  rank: 'Beginner',
  totalXP: 610,
  accuracyPercent: 69,
  weakestRubric: 'Language use',
  recentMistakes: [
    {
      type: 'texting',
      promptId: 'ja-text-friend-late',
      score: 52,
      correct: false,
      daysAgo: 1,
      question: 'Tell a friend you will be late and ask what to bring.',
      userAnswer: '遅いです。何を持っていますか。',
      expectedAnswer: '少し遅れるけど、四時ごろ着くよ。何を持っていけばいい？',
      context: 'Casual classmate text chat.',
      weakSkills: ['casual register', 'verb choice', 'task completion'],
    },
    {
      type: 'reading',
      promptId: 'ja-reading-club-notice',
      score: 63,
      correct: false,
      daysAgo: 2,
      question: 'Identify the reason a club meeting changed.',
      userAnswer: 'The time changed.',
      expectedAnswer: 'The meeting moved because the teacher has a staff meeting.',
      context: 'School club notice.',
      weakSkills: ['supporting detail', 'cause/effect'],
    },
  ],
  weakMemory: [
    {
      type: 'texting',
      topic: 'school life',
      vocab: ['部活', '宿題', 'classmate', 'practice'],
      rubric: 'Language use',
      mistakeType: 'register mismatch',
      missCount: 3,
      priority: 54,
      daysAgo: 1,
      evidence: ['Casual classmate text chat.', 'Learner sounds too textbook with friends.'],
    },
    {
      type: 'reading',
      topic: 'school life',
      vocab: ['予定', '先生', '理由', '変更'],
      rubric: 'Task completion',
      mistakeType: 'missed evidence',
      missCount: 2,
      priority: 42,
      daysAgo: 2,
      evidence: ['Missed why a school notice changed.'],
    },
  ],
  recentPromptIdsByType: {
    reading: ['ja-reading-club-notice'],
    texting: ['ja-text-friend-late'],
  },
  doNotRepeatIds: ['ja-reading-club-notice', 'ja-text-friend-late'],
  generatedPromptSummaries: [
    {
      type: 'reading',
      id: 'ja-reading-club-notice',
      category: 'school notice',
      prompt: 'Club meeting change notice.',
      answerLogic: 'Find reason for schedule change.',
      source: 'Avoid club meeting change template.',
    },
    {
      type: 'texting',
      id: 'ja-text-friend-late',
      category: 'school life',
      prompt: 'Tell friend you are late and ask what to bring.',
      answerLogic: 'Use casual register and ask a useful follow-up.',
      source: 'Avoid late-arrival template.',
    },
  ],
  personalizationRules: [
    'Target casual classmate register without becoming sloppy.',
    'Target school-notice detail traps without repeating the same club-meeting-change frame.',
    'Keep AP Japanese task completion central.',
  ],
};

const dailyPlanPayload = { languageCode: 'ja', profile };

const readingPayload = {
  mode: 'reading',
  languageCode: 'ja',
  level: profile.currentLevel,
  difficulty: 'intermediate',
  count: 1,
  recentPromptIds: profile.doNotRepeatIds,
  targetSkills: ['school notice evidence', 'cause/effect detail', 'avoid repeated club meeting change frame'],
  profile,
};

const textingPayload = {
  mode: 'texting',
  languageCode: 'ja',
  level: profile.currentLevel,
  difficulty: 'intermediate',
  count: 1,
  recentPromptIds: profile.doNotRepeatIds,
  targetSkills: ['natural classmate register', 'task completion', 'light peer-casual Japanese when appropriate'],
  profile,
};

const reviewPayload = {
  feedbackLevel: 'elite',
  set: {
    id: 'tiny-live-qa-texting-review',
    title: 'Classmate Project Check',
    situation: 'A classmate texts about practicing before a school presentation.',
    mode: 'texting',
    languageCode: 'ja',
    prompts: [
      '発表の前にちょっと練習したいんだけど、今日時間ある？',
      'どこで練習するのがよさそう？',
      '何を持っていけばいい？',
      '最後に、友だちに一言送ってください。',
    ],
    suggestedKeywords: [['練習'], ['図書館'], ['メモ'], ['ありがとう']],
    modelAnswers: [
      'うん、放課後なら少し手伝えるよ。',
      '図書館がいいと思う。静かだし、集中できるから。',
      '発表のメモとノートを持ってきてくれる？',
      '今日はありがとね。明日も一緒にがんばろう。',
    ],
  },
  answers: [
    '今日は手伝うことができます。',
    '図書館がいいです。',
    'ノートを持っています。',
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

function hasNoBannedRepeat(value) {
  const text = textFrom(value);
  const repeatedLateBring = /(遅れ|遅刻|late).{0,120}(持ち|持って|bring|what to bring)|(持ち|持って|bring|what to bring).{0,120}(遅れ|遅刻|late)/i.test(text);
  const repeatedClubChange = /(club meeting change|部活.{0,80}(変更|変わ|変える)|クラブ.{0,80}(変更|変わ|変える))/i.test(text);
  const staleTemplate = /train delay|platform|cafe flyer|store price/i.test(text);
  return !(repeatedLateBring || repeatedClubChange || staleTemplate);
}

function hasJapanese(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(textFrom(value));
}

function hasNativeCasual(value) {
  return /んだけど|かな|かも|てくれる|だよね|ありがとね|おけ|まじ|めっちゃ|じゃん/.test(textFrom(value));
}

function compactSample(value, limit = 1600) {
  return JSON.stringify(value, null, 2).slice(0, limit);
}

const health = await fetch(`${SERVER_URL}/health`).then((res) => res.json());
if (health?.provider !== 'openai' || health?.costControls?.enforceCostCap !== true) {
  throw new Error(`Refusing live QA: unsafe server health ${JSON.stringify(health?.costControls ?? {})}`);
}

const cases = [
  ['dailyPlan', '/generate-daily-plan', dailyPlanPayload],
  ['readingBatch', '/generate-practice-content', readingPayload],
  ['textingSet', '/generate-practice-content', textingPayload],
  ['eliteTextingReview', '/grade-ap-session', reviewPayload],
];

const results = [];
let runError = null;
for (const [name, endpoint, payload] of cases) {
  try {
    const body = await postJson(endpoint, payload);
    results.push({ name, endpoint, ok: true, body });
  } catch (error) {
    runError = {
      name,
      endpoint,
      message: error instanceof Error ? error.message : String(error),
    };
    results.push({ name, endpoint, ok: false, error: runError.message });
    break;
  }
}

const checks = {
  allCallsCompleted: results.length === cases.length && results.every((result) => result.ok),
  dailyPlanHasActions: Array.isArray(results[0]?.body?.actions) && results[0].body.actions.length > 0,
  readingHasQuestions: Array.isArray(results[1]?.body?.items) && results[1].body.items.some((item) => Array.isArray(item.questions)),
  textingHasFourTurns: Array.isArray(results[2]?.body?.items) && results[2].body.items.every((item) => Array.isArray(item.prompts) && item.prompts.length === 4),
  noBannedRepeat: results.slice(1).every((result) => hasNoBannedRepeat(result.body)),
  hasJapanese: results.slice(1).every((result) => hasJapanese(result.body)),
  reviewHasTurnFeedback: Array.isArray(results[3]?.body?.turns) && results[3].body.turns.length > 0,
  reviewHasNativeCasualUpgrade: hasNativeCasual(results[3]?.body),
};

const report = {
  generatedAt: new Date().toISOString(),
  serverUrl: SERVER_URL,
  error: runError,
  health: {
    provider: health.provider,
    contentModel: health.openai?.contentModel,
    dailyPlanModel: health.openai?.dailyPlanModel,
    eliteReviewModel: health.openai?.eliteReviewModel,
    costControls: health.costControls,
  },
  checks,
  results,
};

fs.mkdirSync(path.resolve('dist'), { recursive: true });
fs.writeFileSync(path.resolve('dist/ai-tiny-live-qa.json'), `${JSON.stringify(report, null, 2)}\n`);

const md = [
  '# Tiny Live AI QA',
  '',
  `Generated: ${report.generatedAt}`,
  `Server: ${SERVER_URL}`,
  '',
  '## Checks',
  '',
  ...Object.entries(checks).map(([key, pass]) => `- ${key}: ${pass ? 'yes' : 'no'}`),
  ...(runError ? ['', '## Error', '', `- ${runError.name}: ${runError.message}`] : []),
  '',
  '## Samples',
  '',
  ...results.flatMap((result) => [
    `### ${result.name}`,
    '',
    '```json',
    compactSample(result.ok ? result.body : { error: result.error }),
    '```',
    '',
  ]),
].join('\n');
fs.writeFileSync(path.resolve('dist/ai-tiny-live-qa.md'), `${md}\n`);

console.log(JSON.stringify({
  checks,
  wrote: [
    path.resolve('dist/ai-tiny-live-qa.json'),
    path.resolve('dist/ai-tiny-live-qa.md'),
  ],
}, null, 2));

if (runError || Object.values(checks).some((pass) => !pass)) {
  process.exitCode = 1;
}
