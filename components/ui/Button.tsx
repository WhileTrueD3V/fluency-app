import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string; bottom?: string; shadow?: string; heavy?: boolean }> = {
  primary: { bg: Colors.primary, text: Colors.onPrimary, bottom: '#A93425', shadow: Colors.primary, heavy: true },
  secondary: { bg: Colors.card, text: Colors.text, border: Colors.borderBright, bottom: Colors.borderBright, shadow: Colors.ink },
  ghost: { bg: 'transparent', text: Colors.textSub, border: Colors.borderBright, bottom: Colors.borderBright, shadow: Colors.ink },
  danger: { bg: Colors.error, text: Colors.onPrimary, bottom: '#A93425', shadow: Colors.error, heavy: true },
  success: { bg: Colors.success, text: Colors.onPrimary, bottom: '#218C5C', shadow: Colors.success, heavy: true },
};

const sizeStyles: Record<Size, { paddingH: number; paddingV: number; fontSize: number; radius: number; minHeight: number }> = {
  sm: { paddingH: 16, paddingV: 9, fontSize: 14, radius: 12, minHeight: 40 },
  md: { paddingH: 22, paddingV: 13, fontSize: 15, radius: 16, minHeight: 48 },
  lg: { paddingH: 28, paddingV: 16, fontSize: 17, radius: 18, minHeight: 56 },
};

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const vs = variantStyles[variant];
  const ss = sizeStyles[size];
  const isTactile = !disabled && !loading;
  const bottomWidth = isTactile ? (vs.heavy ? 5 : 2) : 0;

  const handlePress = () => {
    haptics.impact('light');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: vs.bg,
          borderColor: vs.border ?? 'transparent',
          borderWidth: vs.border ? 1 : 0,
          borderBottomWidth: vs.border ? Math.max(1, bottomWidth) : bottomWidth,
          borderBottomColor: vs.bottom ?? vs.border ?? 'transparent',
          paddingHorizontal: ss.paddingH,
          paddingVertical: ss.paddingV,
          borderRadius: ss.radius,
          minHeight: ss.minHeight,
          opacity: disabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
          shadowColor: vs.shadow ?? Colors.ink,
          shadowOpacity: isTactile ? (vs.heavy ? 0.2 : 0.08) : 0,
          shadowRadius: vs.heavy ? 16 : 10,
          shadowOffset: { width: 0, height: vs.heavy ? 8 : 5 },
          elevation: isTactile ? (vs.heavy ? 3 : 1) : 0,
          transform: [{ translateY: pressed && isTactile ? 2 : 0 }],
        },
        pressed && isTactile && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vs.text} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            { color: vs.text, fontSize: ss.fontSize },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '900',
    letterSpacing: 0,
  },
  pressed: {
    shadowOpacity: 0.06,
  },
});
