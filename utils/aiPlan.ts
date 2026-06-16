import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguageCode } from '@/constants/languages';
import { getAIEndpoint } from '@/utils/aiApi';
import { buildAIPersonalizationProfile, type AIPersonalizationProfile } from '@/utils/personalization';

export type AIDailyPlanMode = 'listening' | 'speaking' | 'reading' | 'conversation' | 'texting' | 'mock';
export type AIDailyPlanRubric = 'Task completion' | 'Delivery' | 'Language use' | 'Cultural knowledge';

export interface AIDailyPlanAction {
  id: string;
  mode: AIDailyPlanMode;
  title: string;
  task: string;
  rubric: AIDailyPlanRubric;
  minutes: number;
  credits: number;
  why: string;
  targetSkills: string[];
}

export interface AIDailyPlan {
  summary: string;
  actions: AIDailyPlanAction[];
  profile: AIPersonalizationProfile;
}

const DAILY_PLAN_CACHE_PREFIX = '@kibbo:aiDailyPlan:';
const DAILY_PLAN_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function isPlanMode(value: unknown): value is AIDailyPlanMode {
  return value === 'listening'
    || value === 'speaking'
    || value === 'reading'
    || value === 'conversation'
    || value === 'texting'
    || value === 'mock';
}

function isRubric(value: unknown): value is AIDailyPlanRubric {
  return value === 'Task completion'
    || value === 'Delivery'
    || value === 'Language use'
    || value === 'Cultural knowledge';
}

function sanitizeAction(value: unknown, index: number): AIDailyPlanAction | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<AIDailyPlanAction>;
  if (!isPlanMode(item.mode) || !isRubric(item.rubric)) return null;
  if (typeof item.title !== 'string' || typeof item.task !== 'string' || typeof item.why !== 'string') return null;

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `ai-plan-${item.mode}-${index + 1}`,
    mode: item.mode,
    title: item.title.slice(0, 56),
    task: item.task.slice(0, 44),
    rubric: item.rubric,
    minutes: typeof item.minutes === 'number' ? Math.max(8, Math.min(18, Math.round(item.minutes))) : 12,
    credits: item.mode === 'mock' ? 3 : 1,
    why: item.why.slice(0, 140),
    targetSkills: Array.isArray(item.targetSkills)
      ? item.targetSkills.filter((skill): skill is string => typeof skill === 'string').slice(0, 5)
      : [],
  };
}

function dateKey() {
  return new Date().toDateString();
}

function dailyPlanSignature(profile: AIPersonalizationProfile) {
  return JSON.stringify({
    day: dateKey(),
    languageCode: profile.languageCode,
  });
}

async function getCachedDailyPlan(languageCode: LanguageCode, signature: string, profile: AIPersonalizationProfile) {
  try {
    const raw = await AsyncStorage.getItem(`${DAILY_PLAN_CACHE_PREFIX}${languageCode}`);
    const cached = raw ? JSON.parse(raw) as { signature?: string; createdAt?: number; plan?: AIDailyPlan } : null;
    if (
      cached?.signature === signature
      && typeof cached.createdAt === 'number'
      && Date.now() - cached.createdAt < DAILY_PLAN_CACHE_TTL_MS
      && cached.plan
    ) {
      return { ...cached.plan, profile };
    }
  } catch {
    // Daily plan caching is a cost saver only; generation can continue without it.
  }
  return null;
}

async function setCachedDailyPlan(languageCode: LanguageCode, signature: string, plan: AIDailyPlan) {
  try {
    await AsyncStorage.setItem(`${DAILY_PLAN_CACHE_PREFIX}${languageCode}`, JSON.stringify({
      signature,
      createdAt: Date.now(),
      plan,
    }));
  } catch {
    // Cache writes should never block the daily plan.
  }
}

export async function generateDailyPlan(languageCode: LanguageCode): Promise<AIDailyPlan | null> {
  const endpoint = getAIEndpoint();
  if (!endpoint || languageCode !== 'ja') return null;

  const profile = await buildAIPersonalizationProfile(languageCode);
  const signature = dailyPlanSignature(profile);
  const cached = await getCachedDailyPlan(languageCode, signature, profile);
  if (cached) return cached;

  try {
    const response = await fetch(`${endpoint}/generate-daily-plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ languageCode, profile }),
    });
    if (!response.ok) return null;
    const json = await response.json() as { summary?: unknown; actions?: unknown };
    const actions = Array.isArray(json.actions)
      ? json.actions.map(sanitizeAction).filter((item): item is AIDailyPlanAction => item !== null).slice(0, 3)
      : [];
    if (actions.length === 0) return null;
    const plan = {
      summary: typeof json.summary === 'string' ? json.summary.slice(0, 160) : 'Personalized AP Japanese work for today.',
      actions,
      profile,
    };
    await setCachedDailyPlan(languageCode, signature, plan);
    return plan;
  } catch {
    return null;
  }
}
