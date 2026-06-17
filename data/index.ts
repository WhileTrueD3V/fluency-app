import { japaneseSpeakingPrompts, japaneseListeningQuestions, japaneseReadingSets } from './japanese';
import { spanishSpeakingPrompts, spanishListeningQuestions } from './spanish';
import type { SpeakingPrompt, ListeningQuestion, ReadingPassageSet } from './types';
import type { LanguageCode } from '@/constants/languages';
import { difficultyRank, getPlayerLevel } from '@/utils/progression';

export type { SpeakingPrompt, ListeningQuestion, ReadingPassageSet, PracticeItem } from './types';

const speakingData: Record<string, SpeakingPrompt[]> = {
  ja: japaneseSpeakingPrompts,
  zh: japaneseSpeakingPrompts, // placeholder until Mandarin AP content is built
  es: spanishSpeakingPrompts,
};

const listeningData: Record<string, ListeningQuestion[]> = {
  ja: japaneseListeningQuestions,
  zh: japaneseListeningQuestions, // placeholder until Mandarin AP content is built
  es: spanishListeningQuestions,
};

const readingData: Record<string, ReadingPassageSet[]> = {
  ja: japaneseReadingSets,
  zh: japaneseReadingSets, // placeholder until Mandarin AP content is built
  es: japaneseReadingSets, // placeholder until Spanish AP content is built
};

function byDifficulty<T extends { difficulty: 'beginner' | 'intermediate' | 'advanced' }>(a: T, b: T) {
  return difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
}


function normalizeRepeatKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s。、，,.!?！？;；:：「」『』()（）"'’“”・-]/g, '')
    .slice(0, 180);
}

function readingRepeatKeys(set: ReadingPassageSet) {
  return [
    set.id,
    normalizeRepeatKey([set.title, set.context, set.passage].join(' ')),
    ...set.questions.flatMap((question) => [
      question.id,
      set.id + ':' + question.id,
      normalizeRepeatKey([
        set.title,
        question.question,
        question.choices[question.correctIndex] ?? '',
        question.evidence ?? '',
        question.keyword ?? '',
      ].join(' ')),
    ]),
  ].filter(Boolean);
}

function progressiveSubset<T extends { id: string; difficulty: 'beginner' | 'intermediate' | 'advanced' }>(
  items: T[],
  count: number,
  totalXP: number,
  excludedIds: string[] = [],
): T[] {
  const level = getPlayerLevel(totalXP);
  const excluded = new Set(Array.isArray(excludedIds) ? excludedIds : []);
  const allowed = (item: T) => level.allowedDifficulties.includes(item.difficulty);
  const fresh = (item: T) => !excluded.has(item.id);
  const stale = (item: T) => excluded.has(item.id);
  const easierFirst = (a: T, b: T) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty);

  const freshPreferred = items.filter((item) => allowed(item) && fresh(item));
  const freshFallback = items.filter((item) => !allowed(item) && fresh(item)).sort(easierFirst);
  const stalePreferred = items.filter((item) => allowed(item) && stale(item));
  const staleFallback = items.filter((item) => !allowed(item) && stale(item)).sort(easierFirst);

  const shuffledFreshPreferred = [...freshPreferred]
    .sort(() => Math.random() - 0.5)
    .sort(byDifficulty);
  const shuffledFreshFallback = [...freshFallback].sort(() => Math.random() - 0.5);
  const shuffledStalePreferred = [...stalePreferred].sort(() => Math.random() - 0.5);
  const shuffledStaleFallback = [...staleFallback].sort(() => Math.random() - 0.5);
  const pool = [
    ...shuffledFreshPreferred,
    ...shuffledFreshFallback,
    ...shuffledStalePreferred,
    ...shuffledStaleFallback,
  ];
  return pool.slice(0, Math.min(count, pool.length));
}

export function getSpeakingPrompts(langCode: LanguageCode): SpeakingPrompt[] {
  return speakingData[langCode] ?? japaneseSpeakingPrompts;
}

export function getListeningQuestions(langCode: LanguageCode): ListeningQuestion[] {
  return listeningData[langCode] ?? japaneseListeningQuestions;
}

export function getReadingSets(langCode: LanguageCode): ReadingPassageSet[] {
  return readingData[langCode] ?? japaneseReadingSets;
}

export function getSpeakingPromptById(
  langCode: LanguageCode,
  promptId: string,
): SpeakingPrompt | null {
  return getSpeakingPrompts(langCode).find((prompt) => prompt.id === promptId) ?? null;
}

export function getListeningQuestionById(
  langCode: LanguageCode,
  questionId: string,
): ListeningQuestion | null {
  return getListeningQuestions(langCode).find((question) => question.id === questionId) ?? null;
}

export function getReadingSetById(
  langCode: LanguageCode,
  setId: string,
): ReadingPassageSet | null {
  return getReadingSets(langCode).find((set) => set.id === setId) ?? null;
}

/** Return a shuffled subset of N questions */
export function getRandomListeningQuestions(
  langCode: LanguageCode,
  count: number,
  totalXP = 0,
  excludedIds: string[] = [],
): ListeningQuestion[] {
  const all = getListeningQuestions(langCode);
  return progressiveSubset(all, count, totalXP, excludedIds);
}

export function getRandomSpeakingPrompts(
  langCode: LanguageCode,
  count: number,
  totalXP = 0,
  excludedIds: string[] = [],
): SpeakingPrompt[] {
  const all = getSpeakingPrompts(langCode);
  return progressiveSubset(all, count, totalXP, excludedIds);
}

export function getRandomReadingSets(
  langCode: LanguageCode,
  count: number,
  totalXP = 0,
  excludedIds: string[] = [],
): ReadingPassageSet[] {
  const all = getReadingSets(langCode);
  const excluded = new Set(excludedIds);
  const fresh = all.filter((set) => !readingRepeatKeys(set).some((key) => excluded.has(key)));
  const pool = fresh.length > 0 ? fresh : all.filter((set) => !excluded.has(set.id));
  return progressiveSubset(pool.length > 0 ? pool : all, count, totalXP, excludedIds);
}
