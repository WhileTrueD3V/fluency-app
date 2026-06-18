import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { isLanguageAvailable, LANGUAGES, type LanguageCode } from '@/constants/languages';
import { CheckIcon, ChevronRightIcon, FileTextIcon, HeadphonesIcon, MessageCircleIcon, MicrophoneIcon, TargetIcon } from '@/components/Icons';
import { KanjiBackdrop } from '@/components/KanjiBackdrop';
import { KibboLogo } from '@/components/KibboLogo';
import { LanguageMark } from '@/components/LanguageMark';
import { haptics } from '@/utils/haptics';
import { getStatsForLanguage, savePrefs } from '@/utils/storage';
import { getPlayerLevel } from '@/utils/progression';
import { getLanguageProgressGlyph } from '@/utils/learningSignals';

const COACH_STEPS = [
  {
    title: 'Read your weak spots',
    mobileTitle: 'Weak-spot memory',
    text: 'Rubric misses, recent mistakes, and repeated prompt patterns.',
    mobileText: 'Recent misses guide the plan.',
    icon: <TargetIcon size={20} color={Colors.primary} strokeWidth={2.3} />,
  },
  {
    title: 'Generate today’s work',
    mobileTitle: 'Daily AP work',
    text: 'Fresh AP-style drills built around level and timing pressure.',
    mobileText: 'Fresh drills match your level.',
    icon: <FileTextIcon size={20} color={Colors.teal} strokeWidth={2.2} />,
  },
  {
    title: 'Prove it under pressure',
    mobileTitle: 'Mock readiness',
    text: 'Mini Mock turns progress into a clearer readiness signal.',
    mobileText: 'Short checks show what is improving.',
    icon: <CheckIcon size={20} color={Colors.gold} strokeWidth={2.8} />,
  },
];

const MODE_PILLS = [
  { label: 'Listening', icon: <HeadphonesIcon size={18} color={Colors.teal} strokeWidth={2.2} /> },
  { label: 'Speaking', icon: <MicrophoneIcon size={18} color={Colors.primary} strokeWidth={2.2} /> },
  { label: 'Text chat', icon: <MessageCircleIcon size={18} color={Colors.ink} strokeWidth={2.2} /> },
];

