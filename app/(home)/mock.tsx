import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { getPlayerLevel } from '@/utils/progression';
import { encodeTargetSkills } from '@/utils/targetSkills';
import {
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  HeadphonesIcon,
  MessageCircleIcon,
  TargetIcon,
  WaveformIcon,
  XIcon,
} from '@/components/Icons';
import { useAppStorage } from '@/hooks/useAppStorage';
import { MainTabHeader, MobileTabHeader } from '@/components/MainTabHeader';
import {
  APP_COMPACT_BREAKPOINT,
  DESKTOP_RAIL_NARROW_BREAKPOINT,
  DesktopSideRail,
  getDesktopContentInsets,
} from '@/components/AppFooterTabs';
import { KanjiBackdrop } from '@/components/KanjiBackdrop';
import { CreditStartNotice } from '@/components/CreditStartNotice';
import {
  clearMockProgress,
  canStartPracticeSession,
  CREDIT_COSTS,
  getActiveMockProgress,
  getSessionHistory,
  recordPracticeSessionStart,
  startMockProgress,
  type CreditUsage,
  type MockProgress,
  type MockSection,
  type SessionRecord,
  type SubscriptionPlan,
} from '@/utils/storage';

type MockStep = {
  section: MockSection;
  title: string;
  detail: string;
  mobileTitle: string;
  mobileDetail: string;
  route: '/listening/session' | '/ap/reading' | '/ap/texting' | '/ap/conversation';
  params: Record<string, string>;
  accent: string;
  icon: React.ReactNode;
};

const STEPS: MockStep[] = [
  {
    section: 'listening',
    title: 'Listening Mini Set',
    detail: '3 AP-style listening questions with instant answer review.',
    mobileTitle: 'Listening',
    mobileDetail: '3 audio questions',
    route: '/listening/session',
    params: { languageCode: 'ja', count: '3', sessionId: 'mock-listening' },
    accent: Colors.listening,
    icon: <HeadphonesIcon size={20} color={Colors.listening} strokeWidth={2.1} />,
  },
  {
    section: 'reading',
    title: 'Reading Passage Set',
    detail: 'Read AP-style passages with linked detail and inference questions.',
    mobileTitle: 'Reading',
    mobileDetail: '1 passage set',
    route: '/ap/reading',
    params: { languageCode: 'ja', count: '1', sessionId: 'mock-reading' },
    accent: Colors.reading,
    icon: <FileTextIcon size={20} color={Colors.reading} />,
  },
  {
    section: 'texting',
    title: 'Text Chat',
    detail: 'Timed written replies with AP-style scoring and model answers.',
    mobileTitle: 'Text Chat',
    mobileDetail: 'Timed replies',
    route: '/ap/texting',
    params: { languageCode: 'ja' },
    accent: Colors.primary,
    icon: <MessageCircleIcon size={20} color={Colors.primary} strokeWidth={2.1} />,
  },
  {
    section: 'conversation',
    title: 'Conversation',
    detail: '4 spoken turns, 20 seconds each, scored on communication quality.',
    mobileTitle: 'Conversation',
    mobileDetail: '4 spoken turns',
    route: '/ap/conversation',
    params: { languageCode: 'ja' },
    accent: Colors.teal,
    icon: <WaveformIcon size={20} color={Colors.teal} strokeWidth={2.1} />,
  },
];

function normalizedAPScore(section: MockSection, score?: number): number | null {
  if (score === undefined) return null;
  if (section === 'listening' || section === 'reading') {
    if (score >= 85) return 5;
    if (score >= 70) return 4;
    if (score >= 55) return 3;
    if (score >= 35) return 2;
    return 1;
  }
  return Math.max(1, Math.min(5, score));
}

const AP_READY_LEVEL = 21;
const MOCK_TIER_LABELS = ['Level signal', 'AP estimate', '5-proof', 'Consistency'] as const;
const MOCK_TIER_SHORT_LABELS = ['Signal', 'AP', 'Proof', 'Steady'] as const;
const REQUIRED_FIVE_PROOF_MOCKS = 2;

function mockLevelSignal(score: number, hasEvidence: boolean) {
  if (!hasEvidence) return 'Baseline';
  if (score >= 4.45) return 'Strong';
  if (score >= 3.45) return 'Ready';
  if (score >= 2.45) return 'Building';
  return 'Needs work';
}

function sessionTypeToMockSection(type: SessionRecord['type']): MockSection | null {
  if (type === 'listening' || type === 'reading' || type === 'texting' || type === 'conversation') return type;
  return null;
}

function getCompletedMockEstimates(sessions: SessionRecord[]) {
  const grouped = new Map<string, Partial<Record<MockSection, number>>>();

  sessions.forEach((session) => {
    if (!session.mockId) return;
    const section = sessionTypeToMockSection(session.type);
    if (!section) return;
    const current = grouped.get(session.mockId) ?? {};
    current[section] = session.score;
    grouped.set(session.mockId, current);
  });

  return Array.from(grouped.values()).flatMap((scores) => {
    const parts = STEPS
      .map((step) => normalizedAPScore(step.section, scores[step.section]))
      .filter((score): score is number => score !== null);
    if (parts.length !== STEPS.length) return [];
    const average = parts.reduce((sum, score) => sum + score, 0) / parts.length;
    return [Math.max(1, Math.min(5, Math.round(average)))];
  });
}

function getMockChallengeTierIndex(level: number, apFiveMockCount: number) {
  if (apFiveMockCount >= REQUIRED_FIVE_PROOF_MOCKS) return 3;
  if (apFiveMockCount >= 1) return 2;
  if (level >= AP_READY_LEVEL) return 1;
  return 0;
}

function getMockChallengeCopy(tierIndex: number) {
  if (tierIndex === 0) return `Build enough level evidence to unlock AP estimates at Level ${AP_READY_LEVEL}.`;
  if (tierIndex === 1) return 'An AP 5 here unlocks 5-proof pressure, not a finish screen.';
  if (tierIndex === 2) return `5-proof is unlocked. Next goal: ${REQUIRED_FIVE_PROOF_MOCKS} AP 5 mocks on different runs.`;
  return 'Consistency is live: push beyond an AP 5 estimate with harder mocks, daily plans, and personalized weak-spot drills.';
}

function getMockTierTargetSkills(tierIndex: number, section: MockSection) {
  const base = ['mini mock', 'AP Japanese task shape', `${section} section`];
  if (tierIndex === 0) return [...base, 'level-calibrated AP format', 'explain score as level signal'];
  if (tierIndex === 1) return [...base, 'AP exam estimate', 'AP-ready difficulty', 'realistic distractors'];
  if (tierIndex === 2) {
    return [
      ...base,
      '5-proof pressure',
      'harder than baseline AP practice',
      'denser evidence',
      'register nuance traps',
      'less beginner support',
    ];
  }
  return [
    ...base,
    'consistency pressure',
    'mixed weak-skill traps',
    'AP 5 retention',
    'fast but natural response control',
  ];
}

