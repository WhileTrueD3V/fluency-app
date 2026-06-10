import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '@/constants/colors';
import type { SpeakingResult } from '@/utils/scoring';
import { RankBadge } from '@/components/ui/Badge';

interface ScoreDisplayProps {
  result: SpeakingResult;
}

function ScoreMeter({ score }: { score: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 900,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, [score, anim]);

  const color = score >= 90
    ? Colors.gold
    : score >= 75
    ? Colors.natural
    : score >= 55
    ? Colors.functional
    : Colors.beginner;

  return (
    <View style={styles.meterContainer}>
      <View style={styles.meterTrack}>
        <Animated.View
          style={[
            styles.meterFill,
            {
              width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Animated.Text
        style={[styles.scoreNumber, { color }]}
      >
        {anim.interpolate({
          inputRange: [0, 100],
          outputRange: ['0', '100'],
        }).toString()}
      </Animated.Text>
    </View>
  );
}

function ComponentBar({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 700,
      delay: 400,
      useNativeDriver: false,
    }).start();
  }, [score, anim]);

  return (
    <View style={styles.componentRow}>
      <Text style={styles.componentLabel}>{label}</Text>
      <View style={styles.componentTrack}>
        <Animated.View
          style={[
            styles.componentFill,
            {
              width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={[styles.componentScore, { color }]}>{score}</Text>
    </View>
  );
}

export function ScoreDisplay({ result }: ScoreDisplayProps) {
  return (
    <View style={styles.container}>
      {/* Big score */}
      <View style={styles.scoreSection}>
        <Text style={styles.overallLabel}>Overall Score</Text>
        <Text style={styles.bigScore}>{result.score}</Text>
        <RankBadge rank={result.rank} size="lg" />
      </View>

      {/* Feedback */}
      <View style={styles.feedbackBox}>
        <Text style={styles.feedbackText}>{result.feedback}</Text>
      </View>

      {/* Component breakdown */}
      <View style={styles.components}>
        <ComponentBar
          label="Accuracy"
          score={result.accuracyScore}
          color={Colors.success}
        />
        <ComponentBar
          label="Naturalness"
          score={result.naturalnessScore}
          color={Colors.primary}
        />
        <ComponentBar
          label="Clarity"
          score={result.understandabilityScore}
          color={Colors.secondary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  scoreSection: {
    alignItems: 'center',
    gap: 12,
  },
  overallLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bigScore: {
    fontSize: 80,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -4,
    lineHeight: 88,
  },
  meterContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  meterTrack: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  feedbackText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  components: {
    gap: 14,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  componentLabel: {
    color: Colors.textSub,
    fontSize: 13,
    fontWeight: '500',
    width: 90,
  },
  componentTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  componentFill: {
    height: '100%',
    borderRadius: 3,
  },
  componentScore: {
    fontSize: 13,
    fontWeight: '700',
    width: 32,
    textAlign: 'right',
  },
});
