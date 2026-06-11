import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT ?? 8787);
const AI_PROVIDER = process.env.AI_PROVIDER;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-nano';
const OPENAI_DAILY_PLAN_MODEL = process.env.OPENAI_DAILY_PLAN_MODEL ?? OPENAI_MODEL;
const OPENAI_CONTENT_MODEL = process.env.OPENAI_CONTENT_MODEL ?? OPENAI_MODEL;
const OPENAI_REVIEW_MODEL = process.env.OPENAI_REVIEW_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
const OPENAI_ELITE_REVIEW_MODEL = process.env.OPENAI_ELITE_REVIEW_MODEL ?? OPENAI_REVIEW_MODEL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
const AI_MAX_COST_CENTS_PER_CREDIT = Number(process.env.AI_MAX_COST_CENTS_PER_CREDIT ?? 1);
const AI_ENFORCE_COST_CAP = process.env.AI_ENFORCE_COST_CAP !== '0';
const AI_COST_SAFETY_MULTIPLIER = Number(process.env.AI_COST_SAFETY_MULTIPLIER ?? 1.25);
const EXPOSE_AI_COSTS = process.env.EXPOSE_AI_COSTS === '1';
const FEEDBACK_LOG_PATH = process.env.KIBBO_FEEDBACK_LOG_PATH ?? path.resolve('data/feedback-submissions.jsonl');
const AI_USAGE_LOG_PATH = process.env.KIBBO_AI_USAGE_LOG_PATH ?? path.resolve('data/ai-usage.jsonl');
const MODEL_PRICES_USD_PER_1M = {
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
};
const TASK_CONFIGS = {
  dailyPlan: {
    creditCost: 0,
    maxOutputTokens: Number(process.env.AI_DAILY_PLAN_MAX_OUTPUT_TOKENS ?? 900),
    openAIModel: OPENAI_DAILY_PLAN_MODEL,
  },
  content: {
    creditCost: 1,
    maxOutputTokens: Number(process.env.AI_CONTENT_MAX_OUTPUT_TOKENS ?? 2600),
    openAIModel: OPENAI_CONTENT_MODEL,
  },
  speakingReview: {
    creditCost: 1,
    maxOutputTokens: Number(process.env.AI_SPEAKING_REVIEW_MAX_OUTPUT_TOKENS ?? 900),
    openAIModel: OPENAI_REVIEW_MODEL,
  },
  apReview: {
    creditCost: 1,
    maxOutputTokens: Number(process.env.AI_AP_REVIEW_MAX_OUTPUT_TOKENS ?? 1600),
    openAIModel: OPENAI_REVIEW_MODEL,
  },
  eliteReview: {
    creditCost: 1,
    maxOutputTokens: Number(process.env.AI_ELITE_REVIEW_MAX_OUTPUT_TOKENS ?? 1800),
    openAIModel: OPENAI_ELITE_REVIEW_MODEL,
  },
};
const ANTHROPIC_FALLBACK_MODELS = [
  ANTHROPIC_MODEL,
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514',
  'claude-3-haiku-20240307',
  'claude-3-5-sonnet-20241022',
].filter((model, index, models) => model && models.indexOf(model) === index);
const anthropicModelCache = { models: null, fetchedAt: 0 };
const AP_RUBRICS = ['Task completion', 'Delivery', 'Language use', 'Cultural knowledge'];

function activeProvider() {
  if (AI_PROVIDER === 'openai' || AI_PROVIDER === 'gemini' || AI_PROVIDER === 'anthropic') {
    return AI_PROVIDER;
  }
  if (OPENAI_API_KEY) return 'openai';
  if (GEMINI_API_KEY) return 'gemini';
  if (ANTHROPIC_API_KEY) return 'anthropic';
  return 'openai';
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text ?? '').length / 4));
}

function normalizeDailyPlanRubric(value, preferredRubric) {
  if (AP_RUBRICS.includes(value)) return value;
  const text = String(value ?? '').toLowerCase();
  if (preferredRubric && AP_RUBRICS.includes(preferredRubric) && text.includes(preferredRubric.toLowerCase())) {
    return preferredRubric;
  }
  return AP_RUBRICS.find((rubric) => text.includes(rubric.toLowerCase())) ?? 'Task completion';
}

function normalizeDailyPlanResult(body, payload) {
  if (!body || !Array.isArray(body.actions)) return body;
  const preferredRubric = payload?.profile?.weakestRubric;
  return {
    ...body,
    actions: body.actions.map((action) => sanitizeDailyPlanAction({
      ...action,
      rubric: normalizeDailyPlanRubric(action?.rubric, preferredRubric),
    }, payload)),
  };
}

function sanitizeDailyPlanAction(action, payload) {
  if (!action || typeof action !== 'object') return action;
  const recentText = noveltyTextForPayload(payload);
  const actionText = textFromValue(action);
  const recentLateBring = /(late|遅れ|遅刻).{0,140}(bring|what to bring|持ち|持って)|(bring|what to bring|持ち|持って).{0,140}(late|遅れ|遅刻)/i.test(recentText);
  const actionLateBring = /(late|遅れ|遅刻).{0,140}(bring|what to bring|持ち|持って)|(bring|what to bring|持ち|持って).{0,140}(late|遅れ|遅刻)/i.test(actionText);
  if (recentLateBring && actionLateBring) {
    return {
      ...action,
      mode: action.mode === 'conversation' ? 'conversation' : 'texting',
      title: 'Peer plan check',
      task: 'Reply to a classmate about choosing a practice place and confirming one useful next step.',
      why: 'Repairs casual register and task completion without repeating the late-arrival or what-to-bring frame.',
      targetSkills: ['casual register', 'useful follow-up', 'task completion'],
    };
  }

  const recentScheduleChange = /(club|部活|クラブ|meeting|notice|schedule|予定|変更).{0,160}(change|changed|schedule|reason|理由|予定|変更|変わ|変える)|(change|changed|schedule|reason|理由|予定|変更|変わ|変える).{0,160}(club|部活|クラブ|meeting|notice|schedule|予定|変更)/i.test(recentText);
  const actionScheduleChange = /(notice|announcement|bulletin|school|exam|meeting|location|schedule|予定|変更).{0,180}(change|changed|reason|why|because|理由|変更|変わ|変える)|(change|changed|reason|why|because|理由|変更|変わ|変える).{0,180}(notice|announcement|bulletin|school|exam|meeting|location|schedule|予定|変更)/i.test(actionText);
  if (recentScheduleChange && actionScheduleChange) {
    return {
      ...action,
      mode: 'reading',
      title: 'Notice detail trap',
      task: 'Read a school bulletin about eligibility or a required step and identify the exact detail.',
      why: 'Repairs evidence-finding without repeating the club schedule-change frame.',
      targetSkills: ['supporting detail', 'eligibility', 'required step'],
    };
  }

  return action;
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && typeof item.content === 'string') return item.content.trim();
      if (item && typeof item === 'object' && typeof item.text === 'string') return item.text.trim();
      return '';
    })
    .filter(Boolean);
}

function normalizeKeywordGroups(value, length) {
  if (!Array.isArray(value)) return Array.from({ length }, () => []);
  const groups = value.map((group) => {
    if (!Array.isArray(group)) return [];
    return group.filter((keyword) => typeof keyword === 'string' && keyword.trim()).map((keyword) => keyword.trim());
  });
  while (groups.length < length) groups.push([]);
  return groups.slice(0, length);
}

function normalizeGeneratedContentResult(body, payload) {
  if (!body || !Array.isArray(body.items)) return body;
  const requestedCount = Number.isFinite(Number(payload?.count))
    ? Math.max(1, Math.min(12, Math.round(Number(payload.count))))
    : null;
  const rawItems = requestedCount ? body.items.slice(0, requestedCount) : body.items;
  if (payload?.mode !== 'conversation' && payload?.mode !== 'texting') {
    return { ...body, items: rawItems };
  }

  return {
    ...body,
    items: rawItems
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const prompts = asStringList(item.prompts).slice(0, 4);
        const modelAnswers = asStringList(item.modelAnswers).slice(0, 4);
        if (prompts.length !== 4 || modelAnswers.length !== 4) return null;
        return {
          ...item,
          mode: payload.mode,
          languageCode: 'ja',
          prompts,
          suggestedKeywords: normalizeKeywordGroups(item.suggestedKeywords, prompts.length),
          modelAnswers,
        };
      })
      .filter(Boolean),
  };
}

