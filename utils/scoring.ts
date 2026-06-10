export type Rank = 'Beginner' | 'Functional' | 'Natural' | 'Native-like';

export interface SpeakingResult {
  score: number;
  rank: Rank;
  feedback: string;
  accuracyScore: number;
  naturalnessScore: number;
  understandabilityScore: number;
}

/** Normalize text for comparison: lowercase, strip punctuation, trim */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[。、！？!?.,;:'"「」『』【】（）()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/** 0–1 similarity score between two normalized strings */
function stringSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(na, nb);
  return Math.max(0, 1 - dist / maxLen);
}

/** Word-overlap (Jaccard) score between two strings */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalize(b).split(' ').filter(Boolean));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

function usesCompactScript(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
}

function characterOverlap(a: string, b: string): number {
  const charsA = new Set(normalize(a).replace(/\s/g, '').split('').filter(Boolean));
  const charsB = new Set(normalize(b).replace(/\s/g, '').split('').filter(Boolean));
  const intersection = [...charsA].filter((char) => charsB.has(char)).length;
  const union = new Set([...charsA, ...charsB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Best similarity against any acceptable answer */
function bestMatch(transcript: string, acceptableAnswers: string[]): number {
  let best = 0;
  for (const answer of acceptableAnswers) {
    const textSimilarity = stringSimilarity(transcript, answer);
    const overlap = usesCompactScript(transcript) || usesCompactScript(answer)
      ? characterOverlap(transcript, answer)
      : wordOverlap(transcript, answer);
    const sim = usesCompactScript(transcript) || usesCompactScript(answer)
      ? (textSimilarity * 0.75 + overlap * 0.25)
      : (textSimilarity + overlap) / 2;
    if (sim > best) best = sim;
  }
  return best;
}

function scoreToRank(score: number): Rank {
  if (score >= 90) return 'Native-like';
  if (score >= 75) return 'Natural';
  if (score >= 55) return 'Functional';
  return 'Beginner';
}

function generateFeedback(
  rank: Rank,
  accuracyScore: number,
  naturalnessScore: number,
): string {
  if (rank === 'Native-like') {
    return 'Excellent! Sounds completely natural to a native speaker.';
  }
  if (rank === 'Natural') {
    if (accuracyScore > naturalnessScore) {
      return 'Good meaning — phrasing could sound slightly more natural.';
    }
    return 'Natural and clear. Minor refinements would make it perfect.';
  }
  if (rank === 'Functional') {
    if (accuracyScore < 0.5) {
      return 'The meaning was partially conveyed. Keep practicing the vocabulary.';
    }
    return 'Understandable, but slightly unnatural phrasing. Try listening to more native examples.';
  }
  // Beginner
  return 'Good attempt! Focus on the core vocabulary and sentence structure.';
}

/**
 * Evaluate a speaking attempt.
 * transcript — what the speech recognizer heard
 * acceptableAnswers — list of valid target-language answers
 * pronunciationConfidence — 0–1 from speech recognizer (optional)
 */
export function evaluateSpeaking(
  transcript: string,
  acceptableAnswers: string[],
  pronunciationConfidence = 0.8,
): SpeakingResult {
  if (!transcript.trim()) {
    return {
      score: 0,
      rank: 'Beginner',
      feedback: 'No speech detected. Try again in a quiet environment.',
      accuracyScore: 0,
      naturalnessScore: 0,
      understandabilityScore: 0,
    };
  }

  const similarity = bestMatch(transcript, acceptableAnswers);

  // Component scores (0–100)
  const accuracyScore = Math.round(similarity * 100);
  const understandabilityScore = Math.round(
    ((similarity * 0.7 + pronunciationConfidence * 0.3) * 100),
  );
  const naturalnessScore = Math.round(
    ((similarity * 0.6 + pronunciationConfidence * 0.4) * 100),
  );

  // Weighted overall (accuracy carries most weight)
  const overall = Math.round(
    accuracyScore * 0.5 + naturalnessScore * 0.25 + understandabilityScore * 0.25,
  );

  const rank = scoreToRank(overall);
  const feedback = generateFeedback(rank, similarity, pronunciationConfidence);

  return {
    score: overall,
    rank,
    feedback,
    accuracyScore,
    naturalnessScore,
    understandabilityScore,
  };
}

/** XP awarded per score band */
export function xpForScore(score: number): number {
  if (score >= 90) return 50;
  if (score >= 75) return 35;
  if (score >= 55) return 20;
  return 10;
}

/** XP for a correct listening answer */
export const LISTENING_CORRECT_XP = 15;
/** XP for an incorrect listening answer (participation) */
export const LISTENING_ATTEMPT_XP = 3;
