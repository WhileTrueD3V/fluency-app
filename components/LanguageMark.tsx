import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import type { LanguageCode } from '@/constants/languages';

const MARK_CONFIG: Record<LanguageCode, { glyph: string; color: string; bg: string }> = {
  ja: { glyph: '日', color: Colors.japanese, bg: Colors.japaneseDim },
  zh: { glyph: '中', color: Colors.mandarin, bg: Colors.mandarinDim },
  es: { glyph: 'Ñ', color: Colors.spanish, bg: Colors.spanishDim },
};

interface LanguageMarkProps {
  code: LanguageCode;
  size?: 'sm' | 'md' | 'lg';
  glyph?: string;
}

export function LanguageMark({ code, size = 'md', glyph }: LanguageMarkProps) {
  const config = MARK_CONFIG[code];
  const boxSize = size === 'lg' ? 82 : size === 'sm' ? 38 : 66;
  const glyphSize = size === 'lg' ? 46 : size === 'sm' ? 21 : 36;
  const sunSize = Math.round(boxSize * 0.44);

  if (code === 'ja') {
    return (
      <View
        style={[
          styles.mark,
          styles.flagMark,
          {
            width: boxSize,
            height: boxSize,
            borderRadius: Math.round(boxSize * 0.24),
          },
        ]}
      >
        <View
          style={[
            styles.japanSun,
            {
              width: sunSize,
              height: sunSize,
              borderRadius: Math.round(sunSize / 2),
            },
          ]}
        />
      </View>
    );
  }

  if (code === 'zh') {
    return (
      <View
        style={[
          styles.mark,
          styles.chinaFlag,
          {
            width: boxSize,
            height: boxSize,
            borderRadius: Math.round(boxSize * 0.24),
          },
        ]}
      >
        <Text style={[styles.chinaStar, { fontSize: Math.round(glyphSize * 0.56), lineHeight: Math.round(glyphSize * 0.7) }]}>★</Text>
      </View>
    );
  }

  if (code === 'es') {
    return (
      <View
        style={[
          styles.mark,
          styles.spainFlag,
          {
            width: boxSize,
            height: boxSize,
            borderRadius: Math.round(boxSize * 0.24),
          },
        ]}
      >
        <View style={styles.spainStripeRedTop} />
        <View style={styles.spainStripeGold} />
        <View style={styles.spainStripeRedBottom} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.mark,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: Math.round(boxSize * 0.24),
          borderColor: config.color,
          backgroundColor: config.color,
        },
      ]}
    >
      <Text style={[styles.glyph, { color: '#FFFFFF', fontSize: glyphSize, lineHeight: glyphSize + 6 }]}>
        {glyph ?? config.glyph}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  flagMark: {
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  japanSun: {
    backgroundColor: Colors.japanese,
  },
  chinaFlag: {
    backgroundColor: '#D94734',
    overflow: 'hidden',
  },
  chinaStar: {
    position: 'absolute',
    left: '22%',
    top: '18%',
    color: '#F6C247',
    fontWeight: '900',
  },
  spainFlag: {
    overflow: 'hidden',
    backgroundColor: '#F6C247',
  },
  spainStripeRedTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '27%',
    backgroundColor: '#D94734',
  },
  spainStripeGold: {
    position: 'absolute',
    top: '27%',
    left: 0,
    right: 0,
    height: '46%',
    backgroundColor: '#F6C247',
  },
  spainStripeRedBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '27%',
    backgroundColor: '#D94734',
  },
  glyph: {
    fontWeight: '300',
  },
});