function noveltyTextForPayload(payload) {
  const profile = payload?.profile && typeof payload.profile === 'object' ? payload.profile : {};
  return textFromValue({
    recentPromptIds: payload?.recentPromptIds,
    profileRecentPromptIds: profile.recentPromptIds,
    doNotRepeatIds: profile.doNotRepeatIds,
    generatedPromptSummaries: profile.generatedPromptSummaries,
    recentMistakes: profile.recentMistakes,
    weakMemory: profile.weakMemory,
    personalizationRules: profile.personalizationRules,
  });
}

function generatedContentNoveltyIssues(body, payload) {
  const recentText = noveltyTextForPayload(payload);
  const outputText = textFromValue(body);
  const issues = [];

  if (!recentText || !outputText) return issues;

  const recentLateBring = /(late|遅れ|遅刻).{0,140}(bring|what to bring|持ち|持って)|(bring|what to bring|持ち|持って).{0,140}(late|遅れ|遅刻)/i.test(recentText);
  const outputLateBring = /(late|遅れ|遅刻).{0,140}(bring|what to bring|持ち|持って)|(bring|what to bring|持ち|持って).{0,140}(late|遅れ|遅刻)/i.test(outputText);
  if (recentLateBring && outputLateBring) {
    issues.push('Repeated recent late-arrival plus what-to-bring task frame.');
  }
  const outputLateOrBringSurface = /(late|late arrival|apology timing|遅れ|遅刻|遅い|bring|what to bring|持って|持ち物|持っていく)/i.test(outputText);
  if (recentLateBring && outputLateOrBringSurface) {
    issues.push('Repeated a blocked late-arrival or what-to-bring surface element.');
  }

  const recentClubChange = /(club|部活|クラブ).{0,120}(change|changed|schedule|予定|変更|変わ|変える)/i.test(recentText);
  const outputClubChange = /(club|部活|クラブ).{0,120}(change|changed|schedule|予定|変更|変わ|変える)/i.test(outputText);
  if (recentClubChange && outputClubChange) {
    issues.push('Repeated recent club/schedule-change reading frame.');
  }

  const staleFamilies = [
    {
      label: 'train/platform delay',
      recent: /(train|platform|station|電車|駅|ホーム).{0,120}(delay|delayed|change|遅れ|遅延|変更|変わ)/i,
      output: /(train|platform|station|電車|駅|ホーム).{0,120}(delay|delayed|change|遅れ|遅延|変更|変わ)/i,
    },
    {
      label: 'cafe flyer',
      recent: /(cafe|coffee|flyer|カフェ|喫茶|ちらし).{0,120}(time|fee|cost|event|時間|料金|イベント)/i,
      output: /(cafe|coffee|flyer|カフェ|喫茶|ちらし).{0,120}(time|fee|cost|event|時間|料金|イベント)/i,
    },
    {
      label: 'store price/payment',
      recent: /(store|shop|price|payment|cashier|receipt|ポイント|店|値段|料金|会計|レジ).{0,120}(cost|pay|price|discount|いくら|払|支払|割引)/i,
      output: /(store|shop|price|payment|cashier|receipt|ポイント|店|値段|料金|会計|レジ).{0,120}(cost|pay|price|discount|いくら|払|支払|割引)/i,
    },
  ];
  for (const family of staleFamilies) {
    if (family.recent.test(recentText) && family.output.test(outputText)) {
      issues.push(`Repeated recent ${family.label} template family.`);
    }
  }

  return issues;
}

function contentRetryPayload(payload, noveltyIssues) {
  const targetSkills = Array.isArray(payload?.targetSkills) ? payload.targetSkills : [];
  return {
    ...payload,
    targetSkills: [
      ...targetSkills,
      'NOVELTY RETRY: the previous generation was rejected because it repeated recent task structure.',
      `Rejected novelty issue(s): ${noveltyIssues.join(' | ')}`,
      'Generate the same weak-skill repair through a clearly different situation, source type, speech act, answer logic, nouns, and requested object.',
      'Do not use schedule-change, late-arrival, what-to-bring, train/platform, cafe flyer, or store-price/payment logic unless the profile has no adjacent recent history.',
      'If the rejected issue mentions late-arrival plus what-to-bring, the retry must not contain late/遅れ/遅刻/遅い or bring/持って/持ち物/what to bring anywhere in title, situation, prompts, modelAnswers, questions, choices, or qualityNotes.',
    ],
  };
}

function contentSchemaIssue(body, payload) {
  if (
    (payload?.mode === 'conversation' || payload?.mode === 'texting')
    && (!Array.isArray(body?.items) || body.items.length === 0)
  ) {
    return 'Generated AP prompt sets did not match the app schema.';
  }
  return null;
}

async function generateContentWithOneNoveltyRetry(payload) {
  const first = await completeJson(contentGenerationPrompt(payload), 'content');
  if (first.status !== 200) return first;

  first.body = normalizeGeneratedContentResult(first.body, payload);
  const firstSchemaIssue = contentSchemaIssue(first.body, payload);
  if (firstSchemaIssue) {
    return {
      ok: false,
      status: 502,
      body: {
        error: firstSchemaIssue,
        code: 'AI_CONTENT_SCHEMA',
        _usage: first.body?._usage,
      },
    };
  }

  const noveltyIssues = generatedContentNoveltyIssues(first.body, payload);
  if (noveltyIssues.length === 0) return first;

  const retryPayload = contentRetryPayload(payload, noveltyIssues);
  const retry = await completeJson(contentGenerationPrompt(retryPayload), 'content');
  if (retry.status !== 200) {
    return {
      ...retry,
      body: {
        ...(retry.body && typeof retry.body === 'object' ? retry.body : {}),
        retryReason: 'AI_CONTENT_REPEAT',
        noveltyIssues,
        _firstUsage: first.body?._usage,
      },
    };
  }

  retry.body = normalizeGeneratedContentResult(retry.body, payload);
  const retrySchemaIssue = contentSchemaIssue(retry.body, payload);
  if (retrySchemaIssue) {
    return {
      ok: false,
      status: 502,
      body: {
        error: retrySchemaIssue,
        code: 'AI_CONTENT_SCHEMA',
        retryReason: 'AI_CONTENT_REPEAT',
        noveltyIssues,
        _usage: retry.body?._usage,
        _firstUsage: first.body?._usage,
      },
    };
  }

  const retryNoveltyIssues = generatedContentNoveltyIssues(retry.body, payload);
  if (retryNoveltyIssues.length > 0) {
    return {
      ok: false,
      status: 502,
      body: {
        error: 'Generated content repeated a recent prompt pattern after one retry.',
        code: 'AI_CONTENT_REPEAT',
        noveltyIssues: retryNoveltyIssues,
        firstNoveltyIssues: noveltyIssues,
        _usage: retry.body?._usage,
        _firstUsage: first.body?._usage,
      },
    };
  }

  retry.body = {
    ...retry.body,
    _qualityRetry: {
      reason: 'AI_CONTENT_REPEAT',
      firstNoveltyIssues: noveltyIssues,
      firstUsage: first.body?._usage,
    },
  };
  return retry;
}

function tokenUsageFromOpenAI(json, prompt) {
  const usage = json?.usage ?? {};
  return {
    inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? estimateTokens(prompt),
    outputTokens: usage.output_tokens ?? usage.completion_tokens ?? estimateTokens(extractOutputText(json)),
  };
}

function tokenUsageFromGemini(json, prompt) {
  const usage = json?.usageMetadata ?? {};
  return {
    inputTokens: usage.promptTokenCount ?? estimateTokens(prompt),
    outputTokens: usage.candidatesTokenCount ?? estimateTokens(extractGeminiOutputText(json)),
  };
}

function tokenUsageFromAnthropic(json, prompt) {
  const usage = json?.usage ?? {};
  return {
    inputTokens: usage.input_tokens ?? estimateTokens(prompt),
    outputTokens: usage.output_tokens ?? estimateTokens(extractAnthropicOutputText(json)),
  };
}

