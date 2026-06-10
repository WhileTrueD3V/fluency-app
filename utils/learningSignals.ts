import type { SessionRecord, SavedItemType } from '@/utils/storage';

export type SkillCode = 'LSN' | 'SPK' | 'RD' | 'WRT';

const SKILL_BY_TYPE: Record<SavedItemType, SkillCode> = {
  listening: 'LSN',
  speaking: 'SPK',
  conversation: 'SPK',
  reading: 'RD',
  texting: 'WRT',
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function weightedAverage(sessions: SessionRecord[]) {
  const weighted = sessions.reduce((sum, session) => {
    const reliability = Math.max(1, Math.min(4, session.total || 1));
    return sum + session.score * reliability;
  }, 0);
  const weight = sessions.reduce((sum, session) => sum + Math.max(1, Math.min(4, session.total || 1)), 0);
  return weight > 0 ? weighted / weight : 0;
}

function skillAverage(sessions: SessionRecord[], skill: SkillCode) {
  const matching = sessions.filter((session) => SKILL_BY_TYPE[session.type] === skill);
  return matching.length > 0 ? weightedAverage(matching) : null;
}

export function getBestSkill(sessions: SessionRecord[], languageCode: string): SkillCode | '--' {
  const relevant = sessions.filter((session) => session.languageCode === languageCode);
  const ranked = (['LSN', 'SPK', 'RD', 'WRT'] as const)
    .map((skill) => ({ skill, average: skillAverage(relevant, skill) }))
    .filter((item): item is { skill: SkillCode; average: number } => item.average !== null)
    .sort((a, b) => b.average - a.average);

  return ranked[0]?.skill ?? '--';
}

export function getDevelopmentIndex(sessions: SessionRecord[], languageCode: string): number {
  const relevant = sessions
    .filter((session) => session.languageCode === languageCode)
    .sort((a, b) => b.date - a.date);

  if (relevant.length < 4) return 0;

  const recent = relevant.slice(0, 6);
  const previous = relevant.slice(6, 12);
  if (previous.length < 2) return 0;

  const recentAverage = weightedAverage(recent);
  const previousAverage = weightedAverage(previous);
  const rawDelta = (recentAverage - previousAverage) / 100;
  const sampleConfidence = clamp(Math.min(recent.length, previous.length) / 6, 0.25, 1);
  const stability = 1 - clamp(Math.abs(rawDelta) * 0.7, 0, 0.35);

  return clamp(rawDelta * 2.4 * sampleConfidence * stability, -1, 1);
}

export function formatDevelopmentIndex(index: number): string {
  if (Math.abs(index) < 0.005) return '0.00';
  return `${index > 0 ? '+' : ''}${index.toFixed(2)}`;
}

const JAPANESE_MARKS = [
  { level: 100, glyph: '達' },
  { level: 75, glyph: '練' },
  { level: 50, glyph: '試' },
  { level: 30, glyph: '話' },
  { level: 15, glyph: '読' },
  { level: 5, glyph: '聴' },
  { level: 2, glyph: '語' },
  { level: 1, glyph: '日' },
];

export function getLanguageProgressGlyph(languageCode: string, level: number): string | undefined {
  if (languageCode !== 'ja') return undefined;
  return JAPANESE_MARKS.find((mark) => level >= mark.level)?.glyph ?? '日';
}
