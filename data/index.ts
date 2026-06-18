import { japaneseSpeakingPrompts, japaneseListeningQuestions, japaneseReadingSets } from './japanese';
import { spanishSpeakingPrompts, spanishListeningQuestions } from './spanish';
import type { SpeakingPrompt, ListeningQuestion, ReadingPassageSet } from './types';
import type { LanguageCode } from '@/constants/languages';
import { difficultyRank, getPlayerLevel } from '@/utils/progression';
import { hasPracticeRepeatOverlap, type PracticeRepeatItem } from '@/utils/practiceRepeatKeys';

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


function isFreshLocalItem<T extends PracticeRepeatItem>(item: T, excluded: Set<string>) {
  return !hasPracticeRepeatOverlap(item, excluded);
}

function progressiveSubset<T extends PracticeRepeatItem & { id: string; difficulty: 'beginner' | 'intermediate' | 'advanced' }>(
  items: T[],
  count: number,
  totalXP: number,
  excludedIds: string[] = [],
): T[] {
  const level = getPlayerLevel(totalXP);
  const excluded = new Set(Array.isArray(excludedIds) ? excludedIds : []);
  const allowed = (item: T) => level.allowedDifficulties.includes(item.difficulty);
  const fresh = (item: T) => isFreshLocalItem(item, excluded);
  const easierFirst = (a: T, b: T) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty);

  const freshPreferred = items.filter((item) => allowed(item) && fresh(item));
  const freshFallback = items.filter((item) => !allowed(item) && fresh(item)).sort(easierFirst);
  const shuffledFreshPreferred = [...freshPreferred]
    .sort(() => Math.random() - 0.5)
    .sort(byDifficulty);
  const shuffledFreshFallback = [...freshFallback].sort(() => Math.random() - 0.5);
  const pool = [
    ...shuffledFreshPreferred,
    ...shuffledFreshFallback,
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
  return progressiveSubset(all, count, totalXP, excludedIds);
}
