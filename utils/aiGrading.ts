import type { APPromptSet } from '@/data/apPractice';
import { getAIEndpoint } from '@/utils/aiApi';
import { reviewAPSession, type APSessionReview } from '@/utils/apScoring';
import { getAIFeedbackLevel } from '@/utils/storage';

export type APGradingProvider = 'local-rubric' | 'remote-ai';

export interface APGradingResult extends APSessionReview {
  provider: APGradingProvider;
  summary: string;
  xpEarned?: number;
}

const AP_GRADING_TIMEOUT_MS = 18000;

function timeoutValue<T>(timeoutMs: number, value: T, onTimeout?: () => void) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      onTimeout?.();
      resolve(value);
    }, timeoutMs);
  });
  return {
    promise,
    clear: () => {
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}

export function gradeAPSessionLocally(
  set: APPromptSet,
  answers: string[],
): APGradingResult {
  const localReview = reviewAPSession(set, answers);
  return {
    ...localReview,
    provider: 'local-rubric',
    summary: summaryFor(localReview),
  };
}

export async function gradeAPSessionWithAI(
  set: APPromptSet,
  answers: string[],
): Promise<APGradingResult> {
  const localReview = reviewAPSession(set, answers);
  const endpoint = getAIEndpoint();
  const hasAnyAnswer = answers.some((answer) => answer.trim().length > 0);
  const feedbackLevel = await getAIFeedbackLevel();

  if (endpoint && hasAnyAnswer) {
    const controller = new AbortController();
    const abortTimeout = timeoutValue<Response | null>(AP_GRADING_TIMEOUT_MS, null, () => controller.abort());
    try {
      const response = await Promise.race([
        fetch(`${endpoint.replace(/\/$/, '')}/grade-ap-session`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            set,
            answers,
            localReview,
            feedbackLevel,
          }),
        }),
        abortTimeout.promise,
      ]);

      if (response?.ok) {
        const remote = await response.json() as APSessionReview & { summary?: string };
        const sanitized = sanitizeAPReview(remote, set);
        return {
          ...sanitized,
          provider: 'remote-ai',
          summary: sanitizeFeedbackText(remote.summary, set.mode, registerContextForSet(set)) ?? summaryFor(sanitized),
        };
      }
    } catch {
      // Local rubric remains the reliable offline fallback.
    } finally {
      abortTimeout.clear();
    }
  }

  return gradeAPSessionLocally(set, answers);
}

function isWrongModalityFeedback(text: string, mode: APPromptSet['mode']) {
  if (mode === 'conversation') {
    return /(comma|commas|period|periods|punctuation|separator|separators|spelling|written formatting|text-chat|text chat|reads as|run-on)/i.test(text);
  }
  return /(pronunciation|pronounce|fluency|fluent|audio|spoken|speech recognition|accent|pauses?|voice|sounds like)/i.test(text);
}

function isCasualTextContext(context: string) {
  return /(friend|classmate|party|casual|informal|友達|友だち|友人|親友|クラスメート|同級生|パーティー|遊び|友だち|友達)/i.test(context);
}

function registerContextForSet(set: APPromptSet) {
  return `${set.title} ${set.situation} ${set.prompts.join(' ')}`;
}

function sanitizeFeedbackText(text: unknown, mode: APPromptSet['mode'], context = ''): string | null {
  if (typeof text !== 'string') return null;
  if (isWrongModalityFeedback(text, mode)) return null;
  if (mode === 'texting' && isCasualTextContext(context)) {
    const suggestsPoliteAsFix = /(use|try|add|needs?|should).{0,32}(です|ます|desu|masu|polite)|(?:です|ます|desu|masu).{0,32}(for clarity|complete sentence|clearer|more complete)/i.test(text);
    if (suggestsPoliteAsFix) {
      return 'For a friend/casual text, avoid defaulting to です/ます; use plain/casual endings like 行く, だ, 〜ね, or 〜よ, then add one useful detail that answers the message.';
    }
    if (/complete sentences?/i.test(text)) {
      return text.replace(/complete sentences?/ig, 'useful, situation-specific replies');
    }
  }
  return text;
}

function sanitizeTextList(items: unknown, mode: APPromptSet['mode'], context = ''): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is string => typeof item === 'string')
    .map((item) => sanitizeFeedbackText(item, mode, context))
    .filter((item): item is string => Boolean(item));
}

function sanitizeAPReview(review: APSessionReview, set: APPromptSet): APSessionReview {
  const setContext = registerContextForSet(set);
  return {
    ...review,
    improvements: sanitizeTextList(review.improvements, set.mode, setContext),
    weakSkills: sanitizeTextList(review.weakSkills, set.mode, setContext),
    turns: review.turns.map((turn) => ({
      ...turn,
      reason: sanitizeFeedbackText(turn.reason, set.mode, `${setContext} ${turn.prompt}`)
        ?? (set.mode === 'conversation'
          ? 'Reviewed as spoken AP conversation.'
          : 'Reviewed as AP text chat.'),
      improvements: sanitizeTextList(turn.improvements, set.mode, `${setContext} ${turn.prompt}`),
      weakSkills: sanitizeTextList(turn.weakSkills, set.mode, `${setContext} ${turn.prompt}`),
    })),
  };
}

function summaryFor(review: APSessionReview): string {
  if (review.score >= 5) {
    return 'AP 5-ready for this set: clear task completion, specific details, and strong control.';
  }
  if (review.score >= 4) {
    return 'Strong AP response pattern. The fastest gain is adding one more precise detail per turn.';
  }
  if (review.score >= 3) {
    return 'Understandable, but still developing. Focus on directly answering each prompt with useful, situation-specific detail.';
  }
  if (review.score >= 2) {
    return 'Some communication is present. Build short replies that clearly answer the message before worrying about complex grammar.';
  }
  return 'This set needs a restart. Aim for one clear Japanese reply that answers every prompt.';
}
