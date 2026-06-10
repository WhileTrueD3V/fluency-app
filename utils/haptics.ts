/**
 * Safe haptics wrapper — no-ops on web where expo-haptics is unavailable.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

async function impact(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (Platform.OS === 'web') return;
  const styleMap = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  Haptics.impactAsync(styleMap[style]);
}

async function success() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

async function error() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export const haptics = { impact, success, error };
