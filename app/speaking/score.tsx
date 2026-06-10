import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { RankBadge } from '@/components/ui/Badge';
import type { Rank } from '@/utils/scoring';

/** Standalone score screen — accepts result via query params for deep-link support. */
export default function ScoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    score: string;
    rank: string;
    feedback: string;
    accuracy: string;
    naturalness: string;
    clarity: string;
  }>();

  const score = parseInt(params.score ?? '0', 10);
  const rank = (params.rank ?? 'Beginner') as Rank;
  const feedback = params.feedback ?? '';
  const accuracy = parseInt(params.accuracy ?? '0', 10);
  const naturalness = parseInt(params.naturalness ?? '0', 10);
  const clarity = parseInt(params.clarity ?? '0', 10);
  const hasResult = params.score !== undefined;

  const scoreColor =
    score >= 90 ? Colors.gold
    : score >= 75 ? Colors.natural
    : score >= 55 ? Colors.secondary
    : Colors.beginner;

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.bgGlyph}>話</Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.replace('/(home)')} style={styles.back}>
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>

        <View style={styles.scoreSection}>
          <Text style={styles.label}>Speaking review</Text>
          <Text style={styles.title}>{hasResult ? 'Your score' : 'Ready for speaking'}</Text>
          <Text style={[styles.bigScore, { color: scoreColor }]}>{score}</Text>
          <RankBadge rank={rank} size="lg" />
        </View>

        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>
            {feedback || 'Complete a speaking drill to see translation accuracy, naturalness, and clarity feedback here.'}
          </Text>
        </View>

        <View style={styles.bars}>
          {[
            { label: 'Accuracy', value: accuracy, color: Colors.success },
            { label: 'Naturalness', value: naturalness, color: Colors.primary },
            { label: 'Clarity', value: clarity, color: Colors.secondary },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.barRow}>
              <Text style={styles.barLabel}>{label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${value}%`, backgroundColor: color }]} />
              </View>
              <Text style={[styles.barValue, { color }]}>{value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={() => router.replace('/speaking')} style={styles.againBtn}>
          <Text style={styles.againText}>Try Another</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(home)')} style={styles.homeBtn}>
          <Text style={styles.homeBtnText}>Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  bgGlyph: {
    position: 'absolute',
    right: -90,
    top: 52,
    fontSize: 470,
    color: Colors.bgGlyph,
    fontFamily: undefined,
  },
  scroll: {
    flexGrow: 1,
    padding: 32,
    gap: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    position: 'absolute',
    top: 24,
    left: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  backText: { color: Colors.textSub, fontSize: 13, fontWeight: '900' },
  scoreSection: { alignItems: 'center', gap: 12 },
  label: { color: Colors.primary, fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 5 },
  title: { color: Colors.text, fontSize: 48, lineHeight: 56, fontWeight: '900' },
  bigScore: { fontSize: 96, fontWeight: '900', lineHeight: 100 },
  feedbackBox: {
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 20,
    width: '100%',
  },
  feedbackText: { color: Colors.textSub, fontSize: 17, lineHeight: 25, textAlign: 'center', fontWeight: '700' },
  bars: { gap: 14, width: '100%', marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { color: Colors.textSub, fontSize: 13, fontWeight: '900', width: 96 },
  barTrack: { flex: 1, height: 7, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontSize: 13, fontWeight: '700', width: 32, textAlign: 'right' },
  againBtn: {
    backgroundColor: Colors.speaking, borderRadius: 28,
    minHeight: 62,
    width: '100%', alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.speaking, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12,
  },
  againText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  homeBtn: {
    backgroundColor: Colors.surface, borderRadius: 28,
    minHeight: 58,
    width: '100%', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderBright,
  },
  homeBtnText: { color: Colors.textSub, fontSize: 16, fontWeight: '900' },
});