function estimateCostCents(provider, model, inputTokens, outputTokens) {
  const prices = MODEL_PRICES_USD_PER_1M[model]
    ?? (provider === 'anthropic'
      ? MODEL_PRICES_USD_PER_1M['claude-haiku-4-5-20251001']
      : provider === 'gemini'
        ? MODEL_PRICES_USD_PER_1M['gemini-2.5-flash']
        : MODEL_PRICES_USD_PER_1M['gpt-4.1-nano']);
  return ((inputTokens * prices.input + outputTokens * prices.output) / 1000000) * 100 * AI_COST_SAFETY_MULTIPLIER;
}

function budgetCentsFor(config) {
  return Math.max(0.05, Math.max(config.creditCost, 1) * AI_MAX_COST_CENTS_PER_CREDIT);
}

function logAIUsage({ task, provider, model, prompt, inputTokens, outputTokens, creditCost, status = 'ok' }) {
  const estimatedCostCents = estimateCostCents(provider, model, inputTokens, outputTokens);
  const budgetCents = budgetCentsFor({ creditCost });
  const entry = {
    event: 'ai_cost',
    task,
    provider,
    model,
    inputTokens,
    outputTokens,
    estimatedCostCents: Number(estimatedCostCents.toFixed(4)),
    budgetCents: Number(budgetCents.toFixed(4)),
    creditCost,
    status,
    promptChars: String(prompt ?? '').length,
  };
  console.log(JSON.stringify(entry));
  void fs.mkdir(path.dirname(AI_USAGE_LOG_PATH), { recursive: true })
    .then(() => fs.appendFile(AI_USAGE_LOG_PATH, `${JSON.stringify({ ...entry, createdAt: new Date().toISOString() })}\n`))
    .catch(() => {});
  return entry;
}

function withUsageMetadata(body, usage) {
  if (!EXPOSE_AI_COSTS || !body || typeof body !== 'object') return body;
  return { ...body, _usage: usage };
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS, GET',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function feedbackLevelFor(payload) {
  return payload?.feedbackLevel === 'elite' ? 'elite' : 'standard';
}

