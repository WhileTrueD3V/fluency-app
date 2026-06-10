import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type KanjiBackdropProps = {
  compact?: boolean;
  variant?: 'home' | 'library' | 'mock';
};

const GLYPHS = {
  home: [
    { char: '習', style: 'homeOne' },
    { char: '伸', style: 'homeTwo' },
    { char: '達', style: 'homeThree' },
    { char: '聞', style: 'homeFour' },
    { char: '話', style: 'homeFive' },
    { char: '読', style: 'homeSix' },
    { char: '答', style: 'homeSeven' },
    { char: '会', style: 'homeEight' },
    { char: '文', style: 'homeNine' },
    { char: '点', style: 'homeTen' },
    { char: '速', style: 'homeEleven' },
    { char: '練', style: 'homeTwelve' },
    { char: '成', style: 'homeThirteen' },
  ],
  library: [
    { char: '復', style: 'libraryOne' },
    { char: '語', style: 'libraryTwo' },
    { char: '読', style: 'libraryThree' },
    { char: '記', style: 'libraryFour' },
    { char: '書', style: 'libraryFive' },
    { char: '問', style: 'librarySix' },
    { char: '答', style: 'librarySeven' },
    { char: '声', style: 'libraryEight' },
    { char: '文', style: 'libraryNine' },
    { char: '覚', style: 'libraryTen' },
    { char: '聞', style: 'libraryEleven' },
    { char: '練', style: 'libraryTwelve' },
    { char: '会', style: 'libraryThirteen' },
    { char: '点', style: 'libraryFourteen' },
    { char: '直', style: 'libraryFifteen' },
  ],
  mock: [
    { char: '試', style: 'mockOne' },
    { char: '験', style: 'mockTwo' },
    { char: '力', style: 'mockThree' },
    { char: '答', style: 'mockFour' },
    { char: '問', style: 'mockFive' },
    { char: '聞', style: 'mockSix' },
    { char: '読', style: 'mockSeven' },
    { char: '話', style: 'mockEight' },
    { char: '時', style: 'mockNine' },
    { char: '点', style: 'mockTen' },
    { char: '練', style: 'mockEleven' },
    { char: '準', style: 'mockTwelve' },
    { char: '答', style: 'mockThirteen' },
    { char: '速', style: 'mockFourteen' },
    { char: '読', style: 'mockFifteen' },
    { char: '声', style: 'mockSixteen' },
  ],
} as const;

