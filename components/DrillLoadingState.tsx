import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import {
  BookOpenIcon,
  FileTextIcon,
  FlameIcon,
  HeadphonesIcon,
  MessageCircleIcon,
  MicrophoneIcon,
  TargetIcon,
} from '@/components/Icons';
import { Colors } from '@/constants/colors';
import { DrillAccents, tint } from '@/constants/drillAccents';

type DrillLoadingMode = 'listening' | 'reading' | 'speaking' | 'conversation' | 'texting';

const MODE_COPY: Record<DrillLoadingMode, {
  accent: string;
  glyph: string;
  title: string;
  subtitle: string;
  Icon: typeof HeadphonesIcon;
}> = {
  listening: {
    accent: DrillAccents.listening,
    glyph: '聴',
    title: 'Building listening round',
    subtitle: 'Matching level, recent misses, and fresh AP audio-style prompts.',
    Icon: HeadphonesIcon,
  },
  reading: {
    accent: DrillAccents.reading,
    glyph: '読',
    title: 'Building reading set',
    subtitle: 'Choosing a fresh source with the right kanji load and inference pressure.',
    Icon: FileTextIcon,
  },
  speaking: {
    accent: DrillAccents.speaking,
    glyph: '話',
    title: 'Building speaking rep',
    subtitle: 'Tuning the prompt to your level, weak spots, and natural response target.',
    Icon: MicrophoneIcon,
  },
  conversation: {
    accent: DrillAccents.conversation,
    glyph: '会',
    title: 'Building AP conversation',
    subtitle: 'Preparing four spoken turns with register and task-completion pressure.',
    Icon: HeadphonesIcon,
  },
  texting: {
    accent: DrillAccents.texting,
    glyph: '返',
    title: 'Building text chat',
    subtitle: 'Preparing timed replies around your recent message-control patterns.',
    Icon: MessageCircleIcon,
  },
};

const DEFAULT_STEPS = ['Level fit', 'Weak spot', 'Fresh prompt', 'No repeats'];

