import type { LanguageCode } from '@/constants/languages';
import { getPlayerLevel } from '@/utils/progression';
import {
  getAttemptMemory,
  getGeneratedPromptCache,
  getRecentPromptIds,
  getSavedItems,
  getSessionHistory,
  getStatsForLanguage,
  getWeakMemory,
  type AttemptMemory,
  type GeneratedPromptItem,
  type PromptHistoryType,
  type SavedItem,
  type SessionRecord,
  type WeakMemoryItem,
} from '@/utils/storage';
import { getBestSkill, getDevelopmentIndex } from '@/utils/learningSignals';

const PROFILE_PROMPT_TYPES: PromptHistoryType[] = ['listening', 'speaking', 'reading', 'conversation', 'texting'];

function dateKey(timestamp: number) {
  return new Date(timestamp).toDateString();
}

function weakestRubricFromSessions(sessions: SessionRecord[]) {
  if (sessions.length === 0) return 'Task completion';
  const recent = sessions.slice(0, 10);
  const avg = (types: SessionRecord['type'][]) => {
    const matching = recent.filter((session) => types.includes(session.type));
    if (matching.length === 0) return 100;
    return matching.reduce((sum, session) => sum + session.score, 0) / matching.length;
  };
  const candidates = [
    { key: 'Task completion', value: avg(['listening', 'reading']) },
    { key: 'Delivery', value: avg(['speaking', 'conversation']) },
    { key: 'Language use', value: avg(['speaking', 'conversation', 'texting']) },
    { key: 'Cultural knowledge', value: sessions.length >= 4 ? avg(['texting', 'conversation']) + 8 : 42 },
  ].sort((a, b) => a.value - b.value);

  return candidates[0]?.key ?? 'Task completion';
}

function summarizeSavedItem(item: SavedItem) {
  return {
    type: item.type,
    promptId: item.promptId,
    question: item.question.slice(0, 180),
    answer: item.answer.slice(0, 180),
  };
}

function summarizeSession(session: SessionRecord) {
  return {
    type: session.type,
    score: session.score,
    correct: session.correct,
    total: session.total,
    xpEarned: session.xpEarned,
    rewardKey: session.rewardKey,
    mockId: session.mockId,
    daysAgo: Math.max(0, Math.round((Date.now() - session.date) / 86400000)),
  };
}

function summarizeAttemptMemory(item: AttemptMemory) {
  return {
    type: item.type,
    promptId: item.promptId,
    score: item.score,
    correct: item.correct,
    daysAgo: Math.max(0, Math.round((Date.now() - item.date) / 86400000)),
    question: item.question.slice(0, 180),
    userAnswer: item.userAnswer.slice(0, 180),
    expectedAnswer: item.expectedAnswer.slice(0, 180),
    context: item.context?.slice(0, 180),
    weakSkills: item.weakSkills?.slice(0, 4),
  };
}

function summarizeWeakMemory(item: WeakMemoryItem) {
  return {
    type: item.type,
    topic: item.topic,
    vocab: item.vocab.slice(0, 6),
    rubric: item.rubric,
    mistakeType: item.mistakeType,
    missCount: item.missCount,
    priority: item.priority,
    daysAgo: Math.max(0, Math.round((Date.now() - item.lastSeen) / 86400000)),
    evidence: item.evidence.slice(0, 3),
  };
}

function generatedTextFor(type: PromptHistoryType, item: GeneratedPromptItem) {
  if ('transcript' in item) {
    return {
      prompt: `${item.context}: ${item.question}`,
      answerLogic: item.choices[item.correctIndex] ?? '',
      source: item.transcript,
      category: item.category,
    };
  }
  if ('passage' in item) {
    return {
      prompt: `${item.title}: ${item.context}`,
      answerLogic: item.questions.map((question) => question.question).join(' | '),
      source: item.passage,
      category: item.category,
    };
  }
  if ('english' in item) {
    return {
      prompt: item.english,
      answerLogic: item.acceptableAnswers.slice(0, 2).join(' | '),
      source: item.hint,
      category: item.difficulty,
    };
  }
  return {
    prompt: `${item.title}: ${item.situation}`,
    answerLogic: item.prompts.join(' | '),
    source: item.modelAnswers.slice(0, 2).join(' | '),
    category: type,
  };
}

function summarizeGeneratedPrompt(type: PromptHistoryType, item: GeneratedPromptItem) {
  const text = generatedTextFor(type, item);
  return {
    type,
    id: item.id,
    category: text.category,
    prompt: text.prompt.slice(0, 180),
    answerLogic: text.answerLogic.slice(0, 180),
    source: text.source.slice(0, 180),
  };
}

