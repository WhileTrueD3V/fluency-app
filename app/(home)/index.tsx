import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  type DimensionValue,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { DrillAccents, tint } from '@/constants/drillAccents';
import { getLanguage, isLanguageAvailable, type LanguageCode } from '@/constants/languages';
import { useAppStorage } from '@/hooks/useAppStorage';
import { haptics } from '@/utils/haptics';
import {
  canStartPracticeSession,
  CREDIT_COSTS,
  getCreditUsage,
  getCreditsRemaining,
  getStartingLevelProfile,
  getSessionHistory,
  recordPracticeSessionStart,
  saveStartingLevelChoice,
  STARTING_LEVEL_CHOICES,
  type CreditUsage,
  type SessionRecord,
  type StartingLevelChoice,
  type StartingLevelProfile,
  type SubscriptionPlan,
} from '@/utils/storage';
import {
  getBestSkill,
  getDevelopmentIndex,
  getLanguageProgressGlyph,
} from '@/utils/learningSignals';
import { getPlayerLevel } from '@/utils/progression';
import { generateDailyPlan, type AIDailyPlan, type AIDailyPlanAction } from '@/utils/aiPlan';
import { prewarmGeneratedPracticeQueues } from '@/utils/practiceContentQueue';
import { encodeTargetSkills } from '@/utils/targetSkills';
import {
  getAstroChallengeBoostState,
  getBestChallengeBoostState,
  type ChallengeBoostState,
} from '@/utils/challengeBoost';
import {
  APP_COMPACT_BREAKPOINT,
  DESKTOP_RAIL_NARROW_BREAKPOINT,
  DesktopSideRail,
  getDesktopContentInsets,
} from '@/components/AppFooterTabs';
import { CreditStartNotice } from '@/components/CreditStartNotice';
import { KanjiBackdrop } from '@/components/KanjiBackdrop';
import { LanguageMark } from '@/components/LanguageMark';
import { MainTabHeader, MobileTabHeader } from '@/components/MainTabHeader';
import {
  ChartIcon,
  CheckIcon,
  ChevronRightIcon,
  CompassIcon,
  FileTextIcon,
  HeadphonesIcon,
  LightbulbIcon,
  MessageCircleIcon,
  MicrophoneIcon,
  StarIcon,
  SwitchIcon,
  TargetIcon,
  TrophyIcon,
  WaveformIcon,
  XIcon,
} from '@/components/Icons';

const WEB_MODAL_LAYER_STYLE = Platform.OS === 'web'
  ? ({ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, zIndex: 10000 } as unknown as ViewStyle)
  : null;
const WEB_NO_OUTLINE_STYLE = Platform.OS === 'web'
  ? ({ outlineStyle: 'none' } as unknown as ViewStyle)
  : null;

type RubricKey = 'Task completion' | 'Delivery' | 'Language use' | 'Cultural knowledge';

type RubricSignal = {
  key: RubricKey;
  short: string;
  score: number;
  trend: string;
  pattern: string;
  accent: string;
  urgent?: boolean;
};

type PlanAction = {
  id: string;
  title: string;
  task: string;
  rubric: RubricKey;
  minutes: number;
  credits: number;
  why: string;
  accent: string;
  icon: React.ReactNode;
  targetSkills?: string[];
  rewardKey?: string;
  onPress: () => void;
};

const LEVEL_JOURNEY_STAGES = [
  {
    title: 'Novice',
    levels: [1, 2, 3, 4, 5],
    focus: 'Build baseline control for short listening, reading, and direct AP answers.',
  },
  {
    title: 'Beginner',
    levels: [6, 7, 8, 9, 10],
    focus: 'Turn recognition into faster answers with generated weak-spot drills.',
  },
  {
    title: 'Intermediate',
    levels: [11, 12, 13, 14, 15],
    focus: 'Tighten text-chat replies and simulated conversation turns under AP timing.',
  },
  {
    title: 'Upper Intermediate',
    levels: [16, 17, 18, 19, 20],
    focus: 'Practice longer speaking and writing with clearer support and cultural detail.',
  },
  {
    title: 'Advanced',
    levels: [21, 22, 23, 24, 25],
    focus: 'Use rubric feedback to repair recurring patterns before Mini Mocks.',
  },
  {
    title: 'Mastery',
    levels: [26, 27, 28, 29, 30],
    focus: 'Refine register, pace, evidence, and nuance for confident AP performance.',
  },
];

function getLevelRankTitle(level: number) {
  return LEVEL_JOURNEY_STAGES.find((stage) => stage.levels.includes(level))?.title ?? 'Mastery';
}

function sessionDateKey(timestamp: number) {
  return new Date(timestamp).toDateString();
}

function dailyPlanRewardKey(languageCode: LanguageCode, actionId: string) {
  return `daily-plan:${languageCode}:${new Date().toDateString()}:${actionId}`;
}

function actionMatchesSession(action: PlanAction, session: SessionRecord) {
  if ((action.id === 'diagnostic' || action.id.includes('mock')) && session.mockId) return true;
  if (action.rewardKey && session.rewardKey === action.rewardKey) return true;
  if (action.rewardKey) return false;
  if (action.id.includes('listening')) return session.type === 'listening';
  if (action.id.includes('reading')) return session.type === 'reading';
  if (action.id.includes('conversation')) return session.type === 'conversation';
  if (action.id.includes('texting')) return session.type === 'texting';
  if (action.id.includes('speaking') || action.id === 'delivery') return session.type === 'speaking';
  return false;
}

function targetSkillRouteParams(targetSkills: string[] = []) {
  const encoded = encodeTargetSkills(targetSkills);
  return encoded ? { targetSkills: encoded } : {};
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreFromPercent(percent: number, fallback = 2.1) {
  if (!percent) return fallback;
  return clamp(1 + (percent / 100) * 4, 1, 5);
}

function scoreLabel(score: number) {
  return `Level ${Math.round(clamp(score, 1, 5))}`;
}

function rubricStageLabel(score: number) {
  if (score >= 4.25) return 'Strong';
  if (score >= 3.35) return 'Ready';
  if (score >= 2.35) return 'Building';
  return 'Needs work';
}

function buildRubricSignals({
  accuracy,
  sessions,
  bestSpeakingScore,
  developmentIndex,
}: {
  accuracy: number;
  sessions: number;
  bestSpeakingScore: number;
  developmentIndex: number;
}): RubricSignal[] {
  const taskCompletion = scoreFromPercent(accuracy, sessions === 0 ? 2.0 : 2.4);
  const delivery = scoreFromPercent(bestSpeakingScore, sessions === 0 ? 2.0 : taskCompletion - 0.45);
  const languageUse = clamp((taskCompletion + delivery) / 2 - (accuracy < 72 ? 0.35 : 0.05), 1, 5);
  const culturalKnowledge = clamp(sessions > 2 ? taskCompletion - 0.1 : 1.9, 1, 5);

  return [
    {
      key: 'Task completion',
      short: 'Task',
      score: taskCompletion,
      trend: accuracy >= 76 ? '+0.3' : accuracy >= 62 ? 'flat' : '-0.2',
      pattern: sessions === 0
        ? 'Baseline needed across all AP task types.'
        : accuracy < 70
          ? 'Missed details are costing complete responses.'
          : 'Prompt coverage is becoming reliable.',
      accent: Colors.primary,
      urgent: sessions === 0 || accuracy < 70,
    },
    {
      key: 'Delivery',
      short: 'Delivery',
      score: delivery,
      trend: bestSpeakingScore >= 78 ? '+0.4' : bestSpeakingScore ? '-0.1' : 'new',
      pattern: bestSpeakingScore < 70
        ? 'Timed responses need cleaner pacing.'
        : 'Speaking control is ready for harder turns.',
      accent: Colors.teal,
      urgent: sessions > 0 && bestSpeakingScore < 70,
    },
    {
      key: 'Language use',
      short: 'Language',
      score: languageUse,
      trend: accuracy >= 72 ? '+0.2' : 'watch',
      pattern: accuracy < 72
        ? 'Register and sentence control need short reps.'
        : 'Grammar is stable enough for longer writing.',
      accent: Colors.ink,
      urgent: sessions > 0 && accuracy < 72,
    },
    {
      key: 'Cultural knowledge',
      short: 'Culture',
      score: culturalKnowledge,
      trend: developmentIndex > 0 ? '+0.2' : 'new',
      pattern: sessions < 3
        ? 'More evidence needed before culture scoring.'
        : 'Add specific examples to lift presentational tasks.',
      accent: Colors.gold,
    },
  ];
}

function getWeakSignal(signals: RubricSignal[]) {
  return signals.reduce((weakest, signal) => (
    signal.score < weakest.score ? signal : weakest
  ), signals[0]);
}

function pathNameForLevel(level: number) {
  if (level >= 85) return 'AP Fluency Architect';
  if (level >= 65) return 'Rubric Strategist';
  if (level >= 40) return 'Timed Response Builder';
  if (level >= 20) return 'Exam Stamina Builder';
  if (level >= 8) return 'AP Pattern Finder';
  return 'Diagnostic Explorer';
}

function nextUnlockForLevel(level: number) {
  if (level < 8) return 'Level 8 unlocks intermediate mixed prompts.';
  if (level < 20) return 'Level 20 unlocks advanced AP rotations.';
  if (level < 40) return 'Level 40 unlocks harder timing pressure.';
  if (level < 65) return 'Level 65 unlocks full rubric strategy cycles.';
  if (level < 85) return 'Level 85 unlocks mastery polish.';
  return 'Mastery levels keep sharpening speed, register, and culture.';
}

function LevelPathPanel({
  level,
  label,
  pathName,
  progress,
  xpIntoLevel,
  xpNeeded,
  estimatedScore,
  weakSignal,
  action,
  languageGlyph,
  langCode,
  compact,
}: {
  level: number;
  label: string;
  pathName: string;
  progress: number;
  xpIntoLevel: number;
  xpNeeded: number;
  estimatedScore: number;
  weakSignal: RubricSignal;
  action: PlanAction;
  languageGlyph: string;
  langCode: LanguageCode;
  compact?: boolean;
}) {
  return (
    <View style={[styles.pathPanel, compact && styles.pathPanelCompact]}>
      <View style={styles.pathHaloOne} />
      <View style={styles.pathHaloTwo} />
      <View style={[styles.pathHeader, compact && styles.pathHeaderCompact]}>
        <View style={styles.pathIdentity}>
          <LanguageMark code={langCode} size={compact ? 'sm' : 'md'} glyph={languageGlyph} />
          <View style={styles.pathIdentityCopy}>
            <Text style={styles.pathKicker}>Kibbo Path</Text>
            <Text style={[styles.pathTitle, compact && styles.pathTitleCompact]}>{pathName}</Text>
          </View>
        </View>
        <View style={[styles.levelToken, compact && styles.levelTokenCompact]}>
          <Text style={styles.levelTokenLabel}>Level</Text>
          <Text style={[styles.levelTokenValue, compact && styles.levelTokenValueCompact]}>{level}</Text>
        </View>
      </View>

      <View style={[styles.pathBody, compact && styles.pathBodyCompact]}>
        <View style={styles.pathMainCopy}>
          <Text style={[styles.pathHeadline, compact && styles.pathHeadlineCompact]}>
            Level {level}: today’s mission
          </Text>
          <Text style={[styles.pathSubhead, compact && styles.pathSubheadCompact]}>
            Kibbo builds today’s AP Japanese work around you: weak spots, recent scores, schedule, and AP task timing.
          </Text>
        </View>
        <View style={[styles.pathStats, compact && styles.pathStatsCompact]}>
          <View style={styles.pathStat}>
            <Text style={styles.pathStatLabel}>AP readiness</Text>
            <Text style={styles.pathStatValue}>{scoreLabel(estimatedScore)}</Text>
          </View>
          <View style={styles.pathStat}>
            <Text style={styles.pathStatLabel}>Track</Text>
            <Text style={styles.pathStatValue}>{label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.levelRail}>
        <View style={styles.levelRailTop}>
          <Text style={styles.levelRailLabel}>{xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()} level XP</Text>
          <Text style={styles.levelRailLabel}>Next: {nextUnlockForLevel(level)}</Text>
        </View>
        <View style={styles.levelRailTrack}>
          <View style={[styles.levelRailFill, { width: `${clamp(progress, 0.06, 1) * 100}%` }]} />
        </View>
      </View>

      <View style={[styles.pathFooter, compact && styles.pathFooterCompact]}>
        <View style={styles.pathWeakSignal}>
          <CompassIcon size={19} color={Colors.primary} strokeWidth={2.3} />
          <View style={styles.pathWeakCopy}>
            <Text style={styles.pathWeakLabel}>Level blocker</Text>
            <Text style={styles.pathWeakText} numberOfLines={2}>{weakSignal.key}: {weakSignal.pattern}</Text>
          </View>
        </View>
        <RaisedButton title={compact ? 'Start' : action.title} onPress={action.onPress} compact={compact} />
      </View>
    </View>
  );
}

function RubricBarChart({
  signals,
  compact,
}: {
  signals: RubricSignal[];
  compact?: boolean;
}) {
  const weakest = getWeakSignal(signals);

  return (
    <View style={[styles.barChartCard, compact && styles.barChartCardCompact]}>
      <View style={styles.barChartTop}>
        <View>
          <Text style={styles.panelKicker}>Rubric bars</Text>
          <Text style={[styles.barChartTitle, compact && styles.barChartTitleCompact]}>AP dimension profile</Text>
        </View>
        <View style={styles.scalePill}>
          <Text style={styles.scalePillText}>1-5</Text>
        </View>
      </View>
      <View style={styles.barScaleHeader}>
        <Text style={styles.barScaleText}>1</Text>
        <Text style={styles.barScaleText}>3</Text>
        <Text style={styles.barScaleText}>5</Text>
      </View>
      <View style={styles.barChartRows}>
        {signals.map((signal) => {
          const widthPercent = `${clamp(signal.score / 5, 0.04, 1) * 100}%` as DimensionValue;
          const isWeakest = signal.key === weakest.key;
          return (
            <View key={signal.key} style={styles.barRow}>
              <View style={styles.barLabelCol}>
                <Text style={styles.barLabel} numberOfLines={1}>{compact ? signal.short : signal.key}</Text>
                <Text style={[styles.barPattern, compact && styles.barPatternCompact]} numberOfLines={1}>{signal.pattern}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barGridLine, { left: '50%' }]} />
                <View style={[styles.barGridLine, { left: '100%' }]} />
                <View
                  style={[
                    styles.barFill,
                    isWeakest && styles.barFillWeakest,
                    { width: widthPercent, backgroundColor: isWeakest ? Colors.primary : signal.accent },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, isWeakest && styles.barValueWeakest]}>{scoreLabel(signal.score)}</Text>
            </View>
          );
        })}
      </View>
      {!compact && (
        <View style={styles.barChartNote}>
          <CompassIcon size={17} color={Colors.primary} strokeWidth={2.3} />
          <Text style={styles.barChartNoteText}>Weakest right now: {weakest.key}. Kibbo uses this to choose today's level work.</Text>
        </View>
      )}
    </View>
  );
}

function RaisedButton({
  title,
  onPress,
  compact,
}: {
  title: string;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.impact('medium');
        onPress();
      }}
      style={({ pressed }) => [styles.raisedButton, compact && styles.raisedButtonCompact, pressed && styles.raisedButtonPressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={[styles.raisedButtonText, compact && styles.raisedButtonTextCompact]}>{title}</Text>
      <NudgeChevronRight active={false} size={compact ? 17 : 20} color={Colors.onPrimary} strokeWidth={2.8} />
    </Pressable>
  );
}

type InteractiveState = {
  hovered: boolean;
  pressed: boolean;
};

function NudgeChevronRight({
  active,
  size,
  color,
  strokeWidth,
}: {
  active: boolean;
  size: number;
  color: string;
  strokeWidth: number;
}) {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(offset, {
      toValue: active ? 4 : 0,
      duration: 170,
      useNativeDriver: true,
    }).start();
  }, [active, offset]);

  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: offset }] }}>
      <ChevronRightIcon size={size} color={color} strokeWidth={strokeWidth} />
    </Animated.View>
  );
}

function GeneratedShelfArrow({ active }: { active: boolean }) {
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    arrowAnim.stopAnimation();
    arrowAnim.setValue(0);

    if (!active) return;

    Animated.timing(arrowAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [active, arrowAnim]);

  const translateX = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 8],
  });
  const opacity = arrowAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <ChevronRightIcon size={30} color={Colors.ink} strokeWidth={2.8} />
    </Animated.View>
  );
}

function InteractivePressable({
  children,
  onPress,
  style,
  wrapperStyle,
  hoverStyle,
  pressStyle,
  accessibilityLabel,
}: {
  children: React.ReactNode | ((state: InteractiveState) => React.ReactNode);
  onPress: () => void;
  style: StyleProp<ViewStyle> | ((state: InteractiveState) => StyleProp<ViewStyle>);
  wrapperStyle?: StyleProp<ViewStyle>;
  hoverStyle?: StyleProp<ViewStyle>;
  pressStyle?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const lift = useRef(new Animated.Value(0)).current;
  const active = hovered || pressed;

  useEffect(() => {
    Animated.spring(lift, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      tension: 190,
      friction: 16,
    }).start();
  }, [active, lift]);

  const state = { hovered, pressed };
  const resolvedStyle = typeof style === 'function' ? style(state) : style;

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => {
        setHovered(false);
        setPressed(false);
      }}
      onFocus={() => setHovered(true)}
      onBlur={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        setPressed(false);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={wrapperStyle}
    >
      <Animated.View
        style={[
          resolvedStyle,
          hovered && hoverStyle,
          pressed && pressStyle,
          {
            opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [1, pressed ? 0.96 : 1] }),
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, pressed ? 1 : -3] }) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, pressed ? 0.992 : 1.01] }) },
            ],
          },
        ]}
      >
        {typeof children === 'function' ? children(state) : children}
      </Animated.View>
    </Pressable>
  );
}

function PlanPill({ action }: { action: PlanAction }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={() => {
        haptics.impact('light');
        action.onPress();
      }}
      style={styles.planPill}
      accessibilityRole="button"
      accessibilityLabel={`Start ${action.title}`}
    >
      <View style={[styles.planPillIcon, { backgroundColor: `${action.accent}18` }]}>{action.icon}</View>
      <View style={styles.planPillCopy}>
        <Text style={styles.planPillTask} numberOfLines={1}>{action.task}</Text>
        <Text style={styles.planPillTitle} numberOfLines={1}>{action.title}</Text>
        <Text style={styles.planPillWhy} numberOfLines={1}>{action.why}</Text>
      </View>
      <View style={styles.minuteBadge}>
        <Text style={styles.minuteValue}>{action.minutes}</Text>
        <Text style={styles.minuteLabel}>min</Text>
      </View>
    </TouchableOpacity>
  );
}

function RubricStat({ signal, compact }: { signal: RubricSignal; compact?: boolean }) {
  return (
    <View style={[styles.rubricStat, signal.urgent && styles.rubricStatUrgent, compact && styles.rubricStatCompact]}>
      <View style={styles.rubricStatTop}>
        <View style={[styles.rubricDot, { backgroundColor: signal.accent }]} />
        <Text style={styles.rubricStatName} numberOfLines={1}>{compact ? signal.short : signal.key}</Text>
      </View>
      <Text style={styles.rubricStatScore}>{scoreLabel(signal.score)}</Text>
      <Text style={[styles.rubricStatTrend, signal.urgent && styles.rubricStatTrendUrgent]}>{signal.trend}</Text>
      {!compact && <Text style={styles.rubricStatPattern} numberOfLines={2}>{signal.pattern}</Text>}
    </View>
  );
}