export function DrillLoadingState({
  mode,
  title,
  subtitle,
  steps = DEFAULT_STEPS,
}: {
  mode: DrillLoadingMode;
  title?: string;
  subtitle?: string;
  steps?: string[];
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < APP_COMPACT_BREAKPOINT;
  const config = MODE_COPY[mode];
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const [activeStep, setActiveStep] = useState(0);
  const safeSteps = steps.length > 0 ? steps : DEFAULT_STEPS;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 880,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 880,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    floatLoop.start();
    return () => {
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [float, pulse]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((current) => (current + 1) % safeSteps.length);
    }, 1050);
    return () => clearInterval(timer);
  }, [safeSteps.length]);

  const activityDots = useMemo(() => Array.from({ length: 5 }), []);
  const iconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });
  const iconGlow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] });
  const glyphTranslate = float.interpolate({ inputRange: [0, 1], outputRange: [8, -6] });
  const railScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const Icon = config.Icon;
  const displayTitle = title ?? config.title;
  const displaySubtitle = subtitle ?? config.subtitle;

  return (
    <View style={[styles.wrap, isMobile && styles.wrapMobile]}>
      <Animated.Text
        style={[
          styles.glyph,
          isMobile && styles.glyphMobile,
          { color: tint(config.accent, '10'), transform: [{ translateY: glyphTranslate }] },
        ]}
      >
        {config.glyph}
      </Animated.Text>
      <View style={[styles.card, isMobile && styles.cardMobile]}>
        <View style={styles.topRow}>
          <Animated.View
            style={[
              styles.iconWell,
              isMobile && styles.iconWellMobile,
              {
                backgroundColor: tint(config.accent, '14'),
                borderColor: tint(config.accent, '3B'),
                shadowColor: config.accent,
                shadowOpacity: iconGlow,
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <Icon size={isMobile ? 28 : 34} color={config.accent} strokeWidth={2.1} />
          </Animated.View>
          <View style={styles.copy}>
            <Text style={styles.kicker}>Coach is preparing</Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>{displayTitle}</Text>
          </View>
        </View>

        <View style={styles.activity}>
          <View style={styles.activityRail}>
            <Animated.View
              style={[
                styles.activityFill,
                { backgroundColor: config.accent, shadowColor: config.accent, transform: [{ scaleX: railScale }] },
              ]}
            />
          </View>
          <View style={styles.dotRow}>
            {activityDots.map((_, index) => (
              <Animated.View
                key={`loading-dot-${index}`}
                style={[
                  styles.dot,
                  {
                    backgroundColor: config.accent,
                    opacity: index <= activeStep ? 0.95 : 0.2,
                    transform: [{ scale: index === activeStep ? iconScale : 1 }],
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>{displaySubtitle}</Text>

        <View style={[styles.cacheNote, isMobile && styles.cacheNoteMobile]}>
          <View style={styles.cacheAccent} />
          <Animated.View
            style={[
              styles.cacheIcon,
              {
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <FlameIcon size={18} color={Colors.primary} strokeWidth={2.1} />
          </Animated.View>
          <View style={styles.cacheCopy}>
            <Text style={styles.cacheNoteKicker}>First-time build</Text>
            <Text style={styles.cacheNoteText}>
              First build takes the longest. After Kibbo warms this drill, fresh sets usually open much faster.
            </Text>
          </View>
        </View>

        <View style={styles.stepGrid}>
          {safeSteps.map((step, index) => {
            const active = index === activeStep;
            return (
              <View
                key={step}
                style={[
                  styles.step,
                  active && {
                    backgroundColor: tint(config.accent, '16'),
                    borderColor: tint(config.accent, '55'),
                  },
                ]}
              >
                {active ? (
                  <TargetIcon size={14} color={config.accent} strokeWidth={2.1} />
                ) : (
                  <BookOpenIcon size={14} color={Colors.textMuted} strokeWidth={2} />
                )}
                <Text style={[styles.stepText, active && { color: config.accent }]}>{step}</Text>
              </View>
            );
          })}
        </View>
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
    overflow: 'hidden',
  },
  wrapMobile: {
    paddingHorizontal: 18,
    paddingTop: 66,
    paddingBottom: 36,
  },
  glyph: {
    position: 'absolute',
    right: -72,
    top: 40,
    fontSize: 430,
    fontWeight: '900',
  },
  glyphMobile: {
    right: -58,
    top: 92,
    fontSize: 340,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFF5',
    padding: 28,
    gap: 18,
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
  },
  cardMobile: {
    borderRadius: 28,
    padding: 22,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconWell: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  iconWellMobile: {
    width: 62,
    height: 62,
    borderRadius: 22,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  titleMobile: {
    fontSize: 24,
    lineHeight: 28,
  },
  activity: {
    gap: 12,
  },
  activityRail: {
    height: 13,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityFill: {
    width: '64%',
    height: '100%',
    borderRadius: 999,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  dotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 22,
    height: 8,
    borderRadius: 999,
  },
  subtitle: {
    color: Colors.textSub,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
  },
  subtitleMobile: {
    fontSize: 15,
    lineHeight: 21,
  },
  cacheNote: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#F5B8B0',
    backgroundColor: '#FFF5F2',
    paddingHorizontal: 14,
    paddingVertical: 13,
    shadowColor: Colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  cacheNoteMobile: {
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cacheAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 7,
    backgroundColor: Colors.primary,
  },
  cacheIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3C9C4',
    shadowColor: Colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  cacheCopy: {
    flex: 1,
    gap: 3,
    paddingRight: 2,
  },
  cacheNoteKicker: {
    color: Colors.primary,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  cacheNoteText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  stepGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceTranslucent,
    paddingHorizontal: 10,
  },
  stepText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
  },
});