function stringField(value, maxLength = 1200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeFirstCompletionFeedback(payload) {
  const source = payload?.feedback && typeof payload.feedback === 'object'
    ? payload.feedback
    : payload;
  const rating = Math.max(1, Math.min(5, Math.round(Number(source?.rating ?? 0))));
  if (!Number.isFinite(rating) || rating < 1) {
    const error = new Error('Feedback rating must be between 1 and 5.');
    error.status = 400;
    throw error;
  }
  const now = new Date().toISOString();
  const id = `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    event: 'first_completion_feedback',
    receivedAt: now,
    firstSessionId: stringField(source?.firstSessionId, 120),
    firstSessionType: stringField(source?.firstSessionType, 40),
    rating,
    comment: stringField(source?.comment, 1200),
    createdAt: Number.isFinite(Number(source?.createdAt)) ? Number(source.createdAt) : null,
    updatedAt: Number.isFinite(Number(source?.updatedAt)) ? Number(source.updatedAt) : null,
    client: {
      source: stringField(payload?.source, 80) || 'kibbo-app',
      appVersion: stringField(payload?.appVersion, 80),
      platform: stringField(payload?.platform, 80),
    },
  };
}

async function recordFirstCompletionFeedback(payload) {
  const entry = sanitizeFirstCompletionFeedback(payload);
  console.log(JSON.stringify({
    event: 'app_feedback',
    feedbackEvent: entry.event,
    id: entry.id,
    rating: entry.rating,
    firstSessionType: entry.firstSessionType,
    hasComment: entry.comment.length > 0,
  }));
  try {
    await fs.mkdir(path.dirname(FEEDBACK_LOG_PATH), { recursive: true });
    await fs.appendFile(FEEDBACK_LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'app_feedback_log_failed',
      id: entry.id,
      path: FEEDBACK_LOG_PATH,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
  return entry;
}

function feedbackLevelRules(payload, taskKind) {
  const level = feedbackLevelFor(payload);
  const standardRules = [
    'Feedback tier: Standard.',
    'Be a clear AP Japanese coach: explain whether the answer completes the task, what one grammar/meaning issue matters most, and exactly what to try next.',
    'Give usable model phrasing when helpful, but do not overwhelm the learner with advanced nuance.',
    'Prioritize AP communicative success: task completion, comprehensibility, appropriate register, and enough detail.',
  ];

  if (level !== 'elite') return standardRules;

  const eliteBase = [
    'Feedback tier: Elite.',
    'Do everything in Standard, then add native-sounding coaching when it helps: register choice, omitted subjects, compact phrasing, softer refusals/requests, sentence-final tone, and whether the answer sounds translated.',
    'Treat textbook-correct Japanese and native-sounding Japanese as different layers. Do not mark naturalness down unless the answer is understandable enough to judge.',
    'Prefer concrete replacements over vague advice: give one upgraded phrase that sounds more natural for this exact situation.',
    'Use native naturalness sparingly and accurately. Do not add slang, dialect, gendered stereotypes, anime phrasing, or excessive fillers.',
    'For everyday Japanese, consider softeners like ちょっと, 〜んですが, できれば, sentence endings like ね/よ when appropriate, and dropping obvious subjects. For formal situations, keep です/ます and avoid casual over-correction.',
    'For friend/classmate/club-peer contexts, coach toward modern natural casual Japanese, not textbook plain-form only. Useful patterns include 〜んだけど, 〜なんだけど, 〜かな, 〜かも, 〜じゃない？, 〜てくれる？, 〜しようか, 〜っぽい, だよね, and compact sentence-final softness when the relationship supports it.',
    'Do not force teen slang into every sentence. Use younger-speaker casual phrasing only when it improves authenticity for the exact relationship and situation.',
  ];

  if (taskKind === 'conversation') {
    return [
      ...eliteBase,
      'Conversation-specific Elite lens: judge whether the reply keeps the exchange alive, matches distance with the speaker, and uses natural short spoken rhythm.',
      'Mention aizuchi or response timing only when the prompt is an interaction where a short acknowledgment such as はい、そうですね or うん makes the answer more natural.',
    ];
  }

  if (taskKind === 'texting') {
    return [
      ...eliteBase,
      'Text-chat-specific Elite lens: judge whether the written reply sounds like a real message, not a translated essay. Short, polite, direct messages can be excellent.',
      'When useful, suggest a cleaner message-style version with natural particles, softer wording, or better order of information.',
    ];
  }

  return [
    ...eliteBase,
    'Speaking-specific Elite lens: judge whether the spoken sentence would sound natural aloud, including rhythm, sentence ending, politeness distance, and whether the learner over-translated the English prompt.',
  ];
}

function spokenJapaneseNaturalnessGuidance() {
  return [
    'Research-informed spoken Japanese naturalness: Japanese conversation often uses short listener responses and supportive backchannels more than English. Use this to improve authenticity, not to make every answer longer.',
    'For casual friend/classmate/club-peer conversation, natural examples may include a short acknowledgment before the main answer: うん、そうだね, あー、なるほどね, たしかに, そうそう, へー, えっと, うーん.',
    'Use backchannels only when they keep the turn alive or soften the reply. Do not let them replace task completion; AP answers still need the requested information, reason, action, or question.',
    'For casual peer speech, natural continuation endings include 〜んだけど, 〜なんだよね, 〜みたい, 〜らしい, 〜って, 〜じゃない？, 〜かな, and 〜かも when they match the speaker intent.',
    'For polite adult/staff/teacher contexts, use softer polite listener responses such as あ、そうなんですね, なるほど, そうですね before the main answer when natural, not teen-style casual phrasing.',
  ];
}

function casualYouthJapaneseGuidance() {
  return [
    'Casual/youth Japanese guidance for peer contexts only: when the speaker is a friend, classmate, club peer, sibling, or close same-age person, it is okay to use light contemporary casual phrasing if it sounds natural and still completes the AP task.',
    'Safe peer-casual options include: まじで/マジで, それな, わかる, たしかに, りょ/了解, おけ/オッケー, めっちゃ, ちょっと, やばい, 普通に, いい感じ, びみょう, だるい, やっぱ, とりあえず/とりま, あり/なし, 〜っぽい, 〜じゃん, 〜よね, and a light 笑 in texting when appropriate.',
    'Use slang as seasoning, not the meal. A strong AP response still needs the requested action, reason, detail, or question. Do not replace task completion with それな, やばい, or one-word reactions.',
    'Avoid profanity, insults, sexual slang, rude second-person forms, discriminatory language, heavy internet slang, dialect, anime catchphrases, or anything that would sound unserious in AP Japanese.',
    'If the prompt is to a teacher, staff member, host family adult, stranger, store/service worker, or formal school setting, do not use youth slang. Explain the register mismatch if the learner uses it there.',
    'When reviewing, distinguish "textbook but correct" from "native peer-like." Suggest one natural peer upgrade only when the context supports it, e.g. りょ、放課後なら手伝えるよ, まじ助かる、ありがとね, それな、もう少し直した方がよさそう, or ちょっとだけ練習したいんだけど、今日時間ある？.',
    'In Elite review for clearly casual peer text/chat tasks, include one optional light peer-casual upgrade when the learner profile, target skills, or prompt situation asks for native peer tone. Examples: りょ、放課後なら手伝えるよ, まじ助かる、ありがとね, それな、もう少し直した方がよさそう, おけ、買い出し行けるよ. Do not add slang if the prompt is formal.',
  ];
}

function gradingPrompt(payload) {
  const mode = payload?.set?.mode;
  const modeRules = mode === 'conversation'
    ? [
      'Practice type: AP Japanese Conversation, a spoken interpersonal task.',
      'Primary job: grade whether the learner responded naturally and successfully to each spoken turn.',
      'Use this evidence: task completion, conversational responsiveness, comprehensibility, grammar control, register/politeness for the situation, and whether the answer could keep the conversation moving.',
      'Speech recognition transcripts may be imperfect. If the transcript is strange or fragmented, grade the usable communicative intent and mention possible capture issues instead of inventing specific grammar errors.',
      'Hard ban: never mention commas, periods, punctuation, spelling, written formatting, separators, run-ons, or that an answer "reads" a certain way. This is spoken conversation practice.',
      'Hard ban: do not penalize punctuation differences between modelAnswer and answer, and do not infer pauses or clause boundaries from transcript punctuation.',
      'A strong answer can be short. Do not require extra detail unless the prompt asks for it.',
      'If politeness matters, explicitly say whether this situation calls for polite or casual Japanese.',
    ]
    : [
      'Practice type: AP Japanese Text Chat, a written interpersonal task.',
      'Primary job: grade whether the learner wrote a clear, appropriate reply to each chat message.',
      'Use this evidence: task completion, comprehensibility, grammar control, register/politeness for the relationship, specificity, natural written phrasing, and message clarity.',
      'Register rule: for friends, classmates, party invitations, club friends, or other clearly informal/casual relationships, do NOT tell the learner to use です/ます for clarity. Prefer natural casual Japanese such as 行く, だ, 〜ね, 〜よ, ごめん, いいよ, 〜んだけど, 〜かな, 〜かも, 〜しようか, etc., when it fits.',
      'For classmate-to-classmate chat, if a suggested upgrade sounds like a classroom sentence, make it warmer and more message-like. For example, prefer ちょっとだけ練習したいんだけど。 over ちょっとだけ練習したい。 when the speaker is opening a soft request or hinting at wanting help.',
      'Register rule: reserve です/ます, ください, お願いします, and more formal wording for teachers, staff, host families, store/service situations, requests to adults, or explicitly formal contexts.',
      'If the learner already used a complete sentence but the reply is weak, do not say "use complete sentences." Say the real issue: it is too thin, generic, missing a reason/time/action, or not useful enough for the chat.',
      'You may mention punctuation only if it genuinely affects meaning or readability. Do not make punctuation the main feedback unless it is the main problem.',
      'Hard ban: do not grade pronunciation, audio quality, pauses, accent, or speech-recognition capture. This is written text chat practice.',
      'If the answer is understandable but brief, grade the communication fairly and suggest one concrete way to add detail.',
    ];
  return [
    'You are an AP Japanese rubric coach inside a language-learning app.',
    'You grade completed practice sessions. You do not generate new prompts.',
    ...feedbackLevelRules(payload, mode === 'conversation' ? 'conversation' : 'texting'),
    ...spokenJapaneseNaturalnessGuidance(),
    ...casualYouthJapaneseGuidance(),
    'Use AP-style 1-5 scoring, but explain it in simple student-friendly language.',
    'Score anchor:',
    '5 = clearly completes the task, natural and appropriate, minor errors only.',
    '4 = completes the task well, understandable, some grammar or naturalness issues.',
    '3 = partially completes the task, meaning is mostly recoverable but limited or error-prone.',
    '2 = weak communication, major missing information or frequent errors.',
    '1 = very little usable Japanese or does not answer the prompt.',
    ...modeRules,
    'Model answers are examples of one possible AP 5-level response. They are not the grading key.',
    'Do not compare the learner answer against the model answer for exact wording, vocabulary overlap, or content match.',
    'A different answer can receive a 5 if it answers the prompt clearly and appropriately.',
    'Do not reward hallucinated complexity. Simple correct Japanese should score well when it fits the prompt.',
    'Do not invent mistakes. Flag grammar errors only when the answer gives enough evidence.',
    'Use "level" rather than "score" in improvement phrasing, for example "to reach the next level".',
    'Improvements must be concrete and situational. If you mention polite forms like です or ます, say whether this exact prompt calls for them. Never frame です/ます as a universal way to make casual text-chat replies clearer.',
    'When a casual reply sounds too stiff, suggest one upgraded phrase that combines message warmth with task completion, for example a short backchannel plus a natural continuation, not just isolated grammar advice.',
    'Elite casual peer-review requirement: if this is an informal classmate/friend/club-peer text chat, at least one top-level improvement or turn-level improvement must include one light peer-casual option from this set when appropriate: りょ, おけ, まじ, めっちゃ, それな, わかる, いい感じ, やばい, 笑. Keep it optional and tasteful, but include one concrete example so the learner learns the register.',
    'Keep weakSkills short labels, not paragraphs.',
    'Return only JSON with this shape:',
    '{"score":1-5,"label":"string","summary":"string","weakSkills":["string"],"improvements":["string"],"turns":[{"prompt":"string","answer":"string","modelAnswer":"string","score":1-5,"reason":"string","improvements":["string"],"weakSkills":["string"]}]}',
    'Keep summary to one sentence. Keep improvements to exactly two short bullets when score is below 5, and zero or one when score is 5.',
    '',
    JSON.stringify(payload),
  ].join('\n');
}

const PEER_CASUAL_PATTERN = /classmate|friend|club peer|peer|casual|クラスメート|友だち|友達|友人|同級生|部活|クラブ/i;
const FORMAL_CONTEXT_PATTERN = /teacher|staff|host family|host mother|host father|adult|stranger|store|service|先生|店員|スタッフ|ホストファミリー|大人|知らない人/i;
const PEER_SLANG_PATTERN = /まじ|マジ|それな|わかる|りょ|了解|おけ|オッケー|めっちゃ|やばい|普通に|いい感じ|びみょう|だるい|やっぱ|とりま|じゃん|笑/;

function textFromValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textFromValue).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(textFromValue).join(' ');
  return '';
}

function isCasualPeerReview(payload) {
  const setText = textFromValue(payload?.set);
  return PEER_CASUAL_PATTERN.test(setText) && !FORMAL_CONTEXT_PATTERN.test(setText);
}

function peerCasualExampleForTurn(turn) {
  const text = textFromValue(turn);
  if (/手伝|help/i.test(text)) return 'りょ、放課後なら手伝えるよ。';
  if (/買い出し|買|shopping/i.test(text)) return 'おけ、買い出し行けるよ。何を買えばいい？';
  if (/ポスター|直|poster|fix/i.test(text)) return 'それな、タイトルもう少し大きい方がいいかも。';
  if (/ありが|thank/i.test(text)) return 'まじ助かった、ありがとね。';
  if (/時間|time/i.test(text)) return 'りょ、今日ちょっと時間あるよ。';
  return 'りょ、いい感じだと思うよ。';
}

function applyCasualPeerReviewExamples(body, payload) {
  if (
    feedbackLevelFor(payload) !== 'elite'
    || !body
    || typeof body !== 'object'
    || !isCasualPeerReview(payload)
    || PEER_SLANG_PATTERN.test(textFromValue(body))
  ) {
    return body;
  }

  const turns = Array.isArray(body.turns) ? body.turns : [];
  const example = peerCasualExampleForTurn(turns[0] ?? payload?.set);
  const note = `Optional peer-style version when the vibe is casual: ${example}`;
  const improvements = Array.isArray(body.improvements) ? [...body.improvements] : [];
  if (improvements.length === 0) {
    improvements.push(note);
  } else {
    improvements[improvements.length - 1] = `${improvements[improvements.length - 1]} ${note}`;
  }

  return {
    ...body,
    improvements: improvements.slice(0, 2),
    turns: turns.map((turn, index) => {
      if (index !== 0 || !turn || typeof turn !== 'object') return turn;
      const turnImprovements = Array.isArray(turn.improvements) ? [...turn.improvements] : [];
      const turnExample = peerCasualExampleForTurn(turn);
      if (turnImprovements.length === 0) {
        turnImprovements.push(`Peer-style option: ${turnExample}`);
      } else {
        turnImprovements[0] = `${turnImprovements[0]} Peer-style option: ${turnExample}`;
      }
      return {
        ...turn,
        improvements: turnImprovements,
      };
    }),
  };
}

function stripSpeakingPunctuation(text) {
  return typeof text === 'string'
    ? text.replace(/[。、，,.!?！？;；:：「」『』"“”'’`]/g, ' ').replace(/\s+/g, ' ').trim()
    : text;
}

