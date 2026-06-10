import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '@/constants/colors';

interface ProgressBarProps {
  progress: number; // 0–1
  color?: string;
  height?: number;
  animated?: boolean;
  trackColor?: string;
}

export function ProgressBar({
  progress,
  color = Colors.primary,
  height = 6,
  animated = true,
  trackColor = Colors.border,
}: ProgressBarProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(anim, {
        toValue: Math.min(Math.max(progress, 0), 1),
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      anim.setValue(Math.min(Math.max(progress, 0), 1));
    }
  }, [progress, animated, anim]);

  const widthPct = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            width: widthPct,
            backgroundColor: color,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fill: {
    height: '100%',
  },
});
