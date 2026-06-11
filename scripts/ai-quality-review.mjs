import fs from 'node:fs';
import path from 'node:path';
import {
  contentGenerationPrompt,
  contentRetryPayload,
  dailyPlanPrompt,
  generatedContentNoveltyIssues,
  gradingPrompt,
  speakingReviewPrompt,
} from '../server/grading-server.mjs';

const SERVER_URL = process.env.AI_SERVER_URL ?? 'http://127.0.0.1:8787';
const LIVE = process.argv.includes('--live') || process.env.AI_QUALITY_REVIEW_LIVE === '1';
const ALLOW_RISKY_SERVER = process.env.AI_QUALITY_REVIEW_ALLOW_RISK === '1';

const sampleProfile = {
  languageCode: 'ja',
  currentLevel: 9,
  rank: 'Beginner',
  totalXP: 610,
  accuracyPercent: 69,
  bestSkill: 'Reading',
  developmentIndex: 64,
  weakestRubric: 'Language use',
  todayWork: [
    { type: 'listening', score: 70, correct: 7, total: 10, xpEarned: 16, rewardKey: 'listen-purpose', daysAgo: 0 },
  ],
  recentAttempts: [
    { type: 'texting', score: 58, correct: 2, total: 4, xpEarned: 12, rewardKey: 'casual-register', daysAgo: 1 },
    { type: 'conversation', score: 66, correct: 3, total: 4, xpEarned: 15, rewardKey: 'thin-replies', daysAgo: 2 },
    { type: 'speaking', score: 72, correct: 7, total: 10, xpEarned: 18, rewardKey: 'sentence-control', daysAgo: 3 },
  ],
  missedAttempts: [
    { type: 'texting', score: 58, correct: 2, total: 4, xpEarned: 12, rewardKey: 'casual-register', daysAgo: 1 },
  ],
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
      type: 'conversation',
      promptId: 'ja-conv-club-plan',
      score: 63,
      correct: false,
      daysAgo: 2,
      question: 'Suggest a plan and give a reason.',
      userAnswer: '図書館がいいです。',
      expectedAnswer: '図書館で会うのがいいと思います。静かだから、発表の練習がしやすいです。',
      context: 'Conversation with a classmate.',
      weakSkills: ['reason giving', 'detail depth'],
    },
  ],
  recentAnswerPatterns: [
    {
      type: 'speaking',
      promptId: 'ja-speak-cost',
      score: 72,
      correct: true,
      daysAgo: 3,
      question: 'Ask how much something costs.',
      userAnswer: 'これはいくらですか。',
      expectedAnswer: 'これはいくらですか。',
      context: 'Store interaction.',
      weakSkills: ['short responses'],
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
      evidence: ['Casual classmate text chat.', 'Tell a club friend you will arrive late and ask what to bring.'],
    },
    {
      type: 'conversation',
      topic: 'school life',
      vocab: ['図書館', '発表', 'practice'],
      rubric: 'Task completion',
      mistakeType: 'sentence control',
      missCount: 2,
      priority: 42,
      daysAgo: 2,
      evidence: ['Conversation with a classmate.', 'Suggest a plan and give a reason.'],
    },
  ],
  savedWeakSpots: [
    {
      type: 'texting',
      promptId: 'saved-casual-register',
      question: 'Make casual text replies sound natural.',
      answer: 'Avoid overusing です/ます with friends when plain style fits.',
    },
  ],
  generatedPromptSummaries: [
    {
      type: 'listening',
      id: 'ai-train-delay-old',
      category: 'transportation',
      prompt: 'Train delay platform announcement',
      answerLogic: 'Identify a platform change.',
      source: 'Avoid train delay templates.',
    },
    {
      type: 'reading',
      id: 'ai-cafe-flyer-old',
      category: 'flyer',
      prompt: 'Cafe event flyer',
      answerLogic: 'Find time and cost.',
      source: 'Avoid cafe flyer templates.',
    },
  ],
  recentPromptIdsByType: {
    listening: ['ai-train-delay-old'],
    reading: ['ai-cafe-flyer-old'],
    speaking: ['ai-speak-cost-old'],
    conversation: ['ja-conv-club-plan'],
    texting: ['ja-text-friend-late'],
  },
  generatedPromptIdsByType: {
    listening: ['ai-train-delay-old'],
    reading: ['ai-cafe-flyer-old'],
  },
  doNotRepeatIds: ['ai-train-delay-old', 'ai-cafe-flyer-old', 'ai-speak-cost-old', 'ja-text-friend-late'],
  personalizationRules: [
    'Coach the learner on casual register in friend/classmate text chats.',
    'Avoid train delay, cafe flyer, and store-price prompt patterns.',
    'Push reasons and useful detail without making prompts too advanced.',
  ],
};

