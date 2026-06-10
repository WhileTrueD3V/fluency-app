import fs from 'node:fs';
import path from 'node:path';
import {
  MODEL_PRICES_USD_PER_1M,
  TASK_CONFIGS,
  budgetCentsFor,
  contentGenerationPrompt,
  dailyPlanPrompt,
  estimateCostCents,
  estimateTokens,
  gradingPrompt,
  speakingReviewPrompt,
} from '../server/grading-server.mjs';

const LIVE = process.argv.includes('--live') || process.env.AI_COST_AUDIT_LIVE === '1';
const SERVER_URL = process.env.AI_SERVER_URL ?? 'http://127.0.0.1:8787';
const WARNING_CENTS_PER_CREDIT = Number(process.env.AI_COST_WARNING_CENTS_PER_CREDIT ?? 0.5);
const ALLOW_RISKY_LIVE_SERVER = process.env.AI_COST_AUDIT_ALLOW_RISK === '1';

const sampleProfile = {
  languageCode: 'ja',
  currentLevel: 7,
  rank: 'Beginner',
  totalXP: 420,
  accuracyPercent: 72,
  bestSkill: 'Reading',
  developmentIndex: 68,
  weakestRubric: 'Task completion',
  todayWork: [
    { type: 'speaking', score: 74, correct: 7, total: 10, xpEarned: 18, rewardKey: 'speak-register', daysAgo: 0 },
  ],
  recentAttempts: [
    { type: 'listening', score: 60, correct: 6, total: 10, xpEarned: 12, rewardKey: 'listen-detail', daysAgo: 1 },
    { type: 'texting', score: 66, correct: 3, total: 4, xpEarned: 16, rewardKey: 'text-register', daysAgo: 2 },
    { type: 'conversation', score: 70, correct: 3, total: 4, xpEarned: 18, rewardKey: 'conversation-repair', daysAgo: 3 },
  ],
  missedAttempts: [
    { type: 'listening', score: 60, correct: 6, total: 10, xpEarned: 12, rewardKey: 'listen-detail', daysAgo: 1 },
  ],
  recentMistakes: [
    {
      type: 'listening',
      promptId: 'ja-listen-weather-delay',
      score: 45,
      correct: false,
      daysAgo: 1,
      question: 'What will happen to tomorrow’s outdoor club activity?',
      userAnswer: 'It is cancelled.',
      expectedAnswer: 'It moves indoors if it rains.',
      context: 'School announcement with conditionals.',
      weakSkills: ['conditional detail', 'main action'],
    },
    {
      type: 'texting',
      promptId: 'ja-text-club-delay',
      score: 62,
      correct: false,
      daysAgo: 2,
      question: 'Tell a club friend you will arrive late and ask what to bring.',
      userAnswer: '遅いです。何を持っていきますか。',
      expectedAnswer: '少し遅れるけど、四時ごろ着くよ。何を持っていけばいい？',
      context: 'Casual friend text.',
      weakSkills: ['casual register', 'question control'],
    },
  ],
  recentAnswerPatterns: [
    {
      type: 'conversation',
      promptId: 'ja-conv-host-family',
      score: 68,
      correct: true,
      daysAgo: 3,
      question: 'Explain what you want to do this weekend.',
      userAnswer: '映画を見ます。友だちと行きます。',
      expectedAnswer: '週末は友だちと映画を見に行きたいです。',
      context: 'Host family conversation.',
      weakSkills: ['thin detail', 'connection between ideas'],
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
      type: 'listening',
      topic: 'schedule and plans',
      vocab: ['明日', '来週', 'activity'],
      rubric: 'Task completion',
      mistakeType: 'missed evidence/detail',
      missCount: 2,
      priority: 39,
      daysAgo: 2,
      evidence: ['School announcement with conditionals.'],
    },
  ],
  savedWeakSpots: [
    {
      type: 'texting',
      promptId: 'saved-register-repair',
      question: 'Reply naturally to a friend.',
      answer: 'Casual friend messages sounded too stiff.',
    },
  ],
  generatedPromptSummaries: [
    {
      type: 'listening',
      id: 'ai-train-delay-old',
      category: 'transportation',
      prompt: 'Train platform delay announcement',
      answerLogic: 'Which platform changes?',
      source: 'Avoid more train/payment prompts.',
    },
    {
      type: 'reading',
      id: 'ai-cafe-flyer-old',
      category: 'flyer',
      prompt: 'Cafe event flyer',
      answerLogic: 'Find event time and fee.',
      source: 'Avoid cafe flyers.',
    },
  ],
  recentPromptIdsByType: {
    listening: ['ai-train-delay-old', 'ai-weather-club-old'],
    speaking: ['ai-pharmacy-old', 'ai-cost-old'],
    reading: ['ai-cafe-flyer-old'],
    conversation: ['ai-host-family-old'],
    texting: ['ai-club-delay-old'],
  },
  generatedPromptIdsByType: {
    listening: ['ai-train-delay-old'],
    reading: ['ai-cafe-flyer-old'],
  },
  doNotRepeatIds: ['ai-train-delay-old', 'ai-cafe-flyer-old', 'ai-pharmacy-old', 'ai-cost-old'],
  personalizationRules: [
    'Prioritize AP task completion over generic vocabulary review.',
    'Repair conditional detail and casual text-message register.',
    'Avoid train platform and cafe flyer templates today.',
  ],
};

