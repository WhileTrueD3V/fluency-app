import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';
import { getFuriganaSegments } from '@/utils/furigana';

interface FuriganaTextProps {
  text: string;
  mode?: 'full' | 'partial' | 'minimal' | 'ap-support';
  compact?: boolean;
  textScale?: number;
  highlightText?: string | null;
  highlightStyle?: ViewStyle;
}

const AP_JAPANESE_KANJI = new Set([
  ...'日一国人年大十二本中長出三時行見月分後前生五間上東四今金九入学高円子外八六下来気小七山話女北午百書先名川千水半男西電校語土木聞食車何南万毎白天母火右読友左休父雨会同事自社発者地業方新場員立開手力問代明動京目通言理体田主題意不作用度強公持野以思家世多正安院心界教文元重近考画海売知道集別物使品計死特私始朝運終台広住真有口少町料工建空急止送切転研足究楽起着店病質待試族銀早映親験英医仕去味写字答夜音注帰古歌買悪図週室歩風紙黒花春赤青館屋色走秋夏習駅洋旅服夕借曜飲肉貸堂鳥飯勉冬昼茶弟牛魚兄犬妹姉漢',
]);

const KANJI_RE = /[\u3400-\u9fff]/;

function containsNonAPKanji(text: string) {
  return [...text].some((char) => KANJI_RE.test(char) && !AP_JAPANESE_KANJI.has(char));
}

function shouldShowReading(segment: { text: string; reading?: string }, mode: NonNullable<FuriganaTextProps['mode']>) {
  if (!segment.reading) return false;
  if (mode === 'full') return true;
  if (mode === 'ap-support') return containsNonAPKanji(segment.text);

  const kanjiCount = [...segment.text].filter((char) => KANJI_RE.test(char)).length;
  if (mode === 'partial') return kanjiCount >= 2;
  return kanjiCount >= 3;
}

export function FuriganaText({ text, mode = 'full', compact, textScale = 1, highlightText, highlightStyle }: FuriganaTextProps) {
  const segments = getFuriganaSegments(text);
  const highlightStart = highlightText ? text.indexOf(highlightText) : -1;
  const highlightEnd = highlightStart >= 0 && highlightText ? highlightStart + highlightText.length : -1;
  let cursor = 0;
  const baseFontSize = (compact ? 14 : 17) * textScale;
  const baseLineHeight = (compact ? 20 : 27) * textScale;
  const readingFontSize = (compact ? 9 : 11) * Math.max(1, textScale * 0.92);
  const readingLineHeight = (compact ? 10 : 13) * Math.max(1, textScale * 0.92);
  const minHeight = (compact ? 30 : 44) * Math.max(1, textScale * 0.9);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {segments.map((segment, index) => {
        const start = cursor;
        const end = cursor + segment.text.length;
        const highlighted = highlightStart >= 0 && start < highlightEnd && end > highlightStart;
        cursor = end;
        return (
        <View key={`${segment.text}-${index}`} style={[styles.segment, compact && styles.segmentCompact, highlighted && styles.segmentHighlighted, highlighted && highlightStyle, { minHeight }]}>
          <Text
            style={[
              styles.reading,
              compact && styles.readingCompact,
              { fontSize: readingFontSize, lineHeight: readingLineHeight },
              !shouldShowReading(segment, mode) && styles.hiddenReading,
            ]}
          >
            {shouldShowReading(segment, mode) ? segment.reading : '　'}
          </Text>
          <Text style={[styles.base, compact && styles.baseCompact, { fontSize: baseFontSize, lineHeight: baseLineHeight }]}>
            {segment.text}
          </Text>
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    rowGap: 5,
    marginTop: 2,
  },
  wrapCompact: {
    rowGap: 2,
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight: 1,
    minHeight: 44,
  },
  segmentCompact: {
    minHeight: 30,
  },
  segmentHighlighted: {
    backgroundColor: '#DDF7F2',
    borderRadius: 8,
    paddingHorizontal: 2,
  },
  reading: {
    color: Colors.gold,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
  },
  readingCompact: {
    fontSize: 9,
    lineHeight: 10,
  },
  hiddenReading: {
    opacity: 0,
  },
  base: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 27,
    fontWeight: '400',
  },
  baseCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
});
