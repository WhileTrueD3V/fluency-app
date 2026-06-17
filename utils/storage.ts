/**
 * All data is stored locally on-device using AsyncStorage.
 * Optional first-drill feedback can also be submitted to the configured Kibbo server.
 * No accounts, no passive telemetry, no tracking.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ListeningQuestion, ReadingPassageSet, SpeakingPrompt } from '@/data/types';
import type { APPromptSet } from '@/data/apPractice';

export interface AppStats {
  totalSessions: number;
  totalCorrect: number;
  totalAnswered: number;
  bestStreak: number;
  bestSpeakingScore: number;
  totalXP: number;
  currentStreak: number;
  lastSessionDate: string | null;
  languageStats: Record<string, LanguageStats>;
}

export interface LanguageStats {
  totalSessions: number;
  totalCorrect: number;
  totalAnswered: number;
  bestStreak: number;
  bestSpeakingScore: number;
  totalXP: number;
  currentStreak: number;
  lastSessionDate: string | null;
}

export interface UserPrefs {
  selectedLanguage: string | null;
  onboardingComplete: boolean;
}

export type ThemeMode = 'light' | 'dark';
export type SubscriptionPlanId = 'basic' | 'pro' | 'premium' | 'elite';
export type AIFeedbackLevel = 'standard' | 'elite';
export type ReadingTextSize = 'standard' | 'large' | 'extraLarge';

export interface AppSettings {
  theme: ThemeMode;
  subscriptionPlan: SubscriptionPlanId;
  pendingSubscriptionPlan: SubscriptionPlanId | null;
  subscriptionCycleEndsAt: number | null;
  soundEffects: boolean;
  haptics: boolean;
  studyReminders: boolean;
  readingTextSize: ReadingTextSize;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  price: string;
  creditAllowance: number;
  creditCadence: 'starter' | 'monthly';
  aiFeedback: AIFeedbackLevel;
  summary: string;
  features: string[];
}

export interface CreditUsage {
  cycleKey: string;
  sessionsStarted: number;
  creditsSpent: number;
}

export interface APReviewSnapshot {
  score: number;
  label: string;
  summary: string;
  promptId?: string;
  title?: string;
  situation?: string;
  improvements: string[];
  weakSkills: string[];
  turns: Array<{
    index?: number;
    prompt: string;
    score?: number;
    answer: string;
    modelAnswer: string;
    recordingUri?: string | null;
    reason: string;
    improvements: string[];
    weakSkills?: string[];
  }>;
}

export interface SessionRecord {
  id: string;
  type: SavedItemType;
  languageCode: string;
  date: number;
  score: number;
  correct: number;
  total: number;
  xpEarned: number;
  mockId?: string;
  rewardKey?: string;
  apReview?: APReviewSnapshot;
}

export interface FirstCompletionFeedback {
  status: 'pending' | 'submitted' | 'dismissed';
  firstSessionId?: string;
  firstSessionType?: SavedItemType;
  rating?: number;
  comment?: string;
  remoteStatus?: 'pending' | 'submitted' | 'failed' | 'skipped';
  remoteId?: string | null;
  remoteSubmittedAt?: number;
  remoteLastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AttemptMemory {
  id: string;
  type: SavedItemType;
  languageCode: string;
  promptId: string;
  date: number;
  score: number;
  correct: boolean;
  question: string;
  userAnswer: string;
  expectedAnswer: string;
  context?: string;
  weakSkills?: string[];
}

export type AttemptMemoryInput = Omit<AttemptMemory, 'id' | 'date'> & {
  id?: string;
  date?: number;
};

export interface WeakMemoryItem {
  id: string;
  languageCode: string;
  type: SavedItemType;
  topic: string;
  vocab: string[];
  rubric: string;
  mistakeType: string;
  missCount: number;
  exposureCount: number;
  lastScore: number;
  priority: number;
  firstSeen: number;
  lastSeen: number;
  sourcePromptIds: string[];
  evidence: string[];
}

export interface SavedItem {
  id: string;
  type: SavedItemType;
  languageCode: string;
  promptId: string;
  question: string;
  answer: string;
  savedAt: number;
}

export type SavedItemType = 'listening' | 'speaking' | 'reading' | 'conversation' | 'texting';
export type MockSection = 'listening' | 'reading' | 'conversation' | 'texting';
export type PromptHistoryType = SavedItemType;
export type GeneratedPromptItem = ListeningQuestion | SpeakingPrompt | ReadingPassageSet | APPromptSet;
export type CreditSpendKind = 'drill' | 'miniMock';
export type StartingLevelChoiceId = 'absolute_novice' | 'classroom_starter' | 'course_ready' | 'ap_bound';

export interface StartingLevelChoice {
  id: StartingLevelChoiceId;
  label: string;
  shortLabel: string;
  targetLevel: number;
  xpMultiplier: number;
  description: string;
}

export interface StartingLevelProfile {
  choiceId: StartingLevelChoiceId;
  targetLevel: number;
  xpMultiplier: number;
  minimumDrills: number;
  failureLimit: number;
  lowReviewLimit: number;
  createdAt: number;
}

export interface AstroBoostProgress {
  active: boolean;
  choice: StartingLevelChoice;
  completedDrills: number;
  guaranteedDrillsRemaining: number;
  failedQuestions: number;
  lowReviews: number;
  currentLevel: number;
  targetLevel: number;
  xpMultiplier: number;
  reason: 'absolute_novice' | 'level_reached' | 'still_calibrating' | 'results_supported' | 'results_checked';
}

export const CREDIT_COSTS: Record<CreditSpendKind, number> = {
  drill: 1,
  miniMock: 3,
};

export interface MockProgress {
  id: string;
  startedAt: number;
  updatedAt: number;
  sectionScores: Partial<Record<MockSection, number>>;
  sectionXP: Partial<Record<MockSection, number>>;
}

const KEYS = {
  PREFS: '@fluent:prefs',
  STATS: '@fluent:stats',
  SESSIONS: '@fluent:sessions',
  SAVED: '@fluent:saved',
  MOCK: '@fluent:mock',
  RECENT_PROMPTS: '@fluent:recentPrompts',
  GENERATED_PROMPTS: '@fluent:generatedPrompts',
  SETTINGS: '@fluent:settings',
  LEGACY_DAILY_USAGE: '@fluent:dailyUsage',
  CREDIT_USAGE: '@fluent:creditUsage',
  ATTEMPT_MEMORY: '@fluent:attemptMemory',
  WEAK_MEMORY: '@fluent:weakMemory',
  FIRST_COMPLETION_FEEDBACK: '@fluent:firstCompletionFeedback',
  STARTING_LEVEL_PROFILE: '@fluent:startingLevelProfile',
  DRILL_SESSION_CONTENT: '@fluent:drillSessionContent',
  DRILL_SESSION_PROGRESS: '@fluent:drillSessionProgress',
} as const;

const RECENT_PROMPT_LIMIT = 80;
const ATTEMPT_MEMORY_LIMIT = 100;
const WEAK_MEMORY_LIMIT = 80;
const firstCompletionFeedbackListeners = new Set<() => void>();

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Starter',
    price: 'Free',
    creditAllowance: 10,
    creditCadence: 'starter',
    aiFeedback: 'standard',
    summary: '10 starter credits for generated AP Japanese practice.',
    features: ['10 starter credits', 'Generated AP drills', 'Standard rubric feedback', 'Mini Mock access'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99/mo',
    creditAllowance: 100,
    creditCadence: 'monthly',
    aiFeedback: 'elite',
    summary: '100 credits every month for serious AP score growth.',
    features: ['100 credits monthly', 'Monthly reset, no rollover', 'Error memory', 'Elite rubric feedback'],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: '$19.99/mo',
    creditAllowance: 300,
    creditCadence: 'monthly',
    aiFeedback: 'elite',
    summary: '300 credits every month for intensive AP Japanese coaching.',
    features: ['300 credits monthly', 'Monthly reset, no rollover', 'Priority generated drills', 'Deep speaking and writing notes'],
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  subscriptionPlan: 'basic',
  pendingSubscriptionPlan: null,
  subscriptionCycleEndsAt: null,
  soundEffects: true,
  haptics: true,
  studyReminders: false,
  readingTextSize: 'extraLarge',
};

export const STARTING_LEVEL_CHOICES: StartingLevelChoice[] = [
  {
    id: 'absolute_novice',
    label: 'Absolute Novice',
    shortLabel: 'Novice',
    targetLevel: 1,
    xpMultiplier: 1,
    description: 'I am basically starting from zero.',
  },
  {
    id: 'classroom_starter',
    label: 'Classroom Starter',
    shortLabel: 'Starter',
    targetLevel: 4,
    xpMultiplier: 1.25,
    description: 'I know some class Japanese and can handle simple phrases.',
  },
  {
    id: 'course_ready',
    label: 'Course Ready',
    shortLabel: 'Ready',
    targetLevel: 8,
    xpMultiplier: 1.5,
    description: 'I can work through familiar school-life prompts with support.',
  },
  {
    id: 'ap_bound',
    label: 'AP-bound',
    shortLabel: 'AP-bound',
    targetLevel: 12,
    xpMultiplier: 2,
    description: 'I am already practicing AP-style reading, writing, or speaking.',
  },
];

export const ASTRO_BOOST_MINIMUM_DRILLS = 15;

export function getStartingLevelChoice(choiceId: StartingLevelChoiceId): StartingLevelChoice {
  return STARTING_LEVEL_CHOICES.find((choice) => choice.id === choiceId) ?? STARTING_LEVEL_CHOICES[0];
}

export async function getStartingLevelProfile(): Promise<StartingLevelProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STARTING_LEVEL_PROFILE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StartingLevelProfile>;
    if (!parsed.choiceId) return null;
    const choice = getStartingLevelChoice(parsed.choiceId);
    return {
      choiceId: choice.id,
      targetLevel: parsed.targetLevel ?? choice.targetLevel,
      xpMultiplier: parsed.xpMultiplier ?? choice.xpMultiplier,
      minimumDrills: parsed.minimumDrills ?? ASTRO_BOOST_MINIMUM_DRILLS,
      failureLimit: parsed.failureLimit ?? 5,
      lowReviewLimit: parsed.lowReviewLimit ?? 2,
      createdAt: parsed.createdAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export async function saveStartingLevelChoice(choiceId: StartingLevelChoiceId): Promise<StartingLevelProfile> {
  const choice = getStartingLevelChoice(choiceId);
  const profile: StartingLevelProfile = {
    choiceId: choice.id,
    targetLevel: choice.targetLevel,
    xpMultiplier: choice.xpMultiplier,
    minimumDrills: ASTRO_BOOST_MINIMUM_DRILLS,
    failureLimit: 5,
    lowReviewLimit: 2,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(KEYS.STARTING_LEVEL_PROFILE, JSON.stringify(profile));
  return profile;
}

export function getAstroBoostProgress(
  profile: StartingLevelProfile | null,
  sessions: SessionRecord[],
  languageCode: string,
  currentLevel: number,
): AstroBoostProgress | null {
  if (!profile) return null;
  const choice = getStartingLevelChoice(profile.choiceId);
  const boostSessions = sessions.filter((session) => (
    session.languageCode === languageCode
    && session.date >= profile.createdAt
    && !session.mockId
  ));
  const completedDrills = boostSessions.length;
  const failedQuestions = boostSessions.reduce((sum, session) => {
    if (session.type === 'conversation' || session.type === 'texting') {
      return sum + (session.apReview && session.apReview.score < 4 ? 1 : 0);
    }
    return sum + Math.max(0, (session.total ?? 0) - (session.correct ?? 0));
  }, 0);
  const lowReviews = boostSessions.filter((session) => (
    (session.type === 'conversation' || session.type === 'texting')
    && session.apReview
    && session.apReview.score < 4
  )).length;
  const guaranteedDrillsRemaining = Math.max(0, profile.minimumDrills - completedDrills);

  let reason: AstroBoostProgress['reason'] = 'results_supported';
  if (choice.targetLevel <= 1) reason = 'absolute_novice';
  else if (currentLevel >= profile.targetLevel) reason = 'level_reached';
  else if (guaranteedDrillsRemaining > 0) reason = 'still_calibrating';
  else if (failedQuestions >= profile.failureLimit || lowReviews >= profile.lowReviewLimit) reason = 'results_checked';

  const active = (
    choice.targetLevel > 1
    && currentLevel < profile.targetLevel
    && (
      guaranteedDrillsRemaining > 0
      || (failedQuestions < profile.failureLimit && lowReviews < profile.lowReviewLimit)
    )
  );

  return {
    active,
    choice,
    completedDrills,
    guaranteedDrillsRemaining,
    failedQuestions,
    lowReviews,
    currentLevel,
    targetLevel: profile.targetLevel,
    xpMultiplier: profile.xpMultiplier,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export async function getPrefs(): Promise<UserPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PREFS);
    if (!raw) return { selectedLanguage: null, onboardingComplete: false };
    return JSON.parse(raw) as UserPrefs;
  } catch {
    return { selectedLanguage: null, onboardingComplete: false };
  }
}

export async function savePrefs(prefs: Partial<UserPrefs>): Promise<void> {
  const current = await getPrefs();
  await AsyncStorage.setItem(KEYS.PREFS, JSON.stringify({ ...current, ...prefs }));
}

// ---------------------------------------------------------------------------
// App settings / Subscription scaffold
// ---------------------------------------------------------------------------

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw), theme: 'light' } as AppSettings;
    if (
      parsed.pendingSubscriptionPlan
      && parsed.subscriptionCycleEndsAt
      && parsed.subscriptionCycleEndsAt <= Date.now()
    ) {
      const updated = {
        ...parsed,
        subscriptionPlan: parsed.pendingSubscriptionPlan,
        pendingSubscriptionPlan: null,
        subscriptionCycleEndsAt: null,
      };
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    }
    return parsed;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const updated: AppSettings = { ...current, ...patch, theme: 'light' };
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
  return updated;
}

export function getSubscriptionPlan(planId: SubscriptionPlanId): SubscriptionPlan {
  const normalizedPlanId = planId === 'premium' ? 'elite' : planId;
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === normalizedPlanId) ?? SUBSCRIPTION_PLANS[0];
}

export async function getAIFeedbackLevel(): Promise<AIFeedbackLevel> {
  const settings = await getAppSettings();
  return getSubscriptionPlan(settings.subscriptionPlan).aiFeedback;
}

function usageMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function getCreditCycleKey(plan: SubscriptionPlan, date = new Date()) {
  return plan.creditCadence === 'starter' ? 'starter' : `${plan.id}:${usageMonthKey(date)}`;
}

function nextMonthlyCycleEnd(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
}

export function getCreditAllowanceLabel(plan: SubscriptionPlan) {
  return plan.creditCadence === 'starter'
    ? `${plan.creditAllowance} starter credits`
    : `${plan.creditAllowance} credits/month`;
}

export async function getCreditUsage(): Promise<CreditUsage> {
  const settings = await getAppSettings();
  const plan = getSubscriptionPlan(settings.subscriptionPlan);
  const cycleKey = getCreditCycleKey(plan);
  const emptyUsage = { cycleKey, sessionsStarted: 0, creditsSpent: 0 };
  try {
    const raw = (await AsyncStorage.getItem(KEYS.CREDIT_USAGE)) ?? (await AsyncStorage.getItem(KEYS.LEGACY_DAILY_USAGE));
    if (!raw) return emptyUsage;
    const parsed = JSON.parse(raw) as Partial<CreditUsage & { date?: string }>;
    const parsedCycleKey = parsed.cycleKey ?? (parsed.date ? `legacy:${parsed.date}` : undefined);
    if (parsedCycleKey !== cycleKey) return emptyUsage;
    return {
      cycleKey,
      sessionsStarted: parsed.sessionsStarted ?? 0,
      creditsSpent: parsed.creditsSpent ?? parsed.sessionsStarted ?? 0,
    };
  } catch {
    return emptyUsage;
  }
}

export async function changeSubscriptionPlan(planId: SubscriptionPlanId): Promise<{
  settings: AppSettings;
  usage: CreditUsage;
  plan: SubscriptionPlan;
  scheduledDowngrade: boolean;
}> {
  const currentSettings = await getAppSettings();
  const currentPlan = getSubscriptionPlan(currentSettings.subscriptionPlan);
  const nextPlan = getSubscriptionPlan(planId);
  const currentUsage = await getCreditUsage();
  const currentIsPaid = currentPlan.creditCadence === 'monthly';
  const nextIsStarter = nextPlan.creditCadence === 'starter';

  if (currentPlan.id === nextPlan.id && !currentSettings.pendingSubscriptionPlan) {
    return { settings: currentSettings, usage: currentUsage, plan: currentPlan, scheduledDowngrade: false };
  }

  if (currentIsPaid && nextIsStarter) {
    const settings = await saveAppSettings({
      pendingSubscriptionPlan: nextPlan.id,
      subscriptionCycleEndsAt: currentSettings.subscriptionCycleEndsAt ?? nextMonthlyCycleEnd(),
    });
    return { settings, usage: currentUsage, plan: currentPlan, scheduledDowngrade: true };
  }

  const nextCycleKey = getCreditCycleKey(nextPlan);
  const shouldCarryMonthlySpend = currentIsPaid && nextPlan.creditCadence === 'monthly';
  const nextUsage: CreditUsage = {
    cycleKey: nextCycleKey,
    sessionsStarted: shouldCarryMonthlySpend ? currentUsage.sessionsStarted : 0,
    creditsSpent: shouldCarryMonthlySpend ? currentUsage.creditsSpent : 0,
  };
  await AsyncStorage.setItem(KEYS.CREDIT_USAGE, JSON.stringify(nextUsage));

  const settings = await saveAppSettings({
    subscriptionPlan: nextPlan.id,
    pendingSubscriptionPlan: null,
    subscriptionCycleEndsAt: nextPlan.creditCadence === 'monthly' ? nextMonthlyCycleEnd() : null,
  });

  return { settings, usage: nextUsage, plan: nextPlan, scheduledDowngrade: false };
}

export function getCreditsRemaining(usage: CreditUsage, plan: SubscriptionPlan): number {
  return Math.max(0, plan.creditAllowance - usage.creditsSpent);
}

export async function canSpendCredits(cost = CREDIT_COSTS.drill): Promise<{
  allowed: boolean;
  usage: CreditUsage;
  plan: SubscriptionPlan;
  cost: number;
  creditsRemaining: number;
  creditAllowance: number;
}> {
  const settings = await getAppSettings();
  const plan = getSubscriptionPlan(settings.subscriptionPlan);
  const usage = await getCreditUsage();
  const creditsRemaining = getCreditsRemaining(usage, plan);
  return {
    allowed: creditsRemaining >= cost,
    usage,
    plan,
    cost,
    creditsRemaining,
    creditAllowance: plan.creditAllowance,
  };
}

export async function spendCredits(cost = CREDIT_COSTS.drill): Promise<CreditUsage> {
  const usage = await getCreditUsage();
  const next = {
    ...usage,
    sessionsStarted: usage.sessionsStarted + 1,
    creditsSpent: usage.creditsSpent + cost,
  };
  await AsyncStorage.setItem(KEYS.CREDIT_USAGE, JSON.stringify(next));
  return next;
}

export async function canStartPracticeSession(cost = CREDIT_COSTS.drill): Promise<{
  allowed: boolean;
  usage: CreditUsage;
  plan: SubscriptionPlan;
  cost: number;
  creditsRemaining: number;
  creditAllowance: number;
}> {
  return canSpendCredits(cost);
}

export async function recordPracticeSessionStart(cost = CREDIT_COSTS.drill): Promise<CreditUsage> {
  return spendCredits(cost);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const DEFAULT_LANGUAGE_STATS: LanguageStats = {
  totalSessions: 0,
  totalCorrect: 0,
  totalAnswered: 0,
  bestStreak: 0,
  bestSpeakingScore: 0,
  totalXP: 0,
  currentStreak: 0,
  lastSessionDate: null,
};

const DEFAULT_STATS: AppStats = {
  ...DEFAULT_LANGUAGE_STATS,
  languageStats: {},
};

function normalizeLanguageStats(stats?: Partial<LanguageStats>): LanguageStats {
  return { ...DEFAULT_LANGUAGE_STATS, ...(stats ?? {}) };
}

export async function getStats(): Promise<AppStats> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STATS);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = { ...DEFAULT_STATS, ...JSON.parse(raw) } as AppStats;
    const storedLanguageStats = Object.fromEntries(
      Object.entries(parsed.languageStats ?? {}).map(([code, stats]) => [
        code,
        normalizeLanguageStats(stats),
      ]),
    );
    const languageStats = Object.keys(storedLanguageStats).length > 0
      ? storedLanguageStats
      : await deriveLanguageStatsFromSessions();
    return { ...parsed, languageStats };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export async function getStatsForLanguage(languageCode: string): Promise<LanguageStats> {
  const stats = await getStats();
  return normalizeLanguageStats(stats.languageStats[languageCode]);
}

export async function updateStats(patch: Partial<AppStats>): Promise<AppStats> {
  const current = await getStats();
  const updated = { ...current, ...patch };
  await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(updated));
  return updated;
}

export async function hasCompletedRewardKey(
  languageCode: string,
  type: SavedItemType,
  rewardKey?: string,
): Promise<boolean> {
  if (!rewardKey) return false;
  const sessions = await getSessionHistory();
  return sessions.some((session) => (
    session.languageCode === languageCode
    && session.type === type
    && session.rewardKey === rewardKey
    && session.xpEarned > 0
  ));
}

async function getAwardedXP(
  languageCode: string,
  type: SavedItemType,
  requestedXP: number,
  rewardKey?: string,
) {
  return await hasCompletedRewardKey(languageCode, type, rewardKey) ? 0 : requestedXP;
}

export async function recordListeningSession(
  languageCode: string,
  correct: number,
  total: number,
  streak: number,
  xpEarned: number,
  mockId?: string,
  rewardKey?: string,
): Promise<AppStats> {
  const current = await getStats();
  const currentLanguage = normalizeLanguageStats(current.languageStats[languageCode]);
  const today = new Date().toDateString();
  const awardedXP = await getAwardedXP(languageCode, 'listening', xpEarned, rewardKey);

  // streak logic: only increment if last session was yesterday or today
  let newStreak = currentLanguage.currentStreak;
  if (currentLanguage.lastSessionDate) {
    const last = new Date(currentLanguage.lastSessionDate);
    const diffDays = Math.floor(
      (new Date(today).getTime() - last.getTime()) / 86400000,
    );
    if (diffDays === 0) {
      // same day, keep streak
    } else if (diffDays === 1) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const session: SessionRecord = {
    id: `${Date.now()}`,
    type: 'listening',
    languageCode,
    date: Date.now(),
    score: total > 0 ? Math.round((correct / total) * 100) : 0,
    correct,
    total,
    xpEarned: awardedXP,
    mockId,
    rewardKey,
  };
  await appendSession(session);
  if (mockId) await updateMockProgress(mockId, 'listening', session.score, awardedXP);

  const updatedLanguage: LanguageStats = {
    ...currentLanguage,
    totalSessions: currentLanguage.totalSessions + 1,
    totalCorrect: currentLanguage.totalCorrect + correct,
    totalAnswered: currentLanguage.totalAnswered + total,
    bestStreak: Math.max(currentLanguage.bestStreak, streak, newStreak),
    totalXP: currentLanguage.totalXP + awardedXP,
    currentStreak: newStreak,
    lastSessionDate: today,
  };

  return updateStats({
    totalSessions: current.totalSessions + 1,
    totalCorrect: current.totalCorrect + correct,
    totalAnswered: current.totalAnswered + total,
    bestStreak: Math.max(current.bestStreak, streak, newStreak),
    totalXP: current.totalXP + awardedXP,
    currentStreak: Math.max(current.currentStreak, newStreak),
    lastSessionDate: today,
    languageStats: {
      ...current.languageStats,
      [languageCode]: updatedLanguage,
    },
  });
}

export async function recordReadingSession(
  languageCode: string,
  correct: number,
  total: number,
  streak: number,
  xpEarned: number,
  mockId?: string,
  rewardKey?: string,
): Promise<AppStats> {
  const current = await getStats();
  const currentLanguage = normalizeLanguageStats(current.languageStats[languageCode]);
  const today = new Date().toDateString();
  const awardedXP = await getAwardedXP(languageCode, 'reading', xpEarned, rewardKey);

  let newStreak = currentLanguage.currentStreak;
  if (currentLanguage.lastSessionDate) {
    const last = new Date(currentLanguage.lastSessionDate);
    const diffDays = Math.floor(
      (new Date(today).getTime() - last.getTime()) / 86400000,
    );
    if (diffDays === 0) {
      // same day, keep streak
    } else if (diffDays === 1) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const session: SessionRecord = {
    id: `${Date.now()}`,
    type: 'reading',
    languageCode,
    date: Date.now(),
    score: total > 0 ? Math.round((correct / total) * 100) : 0,
    correct,
    total,
    xpEarned: awardedXP,
    mockId,
    rewardKey,
  };
  await appendSession(session);
  if (mockId) await updateMockProgress(mockId, 'reading', session.score, awardedXP);

  const updatedLanguage: LanguageStats = {
    ...currentLanguage,
    totalSessions: currentLanguage.totalSessions + 1,
    totalCorrect: currentLanguage.totalCorrect + correct,
    totalAnswered: currentLanguage.totalAnswered + total,
    bestStreak: Math.max(currentLanguage.bestStreak, streak, newStreak),
    totalXP: currentLanguage.totalXP + awardedXP,
    currentStreak: newStreak,
    lastSessionDate: today,
  };

  return updateStats({
    totalSessions: current.totalSessions + 1,
    totalCorrect: current.totalCorrect + correct,
    totalAnswered: current.totalAnswered + total,
    bestStreak: Math.max(current.bestStreak, streak, newStreak),
    totalXP: current.totalXP + awardedXP,
    currentStreak: Math.max(current.currentStreak, newStreak),
    lastSessionDate: today,
    languageStats: {
      ...current.languageStats,
      [languageCode]: updatedLanguage,
    },
  });
}

export async function recordSpeakingScore(
  languageCode: string,
  score: number,
  xpEarned: number,
  mockId?: string,
  rewardKey?: string,
): Promise<AppStats> {
  const current = await getStats();
  const currentLanguage = normalizeLanguageStats(current.languageStats[languageCode]);
  const awardedXP = await getAwardedXP(languageCode, 'speaking', xpEarned, rewardKey);

  const session: SessionRecord = {
    id: `${Date.now()}`,
    type: 'speaking',
    languageCode,
    date: Date.now(),
    score,
    correct: score >= 55 ? 1 : 0,
    total: 1,
    xpEarned: awardedXP,
    mockId,
    rewardKey,
  };
  await appendSession(session);

  const updatedLanguage: LanguageStats = {
    ...currentLanguage,
    totalSessions: currentLanguage.totalSessions + 1,
    bestSpeakingScore: Math.max(currentLanguage.bestSpeakingScore, score),
    totalXP: currentLanguage.totalXP + awardedXP,
  };

  return updateStats({
    totalSessions: current.totalSessions + 1,
    bestSpeakingScore: Math.max(current.bestSpeakingScore, score),
    totalXP: current.totalXP + awardedXP,
    languageStats: {
      ...current.languageStats,
      [languageCode]: updatedLanguage,
    },
  });
}

export function xpForAPScore(score: number): number {
  if (score >= 5) return 60;
  if (score >= 4) return 45;
  if (score >= 3) return 30;
  if (score >= 2) return 15;
  return 8;
}

export async function recordAPPracticeSession(
  languageCode: string,
  type: 'conversation' | 'texting',
  score: number,
  mockId?: string,
  rewardKey?: string,
  apReview?: APReviewSnapshot,
  xpOverride?: number,
): Promise<AppStats> {
  const current = await getStats();
  const currentLanguage = normalizeLanguageStats(current.languageStats[languageCode]);
  const xpEarned = typeof xpOverride === 'number' ? xpOverride : xpForAPScore(score);
  const awardedXP = await getAwardedXP(languageCode, type, xpEarned, rewardKey);

  const session: SessionRecord = {
    id: `${Date.now()}`,
    type,
    languageCode,
    date: Date.now(),
    score: Math.round((score / 5) * 100),
    correct: score >= 3 ? 1 : 0,
    total: 1,
    xpEarned: awardedXP,
    mockId,
    rewardKey,
    apReview,
  };
  await appendSession(session);
  if (mockId) await updateMockProgress(mockId, type, score, awardedXP);

  const updatedLanguage: LanguageStats = {
    ...currentLanguage,
    totalSessions: currentLanguage.totalSessions + 1,
    totalCorrect: currentLanguage.totalCorrect + session.correct,
    totalAnswered: currentLanguage.totalAnswered + 1,
    totalXP: currentLanguage.totalXP + awardedXP,
  };

  return updateStats({
    totalSessions: current.totalSessions + 1,
    totalCorrect: current.totalCorrect + session.correct,
    totalAnswered: current.totalAnswered + 1,
    totalXP: current.totalXP + awardedXP,
    languageStats: {
      ...current.languageStats,
      [languageCode]: updatedLanguage,
    },
  });
}

// ---------------------------------------------------------------------------
// Session history
// ---------------------------------------------------------------------------

function notifyFirstCompletionFeedbackListeners() {
  for (const listener of firstCompletionFeedbackListeners) {
    try {
      listener();
    } catch {
      // A feedback prompt listener should never break session recording.
    }
  }
}

export function subscribeFirstCompletionFeedback(listener: () => void) {
  firstCompletionFeedbackListeners.add(listener);
  return () => {
    firstCompletionFeedbackListeners.delete(listener);
  };
}

export async function getFirstCompletionFeedback(): Promise<FirstCompletionFeedback | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FIRST_COMPLETION_FEEDBACK);
    return raw ? JSON.parse(raw) as FirstCompletionFeedback : null;
  } catch {
    return null;
  }
}

async function markFirstCompletionFeedbackPending(session: SessionRecord) {
  try {
    const existing = await AsyncStorage.getItem(KEYS.FIRST_COMPLETION_FEEDBACK);
    if (existing) return;
    const now = Date.now();
    const feedback: FirstCompletionFeedback = {
      status: 'pending',
      firstSessionId: session.id,
      firstSessionType: session.type,
      createdAt: now,
      updatedAt: now,
    };
    await AsyncStorage.setItem(KEYS.FIRST_COMPLETION_FEEDBACK, JSON.stringify(feedback));
    notifyFirstCompletionFeedbackListeners();
  } catch {
    // The app can still complete the drill if feedback persistence fails.
  }
}

export async function submitFirstCompletionFeedback(rating: number, comment = ''): Promise<FirstCompletionFeedback> {
  const current = await getFirstCompletionFeedback();
  const now = Date.now();
  const feedback: FirstCompletionFeedback = {
    status: 'submitted',
    firstSessionId: current?.firstSessionId,
    firstSessionType: current?.firstSessionType,
    rating: Math.max(1, Math.min(5, Math.round(rating))),
    comment: comment.trim(),
    remoteStatus: 'pending',
    remoteId: current?.remoteId ?? null,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  await AsyncStorage.setItem(KEYS.FIRST_COMPLETION_FEEDBACK, JSON.stringify(feedback));
  notifyFirstCompletionFeedbackListeners();
  return feedback;
}

export async function markFirstCompletionFeedbackRemoteResult(result: {
  ok: boolean;
  skipped?: boolean;
  id?: string | null;
  error?: unknown;
}): Promise<FirstCompletionFeedback | null> {
  const current = await getFirstCompletionFeedback();
  if (!current || current.status !== 'submitted') return current;
  const now = Date.now();
  const feedback: FirstCompletionFeedback = {
    ...current,
    remoteStatus: result.ok ? 'submitted' : result.skipped ? 'skipped' : 'failed',
    remoteId: result.id ?? current.remoteId ?? null,
    remoteSubmittedAt: result.ok ? now : current.remoteSubmittedAt,
    remoteLastError: result.ok
      ? undefined
      : typeof result.error === 'string'
        ? result.error
        : result.skipped
          ? 'No feedback endpoint configured.'
          : 'Feedback submission failed.',
    updatedAt: now,
  };
  await AsyncStorage.setItem(KEYS.FIRST_COMPLETION_FEEDBACK, JSON.stringify(feedback));
  notifyFirstCompletionFeedbackListeners();
  return feedback;
}

export async function dismissFirstCompletionFeedback(): Promise<FirstCompletionFeedback> {
  const current = await getFirstCompletionFeedback();
  const now = Date.now();
  const feedback: FirstCompletionFeedback = {
    status: 'dismissed',
    firstSessionId: current?.firstSessionId,
    firstSessionType: current?.firstSessionType,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  await AsyncStorage.setItem(KEYS.FIRST_COMPLETION_FEEDBACK, JSON.stringify(feedback));
  notifyFirstCompletionFeedbackListeners();
  return feedback;
}

async function appendSession(session: SessionRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SESSIONS);
    const sessions: SessionRecord[] = raw ? JSON.parse(raw) : [];
    // keep last 100 sessions only — no unbounded growth
    sessions.unshift(session);
    if (sessions.length > 100) sessions.length = 100;
    await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
    await markFirstCompletionFeedbackPending(session);
  } catch {
    // silently fail — stats already saved
  }
}

export async function getSessionHistory(): Promise<SessionRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SESSIONS);
    return raw ? JSON.parse(raw) as SessionRecord[] : [];
  } catch {
    return [];
  }
}

function cleanMemoryText(text: string | undefined, limit = 240) {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalizeMemoryKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9一-龯ぁ-んァ-ヶー]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

const TOPIC_RULES: Array<{ topic: string; keywords: string[] }> = [
  {
    topic: 'school life',
    keywords: ['school', 'class', 'teacher', 'homework', 'club', 'exam', 'test', 'student', 'classmate', 'lesson', '部活', '宿題', '学校', '先生', '授業', '試験', '学生', '友達'],
  },
  {
    topic: 'travel and transit',
    keywords: ['train', 'station', 'airport', 'bus', 'ticket', 'platform', 'travel', 'trip', 'flight', 'departure', 'arrival', '電車', '駅', '空港', 'バス', '切符', '旅行', '出発', '到着'],
  },
  {
    topic: 'food and restaurants',
    keywords: ['restaurant', 'menu', 'lunch', 'dinner', 'breakfast', 'food', 'cafe', 'order', 'meal', 'レストラン', 'メニュー', '昼ご飯', '晩ご飯', '朝ご飯', '食べ物', '注文', '食事'],
  },
  {
    topic: 'shopping and money',
    keywords: ['shop', 'store', 'buy', 'price', 'cost', 'cash', 'card', 'receipt', 'discount', '買', '店', '値段', 'お金', 'カード', 'レシート', '割引'],
  },
  {
    topic: 'schedule and plans',
    keywords: ['schedule', 'plan', 'time', 'tomorrow', 'today', 'next week', 'meeting', 'appointment', '予定', '時間', '明日', '今日', '来週', '会議', '約束'],
  },
  {
    topic: 'directions and places',
    keywords: ['where', 'location', 'place', 'direction', 'map', 'near', 'left', 'right', 'どこ', '場所', '地図', '近く', '左', '右', '前', '後ろ'],
  },
  {
    topic: 'family and home',
    keywords: ['family', 'home', 'parent', 'mother', 'father', 'sibling', 'house', '家族', '家', '母', '父', '兄', '姉', '弟', '妹'],
  },
  {
    topic: 'weather and events',
    keywords: ['weather', 'rain', 'snow', 'event', 'festival', 'cancel', 'delay', '天気', '雨', '雪', '行事', '祭り', '中止', '遅れ'],
  },
  {
    topic: 'health and body',
    keywords: ['health', 'sick', 'doctor', 'hospital', 'medicine', 'pharmacy', '痛い', '病気', '医者', '病院', '薬', '薬局'],
  },
  {
    topic: 'culture and community',
    keywords: ['culture', 'tradition', 'festival', 'community', 'custom', '文化', '伝統', '祭り', '地域', '習慣'],
  },
];

const ENGLISH_VOCAB_STOPWORDS = new Set([
  'about', 'after', 'again', 'answer', 'because', 'before', 'correct', 'detail', 'drill',
  'expected', 'first', 'from', 'question', 'review', 'should', 'their', 'there', 'these',
  'thing', 'turn', 'what', 'where', 'which', 'with', 'would', 'your',
]);

function combinedAttemptText(item: AttemptMemory) {
  return [
    item.question,
    item.userAnswer,
    item.expectedAnswer,
    item.context,
    ...(item.weakSkills ?? []),
  ].filter(Boolean).join(' ');
}

function inferWeakTopic(item: AttemptMemory) {
  const text = combinedAttemptText(item).toLowerCase();
  const match = TOPIC_RULES.find((rule) => rule.keywords.some((keyword) => text.includes(keyword.toLowerCase())));
  if (match) return match.topic;
  if ((item.weakSkills ?? []).some((skill) => /register|polite|casual/i.test(skill))) return 'register and relationship';
  if (item.type === 'conversation' || item.type === 'texting') return 'interpersonal response';
  if (item.type === 'listening') return 'listening detail';
  if (item.type === 'reading') return 'reading evidence';
  if (item.type === 'speaking') return 'spoken production';
  return 'AP task completion';
}

function inferRubric(item: AttemptMemory) {
  const weakText = (item.weakSkills ?? []).join(' ').toLowerCase();
  if (/delivery|pronunciation|pace|naturalness|rhythm/.test(weakText)) return 'Delivery';
  if (/language|grammar|sentence|register|casual|polite|vocab|word/.test(weakText)) return 'Language use';
  if (/culture|custom|tradition/.test(weakText)) return 'Cultural knowledge';
  return 'Task completion';
}

function inferMistakeType(item: AttemptMemory) {
  const weakText = (item.weakSkills ?? []).join(' ').toLowerCase();
  if (/detail|evidence|inference/.test(weakText)) return 'missed evidence/detail';
  if (/register|casual|polite/.test(weakText)) return 'register mismatch';
  if (/pronunciation|delivery|naturalness|rhythm/.test(weakText)) return 'delivery/naturalness';
  if (/sentence|complete|grammar/.test(weakText)) return 'sentence control';
  if (/culture/.test(weakText)) return 'cultural context';
  if (!item.userAnswer.trim()) return 'blank or timed out';
  return 'task completion gap';
}

function extractWeakVocab(item: AttemptMemory) {
  const text = combinedAttemptText(item);
  const kanjiTerms = text.match(/[一-龯][一-龯ぁ-んァ-ヶー]{0,5}/g) ?? [];
  const katakanaTerms = text.match(/[ァ-ヶー]{2,12}/g) ?? [];
  const englishTerms = (text.toLowerCase().match(/[a-z][a-z'-]{4,}/g) ?? [])
    .filter((term) => !ENGLISH_VOCAB_STOPWORDS.has(term));
  return Array.from(new Set([...kanjiTerms, ...katakanaTerms, ...englishTerms]))
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function weakMemoryIdFor(item: AttemptMemory, topic: string, rubric: string, mistakeType: string) {
  return [
    item.languageCode,
    item.type,
    normalizeMemoryKey(topic),
    normalizeMemoryKey(rubric),
    normalizeMemoryKey(mistakeType),
  ].join(':');
}

function priorityForWeakMemory(item: Pick<WeakMemoryItem, 'missCount' | 'lastScore' | 'lastSeen'>) {
  const daysAgo = Math.max(0, Math.round((Date.now() - item.lastSeen) / 86400000));
  const recencyBoost = Math.max(0, 18 - daysAgo * 2);
  const scorePenalty = Math.max(0, 72 - item.lastScore) / 6;
  return Math.round(item.missCount * 12 + recencyBoost + scorePenalty);
}

async function recordWeakMemoryFromAttempts(attempts: AttemptMemory[]): Promise<void> {
  const misses = attempts.filter((item) => !item.correct || item.score < 72);
  if (misses.length === 0) return;

  try {
    const raw = await AsyncStorage.getItem(KEYS.WEAK_MEMORY);
    const existing: WeakMemoryItem[] = raw ? JSON.parse(raw) : [];
    const byId = new Map(existing.map((item) => [item.id, item]));

    for (const attempt of misses) {
      const topic = inferWeakTopic(attempt);
      const rubric = inferRubric(attempt);
      const mistakeType = inferMistakeType(attempt);
      const id = weakMemoryIdFor(attempt, topic, rubric, mistakeType);
      const current = byId.get(id);
      const firstSeen = current?.firstSeen ?? attempt.date;
      const lastSeen = Math.max(current?.lastSeen ?? 0, attempt.date);
      const vocab = Array.from(new Set([...(current?.vocab ?? []), ...extractWeakVocab(attempt)])).slice(0, 12);
      const evidence = Array.from(new Set([
        cleanMemoryText(attempt.context, 180),
        cleanMemoryText(attempt.question, 180),
        ...(current?.evidence ?? []),
      ].filter(Boolean))).slice(0, 5);
      const sourcePromptIds = Array.from(new Set([attempt.promptId, ...(current?.sourcePromptIds ?? [])])).slice(0, 12);
      const next: WeakMemoryItem = {
        id,
        languageCode: attempt.languageCode,
        type: attempt.type,
        topic,
        vocab,
        rubric,
        mistakeType,
        missCount: (current?.missCount ?? 0) + 1,
        exposureCount: (current?.exposureCount ?? 0) + 1,
        lastScore: attempt.score,
        priority: 0,
        firstSeen,
        lastSeen,
        sourcePromptIds,
        evidence,
      };
      next.priority = priorityForWeakMemory(next);
      byId.set(id, next);
    }

    const nextItems = Array.from(byId.values())
      .map((item) => ({ ...item, priority: priorityForWeakMemory(item) }))
      .sort((a, b) => b.priority - a.priority || b.lastSeen - a.lastSeen)
      .slice(0, WEAK_MEMORY_LIMIT);
    await AsyncStorage.setItem(KEYS.WEAK_MEMORY, JSON.stringify(nextItems));
  } catch {
    // Weak memory improves personalization, but practice completion should never depend on it.
  }
}

export async function recordAttemptMemory(
  input: AttemptMemoryInput | AttemptMemoryInput[],
): Promise<void> {
  const items = Array.isArray(input) ? input : [input];
  const now = Date.now();
  const normalized = items
    .filter((item) => item.languageCode && item.promptId && item.type)
    .map((item, index): AttemptMemory => ({
      id: item.id ?? `${item.languageCode}:${item.type}:${item.promptId}:${now}:${index}`,
      type: item.type,
      languageCode: item.languageCode,
      promptId: item.promptId,
      date: item.date ?? now,
      score: Math.max(0, Math.min(100, Math.round(item.score))),
      correct: Boolean(item.correct),
      question: cleanMemoryText(item.question),
      userAnswer: cleanMemoryText(item.userAnswer),
      expectedAnswer: cleanMemoryText(item.expectedAnswer),
      context: cleanMemoryText(item.context, 320) || undefined,
      weakSkills: Array.isArray(item.weakSkills)
        ? item.weakSkills.filter((skill): skill is string => typeof skill === 'string').slice(0, 6)
        : undefined,
    }));
  if (normalized.length === 0) return;

  try {
    const raw = await AsyncStorage.getItem(KEYS.ATTEMPT_MEMORY);
    const existing: AttemptMemory[] = raw ? JSON.parse(raw) : [];
    const incomingIds = new Set(normalized.map((item) => item.id));
    const next = [
      ...normalized,
      ...existing.filter((item) => !incomingIds.has(item.id)),
    ].slice(0, ATTEMPT_MEMORY_LIMIT);
    await AsyncStorage.setItem(KEYS.ATTEMPT_MEMORY, JSON.stringify(next));
  } catch {
    // Attempt memory only improves personalization; drills should still run.
  }
  await recordWeakMemoryFromAttempts(normalized);
}

export async function getAttemptMemory(languageCode?: string): Promise<AttemptMemory[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ATTEMPT_MEMORY);
    const items: AttemptMemory[] = raw ? JSON.parse(raw) : [];
    return languageCode ? items.filter((item) => item.languageCode === languageCode) : items;
  } catch {
    return [];
  }
}

export async function getWeakMemory(languageCode?: string): Promise<WeakMemoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WEAK_MEMORY);
    const items: WeakMemoryItem[] = raw ? JSON.parse(raw) : [];
    const sorted = items
      .map((item) => ({ ...item, priority: priorityForWeakMemory(item) }))
      .sort((a, b) => b.priority - a.priority || b.lastSeen - a.lastSeen);
    return languageCode ? sorted.filter((item) => item.languageCode === languageCode) : sorted;
  } catch {
    return [];
  }
}

type RecentPromptHistory = Record<string, string[]>;

function promptHistoryKey(languageCode: string, type: PromptHistoryType) {
  return `${languageCode}:${type}`;
}

export async function getRecentPromptIds(
  languageCode: string,
  type: PromptHistoryType,
): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.RECENT_PROMPTS);
    const history: RecentPromptHistory = raw ? JSON.parse(raw) : {};
    const stored = history[promptHistoryKey(languageCode, type)];
    if (Array.isArray(stored)) return stored.filter((id): id is string => typeof id === 'string');

    // Handles one older local schema from development without crashing existing browsers.
    const nested = (stored as Partial<Record<PromptHistoryType, unknown>> | undefined)?.[type];
    if (Array.isArray(nested)) return nested.filter((id): id is string => typeof id === 'string');

    return [];
  } catch {
    return [];
  }
}

export async function recordPromptExposure(
  languageCode: string,
  type: PromptHistoryType,
  promptIds: string[],
): Promise<void> {
  if (promptIds.length === 0) return;

  try {
    const raw = await AsyncStorage.getItem(KEYS.RECENT_PROMPTS);
    const history: RecentPromptHistory = raw ? JSON.parse(raw) : {};
    const key = promptHistoryKey(languageCode, type);
    const previous = history[key] ?? [];
    const next = [...promptIds, ...previous.filter((id) => !promptIds.includes(id))]
      .slice(0, RECENT_PROMPT_LIMIT);

    history[key] = next;
    await AsyncStorage.setItem(KEYS.RECENT_PROMPTS, JSON.stringify(history));
  } catch {
    // Prompt exposure is only a repeat-reduction hint. Practice should still work.
  }
}

type GeneratedPromptCache = Record<string, GeneratedPromptItem[]>;

type DrillSessionContentCache = Record<string, {
  languageCode: string;
  type: PromptHistoryType;
  sessionId: string;
  items: GeneratedPromptItem[];
  updatedAt: number;
}>;

function drillSessionContentKey(languageCode: string, type: PromptHistoryType, sessionId: string) {
  return languageCode + ':' + type + ':' + sessionId;
}

export async function getDrillSessionContent<T extends GeneratedPromptItem>(
  languageCode: string,
  type: PromptHistoryType,
  sessionId?: string | null,
): Promise<T[]> {
  if (!sessionId) return [];
  try {
    const raw = await AsyncStorage.getItem(KEYS.DRILL_SESSION_CONTENT);
    const cache: DrillSessionContentCache = raw ? JSON.parse(raw) : {};
    const entry = cache[drillSessionContentKey(languageCode, type, sessionId)];
    if (!entry || !Array.isArray(entry.items)) return [];
    return entry.items as T[];
  } catch {
    return [];
  }
}

export async function saveDrillSessionContent<T extends GeneratedPromptItem>(
  languageCode: string,
  type: PromptHistoryType,
  sessionId: string | null | undefined,
  items: T[],
): Promise<void> {
  if (!sessionId || items.length === 0) return;
  try {
    const raw = await AsyncStorage.getItem(KEYS.DRILL_SESSION_CONTENT);
    const cache: DrillSessionContentCache = raw ? JSON.parse(raw) : {};
    cache[drillSessionContentKey(languageCode, type, sessionId)] = {
      languageCode,
      type,
      sessionId,
      items: items as GeneratedPromptItem[],
      updatedAt: Date.now(),
    };
    const compact = Object.fromEntries(
      Object.entries(cache)
        .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
        .slice(0, 50),
    );
    await AsyncStorage.setItem(KEYS.DRILL_SESSION_CONTENT, JSON.stringify(compact));
  } catch {
    // Session content is a credit-safety cache. If storage fails, the drill should still load.
  }
}

type DrillSessionProgressCache = Record<string, {
  languageCode: string;
  type: PromptHistoryType;
  sessionId: string;
  state: unknown;
  updatedAt: number;
}>;

export async function getDrillSessionProgress<T>(
  languageCode: string,
  type: PromptHistoryType,
  sessionId?: string | null,
): Promise<T | null> {
  if (!sessionId) return null;
  try {
    const raw = await AsyncStorage.getItem(KEYS.DRILL_SESSION_PROGRESS);
    const cache: DrillSessionProgressCache = raw ? JSON.parse(raw) : {};
    const entry = cache[drillSessionContentKey(languageCode, type, sessionId)];
    return entry?.state as T ?? null;
  } catch {
    return null;
  }
}

export async function saveDrillSessionProgress<T>(
  languageCode: string,
  type: PromptHistoryType,
  sessionId: string | null | undefined,
  state: T,
): Promise<void> {
  if (!sessionId) return;
  try {
    const raw = await AsyncStorage.getItem(KEYS.DRILL_SESSION_PROGRESS);
    const cache: DrillSessionProgressCache = raw ? JSON.parse(raw) : {};
    cache[drillSessionContentKey(languageCode, type, sessionId)] = {
      languageCode,
      type,
      sessionId,
      state,
      updatedAt: Date.now(),
    };
    const compact = Object.fromEntries(
      Object.entries(cache)
        .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
        .slice(0, 80),
    );
    await AsyncStorage.setItem(KEYS.DRILL_SESSION_PROGRESS, JSON.stringify(compact));
  } catch {
    // Progress is best-effort local resume state.
  }
}

export async function getGeneratedPromptCache<T extends GeneratedPromptItem>(
  languageCode: string,
  type: PromptHistoryType,
): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GENERATED_PROMPTS);
    const cache: GeneratedPromptCache = raw ? JSON.parse(raw) : {};
    const stored = cache[promptHistoryKey(languageCode, type)];
    return Array.isArray(stored) ? stored as T[] : [];
  } catch {
    return [];
  }
}

export async function setGeneratedPromptCache(
  languageCode: string,
  type: PromptHistoryType,
  items: GeneratedPromptItem[],
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GENERATED_PROMPTS);
    const cache: GeneratedPromptCache = raw ? JSON.parse(raw) : {};
    cache[promptHistoryKey(languageCode, type)] = items.slice(0, 20);
    await AsyncStorage.setItem(KEYS.GENERATED_PROMPTS, JSON.stringify(cache));
  } catch {
    // Generated prompt cache is opportunistic; local prompts are the fallback.
  }
}

export async function getActiveMockProgress(): Promise<MockProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MOCK);
    return raw ? JSON.parse(raw) as MockProgress : null;
  } catch {
    return null;
  }
}

export async function startMockProgress(): Promise<MockProgress> {
  const mock: MockProgress = {
    id: `${Date.now()}`,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    sectionScores: {},
    sectionXP: {},
  };
  await AsyncStorage.setItem(KEYS.MOCK, JSON.stringify(mock));
  return mock;
}

export async function clearMockProgress(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.MOCK);
}

async function updateMockProgress(
  mockId: string,
  section: MockSection,
  score: number,
  xpEarned: number,
): Promise<void> {
  const current = await getActiveMockProgress();
  const base: MockProgress = current?.id === mockId
    ? current
    : {
      id: mockId,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      sectionScores: {},
      sectionXP: {},
    };
  const updated: MockProgress = {
    ...base,
    updatedAt: Date.now(),
    sectionScores: { ...base.sectionScores, [section]: score },
    sectionXP: { ...base.sectionXP, [section]: xpEarned },
  };
  await AsyncStorage.setItem(KEYS.MOCK, JSON.stringify(updated));
}

async function deriveLanguageStatsFromSessions(): Promise<Record<string, LanguageStats>> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SESSIONS);
    const sessions: SessionRecord[] = raw ? JSON.parse(raw) : [];
    const byLanguage: Record<string, LanguageStats> = {};

    for (const session of sessions) {
      const current = normalizeLanguageStats(byLanguage[session.languageCode]);
      byLanguage[session.languageCode] = {
        ...current,
        totalSessions: current.totalSessions + 1,
        totalCorrect: current.totalCorrect + session.correct,
        totalAnswered: current.totalAnswered + session.total,
        bestSpeakingScore: session.type === 'speaking'
          ? Math.max(current.bestSpeakingScore, session.score)
          : current.bestSpeakingScore,
        totalXP: current.totalXP + session.xpEarned,
        lastSessionDate: current.lastSessionDate ?? new Date(session.date).toDateString(),
      };
    }

    return byLanguage;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Saved / Practice Library
// ---------------------------------------------------------------------------

export async function getSavedItems(): Promise<SavedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SAVED);
    if (!raw) return [];
    return JSON.parse(raw) as SavedItem[];
  } catch {
    return [];
  }
}

export async function saveItem(item: Omit<SavedItem, 'savedAt'>): Promise<void> {
  const existing = await getSavedItems();
  // prevent duplicates
  if (existing.some((s) => s.promptId === item.promptId && s.type === item.type)) return;
  existing.unshift({ ...item, savedAt: Date.now() });
  await AsyncStorage.setItem(KEYS.SAVED, JSON.stringify(existing));
}

export async function upsertSavedItem(item: Omit<SavedItem, 'savedAt'>): Promise<void> {
  const existing = await getSavedItems();
  const now = Date.now();
  const index = existing.findIndex((s) => s.promptId === item.promptId && s.type === item.type);
  if (index >= 0) {
    existing[index] = { ...item, savedAt: existing[index].savedAt };
  } else {
    existing.unshift({ ...item, savedAt: now });
  }
  await AsyncStorage.setItem(KEYS.SAVED, JSON.stringify(existing));
}

export async function removeSavedItem(promptId: string, type: SavedItemType): Promise<void> {
  const existing = await getSavedItems();
  const filtered = existing.filter((s) => !(s.promptId === promptId && s.type === type));
  await AsyncStorage.setItem(KEYS.SAVED, JSON.stringify(filtered));
}

export async function removeSavedItemById(id: string): Promise<void> {
  const existing = await getSavedItems();
  const filtered = existing.filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEYS.SAVED, JSON.stringify(filtered));
}

export async function removeSavedItemsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const existing = await getSavedItems();
  const filtered = existing.filter((s) => !idSet.has(s.id));
  await AsyncStorage.setItem(KEYS.SAVED, JSON.stringify(filtered));
}

export async function isItemSaved(promptId: string, type: SavedItemType): Promise<boolean> {
  const existing = await getSavedItems();
  return existing.some((s) => s.promptId === promptId && s.type === type);
}
