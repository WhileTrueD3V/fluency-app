import type { LanguageCode } from '@/constants/languages';
import type { Difficulty, ListeningQuestion, ReadingPassageSet, SpeakingPrompt } from '@/data/types';
import {
  generatePracticeContent,
  parseAIAPPromptSets,
  parseAIListeningQuestions,
  parseAIReadingSets,
  parseAISpeakingPrompts,
  type AIPracticeMode,
} from '@/utils/aiContent';
import type { APPromptSet } from '@/data/apPractice';
import { buildAIPersonalizationProfile } from '@/utils/personalization';
import { getPlayerLevel } from '@/utils/progression';
import {
  chooseStrongestChallengeBoost,
  getAstroChallengeBoostState,
  getChallengeBoostState,
} from '@/utils/challengeBoost';
import {
  getGeneratedPromptCache,
  getRecentPromptIds,
  getSessionHistory,
  getStartingLevelProfile,
  setGeneratedPromptCache,
  type GeneratedPromptItem,
  type PromptHistoryType,
} from '@/utils/storage';

type PracticeCache = {
  listening: Partial<Record<LanguageCode, ListeningQuestion[]>>;
  reading: Partial<Record<LanguageCode, ReadingPassageSet[]>>;
  speaking: Partial<Record<LanguageCode, SpeakingPrompt[]>>;
  conversation: Partial<Record<LanguageCode, APPromptSet[]>>;
  texting: Partial<Record<LanguageCode, APPromptSet[]>>;
};

const PREWARM_COUNTS: Record<PromptHistoryType, number> = {
  listening: 3,
  reading: 2,
  speaking: 4,
  conversation: 1,
  texting: 1,
};

const generatedMemoryCache: PracticeCache = {
  listening: {},
  reading: {},
  speaking: {},
  conversation: {},
  texting: {},
};

const DEFAULT_TARGET_SKILLS: Record<AIPracticeMode, string[]> = {
  listening: [
    'Generate fresh AP Japanese listening items that feel teacher-written, level-aware, and ready for the current drill.',
    'Generated content is the primary path; local static content is only an offline fallback.',
    'Vary genre aggressively: school message, voicemail, event announcement, host-family plan, radio blurb, interview, club notice, museum notice, class trip update, weather delay, lost-item call, or short dialogue.',
    'Do not paraphrase a recent topic, noun set, location, correct answer, or question stem; each new item needs a visibly different situation.',
    'Test main idea, detail, inference, speaker intent, or cultural context; do not make it a vocabulary-only quiz.',
    'Avoid generic train-platform, cashier, receipt, point-card, weather-only, and payment prompts unless the user explicitly needs that exact context.',
    'Use four plausible English choices with one clearly correct answer.',
  ],
  reading: [
    'Generate fresh AP Japanese reading passage sets with 2-4 linked questions for the current drill.',
    'Generated content is the primary path; do not imitate local fallback passages or recent cached sources.',
    'Vary genre: school notice, schedule note, email, flyer, article excerpt, review, class message, or message thread.',
    'Do not reuse the same topic family, answer logic, or surface wording from recent reading sets.',
    'Mix detail, purpose, inference, and context questions across the passage.',
    'Scale length, kanji density, and furigana support by level; harder levels should feel materially harder.',
    'Do not write inline furigana, romaji, or parenthetical readings in the passage. The app will show readings only for non-AP kanji.',
    'Beginner reading should stay short with familiar AP/basic kanji; intermediate and advanced reading may introduce denser kanji and inference load.',
    'Keep the passage internally consistent and never reveal the translation through the choices.',
  ],
  speaking: [
    'Generate fresh spoken-production prompts for the current drill, not worksheet sentences.',
    'Generated content is the primary path; prompts should expand variety and avoid recent/local prompt shapes.',
    'English prompt should be answerable aloud in one natural sentence or two short clauses.',
    'Each prompt must use a fresh speech act and scenario; do not make another version of a recent prompt.',
    'Vary function: invite, decline, clarify, apologize, ask permission, confirm plans, explain a reason, state preference.',
    'Include multiple natural acceptable Japanese answers, because model answers are examples only.',
    'Never make correctness depend on punctuation, written formatting, kanji choice, or comma-like clause separation.',
  ],
  conversation: [
    'Generate fresh AP Japanese interpersonal speaking conversation sets with exactly 4 turns.',
    'Each set should feel like a recorded AP conversation, not a worksheet translation drill.',
    'Prompts should require direct responses, clarification, confirmation, polite/casual register choice, or keeping the exchange alive.',
    'Model answers are examples only; suggestedKeywords should be broad communicative cues, not exact wording requirements.',
    'Avoid repeating recent situations, relationship roles, answer logic, or prompt openings.',
  ],
  texting: [
    'Generate fresh AP Japanese text-chat sets with exactly 4 message turns.',
    'Each set should feel like a timed interpersonal writing task with natural short replies.',
    'Target register, sentence control, task completion, and message clarity.',
    'Model answers should sound like plausible Japanese messages, not translated essays.',
    'Avoid repeating recent situations, relationship roles, answer logic, or prompt openings.',
  ],
};

function normalizePracticeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[。、，,.!?！？「」『』（）()【】\[\]{}"'`~・:：;；\s-]/g, '')
    .slice(0, 260);
}

function practiceItemText(item: GeneratedPromptItem) {
  if ('transcript' in item) {
    return [
      item.context,
      item.category,
      item.question,
      item.transcript,
      item.choices[item.correctIndex] ?? '',
    ].join(' ');
  }
  if ('passage' in item) {
    return [
      item.title,
      item.context,
      item.category,
      item.passage,
      ...item.questions.map((question) => question.question),
    ].join(' ');
  }
  if ('english' in item) {
    return [
      item.english,
      item.hint,
      ...item.acceptableAnswers.slice(0, 3),
    ].join(' ');
  }
  return [
    item.title,
    item.situation,
    ...item.prompts,
    ...item.modelAnswers.slice(0, 2),
  ].join(' ');
}

function practiceItemTopicText(item: GeneratedPromptItem) {
  if ('transcript' in item) return [item.context, item.category, item.question].join(' ');
  if ('passage' in item) return [item.title, item.context, item.category, ...item.questions.map((question) => question.question)].join(' ');
  if ('english' in item) return item.english;
  return [item.title, item.situation, ...item.prompts.slice(0, 2)].join(' ');
}

function practiceFingerprint(item: GeneratedPromptItem) {
  return normalizePracticeText(practiceItemText(item));
}

function practiceTopicFingerprint(item: GeneratedPromptItem) {
  return normalizePracticeText(practiceItemTopicText(item)).slice(0, 150);
}

function topicTokens(value: string): string[] {
  return Array.from(new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9一-龯ぁ-んァ-ヶー]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  ));
}

function isCloseTopicMatch(topic: string, blockedTopic: string) {
  if (!topic || !blockedTopic) return false;
  if (topic === blockedTopic || topic.includes(blockedTopic) || blockedTopic.includes(topic)) return true;

  const topicSet = new Set(topicTokens(topic));
  const blockedTokens = topicTokens(blockedTopic);
  if (topicSet.size === 0 || blockedTokens.length === 0) return false;

  const overlap = blockedTokens.filter((token) => topicSet.has(token)).length;
  return overlap >= 3 && overlap / Math.min(topicSet.size, blockedTokens.length) >= 0.6;
}

function hasBlockedTopic(topic: string, blockedTopics: Set<string>) {
  for (const blockedTopic of blockedTopics) {
    if (isCloseTopicMatch(topic, blockedTopic)) return true;
  }
  return false;
}

function hasBlockedTopicTokens(item: GeneratedPromptItem, blockedTopicTokenSets: string[][]) {
  const tokens = new Set(topicTokens(practiceItemTopicText(item)));
  if (tokens.size === 0) return false;

  return blockedTopicTokenSets.some((blockedTokens) => {
    if (blockedTokens.length === 0) return false;
    const overlap = blockedTokens.filter((token) => tokens.has(token)).length;
    return overlap >= 3 && overlap / Math.min(tokens.size, blockedTokens.length) >= 0.6;
  });
}

export function uniquePracticeItems<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const generatedItem = item as T & Partial<GeneratedPromptItem>;
    const fingerprint = 'languageCode' in generatedItem || 'difficulty' in generatedItem
      ? practiceFingerprint(generatedItem as GeneratedPromptItem)
      : '';
    const key = fingerprint ? `${item.id}:${fingerprint}` : item.id;
    if (seen.has(item.id) || seen.has(key) || (fingerprint && seen.has(fingerprint))) return false;
    seen.add(item.id);
    if (fingerprint) {
      seen.add(key);
      seen.add(fingerprint);
    }
    return true;
  });
}