const baseContentRequest = {
  languageCode: 'ja',
  level: 7,
  difficulty: 'intermediate',
  recentPromptIds: sampleProfile.doNotRepeatIds,
  targetSkills: [
    'repair conditional detail',
    'build AP readiness without repeating recent topics',
    'use fresh school or community contexts',
  ],
  profile: sampleProfile,
};

const sampleAPPayload = {
  feedbackLevel: 'standard',
  set: {
    id: 'ai-text-sample',
    title: 'Club Schedule',
    situation: 'A classmate texts about a schedule change for club practice.',
    mode: 'texting',
    languageCode: 'ja',
    prompts: [
      '今日のクラブ練習に来られますか。',
      '遅れる場合は何時ごろ着きますか。',
      '新しい場所を友だちに伝えてください。',
      '最後に、必要なものを一つ聞いてください。',
    ],
    suggestedKeywords: [['行ける'], ['遅れる'], ['場所'], ['必要']],
    modelAnswers: [
      'うん、今日の練習に行けるよ。',
      '少し遅れるけど、四時ごろ着くと思う。',
      '今日は体育館じゃなくて図書館の前に集まるよ。',
      '何か持っていったほうがいいものはある？',
    ],
  },
  answers: [
    'はい、行けます。',
    '四時に行きます。',
    '図書館にあります。',
    '何を持っていきますか。',
  ],
};

const sampleSpeakingPayload = {
  feedbackLevel: 'standard',
  promptId: 'ai-speaking-sample',
  english: 'Tell your friend that you are a little late, but you will arrive around four.',
  transcript: 'ちょっと遅れるけど四時ごろ着く',
  targetAnswer: 'ちょっと遅れるけど、四時ごろ着くよ。',
  acceptableAnswers: [
    'ちょっと遅れるけど、四時ごろ着くよ。',
    '少し遅れますが、四時ごろ着きます。',
  ],
  delivery: {
    recognitionConfidence: 0.88,
    naturalnessCap: 92,
    notes: [],
  },
};

