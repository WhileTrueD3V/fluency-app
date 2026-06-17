import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, StyleSheet, Animated } from 'react-native';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/colors';

type ChoiceState = 'idle' | 'selected-correct' | 'selected-wrong' | 'reveal-correct';

interface AnswerChoiceProps {
  label: string;
  index: number;
  choiceState: ChoiceState;
  onPress: () => void;
  disabled: boolean;
  compact?: boolean;
  mobile?: boolean;
  accent?: string;
}

export function AnswerChoice({
  label,
  index,
  choiceState,
  onPress,
  disabled,
  compact,
  mobile,
  accent = Colors.primary,
}: AnswerChoiceProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);
  const letters = ['A', 'B', 'C', 'D'];

  useEffect(() => {
    if (choiceState === 'selected-correct') {
      haptics.success();
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.04, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else if (choiceState === 'selected-wrong') {
      haptics.error();
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.01, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [choiceState, scaleAnim]);

  const handlePress = () => {
    haptics.impact('light');
    onPress();
  };

  const setHover = (nextHovered: boolean) => {
    if (disabled || choiceState !== 'idle') {
      setHovered(false);
      return;
    }
    setHovered(nextHovered);
  };

  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    if (disabled || choiceState !== 'idle') return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  const styleMap: Record<ChoiceState, { bg: string; border: string; textColor: string; letterBg: string }> = {
    idle: {
      bg: Colors.card,
      border: Colors.border,
      textColor: Colors.text,
      letterBg: Colors.surface,
    },
    'selected-correct': {
      bg: Colors.successDim,
      border: Colors.success,
      textColor: Colors.success,
      letterBg: Colors.success,
    },
    'selected-wrong': {
      bg: Colors.errorDim,
      border: Colors.error,
      textColor: Colors.error,
      letterBg: Colors.error,
    },
    'reveal-correct': {
      bg: Colors.successDim,
      border: Colors.success,
      textColor: Colors.success,
      letterBg: Colors.success,
    },
  };

  const s = styleMap[choiceState];
  const isHighlighted = choiceState !== 'idle';
  const letterTextColor = isHighlighted ? '#fff' : Colors.textSub;
  const lowerEdge = isHighlighted ? s.border : Colors.borderBright;
  const hoverBorder = hovered ? accent : s.border;
  const hoverBottom = hovered ? accent : lowerEdge;
  const hoverBg = hovered ? `${accent}0D` : s.bg;
  const hoverTranslateY = hovered ? (mobile ? -3 : -2) : 0;
  const hoverShadowOpacity = hovered ? (mobile ? 0.13 : 0.09) : 0.04;
  const hoverShadowRadius = hovered ? (mobile ? 18 : 14) : 8;

  return (
    <Animated.View style={[styles.choiceFrame, { transform: [{ scale: scaleAnim }, { translateY: hoverTranslateY }] }]}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.choice,
          compact && styles.choiceCompact,
          mobile && styles.choiceMobile,
          {
            backgroundColor: isHighlighted ? s.bg : hoverBg,
            borderColor: isHighlighted ? s.border : hoverBorder,
            borderBottomColor: isHighlighted ? lowerEdge : hoverBottom,
            shadowColor: accent,
            shadowOpacity: isHighlighted ? 0.08 : hoverShadowOpacity,
            shadowRadius: isHighlighted ? 12 : hoverShadowRadius,
          },
        ]}
      >
        <Text
          style={[
            styles.letter,
            compact && styles.letterCompact,
            mobile && styles.letterMobile,
            { backgroundColor: s.letterBg, color: letterTextColor },
          ]}
        >
          {letters[index]}
        </Text>
        <Text style={[styles.label, compact && styles.labelCompact, mobile && styles.labelMobile, { color: s.textColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  choiceFrame: {},
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  choiceCompact: {
    gap: 11,
    borderRadius: 18,
    borderBottomWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 54,
  },
  choiceMobile: {
    borderRadius: 20,
    borderBottomWidth: 5,
    minHeight: 60,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  letter: {
    width: 32,
    height: 32,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 32,
    fontSize: 14,
    fontWeight: '700',
  },
  letterCompact: {
    width: 34,
    height: 34,
    borderRadius: 12,
    lineHeight: 34,
    fontSize: 14,
    fontWeight: '900',
  },
  letterMobile: {
    width: 38,
    height: 38,
    borderRadius: 14,
    lineHeight: 38,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  labelCompact: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  labelMobile: {
    fontSize: 16,
    lineHeight: 21,
  },
});
