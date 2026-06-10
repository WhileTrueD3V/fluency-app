import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  elevated?: boolean;
}

export function Card({ children, style, padding = 16, elevated = false }: CardProps) {
  return (
    <View style={[styles.card, elevated && styles.elevated, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    borderColor: Colors.borderBright,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
});