const auditCases = [
  {
    name: 'Daily plan',
    task: 'dailyPlan',
    endpoint: '/generate-daily-plan',
    payload: { languageCode: 'ja', profile: sampleProfile },
    prompt: dailyPlanPrompt({ languageCode: 'ja', profile: sampleProfile }),
    expectedOutputTokens: 450,
  },
  ...['listening', 'reading', 'speaking', 'conversation', 'texting'].map((mode) => ({
    name: `Content: ${mode}`,
    task: 'content',
    endpoint: '/generate-practice-content',
    payload: {
      ...baseContentRequest,
      mode,
      count: mode === 'speaking' ? 4 : mode === 'listening' ? 3 : 2,
    },
    prompt: contentGenerationPrompt({
      ...baseContentRequest,
      mode,
      count: mode === 'speaking' ? 4 : mode === 'listening' ? 3 : 2,
    }),
    expectedOutputTokens: mode === 'speaking' ? 900 : mode === 'listening' ? 1200 : 1500,
  })),
  {
    name: 'Speaking review',
    task: 'speakingReview',
    endpoint: '/review-speaking-attempt',
    payload: sampleSpeakingPayload,
    prompt: speakingReviewPrompt(sampleSpeakingPayload),
    expectedOutputTokens: 420,
  },
  {
    name: 'AP session review',
    task: 'apReview',
    endpoint: '/grade-ap-session',
    payload: sampleAPPayload,
    prompt: gradingPrompt(sampleAPPayload),
    expectedOutputTokens: 850,
  },
  {
    name: 'Elite AP session review',
    task: 'eliteReview',
    endpoint: '/grade-ap-session',
    payload: { ...sampleAPPayload, feedbackLevel: 'elite' },
    prompt: gradingPrompt({ ...sampleAPPayload, feedbackLevel: 'elite' }),
    expectedOutputTokens: 1000,
  },
];

function modelForCase(testCase) {
  const config = TASK_CONFIGS[testCase.task] ?? TASK_CONFIGS.content;
  return config.openAIModel;
}

function summarizeCase(testCase) {
  const config = TASK_CONFIGS[testCase.task] ?? TASK_CONFIGS.content;
  const inputTokens = estimateTokens(testCase.prompt);
  const model = modelForCase(testCase);
  const worstCaseCostCents = estimateCostCents('openai', model, inputTokens, config.maxOutputTokens);
  const typicalCostCents = estimateCostCents('openai', model, inputTokens, testCase.expectedOutputTokens);
  const budgetCents = config.creditCost > 0 ? budgetCentsFor(config) : null;
  return {
    name: testCase.name,
    task: testCase.task,
    model,
    inputTokens,
    expectedOutputTokens: testCase.expectedOutputTokens,
    maxOutputTokens: config.maxOutputTokens,
    typicalCostCents: Number(typicalCostCents.toFixed(4)),
    worstCaseCostCents: Number(worstCaseCostCents.toFixed(4)),
    budgetCents,
    budgetStatus: budgetCents === null || worstCaseCostCents <= budgetCents ? 'pass' : 'fail',
    warningStatus: budgetCents === null || typicalCostCents <= WARNING_CENTS_PER_CREDIT ? 'pass' : 'warn',
  };
}

