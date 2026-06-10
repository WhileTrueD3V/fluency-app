import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { StarIcon } from '@/components/Icons';

export function XpBurst({
  xp,
  opacity,
  translateY,
  scale,
}: {
  xp: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
  scale: Animated.Value;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <View style={styles.glow} />
      <View style={styles.card}>
        <View style={styles.sparkLeft} />
        <View style={styles.sparkRight} />
        <View style={styles.topRow}>
          <StarIcon size={13} color={Colors.gold} />
          <Text style={styles.kicker}>XP GAIN</Text>
        </View>
        <Text style={styles.value}>+{xp} XP</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 68,
    right: 18,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.goldDim,
    opacity: 0.95,
  },
  card: {
    minWidth: 96,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#16110A',
    borderWidth: 1,
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kicker: {
    color: '#FCD34D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  value: {
    color: '#FFF8E1',
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
  },
  sparkLeft: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FCD34D',
    opacity: 0.95,
  },
  sparkRight: {
    position: 'absolute',
    right: 10,
    bottom: 12,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FBBF24',
    opacity: 0.9,
  },
});