export function KanjiBackdrop({ compact = false, variant = 'home' }: KanjiBackdropProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {GLYPHS[variant].map((glyph, index) => (
        <Text
          key={`${variant}-${glyph.char}-${index}`}
          style={[
            styles.glyph,
            styles[glyph.style],
            compact && styles.glyphCompact,
            compact && styles[`${glyph.style}Compact`],
          ]}
        >
          {glyph.char}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    position: 'absolute',
    color: '#0F1B2D18',
    fontFamily: undefined,
    fontSize: 330,
    fontWeight: '800',
    lineHeight: 360,
    opacity: 0.68,
  },
  glyphCompact: {
    fontSize: 210,
    lineHeight: 232,
    opacity: 0.52,
  },
  homeOne: {
    right: -126,
    top: 40,
    color: '#D9473418',
    transform: [{ rotate: '-10deg' }],
  },
  homeOneCompact: {
    right: -88,
    top: 120,
  },
  homeTwo: {
    left: 24,
    top: 290,
    color: '#2FB9AE16',
    transform: [{ rotate: '13deg' }],
  },
  homeTwoCompact: {
    left: -92,
    top: 530,
  },
  homeThree: {
    right: '28%',
    top: 470,
    color: '#F6C24714',
    transform: [{ rotate: '8deg' }],
  },
  homeThreeCompact: {
    right: -42,
    bottom: 40,
  },
  homeFour: {
    left: '34%',
    top: -130,
    color: '#0F1B2D12',
    transform: [{ rotate: '-5deg' }],
  },
  homeFourCompact: {
    left: 42,
    top: -74,
  },
  homeFive: {
    left: '62%',
    top: 760,
    color: '#2FB9AE14',
    transform: [{ rotate: '-14deg' }],
  },
  homeFiveCompact: {
    left: 118,
    top: 760,
  },
  homeSix: {
    left: '14%',
    top: 74,
    color: '#2FB9AE13',
    transform: [{ rotate: '-15deg' }],
  },
  homeSixCompact: {
    left: -28,
    top: 320,
  },
  homeSeven: {
    right: '8%',
    top: 360,
    color: '#0F1B2D11',
    transform: [{ rotate: '12deg' }],
  },
  homeSevenCompact: {
    right: -98,
    top: 500,
  },
  homeEight: {
    left: '43%',
    top: 220,
    color: '#D9473415',
    transform: [{ rotate: '-6deg' }],
  },
  homeEightCompact: {
    left: 74,
    top: 244,
  },
  homeNine: {
    right: '42%',
    bottom: -135,
    color: '#2FB9AE12',
    transform: [{ rotate: '7deg' }],
  },
  homeNineCompact: {
    right: 2,
    bottom: -62,
  },
  homeTen: {
    right: '18%',
    top: -104,
    color: '#F6C24710',
    transform: [{ rotate: '15deg' }],
  },
  homeTenCompact: {
    right: -18,
    top: -42,
  },
  homeEleven: {
    left: '4%',
    bottom: -126,
    color: '#D9473413',
    transform: [{ rotate: '-13deg' }],
  },
  homeElevenCompact: {
    left: -92,
    bottom: 116,
  },
  homeTwelve: {
    left: '72%',
    top: 300,
    color: '#0F1B2D10',
    transform: [{ rotate: '-11deg' }],
  },
  homeTwelveCompact: {
    left: 166,
    top: 426,
  },
  homeThirteen: {
    left: '24%',
    top: 670,
    color: '#F6C2470F',
    transform: [{ rotate: '-4deg' }],
  },
  homeThirteenCompact: {
    left: 16,
    top: 900,
  },
  libraryOne: {
    right: -130,
    top: 84,
    color: '#D9473424',
    transform: [{ rotate: '-7deg' }],
  },
  libraryOneCompact: {
    right: -90,
    top: 150,
  },
  libraryTwo: {
    left: 20,
    top: 360,
    color: '#2FB9AE24',
    transform: [{ rotate: '12deg' }],
  },
  libraryTwoCompact: {
    left: -90,
    bottom: 70,
  },
  libraryThree: {
    right: '30%',
    top: 560,
    color: '#F6C24718',
    transform: [{ rotate: '5deg' }],
  },
  libraryThreeCompact: {
    right: -58,
    bottom: 190,
  },
  libraryFour: {
    left: '38%',
    top: -118,
    color: '#0F1B2D16',
    transform: [{ rotate: '-8deg' }],
  },
  libraryFourCompact: {
    left: 42,
    top: -68,
  },
  libraryFive: {
    left: '64%',
    top: 740,
    color: '#2FB9AE20',
    transform: [{ rotate: '9deg' }],
  },
  libraryFiveCompact: {
    left: 122,
    top: 760,
  },
  librarySix: {
    left: '18%',
    top: 80,
    color: '#2FB9AE1C',
    transform: [{ rotate: '-14deg' }],
  },
  librarySixCompact: {
    left: -20,
    top: 350,
  },
  librarySeven: {
    right: '8%',
    top: 390,
    color: '#0F1B2D18',
    transform: [{ rotate: '13deg' }],
  },
  librarySevenCompact: {
    right: -88,
    top: 520,
  },
  libraryEight: {
    left: '43%',
    top: 260,
    color: '#D947341F',
    transform: [{ rotate: '-5deg' }],
  },
  libraryEightCompact: {
    left: 76,
    top: 260,
  },
  libraryNine: {
    right: '42%',
    bottom: -120,
    color: '#2FB9AE1D',
    transform: [{ rotate: '7deg' }],
  },
  libraryNineCompact: {
    right: 12,
    bottom: -50,
  },
  libraryTen: {
    right: '18%',
    top: -96,
    color: '#F6C24717',
    transform: [{ rotate: '15deg' }],
  },
  libraryTenCompact: {
    right: -4,
    top: -34,
  },
  libraryEleven: {
    left: '6%',
    top: 610,
    color: '#0F1B2D15',
    transform: [{ rotate: '-18deg' }],
  },
  libraryElevenCompact: {
    left: -72,
    top: 650,
  },
  libraryTwelve: {
    right: '3%',
    top: 700,
    color: '#D947341C',
    transform: [{ rotate: '18deg' }],
  },
  libraryTwelveCompact: {
    right: -94,
    top: 820,
  },
  libraryThirteen: {
    left: '26%',
    top: 690,
    color: '#2FB9AE1A',
    transform: [{ rotate: '4deg' }],
  },
  libraryThirteenCompact: {
    left: 16,
    top: 900,
  },
  libraryFourteen: {
    right: '34%',
    top: 170,
    color: '#F6C24715',
    transform: [{ rotate: '-11deg' }],
  },
  libraryFourteenCompact: {
    right: 42,
    top: 120,
  },
  libraryFifteen: {
    left: '72%',
    top: 300,
    color: '#0F1B2D14',
    transform: [{ rotate: '11deg' }],
  },
  libraryFifteenCompact: {
    left: 170,
    top: 430,
  },
  mockOne: {
    right: -130,
    top: 70,
    color: '#D9473424',
    transform: [{ rotate: '10deg' }],
  },
  mockOneCompact: {
    right: -96,
    top: 118,
  },
  mockTwo: {
    left: 26,
    top: 360,
    color: '#2FB9AE24',
    transform: [{ rotate: '-10deg' }],
  },
  mockTwoCompact: {
    left: -88,
    bottom: 70,
  },
  mockThree: {
    right: '30%',
    top: 560,
    color: '#F6C24718',
    transform: [{ rotate: '14deg' }],
  },
  mockThreeCompact: {
    right: -54,
    bottom: 220,
  },
  mockFour: {
    left: '38%',
    top: -118,
    color: '#0F1B2D16',
    transform: [{ rotate: '7deg' }],
  },
  mockFourCompact: {
    left: 50,
    top: -70,
  },
  mockFive: {
    left: '64%',
    top: 740,
    color: '#2FB9AE20',
    transform: [{ rotate: '-12deg' }],
  },
  mockFiveCompact: {
    left: 122,
    top: 770,
  },
  mockSix: {
    left: '14%',
    top: 118,
    color: '#2FB9AE1D',
    transform: [{ rotate: '10deg' }],
  },
  mockSixCompact: {
    left: -18,
    top: 310,
  },
  mockSeven: {
    right: '10%',
    top: 424,
    color: '#0F1B2D18',
    transform: [{ rotate: '-16deg' }],
  },
  mockSevenCompact: {
    right: -88,
    top: 520,
  },
  mockEight: {
    left: '42%',
    top: 250,
    color: '#D947341F',
    transform: [{ rotate: '-6deg' }],
  },
  mockEightCompact: {
    left: 72,
    top: 250,
  },
  mockNine: {
    right: '44%',
    bottom: -130,
    color: '#2FB9AE1D',
    transform: [{ rotate: '7deg' }],
  },
  mockNineCompact: {
    right: 10,
    bottom: -60,
  },
  mockTen: {
    right: '19%',
    top: -102,
    color: '#F6C24717',
    transform: [{ rotate: '15deg' }],
  },
  mockTenCompact: {
    right: -4,
    top: -36,
  },
  mockEleven: {
    left: '4%',
    bottom: -120,
    color: '#D947341B',
    transform: [{ rotate: '-13deg' }],
  },
  mockElevenCompact: {
    left: -84,
    bottom: 120,
  },
  mockTwelve: {
    left: '7%',
    top: 620,
    color: '#0F1B2D15',
    transform: [{ rotate: '17deg' }],
  },
  mockTwelveCompact: {
    left: -70,
    top: 640,
  },
  mockThirteen: {
    right: '4%',
    top: 690,
    color: '#2FB9AE1A',
    transform: [{ rotate: '-18deg' }],
  },
  mockThirteenCompact: {
    right: -98,
    top: 830,
  },
  mockFourteen: {
    left: '25%',
    top: 690,
    color: '#D947341B',
    transform: [{ rotate: '-4deg' }],
  },
  mockFourteenCompact: {
    left: 18,
    top: 900,
  },
  mockFifteen: {
    right: '34%',
    top: 172,
    color: '#F6C24715',
    transform: [{ rotate: '11deg' }],
  },
  mockFifteenCompact: {
    right: 42,
    top: 120,
  },
  mockSixteen: {
    left: '72%',
    top: 306,
    color: '#0F1B2D14',
    transform: [{ rotate: '-11deg' }],
  },
  mockSixteenCompact: {
    left: 168,
    top: 430,
  },
});