function ReadinessRing({
  progress,
  color,
  compact,
  mobile = false,
  completed,
  total,
}: {
  progress: number;
  color: string;
  compact: boolean;
  mobile?: boolean;
  completed: number;
  total: number;
}) {
  const size = mobile ? 56 : compact ? 76 : 100;
  const stroke = mobile ? 6 : compact ? 8 : 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const segmentGap = mobile ? 6 : compact ? 8 : 10;
  const segmentLength = (circumference - segmentGap * total) / total;
  const filledSegments = Math.round(clampedProgress * total);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
        {Array.from({ length: total }).map((_, index) => (
          <Circle
            key={`readiness-segment-${index}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={index < filledSegments ? color : Colors.border}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={-(index * (segmentLength + segmentGap))}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </Svg>
    </View>
  );
}

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

type InteractiveState = { hovered: boolean; pressed: boolean };

function MockPressable({
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
  style: StyleProp<ViewStyle>;
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
      tension: 190,
      friction: 16,
      useNativeDriver: true,
    }).start();
  }, [active, lift]);

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
          style,
          hovered && hoverStyle,
          pressed && pressStyle,
          {
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, pressed ? 1 : -3] }) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, pressed ? 0.995 : 1.008] }) },
            ],
          },
        ]}
      >
        {typeof children === 'function' ? children({ hovered, pressed }) : children}
      </Animated.View>
    </Pressable>
  );
}

function MockStepTile({
  step,
  index,
  completed,
  isNext,
  compact,
  mobile = false,
  tight = false,
  onPress,
}: {
  step: MockStep;
  index: number;
  completed: boolean;
  isNext: boolean;
  compact: boolean;
  mobile?: boolean;
  tight?: boolean;
  onPress: () => void;
}) {
  return (
    <MockPressable
      onPress={onPress}
      wrapperStyle={[styles.stepPressable, compact && styles.stepPressableCompact, mobile && styles.stepPressableMobile]}
      style={[
        styles.stepCard,
        completed && styles.stepCardDone,
        isNext && styles.stepCardNext,
        compact && styles.stepCardCompact,
        tight && styles.stepCardTight,
        compact && completed && styles.stepCardDoneCompact,
        compact && isNext && styles.stepCardNextCompact,
        mobile && styles.stepCardMobile,
        mobile && completed && styles.stepCardDoneMobile,
        mobile && isNext && styles.stepCardNextMobile,
      ]}
      hoverStyle={styles.stepCardHover}
      pressStyle={styles.stepCardPress}
      accessibilityLabel={`Open ${step.title}`}
    >
      {({ hovered }) => (
        <>
          <View style={[
            styles.stepIcon,
            compact && styles.stepIconCompact,
            tight && styles.stepIconTight,
            mobile && styles.stepIconMobile,
            completed ? styles.stepIconDone : isNext ? styles.stepIconNext : styles.stepIconIdle,
            compact && completed && styles.stepIconDoneCompact,
            mobile && completed && styles.stepIconDoneMobile,
            hovered && !completed && styles.stepIconHover,
          ]}>
            {completed
              ? <CheckIcon size={22} color={Colors.onPrimary} strokeWidth={2.8} />
              : step.icon}
          </View>
          <View style={[styles.stepBody, compact && styles.stepBodyCompact, tight && styles.stepBodyTight, mobile && styles.stepBodyMobile]}>
            <Text style={[styles.stepIndex, compact && styles.stepIndexCompact, tight && styles.stepIndexTight, mobile && styles.stepIndexMobile, completed && styles.stepIndexDone, compact && completed && styles.stepIndexDoneCompact]}>
              Part {index + 1}{completed ? ' · Done' : compact && isNext ? ' · Up next' : ''}
            </Text>
            <Text
              style={[styles.stepTitle, compact && styles.stepTitleCompact, tight && styles.stepTitleTight, mobile && styles.stepTitleMobile, completed && styles.stepTitleDone, compact && completed && styles.stepTitleDoneCompact]}
              numberOfLines={1}
            >
              {compact ? step.mobileTitle : step.title}
            </Text>
          </View>
          {!compact && (
            <View style={styles.stepChevron}>
              <NudgeChevronRight active={hovered} size={23} color={hovered ? Colors.ink : Colors.textMuted} strokeWidth={2.7} />
            </View>
          )}
        </>
      )}
    </MockPressable>
  );
}

export default function MockScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const compactModalMaxHeight = Math.max(330, height - 92);
  const isTightMock = width < 1120;
  const mobileMock = isCompact;
  const desktopInsets = getDesktopContentInsets(width);
  const useWideDesktopNudge = width >= DESKTOP_RAIL_NARROW_BREAKPOINT;
  const { stats } = useAppStorage();
  const [mock, setMock] = useState<MockProgress | null>(null);
  const [mockHistory, setMockHistory] = useState<SessionRecord[]>([]);
  const [pendingRedoStep, setPendingRedoStep] = useState<MockStep | null>(null);
  const [creditNotice, setCreditNotice] = useState<{ usage: CreditUsage; plan: SubscriptionPlan; step: MockStep } | null>(null);
  const [openSubscriptionsSignal, setOpenSubscriptionsSignal] = useState(0);
  const [challengeHelpOpen, setChallengeHelpOpen] = useState(false);

  const loadMock = useCallback(async () => {
    const [current, history] = await Promise.all([getActiveMockProgress(), getSessionHistory()]);
    setMock(current ?? await startMockProgress());
    setMockHistory(history);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMock();
    }, [loadMock]),
  );

  const showStepCreditCheck = async (step: MockStep) => {
    const access = await canStartPracticeSession(CREDIT_COSTS.drill);
    setCreditNotice({ usage: access.usage, plan: access.plan, step });
  };

  const openStep = async (step: MockStep) => {
    const current = mock ?? await startMockProgress();
    setMock(current);
    if (current.sectionScores[step.section] !== undefined) {
      setPendingRedoStep(step);
      return;
    }
    await showStepCreditCheck(step);
  };

  const confirmStepStart = async () => {
    if (!creditNotice) return;
    const access = await canStartPracticeSession(CREDIT_COSTS.drill);
    if (!access.allowed) {
      setCreditNotice((current) => current ? { ...current, usage: access.usage, plan: access.plan } : current);
      return;
    }
    const current = mock ?? await startMockProgress();
    setMock(current);
    const step = creditNotice.step;
    await recordPracticeSessionStart(CREDIT_COSTS.drill);
    setCreditNotice(null);
    const targetSkills = encodeTargetSkills(getMockTierTargetSkills(challengeTierIndex, step.section));
    router.push({
      pathname: step.route,
      params: { ...step.params, sessionId: `${current.id}:${step.section}`, mockId: current.id, ...(targetSkills ? { targetSkills } : {}) },
    });
  };

  const confirmRedoStep = async () => {
    if (!pendingRedoStep) return;
    const current = mock ?? await startMockProgress();
    setMock(current);
    const step = pendingRedoStep;
    setPendingRedoStep(null);
    await showStepCreditCheck(step);
  };

  const resetMock = async () => {
    await clearMockProgress();
    const next = await startMockProgress();
    setMock(next);
  };

  const completedCount = STEPS.filter((step) => mock?.sectionScores[step.section] !== undefined).length;
  const isComplete = completedCount === STEPS.length;
  const scoredSteps = STEPS
    .map((step) => ({
      ...step,
      apScore: normalizedAPScore(step.section, mock?.sectionScores[step.section]),
    }))
    .filter((step) => step.apScore !== null);
  const averageScore = scoredSteps.length > 0
    ? scoredSteps.reduce((sum, step) => sum + (step.apScore ?? 0), 0) / scoredSteps.length
    : 0;
  const estimatedAPScore = completedCount > 0 ? Math.max(1, Math.min(5, Math.round(averageScore))) : 3;
  const playerLevel = getPlayerLevel(stats?.totalXP ?? 0);
  const completedMockEstimates = getCompletedMockEstimates(mockHistory);
  const apFiveMockCount = completedMockEstimates.filter((score) => score >= 5).length;
  const challengeTierIndex = getMockChallengeTierIndex(playerLevel.level, apFiveMockCount);
  const showAPEstimate = playerLevel.level >= AP_READY_LEVEL;
  const nextStep = STEPS.find((step) => mock?.sectionScores[step.section] === undefined) ?? STEPS[0];
  const scoreBoxLabel = showAPEstimate ? 'AP estimate' : 'Level signal';
  const scoreBoxValue = showAPEstimate ? `AP ${estimatedAPScore}` : mockLevelSignal(averageScore, completedCount > 0);
  const scoreBoxMeta = showAPEstimate
    ? (isComplete ? 'exam-shaped signal' : `${nextStep.mobileTitle} next`)
    : (isComplete ? `AP estimate unlocks at Level ${AP_READY_LEVEL}` : `${nextStep.mobileTitle} next`);
  const weakest = scoredSteps.length > 0
    ? scoredSteps.reduce((low, step) => (step.apScore! < low.apScore! ? step : low), scoredSteps[0])
    : null;
  const readinessStatus = isComplete ? 'Complete' : completedCount > 0 ? 'In progress' : 'Not started';
  const readinessColor = completedCount > 0 ? Colors.teal : Colors.borderBright;
  const challengeCopy = getMockChallengeCopy(challengeTierIndex);

  return (
    <SafeAreaView style={styles.safe}>
      <KanjiBackdrop variant="mock" compact={isCompact || isTightMock} />
      <DesktopSideRail />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          !isCompact && desktopInsets,
          isCompact && styles.scrollCompact,
          isTightMock && (isCompact ? styles.scrollTightMobile : styles.scrollTight),
          mobileMock && styles.scrollMockMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageShell, isCompact && styles.pageShellCompact]}>
          {isCompact ? (
            <MobileTabHeader
              streak={stats?.currentStreak ?? 0}
              onSwitch={() => router.push('/onboarding')}
              openSubscriptionsSignal={openSubscriptionsSignal}
            />
          ) : (
            <MainTabHeader
              streak={stats?.currentStreak ?? 0}
              onSwitch={() => router.push('/onboarding')}
              openSubscriptionsSignal={openSubscriptionsSignal}
            />
          )}

          <View style={[styles.mockContentGrid, useWideDesktopNudge && styles.mockContentGridDesktopNudge, isCompact && styles.mockContentGridCompact, isTightMock && styles.mockContentGridTight, mobileMock && styles.mockContentGridMobile]}>
            <View style={[styles.mockSummaryPanel, isCompact && styles.mockSummaryPanelCompact, isTightMock && styles.mockSummaryPanelTight, mobileMock && styles.mockSummaryPanelMobile]}>
              <View style={[styles.mockIntro, isTightMock && styles.mockIntroTight, mobileMock && styles.mockIntroMobile]}>
                <Text style={[styles.kicker, mobileMock && styles.kickerMobile]}>AP Japanese</Text>
                <Text style={[styles.title, isCompact && styles.titleCompact, isTightMock && styles.titleTight, mobileMock && styles.titleMobile]}>Mini Mock</Text>
                <Text style={[styles.subtitle, isCompact && styles.subtitleCompact, isTightMock && styles.subtitleTight, mobileMock && styles.subtitleMobile]} numberOfLines={isTightMock ? 1 : 2}>
                  {isTightMock ? 'AP-shaped readiness check.' : 'A compact AP-shaped check across listening, reading, text chat, and live conversation.'}
                </Text>
              </View>

              <View style={[styles.mockActionRow, isCompact && styles.mockActionRowCompact, isTightMock && styles.mockActionRowTight, mobileMock && styles.mockActionRowMobile]}>
                {!isComplete ? (
                  <MockPressable
                    onPress={() => openStep(nextStep)}
                    style={[styles.primaryAction, styles.primaryActionBoard, isCompact && styles.primaryActionBoardCompact, isTightMock && styles.primaryActionBoardTight, mobileMock && styles.primaryActionMobile]}
                    hoverStyle={[styles.primaryActionHover, mobileMock && styles.primaryActionHoverMobile]}
                    pressStyle={styles.primaryActionPress}
                    accessibilityLabel={`Start ${nextStep.title}`}
                  >
                    {({ hovered }) => (
                      <>
                        <View style={[styles.primaryActionIcon, isTightMock && styles.primaryActionIconTight, mobileMock && styles.primaryActionIconMobile, hovered && styles.primaryActionIconHover]}>
                          {nextStep.icon}
                        </View>
                        <View style={styles.primaryActionCopy}>
                          <Text style={[styles.primaryActionLabel, isTightMock && styles.primaryActionLabelTight, mobileMock && styles.primaryActionLabelMobile]}>{completedCount === 0 ? 'Start' : 'Up next'}</Text>
                          <Text style={[styles.primaryActionTitle, isTightMock && styles.primaryActionTitleTight, mobileMock && styles.primaryActionTitleMobile]} numberOfLines={1}>{isTightMock ? nextStep.mobileTitle : nextStep.title}</Text>
                        </View>
                        <View style={[styles.primaryActionArrow, mobileMock && styles.primaryActionArrowMobile]}>
                          <NudgeChevronRight active={hovered} size={20} color={Colors.onPrimary} strokeWidth={2.8} />
                        </View>
                      </>
                    )}
                  </MockPressable>
                ) : (
                  <View style={[styles.completeActions, isCompact && styles.completeActionsCompact]}>
                    {weakest && (
                      <TouchableOpacity onPress={() => openStep(weakest)} activeOpacity={0.84} style={styles.redoBtn}>
                        <Text style={styles.redoText}>Redo Weakest Section</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={resetMock} activeOpacity={0.84} style={styles.resetFullBtn}>
                      <Text style={styles.resetFullText}>Reset Mini Mock</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!isTightMock && <Text style={styles.mockActionCopy} numberOfLines={isCompact ? 2 : 2}>
                  {isComplete
                    ? 'Redo a section to replace its result and refresh the estimate.'
                    : 'Complete all four sections for a cleaner AP readiness signal.'}
                </Text>}
              </View>

              <View style={[styles.mockReadinessCard, isCompact && styles.mockReadinessCardCompact, isTightMock && styles.mockReadinessCardTight, mobileMock && styles.mockReadinessCardMobile]}>
                <ReadinessRing
                  progress={completedCount / STEPS.length}
                  color={readinessColor}
                  compact={isCompact || isTightMock}
                  mobile={mobileMock}
                  completed={completedCount}
                  total={STEPS.length}
                />
                <View style={[styles.mockReadinessCopy, mobileMock && styles.mockReadinessCopyMobile]}>
                  <Text style={[styles.scoreTitle, isTightMock && styles.scoreTitleTight, mobileMock && styles.scoreTitleMobile]}>Readiness</Text>
                  <Text style={[styles.mockReadinessState, isTightMock && styles.mockReadinessStateTight, mobileMock && styles.mockReadinessStateMobile]}>{readinessStatus}</Text>
                  <Text style={[styles.mockReadinessMeta, isTightMock && styles.mockReadinessMetaTight, mobileMock && styles.mockReadinessMetaMobile]}>
                    {isComplete ? 'All AP parts complete' : `${STEPS.length - completedCount} parts left`}
                  </Text>
                </View>
                <View style={[styles.mockEstimateBox, isTightMock && styles.mockEstimateBoxTight, mobileMock && styles.mockEstimateBoxMobile]}>
                  <View style={styles.mockEstimateTop}>
                    <Text style={[styles.mockEstimateLabel, isTightMock && styles.mockEstimateLabelTight, mobileMock && styles.mockEstimateLabelMobile]}>{scoreBoxLabel}</Text>
                  </View>
                  <Text style={[styles.mockEstimateValue, isTightMock && styles.mockEstimateValueTight, mobileMock && styles.mockEstimateValueMobile]}>{scoreBoxValue}</Text>
                  <Text style={[styles.mockEstimateMeta, isTightMock && styles.mockEstimateMetaTight, mobileMock && styles.mockEstimateMetaMobile]} numberOfLines={1}>{scoreBoxMeta}</Text>
                </View>
              </View>

              <View style={[styles.mockChallengePanel, isCompact && styles.mockChallengePanelCompact, isTightMock && styles.mockChallengePanelTight, mobileMock && styles.mockChallengePanelMobile]}>
                <View style={[styles.mockChallengeTop, mobileMock && styles.mockChallengeTopMobile]}>
                  <View style={[styles.mockChallengeCopy, mobileMock && styles.mockChallengeCopyMobile]}>
                    <Text style={[styles.mockChallengeKicker, isTightMock && styles.mockChallengeKickerTight, mobileMock && styles.mockChallengeKickerMobile]}>Mock ladder</Text>
                    <Text style={[styles.mockChallengeTitle, isTightMock && styles.mockChallengeTitleTight, mobileMock && styles.mockChallengeTitleMobile]}>{MOCK_TIER_LABELS[challengeTierIndex]}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setChallengeHelpOpen(true)}
                    activeOpacity={0.82}
                    style={[styles.mockChallengeHelp, isTightMock && styles.mockChallengeHelpTight, mobileMock && styles.mockChallengeHelpMobile]}
                    accessibilityLabel="Explain why Mini Mock continues after a five"
                  >
                    <Text style={[styles.mockChallengeHelpText, isTightMock && styles.mockChallengeHelpTextTight, mobileMock && styles.mockChallengeHelpTextMobile]}>?</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.mockTierRail, isCompact && styles.mockTierRailCompact, isTightMock && styles.mockTierRailTight, mobileMock && styles.mockTierRailMobile]}>
                  {MOCK_TIER_LABELS.map((label, index) => {
                    const unlocked = index <= challengeTierIndex;
                    const active = index === challengeTierIndex;
                    const displayLabel = isTightMock ? MOCK_TIER_SHORT_LABELS[index] : label;
                    return (
                      <View
                        key={label}
                        style={[
                          styles.mockTierStep,
                          isTightMock && styles.mockTierStepTight,
                          mobileMock && styles.mockTierStepMobile,
                          unlocked && styles.mockTierStepUnlocked,
                          active && styles.mockTierStepActive,
                        ]}
                      >
                        <Text style={[styles.mockTierNumber, isTightMock && styles.mockTierNumberTight, mobileMock && styles.mockTierNumberMobile, unlocked && styles.mockTierNumberUnlocked]}>{index + 1}</Text>
                        <Text style={[styles.mockTierLabel, isTightMock && styles.mockTierLabelTight, mobileMock && styles.mockTierLabelMobile, unlocked && styles.mockTierLabelUnlocked]} numberOfLines={1}>{displayLabel}</Text>
                      </View>
                    );
                  })}
                </View>
                {!isTightMock && <Text style={styles.mockChallengeText}>{challengeCopy}</Text>}
              </View>
            </View>

            <View style={[styles.mockPartsPanel, isCompact && styles.mockPartsPanelCompact, isTightMock && styles.mockPartsPanelTight, mobileMock && styles.mockPartsPanelMobile]}>
              <View style={[styles.mockPartsHeader, isTightMock && styles.mockPartsHeaderTight, mobileMock && styles.mockPartsHeaderMobile]}>
                <View>
                  <Text style={[styles.mockPartsKicker, isTightMock && styles.mockPartsKickerTight, mobileMock && styles.mockPartsKickerMobile]}>AP order</Text>
                  <Text style={[styles.mockPartsTitle, isTightMock && styles.mockPartsTitleTight, mobileMock && styles.mockPartsTitleMobile]}>Parts</Text>
                </View>
                <View style={[styles.mockPartsDonePill, isTightMock && styles.mockPartsDonePillTight, mobileMock && styles.mockPartsDonePillMobile]}>
                  <Text style={[styles.mockPartsDoneText, isTightMock && styles.mockPartsDoneTextTight, mobileMock && styles.mockPartsDoneTextMobile]}>{isComplete ? 'Done' : `${STEPS.length}`}</Text>
                </View>
              </View>

              <View style={[styles.steps, isCompact && styles.stepsCompact, isTightMock && styles.stepsTight, mobileMock && styles.stepsMobile]}>
                {STEPS.map((step, index) => {
                  const completed = mock?.sectionScores[step.section] !== undefined;
                  const isNext = step.section === nextStep.section && !completed && !isComplete;
                  return (
                    <MockStepTile
                      key={step.title}
                      step={step}
                      index={index}
                      completed={completed}
                      isNext={isNext}
                      compact={isCompact || isTightMock}
                      mobile={mobileMock}
                      tight={isTightMock}
                      onPress={() => openStep(step)}
                    />
                  );
                })}
              </View>
            </View>
          </View>
        </View>
        <Modal transparent visible={Boolean(pendingRedoStep)} animationType="none" onRequestClose={() => setPendingRedoStep(null)}>
          <View style={[styles.modalShade, isCompact && styles.modalShadeCompact]}>
            <View style={[styles.modalCard, isCompact && styles.modalCardCompact, isCompact && { maxHeight: compactModalMaxHeight }]}>
              <Text style={[styles.modalTitle, isCompact && styles.modalTitleCompact]}>Redo this part?</Text>
              <Text style={[styles.modalText, isCompact && styles.modalTextCompact]}>
                You already completed {pendingRedoStep?.title}. The new result will replace the current score and update your Mini Mock estimate.
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setPendingRedoStep(null)} activeOpacity={0.84} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmRedoStep} activeOpacity={0.84} style={styles.modalRedoBtn}>
                  <Text style={styles.modalRedoText}>Redo Part</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
      <Modal transparent visible={challengeHelpOpen} animationType="none" onRequestClose={() => setChallengeHelpOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setChallengeHelpOpen(false)} style={[styles.modalShade, isCompact && styles.modalShadeCompact]}>
          <TouchableOpacity activeOpacity={1} onPress={(event) => event.stopPropagation()} style={[styles.mockHelpCard, isCompact && styles.mockHelpCardCompact, isCompact && { maxHeight: compactModalMaxHeight }]}>
            <View style={styles.mockHelpTop}>
              <View>
                <Text style={[styles.mockHelpKicker, isCompact && styles.mockHelpKickerCompact]}>Mini Mock ladder</Text>
                <Text style={[styles.mockHelpTitle, isCompact && styles.mockHelpTitleCompact]}>A 5 is a checkpoint.</Text>
              </View>
              <TouchableOpacity onPress={() => setChallengeHelpOpen(false)} style={styles.mockHelpClose} accessibilityLabel="Close Mini Mock explanation">
                <XIcon size={18} color={Colors.textMuted} strokeWidth={2.3} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.mockHelpBody, isCompact && styles.mockHelpBodyCompact]}>
              Mini Mock is AP-shaped, but Kibbo does not treat one good run as the finish. A strong result unlocks harder pressure, then your daily plan and personalized drills use that evidence to push you into higher levels.
            </Text>
            <View style={styles.mockHelpRows}>
              <View style={styles.mockHelpRow}>
                <Text style={styles.mockHelpRowTitle}>Level signal</Text>
                <Text style={styles.mockHelpRowText}>Early mocks check whether the AP format is right for your current level.</Text>
              </View>
              <View style={styles.mockHelpRow}>
                <Text style={styles.mockHelpRowTitle}>AP estimate</Text>
                <Text style={styles.mockHelpRowText}>At Level {AP_READY_LEVEL}, the label becomes an AP estimate because the content should be AP-ready.</Text>
              </View>
              <View style={styles.mockHelpRow}>
                <Text style={styles.mockHelpRowTitle}>5-proof</Text>
                <Text style={styles.mockHelpRowText}>A Mini Mock 5 unlocks tougher traps, denser evidence, stricter register, and consistency pressure.</Text>
              </View>
              <View style={styles.mockHelpRow}>
                <Text style={styles.mockHelpRowTitle}>Consistency</Text>
                <Text style={styles.mockHelpRowText}>Consistency keeps raising the pressure and pairs each mock with daily weak-spot drills.</Text>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <CreditStartNotice
        visible={Boolean(creditNotice)}
        title={creditNotice ? `${creditNotice.step.title} Mini Mock part` : 'Start Mini Mock part?'}
        subtitle="This part updates your AP readiness estimate and rubric weak-spot profile."
        cost={CREDIT_COSTS.drill}
        usage={creditNotice?.usage ?? null}
        plan={creditNotice?.plan ?? null}
        onClose={() => setCreditNotice(null)}
        onStart={confirmStepStart}
        onComparePlans={() => setOpenSubscriptionsSignal((value) => value + 1)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingTop: 18, paddingBottom: 28, width: '100%', alignSelf: 'center' },
  scrollCompact: { paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 158 },
  scrollTight: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  scrollTightMobile: {
    paddingTop: 6,
    paddingBottom: 158,
  },
  scrollMockMobile: {
    paddingTop: 4,
    paddingBottom: 132,
  },
  pageShell: {
    width: '100%',
    maxWidth: 1500,
    alignSelf: 'center',
  },
  pageShellCompact: { gap: 0 },
  mockContentGrid: {
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 22,
    marginTop: 30,
  },
  mockContentGridDesktopNudge: {
    transform: [{ translateX: -42 }],
  },
  mockContentGridCompact: {
    minHeight: 0,
    flexDirection: 'column',
    gap: 10,
    marginTop: 10,
  },
  mockContentGridTight: {
    flexDirection: 'column',
    gap: 9,
    marginTop: 10,
    transform: [{ translateX: 0 }],
  },
  mockContentGridMobile: {
    gap: 8,
    marginTop: 8,
  },
  mockSummaryPanel: {
    flex: 1.1,
    minWidth: 0,
    gap: 14,
  },
  mockSummaryPanelCompact: {
    gap: 10,
  },
  mockSummaryPanelTight: {
    width: '100%',
    gap: 9,
  },
  mockSummaryPanelMobile: {
    gap: 8,
  },
  mockPartsPanel: {
    flex: 0.82,
    minWidth: 390,
    borderRadius: 28,
    backgroundColor: Colors.ink,
    padding: 16,
    gap: 11,
    shadowColor: Colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  mockPartsPanelCompact: {
    minWidth: 0,
    borderRadius: 22,
    padding: 13,
  },
  mockPartsPanelTight: {
    flexBasis: 'auto',
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    borderRadius: 22,
    padding: 14,
    gap: 10,
  },
  mockPartsPanelMobile: {
    backgroundColor: '#FFFFFFF4',
    borderWidth: 1,
    borderColor: '#D8E5EE',
    borderRadius: 20,
    padding: 10,
    gap: 8,
    shadowColor: Colors.ink,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  mockPartsHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mockPartsHeaderTight: {
    minHeight: 36,
    alignItems: 'center',
  },
  mockPartsHeaderMobile: {
    minHeight: 30,
  },
  mockPartsKicker: {
    color: Colors.teal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  mockPartsKickerTight: {
    fontSize: 10,
    lineHeight: 13,
  },
  mockPartsKickerMobile: {
    color: Colors.secondary,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.5,
  },
  mockPartsTitle: {
    color: Colors.onPrimary,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  mockPartsTitleTight: {
    fontSize: 24,
    lineHeight: 28,
  },
  mockPartsTitleMobile: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 25,
  },
  mockPartsDonePill: {
    minHeight: 38,
    borderRadius: 16,
    backgroundColor: '#FFFFFF14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  mockPartsDonePillTight: {
    minHeight: 32,
    borderRadius: 13,
    paddingHorizontal: 11,
  },
  mockPartsDonePillMobile: {
    minHeight: 28,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
  },
  mockPartsDoneText: {
    color: Colors.onPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  mockPartsDoneTextTight: {
    fontSize: 13,
    lineHeight: 16,
  },
  mockPartsDoneTextMobile: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 15,
  },
  mockHeroRow: {
    minHeight: 132,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 18,
  },
  mockHeroRowCompact: {
    minHeight: 0,
    flexDirection: 'column',
    gap: 12,
  },
  mockIntro: {
    minWidth: 0,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFD9',
    padding: 22,
    gap: 5,
    shadowColor: Colors.ink,
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  mockIntroTight: {
    borderRadius: 20,
    padding: 13,
    gap: 2,
  },
  mockIntroMobile: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 1,
    backgroundColor: '#FFFFFFF2',
    shadowOpacity: 0.025,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  mockReadinessCard: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D8E5EE',
    backgroundColor: '#FFFFFFF2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 18,
    shadowColor: Colors.ink,
    shadowOpacity: 0.055,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  mockReadinessCardCompact: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: 20,
    padding: 12,
    gap: 10,
  },
  mockReadinessCardTight: {
    borderRadius: 20,
    padding: 11,
    gap: 10,
  },
  mockReadinessCardMobile: {
    borderRadius: 18,
    padding: 9,
    gap: 8,
    backgroundColor: '#FFFFFFF5',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  mockReadinessCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  mockReadinessCopyMobile: {
    gap: 2,
  },
  mockReadinessState: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  mockReadinessStateTight: {
    fontSize: 24,
    lineHeight: 28,
  },
  mockReadinessStateMobile: {
    fontSize: 20,
    lineHeight: 23,
  },
  mockReadinessMeta: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  mockReadinessMetaTight: {
    fontSize: 12,
    lineHeight: 15,
  },
  mockReadinessMetaMobile: {
    fontSize: 11,
    lineHeight: 14,
  },
  mockEstimateBox: {
    minWidth: 144,
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: '#DDE8F1',
    borderLeftColor: Colors.primary,
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 15,
    paddingVertical: 13,
    gap: 3,
    shadowColor: Colors.primary,
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  mockEstimateBoxTight: {
    minWidth: 126,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  mockEstimateBoxMobile: {
    minWidth: 104,
    borderRadius: 15,
    borderLeftWidth: 1,
    borderLeftColor: '#DDE8F1',
    backgroundColor: '#F8FBFD',
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 1,
    shadowOpacity: 0.015,
    shadowRadius: 8,
  },
  mockEstimateTop: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  mockEstimateLabel: {
    color: Colors.primary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  mockEstimateLabelTight: {
    fontSize: 9,
    lineHeight: 12,
  },
  mockEstimateLabelMobile: {
    color: Colors.primary,
    fontSize: 8,
    lineHeight: 11,
    letterSpacing: 1.2,
  },
  mockEstimateValue: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  mockEstimateValueTight: {
    fontSize: 19,
    lineHeight: 23,
  },
  mockEstimateValueMobile: {
    fontSize: 17,
    lineHeight: 20,
  },
  mockEstimateMeta: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  mockEstimateMetaTight: {
    fontSize: 11,
    lineHeight: 14,
  },
  mockEstimateMetaMobile: {
    fontSize: 10,
    lineHeight: 13,
  },
  mockActionRow: {
    minHeight: 112,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFFE8',
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    shadowColor: Colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
  },
  mockChallengePanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#BEE8E5',
    backgroundColor: Colors.secondaryDim,
    padding: 14,
    gap: 11,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  mockChallengePanelCompact: {
    borderRadius: 20,
    padding: 12,
  },
  mockChallengePanelTight: {
    borderRadius: 20,
    padding: 10,
    gap: 8,
  },
  mockChallengePanelMobile: {
    borderRadius: 18,
    padding: 9,
    gap: 7,
    borderColor: '#CFEAE7',
    backgroundColor: '#F7FCFB',
    shadowOpacity: 0.025,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  mockChallengeTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mockChallengeTopMobile: {
    minHeight: 32,
    gap: 8,
  },
  mockChallengeCopy: {
    flex: 1,
    minWidth: 0,
  },
  mockChallengeCopyMobile: {
    gap: 0,
  },
  mockChallengeKicker: {
    color: Colors.secondary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  mockChallengeKickerTight: {
    fontSize: 10,
    lineHeight: 13,
  },
  mockChallengeKickerMobile: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.5,
  },
  mockChallengeTitle: {
    marginTop: 2,
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  mockChallengeTitleTight: {
    fontSize: 21,
    lineHeight: 25,
  },
  mockChallengeTitleMobile: {
    fontSize: 19,
    lineHeight: 23,
  },
  mockChallengeHelp: {
    width: 40,
    height: 40,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1FFFD',
    borderWidth: 1,
    borderColor: '#9EE2DD',
    shadowColor: Colors.teal,
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  mockChallengeHelpTight: {
    width: 34,
    height: 34,
    borderRadius: 14,
  },
  mockChallengeHelpMobile: {
    width: 31,
    height: 31,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  mockChallengeHelpText: {
    color: Colors.teal,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  mockChallengeHelpTextTight: {
    fontSize: 15,
    lineHeight: 18,
  },
  mockChallengeHelpTextMobile: {
    fontSize: 14,
    lineHeight: 17,
  },
  mockTierRail: {
    flexDirection: 'row',
    gap: 8,
  },
  mockTierRailCompact: {
    flexWrap: 'wrap',
  },
  mockTierRailTight: {
    gap: 6,
  },
  mockTierRailMobile: {
    flexWrap: 'nowrap',
    gap: 5,
  },
  mockTierStep: {
    flex: 1,
    minWidth: 94,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFFA8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  mockTierStepTight: {
    minWidth: 0,
    minHeight: 40,
    borderRadius: 14,
    gap: 5,
    paddingHorizontal: 8,
  },
  mockTierStepMobile: {
    minHeight: 34,
    borderRadius: 12,
    gap: 4,
    paddingHorizontal: 6,
  },
  mockTierStepUnlocked: {
    borderColor: '#BEE8E5',
    backgroundColor: '#FFFFFFEA',
  },
  mockTierStepActive: {
    borderColor: Colors.secondary,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  mockTierNumber: {
    width: 24,
    height: 24,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
    overflow: 'hidden',
  },
  mockTierNumberTight: {
    width: 21,
    height: 21,
    borderRadius: 9,
    fontSize: 12,
    lineHeight: 21,
  },
  mockTierNumberMobile: {
    width: 20,
    height: 20,
    borderRadius: 8,
    fontSize: 11,
    lineHeight: 20,
  },
  mockTierNumberUnlocked: {
    backgroundColor: Colors.secondary,
    color: Colors.onPrimary,
  },
  mockTierLabel: {
    flex: 1,
    minWidth: 0,
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  mockTierLabelTight: {
    fontSize: 11,
    lineHeight: 14,
  },
  mockTierLabelMobile: {
    fontSize: 10,
    lineHeight: 13,
  },
  mockTierLabelUnlocked: {
    color: Colors.text,
  },
  mockChallengeText: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  mockActionRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 9,
  },
  mockActionRowTight: {
    minHeight: 0,
    borderRadius: 18,
    gap: 0,
    padding: 8,
  },
  mockActionRowMobile: {
    borderRadius: 18,
    padding: 7,
    backgroundColor: '#FFFFFFE8',
    shadowOpacity: 0.025,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  mockActionCopy: {
    minWidth: 0,
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  header: {
    gap: 8,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFF2',
    padding: 24,
    shadowColor: Colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  headerCompact: { gap: 12 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTopCompact: {
    justifyContent: 'flex-end',
    minHeight: 40,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    marginBottom: 4,
  },
  headerIconCompact: {
    display: 'none',
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  switchBtnCompact: {
    paddingHorizontal: 11,
  },
  switchText: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  kicker: { color: Colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  kickerMobile: { fontSize: 10, lineHeight: 13, letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 40, lineHeight: 45, fontWeight: '900' },
  titleCompact: { fontSize: 36, lineHeight: 40 },
  titleTight: { fontSize: 32, lineHeight: 36 },
  titleMobile: { fontSize: 28, lineHeight: 31 },
  subtitle: { color: Colors.textSub, fontSize: 15, lineHeight: 21, fontWeight: '600', maxWidth: 660 },
  subtitleCompact: { fontSize: 13, lineHeight: 18, maxWidth: 340 },
  subtitleTight: { fontSize: 12, lineHeight: 16, maxWidth: 560 },
  subtitleMobile: { fontSize: 11, lineHeight: 14, fontWeight: '700', maxWidth: '100%' },
  scoreCard: {
    backgroundColor: '#FFFFFFF2',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 24,
    gap: 12,
    shadowColor: Colors.ink,
    shadowOpacity: 0.065,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  scoreCardCompact: { padding: 14, borderRadius: 22, gap: 7 },
  mobileMockStats: {
    flexDirection: 'row',
    gap: 10,
  },
  mobileMockStat: {
    width: '48%',
    minHeight: 116,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 13,
    paddingVertical: 16,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  mobileMockStatTop: {
    minHeight: 34,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  mobileMockStatLabel: {
    color: Colors.textSub,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    textAlign: 'center',
    alignSelf: 'center',
  },
  mobileMockStatValue: {
    color: Colors.text,
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '900',
    textAlign: 'center',
  },
  mobileMockStatMeta: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  readinessLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 18,
  },
  readinessLayoutCompact: {
    gap: 10,
  },
  readinessBody: { flex: 1, minWidth: 0, gap: 8 },
  readinessLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readinessLine: { width: 28, height: 1.5, backgroundColor: Colors.borderBright },
  partsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  partsCount: { color: Colors.text, fontSize: 30, lineHeight: 34, fontWeight: '900' },
  partsCountCompact: { fontSize: 42, lineHeight: 46 },
  partsText: { color: Colors.textSub, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  partsTextCompact: { fontSize: 20, lineHeight: 28 },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.surface,
  },
  statusPillActive: {
    backgroundColor: Colors.primaryDim,
  },
  statusText: { color: Colors.textSub, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  statusTextActive: { color: Colors.primary },
  statusTextCompact: { fontSize: 15, lineHeight: 19 },
  ringWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  readinessDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  readinessCopy: { color: Colors.textSub, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  readinessCopyCompact: { fontSize: 14, lineHeight: 20 },
  primaryAction: {
    alignSelf: 'flex-start',
    minWidth: 360,
    maxWidth: 520,
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 5,
    borderColor: Colors.ink,
    borderBottomColor: '#071120',
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginTop: 4,
    shadowColor: Colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
  },
  primaryActionHover: {
    backgroundColor: '#14243A',
    borderColor: '#14243A',
    borderBottomColor: '#071120',
    shadowOpacity: 0.24,
    shadowRadius: 20,
  },
  primaryActionPress: {
    shadowOpacity: 0.12,
  },
  primaryActionCompact: {
    minHeight: 64,
  },
  primaryActionBoard: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    minHeight: 54,
    borderRadius: 18,
    marginTop: 0,
    flexShrink: 0,
  },
  primaryActionBoardCompact: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
  },
  primaryActionBoardTight: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  primaryActionMobile: {
    minHeight: 49,
    borderRadius: 15,
    borderColor: '#CFEAE7',
    borderBottomColor: '#9FDDD7',
    borderBottomWidth: 3,
    backgroundColor: '#FFFFFFFA',
    gap: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
    shadowColor: Colors.teal,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  primaryActionHoverMobile: {
    backgroundColor: '#F5FCFB',
    borderColor: Colors.teal,
    borderBottomColor: '#85D5CE',
    shadowOpacity: 0.13,
    shadowRadius: 14,
  },
  primaryActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  primaryActionIconTight: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  primaryActionIconMobile: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: Colors.tealDim,
    borderWidth: 1,
    borderColor: '#C9EDE9',
  },
  primaryActionIconHover: {
    backgroundColor: '#F7FAFC',
  },
  primaryActionCopy: { flex: 1, minWidth: 0 },
  primaryActionLabel: {
    color: Colors.onPrimaryMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  primaryActionLabelTight: {
    fontSize: 9,
    letterSpacing: 1.3,
  },
  primaryActionLabelMobile: {
    color: Colors.secondary,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
  },
  primaryActionTitle: {
    color: Colors.onPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  primaryActionTitleTight: {
    fontSize: 16,
    lineHeight: 19,
  },
  primaryActionTitleMobile: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 21,
  },
  primaryActionArrow: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionArrowMobile: {
    width: 31,
    height: 31,
    borderRadius: 12,
    backgroundColor: Colors.ink,
  },
  resetFullBtn: {
    flex: 1,
    minWidth: 140,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    marginTop: 6,
  },
  completeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  completeActionsCompact: { flexDirection: 'column' },
  redoBtn: {
    flex: 1,
    minWidth: 150,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  redoText: { color: Colors.gold, fontSize: 14, fontWeight: '900' },
  resetFullText: { color: Colors.text, fontSize: 14, fontWeight: '900' },
  scoreTitle: { color: Colors.textSub, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.2 },
  scoreTitleTight: { fontSize: 10, letterSpacing: 1.7 },
  scoreTitleMobile: { fontSize: 9, lineHeight: 12, letterSpacing: 1.5 },
  steps: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    gap: 10,
  },
  stepsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepsTight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stepsMobile: {
    gap: 8,
  },
  stepPressable: {
    width: '100%',
    flexGrow: 0,
    minWidth: 0,
  },
  stepPressableCompact: {
    width: '48%',
    flexGrow: 1,
  },
  stepPressableMobile: {
    width: '48%',
  },
  stepCard: {
    width: '100%',
    minWidth: 0,
    height: 70,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    padding: 10,
    shadowColor: Colors.ink,
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  stepCardHover: {
    borderColor: '#92DCD6',
    backgroundColor: '#FBFEFD',
    shadowOpacity: 0.09,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 11 },
  },
  stepCardPress: {
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  stepCardDone: {
    borderColor: '#BEE8E5',
    backgroundColor: '#F4FCFB',
    shadowColor: Colors.ink,
    shadowOpacity: 0.04,
  },
  stepCardNext: {
    borderColor: Colors.teal,
    backgroundColor: '#F7FEFC',
  },
  stepCardDoneCompact: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.055,
  },
  stepCardCompact: {
    height: 62,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 19,
    shadowOpacity: 0.035,
    shadowRadius: 10,
  },
  stepCardTight: {
    height: 64,
    minHeight: 64,
    borderRadius: 17,
    padding: 9,
    gap: 9,
  },
  stepCardMobile: {
    height: 58,
    minHeight: 58,
    borderRadius: 16,
    borderColor: '#DDE8F1',
    backgroundColor: '#FFFFFF',
    padding: 8,
    gap: 7,
    shadowOpacity: 0.025,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  stepCardNextCompact: {
    backgroundColor: Colors.card,
    borderColor: Colors.teal,
    borderWidth: 1,
  },
  stepCardNextMobile: {
    backgroundColor: '#F7FEFC',
    borderColor: Colors.teal,
  },
  stepCardDoneMobile: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8F1',
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconIdle: {
    backgroundColor: Colors.surface,
  },
  stepIconNext: {
    backgroundColor: Colors.tealDim,
    borderWidth: 1,
    borderColor: '#BEE8E5',
  },
  stepIconHover: {
    backgroundColor: '#E6F7F5',
  },
  stepIconCompact: {
    width: 36,
    height: 36,
    borderRadius: 15,
  },
  stepIconTight: {
    width: 34,
    height: 34,
    borderRadius: 13,
  },
  stepIconMobile: {
    width: 33,
    height: 33,
    borderRadius: 13,
  },
  stepIconDone: {
    backgroundColor: Colors.teal,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  stepIconDoneCompact: {
    backgroundColor: Colors.primaryDim,
  },
  stepIconDoneMobile: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
  },
  stepBody: { flex: 1, gap: 3, minWidth: 0 },
  stepBodyCompact: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepBodyTight: {
    gap: 1,
  },
  stepBodyMobile: {
    gap: 0,
  },
  stepIndex: { color: Colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  stepIndexCompact: { fontSize: 9, letterSpacing: 1.4, textAlign: 'left' },
  stepIndexTight: { fontSize: 8, lineHeight: 11, letterSpacing: 1.2 },
  stepIndexMobile: { fontSize: 8, lineHeight: 10, letterSpacing: 1.1 },
  stepIndexDone: { color: Colors.textMuted },
  stepIndexDoneCompact: { color: Colors.primary },
  stepTitle: { color: Colors.text, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  stepTitleCompact: { fontSize: 15, lineHeight: 18, fontFamily: undefined, fontWeight: '900', textAlign: 'left' },
  stepTitleTight: { fontSize: 13, lineHeight: 16 },
  stepTitleMobile: { fontSize: 13, lineHeight: 16 },
  stepTitleDone: { color: Colors.text },
  stepTitleDoneCompact: { color: Colors.text },
  stepChevron: {
    width: 30,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.72,
  },
  modalShade: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 32, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalShadeCompact: {
    paddingHorizontal: 14,
    paddingTop: 46,
    paddingBottom: 46,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 22,
    gap: 14,
  },
  modalCardCompact: {
    maxWidth: 390,
    borderRadius: 24,
    padding: 14,
    gap: 9,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  modalTitleCompact: {
    fontSize: 24,
    lineHeight: 29,
  },
  modalText: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 22,
  },
  modalTextCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { color: Colors.textSub, fontSize: 14, fontWeight: '900' },
  modalRedoBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRedoText: { color: Colors.onPrimary, fontSize: 14, fontWeight: '900' },
  mockHelpCard: {
    width: '92%',
    maxWidth: 600,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    padding: 22,
    gap: 14,
    shadowColor: Colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  mockHelpCardCompact: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 24,
    padding: 14,
    gap: 9,
  },
  mockHelpTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  mockHelpKicker: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  mockHelpKickerCompact: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
  },
  mockHelpTitle: {
    marginTop: 3,
    color: Colors.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  mockHelpTitleCompact: {
    fontSize: 25,
    lineHeight: 29,
  },
  mockHelpClose: {
    width: 42,
    height: 42,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  mockHelpBody: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  mockHelpBodyCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  mockHelpRows: {
    gap: 10,
  },
  mockHelpRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 13,
  },
  mockHelpRowTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  mockHelpRowText: {
    marginTop: 4,
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
