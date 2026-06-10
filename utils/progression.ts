import type { Difficulty } from '@/data/types';

export interface PlayerLevel {
  level: number;
  label: string;
  currentXP: number;
  levelStartXP: number;
  nextLevelXP: number;
  progress: number;
  allowedDifficulties: Difficulty[];
}

export function getPlayerLevel(totalXP: number): PlayerLevel {
  const xp = Math.max(0, totalXP);
  let level = 1;

  while (level < 100 && xp >= xpForLevel(level + 1)) {
    level += 1;
  }

  const levelStartXP = xpForLevel(level);
  const nextLevelXP = level >= 100 ? levelStartXP : xpForLevel(level + 1);
  const requiredForNext = Math.max(1, nextLevelXP - levelStartXP);
  const progress = level >= 100 ? 1 : Math.min(1, (xp - levelStartXP) / requiredForNext);

  return {
    level,
    label: levelLabel(level),
    currentXP: xp,
    levelStartXP,
    nextLevelXP,
    progress,
    allowedDifficulties: allowedDifficultiesForLevel(level),
  };
}

export function xpForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.min(100, Math.floor(level)));
  if (safeLevel === 1) return 0;
  return Math.round(70 * (safeLevel - 1) ** 1.55);
}

function levelLabel(level: number): string {
  if (level >= 85) return 'Master';
  if (level >= 65) return 'Expert';
  if (level >= 40) return 'Advanced';
  if (level >= 20) return 'Conversational';
  if (level >= 8) return 'Learner';
  return 'Novice';
}

function allowedDifficultiesForLevel(level: number): Difficulty[] {
  if (level >= 20) return ['beginner', 'intermediate', 'advanced'];
  if (level >= 8) return ['beginner', 'intermediate'];
  return ['beginner'];
}

export function difficultyRank(difficulty: Difficulty): number {
  if (difficulty === 'advanced') return 3;
  if (difficulty === 'intermediate') return 2;
  return 1;
}
