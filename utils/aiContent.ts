import type {
  Difficulty,
  ListeningQuestion,
  ReadingPassageSet,
  ReadingPromptQuestion,
  SpeakingPrompt,
} from '@/data/types';
import type { APPromptSet } from '@/data/apPractice';
import { getAIEndpoint } from '@/utils/aiApi';
import type { AIPersonalizationProfile } from '@/utils/personalization';

export type AIPracticeMode = 'listening' | 'reading' | 'speaking' | 'conversation' | 'texting';

export type AIPracticeItem =
  | ListeningQuestion
  | ReadingPassageSet
  | SpeakingPrompt
  | APPromptSet;

export interface AIContentRequest {
  mode: AIPracticeMode;
  languageCode: 'ja';
  level: number;
  difficulty: Difficulty;
  count: number;
  recentPromptIds?: string[];
  targetSkills?: string[];
  profile?: AIPersonalizationProfile;
}

export interface AIContentResponse {
  items: AIPracticeItem[];
  qualityNotes: string[];
}

function timeoutValue<T>(timeoutMs: number, value: T, onTimeout?: () => void) {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  const promise = new Promise<T>((resolve) => {
    timeoutId = globalThis.setTimeout(() => {
      onTimeout?.();
      resolve(value);
    }, timeoutMs);
  });
  return {
    promise,
    clear: () => {
      if (timeoutId) globalThis.clearTimeout(timeoutId);
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced';
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return value;
}

function isReadingQuestion(value: unknown): value is ReadingPromptQuestion {
  if (!isRecord(value)) return false;
  const choices = stringArray(value.choices);
  if (!choices) return false;
  return typeof value.id === 'string'
    && typeof value.question === 'string'
    && choices.length === 4
    && typeof value.correctIndex === 'number'
    && value.correctIndex >= 0
    && value.correctIndex < choices.length
    && (value.evidence === undefined || typeof value.evidence === 'string')
    && (value.keyword === undefined || typeof value.keyword === 'string')
    && (value.explanation === undefined || typeof value.explanation === 'string');
}

const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;
const ENGLISH_WORD_PATTERN = /[A-Za-z]{3,}/;
const TIME_OR_DATE_PATTERN = /(?:\d{1,2}|[一二三四五六七八九十百]+)\s*(?:時|分|時間|日|月|曜日)|午前|午後|半|来週|今週|明日|今日|昨日|あさって|週末/g;
const DETAIL_TIME_QUESTION_PATTERN = /何時|いつ|何日|何曜日|何月|何分|何時間|どのくらい|何時ごろ|when|what time|which day|how long/i;

function containsJapanese(value: unknown) {
  return JAPANESE_TEXT_PATTERN.test(String(value ?? ''));
}

function compactJapaneseText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s\u3000]/g, '')
    .replace(/[「」『』（）()［\]\[\],，、。.!！？?：:；;・･〜~"“”'’]/g, '');
}

function includesLooseJapanese(haystack: unknown, needle: unknown) {
  const compactHaystack = compactJapaneseText(haystack);
  const compactNeedle = compactJapaneseText(needle);
  return Boolean(compactNeedle) && compactHaystack.includes(compactNeedle);
}

function timeOrDateTokens(value: unknown) {
  return Array.from(String(value ?? '').matchAll(TIME_OR_DATE_PATTERN), (match) => match[0].replace(/\s/g, ''));
}

function isEnglishOnlyMetadata(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return !containsJapanese(text) && ENGLISH_WORD_PATTERN.test(text);
}

function isUsableAIReadingSet(item: ReadingPassageSet) {
  if (!containsJapanese(item.passage) || !containsJapanese(item.title)) return false;
  if (isEnglishOnlyMetadata(item.context)) return false;
  if (compactJapaneseText(item.passage).length < 40) return false;

  return item.questions.every((question) => {
    const correctChoice = question.choices[question.correctIndex];
    const evidence = question.evidence?.trim() ?? '';
    const keyword = question.keyword?.trim() ?? '';
    if (!containsJapanese(question.question)) return false;
    if (question.choices.every(isEnglishOnlyMetadata)) return false;
    if (!evidence || !containsJapanese(evidence) || !includesLooseJapanese(item.passage, evidence)) return false;
    if (compactJapaneseText(evidence).length > 32 || /。.+。/.test(evidence) || /。/.test(evidence.replace(/。$/, ''))) return false;
    if (!keyword || !containsJapanese(keyword)) return false;
    if (!includesLooseJapanese(evidence, keyword) && !includesLooseJapanese(item.passage, keyword)) return false;

    const passageTimeTokens = timeOrDateTokens(`${item.passage} ${evidence}`);
    const correctTimeTokens = timeOrDateTokens(correctChoice);
    const looksLikeTimeDetailQuestion = DETAIL_TIME_QUESTION_PATTERN.test(question.question) || correctTimeTokens.length > 0;
    if (looksLikeTimeDetailQuestion && correctTimeTokens.length > 0) {
      return correctTimeTokens.some((token) => passageTimeTokens.includes(token));
    }
    if (DETAIL_TIME_QUESTION_PATTERN.test(question.question) && passageTimeTokens.length === 0) return false;
    return true;
  });
}