const dailyPlanPayload = { languageCode: 'ja', profile: sampleProfile };

const contentPayloads = ['listening', 'reading', 'speaking', 'conversation', 'texting'].map((mode) => ({
  mode,
  languageCode: 'ja',
  level: sampleProfile.currentLevel,
  difficulty: 'intermediate',
  count: mode === 'listening' ? 3 : mode === 'speaking' ? 4 : 2,
  recentPromptIds: sampleProfile.doNotRepeatIds,
  targetSkills: [
    'repair casual register and thin detail',
    'avoid recent repeated prompt families',
    'keep AP Japanese task completion central',
  ],
  profile: sampleProfile,
}));

const speakingReviewPayload = {
  feedbackLevel: 'standard',
  promptId: 'quality-speaking-review',
  english: 'Tell your classmate you are sorry, but you cannot come because you have practice.',
  transcript: 'ごめん練習があるから行けない',
  targetAnswer: 'ごめん、練習があるから行けない。',
  acceptableAnswers: [
    'ごめん、練習があるから行けない。',
    'すみません、練習があるので行けません。',
  ],
  delivery: {
    recognitionConfidence: 0.9,
    naturalnessCap: 94,
    notes: [],
  },
};

const apReviewPayload = {
  feedbackLevel: 'elite',
  set: {
    id: 'quality-text-chat-review',
    title: 'Classmate Project',
    situation: 'A classmate texts about preparing a short presentation.',
    mode: 'texting',
    languageCode: 'ja',
    prompts: [
      '明日の発表の準備はどうですか。',
      'どこで一緒に練習したいですか。',
      '何を持っていけばいいですか。',
      '最後に、友だちに一言送ってください。',
    ],
    suggestedKeywords: [['準備'], ['場所'], ['持って'], ['ありがとう']],
    modelAnswers: [
      'だいたいできたよ。少しだけ練習したい。',
      '図書館で練習するのはどう？静かだからいいと思う。',
      'ノートと発表のメモを持ってきてくれる？',
      '手伝ってくれてありがとう。明日がんばろうね。',
    ],
  },
  answers: [
    '準備はできます。',
    '図書館がいいです。',
    'ノートを持っています。',
    'ありがとうございます。',
  ],
};

async function getHealth() {
  const response = await fetch(`${SERVER_URL}/health`);
  return response.json();
}

function isSafeHealth(health) {
  const controls = health?.costControls;
  return health?.provider === 'openai'
    && controls?.enforceCostCap === true
    && Number(controls?.maxCostCentsPerCredit) <= 1;
}

async function postJson(endpoint, payload) {
  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

function textFrom(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textFrom).join(' ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_'))
      .map(([, nested]) => textFrom(nested))
      .join(' ');
  }
  return '';
}

function evaluateDailyPlan(body) {
  const actions = Array.isArray(body?.actions) ? body.actions : [];
  const text = textFrom(body);
  return [
    { label: 'has 1-3 actions', pass: actions.length >= 1 && actions.length <= 3 },
    { label: 'uses AP rubric fields', pass: actions.every((action) => ['Task completion', 'Delivery', 'Language use', 'Cultural knowledge'].includes(action.rubric)) },
    { label: 'targets weak spots', pass: text.toLowerCase().includes('register') || text.toLowerCase().includes('detail') || text.includes('Language use') },
    { label: 'avoids banned recent prompt families', pass: !/train delay|platform|cafe flyer|store price|late arrival|what (they|you|to) bring|what to bring|ask what.*bring/i.test(text) },
    { label: 'avoids decimal scores', pass: !/\d+\.\d+\s*(\/|out of|score)/i.test(text) },
  ];
}

