import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getLanguage, isLanguageAvailable, type LanguageCode } from '@/constants/languages';
import { APP_COMPACT_BREAKPOINT, DesktopSideRail, getDesktopContentInsets } from '@/components/AppFooterTabs';
import { KanjiBackdrop } from '@/components/KanjiBackdrop';
import { ChartIcon, ChevronRightIcon, CompassIcon, TrophyIcon, XIcon } from '@/components/Icons';
import { useAppStorage } from '@/hooks/useAppStorage';
import { getBestSkill, getDevelopmentIndex } from '@/utils/learningSignals';
import { getPlayerLevel } from '@/utils/progression';
import { getSessionHistory, type SessionRecord } from '@/utils/storage';

type RubricKey = 'Task completion' | 'Delivery' | 'Language use' | 'Cultural knowledge';

type RubricSignal = {
  key: RubricKey;
  short: string;
  score: number;
  pattern: string;
  accent: string;
  urgent?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreFromPercent(percent: number, fallback = 2.1) {
  if (!percent) return fallback;
  return clamp(1 + (percent / 100) * 4, 1, 5);
}

function rubricStageLabel(score: number) {
  if (score >= 4.25) return 'Strong';
  if (score >= 3.35) return 'Ready';
  if (score >= 2.35) return 'Building';
  return 'Needs work';
}

function shortSkillLabel(skill: string) {
  if (!skill || skill === 'None yet') return '--';
  if (skill.toLowerCase().includes('listening')) return 'LSN';
  if (skill.toLowerCase().includes('speaking')) return 'SPK';
  if (skill.toLowerCase().includes('reading')) return 'RDG';
  return skill.slice(0, 3).toUpperCase();
}

function dateKey(timestamp: number) {
  return new Date(timestamp).toDateString();
}

function getDevelopmentLabel(index: number) {
  if (index <= -0.45) return 'Detraining drastically';
  if (index < -0.12) return 'Detraining';
  if (index <= 0.12) return 'Static';
  if (index < 0.45) return 'Improving';
  return 'Improving drastically';
}

function formatAnalyticsDevelopmentIndex(index: number) {
  if (Math.abs(index) < 0.05) return '0';
  return `${index > 0 ? '+' : ''}${index.toFixed(1)}`;
}

function uniqueMockCount(sessions: SessionRecord[]) {
  return new Set(sessions.map((session) => session.mockId).filter(Boolean)).size;
}

function ReturnButton({ onPress }: { onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const lift = useRef(new Animated.Value(0)).current;
  const arrow = useRef(new Animated.Value(0)).current;
  const active = hovered || pressed;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(lift, {
        toValue: active ? 1 : 0,
        useNativeDriver: true,
        tension: 190,
        friction: 16,
      }),
      Animated.timing(arrow, {
        toValue: hovered ? 1 : 0,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, arrow, hovered, lift]);

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
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back to today's work"
    >
      <Animated.View
        style={[
          styles.returnButton,
          hovered && styles.returnButtonHover,
          pressed && styles.returnButtonPress,
          {
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, pressed ? 1 : -3] }) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, pressed ? 0.992 : 1.01] }) },
            ],
          },
        ]}
      >
        <Text style={styles.returnButtonText}>Back to today&apos;s work</Text>
        <Animated.View style={{ transform: [{ translateX: arrow.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }] }}>
          <ChevronRightIcon size={18} color={Colors.onPrimary} strokeWidth={2.8} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
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
      short: 'Completion',
      score: taskCompletion,
      pattern: accuracy < 70 ? 'Missed details are costing answer completion.' : 'Prompt coverage is becoming steadier.',
      accent: Colors.primary,
      urgent: sessions > 0 && accuracy < 70,
    },
    {
      key: 'Delivery',
      short: 'Delivery',
      score: delivery,
      pattern: bestSpeakingScore < 70 ? 'Speaking needs tighter pacing and fuller turns.' : 'Spoken responses are ready for harder timing.',
      accent: Colors.teal,
      urgent: sessions > 0 && bestSpeakingScore < 70,
    },
    {
      key: 'Language use',
      short: 'Language',
      score: languageUse,
      pattern: languageUse < 2.35 ? 'Sentence control and register need focused reps.' : 'Language control is supporting the AP task.',
      accent: Colors.ink,
      urgent: languageUse < 2.35,
    },
    {
      key: 'Cultural knowledge',
      short: 'Culture',
      score: culturalKnowledge + (developmentIndex > 0 ? 0.12 : 0),
      pattern: culturalKnowledge < 2.35 ? 'Cultural support needs more specific examples.' : 'Cultural detail is becoming usable evidence.',
      accent: Colors.gold,
    },
  ];
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < APP_COMPACT_BREAKPOINT;
  const desktopInsets = getDesktopContentInsets(width, { wideGap: 50, narrowGap: 18, right: 32 });
  const { prefs, stats } = useAppStorage();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const goHome = useCallback(() => {
    router.replace('/(home)');
  }, [router]);

  useFocusEffect(useCallback(() => {
    getSessionHistory().then(setSessions);
  }, []));

  const preferredLangCode = (prefs?.selectedLanguage ?? 'ja') as LanguageCode;
  const langCode = isLanguageAvailable(preferredLangCode) ? preferredLangCode : 'ja';
  const language = getLanguage(langCode);
  const languageStats = stats?.languageStats[langCode] ?? {
    totalSessions: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    bestStreak: 0,
    bestSpeakingScore: 0,
    totalXP: 0,
    currentStreak: 0,
    lastSessionDate: null,
  };
  const accuracy = languageStats.totalAnswered > 0
    ? Math.round((languageStats.totalCorrect / languageStats.totalAnswered) * 100)
    : 0;
  const languageSessions = useMemo(
    () => sessions.filter((session) => session.languageCode === langCode),
    [langCode, sessions],
  );
  const developmentIndex = getDevelopmentIndex(sessions, langCode);
  const developmentLabel = getDevelopmentLabel(developmentIndex);
  const playerLevel = getPlayerLevel(languageStats.totalXP);
  const bestSkill = shortSkillLabel(getBestSkill(sessions, langCode));
  const todayKey = new Date().toDateString();
  const todaySessions = useMemo(
    () => languageSessions.filter((session) => dateKey(session.date) === todayKey),
    [languageSessions, todayKey],
  );
  const activityCounts = useMemo(() => {
    const types = [
      { id: 'listening', label: 'Listening' },
      { id: 'speaking', label: 'Speaking' },
      { id: 'reading', label: 'Reading' },
      { id: 'conversation', label: 'Conversation' },
      { id: 'texting', label: 'Text chat' },
    ] as const;

    return [
      ...types.map((item) => ({
        ...item,
        total: languageSessions.filter((session) => session.type === item.id).length,
        today: todaySessions.filter((session) => session.type === item.id).length,
      })),
      {
        id: 'mock',
        label: 'Mini Mock',
        total: uniqueMockCount(languageSessions),
        today: uniqueMockCount(todaySessions),
      },
    ];
  }, [languageSessions, todaySessions]);
  const rubricSignals = buildRubricSignals({
    accuracy,
    sessions: languageStats.totalSessions,
    bestSpeakingScore: languageStats.bestSpeakingScore,
    developmentIndex,
  });
  const weakSignal = rubricSignals.slice().sort((a, b) => a.score - b.score)[0];

  return (
    <SafeAreaView style={styles.safe}>
      <KanjiBackdrop variant="home" compact={compact} />
      <DesktopSideRail />
      <ScrollView
        contentContainerStyle={[styles.scroll, !compact && desktopInsets, compact && styles.scrollCompact]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, compact && styles.contentCompact]}>
          <View style={styles.topBar}>
            <TouchableOpacity activeOpacity={0.82} onPress={goHome} style={styles.closeButton} accessibilityLabel="Back to home">
              <XIcon size={22} color={Colors.ink} strokeWidth={2.6} />
            </TouchableOpacity>
            <View style={styles.coursePill}>
              <Text style={styles.coursePillText}>{language.name} analytics</Text>
            </View>
          </View>

          <View style={[styles.hero, compact && styles.heroCompact]}>
            <View style={styles.heroIcon}>
              <ChartIcon size={25} color={Colors.onPrimary} strokeWidth={2.4} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>Rubric analytics</Text>
              <Text style={[styles.title, compact && styles.titleCompact]}>What Kibbo is watching</Text>
              <Text style={styles.subtitle}>A coach readout of the AP Japanese signals Kibbo uses to build your next work.</Text>
            </View>
            <View style={styles.xpPill}>
              <Text style={styles.xpValue}>{languageStats.totalXP}</Text>
              <Text style={styles.xpLabel}>XP</Text>
            </View>
          </View>

          <View style={[styles.metricGrid, compact && styles.metricGridCompact]}>
            <View style={[styles.metricTile, styles.metricTilePrimary]}>
              <Text style={styles.metricValue}>{accuracy}%</Text>
              <Text style={styles.metricLabel}>Accuracy</Text>
              <Text style={styles.metricNote}>answer signal</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{bestSkill}</Text>
              <Text style={styles.metricLabel}>Best skill</Text>
              <Text style={styles.metricNote}>rubric pattern</Text>
            </View>
            <View style={styles.metricTile}>
              <View style={styles.developmentMetricValueRow}>
                <Text style={styles.metricValueDevelopment} numberOfLines={2}>{developmentLabel}</Text>
                <Text style={styles.developmentMetricNumber}>{formatAnalyticsDevelopmentIndex(developmentIndex)}</Text>
              </View>
              <Text style={styles.metricLabel}>Development</Text>
              <Text style={styles.metricNote}>growth index on a -1 to 1 scale</Text>
            </View>
          </View>

          <View style={styles.activityPanel}>
              <View style={styles.activityPanelHeader}>
                <View>
                  <Text style={styles.detailKicker}>AP activity inventory</Text>
                  <Text style={styles.activityPanelTitle}>Practice mix</Text>
                </View>
                <Text style={styles.activityTodayPill}>Today: {todaySessions.length}</Text>
              </View>
              <View style={styles.activityRows}>
                {activityCounts.map((item) => (
                  <View key={item.id} style={styles.activityRow}>
                    <Text style={styles.activityName}>{item.label}</Text>
                    <View style={styles.activityCounts}>
                      <Text style={styles.activityCountText}>{item.total} total</Text>
                      <Text style={[styles.activityCountText, styles.activityTodayText]}>{item.today} today</Text>
                    </View>
                  </View>
                ))}
              </View>
          </View>

          <View style={[styles.rubricGrid, compact && styles.rubricGridCompact]}>
            {rubricSignals.map((signal) => {
              const isNextWeakSpot = signal.key === weakSignal.key;

              return (
                <View key={signal.key} style={[styles.rubricTile, isNextWeakSpot && styles.rubricTileNextWeak]}>
                  <View style={[styles.rubricAccent, isNextWeakSpot ? styles.rubricAccentNextWeak : styles.rubricAccentNeutral]} />
                  <Text style={styles.rubricValue}>{rubricStageLabel(signal.score)}</Text>
                  <Text style={styles.rubricLabel}>{signal.key}</Text>
                  <Text style={styles.rubricPattern}>{signal.pattern}</Text>
                </View>
              );
            })}
          </View>

          <View style={[styles.coachPanel, compact && styles.coachPanelCompact]}>
            <View style={styles.coachPanelIcon}>
              <CompassIcon size={22} color={Colors.primary} strokeWidth={2.4} />
            </View>
            <View style={styles.coachPanelCopy}>
              <Text style={styles.coachPanelKicker}>Next weak spot</Text>
              <Text style={styles.coachPanelTitle}>{weakSignal.key}</Text>
              <Text style={styles.coachPanelText}>{weakSignal.pattern}</Text>
            </View>
            <View style={styles.levelPill}>
              <TrophyIcon size={16} color={Colors.gold} strokeWidth={2.3} />
              <Text style={styles.levelPillText}>Level {playerLevel.level}</Text>
            </View>
          </View>

          <ReturnButton onPress={goHome} />

          <Text style={styles.footerNote}>
            Based on {languageSessions.length} saved AP attempt{languageSessions.length === 1 ? '' : 's'} for {language.nativeName}.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingVertical: 22,
  },
  scrollCompact: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 96,
  },
  content: {
    width: '100%',
    maxWidth: 1060,
    alignSelf: 'center',
    gap: 16,
  },
  contentCompact: {
    gap: 13,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coursePill: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  coursePillText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hero: {
    minHeight: 156,
    borderRadius: 30,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 24,
    shadowColor: Colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  heroCompact: {
    alignItems: 'flex-start',
    borderRadius: 26,
    padding: 18,
    gap: 13,
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.text,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
  },
  titleCompact: {
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    maxWidth: 640,
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  xpPill: {
    minHeight: 74,
    borderRadius: 24,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 20,
  },
  xpValue: {
    color: Colors.onPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  xpLabel: {
    color: Colors.onPrimaryMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 14,
  },
  metricGridCompact: {
    flexDirection: 'column',
  },
  metricTile: {
    flex: 1,
    minHeight: 124,
    borderRadius: 25,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    padding: 18,
  },
  metricTilePrimary: {
    backgroundColor: Colors.tealDim,
    borderColor: '#2FB9AE40',
  },
  metricValue: {
    color: Colors.text,
    fontSize: 42,
    lineHeight: 47,
    fontWeight: '900',
  },
  developmentMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  metricValueDevelopment: {
    flexShrink: 1,
    color: Colors.text,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
  },
  developmentMetricNumber: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  metricLabel: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricNote: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  detailKicker: {
    color: Colors.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  activityPanel: {
    minHeight: 244,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 15,
  },
  activityPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activityPanelTitle: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  activityTodayPill: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: Colors.tealDim,
    color: Colors.teal,
    fontSize: 12,
    lineHeight: 34,
    fontWeight: '800',
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  activityRows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activityRow: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 220,
    minHeight: 84,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    justifyContent: 'center',
    gap: 9,
    padding: 15,
  },
  activityName: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  activityCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityCountText: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  activityTodayText: {
    color: Colors.teal,
    fontWeight: '800',
  },
  rubricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  rubricGridCompact: {
    flexWrap: 'wrap',
  },
  rubricTile: {
    flex: 1,
    minHeight: 136,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 15,
    gap: 4,
  },
  rubricTileNextWeak: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primaryGlow,
  },
  rubricAccent: {
    width: 34,
    height: 5,
    borderRadius: 999,
    marginBottom: 3,
  },
  rubricAccentNeutral: {
    backgroundColor: Colors.gold,
  },
  rubricAccentNextWeak: {
    backgroundColor: Colors.primary,
  },
  rubricValue: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  rubricLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  rubricPattern: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  coachPanel: {
    minHeight: 112,
    borderRadius: 27,
    backgroundColor: '#FFFFFFE8',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 16,
  },
  coachPanelCompact: {
    alignItems: 'flex-start',
  },
  coachPanelIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachPanelCopy: {
    flex: 1,
    minWidth: 0,
  },
  coachPanelKicker: {
    color: Colors.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  coachPanelTitle: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  coachPanelText: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  levelPill: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: '#F6C24752',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
  },
  levelPillText: {
    color: Colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  returnButton: {
    alignSelf: 'flex-start',
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: Colors.ink,
    borderBottomWidth: 5,
    borderBottomColor: '#06101E',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 17,
  },
  returnButtonHover: {
    backgroundColor: '#17263C',
    borderBottomColor: '#08182B',
    shadowColor: Colors.ink,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  returnButtonPress: {
    borderBottomWidth: 2,
    shadowOpacity: 0.1,
  },
  returnButtonText: {
    color: Colors.onPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  footerNote: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
});
