import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/colors';
import {
  ArrowRightIcon,
  CheckIcon,
  MicrophoneIcon,
  TargetIcon,
  WaveformIcon,
} from '@/components/Icons';

function ScorePill({
  icon,
  title,
  text,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  color: string;
}) {
  return (
    <View style={[styles.scorePill, { borderColor: color + '44' }]}>
      <View style={[styles.scoreIcon, { backgroundColor: color + '18' }]}>
        {icon}
      </View>
      <View style={styles.scoreCopy}>
        <Text style={styles.scoreTitle}>{title}</Text>
        <Text style={styles.scoreText}>{text}</Text>
      </View>
    </View>
  );
}

export default function SpeakingModeSelect() {
  const router = useRouter();

  const goBack = () => {
    router.replace('/(home)');
  };

  const startSession = () => {
    haptics.impact('medium');
    router.push('/speaking/translation');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={goBack} style={styles.back} activeOpacity={0.75}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MicrophoneIcon size={30} color={Colors.speaking} strokeWidth={1.9} />
          </View>
          <Text style={styles.eyebrow}>Speaking practice</Text>
          <Text style={styles.title}>One attempt. Two scores.</Text>
          <Text style={styles.subtitle}>
            Translate the prompt aloud, then review meaning and pronunciation separately.
          </Text>
        </View>

        <View style={styles.panel}>
          <LinearGradient
            colors={['#C2410C', '#E11D48']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.panelAccent}
          />
          <Text style={styles.panelLabel}>Session format</Text>
          <Text style={styles.panelTitle}>AI Speaking Session</Text>
          <Text style={styles.panelText}>
            You will see an English phrase, speak the target-language translation, and get a focused result screen for both skills.
          </Text>

          <View style={styles.scoreGrid}>
            <ScorePill
              icon={<TargetIcon size={20} color={Colors.success} />}
              title="Translation accuracy"
              text="Checks whether the meaning landed."
              color={Colors.success}
            />
            <ScorePill
              icon={<WaveformIcon size={20} color={Colors.primary} />}
              title="Pronunciation fluency"
              text="Checks clarity against the spoken target."
              color={Colors.primary}
            />
          </View>

          <TouchableOpacity onPress={startSession} activeOpacity={0.86} style={styles.startButton}>
            <Text style={styles.startText}>Start speaking</Text>
            <ArrowRightIcon size={20} color="#fff" strokeWidth={2.3} />
          </TouchableOpacity>
        </View>

        <View style={styles.note}>
          <CheckIcon size={17} color={Colors.primary} />
          <Text style={styles.noteText}>
            Requires microphone access and works best in a quiet environment.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 22,
  },
  back: { alignSelf: 'flex-start' },
  backText: { color: Colors.textSub, fontSize: 16, fontWeight: '600' },
  hero: {
    gap: 9,
    paddingTop: 8,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.speakingDim,
    borderWidth: 1,
    borderColor: Colors.speaking + '55',
    marginBottom: 4,
  },
  eyebrow: {
    color: Colors.speaking,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.text,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 43,
  },
  subtitle: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 620,
    fontWeight: '600',
  },
  panel: {
    flex: 1,
    minHeight: 370,
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 20,
    overflow: 'hidden',
    gap: 14,
  },
  panelAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    height: 5,
  },
  panelLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  panelTitle: { color: Colors.text, fontSize: 25, fontWeight: '900' },
  panelText: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  scoreGrid: { gap: 12, marginTop: 4 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  scoreIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCopy: { flex: 1, gap: 3 },
  scoreTitle: { color: Colors.text, fontSize: 15, fontWeight: '900' },
  scoreText: { color: Colors.textSub, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  startButton: {
    marginTop: 'auto',
    minHeight: 58,
    borderRadius: 17,
    backgroundColor: Colors.speaking,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: Colors.speaking,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  startText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  noteText: { flex: 1, color: Colors.textSub, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