function evaluateContent(mode, body) {
  const items = Array.isArray(body?.items) ? body.items : [];
  const text = textFrom(body);
  const checks = [
    { label: 'returns generated items', pass: items.length > 0 },
    { label: 'uses ai ids', pass: items.every((item) => typeof item.id === 'string' && item.id.startsWith('ai-')) },
    { label: 'avoids banned recent prompt families', pass: !/train delay|platform|cafe flyer|store price/i.test(text) },
    { label: 'keeps Japanese/AP context', pass: /Japanese|AP|日本|友だち|友達|学校|クラス|発表|クラブ|[\u3040-\u30ff\u3400-\u9fff]/i.test(text) },
  ];
  if (mode === 'listening') {
    checks.push({ label: 'listening choices are four-option MCQ', pass: items.every((item) => Array.isArray(item.choices) && item.choices.length === 4) });
    checks.push({
      label: 'listening choices are unlabeled English',
      pass: items.every((item) => Array.isArray(item.choices)
        && item.choices.every((choice) => typeof choice === 'string'
          && !/^\s*[A-D][).]/i.test(choice)
          && !/[\u3040-\u30ff\u3400-\u9fff]/.test(choice))),
    });
  }
  if (mode === 'reading') {
    checks.push({ label: 'reading has linked questions', pass: items.every((item) => Array.isArray(item.questions) && item.questions.length >= 2) });
  }
  if (mode === 'speaking') {
    checks.push({ label: 'speaking allows multiple natural answers', pass: items.every((item) => Array.isArray(item.acceptableAnswers) && item.acceptableAnswers.length >= 2) });
  }
  if (mode === 'conversation' || mode === 'texting') {
    checks.push({
      label: 'AP set matches requested mode',
      pass: items.every((item) => item?.mode === mode),
    });
    checks.push({
      label: 'AP set has four string turns',
      pass: items.every((item) => Array.isArray(item.prompts)
        && item.prompts.length === 4
        && item.prompts.every((prompt) => typeof prompt === 'string' && prompt.trim())),
    });
    checks.push({
      label: 'AP set has four model answers',
      pass: items.every((item) => Array.isArray(item.modelAnswers)
        && item.modelAnswers.length === 4
        && item.modelAnswers.every((answer) => typeof answer === 'string' && answer.trim())),
    });
  }
  return checks;
}

function evaluateReview(body, kind) {
  const text = textFrom(body);
  const nativePeerPattern = /んだけど|なんだけど|かな|かも|しようか|てくれる|だよね|そうだね|なるほど|たしかに|ありがとね|まじ|マジ|それな|わかる|りょ|了解|おけ|オッケー|めっちゃ|やばい|普通に|いい感じ|びみょう|だるい|やっぱ|とりま|じゃん/;
  const checks = [
    { label: 'returns concrete feedback', pass: text.length > 80 },
    { label: 'mentions specific weak skills or improvements', pass: /register|detail|task|natural|grammar|particle|polite|casual|completion/i.test(text) },
    { label: 'does not use decimal scores', pass: !/\d+\.\d+/.test(text) },
    { label: kind === 'speaking' ? 'has speaking score fields' : 'has AP turn feedback', pass: kind === 'speaking' ? typeof body?.overall === 'number' : Array.isArray(body?.turns) },
  ];
  if (kind === 'ap') {
    checks.push({
      label: 'casual text review includes native peer-style upgrade',
      pass: nativePeerPattern.test(text),
    });
  }
  return checks;
}

