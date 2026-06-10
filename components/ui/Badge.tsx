import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import type { Rank } from '@/utils/scoring';

interface BadgeProps {
  rank: Rank;
  size?: 'sm' | 'lg';
}

const rankConfig: Record<Rank, { color: string; bg: string; mark: string }> = {
  Beginner: { color: Colors.beginner, bg: Colors.border, mark: 'B' },
  Functional: { color: Colors.functional, bg: Colors.secondaryDim, mark: 'F' },
  Natural: { color: Colors.natural, bg: '#A78BFA22', mark: 'N' },
  'Native-like': { color: Colors.native, bg: Colors.goldDim, mark: 'A' },
};

export function RankBadge({ rank, size = 'sm' }: BadgeProps) {
  const config = rankConfig[rank];
  const isLarge = size === 'lg';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.color,
          paddingHorizontal: isLarge ? 20 : 12,
          paddingVertical: isLarge ? 10 : 5,
          borderRadius: isLarge ? 14 : 10,
        },
      ]}
    >
      <Text style={[styles.mark, { color: config.color, fontSize: isLarge ? 14 : 11 }]}>
        {config.mark}
      </Text>
      <Text
        style={[
          styles.text,
          { color: config.color, fontSize: isLarge ? 18 : 13 },
        ]}
      >
        {rank}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  mark: {
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
