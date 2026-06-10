import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/colors';
import { DrillAccents } from '@/constants/drillAccents';
import { MicrophoneIcon, StopIcon, CheckIcon } from '@/components/Icons';
import type { RecognitionState } from '@/hooks/useSpeechRecognition';

interface RecordButtonProps {
  state: RecognitionState;
  onPress: () => void;
}

export function RecordButton({ state, onPress }: RecordButtonProps) {
  const { width } = useWindowDimensions();
  const compact = width < APP_COMPACT_BREAKPOINT;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (state === 'listening') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [state, pulseAnim]);

  const handlePress = () => {
    if (state === 'listening') {
      haptics.impact('heavy');
    } else {
      haptics.impact('medium');
    }
    onPress();
  };

  const isListening = state === 'listening';
  const isProcessing = state === 'processing';

  const configs: Record<RecognitionState, { bg: string; icon: React.ReactNode; label: string }> = {
    idle: { bg: DrillAccents.speaking, icon: <MicrophoneIcon size={32} color="#fff" strokeWidth={1.6} />, label: 'Tap to Speak' },
    listening: { bg: Colors.error, icon: <StopIcon size={32} color="#fff" strokeWidth={1.6} />, label: 'Tap to Stop' },
    processing: { bg: Colors.surface, icon: <MicrophoneIcon size={32} color={Colors.textMuted} strokeWidth={1.6} />, label: 'Processing…' },
    done: { bg: Colors.success, icon: <CheckIcon size={28} color="#fff" strokeWidth={2.5} />, label: 'Done' },
    error: { bg: Colors.error, icon: <MicrophoneIcon size={32} color="#fff" strokeWidth={1.6} />, label: 'Try Again' },
  };
  const config = configs[state];

  return (
    <Animated.View
      style={[
        styles.outerRing,
        isListening && styles.listeningRing,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        disabled={isProcessing}
        activeOpacity={0.8}
        style={[styles.button, compact && styles.buttonCompact, { backgroundColor: config.bg }]}
      >
        {config.icon}
      </TouchableOpacity>
      <Text style={[styles.label, compact && styles.labelCompact]}>{config.label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerRing: {
    alignItems: 'center',
    gap: 10,
  },
  listeningRing: {
    // glow handled by shadow
  },
  button: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DrillAccents.speaking,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonCompact: {
    width: 78,
    height: 78,
    borderRadius: 39,
    shadowOpacity: 0.38,
    shadowRadius: 16,
  },
  label: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  labelCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
});
