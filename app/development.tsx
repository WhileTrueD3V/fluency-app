import React, { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { ChartIcon, XIcon } from '@/components/Icons';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { useAppStorage } from '@/hooks/useAppStorage';
import { formatDevelopmentIndex, getBestSkill, getDevelopmentIndex } from '@/utils/learningSignals';
import { getSessionHistory, type SessionRecord } from '@/utils/storage';

const AP_JOURNEY_STAGES = [
  {
    title: 'Foundation',
    range: [1, 2, 3, 4, 5],
    body: 'Build the listening, reading, and response basics that make timed AP tasks less chaotic.',
  },
  {
    title: 'AP Builder',
    range: [6, 7, 8, 9, 10],
    body: 'Turn recognition into controlled answers with short passages, audio prompts, and speaking reps.',
  },
  {
    title: 'Exam Ready',
    range: [11, 12, 13, 14, 15],
    body: 'Practice under AP-like pressure: text chat, conversation turns, and mixed skill review.',
  },
  {
    title: 'Score Push',
    range: [16, 17, 18, 19, 20],
    body: 'Use rubric feedback and saved review to tighten weak skills before full mock runs.',
  },
  {
    title: 'Mastery',
    range: [21, 22, 23, 24, 25],
    body: 'Refine register, speed, and nuance so your responses feel confident and complete.',
  },
];

function JourneyStageCard({
  stage,
  active,
  completeCount,
}: {
  stage: (typeof AP_JOURNEY_STAGES)[0];
  active: boolean;
  completeCount: number;
}) {
  return (
    <TouchableOpacity activeOpacity={0.84} style={[styles.stageCard, active && styles.stageCardActive]}>
      <View style={styles.stageTop}>
        <Text style={styles.stageFlag}>⚑</Text>
        <Text style={styles.stageTitle}>{stage.title}</Text>
      </View>
      <View style={styles.stageDots}>
        {stage.range.map((level) => {
          const done = level <= completeCount;
          return (
            <View key={level} style={[styles.levelNode, done && styles.levelNodeDone, active && level === completeCount && styles.levelNodeCurrent]}>
              <Text style={[styles.levelNodeText, done && styles.levelNodeTextDone]}>{level}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.stageBody}>{stage.body}</Text>
    </TouchableOpacity>
  );
}

function averageScore(sessions: SessionRecord[]) {
  if (sessions.length === 0) return 0;
  return Math.round(sessions.reduce((sum, session) => sum + session.score, 0) / sessions.length);
}

function Graph({ sessions }: { sessions: SessionRecord[] }) {
  const ordered = sessions.slice(0, 9).reverse();
  const rawTrendValues = ordered.length >= 2
    ? ordered.slice(1).map((session, index) => {
      const previous = ordered[index];
      return Math.max(-1, Math.min(1, ((session.score - previous.score) / 100) * 3));
    })
    : [];
  const trendValues = rawTrendValues.length >= 2
    ? rawTrendValues
    : rawTrendValues.length === 1
      ? [rawTrendValues[0], rawTrendValues[0]]
      : [0, 0, 0, 0, 0];
  const width = 260;
  const height = 126;
  const padX = 16;
  const padY = 18;
  const chartWidth = width - padX * 2;
  const chartHeight = height - padY * 2;
  const points = trendValues.map((value, index) => {
    const x = trendValues.length === 1
      ? width / 2
      : padX + (index / (trendValues.length - 1)) * chartWidth;
    const y = padY + (1 - ((value + 1) / 2)) * chartHeight;
    return { x, y };
  });
  const pointsString = points.map((point) => `${point.x},${point.y}`).join(' ');
  const baselineY = padY + chartHeight / 2;

  return (
    <View style={styles.graph}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[-0.5, 0.5].map((level) => {
          const y = padY + (1 - ((level + 1) / 2)) * chartHeight;
          return (
            <Line
              key={`grid-${level}`}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke={Colors.border}
              strokeWidth={1}
              strokeDasharray="5 5"
            />
          );
        })}
        <Line
          x1={padX}
          x2={width - padX}
          y1={baselineY}
          y2={baselineY}
          stroke={Colors.textMuted}
          strokeWidth={1.5}
        />
        <Polyline
          points={pointsString}
          fill="none"
          stroke={Colors.primary}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 6 : 4.5}
            fill={Colors.card}
            stroke={Colors.primary}
            strokeWidth={3}
          />
        ))}
      </Svg>
      <View style={styles.graphLabels}>
        <Text style={styles.graphLabel}>Earlier</Text>
        <Text style={styles.graphLabel}>{ordered.length >= 2 ? 'Development trend' : 'No trend yet'}</Text>
        <Text style={styles.graphLabel}>Now</Text>
      </View>
    </View>
  );
}