function sanitizeSpeakingPayload(payload) {
  return {
    ...payload,
    transcript: stripSpeakingPunctuation(payload?.transcript),
    targetAnswer: stripSpeakingPunctuation(payload?.targetAnswer),
    acceptableAnswers: Array.isArray(payload?.acceptableAnswers)
      ? payload.acceptableAnswers.map(stripSpeakingPunctuation)
      : payload?.acceptableAnswers,
  };
}

function speakingReviewPrompt(payload) {
  const spokenPayload = sanitizeSpeakingPayload(payload);
  return [
    'You are the Speaking Drill review agent for an AP Japanese language-learning app.',
    'Practice type: spoken translation drill. The learner sees an English meaning prompt, says Japanese aloud, and receives separate scores.',
    ...feedbackLevelRules(payload, 'speaking'),
    ...spokenJapaneseNaturalnessGuidance(),
    ...casualYouthJapaneseGuidance(),
    'Review the learner transcript as SPOKEN Japanese, never as written Japanese.',
    'Score 0-100 for translationAccuracy, pronunciation, naturalness, and overall.',
    'Translation Accuracy: did the spoken Japanese express the target meaning? Accept natural alternatives. Do not require exact wording.',
    'Pronunciation: estimate clarity from transcript reliability, recognition confidence, and delivery evidence. Do not claim phoneme-level certainty unless real audio evidence is provided.',
    'Naturalness: judge whether the response sounds like a plausible spoken Japanese answer for this meaning and situation.',
    'Prioritize natural word choice, particles, register/politeness distance, sentence ending, and whether the phrase sounds over-translated from English.',
    'For casual friend/classmate spoken prompts, plain form alone may still sound stiff. Prefer natural younger-speaker softeners such as 〜んだけど, 〜かな, 〜かも, 〜しようか, 〜てくれる？, だよね when they fit the intent.',
    'Pronunciation/rhythm can affect naturalness only when the transcript or delivery evidence clearly supports it.',
    'Do not penalize silence before the learner starts speaking; the learner may have hit record before realizing it. Never mention a long initial pause.',
    'Only mention pauses or chunking if the captured answer itself clearly restarts, fragments, or pronounces words in a blocky way after speech begins.',
    'If delivery.naturalnessCap is present, use it as a ceiling only for clear in-answer segmentation/restarts or capture confidence issues, not for firstSpeechDelayMs.',
    'Do not give perfect or near-perfect naturalness unless phrasing, register, and captured pronunciation/rhythm all support it.',
    'If the transcript is empty, tiny, unrelated, or clearly failed capture, score conservatively and say the app may not have captured enough usable speech.',
    'If the learner heard the target answer first, translationAccuracy must not exceed 25 no matter how close the transcript is.',
    'Hard ban: never mention commas, periods, punctuation, spelling, written formatting, separators, run-ons, or that an answer "reads" a certain way.',
    'Hard ban: do not penalize punctuation differences between targetAnswer and transcript, and do not infer pauses or clause boundaries from transcript punctuation.',
    'Do not invent grammar errors. Mention a grammar issue only when the transcript clearly supports it.',
    'Return only JSON with this shape:',
    '{"translationAccuracy":0-100,"pronunciation":0-100,"naturalness":0-100,"overall":0-100,"meaningFeedback":"string","pronunciationFeedback":"string","naturalnessFeedback":"string","coachNotes":["string"]}',
    'Keep each feedback field to one concise sentence. Keep coachNotes to 1-3 short, specific notes.',
    'Overall should reflect meaning first, then pronunciation, then naturalness. A grammatically correct but choppy answer should lose naturalness.',
    '',
    JSON.stringify(spokenPayload),
  ].join('\n');
}

