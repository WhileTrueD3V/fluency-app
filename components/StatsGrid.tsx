import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import type { AppStats } from '@/utils/storage';
import { FlameIcon, MicrophoneIcon, StarIcon, TargetIcon } from '@/components/Icons';

interface StatTileProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
}

function StatTile({ label, value, icon, accent }: StatTileProps) {
  return (
    <View style={[styles.tile, { borderColor: accent + '30' }]}>
      <View style={[styles.icon, { backgroundColor: accent + '16' }]}>{icon}</View>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function StatsGrid({ stats }: { stats: AppStats }) {
  const accuracy =
    stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
      : 0;

  return (
    <View style={styles.grid}>
      <StatTile icon={<FlameIcon size={18} color={Colors.warning} />} label="Streak" value={stats.currentStreak} accent={Colors.warning} />
      <StatTile icon={<StarIcon size={18} color={Colors.gold} />} label="XP" value={stats.totalXP.toLocaleString()} accent={Colors.gold} />
      <StatTile icon={<TargetIcon size={18} color={Colors.success} />} label="Accuracy" value={`${accuracy}%`} accent={Colors.success} />
      <StatTile
        icon={<MicrophoneIcon size={18} color={Colors.speaking} />}
        label="Best"
        value={stats.bestSpeakingScore > 0 ? stats.bestSpeakingScore : '—'}
        accent={Colors.speaking}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