function evaluateOfflinePromptSafety() {
  const prompts = {
    dailyPlan: dailyPlanPrompt(dailyPlanPayload),
    reading: contentGenerationPrompt(contentPayloads.find((payload) => payload.mode === 'reading')),
    texting: contentGenerationPrompt(contentPayloads.find((payload) => payload.mode === 'texting')),
    review: gradingPrompt(apReviewPayload),
    speakingReview: speakingReviewPrompt(speakingReviewPayload),
  };
  const promptText = textFrom(prompts);
  const duplicateTexting = {
    items: [{
      id: 'ai-ja-duplicate-late-bring',
      title: '友達に遅れる連絡と持ち物の確認',
      situation: 'クラスメートに遅れることを伝え、何か持っていくものがあるか尋ねる。',
      prompts: ['ごめん、ちょっと遅れるよ。何か持っていくものある？'],
      modelAnswers: ['少し遅れるけど、何を持っていけばいい？'],
    }],
  };
  const freshTexting = {
    items: [{
      id: 'ai-ja-fresh-peer-practice',
      title: '発表練習の場所相談',
      situation: 'クラスメートと発表練習の場所を決める。',
      prompts: ['今日、図書館で少し練習しない？'],
      modelAnswers: ['おけ、図書館なら集中できそうだね。'],
    }],
  };
  const duplicateIssues = generatedContentNoveltyIssues(duplicateTexting, {
    mode: 'texting',
    profile: sampleProfile,
  });
  const freshIssues = generatedContentNoveltyIssues(freshTexting, {
    mode: 'texting',
    profile: sampleProfile,
  });
  const retryPayload = contentRetryPayload(contentPayloads.find((payload) => payload.mode === 'texting'), [
    'Repeated recent late-arrival plus what-to-bring task frame.',
  ]);
  const retryPrompt = contentGenerationPrompt(retryPayload);

  return [
    { label: 'daily/content prompts include hard novelty constraints', pass: /Hard novelty constraints/.test(promptText) },
    { label: 'content prompt says same skill but different situation', pass: /same weak skill|Repair the same weak skill/i.test(promptText) },
    { label: 'content prompt includes blocked late/bring frame terms', pass: promptText.includes('BLOCKED FRAME: Recent work already used late-arrival plus what-to-bring logic') && promptText.includes('do not output late/late arrival/apology timing') },
    { label: 'content prompt includes native casual Japanese guidance', pass: /んだけど|peer-casual|classmate/i.test(promptText) },
    { label: 'review prompt includes native peer-style coaching', pass: /native peer|りょ|おけ|まじ/i.test(promptText) },
    { label: 'duplicate late/bring task is rejected offline', pass: duplicateIssues.length > 0 },
    { label: 'fresh peer practice is not rejected offline', pass: freshIssues.length === 0 },
    { label: 'novelty retry prompt clearly changes scenario and answer logic', pass: /NOVELTY RETRY/.test(retryPrompt) && /different situation, source type, speech act, answer logic/.test(retryPrompt) },
  ];
}

function summarizeChecks(checks) {
  const failed = checks.filter((check) => !check.pass);
  return {
    passed: failed.length === 0,
    failed,
    total: checks.length,
  };
}

function errorToCheck(result) {
  const error = result.body?.error;
  const code = result.body?.code ?? error?.code;
  const type = error?.type;
  const message = typeof error === 'string'
    ? error
    : error?.message ?? result.body?.message ?? 'request failed';
  const parts = [
    `HTTP ${result.status}`,
    code ? String(code) : null,
    type ? String(type) : null,
    message ? String(message) : null,
  ].filter(Boolean);
  return { label: parts.join(': '), pass: false };
}

async function runLiveReview() {
  const health = await getHealth();
  if (!isSafeHealth(health) && !ALLOW_RISKY_SERVER) {
    return {
      health,
      blocked: true,
      reason: 'Quality review refused because live generation would use a server without the recommended OpenAI cost cap.',
      required: {
        provider: 'openai',
        costControls: {
          enforceCostCap: true,
          maxCostCentsPerCredit: '<= 1',
        },
      },
      override: 'Set AI_QUALITY_REVIEW_ALLOW_RISK=1 only if you intentionally want to spend on the current server route.',
      cases: [],
    };
  }

  const cases = [];
  const daily = await postJson('/generate-daily-plan', dailyPlanPayload);
  cases.push({
    name: 'Daily plan',
    status: daily.status,
    ok: daily.ok,
    checks: daily.ok ? evaluateDailyPlan(daily.body) : [errorToCheck(daily)],
    body: daily.body,
  });

  for (const payload of contentPayloads) {
    const result = await postJson('/generate-practice-content', payload);
    cases.push({
      name: `Content: ${payload.mode}`,
      status: result.status,
      ok: result.ok,
      checks: result.ok ? evaluateContent(payload.mode, result.body) : [errorToCheck(result)],
      body: result.body,
    });
  }

  const speaking = await postJson('/review-speaking-attempt', speakingReviewPayload);
  cases.push({
    name: 'Speaking review',
    status: speaking.status,
    ok: speaking.ok,
    checks: speaking.ok ? evaluateReview(speaking.body, 'speaking') : [errorToCheck(speaking)],
    body: speaking.body,
  });

  const ap = await postJson('/grade-ap-session', apReviewPayload);
  cases.push({
    name: 'Elite AP text review',
    status: ap.status,
    ok: ap.ok,
    checks: ap.ok ? evaluateReview(ap.body, 'ap') : [errorToCheck(ap)],
    body: ap.body,
  });

  return { health, blocked: false, cases };
}

