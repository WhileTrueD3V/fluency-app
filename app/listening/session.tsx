import React, { useEffect } from 'react';
import {
  Animated,
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/colors';
import { DrillAccents } from '@/constants/drillAccents';
import {
  getPrefs,
  getDrillSessionContent,
  getRecentPromptIds,
  getSavedItems,
  getStartingLevelProfile,
  getSessionHistory,
  getStatsForLanguage,
  hasCompletedRewardKey,
  recordAttemptMemory,
  recordListeningSession,
  recordPromptExposure,
  saveDrillSessionContent,
  removeSavedItem,
  saveItem,
} from '@/utils/storage';
import { getListeningQuestionById, getRandomListeningQuestions } from '@/data';
import { getLanguage, type LanguageCode } from '@/constants/languages';
import { useListeningSession } from '@/hooks/useListeningSession';
import { AnswerChoice } from '@/components/AnswerChoice';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { AudioWaveform } from '@/components/AudioWaveform';
import { DrillLoadingState } from '@/components/DrillLoadingState';
import { DrillHeader } from '@/components/DrillHeader';
import { FuriganaText } from '@/components/FuriganaText';
import { XpBurst } from '@/components/XpBurst';
import {
  getGeneratedPracticeMemory,
  loadGeneratedPracticeCache,
  refreshGeneratedPracticeCache,
  selectPracticeItems,
} from '@/utils/practiceContentQueue';
import {
  chooseStrongestChallengeBoost,
  getAstroChallengeBoostState,
  getChallengeBoostState,
  type ChallengeBoostState,
} from '@/utils/challengeBoost';
import { getPlayerLevel } from '@/utils/progression';
import { parseTargetSkillsParam } from '@/utils/targetSkills';
import {
  BookmarkIcon,
  CheckIcon,
  FlameIcon,
  PlayIcon,
  StarIcon,
  StopIcon,
  TargetIcon,
  XIcon,
} from '@/components/Icons';
import type { ListeningQuestion } from '@/data/types';

const SESSION_LENGTH = 10;

const INACTIVE_CHALLENGE_BOOST: ChallengeBoostState = {
  active: false,
  multiplier: 1,
  tier: 0,
  label: 'standard level fit',
  baseLevel: 1,
  effectiveLevel: 1,
  difficulty: 'beginner',
  signal: {
    samples: 0,
    average: 0,
    strongCount: 0,
    excellentCount: 0,
    lowCount: 0,
  },
};

function PlayButton({
  isPlaying,
  phase,
  playCount,
  canPlay,
  onPress,
  compact,
  tight,
}: {
  isPlaying: boolean;
  phase: string;
  playCount: number;
  canPlay: boolean;
  onPress: () => void;
  compact?: boolean;
  tight?: boolean;
}) {
  const canPress = isPlaying || ((phase === 'idle' || phase === 'answering') && canPlay);
  const iconSize = tight ? 20 : compact ? 23 : 30;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!canPress}
      activeOpacity={0.75}
      style={[styles.playBtn, compact && styles.playBtnCompact, tight && styles.playBtnTight, isPlaying && styles.playBtnActive, !canPress && styles.playBtnDisabled]}
    >
      {isPlaying ? (
        <StopIcon size={tight ? 19 : compact ? 22 : 28} color={Colors.onPrimary} strokeWidth={2.2} />
      ) : !canPlay ? (
        <XIcon size={tight ? 19 : compact ? 22 : 28} color={Colors.textMuted} strokeWidth={2.2} />
      ) : (
        <PlayIcon size={iconSize} color={Colors.onPrimary} strokeWidth={2.2} />
      )}
    </TouchableOpacity>
  );
}

