import type { Difficulty } from '@/data/types';
import { getPlayerLevel, xpForLevel } from '@/utils/progression';
import type { PromptHistoryType } from '@/utils/storage';

export type ChallengeBoostMode = PromptHistoryType;

export type ChallengeBoostAttempt = {
  type: string;
  score: number;
};

export type ChallengeBoostSignal = {
  samples: number;
  average: number;
  strongCount: number;
  excellentCount: number;
  lowCount: number;
};

export type ChallengeBoostState = {
  active: boolean;
  multiplier: number;
  tier: 0 | 1 | 2 | 3;
  label: string;
  baseLevel: number;
  effectiveLevel: number;
  difficulty: Difficulty;
  signal: ChallengeBoostSignal;
};

export const CHALLENGE_BOOST_XP_MULTIPLIER = 2;

export const CHALLENGE_BOOST_MODES: ChallengeBoostMode[] = [
  'listening',
  'reading',
  'speaking',
  'conversation',
  'texting',
];

function strongestDifficultyForLevel(level: number): Difficulty {
  const generationLevel = getPlayerLevel(xpForLevel(level));
  return generationLevel.allowedDifficulties[generationLevel.allowedDifficulties.length - 1];
}

export function recentPerformanceSignal(
  attempts: ChallengeBoostAttempt[],
  mode: ChallengeBoostMode,
): ChallengeBoostSignal {
  const modeAttempts = attempts
    .filter((attempt) => attempt.type === mode)
    .slice(0, 4);
  const samples = modeAttempts.length >= 2
    ? modeAttempts
    : attempts.slice(0, 6);
  const average = samples.length > 0
    ? Math.round(samples.reduce((sum, attempt) => sum + attempt.score, 0) / samples.length)
    : 0;

  return {
    samples: samples.length,
    average,
    strongCount: samples.filter((attempt) => attempt.score >= 85).length,
    excellentCount: samples.filter((attempt) => attempt.score >= 92).length,
    lowCount: samples.filter((attempt) => attempt.score < 72).length,
  };
}

export function getChallengeBoostState(
  baseLevel: number,
  attempts: ChallengeBoostAttempt[],
  mode: ChallengeBoostMode,
): ChallengeBoostState {
  const signal = recentPerformanceSignal(attempts, mode);
  let effectiveLevel = baseLevel;
  let label = 'standard level fit';
  let tier: ChallengeBoostState['tier'] = 0;

  if (signal.samples >= 2 && signal.lowCount === 0 && signal.average >= 86 && signal.strongCount >= 2) {
    effectiveLevel = Math.max(effectiveLevel, Math.min(10, baseLevel + 5));
    label = 'early stretch calibration';
    tier = 1;
  }

  if (signal.samples >= 3 && signal.lowCount === 0 && signal.average >= 92 && signal.excellentCount >= 2) {
    effectiveLevel = Math.max(effectiveLevel, Math.min(14, baseLevel + 8));
    label = 'strong-performance stretch';
    tier = 2;
  }

  if (signal.samples >= 5 && signal.lowCount === 0 && signal.average >= 94 && signal.excellentCount >= 4) {
    effectiveLevel = Math.max(effectiveLevel, Math.min(20, baseLevel + 12));
    label = 'fast-track AP pressure';
    tier = 3;
  }

  const active = effectiveLevel > baseLevel;

  return {
    active,
    multiplier: active ? CHALLENGE_BOOST_XP_MULTIPLIER : 1,
    tier,
    label,
    baseLevel,
    effectiveLevel,
    difficulty: strongestDifficultyForLevel(effectiveLevel),
    signal,
  };
}

export function getBestChallengeBoostState(
  baseLevel: number,
  attempts: ChallengeBoostAttempt[],
  modes: ChallengeBoostMode[] = CHALLENGE_BOOST_MODES,
): ChallengeBoostState {
  const boosts = modes.map((mode) => getChallengeBoostState(baseLevel, attempts, mode));
  return boosts.sort((a, b) => (
    b.tier - a.tier
    || b.effectiveLevel - a.effectiveLevel
    || b.signal.average - a.signal.average
  ))[0] ?? getChallengeBoostState(baseLevel, attempts, 'listening');
}

export function applyChallengeBoostXP(baseXP: number, boost: ChallengeBoostState): number {
  if (!boost.active || baseXP <= 0) return baseXP;
  return Math.max(baseXP + 1, Math.round(baseXP * boost.multiplier));
}