export interface AIPersonalizationProfile {
  languageCode: LanguageCode;
  currentLevel: number;
  rank: string;
  totalXP: number;
  accuracyPercent: number;
  bestSkill: string;
  developmentIndex: number;
  weakestRubric: string;
  todayWork: ReturnType<typeof summarizeSession>[];
  recentAttempts: ReturnType<typeof summarizeSession>[];
  missedAttempts: ReturnType<typeof summarizeSession>[];
  recentMistakes: ReturnType<typeof summarizeAttemptMemory>[];
  recentAnswerPatterns: ReturnType<typeof summarizeAttemptMemory>[];
  weakMemory: ReturnType<typeof summarizeWeakMemory>[];
  savedWeakSpots: ReturnType<typeof summarizeSavedItem>[];
  generatedPromptSummaries: ReturnType<typeof summarizeGeneratedPrompt>[];
  recentPromptIdsByType: Partial<Record<PromptHistoryType, string[]>>;
  generatedPromptIdsByType: Partial<Record<PromptHistoryType, string[]>>;
  doNotRepeatIds: string[];
  personalizationRules: string[];
}

function rankForLevel(level: number) {
  if (level <= 5) return 'Novice';
  if (level <= 10) return 'Beginner';
  if (level <= 15) return 'Intermediate';
  if (level <= 20) return 'Upper Intermediate';
  if (level <= 25) return 'Advanced';
  return 'Mastery';
}

export async function buildAIPersonalizationProfile(languageCode: LanguageCode): Promise<AIPersonalizationProfile> {
  const [stats, sessions, savedItems, attemptMemory, weakMemory, ...promptLists] = await Promise.all([
    getStatsForLanguage(languageCode),
    getSessionHistory(),
    getSavedItems(),
    getAttemptMemory(languageCode),
    getWeakMemory(languageCode),
    ...PROFILE_PROMPT_TYPES.map(async (type) => {
      const [recent, generated] = await Promise.all([
        getRecentPromptIds(languageCode, type),
        getGeneratedPromptCache(languageCode, type),
      ]);
      return { type, recent, generated, generatedIds: generated.map((item) => item.id) };
    }),
  ]);
  const playerLevel = getPlayerLevel(stats.totalXP);
  const languageSessions = sessions.filter((session) => session.languageCode === languageCode);
  const today = new Date().toDateString();
  const recentPromptIdsByType = Object.fromEntries(
    promptLists.map((item) => [item.type, item.recent.slice(0, 35)]),
  ) as Partial<Record<PromptHistoryType, string[]>>;
  const generatedPromptIdsByType = Object.fromEntries(
    promptLists.map((item) => [item.type, item.generatedIds.slice(0, 25)]),
  ) as Partial<Record<PromptHistoryType, string[]>>;
  const generatedPromptSummaries = promptLists
    .flatMap((list) => list.generated.slice(0, 8).map((item) => summarizeGeneratedPrompt(list.type, item)))
    .slice(0, 24);
  const doNotRepeatIds = Array.from(new Set([
    ...promptLists.flatMap((item) => item.recent),
    ...promptLists.flatMap((item) => item.generatedIds),
    ...languageSessions.map((session) => session.rewardKey).filter((id): id is string => Boolean(id)),
    ...savedItems
      .filter((item) => item.languageCode === languageCode)
      .map((item) => item.promptId),
  ])).slice(0, 160);
  const accuracyPercent = stats.totalAnswered > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
    : 0;
  const weakestRubric = weakestRubricFromSessions(languageSessions);

  return {
    languageCode,
    currentLevel: playerLevel.level,
    rank: rankForLevel(playerLevel.level),
    totalXP: stats.totalXP,
    accuracyPercent,
    bestSkill: getBestSkill(sessions, languageCode),
    developmentIndex: getDevelopmentIndex(sessions, languageCode),
    weakestRubric,
    todayWork: languageSessions
      .filter((session) => dateKey(session.date) === today)
      .slice(0, 8)
      .map(summarizeSession),
    recentAttempts: languageSessions.slice(0, 14).map(summarizeSession),
    missedAttempts: languageSessions
      .filter((session) => session.score < 72)
      .slice(0, 8)
      .map(summarizeSession),
    recentMistakes: attemptMemory
      .filter((item) => !item.correct || item.score < 72)
      .slice(0, 14)
      .map(summarizeAttemptMemory),
    recentAnswerPatterns: attemptMemory
      .slice(0, 18)
      .map(summarizeAttemptMemory),
    weakMemory: weakMemory
      .slice(0, 12)
      .map(summarizeWeakMemory),
    savedWeakSpots: savedItems
      .filter((item) => item.languageCode === languageCode)
      .slice(0, 10)
      .map(summarizeSavedItem),
    generatedPromptSummaries,
    recentPromptIdsByType,
    generatedPromptIdsByType,
    doNotRepeatIds,
    personalizationRules: [
      'Build today’s work from weak rubric evidence, not a fixed lesson order.',
      'Use weakMemory as the strongest signal for recurring topic/vocab/rubric repairs.',
      'Avoid prompt ids, topics, answer logic, and task shapes from doNotRepeatIds and recentPromptIdsByType.',
      'Prefer fresh AP Japanese scenarios over generic school/train/shop repeats.',
      'Increase difficulty only when recent attempts show enough completion evidence.',
      'If todayWork already includes a mode, choose the next item to repair a different weak spot unless repetition is pedagogically necessary.',
    ],
  };
}