function clampScore(value, fallback = 0) {
  const score = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function applySpeakingDeliveryCaps(body, payload) {
  const cap = payload?.delivery?.naturalnessCap;
  if (!body || typeof body !== 'object' || typeof cap !== 'number' || !Number.isFinite(cap)) {
    return body;
  }

  const naturalness = Math.min(clampScore(body.naturalness, cap), clampScore(cap, 100));
  const translationAccuracy = clampScore(body.translationAccuracy);
  const pronunciation = clampScore(body.pronunciation);
  const overall = Math.round(
    translationAccuracy * 0.45
    + pronunciation * 0.35
    + naturalness * 0.2,
  );
  const notes = Array.isArray(payload?.delivery?.notes) ? payload.delivery.notes.filter((note) => typeof note === 'string') : [];

  return {
    ...body,
    translationAccuracy,
    pronunciation,
    naturalness,
    overall,
    naturalnessFeedback: clampScore(body.naturalness, 0) > naturalness && notes[0]
      ? notes[0]
      : body.naturalnessFeedback,
    coachNotes: [
      ...notes.slice(0, 2),
      ...(Array.isArray(body.coachNotes) ? body.coachNotes : []),
    ].slice(0, 3),
  };
}

function noRepeatGuidance(payload) {
  const profile = payload?.profile && typeof payload.profile === 'object' ? payload.profile : {};
  const signals = [];
  const addSignal = (label, value) => {
    const text = String(value ?? '').trim();
    if (!text) return;
    signals.push(`${label}: ${text.slice(0, 220)}`);
  };

  for (const id of [
    ...(Array.isArray(payload?.recentPromptIds) ? payload.recentPromptIds : []),
    ...(Array.isArray(profile.recentPromptIds) ? profile.recentPromptIds : []),
    ...(Array.isArray(profile.doNotRepeatIds) ? profile.doNotRepeatIds : []),
  ]) {
    addSignal('recent prompt id', id);
  }

  for (const summary of Array.isArray(profile.generatedPromptSummaries) ? profile.generatedPromptSummaries : []) {
    if (!summary || typeof summary !== 'object') continue;
    addSignal(
      'recent generated pattern',
      [
        summary.type,
        summary.id,
        summary.category,
        summary.prompt,
        summary.answerLogic,
        summary.source,
      ].filter(Boolean).join(' | '),
    );
  }

  for (const rule of Array.isArray(profile.personalizationRules) ? profile.personalizationRules : []) {
    addSignal('personalization rule', rule);
  }

  if (signals.length === 0) return [];
  return [
    'Hard novelty constraints:',
    ...signals.slice(0, 16).map((signal) => `- ${signal}`),
    'Never generate a topic family, source genre, answer logic, speech act, requested object, task frame, or surface scenario that is named or implied by those novelty constraints.',
    'A near-duplicate is still forbidden even if the wording, ids, character names, or setting details change. The learner should feel this is a new drill, not the same mistake wearing a new jacket.',
    'Use the same weak skill, but change the situation and communicative job. If recent work asked what to bring, do not ask what to bring again. If recent work asked about being late, do not use late-arrival/apology timing logic again. If recent work used a club-meeting-change notice, do not use another club or schedule-change reason notice.',
    'When repairing casual register after a late-to-classmate or what-to-bring miss, choose a different peer scenario such as borrowing notes, asking for feedback before a presentation, deciding where to practice, checking homework instructions, planning cleanup duty, comparing club roles, or confirming a study time.',
    'When repairing reading detail after a schedule-change miss, choose a different source and answer logic such as eligibility, deadline, location, required step, exception, or consequence. Do not make the correct answer another reason the meeting changed.',
  ];
}

function blockedFrameGuidance(payload) {
  const recentText = noveltyTextForPayload(payload);
  if (!recentText) return [];

  const lines = [];
  const recentLateBring = /(late|遅れ|遅刻).{0,140}(bring|what to bring|持ち|持って)|(bring|what to bring|持ち|持って).{0,140}(late|遅れ|遅刻)/i.test(recentText);
  if (recentLateBring) {
    lines.push(
      'BLOCKED FRAME: Recent work already used late-arrival plus what-to-bring logic.',
      'For this request, do not output late/late arrival/apology timing/遅れ/遅刻/遅い, and do not output bring/what to bring/持って/持ち物/持っていく in title, situation, prompts, modelAnswers, questions, choices, or qualityNotes.',
      'Repair the same casual-register/task-completion weakness through a new communicative job: borrow notes, ask for presentation feedback, choose a practice place, confirm a study time, clarify homework instructions, compare club roles, coordinate cleanup duty, or ask someone to check a draft.',
      'The required learner action must be different from apologizing for lateness and different from asking what object to bring.',
    );
  }

  const recentClubChange = /(club|部活|クラブ).{0,120}(change|changed|schedule|予定|変更|変わ|変える)/i.test(recentText);
  if (recentClubChange) {
    lines.push(
      'BLOCKED FRAME: Recent reading work already used a club/schedule-change reason notice.',
      'For this request, do not output another club meeting change, schedule change, or “why did the meeting change?” reading task.',
      'Repair evidence/detail reading through eligibility, deadlines, required steps, exceptions, location rules, consequences, permission slips, or lost-item procedures.',
    );
  }

  return lines;
}

function contentGenerationPrompt(payload) {
  const schemaRules = payload?.mode === 'listening'
    ? [
      'Return ListeningQuestion objects with exactly: id, transcript, translation, context, question, choices, correctIndex, difficulty, category.',
      'choices must contain exactly 4 English answer choices. correctIndex must point to the only correct choice.',
      'Each choice must be a plain English answer phrase. Do not prefix choices with A), B), C), or D), and do not write the choices in Japanese.',
      'transcript must be natural Japanese appropriate for TTS and AP-style listening.',
      'Design each item as a real listening task, not a vocabulary quiz: a learner should need to understand the audio to answer.',
      'Vary genres across the batch: school announcements, voicemails, club messages, host-family plans, class-trip updates, museum notices, weather delays, lost-item calls, interviews, short dialogues, and radio-style blurbs.',
      'Avoid repeating the same situation, nouns, answer pattern, or question stem. Train platforms, cashier payments, receipts, and point cards are overused; do not use them unless the payload explicitly asks for that exact context.',
      'Every item in a batch must use a distinct setting and answer logic; do not create paraphrased duplicates.',
      'For advanced level, include implied meaning or purpose questions; for beginner, keep the Japanese short but still natural.',
    ]
    : payload?.mode === 'reading'
      ? [
        'Return ReadingPassageSet objects with exactly: id, passage, translation, context, title, questions, difficulty, category.',
        'Each questions item must have id, question, choices, correctIndex.',
        'Each passage should have 2-4 questions, and choices must contain exactly 4 English answer choices.',
        'Harder levels should use longer passages, harder kanji, denser information, and less beginner-style wording or furigana-style support.',
        'Do not include inline furigana, romaji, bracketed readings, or parenthetical pronunciation in the passage. The app handles readings and should only show them for non-AP kanji.',
        'Beginner passages should use shorter sentences and familiar AP/basic kanji. Intermediate and advanced passages should gradually increase kanji density, inference load, and information density based on user level.',
        'Questions must be linked to the same passage and should mix detail, purpose, inference, and context.',
        'Do not reveal the passage translation through the questions or choices.',
        'Vary the text genre: notice, email, flyer, schedule note, classroom message, short article, review, or message thread.',
        'Avoid repeating the same topic family, source type, answer pattern, or surface wording used by recentPromptIds.',
        'Every set in a batch must feel like a different reading source, not another version of the same notice.',
      ]
      : payload?.mode === 'speaking'
        ? [
        'Return SpeakingPrompt objects with exactly: id, english, acceptableAnswers, hint, difficulty.',
        'english is the English prompt the learner translates aloud.',
        'acceptableAnswers must be natural Japanese alternatives, not just one literal translation.',
        'hint should be short and useful, not the full answer.',
        'These are prompts for spoken production, so never make correctness depend on commas, punctuation, kanji choice, or written formatting.',
        'The model answer is only an example of a strong response. Design prompts so multiple natural spoken answers can be correct.',
        'When the relationship is friend/classmate/club peer, acceptableAnswers should include at least one native-sounding casual option with natural sentence-final softness such as 〜んだけど, 〜かな, 〜かも, 〜しようか, or 〜てくれる？ when appropriate.',
        'For casual spoken prompts, acceptableAnswers may include short backchannels or thinking sounds such as うん, あー, えっと, うーん, そうだね before the main answer when that makes the utterance more natural.',
        'For clearly peer-to-peer prompts, acceptableAnswers may include light youth-casual words such as まじで, めっちゃ, りょ, おけ, それな, わかる, いい感じ, or やばい when they fit the intent and do not make the response too flippant.',
        'If targetSkills or personalizationRules explicitly mention light peer slang, youth-casual words, or native peer tone, include exactly one safe peer-casual word or phrase in at least one acceptableAnswer.',
        'Do not make every casual answer slangy. Keep it age-realistic and AP-safe: natural teen/classmate phrasing, no dialect, anime catchphrases, insults, or overly online slang.',
        'Vary function and situation: asking permission, refusing politely, clarifying, inviting, explaining a reason, confirming plans, apologizing, giving preference.',
        'Every prompt must use a fresh context and target speech act; do not paraphrase a recent English prompt.',
        'Use concise prompts that can be answered aloud in one natural sentence or two short clauses.',
        'For higher levels, require more nuance such as reason, politeness, time reference, or natural connective phrasing.',
      ]
        : [
          'Return APPromptSet objects with exactly: id, title, situation, mode, languageCode, prompts, suggestedKeywords, modelAnswers.',
          `Every item.mode must be exactly "${payload?.mode}". Never mix conversation and texting in the same response. languageCode must be ja.`,
          'prompts must be an array of exactly 4 strings, not objects with roles/content.',
          'Each item is one AP prompt set, not a transcript and not separate message objects.',
          'For texting, each prompt string is one chat message or instruction the learner must answer. For conversation, each prompt string is one spoken turn the learner must answer.',
          'Each set must have exactly 4 prompts and exactly 4 modelAnswers.',
          'modelAnswers must be an array of exactly 4 Japanese string examples aligned one-to-one with prompts.',
          'suggestedKeywords must be an array of 4 short string arrays. Use broad communicative hints, not exact answer keys.',
          'For conversation, prompts are spoken AP turns. Keep them natural for TTS and answerable in about 20 seconds.',
          'For texting, prompts are written chat messages. Keep them natural and answerable in timed AP message style.',
          'Model answers are examples of strong responses, not the only acceptable answers.',
          'For friends, classmates, club peers, and other informal relationships, modelAnswers should sound like real peer messages or spoken turns: compact, warm, and naturally casual. Include patterns like 〜んだけど, 〜かな, 〜かも, 〜しようか, 〜てくれる？, だよね when they match the task.',
          'For spoken conversation mode, include natural Japanese turn-taking cues when appropriate: a brief backchannel, acknowledgment, or thinking marker before the actual answer. Keep it concise so the learner can respond in about 20 seconds.',
          'For texting mode with peer relationships, modelAnswers can include light casual/youth words such as りょ, おけ, まじ, めっちゃ, それな, わかる, やばい, いい感じ, or a light 笑 when it improves authenticity. Use at most one or two per answer; do not make every answer slang-heavy.',
          'If targetSkills or personalizationRules explicitly mention light peer slang, youth-casual words, or native peer tone, include exactly one safe peer-casual word or phrase in at least one modelAnswer.',
          'For teachers, staff, host families, service workers, or formal school contexts, keep modelAnswers polite and do not over-casualize.',
          'Vary situation, relationship, register demands, and answer logic. Avoid recent or saved prompt patterns from the profile.',
      ];
  return [
    'You are the AP Japanese practice-content generator for a mobile app.',
    'Your job is to create fresh, exam-shaped Japanese practice prompts, not to grade answers.',
    'Only generate Japanese practice for AP Japanese learners.',
    'Generate content matching the requested mode, level, difficulty, personalization profile, and recently seen topics. Level must visibly affect length, kanji density, inference load, and politeness nuance.',
    'Level scaling is mandatory: early learners should start approachable, but if targetSkills includes challenge calibration or an effective generation level above the displayed level, respect that fast-track signal and make the work visibly more challenging. Personalization targets the weak skill, but it must never exceed the requested difficulty.',
    'Avoid churn from boring beginner work: even beginner-safe content should include a small satisfying stretch, and strong recent performance should produce sharper prompts within the requested difficulty.',
    'This content may be used immediately as the learner’s primary drill. Make it complete, coherent, fresh, and ready for the app.',
    'Use natural Japanese and AP-like task design. Avoid copyrighted exam text.',
    'Quality bar: the content must feel like a teacher-made AP drill with realistic context, clear answerability, and no repeated filler topics.',
    'Use the personalization profile as the source of truth: weakMemory, weakestRubric, recentMistakes, recentAnswerPatterns, generatedPromptSummaries, todayWork, savedWeakSpots, and do-not-repeat ids must shape the content.',
    'weakMemory is the strongest recurring-weakness signal. Repair its topic/vocab/rubric patterns without repeating the same prompt scenario.',
    'Recent mistakes should determine what skill is repaired; generatedPromptSummaries and recentPromptIds should determine what topics, source types, answer logic, and surface wording to avoid.',
    ...spokenJapaneseNaturalnessGuidance(),
    ...casualYouthJapaneseGuidance(),
    ...noRepeatGuidance(payload),
    ...blockedFrameGuidance(payload),
    ...schemaRules,
    'Return only JSON with this shape:',
    '{"items":[...],"qualityNotes":["string"]}',
    'Use stable ids prefixed with ai- plus a short topic slug and random suffix.',
    'Include difficulty and category on every item. Make answer choices unambiguous.',
    'Do not repeat topics, wording, correct answers, answer logic, source genre, speech act, or prompt ids listed in recentPromptIds.',
    'Treat recentPromptIds as a warning about adjacent topic families too; avoid near-duplicates even with new ids.',
    'Novelty matters: do not recycle the same school/train/payment/shop/weather templates unless recent history is empty and the level truly needs it.',
    'If targetSkills asks for variety, prioritize novelty over easy familiar topics.',
    '',
    JSON.stringify(payload),
  ].join('\n');
}

function dailyPlanPrompt(payload) {
  return [
    'You are Kibbo, an ultra-personalized AP Japanese coach.',
    'Create today’s AP Japanese practice plan from the learner profile. Do not output generic lessons.',
    'Choose work that repairs weakMemory, weak rubric evidence, recentMistakes, and recentAnswerPatterns while avoiding repeated topics from generatedPromptSummaries and recentPromptIds.',
    'weakMemory should influence the plan whenever it contains recurring topic/vocab/rubric misses.',
    ...noRepeatGuidance(payload),
    'The daily plan may target the same weak skill as recent work, but the action titles/tasks must use fresh AP situations, not the same train/cafe/store/late-arrival/source family called out in the novelty constraints.',
    'For daily plans, novelty constraints are absolute: do not name or imply a blocked source family in action.title, action.task, action.why, or targetSkills.',
    'If the learner missed cause/effect in a club notice or schedule-change notice, repair cause/effect through a different AP source such as eligibility rules, deadlines, permission slips, location exceptions, required steps, lost-item procedures, or event consequences.',
    'If the learner missed casual classmate register in a late-arrival or what-to-bring text, repair casual register through a different peer job such as borrowing notes, checking homework instructions, choosing a practice place, asking for presentation feedback, or confirming a study time.',
    'Allowed modes: listening, speaking, reading, conversation, texting, mock.',
    'Use AP rubric language: Task completion, Delivery, Language use, Cultural knowledge.',
    'Each action.rubric must be exactly one of those four strings. Do not combine rubrics with slashes, commas, pipes, or lists.',
    'Do not use graphs, decimal scores, or vague language-learning activities.',
    'Prefer 3 focused actions: one coach-picked first action and two follow-up actions.',
    'Each action must be concrete enough for the app to start a drill route.',
    'If todayWork already completed the obvious weak mode, choose a different mode that still supports the weak rubric.',
    'Return only JSON with this shape:',
    '{"summary":"string","actions":[{"id":"string","mode":"texting","title":"string","task":"string","rubric":"Language use","minutes":number,"credits":number,"why":"string","targetSkills":["string"]}]}',
    'Use short titles, one-sentence why text, minutes from 8-18, credits 1 except mock uses 3.',
    '',
    JSON.stringify(payload),
  ].join('\n');
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === 'string') return responseJson.output_text;
  const parts = responseJson.output?.flatMap((item) => item.content ?? []) ?? [];
  return parts.map((part) => part.text ?? '').join('\n').trim();
}