export function filterFreshPracticeItems<T extends GeneratedPromptItem>(
  items: T[],
  recentPromptIds: string[],
  recentItems: GeneratedPromptItem[] = [],
): T[] {
  const recentIdSet = new Set(recentPromptIds);
  const recentlySeenItems = items.filter((item) => recentIdSet.has(item.id));
  const blockedItems = uniquePracticeItems([...recentlySeenItems, ...recentItems]);
  const blockedFingerprints = new Set(blockedItems.map(practiceFingerprint).filter(Boolean));
  const blockedTopics = new Set(blockedItems.map(practiceTopicFingerprint).filter(Boolean));
  const blockedTopicTokenSets = blockedItems.map((item) => topicTokens(practiceItemTopicText(item)));
  return uniquePracticeItems(items).filter((item) => {
    if (recentIdSet.has(item.id)) return false;
    const fingerprint = practiceFingerprint(item);
    if (fingerprint && blockedFingerprints.has(fingerprint)) return false;
    const topic = practiceTopicFingerprint(item);
    if (topic && hasBlockedTopic(topic, blockedTopics)) return false;
    if (hasBlockedTopicTokens(item, blockedTopicTokenSets)) return false;
    return true;
  });
}

export function selectPracticeItems<T extends GeneratedPromptItem>(
  items: T[],
  count: number,
  recentPromptIds: string[],
  recentItems: GeneratedPromptItem[] = [],
): T[] {
  const deduped = uniquePracticeItems(items);
  const fresh = filterFreshPracticeItems(deduped, recentPromptIds, recentItems);
  if (fresh.length >= count) return fresh.slice(0, count);

  const selectedIds = new Set(fresh.map((item) => item.id));
  const recentRank = new Map(recentPromptIds.map((id, index) => [id, index]));
  const lastResort = deduped
    .filter((item) => !selectedIds.has(item.id))
    .sort((a, b) => (recentRank.get(b.id) ?? 9999) - (recentRank.get(a.id) ?? 9999));

  return uniquePracticeItems([...fresh, ...lastResort]).slice(0, count);
}

export function getGeneratedPracticeMemory<T extends GeneratedPromptItem>(
  mode: PromptHistoryType,
  languageCode: LanguageCode,
): T[] {
  return (generatedMemoryCache[mode][languageCode] ?? []) as T[];
}

function setGeneratedPracticeMemory<T extends GeneratedPromptItem>(
  mode: PromptHistoryType,
  languageCode: LanguageCode,
  items: T[],
) {
  generatedMemoryCache[mode][languageCode] = items as never;
}

export async function loadGeneratedPracticeCache<T extends GeneratedPromptItem>(
  mode: PromptHistoryType,
  languageCode: LanguageCode,
): Promise<T[]> {
  const stored = await getGeneratedPromptCache<T>(languageCode, mode);
  if (stored.length > 0) setGeneratedPracticeMemory(mode, languageCode, stored);
  return stored;
}

function parseGeneratedItems(
  mode: PromptHistoryType,
  items: GeneratedPromptItem[],
): GeneratedPromptItem[] {
  if (mode === 'listening') return parseAIListeningQuestions(items);
  if (mode === 'reading') return parseAIReadingSets(items);
  if (mode === 'speaking') return parseAISpeakingPrompts(items);
  return parseAIAPPromptSets(items, mode);
}

function weakMemoryTargetSkills(profile: Awaited<ReturnType<typeof buildAIPersonalizationProfile>>) {
  return profile.weakMemory.slice(0, 5).map((memory) => {
    const vocab = memory.vocab.length > 0 ? `; vocab cues: ${memory.vocab.join(', ')}` : '';
    return `Repair recurring weak area: ${memory.topic} (${memory.rubric}, ${memory.mistakeType}, ${memory.missCount} misses)${vocab}`;
  });
}