function ScoreModule({
  estimatedScore,
  weakSignal,
  signals,
  compact,
}: {
  estimatedScore: number;
  weakSignal: RubricSignal;
  signals: RubricSignal[];
  compact?: boolean;
}) {
  return (
    <View style={[styles.scoreModule, compact && styles.scoreModuleCompact]}>
      <View style={styles.scoreBand}>
        <Text style={[styles.scoreBandTitle, compact && styles.scoreBandTitleCompact]}>Readiness score</Text>
        <Text style={[styles.scoreBandValue, compact && styles.scoreBandValueCompact]}>{scoreLabel(estimatedScore)}</Text>
      </View>
      <View style={[styles.scoreBody, compact && styles.scoreBodyCompact]}>
        <View style={[styles.weakScoreCard, compact && styles.weakScoreCardCompact]}>
          <View style={styles.weakScoreTop}>
            <LightbulbIcon size={20} color={Colors.primary} strokeWidth={2.3} />
            <Text style={styles.weakScoreLabel}>Today's weak signal</Text>
          </View>
          <Text style={styles.weakScoreTitle}>{weakSignal.key}</Text>
          <Text style={styles.weakScoreText}>{weakSignal.pattern}</Text>
        </View>
        <View style={[styles.scoreRubricRow, compact && styles.scoreRubricRowCompact]}>
          {signals.slice(0, compact ? 2 : 3).map((signal) => (
            <View key={signal.key} style={styles.scoreMiniStat}>
              <View style={[styles.scoreMiniIcon, { backgroundColor: `${signal.accent}18` }]}>
                <View style={[styles.scoreMiniDot, { backgroundColor: signal.accent }]} />
              </View>
              <View style={styles.scoreMiniCopy}>
                <Text style={styles.scoreMiniTitle} numberOfLines={1}>{signal.short}</Text>
                <Text style={styles.scoreMiniValue}>{scoreLabel(signal.score)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ActivityPreview({
  recentSessions,
  recentAccuracy,
  onPress,
  onOpenAnalytics,
}: {
  recentSessions: number;
  recentAccuracy: number;
  onPress: () => void;
  onOpenAnalytics: () => void;
}) {
  return (
    <View style={styles.activityPreview}>
      <View style={styles.activityPreviewTop}>
        <View style={styles.activityPreviewTitleRow}>
          <ChartIcon size={20} color={Colors.ink} strokeWidth={2.2} />
          <Text style={styles.activityPreviewTitle}>AP Activities</Text>
        </View>
        <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={styles.activityIconButton} accessibilityLabel="Open activity drawer">
          <ChevronRightIcon size={22} color={Colors.ink} strokeWidth={2.8} />
        </TouchableOpacity>
      </View>
      <View style={styles.activityMetricStrip}>
        <View style={styles.activityMetricBlock}>
          <Text style={styles.activityMetricLabel}>Scored attempts</Text>
          <Text style={styles.activityMetricValue}>{recentSessions}</Text>
        </View>
        <View style={styles.activityMetricBlock}>
          <Text style={styles.activityMetricLabel}>Recent accuracy</Text>
          <Text style={styles.activityMetricValue}>{recentAccuracy || 0}%</Text>
        </View>
      </View>
      <TouchableOpacity activeOpacity={0.84} onPress={onOpenAnalytics} style={styles.analyticsButton}>
        <Text style={styles.analyticsButtonText}>Open analytics</Text>
        <ChevronRightIcon size={17} color={Colors.primary} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

function YouPanel({
  weakSignal,
  strongestLabel,
  recentSessions,
  recentAccuracy,
  onOpenAnalytics,
}: {
  weakSignal: RubricSignal;
  strongestLabel: string;
  recentSessions: number;
  recentAccuracy: number;
  onOpenAnalytics: () => void;
}) {
  return (
    <View style={styles.youPanel}>
      <View style={styles.youPanelTop}>
        <View>
          <Text style={styles.panelKicker}>You</Text>
          <Text style={styles.youPanelTitle}>Your coach profile</Text>
        </View>
        <TouchableOpacity activeOpacity={0.84} onPress={onOpenAnalytics} style={styles.youPanelButton}>
          <Text style={styles.youPanelButtonText}>Details</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.youSignalGrid}>
        <View style={styles.youSignalCard}>
          <Text style={styles.youSignalLabel}>Strongest</Text>
          <Text style={styles.youSignalValue} numberOfLines={1}>{strongestLabel}</Text>
        </View>
        <View style={[styles.youSignalCard, styles.youSignalCardWeak]}>
          <Text style={styles.youSignalLabel}>Weakest</Text>
          <Text style={styles.youSignalValue} numberOfLines={1}>{weakSignal.short}</Text>
        </View>
      </View>

      <View style={styles.youCoachNote}>
        <CompassIcon size={18} color={Colors.primary} strokeWidth={2.3} />
        <Text style={styles.youCoachText}>
          Work on {weakSignal.key.toLowerCase()} today: {weakSignal.pattern}
        </Text>
      </View>

      <View style={styles.youScheduleRow}>
        <View style={styles.youScheduleStat}>
          <Text style={styles.youScheduleValue}>{recentSessions}</Text>
          <Text style={styles.youScheduleLabel}>recent attempts</Text>
        </View>
        <View style={styles.youScheduleStat}>
          <Text style={styles.youScheduleValue}>{recentAccuracy || 0}%</Text>
          <Text style={styles.youScheduleLabel}>recent accuracy</Text>
        </View>
      </View>
    </View>
  );
}

function GeneratedModesPanel({ actions }: { actions: PlanAction[] }) {
  return (
    <View style={styles.generatedModesPanel}>
      <View style={styles.generatedModesTop}>
        <View>
          <Text style={styles.panelKicker}>Adaptive AP modes</Text>
        <Text style={styles.generatedModesTitle}>Generated from your profile</Text>
        </View>
      </View>
      <View style={styles.generatedModeGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            activeOpacity={0.86}
            onPress={() => {
              haptics.impact('light');
              action.onPress();
            }}
            style={[
              styles.generatedModeChip,
              {
                backgroundColor: tint(action.accent, '0D'),
                borderColor: tint(action.accent, '44'),
                shadowColor: action.accent,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Start generated ${action.title}`}
          >
            <View style={[styles.generatedModeIcon, { backgroundColor: tint(action.accent, '1F'), borderColor: tint(action.accent, '38') }]}>
              {action.icon}
            </View>
            <View style={styles.generatedModeCopy}>
              <Text style={styles.generatedModeTitle} numberOfLines={1}>{action.task}</Text>
              <Text style={styles.generatedModeMeta} numberOfLines={1}>{action.rubric}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.generatedModesNote}>
        Listening, speaking, reading, conversation, and text chat change as Kibbo learns you.
      </Text>
    </View>
  );
}

function NextWorkDock({
  action,
  compact,
}: {
  action: PlanAction;
  compact?: boolean;
}) {
  return (
    <View style={[styles.nextDock, compact && styles.nextDockCompact]}>
      {!compact && (
        <View style={styles.nextDockBack}>
          <ChevronRightIcon size={24} color={Colors.onPrimary} strokeWidth={2.8} />
        </View>
      )}
      <View style={[styles.nextDockIcon, { backgroundColor: `${action.accent}26` }]}>{action.icon}</View>
      <View style={styles.nextDockCopy}>
        <Text style={styles.nextDockTitle} numberOfLines={1}>{action.title}</Text>
        <Text style={styles.nextDockText} numberOfLines={1}>{action.rubric} | {action.why}</Text>
      </View>
      <RaisedButton title="Start" onPress={action.onPress} compact={compact} />
    </View>
  );
}

function SimplePromoBanner({
  compact,
  onPress,
}: {
  compact: boolean;
  onPress: () => void;
}) {
  if (compact) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.simplePromo}
      accessibilityRole="button"
      accessibilityLabel="View Kibbo plans"
    >
      <View style={styles.simplePromoIcon}>
        <StarIcon size={20} color={Colors.onPrimary} strokeWidth={2.2} />
      </View>
      <View style={styles.simplePromoCopy}>
        <Text style={styles.simplePromoTitle}>Kibbo Pro unlocks your full AP coach</Text>
        <Text style={styles.simplePromoText}>More generated drills | error memory | deeper rubric feedback</Text>
      </View>
      <View style={styles.simplePromoButton}>
        <Text style={styles.simplePromoButtonText}>View plans</Text>
        <ChevronRightIcon size={18} color={Colors.onPrimary} strokeWidth={2.8} />
      </View>
    </TouchableOpacity>
  );
}

function SimpleCourseCard({
  languageName,
  nativeName,
  level,
  progress,
  xpIntoLevel,
  xpNeeded,
  glyph,
  langCode,
  compact,
}: {
  languageName: string;
  nativeName: string;
  level: number;
  progress: number;
  xpIntoLevel: number;
  xpNeeded: number;
  glyph: string;
  langCode: LanguageCode;
  compact: boolean;
}) {
  const progressWidth = `${Math.round(clamp(progress, 0, 1) * 100)}%` as DimensionValue;

  return (
    <View style={[styles.simpleCourseCard, compact && styles.simpleCourseCardCompact]}>
      <View style={styles.simpleCourseMain}>
        <LanguageMark code={langCode} size={compact ? 'md' : 'lg'} glyph={glyph} />
        <View style={styles.simpleCourseCopy}>
          <Text style={styles.simpleCourseEyebrow}>AP Japanese Coach</Text>
          <Text style={[styles.simpleCourseTitle, compact && styles.simpleCourseTitleCompact]}>{languageName}</Text>
          <Text style={styles.simpleCourseSubtitle}>{nativeName} | AP language training</Text>
        </View>
      </View>
      <View style={styles.simpleLevelRow}>
        <View>
          <Text style={styles.simpleLevelLabel}>Level {level}</Text>
          <Text style={styles.simpleLevelMeta}>Level practice</Text>
        </View>
        <View style={styles.simpleXpBadge}>
          <Text style={styles.simpleXpBadgeText}>{xpIntoLevel}/{xpNeeded} XP</Text>
        </View>
      </View>
      <View style={styles.simpleProgressTrack}>
        <View style={[styles.simpleProgressFill, { width: progressWidth }]} />
      </View>
    </View>
  );
}

function SimpleTotalXpCard({
  totalXP,
  accuracy,
  bestSkill,
  developmentIndex,
  compact,
}: {
  totalXP: number;
  accuracy: number;
  bestSkill: string;
  developmentIndex: number;
  compact: boolean;
}) {
  const stats = [
    { label: 'Accuracy', value: `${accuracy}%`, note: 'answer signal', accent: Colors.teal },
    { label: 'Best skill', value: bestSkill, note: 'rubric pattern', accent: Colors.primary },
    { label: 'Development', value: developmentIndex > 0 ? 'Growing' : 'Baseline', note: 'level signal', accent: Colors.ink },
  ];

  return (
    <View style={styles.simpleScoreCard}>
      <View style={styles.simpleScoreHeader}>
        <Text style={styles.simpleScoreTitle}>Total XP</Text>
        <Text style={styles.simpleScoreValue}>{totalXP} pts</Text>
      </View>
      <View style={[styles.simpleStatsGrid, compact && styles.simpleStatsGridCompact]}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.simpleStatCard, compact && styles.simpleStatCardCompact]}>
            <View style={[styles.simpleStatAccent, { backgroundColor: stat.accent }]} />
            <Text style={styles.simpleStatValue}>{stat.value}</Text>
            <Text style={styles.simpleStatLabel}>{stat.label}</Text>
            <Text style={styles.simpleStatNote}>{stat.note}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SimplePracticeCard({
  title,
  subtitle,
  icon,
  accent,
  onPress,
  compact,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  onPress: () => void;
  compact: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => {
        haptics.impact('light');
        onPress();
      }}
      style={[styles.simplePracticeCard, compact && styles.simplePracticeCardCompact]}
      accessibilityRole="button"
      accessibilityLabel={`Start ${title}`}
    >
      <View style={[styles.simplePracticeIcon, { backgroundColor: `${accent}18` }]}>
        {icon}
      </View>
      <View style={styles.simplePracticeCopy}>
        <Text style={styles.simplePracticeTitle}>{title}</Text>
        <Text style={styles.simplePracticeText}>{subtitle}</Text>
      </View>
      <ChevronRightIcon size={22} color={Colors.textSub} strokeWidth={2.6} />
    </TouchableOpacity>
  );
}

function shortSkillLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('listen')) return 'LSN';
  if (normalized.includes('speak') || normalized.includes('conversation')) return 'SPK';
  if (normalized.includes('read')) return 'RDG';
  if (normalized.includes('text') || normalized.includes('writing')) return 'WRT';
  if (normalized.includes('baseline')) return 'AP';
  return label.slice(0, 3).toUpperCase();
}

function CoachPromoStrip({
  compact,
  onPress,
}: {
  compact: boolean;
  onPress: () => void;
}) {
  if (compact) return null;

  return (
    <InteractivePressable
      onPress={() => {
        haptics.impact('light');
        onPress();
      }}
      style={styles.coachPromoStrip}
      hoverStyle={styles.coachPromoStripHover}
      pressStyle={styles.coachPromoStripPress}
      accessibilityLabel="View Kibbo plans"
    >
      {({ hovered }) => (
        <>
      <View style={styles.coachPromoBadge}>
        <StarIcon size={19} color={Colors.onPrimary} strokeWidth={2.3} />
      </View>
      <View style={styles.coachPromoCopy}>
        <Text style={styles.coachPromoTitle}>Kibbo Pro adds coach memory</Text>
        <Text style={styles.coachPromoText}>More monthly credits | stored error patterns | deeper AP rubric feedback</Text>
      </View>
      <View style={[styles.coachPromoButton, hovered && styles.coachPromoButtonHover]}>
        <Text style={styles.coachPromoButtonText}>View plans</Text>
        <View style={styles.coachPromoButtonArrow}>
          <NudgeChevronRight active={hovered} size={18} color="#B93D31" strokeWidth={2.8} />
        </View>
      </View>
        </>
      )}
    </InteractivePressable>
  );
}

function CoachHeroCard({
  languageName,
  nativeName,
  languageGlyph,
  langCode,
  weakSignal,
  playerLevel,
  xpIntoLevel,
  xpNeeded,
  action,
  creditsLabel,
  compact,
}: {
  languageName: string;
  nativeName: string;
  languageGlyph: string;
  langCode: LanguageCode;
  weakSignal: RubricSignal;
  playerLevel: number;
  xpIntoLevel: number;
  xpNeeded: number;
  action: PlanAction;
  creditsLabel: string;
  compact: boolean;
}) {
  const progressWidth = `${Math.round(clamp(xpIntoLevel / Math.max(1, xpNeeded), 0, 1) * 100)}%` as DimensionValue;

  return (
    <View style={[styles.coachHeroCard, compact && styles.coachHeroCardCompact]}>
      <View style={[styles.coachHeroMain, compact && styles.coachHeroMainCompact]}>
        <View style={[styles.coachHeroLanguageMark, compact && styles.coachHeroLanguageMarkCompact]}>
          <LanguageMark code={langCode} size={compact ? 'md' : 'lg'} glyph={languageGlyph} />
        </View>
        <View style={styles.coachHeroCopy}>
          <Text style={styles.coachKicker}>AP Japanese Coach</Text>
          <Text style={[styles.coachHeroTitle, compact && styles.coachHeroTitleCompact]}>{languageName}</Text>
          <Text style={styles.coachHeroSubtitle}>{nativeName} | level-based AP practice</Text>
        </View>
      </View>

      <View style={[styles.coachHeroBody, compact && styles.coachHeroBodyCompact]}>
        <View style={styles.coachHeroMission}>
          <Text style={styles.coachHeroScore}>Level {playerLevel}</Text>
          <Text style={styles.coachHeroText}>
            Today's work is built around your current weak spot: {weakSignal.key.toLowerCase()}.
          </Text>
          <View style={styles.coachHeroChips}>
            <View style={styles.coachSignalChip}>
              <LightbulbIcon size={16} color={Colors.primary} strokeWidth={2.2} />
              <Text style={styles.coachSignalChipText}>{weakSignal.key}</Text>
            </View>
            <View style={styles.coachCreditChip}>
              <TrophyIcon size={15} color={Colors.gold} strokeWidth={2.2} />
              <Text style={styles.coachCreditChipText}>{creditsLabel}</Text>
            </View>
          </View>
          <View style={styles.coachHeroProgressTrack}>
            <View style={[styles.coachHeroProgressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.coachHeroProgressText}>
            {xpIntoLevel}/{xpNeeded} XP to Level {playerLevel + 1}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          haptics.impact('medium');
          action.onPress();
        }}
        style={[styles.coachHeroAction, compact && styles.coachHeroActionCompact]}
        accessibilityRole="button"
        accessibilityLabel={`Start ${action.title}`}
      >
        <View style={styles.coachHeroActionIcon}>{action.icon}</View>
        <View style={styles.coachHeroActionCopy}>
          <Text style={styles.coachHeroActionKicker}>Coach-picked</Text>
          <Text style={styles.coachHeroActionTitle} numberOfLines={compact ? 2 : 1}>{action.title}</Text>
        </View>
        <View style={styles.coachHeroActionButton}>
          <Text style={styles.coachHeroActionButtonText}>Start</Text>
          <ChevronRightIcon size={18} color={Colors.onPrimary} strokeWidth={2.8} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

function CoachPlanPanel({
  actions,
  compact,
}: {
  actions: PlanAction[];
  compact: boolean;
}) {
  const totalMinutes = actions.reduce((sum, action) => sum + action.minutes, 0);

  return (
    <View style={[styles.coachPlanPanel, compact && styles.coachPlanPanelCompact]}>
      <View style={styles.coachPlanHeader}>
        <View>
          <Text style={styles.coachPlanKicker}>Generated plan</Text>
          <Text style={styles.coachPlanTitle}>Today's work</Text>
        </View>
        <View style={styles.coachPlanTime}>
          <Text style={styles.coachPlanTimeText}>{totalMinutes} min</Text>
        </View>
      </View>

      <View style={styles.coachPlanSteps}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={action.id}
            activeOpacity={0.88}
            onPress={() => {
              haptics.impact('light');
              action.onPress();
            }}
            style={[styles.coachPlanStep, index === 0 && styles.coachPlanStepPrimary]}
            accessibilityRole="button"
            accessibilityLabel={`Start ${action.title}`}
          >
            <View style={[styles.coachStepNumber, index === 0 && styles.coachStepNumberPrimary]}>
              <Text style={[styles.coachStepNumberText, index === 0 && styles.coachStepNumberTextPrimary]}>{index + 1}</Text>
            </View>
            <View style={styles.coachStepCopy}>
              <Text style={[styles.coachStepRubric, index === 0 && styles.coachStepRubricPrimary]}>{action.rubric}</Text>
              <Text style={[styles.coachStepTitle, index === 0 && styles.coachStepTitlePrimary]} numberOfLines={1}>{action.title}</Text>
              <Text style={[styles.coachStepWhy, index === 0 && styles.coachStepWhyPrimary]} numberOfLines={2}>{action.why}</Text>
            </View>
            <View style={styles.coachStepMeta}>
              <Text style={[styles.coachStepMinutes, index === 0 && styles.coachStepMinutesPrimary]}>{action.minutes}m</Text>
              <Text style={[styles.coachStepCredits, index === 0 && styles.coachStepCreditsPrimary]}>{action.credits} credit</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function CoachRubricPanel({
  signals,
  compact,
}: {
  signals: RubricSignal[];
  compact: boolean;
}) {
  const nextWeakSignal = getWeakSignal(signals);

  return (
    <View style={[styles.coachRubricPanel, compact && styles.coachRubricPanelCompact]}>
      <View style={styles.coachRubricHeader}>
        <Text style={styles.coachSectionKicker}>Rubric profile</Text>
        <Text style={styles.coachRubricHint}>four AP signals</Text>
      </View>
      <View style={[styles.coachRubricGrid, compact && styles.coachRubricGridCompact]}>
        {signals.map((signal) => {
          const isNextWeakSpot = signal.key === nextWeakSignal.key;

          return (
            <View
              key={signal.key}
              style={[
                styles.coachRubricTile,
                isNextWeakSpot && styles.coachRubricTileNextWeak,
              ]}
            >
              <View style={[styles.coachRubricAccent, isNextWeakSpot ? styles.coachRubricAccentNextWeak : styles.coachRubricAccentNeutral]} />
              <Text style={styles.coachRubricValue}>{rubricStageLabel(signal.score)}</Text>
              <Text style={styles.coachRubricName}>{signal.key}</Text>
              <Text style={styles.coachRubricPattern} numberOfLines={2}>{signal.pattern}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ChallengeBoostBadge({
  boost,
  mobile = false,
}: {
  boost: ChallengeBoostState;
  mobile?: boolean;
}) {
  if (!boost.active) return null;
  const isAstro = boost.source === 'astro';
  const multiplierLabel = boost.multiplier >= 2
    ? '2x XP'
    : `+${Math.round((boost.multiplier - 1) * 100)}% XP`;

  return (
    <View
      style={[styles.challengeBoostBadge, mobile && styles.challengeBoostBadgeMobile]}
      accessibilityLabel={`${isAstro ? 'Astro Boost' : 'Challenge Boost'} active. Harder generated drills award ${multiplierLabel}.`}
    >
      <View style={[styles.challengeBoostIcon, mobile && styles.challengeBoostIconMobile]}>
        <StarIcon size={mobile ? 12 : 14} color={Colors.primary} strokeWidth={2.6} />
      </View>
      <Text style={[styles.challengeBoostText, mobile && styles.challengeBoostTextMobile]}>
        {mobile ? (isAstro ? 'Astro' : 'Boost') : (isAstro ? 'Astro Boost' : 'Challenge Boost')}
      </Text>
      <Text style={[styles.challengeBoostMultiplier, mobile && styles.challengeBoostMultiplierMobile]}>{multiplierLabel}</Text>
    </View>
  );
}

function ChallengeBoostCluster({
  boosts,
  mobile = false,
}: {
  boosts: ChallengeBoostState[];
  mobile?: boolean;
}) {
  const activeBoosts = boosts.filter((boost) => boost.active);
  if (activeBoosts.length === 0) return null;

  return (
    <View style={[styles.challengeBoostCluster, mobile && styles.challengeBoostClusterMobile]}>
      {activeBoosts.map((boost) => (
        <ChallengeBoostBadge
          key={`${boost.source ?? 'performance'}-${boost.label}`}
          boost={boost}
          mobile={mobile}
        />
      ))}
    </View>
  );
}

function CoachGeneratedWorkCard({
  action,
  compact,
}: {
  action: PlanAction;
  compact: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => {
        haptics.impact('light');
        action.onPress();
      }}
      style={[styles.coachWorkCard, compact && styles.coachWorkCardCompact]}
      accessibilityRole="button"
      accessibilityLabel={`Start ${action.title}`}
    >
      <View style={[styles.coachWorkIcon, { backgroundColor: `${action.accent}16` }]}>{action.icon}</View>
      <View style={styles.coachWorkCopy}>
        <Text style={[styles.coachWorkRubric, { color: action.accent }]} numberOfLines={1}>{action.rubric}</Text>
        <Text style={styles.coachWorkTitle} numberOfLines={compact ? 2 : 1}>{action.title}</Text>
        <Text style={styles.coachWorkText} numberOfLines={2}>{action.why}</Text>
      </View>
      <ChevronRightIcon size={21} color={Colors.textSub} strokeWidth={2.7} />
    </TouchableOpacity>
  );
}

function CoachGeneratedWorkSection({
  actions,
  compact,
}: {
  actions: PlanAction[];
  compact: boolean;
}) {
  return (
    <View style={styles.coachWorkSection}>
      <View style={styles.coachWorkHeader}>
        <View>
          <Text style={styles.coachSectionKicker}>Coach-generated AP work</Text>
          <Text style={styles.coachWorkHeading}>Built from your weak spots</Text>
        </View>
        {!compact && (
          <View style={styles.coachWorkMiniBadge}>
            <Text style={styles.coachWorkMiniBadgeText}>No lesson library</Text>
          </View>
        )}
      </View>
      <View style={[styles.coachWorkGrid, compact && styles.coachWorkGridCompact]}>
        {actions.map((action) => (
          <CoachGeneratedWorkCard key={action.id} action={action} compact={compact} />
        ))}
      </View>
    </View>
  );
}

function CoachPlacementCheck({
  onPress,
  compact,
  dense = false,
}: {
  onPress: () => void;
  compact: boolean;
  dense?: boolean;
}) {
  return (
    <InteractivePressable
      onPress={() => {
        haptics.impact('light');
        onPress();
      }}
      style={[styles.coachPlacementCard, compact && styles.coachPlacementCardCompact, dense && styles.coachPlacementCardDense]}
      hoverStyle={styles.coachPlacementCardHover}
      pressStyle={styles.coachPlacementCardPress}
      accessibilityLabel="Start placement recalibration"
    >
      {({ hovered }) => (
        <>
          <View style={[styles.coachPlacementIcon, dense && styles.coachPlacementIconDense, hovered && styles.coachPlacementIconHover]}>
            <SwitchIcon size={dense ? 18 : 23} color={hovered ? '#B93D31' : Colors.primary} strokeWidth={2.2} />
          </View>
          <View style={styles.coachPlacementCopy}>
            <Text style={[styles.coachPlacementTitle, dense && styles.coachPlacementTitleDense]}>Recalibrate level</Text>
            <Text style={[styles.coachPlacementText, dense && styles.coachPlacementTextDense]}>
              {dense ? 'Mixed AP check' : "Run a mixed AP check when today's work feels too easy or too hard."}
            </Text>
          </View>
        </>
      )}
    </InteractivePressable>
  );
}

function LevelJourneyStageCard({
  stage,
  playerLevel,
}: {
  stage: (typeof LEVEL_JOURNEY_STAGES)[number];
  playerLevel: number;
}) {
  const firstLevel = stage.levels[0];
  const lastLevel = stage.levels[stage.levels.length - 1];
  const active = playerLevel >= firstLevel && playerLevel <= lastLevel;
  const completed = playerLevel > lastLevel;

  return (
    <View style={[styles.levelJourneyStage, active && styles.levelJourneyStageActive]}>
      <View style={styles.levelJourneyStageHeader}>
        <TargetIcon size={18} color={active ? Colors.primary : Colors.ink} strokeWidth={2.4} />
        <Text style={styles.levelJourneyStageTitle}>{stage.title}</Text>
      </View>
      <View style={styles.levelJourneyDots}>
        {stage.levels.map((level, index) => {
          const isCurrent = level === playerLevel;
          const isDone = level < playerLevel || completed;
          return (
            <View key={level} style={styles.levelJourneyStep}>
              <View
                style={[
                  styles.levelJourneyNode,
                  isDone && styles.levelJourneyNodeDone,
                  isCurrent && styles.levelJourneyNodeCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.levelJourneyNodeText,
                    isDone && styles.levelJourneyNodeTextDone,
                    isCurrent && styles.levelJourneyNodeTextCurrent,
                  ]}
                >
                  {level}
                </Text>
              </View>
              {index < stage.levels.length - 1 && (
                <View style={[styles.levelJourneyConnector, level < playerLevel && styles.levelJourneyConnectorDone]} />
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.levelJourneyFocus}>{stage.focus}</Text>
    </View>
  );
}

function LevelJourneyModal({
  visible,
  playerLevel,
  xpIntoLevel,
  xpNeeded,
  onClose,
}: {
  visible: boolean;
  playerLevel: number;
  xpIntoLevel: number;
  xpNeeded: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const progressPercent = Math.round(clamp(xpIntoLevel / Math.max(1, xpNeeded), 0, 1) * 100);
  const compactMaxHeight = Math.max(340, height - 92);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={[styles.levelJourneyShade, isCompact && styles.levelJourneyShadeCompact]}>
        <TouchableOpacity activeOpacity={1} onPress={(event) => event.stopPropagation()} style={[styles.levelJourneyPanel, isCompact && styles.levelJourneyPanelCompact, isCompact && { maxHeight: compactMaxHeight }]}>
          <View style={[styles.levelJourneyTop, isCompact && styles.levelJourneyTopCompact]}>
            <View style={[styles.levelJourneyHeroIcon, isCompact && styles.levelJourneyHeroIconCompact]}>
              <Text style={styles.levelJourneyHeroLevel}>{playerLevel}</Text>
            </View>
            <View style={styles.levelJourneyHeroCopy}>
              <Text style={styles.levelJourneyKicker}>My AP journey</Text>
              <Text style={[styles.levelJourneyTitle, isCompact && styles.levelJourneyTitleCompact]}>Level ranges</Text>
              <Text style={[styles.levelJourneySubtitle, isCompact && styles.levelJourneySubtitleCompact]}>
                Kibbo uses your level to choose the right AP Japanese pressure: shorter repairs early, tougher rubric work later.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.levelJourneyClose} accessibilityLabel="Close level journey">
              <XIcon size={19} color={Colors.textMuted} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <View style={[styles.levelJourneyProgressCard, isCompact && styles.levelJourneyProgressCardCompact]}>
            <View>
              <Text style={styles.levelJourneyProgressLabel}>Current level</Text>
              <Text style={styles.levelJourneyProgressText}>{xpIntoLevel}/{xpNeeded} XP to Level {playerLevel + 1}</Text>
            </View>
            <View style={styles.levelJourneyProgressPill}>
              <Text style={styles.levelJourneyProgressPillText}>{progressPercent}%</Text>
            </View>
          </View>

          <ScrollView
            style={styles.levelJourneyScroll}
            contentContainerStyle={[styles.levelJourneyGrid, isCompact && styles.levelJourneyGridCompact]}
            showsVerticalScrollIndicator={false}
          >
            {LEVEL_JOURNEY_STAGES.map((stage) => (
              <LevelJourneyStageCard key={stage.title} stage={stage} playerLevel={playerLevel} />
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function GeneratedShelfActionCard({
  action,
  compact,
  dense = false,
  mobile = false,
  hoveredGeneratedActionId,
  setHoveredGeneratedActionId,
}: {
  action: PlanAction;
  compact: boolean;
  dense?: boolean;
  mobile?: boolean;
  hoveredGeneratedActionId: string | null;
  setHoveredGeneratedActionId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const expanded = !compact && hoveredGeneratedActionId === action.id;
  const subdued = !compact && Boolean(hoveredGeneratedActionId) && !expanded;
  const [cardHovered, setCardHovered] = useState(false);
  const [cardPressed, setCardPressed] = useState(false);

  return (
    <Pressable
      onHoverIn={() => {
        setCardHovered(true);
        if (!compact) setHoveredGeneratedActionId(action.id);
      }}
      onHoverOut={() => {
        setCardHovered(false);
        setCardPressed(false);
        if (!compact) setHoveredGeneratedActionId((current) => (current === action.id ? null : current));
      }}
      onFocus={() => {
        setCardHovered(true);
        if (!compact) setHoveredGeneratedActionId(action.id);
      }}
      onBlur={() => {
        setCardHovered(false);
        setCardPressed(false);
        if (!compact) setHoveredGeneratedActionId((current) => (current === action.id ? null : current));
      }}
      onPressIn={() => setCardPressed(true)}
      onPressOut={() => setCardPressed(false)}
      onPress={() => {
        haptics.impact('light');
        action.onPress();
      }}
      style={[
        styles.generatedShelfCard,
        {
          borderColor: mobile ? Colors.borderBright : `${action.accent}44`,
          backgroundColor: mobile ? '#FFFFFFF8' : dense ? '#FFFFFFF7' : '#FFFFFFF4',
        },
        !compact && styles.generatedShelfCardMotion,
        expanded && styles.generatedShelfCardExpanded,
        expanded && styles.generatedShelfCardHover,
        subdued && styles.generatedShelfCardSubdued,
        compact && styles.generatedShelfCardCompact,
        dense && styles.generatedShelfCardDense,
        mobile && styles.generatedShelfCardMobileCalm,
        mobile && styles.generatedShelfCardMobileMotion,
        mobile && cardHovered && styles.generatedShelfCardMobileHover,
        mobile && cardHovered && {
          borderColor: tint(action.accent, 'AA'),
          backgroundColor: tint(action.accent, '08'),
          shadowColor: action.accent,
        },
        cardPressed && styles.generatedShelfCardPress,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Start ${action.title}`}
    >
      {expanded ? (
        <>
          <View style={styles.generatedShelfExpandedLead}>
            <View style={[styles.generatedShelfIcon, styles.generatedShelfIconExpanded, { backgroundColor: `${action.accent}16` }]}>{action.icon}</View>
          </View>
          <View style={styles.generatedShelfExpandedCopy}>
            <Text style={[styles.generatedShelfKicker, { color: action.accent }]} numberOfLines={1}>{action.rubric}</Text>
            <Text style={styles.generatedShelfCardTitle} numberOfLines={1}>{action.title}</Text>
            <Text style={styles.generatedShelfText} numberOfLines={2}>{action.why}</Text>
            <View style={styles.generatedShelfMetaRow}>
              <Text style={styles.generatedShelfMetaText}>{action.credits} credit</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          {(dense || mobile) && <View style={[styles.generatedShelfAccentBar, { backgroundColor: action.accent }]} />}
          <View
            style={[
              styles.generatedShelfIcon,
              dense && styles.generatedShelfIconDense,
              mobile && styles.generatedShelfIconMobileCalm,
              { backgroundColor: tint(action.accent, mobile ? '0E' : dense ? '12' : '16') },
            ]}
          >
            {action.icon}
          </View>
          <Text style={[styles.generatedShelfModeLabel, dense && styles.generatedShelfModeLabelDense]} numberOfLines={1}>{action.task}</Text>
        </>
      )}
      <View
        pointerEvents="none"
        style={[
          styles.generatedShelfStartButton,
          expanded && styles.generatedShelfStartButtonVisible,
        ]}
      >
        <GeneratedShelfArrow active={expanded} />
      </View>
    </Pressable>
  );
}

function DenseUtilityActionTile({
  mobile,
  accent,
  icon,
  label,
  onPress,
  accessibilityLabel,
  idleTint,
  idleBorderAlpha,
}: {
  mobile?: boolean;
  accent: string;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  idleTint: string;
  idleBorderAlpha: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => {
        setHovered(false);
        setPressed(false);
      }}
      onFocus={() => setHovered(true)}
      onBlur={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        haptics.impact('light');
        onPress();
      }}
      style={[
        styles.denseUtilityTile,
        mobile && styles.denseUtilityTileMobileCalm,
        mobile && styles.denseUtilityTileMobileMotion,
        !mobile && {
          borderColor: tint(accent, idleBorderAlpha),
          backgroundColor: tint(accent, idleTint),
        },
        hovered && styles.denseUtilityTileHover,
        mobile && hovered && styles.denseUtilityTileMobileHover,
        hovered && {
          borderColor: tint(accent, 'AA'),
          backgroundColor: tint(accent, '08'),
          shadowColor: accent,
        },
        pressed && styles.denseUtilityTilePress,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {mobile && <View style={[styles.generatedShelfAccentBar, { backgroundColor: accent }]} />}
      <View style={[styles.generatedShelfIcon, styles.generatedShelfIconDense, styles.denseUtilityIcon, { backgroundColor: tint(accent, mobile ? '16' : '20') }]}>
        {icon}
      </View>
      <Text style={styles.generatedShelfModeLabelDense} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function CoachLearningHome({
  languageName,
  nativeName,
  languageGlyph,
  langCode,
  playerLevel,
  xpIntoLevel,
  xpNeeded,
  weakSignal,
  primaryAction,
  planActions,
  generatedActions,
  completedActionIds,
  creditsLabel,
  activeBoosts,
  onPlacement,
  onOpenAnalytics,
  compact,
  mobile,
  dense = false,
}: {
  languageName: string;
  nativeName: string;
  languageGlyph: string;
  langCode: LanguageCode;
  playerLevel: number;
  xpIntoLevel: number;
  xpNeeded: number;
  weakSignal: RubricSignal;
  primaryAction: PlanAction;
  planActions: PlanAction[];
  generatedActions: PlanAction[];
  completedActionIds: Set<string>;
  creditsLabel: string;
  activeBoosts: ChallengeBoostState[];
  onPlacement: () => void;
  onOpenAnalytics: () => void;
  compact: boolean;
  mobile: boolean;
  dense?: boolean;
}) {
  const progressPercent = Math.round(clamp(xpIntoLevel / Math.max(1, xpNeeded), 0, 1) * 100);
  const levelProgressAnim = useRef(new Animated.Value(0)).current;
  const [displayedLevelXP, setDisplayedLevelXP] = useState(0);
  const [xpCountAnimating, setXpCountAnimating] = useState(false);
  const primaryComplete = completedActionIds.has(primaryAction.id);
  const planQueue = mobile ? planActions.slice(1) : primaryComplete ? planActions : planActions.slice(1);
  const totalMinutes = planQueue.reduce((sum, action) => sum + action.minutes, 0);
  const completedPlanCount = planActions.filter((action) => completedActionIds.has(action.id)).length;
  const dailyPlanComplete = planActions.length > 0 && completedPlanCount >= planActions.length;
  const planHeaderTitle = mobile ? (dailyPlanComplete ? 'Complete' : 'Next') : dense ? (primaryComplete ? 'Plan' : 'Next') : (primaryComplete ? 'Generated plan' : 'After that');
  const planHeaderKicker = mobile ? '' : dense ? 'Plan' : (primaryComplete ? "Today's checklist" : 'Generated plan');
  const planHeaderMeta = primaryComplete ? `${completedPlanCount}/${planActions.length} done` : `${totalMinutes} min`;
  const showPlanHeaderKicker = !mobile;
  const showPlanHeaderMeta = !mobile;
  const displayActions = dense ? generatedActions.slice(0, 4) : compact ? generatedActions.slice(0, 4) : generatedActions;
  const levelRankTitle = getLevelRankTitle(playerLevel);
  const primaryActionDisplayTitle = mobile && dense
    ? ({
      'Text-chat register repair': 'Text-chat repair',
      'Listening accuracy repair': 'Listening repair',
      'Timed response control': 'Speaking control',
      'Run the AP diagnostic': 'Level check',
      'Evidence finder': 'Evidence finder',
      'Conversation repair': 'Conversation',
    }[primaryAction.title] ?? primaryAction.title)
    : primaryAction.title;
  const [hoveredGeneratedActionId, setHoveredGeneratedActionId] = useState<string | null>(null);
  const [levelJourneyOpen, setLevelJourneyOpen] = useState(false);
  const animatedProgressWidth = levelProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${progressPercent}%`],
  });
  const xpCountScale = levelProgressAnim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1.24, 1.08, 1],
  });
  const xpCountMargin = levelProgressAnim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [6, 3, 0],
  });

  useEffect(() => {
    levelProgressAnim.stopAnimation();
    levelProgressAnim.setValue(0);
    setDisplayedLevelXP(0);
    setXpCountAnimating(xpIntoLevel > 0);

    const listenerId = levelProgressAnim.addListener(({ value }) => {
      setDisplayedLevelXP(Math.round(xpIntoLevel * value));
    });

    Animated.timing(levelProgressAnim, {
      toValue: 1,
      duration: 850,
      useNativeDriver: false,
    }).start(() => {
      setDisplayedLevelXP(xpIntoLevel);
      setXpCountAnimating(false);
    });

    return () => {
      levelProgressAnim.removeListener(listenerId);
    };
  }, [levelProgressAnim, playerLevel, progressPercent, xpIntoLevel]);

  return (
    <View style={[styles.learningHome, compact && styles.learningHomeCompact, dense && styles.learningHomeDense, mobile && styles.learningHomeMobile]}>
      <View style={[styles.learningTopGrid, compact && styles.learningTopGridCompact, mobile && styles.learningTopGridMobile]}>
        <View style={[styles.levelHero, compact && styles.levelHeroCompact, dense && styles.levelHeroDense, mobile && styles.levelHeroMobileCalm]}>
          <View style={[styles.levelHeroGlow, mobile && styles.levelHeroGlowMobile]} />
          <View style={[styles.levelHeroTop, compact && styles.levelHeroTopCompact, dense && styles.levelHeroTopDense, mobile && styles.levelHeroTopMobile]}>
            <LanguageMark code={langCode} size={mobile ? 'sm' : dense ? 'sm' : compact ? 'md' : 'lg'} glyph={languageGlyph} />
            <View style={[styles.levelHeroCopy, mobile && styles.levelHeroCopyMobile]}>
              <Text
                style={[styles.platformTitle, compact && styles.platformTitleCompact, dense && styles.platformTitleDense, mobile && styles.platformTitleMobile]}
                numberOfLines={compact ? 2 : 1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {languageName} 日本語
              </Text>
              <Text style={[styles.platformSubtitle, dense && styles.platformSubtitleDense, mobile && styles.platformSubtitleMobile]}>{dense ? 'AP coach' : 'Coach-personalized drills and AP practice'}</Text>
            </View>
            {!compact && (
              <InteractivePressable
                onPress={() => {
                  haptics.impact('light');
                  setLevelJourneyOpen(true);
                }}
                style={styles.levelBadgeLarge}
                hoverStyle={styles.levelBadgeLargeHover}
                pressStyle={styles.levelBadgeLargePress}
                accessibilityLabel="Open level ranges"
              >
                <Text style={styles.levelBadgeLargeLabel}>Level</Text>
                <Text style={styles.levelBadgeLargeValue}>{playerLevel}</Text>
              </InteractivePressable>
            )}
          </View>

          <View style={[styles.levelHeroStatusRow, dense && styles.levelHeroStatusRowDense, mobile && styles.levelHeroStatusRowMobile]}>
            <View style={[styles.levelHeroStatusCopy, mobile && styles.levelHeroStatusCopyMobile]}>
              <Text style={[styles.levelHeroLevelTitle, dense && styles.levelHeroLevelTitleDense, mobile && styles.levelHeroLevelTitleMobile]}>{levelRankTitle}</Text>
              <View style={[styles.levelHeroXpLine, mobile && styles.levelHeroXpLineMobile]}>
                <Animated.Text
                  style={[
                    styles.levelHeroLevelSub,
                    mobile && styles.levelHeroLevelSubMobile,
                    styles.levelHeroXpCount,
                    xpCountAnimating && { marginRight: xpCountMargin, transform: [{ scale: xpCountScale }] },
                  ]}
                >
                  {displayedLevelXP}
                </Animated.Text>
                <Text style={[styles.levelHeroLevelSub, dense && styles.levelHeroLevelSubDense, mobile && styles.levelHeroLevelSubMobile]}>/{xpNeeded} XP</Text>
              </View>
            </View>
            <View style={[styles.levelHeroChips, dense && styles.levelHeroChipsDense, mobile && styles.levelHeroChipsMobile]}>
              {!mobile && (
                <View style={[styles.coachSignalChip, dense && styles.coachSignalChipDense, mobile && styles.coachSignalChipMobile]}>
                  <LightbulbIcon size={dense ? 14 : 16} color={Colors.primary} strokeWidth={2.2} />
                  <Text style={[styles.coachSignalChipText, dense && styles.coachSignalChipTextDense, mobile && styles.coachSignalChipTextMobile]}>{dense ? weakSignal.short : weakSignal.key}</Text>
                </View>
              )}
              <View style={[(mobile || dense) && styles.levelHeroCreditStack]}>
                {(mobile || dense) && <ChallengeBoostCluster boosts={activeBoosts} mobile />}
                <View style={[styles.coachCreditChip, dense && styles.coachCreditChipDense, mobile && styles.coachCreditChipMobile]}>
                  <TrophyIcon size={dense ? 13 : 15} color={Colors.gold} strokeWidth={2.2} />
                  <Text style={[styles.coachCreditChipText, dense && styles.coachCreditChipTextDense, mobile && styles.coachCreditChipTextMobile]}>{mobile ? creditsLabel.replace('/100 ', ' ') : dense ? creditsLabel.replace('/100 ', ' ') : creditsLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.levelProgressBlock, mobile && styles.levelProgressBlockMobile]}>
            <View style={[styles.levelProgressTrack, mobile && styles.levelProgressTrackMobile]}>
              <Animated.View style={[styles.levelProgressFill, { width: animatedProgressWidth }]} />
              <View pointerEvents="none" style={[styles.levelProgressSegments, mobile && styles.levelProgressSegmentsMobile]}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <View
                    key={`level-segment-${index}`}
                    style={[
                      styles.levelProgressSegment,
                      index > 0 && styles.levelProgressSegmentDivider,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          {primaryComplete ? (
            <View style={[styles.primaryCoachComplete, compact && styles.primaryCoachActionCompact, dense && styles.primaryCoachActionDense, mobile && styles.primaryCoachCompleteMobile]}>
              <View style={[styles.primaryCoachCompleteIcon, dense && styles.primaryCoachCompleteIconDense, mobile && styles.primaryCoachCompleteIconMobile]}>
                <CheckIcon size={28} color={Colors.onPrimary} strokeWidth={2.8} />
              </View>
              <View style={[styles.primaryCoachCopy, compact && styles.primaryCoachCopyCompact]}>
                <Text style={[styles.primaryCoachCompleteKicker, mobile && styles.primaryCoachCompleteKickerMobile]}>{mobile ? 'Complete' : dense ? 'Complete' : 'Coach-picked complete'}</Text>
                <Text style={[styles.primaryCoachCompleteTitle, mobile && styles.primaryCoachCompleteTitleMobile]} numberOfLines={compact ? 2 : 1}>{mobile ? primaryActionDisplayTitle : 'Come back tomorrow'}</Text>
                <Text style={[styles.primaryCoachCompleteReason, mobile && styles.primaryCoachCompleteReasonMobile]} numberOfLines={compact ? 2 : 1}>
                  {mobile ? 'Coach-picked AP work is done.' : 'Kibbo will build a fresh AP Japanese plan from your latest work.'}
                </Text>
              </View>
            </View>
          ) : (
            <InteractivePressable
              onPress={() => {
                haptics.impact('medium');
                primaryAction.onPress();
              }}
              style={[
                styles.primaryCoachAction,
                compact && styles.primaryCoachActionCompact,
                dense && styles.primaryCoachActionDense,
                mobile && styles.primaryCoachActionMobile,
              ]}
              hoverStyle={styles.primaryCoachActionHover}
              pressStyle={styles.primaryCoachActionPress}
              accessibilityLabel={`Start ${primaryAction.title}`}
            >
              {({ hovered }) => (
                <>
                  <View style={[styles.primaryCoachIcon, dense && styles.primaryCoachIconDense, mobile && styles.primaryCoachIconMobile, hovered && styles.primaryCoachIconHover]}>{primaryAction.icon}</View>
                  <View style={[styles.primaryCoachCopy, compact && styles.primaryCoachCopyCompact]}>
                    <Text style={[styles.primaryCoachKicker, dense && styles.primaryCoachKickerDense, mobile && styles.primaryCoachKickerMobile]}>{dense ? 'Start here' : 'Coach-picked first'}</Text>
                    <Text style={[styles.primaryCoachTitle, dense && styles.primaryCoachTitleDense, mobile && styles.primaryCoachTitleMobile]} numberOfLines={dense ? 1 : compact ? 2 : 1}>
                      {dense && primaryAction.id === 'diagnostic' ? 'Level check' : primaryActionDisplayTitle}
                    </Text>
                    {!dense && <Text style={[styles.primaryCoachReason, mobile && styles.primaryCoachReasonMobile]} numberOfLines={compact ? 2 : 1}>{primaryAction.why}</Text>}
                  </View>
                  <View style={[styles.primaryCoachStart, compact && styles.primaryCoachStartCompact, dense && styles.primaryCoachStartDense, mobile && styles.primaryCoachStartMobile, hovered && styles.primaryCoachStartHover]}>
                    <Text style={[styles.primaryCoachStartText, dense && styles.primaryCoachStartTextDense]}>Start</Text>
                    <NudgeChevronRight active={hovered} size={18} color={Colors.onPrimary} strokeWidth={2.9} />
                  </View>
                </>
              )}
            </InteractivePressable>
          )}
        </View>

        <View style={[styles.todayPlanCard, compact && styles.todayPlanCardCompact, dense && styles.todayPlanCardDense, mobile && styles.todayPlanCardMobile]}>
          <View style={[styles.todayPlanHeader, mobile && styles.todayPlanHeaderMobile]}>
            <View>
              {showPlanHeaderKicker && <Text style={[styles.todayPlanKicker, dense && styles.todayPlanKickerDense, mobile && styles.todayPlanKickerMobile]}>{planHeaderKicker}</Text>}
              <Text style={[styles.todayPlanTitle, primaryComplete && styles.todayPlanTitlePromoted, dense && styles.todayPlanTitleDense, mobile && styles.todayPlanTitleMobile]}>{planHeaderTitle}</Text>
            </View>
            {showPlanHeaderMeta && (
              <View style={[styles.todayPlanTime, dense && styles.todayPlanTimeDense, mobile && styles.todayPlanTimeMobile]}>
                <Text style={[styles.todayPlanTimeText, dense && styles.todayPlanTimeTextDense, mobile && styles.todayPlanTimeTextMobile]}>{planHeaderMeta}</Text>
              </View>
            )}
          </View>
          <View style={[styles.todayPlanList, dense && styles.todayPlanListDense, mobile && styles.todayPlanListMobile]}>
            {planQueue.map((action) => {
              const isComplete = completedActionIds.has(action.id);

              if (isComplete) {
                return (
                  <View key={action.id} style={[styles.todayPlanRowComplete, dense && styles.todayPlanRowDense, mobile && styles.todayPlanRowMobile]}>
                    <View style={[styles.todayPlanCompleteIcon, dense && styles.todayPlanIconDense, mobile && styles.todayPlanIconMobile]}>
                      <CheckIcon size={dense ? 18 : 22} color={Colors.onPrimary} strokeWidth={2.8} />
                    </View>
                    <View style={styles.todayPlanCopy}>
                      <Text style={[styles.todayPlanItemTitle, dense && styles.todayPlanItemTitleDense]} numberOfLines={1}>
                        {action.title}
                      </Text>
                      <Text style={[styles.todayPlanItemText, dense && styles.todayPlanItemTextDense]} numberOfLines={1}>
                        {action.rubric}
                      </Text>
                    </View>
                    <View style={styles.todayPlanDonePill}>
                      <Text style={styles.todayPlanDoneText}>Done</Text>
                    </View>
                  </View>
                );
              }

              return (
                <InteractivePressable
                  key={action.id}
                  onPress={() => {
                    haptics.impact('light');
                    action.onPress();
                  }}
                  style={[styles.todayPlanRow, dense && styles.todayPlanRowDense, mobile && styles.todayPlanRowMobile]}
                  hoverStyle={styles.todayPlanRowHover}
                  pressStyle={styles.todayPlanRowPress}
                  accessibilityLabel={`Start ${action.title}`}
                >
                  {({ hovered }) => (
                    <>
                      <View style={[
                        styles.todayPlanIcon,
                        dense && styles.todayPlanIconDense,
                        mobile && styles.todayPlanIconMobile,
                        hovered && styles.todayPlanIconHover,
                      ]}>
                        {action.icon}
                      </View>
                      <View style={styles.todayPlanCopy}>
                        <Text style={[styles.todayPlanItemTitle, dense && styles.todayPlanItemTitleDense]} numberOfLines={1}>
                          {action.title}
                        </Text>
                        <Text style={[styles.todayPlanItemText, dense && styles.todayPlanItemTextDense]} numberOfLines={1}>
                          {action.rubric}
                        </Text>
                      </View>
                      <View style={[
                        styles.todayPlanStart,
                        dense && styles.todayPlanStartDense,
                        mobile && styles.todayPlanStartMobile,
                        hovered && styles.todayPlanStartHover,
                      ]}>
                        {!mobile && (
                          <Text style={[styles.todayPlanStartText, dense && styles.todayPlanStartTextDense]}>Start</Text>
                        )}
                        <NudgeChevronRight active={hovered} size={mobile ? 18 : dense ? 15 : 17} color={mobile ? Colors.textSub : Colors.onPrimary} strokeWidth={2.9} />
                      </View>
                    </>
                  )}
                </InteractivePressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.generatedShelf, dense && styles.generatedShelfDense]}>
        <View style={[styles.generatedShelfHeader, dense && styles.generatedShelfHeaderDense]}>
          <View style={styles.generatedShelfTitleWrap}>
            <Text style={[styles.generatedShelfTitle, dense && styles.generatedShelfTitleDense, mobile && styles.generatedShelfTitleMobile]}>{dense ? 'Quick reps' : 'Built for your weak spots'}</Text>
            {!mobile && !dense && <ChallengeBoostCluster boosts={activeBoosts} />}
          </View>
          {!compact && <Text style={styles.generatedShelfNote}>No fixed lesson library</Text>}
        </View>
        <View style={[styles.generatedShelfGrid, compact && styles.generatedShelfGridCompact, dense && styles.generatedShelfGridDense]}>
          {displayActions.map((action) => (
            <GeneratedShelfActionCard
              key={action.id}
              action={action}
              compact={compact}
              dense={dense}
              mobile={mobile}
              hoveredGeneratedActionId={hoveredGeneratedActionId}
              setHoveredGeneratedActionId={setHoveredGeneratedActionId}
            />
          ))}
          {dense && (
            <>
              <DenseUtilityActionTile
                mobile={mobile}
                accent={DrillAccents.levelCheck}
                icon={<SwitchIcon size={18} color={DrillAccents.levelCheck} strokeWidth={2.2} />}
                label="Level check"
                onPress={onPlacement}
                accessibilityLabel="Start level check"
                idleTint="12"
                idleBorderAlpha="66"
              />
              <DenseUtilityActionTile
                mobile={mobile}
                accent={DrillAccents.analytics}
                icon={<ChartIcon size={18} color={DrillAccents.analytics} strokeWidth={2.3} />}
                label="Analytics"
                onPress={onOpenAnalytics}
                accessibilityLabel="Open analytics"
                idleTint="0D"
                idleBorderAlpha="44"
              />
            </>
          )}
        </View>
      </View>

      {!dense && <View style={[styles.homeToolsGrid, compact && styles.homeToolsGridCompact]}>
        <View style={styles.homeToolSlot}>
          <CoachPlacementCheck onPress={onPlacement} compact={compact} dense={dense} />
        </View>
        <View style={styles.homeToolSlot}>
          <InteractivePressable
            onPress={() => {
              haptics.impact('light');
              onOpenAnalytics();
            }}
            style={[styles.homeAnalyticsButton, compact && styles.homeAnalyticsButtonCompact, dense && styles.homeAnalyticsButtonDense]}
            hoverStyle={styles.homeAnalyticsButtonHover}
            pressStyle={styles.homeAnalyticsButtonPress}
            accessibilityLabel="Open rubric analytics"
          >
            {({ hovered }) => (
              <>
                <View style={[styles.homeAnalyticsIcon, dense && styles.homeAnalyticsIconDense, hovered && styles.homeAnalyticsIconHover]}>
                  <ChartIcon size={dense ? 18 : 21} color={hovered ? '#B93D31' : Colors.primary} strokeWidth={2.3} />
                </View>
                <View style={styles.homeAnalyticsCopy}>
                  <Text style={[styles.homeAnalyticsTitle, dense && styles.homeAnalyticsTitleDense]}>View analytics</Text>
                  <Text style={[styles.homeAnalyticsText, dense && styles.homeAnalyticsTextDense]}>{dense ? 'Rubric status' : 'Rubric profile and weak-spot status'}</Text>
                </View>
              </>
            )}
          </InteractivePressable>
        </View>
      </View>}
      <LevelJourneyModal
        visible={levelJourneyOpen}
        playerLevel={playerLevel}
        xpIntoLevel={xpIntoLevel}
        xpNeeded={xpNeeded}
        onClose={() => setLevelJourneyOpen(false)}
      />
    </View>
  );
}

function StartingLevelModal({
  visible,
  onSelect,
}: {
  visible: boolean;
  onSelect: (choice: StartingLevelChoice) => void;
}) {
  const { width, height } = useWindowDimensions();
  const compact = width < APP_COMPACT_BREAKPOINT || height < 760;
  const veryCompact = compact && height < 720;
  const laneCopy: Record<StartingLevelChoice['id'], {
    accent: string;
    border: string;
    bg: string;
    summary: string;
    signal: string;
  }> = {
    absolute_novice: {
      accent: Colors.teal,
      border: '#BDEAE5',
      bg: '#F4FFFD',
      summary: 'Starting from basics.',
      signal: 'New to AP work',
    },
    classroom_starter: {
      accent: Colors.primary,
      border: '#F1C8C2',
      bg: '#FFF8F7',
      summary: 'Simple classroom Japanese.',
      signal: 'Some class foundation',
    },
    course_ready: {
      accent: Colors.gold,
      border: '#F4D98E',
      bg: '#FFFCF1',
      summary: 'Familiar school prompts.',
      signal: 'Guided AP reps',
    },
    ap_bound: {
      accent: Colors.ink,
      border: '#CBD6E3',
      bg: '#F6F9FC',
      summary: 'Already doing AP tasks.',
      signal: 'Near AP pressure',
    },
  };

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={[styles.startingLevelShade, WEB_MODAL_LAYER_STYLE]}>
        <View style={[styles.startingLevelModal, compact && styles.startingLevelModalCompact]} accessibilityRole="summary">
          <View style={styles.startingLevelTopRow}>
            <View style={[styles.startingLevelBadge, compact && styles.startingLevelBadgeCompact]}>
              <StarIcon size={18} color={Colors.primary} strokeWidth={2.6} />
              <Text style={styles.startingLevelBadgeText}>{compact ? 'Calibration' : 'Start calibration'}</Text>
            </View>
            {!compact && <Text style={styles.startingLevelRequired}>Required setup</Text>}
          </View>
          <View style={[styles.startingLevelHero, compact && styles.startingLevelHeroCompact]}>
            {!compact && (
              <View style={styles.startingLevelHeroMark}>
                <TargetIcon size={30} color={Colors.teal} strokeWidth={2.3} />
              </View>
            )}
            <View style={styles.startingLevelHeaderCopy}>
              <Text style={[styles.startingLevelTitle, compact && styles.startingLevelTitleCompact]}>
                Where should Kibbo begin?
              </Text>
              <Text style={[styles.startingLevelText, compact && styles.startingLevelTextCompact]}>
                Kibbo is for Japanese learners chasing AP-level mastery, not a first-day alphabet course.
                Pick the lane that feels closest; the coach will verify it through your next work.
              </Text>
            </View>
          </View>
          <ScrollView
            style={[compact && styles.startingLevelScroll, WEB_NO_OUTLINE_STYLE]}
            contentContainerStyle={[styles.startingLevelScrollContent, veryCompact && styles.startingLevelScrollContentTight]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.startingLevelOptions, !compact && styles.startingLevelOptionsDesktop]}>
              {STARTING_LEVEL_CHOICES.map((choice) => {
                const lane = laneCopy[choice.id];
                const levelText = choice.targetLevel <= 1
                  ? 'Level 1 baseline'
                  : `Level ${choice.targetLevel} calibration`;
                return (
                  <InteractivePressable
                    key={choice.id}
                    onPress={() => onSelect(choice)}
                    wrapperStyle={[
                      WEB_NO_OUTLINE_STYLE,
                      styles.startingLevelOptionShell,
                      !compact && styles.startingLevelOptionShellDesktop,
                    ]}
                    style={[
                      styles.startingLevelOption,
                      compact && styles.startingLevelOptionCompact,
                      !compact && styles.startingLevelOptionDesktop,
                      { backgroundColor: lane.bg, borderColor: lane.border },
                    ]}
                    hoverStyle={[styles.startingLevelOptionHover, { borderColor: lane.accent, shadowColor: lane.accent }]}
                    pressStyle={[styles.startingLevelOptionPress, { borderColor: lane.accent }]}
                    accessibilityLabel={`Choose ${choice.label}. ${choice.description}. ${levelText}.`}
                  >
                    {({ hovered }) => (
                      <>
                        <View style={[styles.startingLevelOptionAccent, { backgroundColor: lane.accent }]} />
                        <View style={[styles.startingLevelOptionTop, compact && styles.startingLevelOptionTopCompact]}>
                          <View
                            style={[
                              styles.startingLevelLevelOrb,
                              compact && styles.startingLevelLevelOrbCompact,
                              { borderColor: `${lane.accent}55`, backgroundColor: hovered ? `${lane.accent}16` : '#FFFFFF' },
                            ]}
                          >
                            <Text style={styles.startingLevelLevelOrbText}>{choice.targetLevel}</Text>
                          </View>
                          <View style={styles.startingLevelOptionCopy}>
                            <View style={styles.startingLevelOptionTitleRow}>
                              <Text style={[styles.startingLevelOptionTitle, compact && styles.startingLevelOptionTitleCompact]} numberOfLines={compact ? 2 : 1}>
                                {choice.label}
                              </Text>
                            </View>
                            <Text style={[styles.startingLevelOptionText, compact && styles.startingLevelOptionTextCompact]} numberOfLines={compact ? 2 : 3}>
                              {compact ? lane.summary : choice.description}
                            </Text>
                          </View>
                          <View style={styles.startingLevelOptionArrow}>
                            <NudgeChevronRight active={hovered} size={compact ? 19 : 22} color={hovered ? lane.accent : Colors.textMuted} strokeWidth={2.8} />
                          </View>
                        </View>
                        <View style={styles.startingLevelOptionFooter}>
                          <View style={styles.startingLevelOptionLevelPill}>
                            <Text style={styles.startingLevelOptionLevelPillText}>{levelText}</Text>
                          </View>
                          <Text style={styles.startingLevelOptionSignal}>{lane.signal}</Text>
                        </View>
                      </>
                    )}
                  </InteractivePressable>
                );
              })}
            </View>
            <View style={styles.startingLevelFinePrintBox}>
              <TargetIcon size={compact ? 15 : 17} color={Colors.teal} strokeWidth={2.2} />
              <Text style={[styles.startingLevelFinePrint, compact && styles.startingLevelFinePrintCompact]}>
                Kibbo uses this only as the first lane, then adjusts from your next 15 drills and AP reviews.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const isNarrowDesktop = !isCompact && width < 1380;
  const isTightHome = width < 1120;
  const homeContentCompact = isCompact || isNarrowDesktop;
  const desktopInsets = getDesktopContentInsets(width);
  const useWideDesktopNudge = width >= DESKTOP_RAIL_NARROW_BREAKPOINT;
  const { prefs, stats, loading, reload } = useAppStorage();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [creditUsage, setCreditUsage] = useState<CreditUsage | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [aiDailyPlan, setAiDailyPlan] = useState<AIDailyPlan | null>(null);
  const [startingLevelProfile, setStartingLevelProfile] = useState<StartingLevelProfile | null | undefined>(undefined);
  const [creditNotice, setCreditNotice] = useState<{
    usage: CreditUsage;
    plan: SubscriptionPlan;
    cost: number;
    chargeId?: string;
    title: string;
    subtitle: string;
    navigate: () => void;
  } | null>(null);
  const [openSubscriptionsSignal, setOpenSubscriptionsSignal] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadUsage = useCallback(async () => {
    const access = await canStartPracticeSession(0);
    const usage = await getCreditUsage();
    setCreditUsage(usage);
    setPlan(access.plan);
  }, []);

  const refreshAll = useCallback(() => {
    reload();
    getSessionHistory().then(setSessions);
    getStartingLevelProfile().then(setStartingLevelProfile);
    loadUsage();
  }, [loadUsage, reload]);

  useFocusEffect(useCallback(() => {
    refreshAll();
  }, [refreshAll]));

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const preferredLangCode = (prefs?.selectedLanguage ?? 'ja') as LanguageCode;
  const langCode = isLanguageAvailable(preferredLangCode) ? preferredLangCode : 'ja';
  const language = getLanguage(langCode);
  const languageStats = stats?.languageStats[langCode];
  const displayedStats = languageStats ?? {
    totalSessions: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    bestStreak: 0,
    bestSpeakingScore: 0,
    totalXP: 0,
    currentStreak: 0,
    lastSessionDate: null,
  };
  const accuracy = displayedStats.totalAnswered > 0
    ? Math.round((displayedStats.totalCorrect / displayedStats.totalAnswered) * 100)
    : 0;
  const languageSessions = useMemo(
    () => sessions.filter((session) => session.languageCode === langCode),
    [langCode, sessions],
  );
  const recentSessions = useMemo(
    () => sessions.filter((session) => session.languageCode === langCode).slice(0, 6),
    [langCode, sessions],
  );
  const developmentIndex = getDevelopmentIndex(sessions, langCode);
  const languageGlyph = getLanguageProgressGlyph(langCode, displayedStats.totalSessions + 1) ?? '日';
  const playerLevel = getPlayerLevel(displayedStats.totalXP);
  const xpIntoLevel = playerLevel.currentXP - playerLevel.levelStartXP;
  const xpNeeded = Math.max(1, playerLevel.nextLevelXP - playerLevel.levelStartXP);
  const performanceChallengeBoost = useMemo(
    () => getBestChallengeBoostState(playerLevel.level, languageSessions),
    [languageSessions, playerLevel.level],
  );
  const astroChallengeBoost = useMemo(
    () => getAstroChallengeBoostState(
      playerLevel.level,
      startingLevelProfile ?? null,
      sessions,
      langCode,
    ),
    [langCode, playerLevel.level, sessions, startingLevelProfile],
  );
  const activeBoosts = useMemo(
    () => [astroChallengeBoost, performanceChallengeBoost]
      .filter((boost): boost is ChallengeBoostState => Boolean(boost?.active)),
    [astroChallengeBoost, performanceChallengeBoost],
  );
  const rubricSignals = buildRubricSignals({
    accuracy,
    sessions: displayedStats.totalSessions,
    bestSpeakingScore: displayedStats.bestSpeakingScore,
    developmentIndex,
  });
  const weakSignal = getWeakSignal(rubricSignals);
  useEffect(() => {
    let cancelled = false;
    generateDailyPlan(langCode).then((dailyPlan) => {
      if (!cancelled) setAiDailyPlan(dailyPlan);
      if (!cancelled) {
        const planModes = Array.from(new Set(
          (dailyPlan?.actions ?? [])
            .map((action) => action.mode)
            .filter((mode): mode is 'listening' | 'reading' | 'speaking' | 'conversation' | 'texting' => mode !== 'mock'),
        )).slice(0, 1);
        if (planModes.length > 0) {
          void prewarmGeneratedPracticeQueues({
            languageCode: langCode,
            totalXP: displayedStats.totalXP,
            modes: planModes,
            targetSkills: [
              'home screen background prewarm for the next planned drill only',
              ...(dailyPlan?.actions ?? []).flatMap((action) => action.targetSkills ?? []),
            ],
          });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [langCode, displayedStats.totalXP, displayedStats.totalSessions, sessions.length]);
  const creditsRemaining = creditUsage && plan ? getCreditsRemaining(creditUsage, plan) : null;
  const creditsLabel = creditUsage && plan
    ? `${creditsRemaining}/${plan.creditAllowance} credits`
    : '10 credits';

  const startPracticeSession = async (
    navigate: () => void,
    options: { cost?: number; chargeId?: string; title: string; subtitle: string },
  ) => {
    const cost = options.cost ?? CREDIT_COSTS.drill;
    const access = await canStartPracticeSession(cost);
    setCreditNotice({
      usage: access.usage,
      plan: access.plan,
      cost,
      chargeId: options.chargeId,
      title: options.title,
      subtitle: options.subtitle,
      navigate,
    });
  };

  const confirmCreditStart = async () => {
    if (!creditNotice) return;
    const access = await canStartPracticeSession(creditNotice.cost);
    if (!access.allowed) {
      setCreditNotice((current) => current ? { ...current, usage: access.usage, plan: access.plan } : current);
      return;
    }
    const navigate = creditNotice.navigate;
    await recordPracticeSessionStart(creditNotice.cost, creditNotice.chargeId);
    setCreditNotice(null);
    await loadUsage();
    haptics.impact('medium');
    navigate();
  };

  const selectStartingLevel = async (choice: StartingLevelChoice) => {
    const profile = await saveStartingLevelChoice(choice.id);
    setStartingLevelProfile(profile);
    haptics.impact(choice.xpMultiplier > 1 ? 'medium' : 'light');
  };

  const startListeningSet = (targetSkills: string[] = [], rewardKey?: string) => {
    const sessionId = `${Date.now()}`;
    startPracticeSession(() => router.push({
      pathname: '/listening/session',
      params: { sessionId, languageCode: langCode, ...(rewardKey ? { rewardKey } : {}), ...targetSkillRouteParams(targetSkills) },
    }), {
      chargeId: sessionId,
      title: 'Listening accuracy repair',
      subtitle: 'Generated audio prompts focused on exact-detail capture and AP task completion.',
    });
  };

  const startMiniMock = () => {
    haptics.impact('light');
    router.push('/mock');
  };

  const startSpeakingDrill = (targetSkills: string[] = [], rewardKey?: string) => {
    const sessionId = `${Date.now()}`;
    startPracticeSession(() => router.push({
      pathname: '/speaking/translation',
      params: { sessionId, languageCode: langCode, ...(rewardKey ? { rewardKey } : {}), ...targetSkillRouteParams(targetSkills) },
    }), {
      chargeId: sessionId,
      title: 'Timed speaking control',
      subtitle: 'A generated spoken drill that targets delivery, pace, and complete responses.',
    });
  };

  const startReadingSet = (targetSkills: string[] = [], rewardKey?: string) => {
    const sessionId = `${Date.now()}`;
    startPracticeSession(() => router.push({
      pathname: '/ap/reading',
      params: { sessionId, languageCode: langCode, ...(rewardKey ? { rewardKey } : {}), ...targetSkillRouteParams(targetSkills) },
    }), {
      chargeId: sessionId,
      title: 'Evidence finder',
      subtitle: 'A short AP-style passage generated around inference and detail traps.',
    });
  };

  const startConversationSet = (targetSkills: string[] = [], rewardKey?: string) => {
    const sessionId = `${Date.now()}`;
    startPracticeSession(() => router.push({
      pathname: '/ap/conversation',
      params: { sessionId, languageCode: langCode, ...(rewardKey ? { rewardKey } : {}), ...targetSkillRouteParams(targetSkills) },
    }), {
      chargeId: sessionId,
      title: 'Simulated conversation repair',
      subtitle: 'Four 20-second turns scored for delivery, task completion, and register.',
    });
  };

  const startTextingSet = (targetSkills: string[] = [], rewardKey?: string) => {
    const sessionId = `${Date.now()}`;
    startPracticeSession(() => router.push({
      pathname: '/ap/texting',
      params: { sessionId, languageCode: langCode, ...(rewardKey ? { rewardKey } : {}), ...targetSkillRouteParams(targetSkills) },
    }), {
      chargeId: sessionId,
      title: 'Text-chat register repair',
      subtitle: 'Timed written replies focused on language use, completion, and natural AP tone.',
    });
  };

  const actionFromAIPlan = (action: AIDailyPlanAction): PlanAction => {
    const actionId = `ai-${action.id}`;
    const rewardKey = dailyPlanRewardKey(langCode, actionId);
    const config = {
      listening: {
        accent: Colors.teal,
        icon: <HeadphonesIcon size={25} color={Colors.teal} strokeWidth={2} />,
        onPress: () => startListeningSet(action.targetSkills, rewardKey),
      },
      speaking: {
        accent: Colors.primary,
        icon: <MicrophoneIcon size={25} color={Colors.primary} strokeWidth={2} />,
        onPress: () => startSpeakingDrill(action.targetSkills, rewardKey),
      },
      reading: {
        accent: Colors.teal,
        icon: <FileTextIcon size={25} color={Colors.teal} strokeWidth={2} />,
        onPress: () => startReadingSet(action.targetSkills, rewardKey),
      },
      conversation: {
        accent: Colors.primary,
        icon: <WaveformIcon size={25} color={Colors.primary} strokeWidth={2.2} />,
        onPress: () => startConversationSet(action.targetSkills, rewardKey),
      },
      texting: {
        accent: Colors.primary,
        icon: <MessageCircleIcon size={25} color={Colors.primary} strokeWidth={2} />,
        onPress: () => startTextingSet(action.targetSkills, rewardKey),
      },
      mock: {
        accent: Colors.primary,
        icon: <TargetIcon size={25} color={Colors.primary} strokeWidth={2.2} />,
        onPress: startMiniMock,
      },
    }[action.mode];

    return {
      id: actionId,
      title: action.title,
      task: action.task,
      rubric: action.rubric,
      minutes: action.minutes,
      credits: action.credits,
      why: action.why,
      accent: config.accent,
      icon: config.icon,
      targetSkills: action.targetSkills,
      rewardKey,
      onPress: config.onPress,
    };
  };

  const fallbackPrimaryAction = displayedStats.totalSessions === 0
    ? {
      id: 'starter-texting',
      title: 'Text-chat register repair',
      task: 'First AP warmup',
      rubric: 'Language use' as RubricKey,
      minutes: 12,
      credits: CREDIT_COSTS.drill,
      why: 'Start with a short AP-style reply so Kibbo can read your register and sentence control.',
      accent: Colors.primary,
      icon: <MessageCircleIcon size={25} color={Colors.primary} strokeWidth={2} />,
      rewardKey: dailyPlanRewardKey(langCode, 'starter-texting'),
      onPress: () => startTextingSet([], dailyPlanRewardKey(langCode, 'starter-texting')),
    }
    : weakSignal.key === 'Delivery'
      ? {
        id: 'delivery',
        title: 'Timed response control',
        task: 'Interpersonal speaking',
        rubric: 'Delivery' as RubricKey,
        minutes: 14,
        credits: CREDIT_COSTS.drill,
        why: 'Tighten pacing and complete answers under the AP timer.',
        accent: Colors.teal,
        icon: <MicrophoneIcon size={25} color={Colors.teal} strokeWidth={2} />,
        rewardKey: dailyPlanRewardKey(langCode, 'delivery'),
        onPress: () => startSpeakingDrill([], dailyPlanRewardKey(langCode, 'delivery')),
      }
      : weakSignal.key === 'Language use'
        ? {
          id: 'texting',
          title: 'Text-chat register repair',
          task: 'Interpersonal writing',
          rubric: 'Language use' as RubricKey,
          minutes: 12,
          credits: CREDIT_COSTS.drill,
          why: 'Repair register, sentence control, and natural replies.',
          accent: Colors.primary,
          icon: <MessageCircleIcon size={25} color={Colors.primary} strokeWidth={2} />,
          rewardKey: dailyPlanRewardKey(langCode, 'texting'),
          onPress: () => startTextingSet([], dailyPlanRewardKey(langCode, 'texting')),
        }
        : {
          id: 'listening',
          title: 'Listening accuracy repair',
          task: 'Interpretive listening',
          rubric: 'Task completion' as RubricKey,
          minutes: 12,
          credits: CREDIT_COSTS.drill,
          why: 'Target missed details with short exact-answer audio reps.',
          accent: Colors.teal,
          icon: <HeadphonesIcon size={25} color={Colors.teal} strokeWidth={2} />,
        rewardKey: dailyPlanRewardKey(langCode, 'listening'),
        onPress: () => startListeningSet([], dailyPlanRewardKey(langCode, 'listening')),
      };

  const fallbackPlanActions: PlanAction[] = [
    fallbackPrimaryAction,
    {
      id: 'reading',
      title: 'Evidence finder',
      task: 'Interpretive reading',
      rubric: 'Task completion',
      minutes: 10,
      credits: CREDIT_COSTS.drill,
      why: 'Train inference, supporting detail, and distractor resistance.',
      accent: Colors.teal,
      icon: <FileTextIcon size={25} color={Colors.teal} strokeWidth={2} />,
      rewardKey: dailyPlanRewardKey(langCode, 'reading'),
      onPress: () => startReadingSet([], dailyPlanRewardKey(langCode, 'reading')),
    },
    {
      id: 'conversation',
      title: 'Conversation repair',
      task: 'Interpersonal speaking',
      rubric: 'Delivery',
      minutes: 14,
      credits: CREDIT_COSTS.drill,
      why: 'Four turns to check whether the weak pattern improves.',
      accent: Colors.primary,
      icon: <WaveformIcon size={25} color={Colors.primary} strokeWidth={2.2} />,
      rewardKey: dailyPlanRewardKey(langCode, 'conversation'),
      onPress: () => startConversationSet([], dailyPlanRewardKey(langCode, 'conversation')),
    },
  ];
  const aiPlanActions = aiDailyPlan?.actions.map(actionFromAIPlan) ?? [];
  const planActions: PlanAction[] = aiPlanActions.length > 0 ? aiPlanActions : fallbackPlanActions;
  const primaryAction = planActions[0] ?? fallbackPrimaryAction;
  const todayKey = new Date().toDateString();
  const todaySessions = sessions.filter((session) => (
    session.languageCode === langCode && sessionDateKey(session.date) === todayKey
  ));
  const completedActionIds = new Set(
    planActions
      .filter((action) => todaySessions.some((session) => actionMatchesSession(action, session)))
      .map((action) => action.id),
  );

  const generatedModeActions: PlanAction[] = [
    {
      id: 'mode-listening',
      title: 'Listening accuracy repair',
      task: 'Listening',
      rubric: 'Task completion',
      minutes: 12,
      credits: CREDIT_COSTS.drill,
      why: 'Generated audio detail reps from missed-answer patterns.',
      accent: DrillAccents.listening,
      icon: <HeadphonesIcon size={23} color={DrillAccents.listening} strokeWidth={2} />,
      onPress: startListeningSet,
    },
    {
      id: 'mode-speaking',
      title: 'Timed response control',
      task: 'Speaking',
      rubric: 'Delivery',
      minutes: 14,
      credits: CREDIT_COSTS.drill,
      why: 'Generated speaking reps for pace, clarity, and complete answers.',
      accent: DrillAccents.speaking,
      icon: <MicrophoneIcon size={23} color={DrillAccents.speaking} strokeWidth={2} />,
      onPress: startSpeakingDrill,
    },
    {
      id: 'mode-reading',
      title: 'Evidence finder',
      task: 'Reading',
      rubric: 'Task completion',
      minutes: 10,
      credits: CREDIT_COSTS.drill,
      why: 'Generated passages around inference and detail traps.',
      accent: DrillAccents.reading,
      icon: <FileTextIcon size={23} color={DrillAccents.reading} strokeWidth={2} />,
      onPress: startReadingSet,
    },
    {
      id: 'mode-conversation',
      title: 'Conversation repair',
      task: 'Conversation',
      rubric: 'Delivery',
      minutes: 14,
      credits: CREDIT_COSTS.drill,
      why: 'Generated four-turn AP conversations that adapt after scoring.',
      accent: DrillAccents.conversation,
      icon: <WaveformIcon size={23} color={DrillAccents.conversation} strokeWidth={2.2} />,
      onPress: startConversationSet,
    },
    {
      id: 'mode-texting',
      title: 'Text-chat register repair',
      task: 'Text chat',
      rubric: 'Language use',
      minutes: 12,
      credits: CREDIT_COSTS.drill,
      why: 'Generated timed replies that evolve around register and grammar.',
      accent: DrillAccents.texting,
      icon: <MessageCircleIcon size={23} color={DrillAccents.texting} strokeWidth={2} />,
      onPress: startTextingSet,
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <KanjiBackdrop variant="home" compact={isCompact} />
      <DesktopSideRail />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          !isCompact && desktopInsets,
          isCompact && styles.scrollCompact,
          isTightHome && (isCompact ? styles.scrollTightHomeMobile : styles.scrollTightHome),
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={Colors.primary} />}
      >
        <Animated.View style={[styles.coachContent, isCompact && styles.coachContentCompact, { opacity: fadeAnim }]}>
          {isCompact ? (
            <MobileTabHeader
              streak={displayedStats.currentStreak || 0}
              onSwitch={() => router.push('/onboarding')}
              openSubscriptionsSignal={openSubscriptionsSignal}
              onSubscriptionChange={refreshAll}
            />
          ) : (
            <MainTabHeader
              streak={displayedStats.currentStreak || 0}
              onSwitch={() => router.push('/onboarding')}
              openSubscriptionsSignal={openSubscriptionsSignal}
              onSubscriptionChange={refreshAll}
            />
          )}

          <View style={[styles.homeBody, useWideDesktopNudge && styles.homeBodyDesktopNudge]}>
            {!isTightHome && (
              <CoachPromoStrip
                compact={homeContentCompact}
                onPress={() => setOpenSubscriptionsSignal((value) => value + 1)}
              />
            )}

            <CoachLearningHome
              languageName={language.name}
              nativeName={language.nativeName}
              languageGlyph={languageGlyph}
              langCode={langCode}
              playerLevel={playerLevel.level}
              xpIntoLevel={xpIntoLevel}
              xpNeeded={xpNeeded}
              weakSignal={weakSignal}
              primaryAction={primaryAction}
              planActions={planActions}
              generatedActions={generatedModeActions}
              completedActionIds={completedActionIds}
              creditsLabel={creditsLabel}
              activeBoosts={activeBoosts}
              onPlacement={startMiniMock}
              onOpenAnalytics={() => router.push('/analytics' as never)}
              compact={homeContentCompact}
              mobile={isCompact}
              dense={isTightHome}
            />
          </View>

        </Animated.View>
      </ScrollView>

      <CreditStartNotice
        visible={Boolean(creditNotice)}
        title={creditNotice?.title ?? 'Start generated AP work?'}
        subtitle={creditNotice?.subtitle}
        cost={creditNotice?.cost ?? CREDIT_COSTS.drill}
        usage={creditNotice?.usage ?? null}
        plan={creditNotice?.plan ?? null}
        onClose={() => setCreditNotice(null)}
        onStart={confirmCreditStart}
        onComparePlans={() => setOpenSubscriptionsSignal((value) => value + 1)}
      />
      <StartingLevelModal
        visible={startingLevelProfile === null}
        onSelect={selectStartingLevel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  startingLevelShade: {
    flex: 1,
    backgroundColor: 'rgba(7, 18, 32, 0.64)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    zIndex: 999,
    elevation: 999,
  },
  startingLevelModal: {
    width: '100%',
    maxWidth: 900,
    maxHeight: '92%',
    borderRadius: 32,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: '#C8D7E6',
    padding: 30,
    shadowColor: '#0F1B2D',
    shadowOpacity: 0.2,
    shadowRadius: 38,
    shadowOffset: { width: 0, height: 20 },
    gap: 18,
    zIndex: 1000,
    elevation: 1000,
  },
  startingLevelModalCompact: {
    maxWidth: 392,
    maxHeight: '94%',
    borderRadius: 28,
    padding: 15,
    gap: 10,
  },
  startingLevelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  startingLevelBadge: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  startingLevelBadgeCompact: {
    minHeight: 31,
    paddingHorizontal: 10,
  },
  startingLevelBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
  startingLevelRequired: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.1,
  },
  startingLevelHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 9,
  },
  startingLevelHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  startingLevelHeroCompact: {
    gap: 0,
  },
  startingLevelHeroMark: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: Colors.tealDim,
    borderWidth: 1,
    borderColor: '#BFE9E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.teal,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  startingLevelTitle: {
    color: Colors.text,
    fontSize: 42,
    lineHeight: 44,
    fontWeight: '900',
  },
  startingLevelTitleCompact: {
    fontSize: 27,
    lineHeight: 30,
  },
  startingLevelText: {
    color: Colors.textSub,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    maxWidth: 710,
  },
  startingLevelTextCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  startingLevelScroll: {
    flexShrink: 1,
  },
  startingLevelScrollContent: {
    gap: 13,
    paddingBottom: 1,
  },
  startingLevelScrollContentTight: {
    gap: 7,
  },
  startingLevelOptions: {
    gap: 10,
  },
  startingLevelOptionsDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  startingLevelOptionShell: {
    width: '100%',
    minWidth: 0,
  },
  startingLevelOptionShellDesktop: {
    width: '49%',
    minWidth: 0,
  },
  startingLevelOption: {
    width: '100%',
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    padding: 15,
    gap: 11,
    shadowColor: '#0F1B2D',
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
  },
  startingLevelOptionCompact: {
    borderRadius: 21,
    padding: 11,
    gap: 6,
  },
  startingLevelOptionDesktop: {
    minHeight: 132,
  },
  startingLevelOptionHover: {
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 11 },
  },
  startingLevelOptionPress: {
    backgroundColor: '#F0FFFC',
  },
  startingLevelOptionAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    opacity: 0.86,
  },
  startingLevelOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  startingLevelOptionTopCompact: {
    gap: 9,
  },
  startingLevelLevelOrb: {
    width: 50,
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  startingLevelLevelOrbCompact: {
    width: 42,
    height: 42,
    borderRadius: 16,
  },
  startingLevelLevelOrbText: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  startingLevelOptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  startingLevelOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  startingLevelOptionTitle: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    flexShrink: 1,
  },
  startingLevelOptionTitleCompact: {
    fontSize: 20,
    lineHeight: 22,
  },
  startingLevelOptionLevelPill: {
    borderRadius: 999,
    backgroundColor: '#FFFFFFCC',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexShrink: 0,
  },
  startingLevelOptionLevelPillText: {
    color: Colors.textSub,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  startingLevelOptionArrow: {
    width: 22,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  startingLevelOptionFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  startingLevelOptionMeta: {
    color: Colors.primary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    flexShrink: 0,
  },
  startingLevelOptionSignal: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    textAlign: 'right',
    flexShrink: 1,
  },
  startingLevelOptionText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  startingLevelOptionTextCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
  startingLevelFinePrintBox: {
    borderRadius: 16,
    backgroundColor: '#F3FAF9',
    borderWidth: 1,
    borderColor: '#CFEAE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startingLevelFinePrint: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  startingLevelFinePrintCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  safe: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  scroll: {
    flexGrow: 1,
    paddingTop: 18,
    paddingBottom: 28,
  },
  scrollCompact: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 4,
    paddingBottom: 220,
  },
  scrollTightHome: {
    paddingTop: 8,
    paddingBottom: 22,
  },
  scrollTightHomeMobile: {
    paddingTop: 4,
    paddingBottom: 220,
  },
  content: {
    width: '100%',
    maxWidth: 1510,
    alignSelf: 'center',
    gap: 12,
  },
  contentCompact: {
    gap: 12,
  },
  coachContent: {
    width: '100%',
    maxWidth: 1500,
    alignSelf: 'center',
    gap: 18,
  },
  coachContentCompact: {
    gap: 10,
  },
  homeBody: {
    width: '100%',
    gap: 18,
  },
  homeBodyDesktopNudge: {
    transform: [{ translateX: -42 }],
  },
  learningHome: {
    gap: 18,
  },
  learningHomeCompact: {
    gap: 11,
  },
  learningHomeDense: {
    gap: 10,
  },
  learningHomeMobile: {
    gap: 8,
  },
  learningTopGrid: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'stretch',
  },
  learningTopGridCompact: {
    flexDirection: 'column',
    gap: 10,
  },
  learningTopGridMobile: {
    gap: 8,
  },
  levelHero: {
    flex: 1.15,
    minHeight: 360,
    borderRadius: 34,
    backgroundColor: '#FFFFFFF5',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 22,
    gap: 15,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 15 },
  },
  levelHeroCompact: {
    minHeight: 0,
    borderRadius: 24,
    padding: 14,
    gap: 12,
  },
  levelHeroDense: {
    borderRadius: 22,
    padding: 13,
    gap: 10,
  },
  levelHeroMobileCalm: {
    backgroundColor: '#FFFFFFF8',
    borderRadius: 21,
    padding: 13,
    gap: 9,
    shadowOpacity: 0.035,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  levelHeroGlow: {
    position: 'absolute',
    right: -95,
    top: -105,
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: '#2FB9AE12',
  },
  levelHeroGlowMobile: {
    right: -118,
    top: -126,
    backgroundColor: '#2FB9AE09',
  },
  levelHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  levelHeroTopCompact: {
    gap: 13,
  },
  levelHeroTopDense: {
    gap: 11,
  },
  levelHeroTopMobile: {
    gap: 8,
  },
  levelHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  levelHeroCopyMobile: {
    gap: 0,
  },
  platformEyebrow: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  platformTitle: {
    color: Colors.text,
    fontSize: 48,
    lineHeight: 54,
    fontWeight: '900',
  },
  platformTitleCompact: {
    fontSize: 30,
    lineHeight: 34,
  },
  platformTitleDense: {
    fontSize: 25,
    lineHeight: 29,
  },
  platformTitleMobile: {
    fontSize: 21,
    lineHeight: 24,
  },
  platformSubtitleDense: {
    fontSize: 12,
    lineHeight: 15,
  },
  platformSubtitleMobile: {
    fontSize: 10,
    lineHeight: 12,
  },
  platformSubtitle: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  levelBadgeLarge: {
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 5,
    borderBottomColor: '#06101E',
    shadowColor: Colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  levelBadgeLargeHover: {
    backgroundColor: '#17263A',
    transform: [{ translateY: -2 }],
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 11 },
  },
  levelBadgeLargePress: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
    shadowOpacity: 0.08,
  },
  levelBadgeLargeLabel: {
    color: Colors.onPrimaryMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  levelBadgeLargeValue: {
    color: Colors.onPrimary,
    fontSize: 33,
    lineHeight: 38,
    fontWeight: '900',
  },
  levelJourneyShade: {
    flex: 1,
    backgroundColor: '#0F1B2D66',
    padding: 22,
    justifyContent: 'center',
  },
  levelJourneyShadeCompact: {
    paddingHorizontal: 14,
    paddingTop: 46,
    paddingBottom: 46,
  },
  levelJourneyPanel: {
    width: '100%',
    maxWidth: 1040,
    maxHeight: '92%',
    alignSelf: 'center',
    borderRadius: 32,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 22,
    gap: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
  },
  levelJourneyPanelCompact: {
    maxWidth: 390,
    borderRadius: 24,
    padding: 14,
    gap: 10,
  },
  levelJourneyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  levelJourneyTopCompact: {
    gap: 10,
  },
  levelJourneyHeroIcon: {
    width: 68,
    height: 68,
    borderRadius: 23,
    backgroundColor: Colors.ink,
    borderBottomWidth: 5,
    borderBottomColor: '#06101E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelJourneyHeroIconCompact: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderBottomWidth: 4,
  },
  levelJourneyHeroLevel: {
    color: Colors.onPrimary,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
  },
  levelJourneyHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  levelJourneyKicker: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  levelJourneyTitle: {
    color: Colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
  },
  levelJourneyTitleCompact: {
    fontSize: 26,
    lineHeight: 31,
  },
  levelJourneySubtitle: {
    maxWidth: 720,
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  levelJourneySubtitleCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  levelJourneyClose: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelJourneyProgressCard: {
    minHeight: 70,
    borderRadius: 23,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
  },
  levelJourneyProgressCardCompact: {
    minHeight: 58,
    borderRadius: 19,
    paddingHorizontal: 12,
  },
  levelJourneyProgressLabel: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  levelJourneyProgressText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  levelJourneyProgressPill: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: Colors.tealDim,
    borderWidth: 1,
    borderColor: '#2FB9AE40',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  levelJourneyProgressPillText: {
    color: Colors.teal,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  levelJourneyScroll: {
    flexShrink: 1,
  },
  levelJourneyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingBottom: 4,
  },
  levelJourneyGridCompact: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    gap: 9,
  },
  levelJourneyStage: {
    width: '32%',
    minWidth: 292,
    minHeight: 184,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 13,
    overflow: 'hidden',
  },
  levelJourneyStageActive: {
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: '#FFFDF7',
  },
  levelJourneyStageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  levelJourneyStageTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  levelJourneyDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    alignSelf: 'stretch',
    minWidth: 0,
  },
  levelJourneyStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  levelJourneyNode: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#CAD4E2',
    borderBottomWidth: 3,
    borderBottomColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelJourneyNodeDone: {
    backgroundColor: Colors.gold,
    borderBottomColor: '#A97812',
  },
  levelJourneyNodeCurrent: {
    backgroundColor: Colors.primary,
    borderBottomColor: '#9F3024',
    shadowColor: Colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  levelJourneyNodeText: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  levelJourneyNodeTextDone: {
    color: Colors.ink,
  },
  levelJourneyNodeTextCurrent: {
    color: Colors.onPrimary,
  },
  levelJourneyConnector: {
    width: 10,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CAD4E2',
    marginHorizontal: 5,
  },
  levelJourneyConnectorDone: {
    backgroundColor: Colors.gold,
  },
  levelJourneyFocus: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  levelHeroMiddle: {
    gap: 12,
  },
  levelHeroStatusRow: {
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  levelHeroStatusRowMobile: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  levelHeroStatusRowDense: {
    borderRadius: 16,
    padding: 9,
    gap: 8,
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  levelHeroStatusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  levelHeroStatusCopyMobile: {
    gap: 0,
    flexShrink: 1,
  },
  levelHeroLevelTitle: {
    color: Colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
  },
  levelHeroLevelTitleDense: {
    fontSize: 25,
    lineHeight: 29,
  },
  levelHeroLevelTitleMobile: {
    fontSize: 18,
    lineHeight: 21,
  },
  levelHeroLevelSub: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  levelHeroLevelSubDense: {
    fontSize: 11,
    lineHeight: 15,
  },
  levelHeroLevelSubMobile: {
    fontSize: 10,
    lineHeight: 12,
  },
  levelHeroXpLine: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelHeroXpLineMobile: {
    minHeight: 13,
  },
  levelHeroXpCount: {
    minWidth: 0,
    transformOrigin: 'left center',
  } as TextStyle,
  levelHeroTextBlock: {
    gap: 6,
  },
  levelHeroHeadline: {
    color: Colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  levelHeroBodyText: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    maxWidth: 760,
  },
  levelHeroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
    flexShrink: 1,
  },
  levelHeroChipsDense: {
    gap: 6,
    justifyContent: 'flex-start',
  },
  levelHeroChipsMobile: {
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    gap: 0,
    flexShrink: 0,
  },
  levelHeroCreditStack: {
    alignItems: 'flex-end',
    gap: 4,
  },
  challengeBoostCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
  },
  challengeBoostClusterMobile: {
    justifyContent: 'flex-end',
    gap: 4,
    maxWidth: 168,
  },
  challengeBoostBadge: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  challengeBoostBadgeMobile: {
    minHeight: 22,
    gap: 4,
    paddingHorizontal: 7,
    borderColor: '#D9473440',
    backgroundColor: '#FFF1EE',
  },
  challengeBoostIcon: {
    width: 19,
    height: 19,
    borderRadius: 999,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeBoostIconMobile: {
    width: 15,
    height: 15,
  },
  challengeBoostText: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  challengeBoostTextMobile: {
    fontSize: 9,
    lineHeight: 11,
  },
  challengeBoostMultiplier: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  challengeBoostMultiplierMobile: {
    fontSize: 9,
    lineHeight: 11,
  },
  levelProgressBlock: {
    gap: 0,
    position: 'relative',
  },
  levelProgressBlockMobile: {
    marginTop: 0,
  },
  levelProgressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  levelProgressLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  levelProgressValue: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  levelProgressTrack: {
    height: 18,
    borderRadius: 999,
    backgroundColor: '#EAF0F2',
    borderWidth: 2,
    borderColor: '#D2DEE3',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: Colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  levelProgressTrackMobile: {
    height: 14,
    borderWidth: 1.5,
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.teal,
  },
  levelProgressSegments: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  levelProgressSegmentsMobile: {
    display: 'none',
  },
  levelProgressSegment: {
    flex: 1,
  },
  levelProgressSegmentDivider: {
    borderLeftWidth: 2,
    borderLeftColor: '#D2DEE3',
  },
  primaryCoachAction: {
    minHeight: 96,
    borderRadius: 28,
    backgroundColor: Colors.teal,
    borderBottomWidth: 6,
    borderBottomColor: '#218A83',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 16,
    shadowColor: Colors.teal,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  primaryCoachActionCompact: {
    minHeight: 76,
    borderRadius: 22,
    padding: 11,
    flexWrap: 'nowrap',
  },
  primaryCoachActionDense: {
    minHeight: 72,
    borderRadius: 20,
    borderBottomWidth: 4,
    gap: 10,
    padding: 10,
  },
  primaryCoachActionMobile: {
    minHeight: 58,
    backgroundColor: '#F5FCFB',
    borderWidth: 1,
    borderColor: '#BFE6E3',
    borderBottomWidth: 3,
    borderBottomColor: '#B8DCD9',
    shadowColor: Colors.ink,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 9,
  },
  primaryCoachActionHover: {
    backgroundColor: '#33C8BE',
    borderBottomColor: '#176F68',
    shadowOpacity: 0.32,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  primaryCoachActionPress: {
    borderBottomWidth: 3,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryCoachComplete: {
    minHeight: 96,
    borderRadius: 28,
    backgroundColor: '#F7FEFD',
    borderWidth: 2,
    borderColor: '#BEEFEB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 16,
  },
  primaryCoachCompleteMobile: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 8,
    backgroundColor: '#F7FEFD',
    borderColor: '#C9EDE9',
  },
  primaryCoachCompleteIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#218A83',
  },
  primaryCoachCompleteIconDense: {
    width: 44,
    height: 44,
    borderRadius: 15,
  },
  primaryCoachCompleteIconMobile: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderBottomWidth: 3,
  },
  primaryCoachCompleteKicker: {
    color: Colors.teal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  primaryCoachCompleteKickerMobile: {
    fontSize: 9,
    lineHeight: 12,
  },
  primaryCoachCompleteTitle: {
    color: Colors.ink,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
  },
  primaryCoachCompleteTitleMobile: {
    fontSize: 18,
    lineHeight: 21,
  },
  primaryCoachCompleteReason: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  primaryCoachCompleteReasonMobile: {
    fontSize: 11,
    lineHeight: 14,
  },
  primaryCoachIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#FFFFFFE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCoachIconDense: {
    width: 44,
    height: 44,
    borderRadius: 15,
  },
  primaryCoachIconMobile: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EAF7F6',
  },
  primaryCoachIconHover: {
    backgroundColor: '#FFFFFF',
    shadowColor: Colors.onPrimary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryCoachCopy: {
    flex: 1,
    minWidth: 0,
  },
  primaryCoachCopyCompact: {
    flexBasis: 0,
    flexGrow: 1,
  },
  primaryCoachKicker: {
    color: '#E9FFFC',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  primaryCoachKickerDense: {
    fontSize: 10,
    lineHeight: 13,
  },
  primaryCoachKickerMobile: {
    color: Colors.teal,
    fontSize: 8,
    lineHeight: 10,
  },
  primaryCoachTitle: {
    color: Colors.onPrimary,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
  },
  primaryCoachTitleDense: {
    fontSize: 20,
    lineHeight: 23,
  },
  primaryCoachTitleMobile: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 19,
  },
  primaryCoachReason: {
    color: '#E9FFFC',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  primaryCoachReasonMobile: {
    color: Colors.textSub,
  },
  primaryCoachStart: {
    minHeight: 48,
    borderRadius: 17,
    backgroundColor: Colors.ink,
    borderBottomWidth: 4,
    borderBottomColor: '#06101E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 15,
    paddingTop: 1,
  },
  primaryCoachStartCompact: {
    flexShrink: 0,
  },
  primaryCoachStartDense: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  primaryCoachStartMobile: {
    minHeight: 31,
    borderRadius: 12,
    borderBottomWidth: 3,
    paddingHorizontal: 10,
  },
  primaryCoachStartHover: {
    backgroundColor: '#17263C',
    shadowColor: Colors.ink,
    shadowOpacity: 0.28,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
  },
  primaryCoachStartText: {
    color: Colors.onPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  primaryCoachStartTextDense: {
    fontSize: 13,
    lineHeight: 16,
  },
  todayPlanCard: {
    width: 500,
    borderRadius: 32,
    backgroundColor: Colors.ink,
    padding: 18,
    gap: 14,
    shadowColor: Colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  todayPlanCardCompact: {
    width: '100%',
    borderRadius: 24,
    padding: 13,
  },
  todayPlanCardDense: {
    borderRadius: 22,
    padding: 13,
    gap: 10,
  },
  todayPlanCardMobile: {
    backgroundColor: '#FFFFFFF8',
    borderWidth: 1,
    borderColor: '#D7E2EC',
    borderRadius: 21,
    padding: 12,
    gap: 8,
    shadowColor: Colors.ink,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  todayPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  todayPlanHeaderMobile: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  todayPlanKicker: {
    color: Colors.teal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  todayPlanKickerDense: {
    fontSize: 10,
    lineHeight: 13,
  },
  todayPlanKickerMobile: {
    color: Colors.teal,
    fontSize: 10,
    lineHeight: 12,
  },
  todayPlanTitle: {
    color: Colors.onPrimary,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  todayPlanTitlePromoted: {
    fontSize: 34,
    lineHeight: 39,
  },
  todayPlanTitleDense: {
    fontSize: 24,
    lineHeight: 28,
  },
  todayPlanTitleMobile: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 25,
  },
  todayPlanTime: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  todayPlanTimeDense: {
    minHeight: 30,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  todayPlanTimeMobile: {
    minHeight: 32,
    borderRadius: 14,
    backgroundColor: '#EDF3F8',
    paddingHorizontal: 12,
  },
  todayPlanTimeText: {
    color: Colors.onPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  todayPlanTimeTextDense: {
    fontSize: 13,
    lineHeight: 16,
  },
  todayPlanTimeTextMobile: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 16,
  },
  todayPlanList: {
    gap: 12,
  },
  todayPlanListDense: {
    gap: 8,
  },
  todayPlanListMobile: {
    gap: 7,
  },
  todayPlanRow: {
    minHeight: 78,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  todayPlanRowComplete: {
    minHeight: 78,
    borderRadius: 24,
    backgroundColor: '#F3FBFA',
    borderWidth: 2,
    borderColor: '#C7EFEB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  todayPlanRowDense: {
    minHeight: 58,
    borderRadius: 18,
    gap: 8,
    padding: 8,
  },
  todayPlanRowMobile: {
    minHeight: 50,
    borderRadius: 16,
    gap: 8,
    padding: 7,
  },
  todayPlanRowActive: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
    borderBottomWidth: 5,
    borderBottomColor: '#218A83',
  },
  todayPlanRowHover: {
    borderColor: Colors.teal,
    backgroundColor: '#F7FEFD',
    shadowColor: Colors.teal,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  todayPlanRowActiveHover: {
    backgroundColor: '#35C9BF',
    borderColor: '#35C9BF',
    borderBottomColor: '#176F68',
    shadowColor: Colors.teal,
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 11 },
  },
  todayPlanRowPress: {
    borderBottomWidth: 2,
    opacity: 0.96,
  },
  todayPlanIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPlanIconDense: {
    width: 36,
    height: 36,
    borderRadius: 13,
  },
  todayPlanIconMobile: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  todayPlanIconActive: {
    backgroundColor: '#FFFFFFE8',
  },
  todayPlanIconHover: {
    backgroundColor: '#FFFFFF',
    shadowColor: Colors.ink,
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  todayPlanCompleteIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Colors.teal,
    borderBottomWidth: 4,
    borderBottomColor: '#218A83',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPlanCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  todayPlanRubric: {
    color: Colors.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  todayPlanRubricActive: {
    color: '#DFFFFB',
  },
  todayPlanItemTitle: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  todayPlanItemTitleDense: {
    fontSize: 16,
    lineHeight: 19,
  },
  todayPlanItemTitleActive: {
    color: Colors.onPrimary,
  },
  todayPlanItemText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  todayPlanItemTextDense: {
    fontSize: 10,
    lineHeight: 13,
  },
  todayPlanItemTextActive: {
    color: '#E9FFFC',
  },
  todayPlanStart: {
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: Colors.ink,
    borderBottomWidth: 4,
    borderBottomColor: '#06101E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingTop: 2,
  },
  todayPlanStartDense: {
    minHeight: 32,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  todayPlanStartMobile: {
    width: 36,
    minHeight: 36,
    borderRadius: 15,
    backgroundColor: '#F6FAFD',
    borderWidth: 1,
    borderColor: '#D7E2EC',
    borderBottomColor: '#DCE6EF',
    borderBottomWidth: 2,
    paddingHorizontal: 0,
  },
  todayPlanStartActive: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#D4E0E3',
  },
  todayPlanStartHover: {
    shadowColor: Colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
  },
  todayPlanStartText: {
    color: Colors.onPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  todayPlanStartTextDense: {
    fontSize: 13,
    lineHeight: 16,
  },
  todayPlanStartTextMobile: {
    color: Colors.ink,
  },
  todayPlanStartTextActive: {
    color: Colors.ink,
  },
  todayPlanDonePill: {
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: '#DFFFFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  todayPlanDoneText: {
    color: '#218A83',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  learningProfileBand: {
    borderRadius: 30,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 18,
    gap: 15,
    shadowColor: Colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  learningProfileBandCompact: {
    borderRadius: 26,
    padding: 14,
  },
  profileBandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  platformSectionLabel: {
    color: Colors.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  profileBandTitle: {
    color: Colors.text,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
  },
  totalXpPill: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  totalXpValue: {
    color: Colors.onPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  totalXpLabel: {
    color: Colors.onPrimaryMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  profileMetricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  profileMetricsRowCompact: {
    flexDirection: 'column',
  },
  profileMetricCard: {
    flex: 1,
    minHeight: 102,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 15,
    justifyContent: 'center',
  },
  profileMetricCardPrimary: {
    backgroundColor: Colors.tealDim,
    borderColor: '#2FB9AE40',
  },
  profileMetricValue: {
    color: Colors.text,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
  },
  profileMetricLabel: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  profileMetricNote: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  rubricStatusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rubricStatusRowCompact: {
    flexWrap: 'wrap',
  },
  rubricStatusChip: {
    flex: 1,
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 3,
  },
  rubricStatusChipUrgent: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primaryGlow,
  },
  rubricStatusAccent: {
    width: 28,
    height: 4,
    borderRadius: 999,
  },
  rubricStatusValue: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  rubricStatusLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  generatedShelf: {
    gap: 13,
  },
  generatedShelfDense: {
    gap: 9,
  },
  generatedShelfHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  generatedShelfHeaderDense: {
    minHeight: 24,
    alignItems: 'center',
  },
  generatedShelfTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  generatedShelfNote: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  generatedShelfTitle: {
    color: Colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  generatedShelfTitleDense: {
    fontSize: 23,
    lineHeight: 27,
  },
  generatedShelfTitleMobile: {
    fontSize: 21,
    lineHeight: 25,
  },
  generatedShelfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  generatedShelfGridCompact: {
    gap: 11,
  },
  generatedShelfGridDense: {
    gap: 9,
  },
  generatedShelfCard: {
    flexBasis: '15%',
    flexGrow: 1,
    minWidth: 142,
    height: 148,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  generatedShelfCardMotion: {
    transitionProperty: 'flex-basis, flex-grow, min-width, opacity, transform, box-shadow, border-color, background-color',
    transitionDuration: '220ms',
    transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  } as ViewStyle,
  generatedShelfCardExpanded: {
    flexBasis: '27%',
    flexGrow: 1.85,
    minWidth: 310,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 14,
    borderColor: Colors.secondary,
    backgroundColor: '#FFFFFF',
    transform: [{ translateY: -3 }],
    shadowOpacity: 0.11,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 13 },
  },
  generatedShelfCardHover: {
    borderColor: Colors.teal,
    backgroundColor: '#FFFFFF',
    shadowColor: Colors.teal,
    shadowOpacity: 0.18,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  generatedShelfCardSubdued: {
    flexBasis: '13%',
    flexGrow: 0.84,
    minWidth: 120,
    opacity: 0.68,
  },
  generatedShelfCardCompact: {
    flexBasis: '48%',
    minWidth: 0,
    height: 132,
    borderRadius: 22,
    padding: 12,
  },
  generatedShelfCardDense: {
    width: '31.4%',
    flexBasis: '31.4%',
    flexGrow: 0,
    height: 86,
    borderRadius: 18,
    padding: 8,
  },
  generatedShelfCardMobileCalm: {
    borderColor: '#D9E4EE',
    backgroundColor: '#FFFFFFF8',
    shadowOpacity: 0.025,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  generatedShelfCardMobileMotion: {
    transitionProperty: 'transform, box-shadow, border-color, background-color',
    transitionDuration: '180ms',
    transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  } as ViewStyle,
  generatedShelfCardMobileHover: {
    transform: [{ translateY: -4 }, { scale: 1.025 }],
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  generatedShelfCardPress: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
    shadowOpacity: 0.05,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },
  generatedShelfAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.88,
  },
  generatedShelfIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  generatedShelfIconDense: {
    width: 36,
    height: 36,
    borderRadius: 13,
    marginBottom: 6,
  },
  generatedShelfIconMobileCalm: {
    shadowColor: Colors.ink,
    shadowOpacity: 0,
  },
  generatedShelfIconExpanded: {
    width: 58,
    height: 58,
    borderRadius: 20,
    marginBottom: 0,
  },
  generatedShelfExpandedLead: {
    width: 76,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  generatedShelfCopy: {
    flex: 1,
    minWidth: 0,
  },
  generatedShelfKicker: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  generatedShelfCardTitle: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  generatedShelfText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    minHeight: 32,
    maxWidth: 280,
  },
  generatedShelfModeLabel: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    textAlign: 'center',
  },
  generatedShelfModeLabelDense: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  denseUtilityTile: {
    width: '31.4%',
    flexBasis: '31.4%',
    flexGrow: 0,
    minWidth: 0,
    height: 86,
    borderRadius: 18,
    backgroundColor: '#FFFFFFF4',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  denseUtilityTileHover: {
    borderColor: Colors.teal,
    backgroundColor: '#FFFFFF',
    shadowColor: Colors.teal,
    shadowOpacity: 0.12,
  },
  denseUtilityTilePress: {
    opacity: 0.96,
    transform: [{ translateY: 1 }, { scale: 0.98 }],
  },
  denseUtilityTileMobileCalm: {
    borderColor: '#D9E4EE',
    backgroundColor: '#FFFFFFF8',
    shadowOpacity: 0.025,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  denseUtilityTileMobileMotion: {
    transitionProperty: 'transform, box-shadow, border-color, background-color',
    transitionDuration: '180ms',
    transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  } as ViewStyle,
  denseUtilityTileMobileHover: {
    transform: [{ translateY: -4 }, { scale: 1.025 }],
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  denseUtilityIcon: {
    backgroundColor: Colors.primaryDim,
  },
  generatedShelfExpandedCopy: {
    width: 280,
    maxWidth: 280,
    alignSelf: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  generatedShelfMetaRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    marginTop: 3,
  },
  generatedShelfMetaText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  generatedShelfStartButton: {
    position: 'absolute',
    right: 20,
    top: '50%',
    width: 34,
    height: 48,
    marginTop: -24,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transitionProperty: 'opacity',
    transitionDuration: '190ms',
    transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  } as ViewStyle,
  generatedShelfStartButtonVisible: {
    opacity: 1,
  },
  generatedShelfMetaDot: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  coachPromoStrip: {
    minHeight: 72,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFF2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    shadowColor: Colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  coachPromoStripHover: {
    borderColor: '#F0A79D',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.11,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 15 },
  },
  coachPromoStripPress: {
    opacity: 0.96,
    shadowOpacity: 0.06,
  },
  coachPromoBadge: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachPromoCopy: {
    flex: 1,
    minWidth: 0,
  },
  coachPromoTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  coachPromoText: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  coachPromoButton: {
    minHeight: 44,
    minWidth: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 4,
    borderColor: Colors.primary,
    borderBottomColor: '#AD3829',
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    position: 'relative',
  },
  coachPromoButtonHover: {
    backgroundColor: '#E75A49',
    borderColor: '#E75A49',
    borderBottomColor: '#B93D31',
    shadowColor: Colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  coachPromoButtonText: {
    color: Colors.onPrimary,
    width: '100%',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  coachPromoButtonArrow: {
    position: 'absolute',
    right: 15,
    top: '50%',
    height: 18,
    marginTop: -9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachTopGrid: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'stretch',
  },
  coachTopGridCompact: {
    flexDirection: 'column',
    gap: 14,
  },
  coachHeroCard: {
    flex: 1,
    minHeight: 360,
    borderRadius: 34,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 24,
    gap: 18,
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 15 },
  },
  coachHeroCardCompact: {
    minHeight: 0,
    borderRadius: 28,
    padding: 18,
    gap: 16,
  },
  coachHeroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 17,
  },
  coachHeroMainCompact: {
    gap: 13,
  },
  coachHeroLanguageMark: {
    shadowColor: Colors.primary,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  coachHeroLanguageMarkCompact: {
    transform: [{ scale: 0.92 }],
  },
  coachHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  coachKicker: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachHeroTitle: {
    color: Colors.text,
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '900',
  },
  coachHeroTitleCompact: {
    fontSize: 43,
    lineHeight: 48,
  },
  coachHeroSubtitle: {
    color: Colors.textSub,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  coachHeroBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 20,
  },
  coachHeroBodyCompact: {
    flexDirection: 'column',
    gap: 14,
  },
  coachHeroMission: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 12,
  },
  coachHeroScore: {
    color: Colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
  },
  coachHeroText: {
    color: Colors.textSub,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    maxWidth: 600,
  },
  coachHeroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  coachSignalChip: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
  },
  coachSignalChipMobile: {
    minHeight: 28,
    gap: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#E7D3D1',
  },
  coachSignalChipDense: {
    minHeight: 34,
    gap: 5,
    paddingHorizontal: 10,
  },
  coachSignalChipText: {
    color: Colors.primary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  coachSignalChipTextMobile: {
    color: '#C74738',
    fontSize: 10,
    lineHeight: 12,
  },
  coachSignalChipTextDense: {
    fontSize: 11,
    lineHeight: 14,
  },
  coachCreditChip: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: '#FFF7E2',
    borderWidth: 1,
    borderColor: '#F6C24766',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
  },
  coachCreditChipMobile: {
    minHeight: 24,
    gap: 3,
    paddingHorizontal: 7,
    backgroundColor: '#FFF9E8',
    borderColor: '#F6C24755',
  },
  coachCreditChipDense: {
    minHeight: 34,
    gap: 5,
    paddingHorizontal: 10,
  },
  coachCreditChipText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  coachCreditChipTextMobile: {
    color: Colors.text,
    fontSize: 9,
    lineHeight: 11,
  },
  coachCreditChipTextDense: {
    fontSize: 11,
    lineHeight: 14,
  },
  coachHeroProgressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  coachHeroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  coachHeroProgressText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  coachHeroAction: {
    minHeight: 78,
    borderRadius: 24,
    backgroundColor: Colors.secondary,
    borderBottomWidth: 5,
    borderBottomColor: '#218A83',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: Colors.teal,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  coachHeroActionCompact: {
    minHeight: 92,
    borderRadius: 26,
  },
  coachHeroActionIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFFFFFE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachHeroActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  coachHeroActionKicker: {
    color: '#E9FFFC',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachHeroActionTitle: {
    color: Colors.onPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  coachHeroActionButton: {
    minHeight: 46,
    borderRadius: 17,
    backgroundColor: Colors.ink,
    borderBottomWidth: 4,
    borderBottomColor: '#06101E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 15,
  },
  coachHeroActionButtonText: {
    color: Colors.onPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  coachPlanPanel: {
    width: 500,
    borderRadius: 32,
    backgroundColor: Colors.ink,
    padding: 20,
    gap: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  coachPlanPanelCompact: {
    width: '100%',
    borderRadius: 28,
    padding: 17,
  },
  coachPlanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  coachPlanKicker: {
    color: Colors.teal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachPlanTitle: {
    color: Colors.onPrimary,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  coachPlanTime: {
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: '#FFFFFF12',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  coachPlanTimeText: {
    color: Colors.onPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  coachPlanSteps: {
    gap: 11,
  },
  coachPlanStep: {
    minHeight: 92,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  coachPlanStepPrimary: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
    shadowColor: Colors.teal,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  coachStepNumber: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachStepNumberPrimary: {
    backgroundColor: '#FFFFFFE8',
  },
  coachStepNumberText: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  coachStepNumberTextPrimary: {
    color: Colors.teal,
  },
  coachStepCopy: {
    flex: 1,
    minWidth: 0,
  },
  coachStepRubric: {
    color: Colors.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachStepRubricPrimary: {
    color: '#DFFFFB',
  },
  coachStepTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  coachStepTitlePrimary: {
    color: Colors.onPrimary,
  },
  coachStepWhy: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  coachStepWhyPrimary: {
    color: '#E9FFFC',
  },
  coachStepMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  coachStepMinutes: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  coachStepMinutesPrimary: {
    color: Colors.onPrimary,
  },
  coachStepCredits: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  coachStepCreditsPrimary: {
    color: '#E9FFFC',
  },
  coachRubricPanel: {
    borderRadius: 30,
    backgroundColor: '#FFFFFFE8',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 18,
    gap: 14,
    shadowColor: Colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  coachRubricPanelCompact: {
    borderRadius: 26,
    padding: 14,
  },
  coachRubricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  coachSectionKicker: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachRubricHint: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  coachRubricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  coachRubricGridCompact: {
    flexWrap: 'wrap',
  },
  coachRubricTile: {
    flex: 1,
    minHeight: 118,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 15,
    gap: 4,
  },
  coachRubricTileNextWeak: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primaryGlow,
  },
  coachRubricAccent: {
    width: 34,
    height: 5,
    borderRadius: 999,
    marginBottom: 3,
  },
  coachRubricAccentNeutral: {
    backgroundColor: Colors.gold,
  },
  coachRubricAccentNextWeak: {
    backgroundColor: Colors.primary,
  },
  coachRubricValue: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  coachRubricName: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachRubricPattern: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  coachWorkSection: {
    gap: 13,
  },
  coachWorkHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  coachWorkHeading: {
    color: Colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  coachWorkMiniBadge: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: Colors.ink,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  coachWorkMiniBadgeText: {
    color: Colors.onPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  coachWorkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  coachWorkGridCompact: {
    gap: 11,
  },
  coachWorkCard: {
    flexBasis: '18%',
    flexGrow: 1,
    minWidth: 225,
    minHeight: 140,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
  },
  coachWorkCardCompact: {
    flexBasis: '100%',
    minWidth: 0,
    minHeight: 112,
    borderRadius: 22,
    padding: 14,
  },
  coachWorkIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachWorkCopy: {
    flex: 1,
    minWidth: 0,
  },
  coachWorkRubric: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachWorkTitle: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  coachWorkText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  coachPlacementCard: {
    width: '100%',
    flex: 1,
    flexBasis: 0,
    minHeight: 118,
    borderRadius: 16,
    backgroundColor: '#FFFFFFF4',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  coachPlacementCardCompact: {
    minHeight: 118,
    borderRadius: 16,
    padding: 16,
  },
  coachPlacementCardDense: {
    minHeight: 88,
    padding: 12,
  },
  coachPlacementCardHover: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0A79D',
    shadowColor: Colors.primary,
    shadowOpacity: 0.13,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  coachPlacementCardPress: {
    opacity: 0.96,
    shadowOpacity: 0.07,
  },
  coachPlacementIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachPlacementIconDense: {
    width: 44,
    height: 44,
    borderRadius: 15,
  },
  coachPlacementIconHover: {
    backgroundColor: '#FFF4F2',
    borderColor: '#EFCBC5',
    shadowColor: Colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },
  coachPlacementCopy: {
    flex: 1,
    minWidth: 0,
  },
  coachPlacementTitle: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  coachPlacementTitleDense: {
    fontSize: 19,
    lineHeight: 23,
  },
  coachPlacementText: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  coachPlacementTextDense: {
    fontSize: 12,
    lineHeight: 15,
  },
  homeToolsGrid: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 14,
    borderRadius: 20,
    backgroundColor: '#EEF5F6AA',
    borderWidth: 1,
    borderColor: '#DCE8EA',
    padding: 12,
  },
  homeToolsGridCompact: {
    flexDirection: 'column',
    maxWidth: '100%',
    padding: 10,
  },
  homeToolSlot: {
    flex: 1,
    minWidth: 0,
  },
  homeAnalyticsButton: {
    width: '100%',
    flex: 1,
    flexBasis: 0,
    minHeight: 118,
    borderRadius: 16,
    backgroundColor: '#FFFFFFF4',
    borderWidth: 1,
    borderColor: '#8CDCD4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
  },
  homeAnalyticsButtonCompact: {
    minHeight: 118,
    borderRadius: 16,
    padding: 16,
  },
  homeAnalyticsButtonDense: {
    minHeight: 88,
    padding: 12,
  },
  homeAnalyticsButtonHover: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.teal,
    shadowColor: Colors.teal,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  homeAnalyticsButtonPress: {
    opacity: 0.96,
    shadowOpacity: 0.07,
  },
  homeAnalyticsIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeAnalyticsIconDense: {
    width: 44,
    height: 44,
    borderRadius: 15,
  },
  homeAnalyticsIconHover: {
    backgroundColor: '#FFF4F2',
    borderColor: '#EFCBC5',
  },
  homeAnalyticsCopy: {
    flex: 1,
    minWidth: 0,
  },
  homeAnalyticsTitle: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  homeAnalyticsTitleDense: {
    fontSize: 19,
    lineHeight: 23,
  },
  homeAnalyticsText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  homeAnalyticsTextDense: {
    fontSize: 12,
    lineHeight: 15,
  },
  coachMobileCredits: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#FFF7E2',
    borderWidth: 1,
    borderColor: '#F6C24777',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coachMobileCreditsText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  pathPanel: {
    minHeight: 268,
    borderRadius: 28,
    backgroundColor: Colors.ink,
    padding: 20,
    gap: 13,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  pathPanelCompact: {
    minHeight: 470,
    borderRadius: 28,
    padding: 18,
    gap: 17,
  },
  pathHaloOne: {
    position: 'absolute',
    right: -70,
    top: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#2FB9AE24',
  },
  pathHaloTwo: {
    position: 'absolute',
    left: -80,
    bottom: -120,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: '#D9473426',
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  pathHeaderCompact: {
    alignItems: 'flex-start',
  },
  pathIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pathIdentityCopy: {
    flex: 1,
    minWidth: 0,
  },
  pathKicker: {
    color: Colors.teal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  pathTitle: {
    color: Colors.onPrimary,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  pathTitleCompact: {
    fontSize: 24,
    lineHeight: 29,
  },
  levelToken: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    borderBottomWidth: 5,
    borderBottomColor: '#A93425',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  levelTokenCompact: {
    width: 82,
    height: 82,
    borderRadius: 24,
    borderBottomWidth: 5,
  },
  levelTokenLabel: {
    color: Colors.onPrimaryMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  levelTokenValue: {
    color: Colors.onPrimary,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
  },
  levelTokenValueCompact: {
    fontSize: 32,
    lineHeight: 37,
  },
  pathBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
  },
  pathBodyCompact: {
    flexDirection: 'column',
    gap: 14,
  },
  pathMainCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  pathHeadline: {
    color: Colors.onPrimary,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    maxWidth: 820,
  },
  pathHeadlineCompact: {
    fontSize: 30,
    lineHeight: 35,
  },
  pathSubhead: {
    color: Colors.onPrimaryMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    maxWidth: 760,
  },
  pathSubheadCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  pathStats: {
    width: 280,
    flexDirection: 'row',
    gap: 12,
  },
  pathStatsCompact: {
    width: '100%',
  },
  pathStat: {
    flex: 1,
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: '#FFFFFF12',
    borderWidth: 1,
    borderColor: '#FFFFFF22',
    padding: 12,
    justifyContent: 'center',
    gap: 6,
  },
  pathStatLabel: {
    color: Colors.onPrimaryMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pathStatValue: {
    color: Colors.onPrimary,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  levelRail: {
    gap: 7,
  },
  levelRailTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  levelRailLabel: {
    color: Colors.onPrimaryMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  levelRailTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF18',
    overflow: 'hidden',
  },
  levelRailFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.teal,
  },
  pathFooter: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: '#FFF9ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 12,
  },
  pathFooterCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  pathWeakSignal: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pathWeakCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  pathWeakLabel: {
    color: Colors.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pathWeakText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  missionGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  sideStack: {
    width: 410,
    gap: 12,
  },
  coachBanner: {
    minHeight: 72,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: Colors.primaryGlow,
    backgroundColor: '#FFF9ED',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 20,
    shadowColor: Colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  coachBannerCompact: {
    minHeight: 68,
    borderRadius: 22,
    paddingHorizontal: 14,
    gap: 10,
  },
  coachBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coachBannerText: {
    flex: 1,
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  bannerButton: {
    minHeight: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: Colors.borderBright,
    borderBottomColor: Colors.borderBright,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  bannerButtonText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  courseHeader: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  courseHeaderCompact: {
    minHeight: 72,
  },
  courseTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  courseKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  courseKicker: {
    color: Colors.textSub,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  courseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  courseTitle: {
    color: Colors.text,
    fontSize: 43,
    lineHeight: 49,
    fontWeight: '900',
  },
  courseTitleCompact: {
    fontSize: 30,
    lineHeight: 35,
  },
  scoreBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: '#A93425',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
  },
  scoreBadgeText: {
    color: Colors.onPrimary,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  courseHeaderMark: {
    marginRight: 10,
  },
  progressRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  progressLabel: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  progressTrack: {
    flex: 1,
    height: 13,
    borderRadius: 999,
    backgroundColor: '#E8EDF4',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.teal,
  },
  progressValue: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  scoreModule: {
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  scoreModuleCompact: {
    borderRadius: 22,
  },
  scoreBand: {
    minHeight: 74,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scoreBandTitle: {
    color: Colors.onPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  scoreBandTitleCompact: {
    fontSize: 22,
    lineHeight: 27,
  },
  scoreBandValue: {
    color: Colors.onPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  scoreBandValueCompact: {
    fontSize: 22,
    lineHeight: 27,
  },
  scoreBody: {
    minHeight: 152,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 22,
  },
  scoreBodyCompact: {
    minHeight: 172,
    padding: 14,
    flexDirection: 'column',
    gap: 12,
  },
  weakScoreCard: {
    width: 365,
    borderRadius: 16,
    backgroundColor: Colors.tealDim,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2FB9AE36',
    gap: 6,
  },
  weakScoreCardCompact: {
    width: '100%',
    padding: 14,
  },
  weakScoreTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weakScoreLabel: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  weakScoreTitle: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  weakScoreText: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  scoreRubricRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 14,
  },
  scoreRubricRowCompact: {
    justifyContent: 'space-between',
  },
  scoreMiniStat: {
    flex: 1,
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreMiniIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreMiniDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  scoreMiniCopy: {
    flex: 1,
    minWidth: 0,
  },
  scoreMiniTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  scoreMiniValue: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  midGrid: {
    minHeight: 222,
    flexDirection: 'row',
    gap: 22,
    alignItems: 'stretch',
  },
  activityPreview: {
    flex: 1,
    minWidth: 330,
    minHeight: 148,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    padding: 14,
    gap: 12,
  },
  activityPreviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activityPreviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityPreviewTitle: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  activityIconButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityMetricStrip: {
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: '#FFF4F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  activityMetricBlock: {
    flex: 1,
    gap: 4,
  },
  activityMetricLabel: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  activityMetricValue: {
    color: Colors.text,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
  },
  barChartCard: {
    width: 420,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    padding: 18,
    gap: 13,
    shadowColor: Colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  barChartCardCompact: {
    width: '100%',
    minHeight: 190,
    borderRadius: 20,
    padding: 14,
    gap: 9,
  },
  barChartTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  barChartTitle: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  barChartTitleCompact: {
    fontSize: 18,
    lineHeight: 22,
  },
  scalePill: {
    minHeight: 30,
    minWidth: 44,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  scalePillText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  barScaleHeader: {
    marginLeft: 122,
    marginRight: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barScaleText: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  barChartRows: {
    gap: 8,
  },
  barRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabelCol: {
    width: 112,
    minWidth: 0,
    gap: 2,
  },
  barLabel: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  barPattern: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  barPatternCompact: {
    display: 'none',
  },
  barTrack: {
    flex: 1,
    height: 16,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  barGridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#FFFFFFAA',
    zIndex: 2,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    opacity: 0.86,
  },
  barFillWeakest: {
    opacity: 1,
  },
  barValue: {
    width: 38,
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  barValueWeakest: {
    color: Colors.primary,
  },
  barChartNote: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#FFF9ED',
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  barChartNoteText: {
    flex: 1,
    minWidth: 0,
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  analyticsButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
  },
  analyticsButtonText: {
    color: Colors.primary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  youPanel: {
    width: '100%',
    minHeight: 182,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    padding: 14,
    gap: 11,
    shadowColor: Colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  youPanelTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  youPanelTitle: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  youPanelButton: {
    minHeight: 34,
    borderRadius: 14,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  youPanelButtonText: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  youSignalGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  youSignalCard: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: Colors.tealDim,
    borderWidth: 1,
    borderColor: '#2FB9AE38',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 3,
  },
  youSignalCardWeak: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primaryGlow,
  },
  youSignalLabel: {
    color: Colors.textSub,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  youSignalValue: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  youCoachNote: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#FFF9ED',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  youCoachText: {
    flex: 1,
    minWidth: 0,
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  youScheduleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  youScheduleStat: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  youScheduleValue: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  youScheduleLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  generatedModesPanel: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    padding: 14,
    gap: 10,
  },
  generatedModesTop: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  generatedModesTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  generatedModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  generatedModeChip: {
    width: '48.8%',
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    shadowOpacity: 0.055,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
  },
  generatedModeIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
  },
  generatedModeCopy: {
    flex: 1,
    minWidth: 0,
  },
  generatedModeTitle: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  generatedModeMeta: {
    color: Colors.textSub,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  generatedModesNote: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  sparkCard: {
    width: 420,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    padding: 18,
    gap: 6,
  },
  sparkCardCompact: {
    width: '100%',
    minHeight: 238,
    borderRadius: 22,
    padding: 16,
  },
  sparkTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelKicker: {
    color: Colors.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sparkTitle: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  sparkTitleCompact: {
    fontSize: 25,
    lineHeight: 30,
  },
  goalChip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: '#FFF9ED',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalChipText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  lowerGrid: {
    flexDirection: 'row',
    gap: 22,
    alignItems: 'flex-start',
  },
  planPanel: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    padding: 14,
    gap: 10,
  },
  rubricPanel: {
    width: 520,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    padding: 18,
    gap: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelTitle: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  creditsChip: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 13,
    backgroundColor: '#FFF9ED',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  creditsChipText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  planList: {
    gap: 8,
  },
  planPill: {
    minHeight: 78,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
  },
  planPillIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planPillCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  planPillTask: {
    color: Colors.primary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  planPillTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  planPillWhy: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  minuteBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: Colors.borderBright,
    borderBottomColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  minuteValue: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  minuteLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  rubricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mobileRubricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  rubricStat: {
    width: '48.5%',
    minHeight: 160,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 13,
    gap: 6,
  },
  rubricStatCompact: {
    minHeight: 104,
    width: '48.5%',
  },
  rubricStatUrgent: {
    backgroundColor: '#FFF4F4',
    borderColor: '#E8B8B2',
  },
  rubricStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rubricDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  rubricStatName: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  rubricStatScore: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  rubricStatTrend: {
    alignSelf: 'flex-start',
    color: Colors.teal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  rubricStatTrendUrgent: {
    color: Colors.primary,
  },
  rubricStatPattern: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  mobileWorkList: {
    gap: 10,
  },
  nextDock: {
    position: 'absolute',
    left: 540,
    right: 280,
    bottom: 0,
    minHeight: 96,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: Colors.ink,
    borderTopWidth: 8,
    borderTopColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    zIndex: 40,
    shadowColor: Colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
  },
  nextDockCompact: {
    position: 'relative',
    left: undefined,
    right: undefined,
    bottom: undefined,
    minHeight: 118,
    borderRadius: 22,
    borderTopWidth: 7,
    paddingHorizontal: 14,
  },
  nextDockBack: {
    transform: [{ rotate: '180deg' }],
  },
  nextDockIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nextDockCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextDockTitle: {
    color: Colors.onPrimary,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  nextDockText: {
    color: Colors.onPrimaryMuted,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  raisedButton: {
    minHeight: 48,
    minWidth: 108,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    borderBottomWidth: 5,
    borderBottomColor: '#A93425',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    flexShrink: 0,
  },
  raisedButtonCompact: {
    minHeight: 50,
    minWidth: 92,
    borderRadius: 16,
    borderBottomWidth: 5,
    paddingHorizontal: 16,
  },
  raisedButtonPressed: {
    transform: [{ translateY: 3 }],
    borderBottomWidth: 3,
  },
  raisedButtonText: {
    color: Colors.onPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  raisedButtonTextCompact: {
    fontSize: 15,
    lineHeight: 20,
  },
  activityCornerTab: {
    position: 'absolute',
    right: 0,
    top: 96,
    width: 68,
    height: 68,
    borderBottomLeftRadius: 42,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
    paddingBottom: 10,
    zIndex: 36,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: -6, height: 7 },
    elevation: 8,
  },
  activityOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 220,
    elevation: 220,
  },
  activityOverlayScrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 27, 45, 0.24)',
    alignItems: 'flex-end',
  },
  activityDrawer: {
    width: '86%',
    maxWidth: 380,
    height: '100%',
    backgroundColor: Colors.card,
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
    borderLeftWidth: 1,
    borderColor: Colors.borderBright,
    shadowColor: Colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 26,
    shadowOffset: { width: -10, height: 0 },
    elevation: 22,
  },
  activityDrawerCompact: {
    width: '92%',
    maxWidth: 420,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
  },
  activityDrawerInner: {
    flex: 1,
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 116,
    gap: 14,
  },
  activityDrawerInnerCompact: {
    paddingTop: 42,
    paddingHorizontal: 16,
    paddingBottom: 102,
    gap: 12,
  },
  activityDrawerTop: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  activityTitle: {
    color: Colors.text,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
  },
  activityCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityMetricGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  activityMetricCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 13,
    justifyContent: 'center',
    gap: 5,
  },
  drawerMetricValue: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  drawerMetricLabel: {
    color: Colors.textSub,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  activityList: {
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    overflow: 'hidden',
  },
  activityListItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activityListIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityListDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  activityListCopy: {
    flex: 1,
    minWidth: 0,
  },
  activityListTitle: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  activityListMeta: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  simpleContent: {
    width: '100%',
    maxWidth: 1460,
    alignSelf: 'center',
    gap: 18,
  },
  simpleContentCompact: {
    gap: 15,
  },
  simplePromo: {
    minHeight: 76,
    borderRadius: 28,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  simplePromoIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simplePromoCopy: {
    flex: 1,
    minWidth: 0,
  },
  simplePromoTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  simplePromoText: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  simplePromoButton: {
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}0D`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  simplePromoButtonText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  simpleCourseCard: {
    minHeight: 300,
    borderRadius: 30,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 28,
    gap: 24,
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  simpleCourseCardCompact: {
    minHeight: 0,
    borderRadius: 26,
    padding: 20,
    gap: 18,
  },
  simpleCourseMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  simpleCourseCopy: {
    flex: 1,
    minWidth: 0,
  },
  simpleCourseEyebrow: {
    color: Colors.primary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  simpleCourseTitle: {
    color: Colors.text,
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '900',
  },
  simpleCourseTitleCompact: {
    fontSize: 38,
    lineHeight: 43,
  },
  simpleCourseSubtitle: {
    color: Colors.textSub,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  simpleLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  simpleLevelLabel: {
    color: Colors.text,
    fontSize: 33,
    lineHeight: 39,
    fontWeight: '900',
  },
  simpleLevelMeta: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  simpleXpBadge: {
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 19,
    backgroundColor: `${Colors.gold}1F`,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleXpBadgeText: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  simpleProgressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  simpleProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  simpleScoreCard: {
    borderRadius: 28,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  simpleScoreHeader: {
    minHeight: 72,
    paddingHorizontal: 24,
    paddingVertical: 15,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  simpleScoreTitle: {
    color: Colors.onPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  simpleScoreValue: {
    color: Colors.onPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  simpleStatsGrid: {
    padding: 24,
    flexDirection: 'row',
    gap: 18,
  },
  simpleStatsGridCompact: {
    padding: 14,
    gap: 10,
  },
  simpleStatCard: {
    flex: 1,
    minHeight: 126,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  simpleStatCardCompact: {
    minHeight: 106,
    paddingHorizontal: 8,
  },
  simpleStatAccent: {
    width: 32,
    height: 5,
    borderRadius: 999,
    opacity: 0.82,
    marginBottom: 3,
  },
  simpleStatValue: {
    color: Colors.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    textAlign: 'center',
  },
  simpleStatLabel: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  simpleStatNote: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  simpleSectionHeader: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  simpleSectionTitle: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  simplePracticeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  simplePracticeGridCompact: {
    gap: 12,
  },
  simplePracticeCard: {
    flexBasis: '32%',
    flexGrow: 1,
    minWidth: 310,
    minHeight: 138,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  simplePracticeCardCompact: {
    flexBasis: '100%',
    minWidth: 0,
    minHeight: 116,
    borderRadius: 22,
    padding: 15,
  },
  simplePracticeIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simplePracticeCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  simplePracticeTitle: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  simplePracticeText: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  simplePlacementCard: {
    minHeight: 88,
    borderRadius: 25,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: Colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
  },
  simplePlacementCardCompact: {
    minHeight: 84,
    borderRadius: 23,
  },
  simplePlacementIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: `${Colors.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simplePlacementCopy: {
    flex: 1,
    minWidth: 0,
  },
  simplePlacementTitle: {
    color: Colors.text,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  simplePlacementText: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  simplePlacementArrow: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