function parseJsonOutput(outputText) {
  const cleaned = outputText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

function extractGeminiOutputText(responseJson) {
  const parts = responseJson.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  return parts.map((part) => part.text ?? '').join('\n').trim();
}

function extractAnthropicOutputText(responseJson) {
  const parts = responseJson.content ?? [];
  return parts.map((part) => part.text ?? '').join('\n').trim();
}

async function listAnthropicModels() {
  if (!ANTHROPIC_API_KEY) return [];
  const now = Date.now();
  if (anthropicModelCache.models && now - anthropicModelCache.fetchedAt < 300000) {
    return anthropicModelCache.models;
  }

  const response = await fetch('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  });
  const json = await response.json();
  if (!response.ok || !Array.isArray(json.data)) return [];

  const models = json.data
    .map((model) => model.id)
    .filter((id) => typeof id === 'string');
  anthropicModelCache.models = models;
  anthropicModelCache.fetchedAt = now;
  return models;
}

async function completeJsonWithGemini(prompt, config, task) {
  if (!GEMINI_API_KEY) {
    return {
      ok: false,
      status: 503,
      body: { error: 'GEMINI_API_KEY is not configured on the grading server.' },
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: config.maxOutputTokens,
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const json = await response.json();
  if (!response.ok) return { ok: false, status: response.status, body: json };

  const outputText = extractGeminiOutputText(json);
  const usage = tokenUsageFromGemini(json, prompt);
  const usageLog = logAIUsage({
    task,
    provider: 'gemini',
    model: GEMINI_MODEL,
    prompt,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    creditCost: config.creditCost,
  });
  return { ok: true, status: 200, body: withUsageMetadata(parseJsonOutput(outputText), usageLog) };
}

async function completeJsonWithOpenAI(prompt, config, task) {
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      status: 503,
      body: { error: 'OPENAI_API_KEY is not configured on the grading server.' },
    };
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openAIModel,
      input: prompt,
      max_output_tokens: config.maxOutputTokens,
      temperature: 0.2,
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    return { ok: false, status: response.status, body: json };
  }

  const outputText = extractOutputText(json);
  const usage = tokenUsageFromOpenAI(json, prompt);
  const usageLog = logAIUsage({
    task,
    provider: 'openai',
    model: config.openAIModel,
    prompt,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    creditCost: config.creditCost,
  });
  return { ok: true, status: 200, body: withUsageMetadata(parseJsonOutput(outputText), usageLog) };
}

async function completeJsonWithAnthropic(prompt, config, task) {
  if (!ANTHROPIC_API_KEY) {
    return {
      ok: false,
      status: 503,
      body: { error: 'ANTHROPIC_API_KEY is not configured on the grading server.' },
    };
  }

  let lastError = null;
  const availableModels = await listAnthropicModels();
  const modelsToTry = [
    ...ANTHROPIC_FALLBACK_MODELS,
    ...availableModels,
  ].filter((model, index, models) => model && models.indexOf(model) === index);

  for (const model of modelsToTry) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: config.maxOutputTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const json = await response.json();
    if (response.ok) {
      const outputText = extractAnthropicOutputText(json);
      const usage = tokenUsageFromAnthropic(json, prompt);
      const usageLog = logAIUsage({
        task,
        provider: 'anthropic',
        model,
        prompt,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        creditCost: config.creditCost,
      });
      return {
        ok: true,
        status: 200,
        body: withUsageMetadata({
          ...parseJsonOutput(outputText),
          _provider: 'anthropic',
          _model: model,
        }, usageLog),
      };
    }

    lastError = { status: response.status, body: json };
    if (response.status !== 404 && json?.error?.type !== 'not_found_error') break;
  }

  return { ok: false, status: lastError?.status ?? 500, body: lastError?.body ?? { error: 'Anthropic request failed.' } };
}

async function completeJson(prompt, task = 'content') {
  const provider = activeProvider();
  const config = TASK_CONFIGS[task] ?? TASK_CONFIGS.content;
  const promptTokens = estimateTokens(prompt);
  const worstCaseCents = estimateCostCents(
    provider,
    provider === 'openai' ? config.openAIModel : provider === 'gemini' ? GEMINI_MODEL : ANTHROPIC_MODEL,
    promptTokens,
    config.maxOutputTokens,
  );
  if (config.creditCost > 0 && worstCaseCents > budgetCentsFor(config)) {
    const usageLog = logAIUsage({
      task,
      provider,
      model: provider === 'openai' ? config.openAIModel : provider === 'gemini' ? GEMINI_MODEL : ANTHROPIC_MODEL,
      prompt,
      inputTokens: promptTokens,
      outputTokens: config.maxOutputTokens,
      creditCost: config.creditCost,
      status: 'projected_over_budget',
    });
    if (AI_ENFORCE_COST_CAP) {
      return {
        ok: false,
        status: 402,
        body: withUsageMetadata({
          error: 'AI request projected over the configured per-credit cost cap.',
          code: 'AI_COST_CAP',
        }, usageLog),
      };
    }
  }
  if (provider === 'gemini') return completeJsonWithGemini(prompt, config, task);
  if (provider === 'anthropic') return completeJsonWithAnthropic(prompt, config, task);
  return completeJsonWithOpenAI(prompt, config, task);
}

async function gradeSession(payload) {
  const result = await completeJson(gradingPrompt(payload), feedbackLevelFor(payload) === 'elite' ? 'eliteReview' : 'apReview');
  if (result.status === 200) {
    result.body = applyCasualPeerReviewExamples(result.body, payload);
  }
  return result;
}

function routePath(url = '/') {
  const pathOnly = String(url).split('?')[0] || '/';
  if (pathOnly.startsWith('/api/')) return pathOnly.slice(4) || '/';
  if (pathOnly === '/api') return '/';
  return pathOnly;
}

async function handleRequest(req, res) {
  try {
    const pathname = routePath(req.url);
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        provider: activeProvider(),
        hasKey: activeProvider() === 'gemini'
          ? Boolean(GEMINI_API_KEY)
          : activeProvider() === 'anthropic'
            ? Boolean(ANTHROPIC_API_KEY)
            : Boolean(OPENAI_API_KEY),
        openai: {
          hasKey: Boolean(OPENAI_API_KEY),
          defaultModel: OPENAI_MODEL,
          dailyPlanModel: OPENAI_DAILY_PLAN_MODEL,
          contentModel: OPENAI_CONTENT_MODEL,
          reviewModel: OPENAI_REVIEW_MODEL,
          eliteReviewModel: OPENAI_ELITE_REVIEW_MODEL,
        },
        gemini: {
          hasKey: Boolean(GEMINI_API_KEY),
          model: GEMINI_MODEL,
        },
        anthropic: {
          hasKey: Boolean(ANTHROPIC_API_KEY),
          model: ANTHROPIC_MODEL,
        },
        costControls: {
          maxCostCentsPerCredit: AI_MAX_COST_CENTS_PER_CREDIT,
          enforceCostCap: AI_ENFORCE_COST_CAP,
          safetyMultiplier: AI_COST_SAFETY_MULTIPLIER,
          exposeCosts: EXPOSE_AI_COSTS,
          taskCaps: Object.fromEntries(Object.entries(TASK_CONFIGS).map(([task, config]) => [
            task,
            {
              creditCost: config.creditCost,
              maxOutputTokens: config.maxOutputTokens,
              openAIModel: config.openAIModel,
            },
          ])),
        },
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/provider-models') {
      if (activeProvider() === 'anthropic') {
        const models = await listAnthropicModels();
        sendJson(res, 200, { provider: 'anthropic', models });
        return;
      }
      sendJson(res, 200, { provider: activeProvider(), models: [] });
      return;
    }

    if (req.method === 'POST' && pathname === '/submit-feedback') {
      const payload = await readBody(req);
      const entry = await recordFirstCompletionFeedback(payload);
      sendJson(res, 200, { ok: true, id: entry.id });
      return;
    }

    if (req.method === 'POST' && pathname === '/grade-ap-session') {
      const payload = await readBody(req);
      const result = await gradeSession(payload);
      sendJson(res, result.status, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/review-speaking-attempt') {
      const payload = await readBody(req);
      const result = await completeJson(
        speakingReviewPrompt(payload),
        feedbackLevelFor(payload) === 'elite' ? 'eliteReview' : 'speakingReview',
      );
      if (result.status === 200) {
        result.body = applySpeakingDeliveryCaps(result.body, payload);
      }
      sendJson(res, result.status, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/generate-practice-content') {
      const payload = await readBody(req);
      const result = await generateContentWithOneNoveltyRetry(payload);
      sendJson(res, result.status, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/generate-daily-plan') {
      const payload = await readBody(req);
      const result = await completeJson(dailyPlanPrompt(payload), 'dailyPlan');
      if (result.status === 200) {
        result.body = normalizeDailyPlanResult(result.body, payload);
      }
      sendJson(res, result.status, result.body);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    const status = Number.isFinite(error?.status) ? error.status : 500;
    sendJson(res, status, { error: error instanceof Error ? error.message : 'Unknown server error' });
  }
}

const server = http.createServer(handleRequest);

function startServer() {
  server.listen(PORT, () => {
  console.log(`AP grading server listening on http://localhost:${PORT}`);
  console.log(`AI provider: ${activeProvider()}`);
  console.log(`OpenAI: ${OPENAI_API_KEY ? 'key set' : 'no key'} / default ${OPENAI_MODEL} / content ${OPENAI_CONTENT_MODEL} / review ${OPENAI_REVIEW_MODEL}`);
  console.log(`Gemini: ${GEMINI_API_KEY ? 'key set' : 'no key'} / ${GEMINI_MODEL}`);
  console.log(`Anthropic: ${ANTHROPIC_API_KEY ? 'key set' : 'no key'} / ${ANTHROPIC_MODEL}`);
  console.log(`AI cost target: <= ${AI_MAX_COST_CENTS_PER_CREDIT} cent(s) per credit`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startServer();
}

export {
  MODEL_PRICES_USD_PER_1M,
  TASK_CONFIGS,
  activeProvider,
  budgetCentsFor,
  completeJson,
  contentGenerationPrompt,
  contentRetryPayload,
  dailyPlanPrompt,
  estimateCostCents,
  estimateTokens,
  generateContentWithOneNoveltyRetry,
  generatedContentNoveltyIssues,
  gradingPrompt,
  handleRequest,
  routePath,
  speakingReviewPrompt,
  startServer,
};