function renderMarkdown(report) {
  const lines = [
    '# Kibbo AI Quality Review',
    '',
    `Generated: ${report.generatedAt}`,
    `Server: ${SERVER_URL}`,
    '',
  ];

  if (report.live?.blocked) {
    lines.push('## Blocked For Safety', '');
    lines.push(report.live.reason, '');
    lines.push('Required:', '');
    lines.push('```json');
    lines.push(JSON.stringify(report.live.required, null, 2));
    lines.push('```', '');
    lines.push(report.live.override, '');
    return `${lines.join('\n')}\n`;
  }

  if (report.live?.skipped) {
    lines.push('## Live Review Skipped', '', report.live.reason, '');
  } else if (report.live?.error) {
    lines.push('## Unable To Run', '', report.live.error, '');
    return `${lines.join('\n')}\n`;
  }

  lines.push('## Summary', '');
  lines.push(`- Offline checks: ${report.summary.offlineChecks}`);
  lines.push(`- Failed offline checks: ${report.summary.failedOfflineChecks}`);
  lines.push(`- Live cases: ${report.summary.totalCases}`);
  lines.push(`- Passed live cases: ${report.summary.passedCases}`);
  lines.push(`- Failed live checks: ${report.summary.failedChecks}`);
  lines.push('');
  lines.push('## Offline Gate', '');
  lines.push('| Check | Result |');
  lines.push('|---|---:|');
  for (const check of report.offlineChecks) {
    lines.push(`| ${check.label} | ${check.pass ? 'pass' : 'fail'} |`);
  }
  lines.push('');

  if (report.live?.skipped) {
    return `${lines.join('\n')}\n`;
  }

  lines.push('## Live Gate', '');
  lines.push('| Case | Status | Checks | Failed |');
  lines.push('|---|---:|---:|---|');
  for (const testCase of report.live.cases) {
    const checkSummary = summarizeChecks(testCase.checks ?? []);
    lines.push(`| ${testCase.name} | ${testCase.status} | ${checkSummary.total} | ${checkSummary.failed.map((item) => item.label).join(', ') || 'none'} |`);
  }
  lines.push('', '## Sample Output', '');
  for (const testCase of report.live.cases) {
    lines.push(`### ${testCase.name}`, '');
    lines.push('```json');
    lines.push(JSON.stringify(testCase.body, null, 2).slice(0, 4000));
    lines.push('```', '');
  }
  return `${lines.join('\n')}\n`;
}

const offlineChecks = evaluateOfflinePromptSafety();
let live;
try {
  live = LIVE
    ? await runLiveReview()
    : {
      skipped: true,
      reason: 'Live quality review was not requested. Set AI_QUALITY_REVIEW_LIVE=1 or pass --live to spend on live QA.',
      cases: [],
    };
} catch (error) {
  live = { error: error instanceof Error ? error.message : String(error), cases: [] };
}

const cases = live.cases ?? [];
const summaries = cases.map((item) => summarizeChecks(item.checks ?? []));
const report = {
  generatedAt: new Date().toISOString(),
  serverUrl: SERVER_URL,
  liveRequested: LIVE,
  offlineChecks,
  live,
  summary: {
    offlineChecks: offlineChecks.length,
    failedOfflineChecks: offlineChecks.filter((check) => !check.pass).length,
    totalCases: cases.length,
    passedCases: cases.filter((item, index) => item.ok && summaries[index]?.passed).length,
    failedChecks: summaries.reduce((sum, item) => sum + item.failed.length, 0),
  },
};

fs.mkdirSync(path.resolve('dist'), { recursive: true });
fs.writeFileSync(path.resolve('dist/ai-quality-review.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.resolve('dist/ai-quality-review.md'), renderMarkdown(report));

if (live.skipped) {
  console.table(offlineChecks.map((check) => ({
    check: check.label,
    status: check.pass ? 'pass' : 'fail',
  })));
  console.log(live.reason);
} else if (live.blocked) {
  console.log(live.reason);
  console.log(live.override);
} else if (live.error) {
  console.log(`Quality review unavailable: ${live.error}`);
} else {
  console.table(cases.map((item) => {
    const checkSummary = summarizeChecks(item.checks ?? []);
    return {
      case: item.name,
      status: item.status,
      checks: checkSummary.total,
      failed: checkSummary.failed.length,
    };
  }));
}

console.log(`Wrote ${path.resolve('dist/ai-quality-review.json')}`);
console.log(`Wrote ${path.resolve('dist/ai-quality-review.md')}`);

if (
  report.summary.failedOfflineChecks > 0
  || (!live.skipped && !live.blocked && !live.error && report.summary.failedChecks > 0)
) {
  process.exitCode = 1;
}