function LanguageCard({
  lang,
  compact,
  square = false,
  glyph,
  level,
  onPress,
}: {
  lang: (typeof LANGUAGES)[0];
  compact: boolean;
  square?: boolean;
  glyph?: string;
  level?: number;
  onPress: () => void;
}) {
  const isAvailable = isLanguageAvailable(lang.code as LanguageCode);
  const lift = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const arrow = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);

  const animateCard = (nextActive: boolean) => {
    setActive(nextActive);
    Animated.parallel([
      Animated.spring(lift, {
        toValue: nextActive ? -10 : 0,
        damping: 19,
        stiffness: 210,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: nextActive ? 1.018 : 1,
        damping: 20,
        stiffness: 190,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(arrow, {
        toValue: nextActive ? 12 : 0,
        damping: 17,
        stiffness: 210,
        mass: 0.75,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = async () => {
    haptics.impact(isAvailable ? 'medium' : 'light');
    if (!isAvailable) return;
    onPress();
  };

  return (
    <Animated.View
      style={[
        styles.languageCardMotion,
        compact && styles.languageCardMotionCompact,
        square && styles.languageCardMotionSquare,
        square && compact && styles.languageCardMotionSquareCompact,
        { transform: [{ translateY: lift }, { scale }] },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onHoverIn={() => animateCard(true)}
        onHoverOut={() => animateCard(false)}
        onPressIn={() => animateCard(true)}
        onPressOut={() => animateCard(false)}
        accessibilityRole="button"
        accessibilityLabel={isAvailable ? `Start ${lang.name}` : `${lang.name} coming soon`}
        style={({ hovered, pressed }) => [
          styles.languageCard,
          compact && styles.languageCardCompact,
          square && styles.languageCardSquare,
          square && compact && styles.languageCardSquareCompact,
          (active || hovered) && styles.languageCardActive,
          pressed && isAvailable && styles.languageCardPressed,
          !isAvailable && styles.languageCardComingSoon,
        ]}
      >
        <View style={[styles.courseImageWrap, compact && styles.courseImageWrapCompact, square && styles.courseImageWrapSquare, square && compact && styles.courseImageWrapSquareCompact]}>
          <LanguageMark code={lang.code as LanguageCode} size={compact ? 'md' : 'lg'} glyph={glyph} />
        </View>

        {square ? (
          <Text style={[styles.languageCardTitle, styles.languageCardTitleSquare, compact && styles.languageCardTitleSquareCompact, !isAvailable && styles.languageCardTitleMuted]} numberOfLines={1}>
            {lang.name}
          </Text>
        ) : (
          <View style={styles.languageCardCopy}>
            <View style={styles.languageCardTopline}>
              <Text style={styles.languageCardKicker} numberOfLines={1}>
                {isAvailable ? 'Live AP coach' : 'Future coach'}
              </Text>
              <View style={[styles.levelChip, !isAvailable && styles.comingSoonChip]}>
                <Text style={[styles.levelChipText, !isAvailable && styles.comingSoonChipText]}>
                  {isAvailable ? `Level ${level ?? 1}` : 'AP'}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.languageCardTitle, compact && styles.languageCardTitleCompact, !isAvailable && styles.languageCardTitleMuted]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {lang.name} {lang.nativeName}
            </Text>
            <Text style={[styles.languageCardBody, compact && styles.languageCardBodyCompact]} numberOfLines={2}>
              {isAvailable
                ? 'Coach-personalized drills and AP practice built from your weak spots.'
                : 'Same personalized AP coach format, planned after Japanese is fully ready.'}
            </Text>
          </View>
        )}

        {isAvailable && !square && (
          <View style={[styles.startButton, square && styles.startButtonSquare]}>
            <Text style={[styles.startButtonText, square && styles.startButtonTextSquare]}>{compact || square ? 'Start' : 'Start coach'}</Text>
            <Animated.View style={{ transform: [{ translateX: arrow }] }}>
              <ChevronRightIcon size={20} color={Colors.onPrimary} strokeWidth={2.7} />
            </Animated.View>
          </View>
        )}
        {!isAvailable && !square && (
          <View style={[styles.comingSoonButton, square && styles.comingSoonButtonSquare]}>
            <Text style={[styles.comingSoonButtonText, square && styles.comingSoonButtonTextSquare]}>Coming soon</Text>
          </View>
        )}
        {!isAvailable && square && (
          <View pointerEvents="none" style={[styles.languageComingSoonOverlay, compact && styles.languageComingSoonOverlayCompact]}>
            <Text style={[styles.languageComingSoonOverlayText, compact && styles.languageComingSoonOverlayTextCompact]}>Coming soon</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const stacked = width < 1080;
  const [progressGlyphs, setProgressGlyphs] = useState<Partial<Record<LanguageCode, string>>>({});
  const [levels, setLevels] = useState<Partial<Record<LanguageCode, number>>>({});
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 5 }),
    ]).start();
  }, [fade, rise]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      LANGUAGES.map(async (lang) => {
        const stats = await getStatsForLanguage(lang.code);
        const level = getPlayerLevel(stats.totalXP);
        return [lang.code, level.level, getLanguageProgressGlyph(lang.code, level.level)] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setLevels(Object.fromEntries(entries.map(([code, level]) => [code, level])) as Partial<Record<LanguageCode, number>>);
      setProgressGlyphs(
        Object.fromEntries(entries.filter((entry) => entry[2]).map(([code, , glyph]) => [code, glyph])) as Partial<Record<LanguageCode, string>>,
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const openLanguage = async (code: LanguageCode) => {
    if (!isLanguageAvailable(code)) return;
    haptics.impact('medium');
    await savePrefs({ selectedLanguage: code, onboardingComplete: true });
    router.replace('/(home)');
  };

  if (compact) {
    const futureLanguages = LANGUAGES.filter((lang) => lang.code !== 'ja');

    return (
      <SafeAreaView style={styles.safe}>
        <KanjiBackdrop variant="home" compact />
        <ScrollView
          contentContainerStyle={styles.mobileOnboardingScroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.mobileOnboardingContent,
              { opacity: fade, transform: [{ translateY: rise }] },
            ]}
          >
            <View style={styles.mobileOnboardingTopBar}>
              <KibboLogo size="md" singleLine />
              <View style={[styles.editionPill, styles.editionPillCompact]}>
                <View style={styles.editionDot} />
                <Text style={[styles.editionText, styles.editionTextCompact]}>AP</Text>
              </View>
            </View>

            <Pressable
              onPress={() => openLanguage('ja')}
              accessibilityRole="button"
              accessibilityLabel="Start Japanese AP coach"
              style={({ hovered, pressed }) => [
                styles.mobileHeroCourse,
                hovered && styles.mobileHeroCourseHover,
                pressed && styles.mobileHeroCoursePressed,
              ]}
            >
              <View style={styles.mobileHeroTop}>
                <View style={styles.mobileHeroMark}>
                  <LanguageMark code="ja" size="md" glyph={progressGlyphs.ja} />
                </View>
                <View style={styles.mobileHeroCopy}>
                  <Text style={styles.mobileHeroKicker}>Ultra-personal AP coach</Text>
                  <Text style={styles.mobileHeroTitle}>Japanese 日本語</Text>
                  <Text style={styles.mobileHeroSub}>Daily practice built from your weak spots.</Text>
                </View>
              </View>
              <View style={styles.mobileHeroAction}>
                <Text style={styles.mobileHeroActionText}>Start Japanese coach</Text>
                <ChevronRightIcon size={22} color={Colors.onPrimary} strokeWidth={2.8} />
              </View>
            </Pressable>

            <View style={styles.mobileFutureGrid}>
              {futureLanguages.map((lang) => (
                <View key={lang.code} style={styles.mobileFutureCard}>
                  <View style={styles.mobileFutureBadge}>
                    <Text style={styles.mobileFutureBadgeText}>Coming soon</Text>
                  </View>
                  <View style={styles.mobileFutureMark}>
                    <LanguageMark code={lang.code as LanguageCode} size="sm" />
                  </View>
                  <Text style={styles.mobileFutureName}>{lang.name}</Text>
                </View>
              ))}
            </View>

            <View style={styles.mobileHowPanel}>
              <Text style={styles.mobileHowKicker}>How Kibbo starts</Text>
              <Text style={styles.mobileHowTitle}>One plan, rebuilt around you.</Text>
              <View style={styles.mobileHowSteps}>
                {COACH_STEPS.map((step, index) => (
                  <View key={step.title} style={styles.mobileHowStep}>
                    <View style={styles.mobileHowStepIcon}>{step.icon}</View>
                    <View style={styles.mobileHowStepCopy}>
                      <Text style={styles.mobileHowStepTitle}>{index + 1}. {step.mobileTitle}</Text>
                      <Text style={styles.mobileHowStepText}>{step.mobileText}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.mobileModeStrip}>
                {MODE_PILLS.map((pill) => (
                  <View key={pill.label} style={styles.mobileModePill}>
                    {pill.icon}
                    <Text style={styles.mobileModePillText}>{pill.label === 'Text chat' ? 'Texting' : pill.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KanjiBackdrop variant="home" compact={compact} />
      <ScrollView
        contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            compact && styles.contentCompact,
            { opacity: fade, transform: [{ translateY: rise }] },
          ]}
        >
          <View style={[styles.topBar, compact && styles.topBarCompact]}>
            <KibboLogo size={compact ? 'md' : 'lg'} singleLine={compact} />
            <View style={[styles.editionPill, compact && styles.editionPillCompact]}>
              <View style={styles.editionDot} />
              <Text style={[styles.editionText, compact && styles.editionTextCompact]}>{compact ? 'AP' : 'AP Edition'}</Text>
            </View>
          </View>

          <View style={[styles.courseCoachGrid, stacked && styles.courseCoachGridStacked, compact && styles.courseCoachGridCompact]}>
            <View style={[styles.futureGrid, styles.courseSquareGrid, stacked && styles.courseSquareGridStacked, compact && styles.courseSquareGridCompact]}>
              {LANGUAGES.map((lang) => (
                <LanguageCard
                  key={lang.code}
                  lang={lang}
                  compact={compact}
                  square
                  glyph={progressGlyphs[lang.code]}
                  level={levels[lang.code]}
                  onPress={() => openLanguage(lang.code as LanguageCode)}
                />
              ))}
            </View>

            <View style={[styles.coachPanel, styles.coachPanelChoice, stacked && styles.coachPanelStacked, compact && styles.coachPanelCompact]}>
              <View style={styles.coachPanelTop}>
                <Text style={[styles.coachKicker, compact && styles.coachKickerCompact]}>How Kibbo starts</Text>
                <Text style={[styles.coachTitle, compact && styles.coachTitleCompact]}>{compact ? 'Rebuilt around you.' : 'One plan, rebuilt around you.'}</Text>
              </View>
              <View style={[styles.coachStepList, compact && styles.coachStepListCompact]}>
                {COACH_STEPS.map((step, index) => (
                  <View key={step.title} style={[styles.coachStep, compact && styles.coachStepCompact]}>
                    <View style={[styles.coachStepIcon, compact && styles.coachStepIconCompact]}>{step.icon}</View>
                    <View style={styles.coachStepCopy}>
                      <Text style={[styles.coachStepTitle, compact && styles.coachStepTitleCompact]}>{index + 1}. {compact ? step.mobileTitle : step.title}</Text>
                      <Text style={[styles.coachStepText, compact && styles.coachStepTextCompact]}>{compact ? step.mobileText : step.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={[styles.coachFooter, compact && styles.coachFooterCompact]}>
                <Text style={[styles.coachFooterText, compact && styles.coachFooterTextCompact]}>{compact ? 'Daily plan · Mock ladder · Rubric memory' : 'Daily plan · Mini Mock ladder · Rubric memory'}</Text>
              </View>
              <View style={[styles.coachModeStrip, compact && styles.coachModeStripCompact]}>
                {MODE_PILLS.map((pill) => (
                  <View key={pill.label} style={[styles.coachModePill, compact && styles.coachModePillCompact]}>
                    {pill.icon}
                    <Text style={[styles.coachModePillText, compact && styles.coachModePillTextCompact]}>{compact && pill.label === 'Text chat' ? 'Texting' : pill.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 34,
    paddingTop: 24,
    paddingBottom: 48,
  },
  scrollCompact: {
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 92,
  },
  content: {
    width: '100%',
    maxWidth: 930,
    alignSelf: 'center',
    gap: 22,
  },
  contentCompact: {
    maxWidth: 520,
    gap: 12,
  },
  mobileOnboardingScroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 42,
    paddingBottom: 34,
  },
  mobileOnboardingContent: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    gap: 14,
  },
  mobileOnboardingTopBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mobileHeroCourse: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFF2',
    padding: 16,
    gap: 15,
    shadowColor: Colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
  },
  mobileHeroCourseHover: {
    borderColor: '#86DDD6',
    backgroundColor: '#F7FFFD',
    shadowOpacity: 0.17,
  },
  mobileHeroCoursePressed: {
    backgroundColor: '#F0FBFA',
    transform: [{ translateY: 2 }],
  },
  mobileHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  mobileHeroMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
  },
  mobileHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  mobileHeroKicker: {
    color: Colors.primary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  mobileHeroTitle: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: 0,
  },
  mobileHeroSub: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  mobileHeroAction: {
    minHeight: 56,
    borderRadius: 19,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
  },
  mobileHeroActionText: {
    color: Colors.onPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  mobileFutureGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  mobileFutureCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFFD9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    overflow: 'hidden',
  },
  mobileFutureMark: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.62,
  },
  mobileFutureName: {
    color: Colors.textSub,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    opacity: 0.64,
  },
  mobileFutureBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFF2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
  mobileFutureBadgeText: {
    color: Colors.text,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mobileHowPanel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#BFEDEA',
    backgroundColor: '#F6FFFD',
    padding: 16,
    gap: 12,
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  mobileHowKicker: {
    color: Colors.teal,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  mobileHowTitle: {
    color: Colors.text,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: 0,
  },
  mobileHowSteps: {
    gap: 8,
  },
  mobileHowStep: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFFE8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  mobileHowStepIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileHowStepCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  mobileHowStepTitle: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
  },
  mobileHowStepText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  mobileModeStrip: {
    flexDirection: 'row',
    gap: 7,
  },
  mobileModePill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 7,
  },
  mobileModePillText: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  topBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  topBarCompact: {
    minHeight: 44,
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  editionPillCompact: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    gap: 8,
  },
  editionPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.cardTranslucent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: Colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  editionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  editionText: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  editionTextCompact: {
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 2.4,
  },
  heroGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 20,
  },
  heroGridCompact: {
    flexDirection: 'column',
  },
  heroPanel: {
    minHeight: 0,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.cardTranslucent,
    padding: 24,
    gap: 22,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  heroPanelWide: {
    flex: 1.45,
  },
  heroPanelCompact: {
    minHeight: 0,
    borderRadius: 27,
    padding: 17,
    gap: 16,
  },
  heroIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 8,
  },
  heroIntroCompact: {
    alignItems: 'flex-start',
    gap: 14,
    padding: 0,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: Colors.primary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 5,
    color: Colors.text,
    fontSize: 58,
    lineHeight: 64,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroTitleCompact: {
    fontSize: 34,
    lineHeight: 40,
  },
  heroSub: {
    marginTop: 8,
    maxWidth: 740,
    color: Colors.textSub,
    fontSize: 20,
    lineHeight: 29,
    fontWeight: '700',
  },
  heroSubCompact: {
    fontSize: 16,
    lineHeight: 24,
  },
  modeStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeStripCompact: {
    gap: 8,
  },
  modePill: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFFD9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  modePillText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  heroStartButton: {
    alignSelf: 'flex-start',
    minHeight: 66,
    minWidth: 230,
    borderRadius: 22,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    marginTop: 4,
    shadowColor: Colors.ink,
    shadowOpacity: 0.24,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 10 },
  },
  heroStartButtonHover: {
    backgroundColor: '#172640',
    shadowOpacity: 0.31,
    shadowRadius: 22,
  },
  heroStartButtonPressed: {
    backgroundColor: '#0B1424',
  },
  heroStartText: {
    color: Colors.onPrimary,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  coachPanel: {
    minWidth: 340,
    borderRadius: 34,
    backgroundColor: Colors.ink,
    padding: 26,
    gap: 22,
    shadowColor: Colors.ink,
    shadowOpacity: 0.24,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
  },
  coachPanelWide: {
    flex: 0.9,
  },
  coachPanelChoice: {
    width: 500,
    maxWidth: 500,
    flexShrink: 0,
    flexGrow: 0,
    flexBasis: 500,
    alignSelf: 'flex-start',
    zIndex: 1,
  },
  coachPanelStacked: {
    width: '100%',
    maxWidth: 900,
    flexBasis: 'auto',
    alignSelf: 'center',
  },
  coachPanelCompact: {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    flexBasis: 'auto',
    borderRadius: 24,
    padding: 18,
    gap: 12,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  coachPanelTop: {
    gap: 5,
  },
  coachKicker: {
    color: Colors.teal,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  coachKickerCompact: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.7,
  },
  coachTitle: {
    color: Colors.onPrimary,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: 0,
  },
  coachTitleCompact: {
    fontSize: 31,
    lineHeight: 34,
  },
  coachStepList: {
    gap: 13,
  },
  coachStepListCompact: {
    gap: 8,
  },
  coachStep: {
    minHeight: 78,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF1F',
    backgroundColor: '#FFFFFF10',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
  },
  coachStepCompact: {
    minHeight: 58,
    borderRadius: 17,
    gap: 9,
    padding: 9,
  },
  coachStepIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachStepIconCompact: {
    width: 36,
    height: 36,
    borderRadius: 13,
  },
  coachStepCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  coachStepTitle: {
    color: Colors.onPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  coachStepTitleCompact: {
    fontSize: 15,
    lineHeight: 18,
  },
  coachStepText: {
    color: '#FFFFFFB8',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  coachStepTextCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  coachFooter: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: '#FFFFFF14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  coachFooterCompact: {
    minHeight: 35,
    paddingHorizontal: 10,
  },
  coachFooterText: {
    color: '#FFFFFFCC',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  coachFooterTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  coachModeStrip: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  coachModeStripCompact: {
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: 6,
  },
  coachModePill: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFFFFF24',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  coachModePillCompact: {
    minHeight: 34,
    flexGrow: 1,
    flexBasis: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 5,
  },
  coachModePillText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  coachModePillTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  languageCardMotion: {
    width: '100%',
    marginTop: 0,
  },
  languageCardMotionCompact: {
    marginTop: 0,
  },
  languageCardMotionSquare: {
    width: 180,
    flexGrow: 0,
    flexBasis: 180,
  },
  languageCardMotionSquareCompact: {
    width: '31%',
    flexBasis: '31%',
    flexGrow: 0,
    minWidth: 84,
    maxWidth: 122,
  },
  languageCard: {
    minHeight: 226,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.cardTranslucent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
    padding: 28,
    shadowColor: Colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  languageCardActive: {
    borderColor: '#7AD5CF',
    backgroundColor: '#F7FFFD',
    shadowOpacity: 0.22,
    shadowRadius: 32,
  },
  languageCardPressed: {
    backgroundColor: '#EFFBF9',
  },
  languageCardCompact: {
    minHeight: 0,
    alignItems: 'flex-start',
    borderRadius: 27,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  languageCardSquare: {
    minHeight: 0,
    aspectRatio: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 26,
    overflow: 'hidden',
  },
  languageCardSquareCompact: {
    aspectRatio: 1,
    minHeight: 0,
    padding: 8,
    borderRadius: 19,
    gap: 7,
  },
  languageCardComingSoon: {
    backgroundColor: '#F8FAFC',
    borderColor: Colors.border,
  },
  courseImageWrap: {
    width: 118,
    height: 118,
    borderRadius: 28,
    backgroundColor: '#FFFFFFF0',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
  },
  courseImageWrapCompact: {
    width: 60,
    height: 60,
    borderRadius: 18,
  },
  courseImageWrapSquare: {
    width: 100,
    height: 100,
    borderRadius: 26,
  },
  courseImageWrapSquareCompact: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  courseImage: {
    width: '100%',
    height: '100%',
  },
  courseImageVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 27, 45, 0.10)',
  },
  courseBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#FFFFFFEB',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  courseBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  languageCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  languageCardCopySquare: {
    flex: 0,
    gap: 6,
  },
  languageCardTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  languageCardKicker: {
    color: Colors.primary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  languageCardKickerSquare: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 1.1,
  },
  levelChip: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: Colors.tealDim,
    borderWidth: 1,
    borderColor: '#BFEDEA',
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  levelChipSquare: {
    minHeight: 25,
    paddingHorizontal: 8,
  },
  levelChipText: {
    color: Colors.teal,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  levelChipTextSquare: {
    fontSize: 10,
    lineHeight: 13,
  },
  comingSoonChip: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  comingSoonChipText: {
    color: Colors.textMuted,
  },
  languageCardTitle: {
    color: Colors.text,
    fontSize: 50,
    lineHeight: 56,
    fontWeight: '900',
    letterSpacing: 0,
  },
  languageCardTitleCompact: {
    fontSize: 27,
    lineHeight: 32,
  },
  languageCardTitleSquare: {
    fontSize: 26,
    lineHeight: 30,
    textAlign: 'center',
  },
  languageCardTitleSquareCompact: {
    fontSize: 14,
    lineHeight: 17,
  },
  languageCardTitleMuted: {
    color: Colors.textSub,
  },
  languageCardBody: {
    color: Colors.textSub,
    fontSize: 20,
    lineHeight: 29,
    fontWeight: '700',
    maxWidth: 760,
  },
  languageCardBodyCompact: {
    fontSize: 15,
    lineHeight: 21,
  },
  languageCardBodySquare: {
    fontSize: 12,
    lineHeight: 16,
    maxWidth: '100%',
  },
  languageSkillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  languageSkillRowCompact: {
    gap: 7,
    marginTop: 2,
  },
  languageSkillRowSquare: {
    gap: 5,
    marginTop: 1,
  },
  languageSkillPill: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFFD9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  languageSkillPillSquare: {
    minHeight: 26,
    paddingHorizontal: 7,
    gap: 5,
  },
  languageSkillPillMuted: {
    backgroundColor: '#F8FAFC',
  },
  languageSkillText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  languageSkillTextMuted: {
    color: Colors.textSub,
  },
  languageSkillTextSquare: {
    fontSize: 11,
    lineHeight: 14,
  },
  startButton: {
    minHeight: 64,
    borderRadius: 22,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 26,
    shadowColor: Colors.ink,
    shadowOpacity: 0.24,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 10 },
  },
  startButtonSquare: {
    alignSelf: 'stretch',
    minHeight: 38,
    borderRadius: 14,
  },
  startButtonText: {
    color: Colors.onPrimary,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  startButtonTextSquare: {
    fontSize: 14,
    lineHeight: 18,
  },
  comingSoonButton: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  comingSoonButtonSquare: {
    alignSelf: 'stretch',
    minHeight: 36,
    borderRadius: 13,
  },
  comingSoonButtonText: {
    color: Colors.textMuted,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  comingSoonButtonTextSquare: {
    fontSize: 12,
    lineHeight: 15,
  },
  futureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 2,
  },
  futureRowCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  sectionKicker: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  sectionTitleCompact: {
    fontSize: 23,
    lineHeight: 28,
  },
  futureNote: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    textAlign: 'right',
  },
  futureGrid: {
    gap: 12,
  },
  courseSquareGrid: {
    width: 376,
    maxWidth: 376,
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 376,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 16,
    zIndex: 2,
  },
  courseSquareGridStacked: {
    width: '100%',
    maxWidth: 620,
    flexBasis: 'auto',
    justifyContent: 'center',
  },
  courseSquareGridCompact: {
    width: '100%',
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  courseCoachGrid: {
    width: 900,
    maxWidth: '100%',
    alignSelf: 'center',
    marginTop: 42,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 24,
    overflow: 'visible',
  },
  courseCoachGridCompact: {
    marginTop: 8,
    gap: 12,
  },
  languageComingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF96',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageComingSoonOverlayCompact: {
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    paddingTop: 7,
  },
  languageComingSoonOverlayText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    backgroundColor: '#FFFFFFE8',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  languageComingSoonOverlayTextCompact: {
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 0.9,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  courseCoachGridStacked: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 22,
  },
});
