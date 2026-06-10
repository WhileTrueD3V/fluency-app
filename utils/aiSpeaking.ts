import { getAIEndpoint } from '@/utils/aiApi';
import { getAIFeedbackLevel, type AIFeedbackLevel } from '@/utils/storage';

export interface AISpeakingReviewRequest {
  languageCode: string;
  feedbackLevel?: AIFeedbackLevel;
  englishPrompt: string;
  targetAnswer: string;
  acceptableAnswers: string[];
  transcript: string;
  confidence: number;
  targetWasHeard: boolean;
  delivery?: {
    expectedDurationMs: number;
    spokenDurationMs: number;
    paceRatio: number;
    firstSpeechDelayMs: number | null;
    finalSegmentCount: number;
    restartCount: number;
    naturalnessCap: number;
    notes: string[];
  };
  localScores: {
    translationAccuracy: number;
    pronunciation: number;
    naturalness: number;
    overall: number;
  };
}

export interface AISpeakingReview {
  provider: 'remote-ai';
  translationAccuracy: number;
  pronunciation: number;
  naturalness: number;
  overall: number;
  pronunciationFeedback: string;
  naturalnessFeedback: string;
  meaningFeedback: string;
  coachNotes: string[];
}

export interface AISpeakingReviewUnavailable {
  provider: 'unavailable';
  error: string;
}

export type AISpeakingReviewResponse = AISpeakingReview | AISpeakingReviewUnavailable;

function clampScore(value: unknown, fallback: number) {
  const score = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function sanitizeSpokenFeedback(text: unknown, fallback: string) {
  if (typeof text !== 'string') return fallback;
  if (/(comma|commas|period|periods|punctuation|separator|separators|spelling|written formatting|reads as|run-on|initial pause|long pause|silence before|hit record)/i.test(text)) {
    return fallback;
  }
  return text;
}

function sanitizeCoachNotes(notes: unknown): string[] {
  if (!Array.isArray(notes)) return [];
  return notes
    .filter((note): note is string => typeof note === 'string')
    .filter((note) => !/(comma|commas|period|periods|punctuation|separator|separators|spelling|written formatting|reads as|run-on|initial pause|long pause|silence before|hit record)/i.test(note))
    .slice(0, 3);
}

export async function reviewSpeakingAttemptWithAI(
  request: AISpeakingReviewRequest,
): Promise<AISpeakingReviewResponse | null> {
  const endpoint = getAIEndpoint();
  if (!endpoint || !request.transcript.trim()) return null;
  const feedbackLevel = request.feedbackLevel ?? await getAIFeedbackLevel();

  try {
    const response = await fetch(`${endpoint}/review-speaking-attempt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...request, feedbackLevel }),
    });

    if (!response.ok) {
      let error = `AI review unavailable (${response.status}).`;
      try {
        const body = await response.json() as { error?: { message?: string } } | { error?: string };
        const message = typeof body.error === 'string' ? body.error : body.error?.message;
        if (message) error = message;
      } catch {
        // Keep status-based message.
      }
      return { provider: 'unavailable', error };
    }
    const remote = await response.json() as Partial<AISpeakingReview>;

    return {
      provider: 'remote-ai',
      translationAccuracy: clampScore(
        remote.translationAccuracy,
        request.localScores.translationAccuracy,
      ),
      pronunciation: clampScore(remote.pronunciation, request.localScores.pronunciation),
      naturalness: clampScore(remote.naturalness, request.localScores.naturalness),
      overall: clampScore(remote.overall, request.localScores.overall),
      pronunciationFeedback: sanitizeSpokenFeedback(
        remote.pronunciationFeedback,
        'Pronunciation reviewed by the AI coach.',
      ),
      naturalnessFeedback: sanitizeSpokenFeedback(
        remote.naturalnessFeedback,
        'Naturalness reviewed by the AI coach.',
      ),
      meaningFeedback: sanitizeSpokenFeedback(
        remote.meaningFeedback,
        'Meaning reviewed by the AI coach.',
      ),
      coachNotes: sanitizeCoachNotes(remote.coachNotes),
    };
  } catch {
    return null;
  }
}