async function challengeCalibration(
  baseLevel: number,
  profile: Awaited<ReturnType<typeof buildAIPersonalizationProfile>>,
  mode: PromptHistoryType,
  languageCode: LanguageCode,
) {
  const [startingProfile, sessions] = await Promise.all([
    getStartingLevelProfile(),
    getSessionHistory(),
  ]);
  const boost = chooseStrongestChallengeBoost(
    getChallengeBoostState(baseLevel, profile.recentAttempts, mode),
    getAstroChallengeBoostState(baseLevel, startingProfile, sessions, languageCode),
  );

  return {
    baseLevel,
    effectiveLevel: boost.effectiveLevel,
    difficulty: boost.difficulty,
    label: boost.label,
    signal: boost.signal,
    boosted: boost.active,
  };
}

function levelPressureGuidance({
  baseLevel,
  effectiveLevel,
  difficulty,
  label,
  signal,
  boosted,
}: Awaited<ReturnType<typeof challengeCalibration>>) {
  const calibrationLine = boosted
    ? label === 'Astro Boost'
      ? `Astro Boost active from learner placement: displayed level ${baseLevel}, generation level ${effectiveLevel}. Use a fair stretch so the learner does not churn from work that feels too easy, while still checking their real ability.`
      : `Challenge calibration active: displayed level ${baseLevel}, generation level ${effectiveLevel}, ${signal.samples} recent samples averaging ${signal.average}%. Use ${label} so the learner does not churn from work that feels too easy.`
    : `No challenge boost yet: displayed level ${baseLevel}, generation level ${effectiveLevel}. Keep work level-fit while watching for strong scores.`;

  if (effectiveLevel <= 3) {
    return [
      calibrationLine,
      `Difficulty ceiling: ${difficulty}. Start easy but not childish: short prompts, familiar school/home/travel contexts, high-frequency vocabulary, one clear task at a time, and very light kanji.`,
      'Include one small confidence-check stretch inside the batch when possible, but do not add advanced AP traps, dense inference, or long answers.',
    ].join(' ');
  }
  if (effectiveLevel <= 7) {
    return [
      calibrationLine,
      `Difficulty ceiling: ${difficulty}. Stay beginner, but add visible stretch: simple reasons, time/place details, basic polite forms, and a slightly less obvious distractor.`,
      'Weakness repair should feel targeted and satisfying, not like repetitive beginner filler.',
    ].join(' ');
  }
  if (effectiveLevel <= 14) {
    return [
      calibrationLine,
      `Difficulty target: ${difficulty}. Move into intermediate load: two-clause answers, light inference, common kanji, and simple register decisions.`,
      'Keep the prompt approachable while making the weak rubric pattern visible.',
    ].join(' ');
  }
  if (effectiveLevel <= 19) {
    return [
      calibrationLine,
      `Difficulty target: ${difficulty}. Use stronger intermediate pressure: plausible distractors, more natural connective phrasing, and less obvious answer cues.`,
      'Do not use advanced density yet unless the allowed difficulty explicitly includes advanced.',
    ].join(' ');
  }
  if (effectiveLevel <= 39) {
    return [
      calibrationLine,
      `Difficulty target: ${difficulty}. AP-shaped pressure is appropriate: evidence/detail traps, register nuance, cultural context, and timed-response demands.`,
      'Keep the task aligned to the weak rubric dimension, not generic hard Japanese.',
    ].join(' ');
  }
  return [
    calibrationLine,
    `Difficulty target: ${difficulty}. Use high-level AP pressure: denser evidence, implied purpose, natural register shifts, and less scaffolded support.`,
    'Still keep the prompt answerable, coherent, and matched to the learner’s actual weak memory.',
  ].join(' ');
}

