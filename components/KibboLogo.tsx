import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';

type KibboLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  stacked?: boolean;
  markOnly?: boolean;
  singleLine?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZE_MAP = {
  sm: { mark: 34, word: 18, line: 18, gap: 8 },
  md: { mark: 42, word: 22, line: 22, gap: 10 },
  lg: { mark: 54, word: 30, line: 30, gap: 13 },
};

export function KibboMark({ size = 42 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect x="4" y="4" width="56" height="56" rx="17" fill={Colors.primary} />
      <Path
        d="M18 16h10v13.2L41.5 16H54L38.4 31.1 55 48H42.1L28 34.1V48H18V16Z"
        fill="#FFF9ED"
      />
      <Circle cx="49" cy="16" r="5.6" fill={Colors.gold} />
      <Circle cx="14" cy="49" r="4.4" fill={Colors.teal} />
    </Svg>
  );
}

export function KibboLogo({ size = 'md', stacked = false, markOnly = false, singleLine = false, style }: KibboLogoProps) {
  const metrics = SIZE_MAP[size];

  if (markOnly) {
    return (
      <View style={style}>
        <KibboMark size={metrics.mark} />
      </View>
    );
  }

  return (
    <View style={[styles.lockup, stacked && styles.lockupStacked, { gap: metrics.gap }, style]}>
      <KibboMark size={metrics.mark} />
      <View style={[styles.wordBlock, singleLine && styles.wordBlockSingle]} accessibilityLabel="Kibbo">
        <Text style={[styles.wordLine, { fontSize: metrics.word, lineHeight: metrics.line }]}>
          <Text style={styles.wordInk}>KIB</Text>
          {singleLine && <Text style={styles.wordPrimary}>BO</Text>}
        </Text>
        {!singleLine && (
          <Text style={[styles.wordLine, styles.wordPrimary, { fontSize: metrics.word, lineHeight: metrics.line }]}>
            BO
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockupStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  wordBlock: {
    justifyContent: 'center',
  },
  wordBlockSingle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordLine: {
    fontWeight: '900',
    letterSpacing: 0,
  },
  wordInk: {
    color: Colors.ink,
  },
  wordPrimary: {
    color: Colors.primary,
    marginTop: -1,
  },
});