const providerScenarios = [
  { label: 'OpenAI configured', provider: 'openai', model: null },
  { label: 'OpenAI nano', provider: 'openai', model: 'gpt-4.1-nano' },
  { label: 'OpenAI mini', provider: 'openai', model: 'gpt-4.1-mini' },
  { label: 'Gemini Flash', provider: 'gemini', model: 'gemini-2.5-flash' },
  { label: 'Claude Haiku 4.5', provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  { label: 'Claude 3 Haiku', provider: 'anthropic', model: 'claude-3-haiku-20240307' },
];

function providerMatrixForCase(testCase) {
  const config = TASK_CONFIGS[testCase.task] ?? TASK_CONFIGS.content;
  const inputTokens = estimateTokens(testCase.prompt);
  const budgetCents = config.creditCost > 0 ? budgetCentsFor(config) : null;
  return providerScenarios
    .filter((scenario) => scenario.model === null || MODEL_PRICES_USD_PER_1M[scenario.model])
    .map((scenario) => {
      const model = scenario.model ?? modelForCase(testCase);
      const typicalCostCents = estimateCostCents(scenario.provider, model, inputTokens, testCase.expectedOutputTokens);
      const worstCaseCostCents = estimateCostCents(scenario.provider, model, inputTokens, config.maxOutputTokens);
      return {
        label: scenario.label,
        provider: scenario.provider,
        model,
        typicalCostCents: Number(typicalCostCents.toFixed(4)),
        worstCaseCostCents: Number(worstCaseCostCents.toFixed(4)),
        budgetStatus: budgetCents === null || worstCaseCostCents <= budgetCents ? 'pass' : 'fail',
      };
    });
}

async function postJson(endpoint, payload) {
  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  return {
    status: response.status,
    ok: response.ok,
    body: json,
  };
}

async function runLiveCases() {
  const health = await fetch(`${SERVER_URL}/health`).then((response) => response.json());
  const controls = health?.costControls;
  const safeServer = health?.provider === 'openai'
    && controls?.enforceCostCap === true
    && Number(controls?.maxCostCentsPerCredit) <= 1;
  if (!safeServer && !ALLOW_RISKY_LIVE_SERVER) {
    return {
      health,
      blocked: true,
      reason: 'Live audit refused because the server is not running the recommended OpenAI cost-capped configuration.',
      required: {
        provider: 'openai',
        costControls: {
          enforceCostCap: true,
          maxCostCentsPerCredit: '<= 1',
        },
      },
      override: 'Set AI_COST_AUDIT_ALLOW_RISK=1 only if you intentionally want to spend on the current server route.',
      results: [],
    };
  }
  const results = [];
  for (const testCase of auditCases) {
    const startedAt = Date.now();
    const response = await postJson(testCase.endpoint, testCase.payload);
    results.push({
      name: testCase.name,
      status: response.status,
      ok: response.ok,
      elapsedMs: Date.now() - startedAt,
      usage: response.body?._usage ?? null,
      error: response.ok ? null : errorToString(response.body),
    });
  }
  return { health, results };
}

function errorToString(body) {
  const error = body?.error;
  if (typeof error === 'string') return body?.code ? `${body.code}: ${error}` : error;
  const code = body?.code ?? error?.code;
  const type = error?.type;
  const message = error?.message ?? body?.message ?? 'request failed';
  return [code, type, message].filter(Boolean).join(': ');
}

const projected = auditCases.map(summarizeCase);
const failed = projected.filter((item) => item.budgetStatus === 'fail');
const warned = projected.filter((item) => item.warningStatus === 'warn');
const providerMatrix = Object.fromEntries(
  auditCases.map((testCase) => [testCase.name, providerMatrixForCase(testCase)]),
);
const report = {
  generatedAt: new Date().toISOString(),
  target: '1 credit <= 1 cent provider cost',
  warningTarget: `typical credit-bearing calls should stay <= ${WARNING_CENTS_PER_CREDIT} cents`,
  recommendedProductionEnv: {
    AI_PROVIDER: 'openai',
    AI_MAX_COST_CENTS_PER_CREDIT: '1',
    AI_ENFORCE_COST_CAP: '1',
    AI_COST_SAFETY_MULTIPLIER: '1.25',
    OPENAI_MODEL: 'gpt-4.1-nano',
    OPENAI_CONTENT_MODEL: 'gpt-4.1-nano',
    OPENAI_DAILY_PLAN_MODEL: 'gpt-4.1-nano',
    OPENAI_REVIEW_MODEL: 'gpt-4.1-mini',
    OPENAI_ELITE_REVIEW_MODEL: 'gpt-4.1-mini',
  },
  liveRequested: LIVE,
  projected,
  projectedSummary: {
    totalCases: projected.length,
    failedCases: failed.length,
    warningCases: warned.length,
    maxTypicalCostCents: Math.max(...projected.map((item) => item.typicalCostCents)),
    maxWorstCaseCostCents: Math.max(...projected.map((item) => item.worstCaseCostCents)),
  },
  providerMatrix,
  live: null,
};

if (LIVE) {
  try {
    report.live = await runLiveCases();
  } catch (error) {
    report.live = {
      error: error instanceof Error ? error.message : String(error),
      hint: `Start the server with AI keys, then rerun: AI_COST_AUDIT_LIVE=1 npm run audit:ai-cost`,
    };
  }
}

fs.mkdirSync(path.resolve('dist'), { recursive: true });
fs.writeFileSync(path.resolve('dist/ai-cost-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.resolve('dist/ai-cost-audit.md'), renderMarkdownReport(report));

console.table(projected.map((item) => ({
  case: item.name,
  model: item.model,
  input: item.inputTokens,
  typicalCents: item.typicalCostCents,
  worstCents: item.worstCaseCostCents,
  budget: item.budgetCents ?? 'overhead',
  status: item.budgetStatus,
})));

if (report.live) {
  console.log('\nLive results:');
  if (report.live.blocked) {
    console.log(report.live.reason);
    console.log(`Override: ${report.live.override}`);
  } else {
    console.table(report.live.results ?? []);
  }
}

console.log(`\nWrote ${path.resolve('dist/ai-cost-audit.json')}`);
console.log(`Wrote ${path.resolve('dist/ai-cost-audit.md')}`);
if (failed.length > 0) {
  console.error(`\n${failed.length} projected case(s) exceed the configured cost budget.`);
  process.exitCode = 1;
}

function renderMarkdownReport(reportData) {
  const lines = [
    '# Kibbo AI Cost Audit',
    '',
    `Generated: ${reportData.generatedAt}`,
    '',
    `Target: ${reportData.target}.`,
    `Warning line: ${reportData.warningTarget}.`,
    '',
    '## Summary',
    '',
    `- Projected cases: ${reportData.projectedSummary.totalCases}`,
    `- Hard failures: ${reportData.projectedSummary.failedCases}`,
    `- Warnings: ${reportData.projectedSummary.warningCases}`,
    `- Max typical cost: ${reportData.projectedSummary.maxTypicalCostCents} cents`,
    `- Max worst-case capped cost: ${reportData.projectedSummary.maxWorstCaseCostCents} cents`,
    '',
    '## Recommended Production Env',
    '',
    '```sh',
    ...Object.entries(reportData.recommendedProductionEnv).map(([key, value]) => `${key}=${value}`),
    '```',
    '',
    '## Projected Costs',
    '',
    '| Case | Model | Input tokens | Typical cents | Worst-case cents | Budget | Status |',
    '|---|---:|---:|---:|---:|---:|---|',
    ...reportData.projected.map((item) => [
      item.name,
      item.model,
      item.inputTokens,
      item.typicalCostCents,
      item.worstCaseCostCents,
      item.budgetCents ?? 'overhead',
      item.budgetStatus,
    ].join(' | ')).map((row) => `| ${row} |`),
    '',
    '## Provider Risk Matrix',
    '',
    'These rows show what would happen if the same prompts were routed through other providers/models.',
    '',
  ];

  for (const [caseName, rows] of Object.entries(reportData.providerMatrix)) {
    lines.push(`### ${caseName}`, '');
    lines.push('| Scenario | Model | Typical cents | Worst-case cents | Status |');
    lines.push('|---|---:|---:|---:|---|');
    rows.forEach((row) => {
      lines.push(`| ${row.label} | ${row.model} | ${row.typicalCostCents} | ${row.worstCaseCostCents} | ${row.budgetStatus} |`);
    });
    lines.push('');
  }

  if (reportData.live) {
    lines.push('## Live Results', '');
    if (reportData.live.error) {
      lines.push(`Live audit unavailable: ${reportData.live.error}`, '');
      if (reportData.live.hint) lines.push(reportData.live.hint, '');
    } else if (reportData.live.blocked) {
      lines.push(`Live audit blocked for safety: ${reportData.live.reason}`, '');
      lines.push('Required server posture:', '');
      lines.push('```json');
      lines.push(JSON.stringify(reportData.live.required, null, 2));
      lines.push('```', '');
      lines.push(reportData.live.override, '');
    } else {
      lines.push('| Case | Status | OK | Elapsed ms | Error |');
      lines.push('|---|---:|---|---:|---|');
      reportData.live.results.forEach((row) => {
        lines.push(`| ${row.name} | ${row.status} | ${row.ok ? 'yes' : 'no'} | ${row.elapsedMs} | ${row.error ?? ''} |`);
      });
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}