export default function DevelopmentScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const { prefs } = useAppStorage();
  const langCode = prefs?.selectedLanguage ?? 'ja';
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      getSessionHistory().then((history) => {
        if (mounted) setSessions(history.filter((session) => session.languageCode === langCode));
      });
      return () => {
        mounted = false;
      };
    }, [langCode]),
  );

  const developmentIndex = getDevelopmentIndex(sessions, langCode);
  const recent = sessions.slice(0, 6);
  const previous = sessions.slice(6, 12);
  const recentAverage = averageScore(recent);
  const previousAverage = averageScore(previous);
  const bestSkill = getBestSkill(sessions, langCode);
  const leaveReport = () => router.replace('/');
  const trendLabel = developmentIndex > 0.05
    ? 'Improving'
    : developmentIndex < -0.05
      ? 'Needs attention'
      : 'Steady';
  const estimatedLevel = Math.max(1, Math.min(25, Math.ceil(Math.max(sessions.length, recentAverage / 4 || 1))));

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={[styles.bgGlyph, isCompact && styles.bgGlyphCompact]}>伸</Text>
      <ScrollView contentContainerStyle={[styles.scroll, isCompact && styles.scrollCompact]} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={leaveReport} style={styles.closeBtn} accessibilityLabel="Close development page">
            <XIcon size={20} color={Colors.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={leaveReport} style={styles.doneBtn} accessibilityLabel="Back to practice">
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.kicker}>Development</Text>
          <Text style={[styles.title, isCompact && styles.titleCompact]}>Growth report</Text>
          <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>
            A simple trend from recent AP practice compared with your earlier sessions.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <ChartIcon size={24} color={Colors.primary} strokeWidth={2.1} />
            </View>
            <Text style={styles.trendPill}>{trendLabel}</Text>
          </View>
          <Text style={styles.indexValue}>{formatDevelopmentIndex(developmentIndex)}</Text>
          <Text style={styles.indexLabel}>Development index</Text>
          <Graph sessions={sessions} />
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recentAverage || '--'}%</Text>
            <Text style={styles.statLabel}>Recent average</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{previous.length > 0 ? `${previousAverage}%` : '--'}</Text>
            <Text style={styles.statLabel}>Earlier average</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{bestSkill}</Text>
            <Text style={styles.statLabel}>Best skill</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sessions.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>

        <View style={styles.journeySection}>
          <View style={styles.journeyHeader}>
            <View>
              <Text style={styles.journeyKicker}>AP path</Text>
              <Text style={styles.journeyTitle}>Your mastery journey</Text>
            </View>
            <Text style={styles.journeyMeta}>Level {estimatedLevel}</Text>
          </View>
          <View style={styles.stageGrid}>
            {AP_JOURNEY_STAGES.map((stage) => {
              const min = stage.range[0];
              const max = stage.range[stage.range.length - 1];
              return (
                <JourneyStageCard
                  key={stage.title}
                  stage={stage}
                  active={estimatedLevel >= min && estimatedLevel <= max}
                  completeCount={estimatedLevel}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.explainCard}>
          <Text style={styles.explainTitle}>What this shows</Text>
          <Text style={styles.explainText}>
            Positive means your recent scores are trending above your earlier work. Zero means steady.
            Negative means recent sessions are slipping and the app should push review.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F7F3' },
  bgGlyph: {
    display: 'none',
  },
  bgGlyphCompact: { display: 'none' },
  scroll: {
    padding: 28,
    paddingBottom: 150,
    gap: 18,
    maxWidth: 1060,
    width: '100%',
    alignSelf: 'center',
  },
  scrollCompact: { paddingHorizontal: 24, paddingTop: 42, paddingBottom: 174, gap: 14 },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  doneBtn: {
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  doneText: {
    color: Colors.textSub,
    fontSize: 13,
    fontWeight: '900',
  },
  header: { gap: 6 },
  kicker: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#101820',
    fontSize: 46,
    lineHeight: 54,
    fontWeight: '900',
  },
  titleCompact: { fontSize: 38, lineHeight: 43 },
  subtitle: { color: Colors.textSub, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  subtitleCompact: { fontSize: 15, lineHeight: 22 },
  heroCard: {
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDim,
  },
  trendPill: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  indexValue: { color: Colors.text, fontSize: 46, lineHeight: 50, fontWeight: '900' },
  indexLabel: {
    color: Colors.textSub,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  graph: {
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 8,
  },
  graphLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  graphLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    minHeight: 88,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: 12,
  },
  statValue: { color: Colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  statLabel: {
    color: Colors.textSub,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  explainCard: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 6,
    marginBottom: 4,
  },
  explainTitle: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  explainText: { color: Colors.textSub, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  journeySection: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E0E6DD',
    backgroundColor: '#EEF5EF',
    padding: 22,
    gap: 18,
    overflow: 'hidden',
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  journeyKicker: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  journeyTitle: {
    color: '#101820',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  journeyMeta: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D3DCCF',
    backgroundColor: '#FFFFFF',
    color: '#101820',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '900',
  },
  stageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  stageCard: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 260,
    minHeight: 172,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E1E6ED',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
  },
  stageCardActive: {
    borderColor: '#F3BE32',
    borderWidth: 2,
  },
  stageTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageFlag: {
    color: '#101820',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  stageTitle: {
    color: '#263241',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  stageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  levelNode: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#D7DEE8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#B9C2D0',
  },
  levelNodeDone: {
    backgroundColor: '#FFC33D',
    borderColor: '#D69A16',
  },
  levelNodeCurrent: {
    shadowColor: '#D69A16',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  levelNodeText: {
    color: '#586273',
    fontSize: 13,
    fontWeight: '900',
  },
  levelNodeTextDone: {
    color: '#101820',
  },
  stageBody: {
    color: '#586273',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
