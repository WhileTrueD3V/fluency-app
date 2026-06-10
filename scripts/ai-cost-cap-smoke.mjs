process.env.AI_PROVIDER = 'anthropic';
process.env.ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
process.env.AI_MAX_COST_CENTS_PER_CREDIT = '1';
process.env.AI_ENFORCE_COST_CAP = '1';
process.env.EXPOSE_AI_COSTS = '1';
process.env.ANTHROPIC_API_KEY = '';
process.env.OPENAI_API_KEY = '';
process.env.GEMINI_API_KEY = '';

const {
  completeJson,
  contentGenerationPrompt,
} = await import('../server/grading-server.mjs');

const payload = {
  mode: 'listening',
  languageCode: 'ja',
  level: 8,
  difficulty: 'intermediate',
  count: 3,
  recentPromptIds: ['ai-train-delay-old', 'ai-cafe-old', 'ai-weather-old'],
  targetSkills: [
    'repair AP task completion',
    'avoid repeated train, cafe, and weather prompts',
    'generate a fresh AP Japanese listening drill',
  ],
  profile: {
    languageCode: 'ja',
    currentLevel: 8,
    rank: 'Beginner',
    totalXP: 500,
    accuracyPercent: 70,
    bestSkill: 'Reading',
    developmentIndex: 65,
    weakestRubric: 'Task completion',
    todayWork: [],
    recentAttempts: [],
    missedAttempts: [],
    recentMistakes: [],
    recentAnswerPatterns: [],
    savedWeakSpots: [],
    generatedPromptSummaries: [],
    recentPromptIdsByType: {},
    generatedPromptIdsByType: {},
    doNotRepeatIds: ['ai-train-delay-old', 'ai-cafe-old', 'ai-weather-old'],
    personalizationRules: ['Keep AP Japanese coaching specific and avoid generic language-app prompts.'],
  },
};

const result = await completeJson(contentGenerationPrompt(payload), 'content');

if (result.status !== 402 || result.body?.code !== 'AI_COST_CAP') {
  throw new Error(`Expected AI_COST_CAP 402, got ${result.status}: ${JSON.stringify(result.body)}`);
}

console.log('AI cost cap smoke test passed.');
console.log(JSON.stringify(result.body._usage ?? result.body, null, 2));
