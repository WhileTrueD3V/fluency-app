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
    return typeof item.id === 'string'
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

export async function generatePracticeContent(
  request: AIContentRequest,
  timeoutMs = 6000,
): Promise<AIContentResponse | null> {
  const endpoint = getAIEndpoint();
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${endpoint}/generate-practice-content`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) return null;
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
    globalThis.clearTimeout(timeout);
  }
}
