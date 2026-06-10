import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { FlameIcon, StarIcon, TargetIcon } from '@/components/Icons';

/** Standalone summary — navigated to programmatically with params if needed. */
export default function ListeningSummary() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    correct: string;
    total: string;
    streak: string;
    xp: string;
  }>();

  const correct = parseInt(params.correct ?? '0', 10);
  const total = parseInt(params.total ?? '0', 10);
  const streak = parseInt(params.streak ?? '0', 10);
  const xp = parseInt(params.xp ?? '0', 10);
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const hasResult = total > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.bgGlyph}>聴</Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.replace('/(home)')} style={styles.backBtn}>
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>
        <View style={styles.summaryIcon}>
          <TargetIcon size={42} color={accuracy >= 70 ? Colors.success : Colors.listening} />
        </View>
        <Text style={styles.kicker}>AP Listening</Text>
        <Text style={styles.title}>{hasResult ? 'Session complete' : 'Ready for listening'}</Text>
        {!hasResult && (
          <Text style={styles.subtitle}>Complete a listening set to see accuracy, streak, and XP here.</Text>
        )}

        <View style={styles.grid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{correct}/{total}</Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{accuracy}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.valueRow}>
              <FlameIcon size={22} color={Colors.warning} />
              <Text style={[styles.statValue, { color: Colors.warning }]}>{streak}</Text>
            </View>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.valueRow}>
              <StarIcon size={22} color={Colors.gold} />
              <Text style={[styles.statValue, { color: Colors.gold }]}>{xp}</Text>
            </View>
            <Text style={styles.statLabel}>XP Earned</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.replace('/listening/session')}
          style={styles.againBtn}
        >
          <Text style={styles.againText}>Play Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/(home)')}
          style={styles.homeBtn}
        >
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 18,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
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
  summaryIcon: {
    width: 86,
    height: 86,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.listeningDim,
    borderWidth: 1,
    borderColor: Colors.listening,
  },
  kicker: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 48,
    lineHeight: 56,
    fontFamily: undefined,
    fontWeight: '400',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSub,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
    fontWeight: '700',
    maxWidth: 460,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, justifyContent: 'center', width: '100%', marginTop: 4,
  },
  statCard: {
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 18,
    alignItems: 'center',
    width: '45%',
    minHeight: 104,
    justifyContent: 'center',
    gap: 5,
  },
  statValue: { fontSize: 34, fontWeight: '900', color: Colors.text },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  againBtn: {
    backgroundColor: Colors.listening, borderRadius: 28,
    minHeight: 62, width: '100%', alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.listening, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12,
  },
  againText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  homeBtn: {
    backgroundColor: Colors.surface, borderRadius: 28,
    minHeight: 58, width: '100%', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderBright,
  },
  homeBtnText: { color: Colors.textSub, fontSize: 16, fontWeight: '900' },
});