export function parseAIListeningQuestions(items: AIPracticeItem[]): ListeningQuestion[] {
  return items.filter((item): item is ListeningQuestion => {
    if (!isRecord(item)) return false;
    const choices = stringArray(item.choices);
    if (!choices) return false;
    return typeof item.id === 'string'
      && item.id.startsWith('ai-')
      && typeof item.transcript === 'string'
      && typeof item.translation === 'string'
      && typeof item.context === 'string'
      && typeof item.question === 'string'
      && choices.length === 4
      && typeof item.correctIndex === 'number'
      && item.correctIndex >= 0
      && item.correctIndex < choices.length
      && isDifficulty(item.difficulty)
      && typeof item.category === 'string';
  });
}

export function parseAISpeakingPrompts(items: AIPracticeItem[]): SpeakingPrompt[] {
  return items.filter((item): item is SpeakingPrompt => {
    if (!isRecord(item)) return false;
    const acceptableAnswers = stringArray(item.acceptableAnswers);
    if (!acceptableAnswers) return false;
    return typeof item.id === 'string'
      && item.id.startsWith('ai-')
      && typeof item.english === 'string'
      && acceptableAnswers.length > 0
      && typeof item.hint === 'string'
      && isDifficulty(item.difficulty);
  });
}

export function parseAIReadingSets(items: AIPracticeItem[]): ReadingPassageSet[] {
  return items.filter((item): item is ReadingPassageSet => {
    if (!isRecord(item)) return false;
    const isReadingSet = typeof item.id === 'string'
      && item.id.startsWith('ai-')
      && typeof item.passage === 'string'
      && typeof item.translation === 'string'
      && typeof item.context === 'string'
      && typeof item.title === 'string'
      && Array.isArray(item.questions)
      && item.questions.length >= 2
      && item.questions.length <= 4
      && item.questions.every(isReadingQuestion)
      && isDifficulty(item.difficulty)
      && typeof item.category === 'string';
    return isReadingSet && isUsableAIReadingSet(item as ReadingPassageSet);
  });
}

export function parseAIAPPromptSets(items: AIPracticeItem[], mode: 'conversation' | 'texting'): APPromptSet[] {
  return items.filter((item): item is APPromptSet => {
    if (!isRecord(item)) return false;
    const prompts = stringArray(item.prompts);
    if (!prompts) return false;
    const modelAnswers = stringArray(item.modelAnswers);
    if (!modelAnswers) return false;
    return typeof item.id === 'string'
      && item.id.startsWith('ai-')
      && typeof item.title === 'string'
      && typeof item.situation === 'string'
      && item.mode === mode
      && item.languageCode === 'ja'
      && prompts.length === 4
      && Array.isArray(item.suggestedKeywords)
      && item.suggestedKeywords.length === prompts.length
      && item.suggestedKeywords.every((keywords) => stringArray(keywords) !== null)
      && modelAnswers.length === prompts.length;
  });
}

const GENERATED_CONTENT_TIMEOUT_MS = 65000;

export async function generatePracticeContent(
  request: AIContentRequest,
  timeoutMs = GENERATED_CONTENT_TIMEOUT_MS,
): Promise<AIContentResponse | null> {
  const endpoint = getAIEndpoint();
  if (!endpoint) return null;

  const controller = new AbortController();
  const abortTimeout = timeoutValue<Response | null>(timeoutMs, null, () => controller.abort());

  try {
    const response = await Promise.race([
      fetch(`${endpoint}/generate-practice-content`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      }),
      abortTimeout.promise,
    ]);

    if (!response || !response.ok) return null;
    const json = await response.json() as unknown;
    if (!isRecord(json) || !Array.isArray(json.items)) return null;

    return {
      items: json.items as AIPracticeItem[],
      qualityNotes: Array.isArray(json.qualityNotes)
        ? json.qualityNotes.filter((note): note is string => typeof note === 'string')
        : [],
    };
  } catch {
    return null;
  } finally {
    abortTimeout.clear();
  }
}
