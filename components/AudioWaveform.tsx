import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '@/constants/colors';

interface AudioWaveformProps {
  isPlaying: boolean;
  color?: string;
  barCount?: number;
}

export function AudioWaveform({
  isPlaying,
  color = Colors.listening,
  barCount = 7,
}: AudioWaveformProps) {
  const anims = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.25)),
  ).current;

  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (isPlaying) {
      loopsRef.current = anims.map((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(i * 80),
            Animated.timing(anim, {
              toValue: 0.9 + Math.random() * 0.1,
              duration: 350 + i * 40,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.2,
              duration: 300 + i * 40,
              useNativeDriver: true,
            }),
          ]),
        );
        loop.start();
        return loop;
      });
    } else {
      loopsRef.current.forEach((l) => l.stop());
      anims.forEach((anim) =>
        Animated.timing(anim, {
          toValue: 0.25,
          duration: 250,
          useNativeDriver: true,
        }).start(),
      );
    }

    return () => {
      loopsRef.current.forEach((l) => l.stop());
    };
  }, [isPlaying, anims]);

  return (
    <View style={styles.container}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 48,
  },
  bar: {
    width: 5,
    height: 40,
    borderRadius: 3,
  },
});