export default function ListeningSession() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const isTight = width < 1120;
  const drillCompact = isCompact || isTight;
  const params = useLocalSearchParams<{
    promptId?: string;
    languageCode?: string;
    sessionId?: string;
    count?: string;
    mockId?: string;
    rewardKey?: string;
    targetSkills?: string;
  }>();
  const [langCode, setLangCode] = React.useState<LanguageCode>('ja');
  const [questions, setQuestions] = React.useState<ListeningQuestion[]>([]);
  const [ready, setReady] = React.useState(false);
  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set());
  const [showStreakModal, setShowStreakModal] = React.useState(true);
  const [rewardClaimed, setRewardClaimed] = React.useState(false);
  const [challengeBoost, setChallengeBoost] = React.useState<ChallengeBoostState>(INACTIVE_CHALLENGE_BOOST);
  const flashOpacity = React.useRef(new Animated.Value(0)).current;
  const shakeX = React.useRef(new Animated.Value(0)).current;
  const cardScale = React.useRef(new Animated.Value(1)).current;
  const xpOpacity = React.useRef(new Animated.Value(0)).current;
  const xpTranslateY = React.useRef(new Animated.Value(12)).current;
  const xpScale = React.useRef(new Animated.Value(0.82)).current;
  const completedSessionRef = React.useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const prefs = await getPrefs();
      const code = ((params.languageCode as LanguageCode | undefined) ?? prefs.selectedLanguage ?? 'ja') as LanguageCode;
      const savedQuestion = params.promptId
        ? getListeningQuestionById(code, params.promptId)
        : null;
      const requestedCount = Number(params.count);
      const sessionLength = Number.isFinite(requestedCount)
        ? Math.max(1, Math.min(SESSION_LENGTH, requestedCount))
        : SESSION_LENGTH;
      const routeTargetSkills = parseTargetSkillsParam(params.targetSkills);
      setLangCode(code);
      setReady(false);

      const [savedItems, stats, recentPromptIds, storedGenerated, sessions] = await Promise.all([
        getSavedItems(),
        getStatsForLanguage(code),
        getRecentPromptIds(code, 'listening'),
        loadGeneratedPracticeCache<ListeningQuestion>('listening', code),
        getSessionHistory(),
      ]);
      if (cancelled) return;
      const level = getPlayerLevel(stats.totalXP);
      const startingProfile = await getStartingLevelProfile();
      const languageSessions = sessions.filter((session) => session.languageCode === code);
      const boost = !savedQuestion && !params.mockId
        ? chooseStrongestChallengeBoost(
          getChallengeBoostState(level.level, languageSessions, 'listening'),
          getAstroChallengeBoostState(level.level, startingProfile, sessions, code),
        )
        : INACTIVE_CHALLENGE_BOOST;
      setChallengeBoost(boost);
      setSavedIds(new Set(
        savedItems
          .filter((item) => item.type === 'listening' && item.languageCode === code)
          .map((item) => item.promptId),
      ));

      if (savedQuestion) {
        setQuestions([savedQuestion]);
        setReady(true);
        return;
      }

      const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;
      const storedSessionQuestions = await getDrillSessionContent<ListeningQuestion>(code, 'listening', sessionId);
      if (storedSessionQuestions.length > 0) {
        setQuestions(storedSessionQuestions.slice(0, sessionLength));
        setReady(true);
        return;
      }

      let cachedQuestions = selectPracticeItems([
        ...storedGenerated,
        ...getGeneratedPracticeMemory<ListeningQuestion>('listening', code),
      ], sessionLength, recentPromptIds);
      if (cachedQuestions.length < sessionLength) {
        const refreshed = await refreshGeneratedPracticeCache({
          mode: 'listening',
          languageCode: code,
          totalXP: stats.totalXP,
          recentPromptIds,
          count: Math.max(6, sessionLength),
          targetSkills: [
            ...routeTargetSkills,
            'fresh AP listening topics',
            'clear four-choice answer design',
            'avoid repeating recent prompt topic families',
          ],
        });
        if (cancelled) return;
        cachedQuestions = selectPracticeItems([
          ...(refreshed as ListeningQuestion[]),
          ...storedGenerated,
          ...getGeneratedPracticeMemory<ListeningQuestion>('listening', code),
        ], sessionLength, recentPromptIds);
      }
      const fallbackQuestions = getRandomListeningQuestions(
        code,
        sessionLength,
        stats.totalXP,
        [
          ...recentPromptIds,
          ...cachedQuestions.map((question) => question.id),
        ],
      );
      const nextQuestions = selectPracticeItems([
        ...cachedQuestions,
        ...fallbackQuestions,
        ...getRandomListeningQuestions(code, sessionLength, 0, []),
      ], sessionLength, recentPromptIds, cachedQuestions);

      setQuestions(nextQuestions);
      setReady(nextQuestions.length > 0);
      await saveDrillSessionContent(code, 'listening', sessionId, nextQuestions);
      if (nextQuestions.length > 0) {
        void recordPromptExposure(code, 'listening', nextQuestions.map((question) => question.id));
      }
      if (cachedQuestions.length < sessionLength) {
        void refreshGeneratedPracticeCache({
          mode: 'listening',
          languageCode: code,
          totalXP: stats.totalXP,
          recentPromptIds: [
            ...recentPromptIds,
            ...nextQuestions.map((question) => question.id),
          ],
          count: Math.max(6, sessionLength),
          targetSkills: [
            ...routeTargetSkills,
            'fresh AP listening topics',
            'clear four-choice answer design',
          ],
        });
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [params.count, params.languageCode, params.promptId, params.sessionId, params.targetSkills]);

  const rewardKey = String(
    params.rewardKey
    ?? params.sessionId
    ?? params.promptId
    ?? (params.mockId ? `${params.mockId}:listening` : questions.map((question) => question.id).join('|')),
  );

  useEffect(() => {
    let cancelled = false;
    hasCompletedRewardKey(langCode, 'listening', rewardKey).then((claimed) => {
      if (!cancelled) setRewardClaimed(claimed);
    });
    return () => {
      cancelled = true;
    };
  }, [langCode, rewardKey]);

  const language = getLanguage(langCode);

  const {
    state,
    currentQuestion,
    correctCount,
    currentPlayCount,
    canPlayCurrentAudio,
    playbackRate,
    cyclePlaybackRate,
    playAudio,
    stopAudio,
    submitAnswer,
    advanceAfterFeedback,
  } = useListeningSession(questions, language.ttsLocale, !rewardClaimed, challengeBoost.multiplier);

  const exitSession = () => {
    stopAudio();
    router.replace('/(home)');
  };

  // Auto-play on new question
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (state.phase === 'idle' && ready && currentQuestion) {
      const timer = setTimeout(playAudio, 300);
      return () => clearTimeout(timer);
    }
  }, [state.currentIndex, state.phase, ready, currentQuestion, playAudio]);

  // Session complete — save stats
  useEffect(() => {
    if (state.phase === 'complete') {
      if (completedSessionRef.current === rewardKey) return;
      completedSessionRef.current = rewardKey;
      void recordListeningSession(
        langCode,
        correctCount,
        state.answers.length,
        state.bestStreak,
        state.totalXP,
        params.mockId,
        rewardKey,
      );
      void recordAttemptMemory(state.answers.map((answer) => {
        const question = questions.find((item) => item.id === answer.questionId);
        return {
          type: 'listening' as const,
          languageCode: langCode,
          promptId: answer.questionId,
          score: answer.isCorrect ? 100 : 0,
          correct: answer.isCorrect,
          question: question?.question ?? 'Listening question',
          userAnswer: question?.choices[answer.selectedIndex] ?? 'No answer captured',
          expectedAnswer: question?.choices[answer.correctIndex] ?? '',
          context: question ? `${question.context}. Audio: ${question.transcript}` : undefined,
          weakSkills: answer.isCorrect ? [] : ['Task completion', 'Listening detail'],
        };
      }));
    }
  }, [state.phase, langCode, correctCount, questions, state.answers, state.bestStreak, state.totalXP, params.mockId, rewardKey]);

  // Duolingo-style answer feedback
  useEffect(() => {
    if (state.phase !== 'feedback') return;

    const latestAnswer = state.answers[state.answers.length - 1];
    if (!latestAnswer) return;

    flashOpacity.setValue(0);
    shakeX.setValue(0);
    cardScale.setValue(1);
    xpOpacity.setValue(0);
    xpTranslateY.setValue(12);
    xpScale.setValue(0.82);

    if (latestAnswer.isCorrect) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 520, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.spring(cardScale, { toValue: 1.03, friction: 4, tension: 160, useNativeDriver: true }),
          Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.timing(xpOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
            Animated.spring(xpTranslateY, { toValue: -22, friction: 7, tension: 80, useNativeDriver: true }),
            Animated.spring(xpScale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
          ]),
          Animated.timing(xpOpacity, { toValue: 0, duration: 420, delay: 420, useNativeDriver: true }),
        ]),
      ]).start();
      return;
    }

    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start();
  }, [cardScale, flashOpacity, shakeX, state.answers, state.phase, xpOpacity, xpScale, xpTranslateY]);

  const handleSave = async () => {
    if (!currentQuestion) return;
    haptics.impact('light');
    if (savedIds.has(currentQuestion.id)) {
      await removeSavedItem(currentQuestion.id, 'listening');
      setSavedIds((current) => {
        const next = new Set(current);
        next.delete(currentQuestion.id);
        return next;
      });
      return;
    }
    await saveItem({
      id: `ls-${currentQuestion.id}-${Date.now()}`,
      type: 'listening',
      languageCode: langCode,
      promptId: currentQuestion.id,
      question: currentQuestion.question,
      answer: `Audio: ${currentQuestion.transcript}\nAnswer: ${currentQuestion.choices[currentQuestion.correctIndex]}`,
    });
    setSavedIds((s) => new Set([...s, currentQuestion.id]));
  };

  const handlePlayToggle = () => {
    if (state.isPlaying) {
      stopAudio();
    } else {
      playAudio();
    }
  };

  const handleSpeedToggle = () => {
    haptics.impact('light');
    cyclePlaybackRate();
  };

  const playbackRateLabel = `${playbackRate.toFixed(2)}x`;

  if (!ready || questions.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <DrillLoadingState mode="listening" />
      </SafeAreaView>
    );
  }

  // Complete screen
  if (state.phase === 'complete') {
    const accuracy = state.answers.length > 0
      ? Math.round((correctCount / state.answers.length) * 100)
      : 0;

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.completeScroll}>
          <View style={styles.completeCard}>
            <View style={styles.completeBadge}>
              <TargetIcon size={34} color={accuracy >= 70 ? Colors.success : DrillAccents.listening} strokeWidth={2} />
            </View>
            <Text style={styles.completeKicker}>AP Listening</Text>
            <Text style={styles.completeTitle}>Session complete</Text>
            <Text style={styles.completeSubtitle}>
              {accuracy >= 70 ? 'Nice signal. Your listening accuracy is moving in the right direction.' : 'Good rep. Review the missed details, then run one tighter set.'}
            </Text>

            <View style={styles.completeStats}>
              <View style={styles.completeStat}>
                <Text style={styles.completeStatValue}>{correctCount}/{state.answers.length}</Text>
                <Text style={styles.completeStatLabel}>Correct</Text>
              </View>
              <View style={styles.completeStat}>
                <Text style={[styles.completeStatValue, { color: Colors.success }]}>{accuracy}%</Text>
                <Text style={styles.completeStatLabel}>Accuracy</Text>
              </View>
              <View style={styles.completeStat}>
                <View style={styles.completeValueRow}>
                  <FlameIcon size={20} color={Colors.warning} />
                  <Text style={[styles.completeStatValue, { color: Colors.warning }]}>{state.bestStreak}</Text>
                </View>
                <Text style={styles.completeStatLabel}>Best Streak</Text>
              </View>
              <View style={styles.completeStat}>
                <View style={styles.completeValueRow}>
                  <StarIcon size={20} color={Colors.gold} />
                  <Text style={[styles.completeStatValue, { color: Colors.gold }]}>{state.totalXP}</Text>
                </View>
                <Text style={styles.completeStatLabel}>XP Earned</Text>
              </View>
            </View>

            <View style={styles.completeActions}>
              {!params.mockId && (
                <TouchableOpacity
                  onPress={() => router.replace({
                    pathname: '/listening/session',
                    params: { sessionId: `${Date.now()}`, rewardKey, languageCode: langCode },
                  })}
                  style={styles.playAgainBtn}
                >
                  <Text style={styles.playAgainText}>Play again</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => router.replace(params.mockId ? '/mock' : '/(home)')}
                style={styles.homeBtn}
              >
                <Text style={styles.homeBtnText}>{params.mockId ? 'Back to mock' : 'Home'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        <Modal transparent animationType="none" visible={showStreakModal && state.bestStreak > 0} onRequestClose={() => setShowStreakModal(false)}>
          <View style={[styles.streakOverlay, isCompact && styles.streakOverlayCompact]}>
            <View style={[styles.streakCard, isCompact && styles.streakCardCompact, isCompact && { maxHeight: Math.max(320, height - 92) }]}>
              <TouchableOpacity onPress={() => setShowStreakModal(false)} style={styles.streakClose} accessibilityLabel="Close streak update">
                <XIcon size={19} color={Colors.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
              <View style={[styles.streakRing, isCompact && styles.streakRingCompact]}>
                <FlameIcon size={38} color={Colors.warning} strokeWidth={2.2} />
              </View>
              <Text style={[styles.streakTitle, isCompact && styles.streakTitleCompact]}>Listening streak grew</Text>
              <Text style={[styles.streakText, isCompact && styles.streakTextCompact]}>
                You held a {state.bestStreak}-answer run. Come back tomorrow to keep your AP rhythm warm.
              </Text>
              <View style={[styles.streakWeek, isCompact && styles.streakWeekCompact]}>
                {['M', 'T', 'W', 'T', 'F'].map((day, index) => (
                  <View key={`${day}-${index}`} style={[styles.streakDay, isCompact && styles.streakDayCompact, index === 0 && styles.streakDayActive]}>
                    <Text style={[styles.streakDayText, index === 0 && styles.streakDayTextActive]}>{day}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={() => setShowStreakModal(false)} style={[styles.streakDoneBtn, isCompact && styles.streakDoneBtnCompact]}>
                <Text style={styles.streakDoneText}>Awesome</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView style={styles.safe}>
        <DrillLoadingState
          mode="listening"
          title="Preparing listening round"
          subtitle="Setting up the next prompt without changing your progress."
        />
      </SafeAreaView>
    );
  }

  const isSaved = savedIds.has(currentQuestion.id);
  const isAnswered = state.phase === 'feedback';
  const latestAnswer = state.answers[state.answers.length - 1];
  const feedbackColor = latestAnswer?.isCorrect ? Colors.success : Colors.error;

  return (
    <SafeAreaView style={styles.safe}>
      {drillCompact && <Text style={[styles.bgGlyph, isTight && styles.bgGlyphTight]}>聴</Text>}
      {latestAnswer?.isCorrect && (
        <Animated.View
          pointerEvents="none"
          style={[styles.flash, { backgroundColor: feedbackColor, opacity: flashOpacity }]}
        />
      )}
      {latestAnswer?.isCorrect && isAnswered && latestAnswer.xpEarned > 0 && (
        <XpBurst xp={latestAnswer.xpEarned} opacity={xpOpacity} translateY={xpTranslateY} scale={xpScale} />
      )}
      <View style={styles.container}>
        <DrillHeader
          current={Math.min(state.currentIndex + 1, questions.length)}
          total={questions.length}
          streak={state.streak}
          xp={state.totalXP}
          saved={isSaved}
          onQuit={exitSession}
          onSave={handleSave}
          accent={DrillAccents.listening}
        />

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            drillCompact && styles.scrollCompact,
            isTight && (isCompact ? styles.scrollTightMobile : styles.scrollTight),
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.stageGrid, !drillCompact && styles.stageGridDesktop, isTight && styles.stageGridTight]}>
            <View style={[styles.stageMain, isTight && styles.stageMainTight]}>
              <View style={[styles.drillPromptCard, drillCompact && styles.drillPromptCardCompact, isTight && styles.drillPromptCardTight]}>
                <View style={styles.drillPromptHeader}>
                  <Text style={styles.drillPromptLabel}>Listen, then choose</Text>
                  <View style={styles.drillPromptBadge}>
                    <Text style={styles.drillPromptBadgeText} numberOfLines={1}>{currentQuestion.context}</Text>
                  </View>
                </View>
                <Text style={[styles.question, drillCompact && styles.questionCompact, isTight && styles.questionTight]}>{currentQuestion.question}</Text>
              </View>

              <Animated.View
                style={[
                  styles.audioCard,
                  drillCompact && styles.audioCardCompact,
                  isTight && styles.audioCardTight,
                  { transform: [{ scale: cardScale }, { translateX: shakeX }] },
                ]}
              >
                <View style={[styles.audioPlayerRow, drillCompact && styles.audioPlayerRowCompact, isTight && styles.audioPlayerRowTight]}>
                  <PlayButton
                    isPlaying={state.isPlaying}
                    phase={state.phase}
                    playCount={currentPlayCount}
                    canPlay={canPlayCurrentAudio}
                    onPress={handlePlayToggle}
                    compact={drillCompact}
                    tight={isTight}
                  />
                  <View style={[styles.audioWavePanel, drillCompact && styles.audioWavePanelCompact, isTight && styles.audioWavePanelTight]}>
                    <AudioWaveform isPlaying={state.isPlaying} color={DrillAccents.listening} barCount={isTight ? 6 : 7} />
                    <View style={styles.audioMetaRow}>
                      <Text style={[styles.audioMetaText, drillCompact && styles.audioMetaTextCompact, isTight && styles.audioMetaTextTight]}>{state.isPlaying ? 'Playing' : canPlayCurrentAudio ? 'Ready' : 'Limit reached'}</Text>
                      <View style={styles.audioMetaRight}>
                        {isTight && (
                          <TouchableOpacity
                            onPress={handleSpeedToggle}
                            activeOpacity={0.78}
                            style={styles.audioSpeedBtn}
                            accessibilityLabel={`Playback speed ${playbackRateLabel}. Tap to change speed.`}
                          >
                            <Text style={styles.audioSpeedText}>{playbackRateLabel}</Text>
                          </TouchableOpacity>
                        )}
                        <Text style={[styles.audioMetaText, drillCompact && styles.audioMetaTextCompact, isTight && styles.audioMetaTextTight]}>{Math.min(currentPlayCount, 2)}/2 plays</Text>
                      </View>
                    </View>
                  </View>
                </View>
                {state.audioError && (
                  <Text style={styles.audioErrorText}>{state.audioError}</Text>
                )}
              </Animated.View>

              <View style={[styles.choices, drillCompact && styles.choicesCompact, isTight && styles.choicesTight]}>
                {currentQuestion.choices.map((choice, idx) => {
                  let choiceState: 'idle' | 'selected-correct' | 'selected-wrong' | 'reveal-correct' = 'idle';
                  if (isAnswered) {
                    if (idx === currentQuestion.correctIndex) {
                      choiceState = 'reveal-correct';
                    } else if (idx === state.selectedIndex) {
                      choiceState = 'selected-wrong';
                    }
                    if (idx === state.selectedIndex && idx === currentQuestion.correctIndex) {
                      choiceState = 'selected-correct';
                    }
                  }

                  return (
                    <AnswerChoice
                      key={idx}
                      label={choice}
                      index={idx}
                      choiceState={choiceState}
                      disabled={isAnswered}
                      onPress={() => submitAnswer(idx)}
                      compact={drillCompact}
                      mobile={isCompact}
                      accent={DrillAccents.listening}
                    />
                  );
                })}
              </View>

              {isAnswered && (
                <View style={[
                  styles.feedbackBanner,
                  {
                    backgroundColor:
                      state.selectedIndex === currentQuestion.correctIndex
                        ? Colors.successDim
                        : Colors.errorDim,
                    borderColor:
                      state.selectedIndex === currentQuestion.correctIndex
                        ? Colors.success
                        : Colors.error,
                  },
                ]}>
                  <View style={styles.feedbackIcon}>
                    {state.selectedIndex === currentQuestion.correctIndex ? (
                      <CheckIcon size={20} color={Colors.success} />
                    ) : (
                      <XIcon size={20} color={Colors.error} />
                    )}
                  </View>
                  <View style={styles.feedbackBody}>
                    <Text style={[
                      styles.feedbackResult,
                      {
                        color: state.selectedIndex === currentQuestion.correctIndex
                          ? Colors.success : Colors.error,
                      },
                    ]}>
                      {state.selectedIndex === currentQuestion.correctIndex ? 'Correct!' : 'Not quite'}
                    </Text>
                    {state.selectedIndex !== currentQuestion.correctIndex && (
                      <Text style={styles.feedbackCorrect}>
                        Answer: {currentQuestion.choices[currentQuestion.correctIndex]}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={handleSave} style={styles.saveIconBtn}>
                    {isSaved ? (
                      <CheckIcon size={20} color={Colors.success} />
                    ) : (
                      <BookmarkIcon size={20} color={Colors.textSub} />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {isAnswered && (
                <View style={styles.transcriptReveal}>
                  <Text style={styles.transcriptRevealLabel}>What was said:</Text>
                  {langCode === 'ja' ? (
                    <FuriganaText text={currentQuestion.transcript} />
                  ) : (
                    <Text style={styles.transcriptRevealText}>{currentQuestion.transcript}</Text>
                  )}
                  <Text style={styles.transcriptRevealTranslation}>
                    {currentQuestion.translation}
                  </Text>
                </View>
              )}
            </View>

            {!isTight && <View style={[styles.stageSide, isCompact && styles.stageSideCompact]}>
              <Text style={styles.sideLabel}>Listening round</Text>
              <Text style={styles.sideTitle}>Question {Math.min(state.currentIndex + 1, questions.length)} of {questions.length}</Text>
              <View style={styles.sideStatRow}>
                <View style={styles.sideStat}>
                  <Text style={styles.sideStatValue}>{state.totalXP}</Text>
                  <Text style={styles.sideStatLabel}>XP</Text>
                </View>
                <View style={styles.sideStat}>
                  <Text style={styles.sideStatValue}>{state.streak}</Text>
                  <Text style={styles.sideStatLabel}>Streak</Text>
                </View>
              </View>
              <View style={[styles.audioControlRow, isCompact && styles.audioControlRowCompact]}>
                <View
                  style={[styles.audioChipActive, isCompact && styles.audioChipActiveCompact]}
                  accessibilityLabel={`Current playback speed: ${playbackRateLabel}`}
                >
                  <Text style={styles.audioChipActiveText}>Speed</Text>
                </View>
                <TouchableOpacity
                  onPress={handleSpeedToggle}
                  activeOpacity={0.78}
                  style={[styles.audioChip, isCompact && styles.audioChipCompact]}
                  accessibilityLabel={`Playback speed ${playbackRateLabel}. Tap to change speed.`}
                >
                  <Text style={styles.audioChipText}>{playbackRateLabel}</Text>
                </TouchableOpacity>
              </View>
              {!isCompact && (
                <Text style={styles.audioLimitText}>Listen up to 2 times. Choose the answer from what you hear.</Text>
              )}
              <TouchableOpacity
                onPress={isAnswered ? advanceAfterFeedback : handlePlayToggle}
                activeOpacity={0.86}
                style={[styles.sidePrimaryBtn, !isAnswered && styles.sidePrimaryBtnSecondary]}
              >
                <Text style={[styles.sidePrimaryText, !isAnswered && styles.sidePrimaryTextSecondary]}>
                  {isAnswered ? (state.currentIndex + 1 >= questions.length ? 'Finish' : 'Continue') : state.isPlaying ? 'Stop audio' : 'Play audio'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.82}
                style={[styles.feedbackSaveBtn, isSaved && styles.feedbackSaveBtnDone]}
              >
                {isSaved
                  ? <CheckIcon size={17} color={Colors.success} />
                  : <BookmarkIcon size={17} color={Colors.textSub} />}
                <Text style={[styles.feedbackSaveText, isSaved && styles.feedbackSaveTextDone]}>
                  {isSaved ? 'Saved' : 'Save to Library'}
                </Text>
              </TouchableOpacity>
            </View>}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBFCFD' },
  bgGlyph: {
    position: 'absolute',
    right: -90,
    top: 54,
    fontSize: 470,
    color: Colors.bgGlyph,
    fontFamily: undefined,
  },
  bgGlyphTight: {
    right: -58,
    top: 34,
    fontSize: 360,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textSub, fontSize: 16 },

  scroll: { paddingHorizontal: 32, paddingTop: 30, gap: 20, paddingBottom: 120, maxWidth: 1220, width: '100%', alignSelf: 'center' },
  scrollCompact: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 28,
    paddingBottom: 158,
    gap: 12,
  },
  scrollTight: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 28,
    gap: 8,
    maxWidth: 1040,
  },
  scrollTightMobile: {
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 158,
    gap: 8,
  },
  stageGrid: {
    gap: 18,
  },
  stageGridTight: {
    gap: 12,
  },
  stageGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 42,
  },
  stageMain: {
    flex: 1,
    minWidth: 0,
    gap: 18,
  },
  stageMainTight: {
    gap: 12,
  },
  stageSide: {
    width: 270,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E1E6EE',
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 14,
    shadowColor: '#101820',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  stageSideCompact: {
    width: '100%',
    borderRadius: 18,
    padding: 12,
    gap: 9,
  },

  contextBadge: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignSelf: 'flex-start',
  },
  drillPromptCard: {
    backgroundColor: Colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    gap: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  drillPromptCardCompact: {
    borderRadius: 26,
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFFF2',
    borderColor: '#D9E2EC',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  drillPromptCardTight: {
    borderRadius: 26,
    padding: 16,
    gap: 12,
  },
  drillPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  drillPromptLabel: {
    flex: 1,
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
  },
  drillPromptBadge: {
    maxWidth: 128,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  drillPromptBadgeText: {
    color: Colors.textSub,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  contextText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  contextTextTight: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.7,
  },
  tightMetaBar: {
    minHeight: 42,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDE6EF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tightMetaItem: {
    minWidth: 64,
    flex: 1,
  },
  tightMetaValue: {
    color: '#101820',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  tightMetaLabel: {
    color: '#64748B',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  tightSpeedBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tightSpeedText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
  },
  audioCard: {
    backgroundColor: '#F4F7F9',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5EAF1',
    padding: 22,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  audioCardCompact: {
    borderRadius: 26,
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFFF0',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  audioCardTight: {
    borderRadius: 23,
    padding: 14,
    gap: 10,
  },
  audioPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    width: '100%',
  },
  audioPlayerRowCompact: {
    gap: 12,
  },
  audioPlayerRowTight: {
    gap: 14,
  },
  audioWavePanel: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  audioWavePanelCompact: {
    gap: 6,
  },
  audioWavePanelTight: {
    gap: 3,
  },
  playBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: DrillAccents.listening,
    borderWidth: 0,
    shadowColor: DrillAccents.listening,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  playBtnCompact: {
    width: 74,
    height: 74,
    borderRadius: 37,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  playBtnTight: {
    width: 66,
    height: 66,
    borderRadius: 33,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  playBtnActive: {
    backgroundColor: DrillAccents.listening,
  },
  playBtnDisabled: {
    backgroundColor: Colors.surface,
    opacity: 0.72,
  },
  audioMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  audioMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioSpeedBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  audioSpeedText: {
    color: Colors.textSub,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  audioMetaText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  audioMetaTextCompact: {
    fontSize: 11,
  },
  audioMetaTextTight: {
    fontSize: 10,
    lineHeight: 12,
  },
  audioControlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  audioControlRowCompact: {
    gap: 8,
    paddingTop: 10,
  },
  audioChipActive: {
    borderRadius: 999,
    backgroundColor: DrillAccents.listening,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  audioChipActiveCompact: {
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  audioChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  audioChipCompact: {
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  audioChipActiveText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  audioChipText: {
    color: Colors.textSub,
    fontSize: 13,
    fontWeight: '800',
  },
  audioLimitText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  audioErrorText: {
    color: Colors.warning,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 320,
  },

  question: {
    color: '#101820',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
  },
  questionCompact: { fontSize: 24, lineHeight: 29, fontFamily: undefined, fontWeight: '900' },
  questionTight: { fontSize: 22, lineHeight: 27 },

  choices: { gap: 10 },
  choicesCompact: { gap: 8 },
  choicesTight: { gap: 7 },

  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  feedbackIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  feedbackBody: { flex: 1, gap: 2 },
  feedbackResult: { fontSize: 16, fontWeight: '900' },
  feedbackCorrect: { fontSize: 14, color: Colors.textSub, lineHeight: 20, fontWeight: '700' },
  saveIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  sideLabel: {
    color: DrillAccents.listening,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sideTitle: {
    color: '#101820',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  sideStatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sideStat: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5EAF1',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sideStatValue: {
    color: '#101820',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
  },
  sideStatLabel: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sidePrimaryBtn: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#FFC33D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 5,
    borderBottomColor: '#D19A14',
    shadowColor: '#9D6A00',
    shadowOpacity: 0.24,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
  },
  sidePrimaryBtnSecondary: {
    backgroundColor: DrillAccents.listening,
    borderBottomColor: '#A93425',
    shadowColor: DrillAccents.listening,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  sidePrimaryText: {
    color: '#101820',
    fontSize: 16,
    fontWeight: '900',
  },
  sidePrimaryTextSecondary: {
    color: Colors.onPrimary,
  },
  feedbackSaveBtn: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  feedbackSaveBtnDone: {
    borderColor: Colors.success,
    backgroundColor: Colors.successDim,
  },
  feedbackSaveText: { color: Colors.textSub, fontSize: 15, fontWeight: '800' },
  feedbackSaveTextDone: { color: Colors.success },
  feedbackNextBtn: {
    flex: 1,
    minHeight: 66,
    borderRadius: 28,
    backgroundColor: DrillAccents.listening,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackNextText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  transcriptReveal: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 4,
  },
  transcriptRevealLabel: {
    color: Colors.textSub, fontSize: 11,
    fontWeight: '600', textTransform: 'uppercase',
  },
  transcriptRevealText: { color: Colors.text, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  transcriptRevealTranslation: { color: Colors.textSub, fontSize: 14, lineHeight: 21, fontWeight: '600' },

  // Complete screen
  completeScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 56,
  },
  completeCard: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
    padding: 30,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#101820',
    shadowOpacity: 0.09,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 5,
  },
  completeBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DrillAccents.listening}18`,
    borderWidth: 1,
    borderColor: DrillAccents.listening,
  },
  completeKicker: {
    color: DrillAccents.listening,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  completeTitle: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  completeSubtitle: {
    maxWidth: 440,
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  completeStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  completeStat: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    width: '48%',
    minHeight: 88,
    justifyContent: 'center',
    gap: 4,
  },
  completeStatValue: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    color: Colors.text,
  },
  completeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  completeStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  completeActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  playAgainBtn: {
    backgroundColor: DrillAccents.listening,
    borderRadius: 18,
    minHeight: 56,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 5,
    borderBottomColor: '#1E7872',
    shadowColor: DrillAccents.listening,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
  playAgainText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  homeBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    minHeight: 56,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: '#E4E7EC',
    borderBottomColor: '#C8D3E0',
  },
  homeBtnText: { color: Colors.textSub, fontSize: 16, fontWeight: '900' },
  streakOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 32, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  streakOverlayCompact: {
    paddingHorizontal: 14,
    paddingTop: 46,
    paddingBottom: 46,
  },
  streakCard: {
    width: '100%',
    maxWidth: 470,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 28,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  streakCardCompact: {
    maxWidth: 390,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  streakClose: {
    position: 'absolute',
    right: 18,
    top: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6F8',
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  streakRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF6E6',
    borderWidth: 8,
    borderColor: Colors.success,
    marginTop: 10,
  },
  streakRingCompact: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    marginTop: 4,
  },
  streakTitle: {
    color: '#101820',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  streakTitleCompact: {
    fontSize: 23,
    lineHeight: 27,
  },
  streakText: {
    color: '#586273',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 360,
  },
  streakTextCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  streakWeek: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    backgroundColor: '#F8FAFC',
  },
  streakWeekCompact: {
    gap: 6,
    padding: 7,
    borderRadius: 16,
  },
  streakDay: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  streakDayCompact: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  streakDayActive: {
    backgroundColor: Colors.success,
  },
  streakDayText: {
    color: '#586273',
    fontSize: 13,
    fontWeight: '900',
  },
  streakDayTextActive: {
    color: '#FFFFFF',
  },
  streakDoneBtn: {
    minHeight: 54,
    alignSelf: 'stretch',
    borderRadius: 18,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9D6A00',
    shadowOpacity: 0.25,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
  },
  streakDoneBtnCompact: {
    minHeight: 48,
    borderRadius: 16,
  },
  streakDoneText: {
    color: '#101820',
    fontSize: 16,
    fontWeight: '900',
  },
});
