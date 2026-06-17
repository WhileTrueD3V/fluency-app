import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';

export function DrillLoadRecovery({
  title = 'This drill could not open cleanly.',
  message = 'Kibbo stopped waiting instead of spinning forever. Go back and try again; saved sessions resume without rebuilding.',
  actionLabel = 'Back to plan',
  onAction,
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Fresh set stalled</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity onPress={onAction} activeOpacity={0.84} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FBFCFD',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFF5',
    padding: 28,
    gap: 14,
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  kicker: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  message: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '800',
  },
  button: {
    minHeight: 54,
    marginTop: 4,
    borderRadius: 18,
    borderBottomWidth: 5,
    borderBottomColor: '#020916',
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.onPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
});