export async function generatePersonalizedPracticeBatch<T extends GeneratedPromptItem>({
  mode,
  languageCode,
  totalXP,
  recentPromptIds,
  count,
  targetSkills = [],
  timeoutMs = 7000,
}: {
  mode: PromptHistoryType;
  languageCode: LanguageCode;
  totalXP: number;
  recentPromptIds: string[];
  count: number;
  targetSkills?: string[];
  timeoutMs?: number;
}): Promise<T[]> {
  if (languageCode !== 'ja') return [];

  const level = getPlayerLevel(totalXP);
  const profile = await buildAIPersonalizationProfile(languageCode);
  const calibration = await challengeCalibration(level.level, profile, mode, languageCode);
  const recent = Array.from(new Set([
    ...profile.doNotRepeatIds,
    ...recentPromptIds,
  ]));
  const aiContent = await generatePracticeContent({
    mode: mode as AIPracticeMode,
    languageCode: 'ja',
    level: calibration.effectiveLevel,
    difficulty: calibration.difficulty,
    count,
    recentPromptIds: recent,
    targetSkills: [
      ...DEFAULT_TARGET_SKILLS[mode as AIPracticeMode],
      levelPressureGuidance(calibration),
      `Primary weak rubric dimension: ${profile.weakestRubric}`,
      `Current rank: ${profile.rank}`,
      ...weakMemoryTargetSkills(profile),
      ...profile.personalizationRules,
      ...targetSkills,
    ],
    profile,
  }, timeoutMs);

  const generated = aiContent ? parseGeneratedItems(mode, aiContent.items) : [];
  const existing = getGeneratedPracticeMemory(mode, languageCode);
  const freshGenerated = filterFreshPracticeItems(generated, recent, existing);
  if (freshGenerated.length === 0) return [];

  const combined = uniquePracticeItems([...freshGenerated, ...existing]).slice(0, 30);
  setGeneratedPracticeMemory(mode, languageCode, combined);
  await setGeneratedPromptCache(languageCode, mode, combined);
  return freshGenerated as T[];
}

export async function refreshGeneratedPracticeCache({
  mode,
  languageCode,
  totalXP,
  recentPromptIds,
  count,
  targetSkills = [],
}: {
  mode: PromptHistoryType;
  languageCode: LanguageCode;
  totalXP: number;
  recentPromptIds: string[];
  count: number;
  targetSkills?: string[];
}): Promise<GeneratedPromptItem[]> {
  if (languageCode !== 'ja') return [];

  const level = getPlayerLevel(totalXP);
  const recent = Array.from(new Set(recentPromptIds));
  const profile = await buildAIPersonalizationProfile(languageCode);
  const calibration = await challengeCalibration(level.level, profile, mode, languageCode);
  const existing = getGeneratedPracticeMemory(mode, languageCode);
  const aiContent = await generatePracticeContent({
    mode,
    languageCode: 'ja',
    level: calibration.effectiveLevel,
    difficulty: calibration.difficulty,
    count,
    recentPromptIds: Array.from(new Set([...profile.doNotRepeatIds, ...recent])),
    targetSkills: [
      ...DEFAULT_TARGET_SKILLS[mode],
      levelPressureGuidance(calibration),
      `Primary weak rubric dimension: ${profile.weakestRubric}`,
      ...weakMemoryTargetSkills(profile),
      ...targetSkills,
    ],
    profile,
  }, 4500);

  const generated = aiContent ? parseGeneratedItems(mode, aiContent.items) : [];
  const freshGenerated = filterFreshPracticeItems(
    generated,
    Array.from(new Set([...profile.doNotRepeatIds, ...recent])),
    existing,
  );
  if (freshGenerated.length === 0) return [];

  const combined = uniquePracticeItems([...freshGenerated, ...existing]).slice(0, 30);
  setGeneratedPracticeMemory(mode, languageCode, combined);
  await setGeneratedPromptCache(languageCode, mode, combined);
  return freshGenerated;
}

export async function prewarmGeneratedPracticeQueues({
  languageCode,
  totalXP,
  modes = ['listening', 'speaking'],
  targetSkills = [],
}: {
  languageCode: LanguageCode;
  totalXP: number;
  modes?: PromptHistoryType[];
  targetSkills?: string[];
}): Promise<void> {
  if (languageCode !== 'ja') return;

  await Promise.all(modes.map(async (mode) => {
    const [recentPromptIds, stored] = await Promise.all([
      getRecentPromptIds(languageCode, mode),
      loadGeneratedPracticeCache(mode, languageCode),
    ]);
    const ready = filterFreshPracticeItems(
      [
        ...getGeneratedPracticeMemory(mode, languageCode),
        ...stored,
      ],
      recentPromptIds,
    );
    const targetCount = PREWARM_COUNTS[mode];
    if (ready.length >= Math.min(2, targetCount)) return;
    await refreshGeneratedPracticeCache({
      mode,
      languageCode,
      totalXP,
      recentPromptIds,
      count: targetCount,
      targetSkills: [
        'background queue prewarm before the learner opens this drill',
        'fresh non-repeating AP Japanese content',
        ...targetSkills,
      ],
    });
  }));
}
