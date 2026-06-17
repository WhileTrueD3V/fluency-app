import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { Colors } from '@/constants/colors';
import { DrillAccents, tint } from '@/constants/drillAccents';
import { getLanguage, type LanguageCode } from '@/constants/languages';
import {
  getPrefs,
  getRecentPromptIds,
  getDrillSessionContent,
  getDrillSessionProgress,
  getStartingLevelProfile,
  getSessionHistory,
  getStatsForLanguage,
  hasCompletedRewardKey,
  isItemSaved,
  recordAttemptMemory,
  recordAPPracticeSession,
  recordPromptExposure,
  saveDrillSessionContent,
  saveDrillSessionProgress,
  removeSavedItem,
  upsertSavedItem,
  xpForAPScore,
} from '@/utils/storage';
import { haptics } from '@/utils/haptics';
import { getAPPracticeSetById, getAPPracticeSets, type APPromptSet, type APPracticeMode } from '@/data/apPractice';
import { gradeAPSessionLocally, gradeAPSessionWithAI, type APGradingResult } from '@/utils/aiGrading';
import {
  getGeneratedPracticeMemory,
  loadGeneratedPracticeCache,
  refreshGeneratedPracticeCache,
  selectPracticeItems,
} from '@/utils/practiceContentQueue';
import { practiceRepeatKeys } from '@/utils/practiceRepeatKeys';
import { parseTargetSkillsParam } from '@/utils/targetSkills';
import {
  applyChallengeBoostXP,
  chooseStrongestChallengeBoost,
  getAstroChallengeBoostState,
  getChallengeBoostState,
  type ChallengeBoostState,
} from '@/utils/challengeBoost';
import { getPlayerLevel } from '@/utils/progression';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { BookmarkIcon, CheckIcon, MicrophoneIcon, StopIcon, WaveformIcon } from '@/components/Icons';
import { DrillHeader } from '@/components/DrillHeader';
import { DrillLoadRecovery } from '@/components/DrillLoadRecovery';
import { DrillLoadingState } from '@/components/DrillLoadingState';

const CONVERSATION_TURN_SECONDS = 20;
const TEXTING_TURN_SECONDS = 90;
const REVIEW_COUNTDOWN_SECONDS = 18;
const REVIEW_HARD_TIMEOUT_MS = 20000;
const AP_REVIEW_PREFIX = 'AP_REVIEW_JSON:';
const AP_PROMPT_SET_PREFIX = 'AP_PROMPT_SET_JSON:';
type ConversationTurnPhase = 'prompting' | 'answering';

type APPracticeProgressState = {
  turnIndex?: number;
  secondsLeft?: number;
  answers?: string[];
  recordingUris?: Array<string | null>;
  conversationPhase?: ConversationTurnPhase;
  textDraft?: string;
  review?: APGradingResult | null;
  saveAfterReview?: boolean;
};

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

function serializeAPReview(review: APGradingResult, recordingUris: (string | null)[] = []) {
  return `${AP_REVIEW_PREFIX}${JSON.stringify({
    score: review.score,
    label: review.label,
    summary: review.summary,
    improvements: review.improvements,
    weakSkills: review.weakSkills,
    turns: review.turns.map((turn, index) => ({
      index: index + 1,
      prompt: turn.prompt,
      score: turn.score,
      answer: turn.answer || 'No response captured',
      modelAnswer: turn.modelAnswer,
      recordingUri: recordingUris[index] ?? undefined,
      reason: turn.reason,
      improvements: turn.improvements,
      weakSkills: turn.weakSkills,
    })),
  })}`;
}

function serializeAPPromptSetSnapshot(set: APPromptSet, mode: APPracticeMode, answers: string[] = []) {
  return `${AP_PROMPT_SET_PREFIX}${JSON.stringify({
    mode,
    title: set.title,
    situation: set.situation,
    prompts: set.prompts.map((prompt, index) => ({
      index: index + 1,
      prompt,
      answer: answers[index] || '',
      modelAnswer: set.modelAnswers[index] ?? '',
    })),
  })}`;
}

function makeSavedReviewItem(
  mode: APPracticeMode,
  set: APPromptSet,
  langCode: LanguageCode,
  review: APGradingResult,
  recordingUris: (string | null)[] = [],
) {
  return {
    id: `${mode}-${set.id}`,
    type: mode,
    languageCode: langCode,
    promptId: set.id,
    question: `${set.title}: ${set.situation}`,
    answer: serializeAPReview(review, recordingUris),
  } as const;
}

function makeSavedPromptSetItem(
  mode: APPracticeMode,
  set: APPromptSet,
  langCode: LanguageCode,
  answers: string[] = [],
) {
  return {
    id: `${mode}-${set.id}`,
    type: mode,
    languageCode: langCode,
    promptId: set.id,
    question: `${set.title}: ${set.situation}`,
    answer: serializeAPPromptSetSnapshot(set, mode, answers),
  } as const;
}

export function APPracticeSession({ mode }: { mode: APPracticeMode }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const params = useLocalSearchParams<{ promptId?: string; languageCode?: string; mockId?: string; rewardKey?: string; sessionId?: string; targetSkills?: string }>();
  const [langCode, setLangCode] = useState<LanguageCode>('ja');
  const [turnIndex, setTurnIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(mode === 'conversation' ? CONVERSATION_TURN_SECONDS : TEXTING_TURN_SECONDS);
  const [answers, setAnswers] = useState<string[]>(['', '', '', '']);
  const [textDraft, setTextDraft] = useState('');
  const [isTextAdvancing, setIsTextAdvancing] = useState(false);
  const [recordingUris, setRecordingUris] = useState<(string | null)[]>([null, null, null, null]);
  const [review, setReview] = useState<APGradingResult | null>(null);
  const [hydratedProgress, setHydratedProgress] = useState<APPracticeProgressState | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [reviewSecondsLeft, setReviewSecondsLeft] = useState(REVIEW_COUNTDOWN_SECONDS);
  const [saved, setSaved] = useState(false);
  const [saveAfterReview, setSaveAfterReview] = useState(false);
  const [isPromptPlaying, setIsPromptPlaying] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<ConversationTurnPhase>(
    mode === 'conversation' ? 'prompting' : 'answering',
  );
  const [practiceSet, setPracticeSet] = useState<APPromptSet | null>(null);
  const [isLoadingSet, setIsLoadingSet] = useState(true);
  const [challengeBoost, setChallengeBoost] = useState<ChallengeBoostState>(INACTIVE_CHALLENGE_BOOST);
  const cardScale = useRef(new Animated.Value(1)).current;
  const answersRef = useRef(answers);
  const textDraftRef = useRef('');
  const textAdvancingRef = useRef(false);
  const textAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef('');
  const completedRef = useRef(false);
  const turnFinishingRef = useRef(false);
  const promptPlaybackRef = useRef(0);
  const saveAfterReviewRef = useRef(saveAfterReview);
  const recordingUrisRef = useRef(recordingUris);

  const language = getLanguage(langCode);
  const set = practiceSet;
  const isConversation = mode === 'conversation';
  const modeAccent = isConversation ? DrillAccents.conversation : DrillAccents.texting;
  const modeAccentDim = tint(modeAccent);
  const modeAccentEdge = tint(modeAccent, '44');
  const modeAccentBottom = isConversation ? '#4F35B5' : '#8E6216';
  const backgroundGlyph = isConversation ? '話' : '返';
  const turnSeconds = isConversation ? CONVERSATION_TURN_SECONDS : TEXTING_TURN_SECONDS;

  const { recognitionState, transcript, error, startListening, stopListening, reset, requestPermission } =
    useSpeechRecognition(language.sttLocale);
  const {
    recordingState,
    recordingError,
    startRecording,
    stopRecording,
    resetRecording,
  } = useVoiceRecorder();
  const recognitionStateRef = useRef(recognitionState);
  const recordingStateRef = useRef(recordingState);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    saveAfterReviewRef.current = saveAfterReview;
  }, [saveAfterReview]);

  useEffect(() => {
    recordingUrisRef.current = recordingUris;
  }, [recordingUris]);

  useEffect(() => {
    recognitionStateRef.current = recognitionState;
  }, [recognitionState]);

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  useEffect(() => {
    let cancelled = false;
    const loadSet = async () => {
      setIsLoadingSet(true);
      const prefs = await getPrefs();
      const code = ((params.languageCode as LanguageCode | undefined) ?? prefs.selectedLanguage ?? 'ja') as LanguageCode;
      const routeTargetSkills = parseTargetSkillsParam(params.targetSkills);
      setLangCode(code);
      setHydratedProgress(null);

      if (params.promptId) {
        const fallbackSet = getAPPracticeSetById(mode, code, params.promptId);
        setPracticeSet(fallbackSet);
        setIsLoadingSet(false);
        return;
      }

      const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;
      const [stats, recentPromptIds, storedGenerated, sessions] = await Promise.all([
        getStatsForLanguage(code),
        getRecentPromptIds(code, mode),
        loadGeneratedPracticeCache<APPromptSet>(mode, code),
        getSessionHistory(),
      ]);
      if (cancelled) return;
      const level = getPlayerLevel(stats.totalXP);
      const startingProfile = await getStartingLevelProfile();
      const languageSessions = sessions.filter((session) => session.languageCode === code);
      const boost = !params.promptId && !params.mockId
        ? chooseStrongestChallengeBoost(
          getChallengeBoostState(level.level, languageSessions, mode),
          getAstroChallengeBoostState(level.level, startingProfile, sessions, code),
        )
        : INACTIVE_CHALLENGE_BOOST;
      setChallengeBoost(boost);

      const storedSessionSets = await getDrillSessionContent<APPromptSet>(code, mode, sessionId);
      if (storedSessionSets.length > 0) {
        const storedProgress = await getDrillSessionProgress<APPracticeProgressState>(code, mode, sessionId);
        setHydratedProgress(storedProgress);
        setPracticeSet(storedSessionSets[0]);
        setIsLoadingSet(false);
        return;
      }

      let cachedSets = selectPracticeItems([
        ...storedGenerated,
        ...getGeneratedPracticeMemory<APPromptSet>(mode, code),
      ], 1, recentPromptIds);
      if (cachedSets.length === 0) {
        const refreshed = await refreshGeneratedPracticeCache({
          mode,
          languageCode: code,
          totalXP: stats.totalXP,
          recentPromptIds,
          count: 3,
          targetSkills: [
            ...routeTargetSkills,
            mode === 'conversation' ? 'four natural spoken AP turns' : 'four timed text-chat messages',
            'register and task-completion weak spots',
            'avoid repeating recent situation and relationship roles',
          ],
        });
        if (cancelled) return;
        cachedSets = selectPracticeItems([
          ...(refreshed as APPromptSet[]),
          ...storedGenerated,
          ...getGeneratedPracticeMemory<APPromptSet>(mode, code),
        ], 1, recentPromptIds);
      }
      const localSets = getAPPracticeSets(mode, code);
      const selectedSets = selectPracticeItems([
        ...cachedSets,
        ...localSets,
      ], 1, recentPromptIds, cachedSets);
      const localBackup = localSets.find(
        (candidate) => !practiceRepeatKeys(candidate).some((key) => recentPromptIds.includes(key)),
      ) ?? localSets[0] ?? null;
      const nextSet = selectedSets[0] ?? localBackup ?? cachedSets[0] ?? null;
      if (!nextSet) {
        setHydratedProgress(null);
        setPracticeSet(null);
        setIsLoadingSet(false);
        return;
      }
      setHydratedProgress(null);
      setPracticeSet(nextSet);
      await saveDrillSessionContent(code, mode, sessionId, [nextSet]);
      setIsLoadingSet(false);
      void recordPromptExposure(code, mode, practiceRepeatKeys(nextSet));
      if (cachedSets.length === 0) {
        void refreshGeneratedPracticeCache({
          mode,
          languageCode: code,
          totalXP: stats.totalXP,
          recentPromptIds: [
            ...recentPromptIds,
            ...practiceRepeatKeys(nextSet),
          ],
          count: 3,
          targetSkills: [
            ...routeTargetSkills,
            mode === 'conversation' ? 'four natural spoken AP turns' : 'four timed text-chat messages',
            'register and task-completion weak spots',
          ],
        });
      }
    };
    void loadSet().catch(() => {
      if (!cancelled) {
        setHydratedProgress(null);
        setPracticeSet(null);
        setIsLoadingSet(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode, params.languageCode, params.promptId, params.sessionId, params.targetSkills]);

  useEffect(() => {
    if (!practiceSet) return;
    const blankAnswers = Array.from({ length: practiceSet.prompts.length }, () => '');
    const blankUris = Array.from({ length: practiceSet.prompts.length }, () => null);
    const nextAnswers = hydratedProgress?.answers?.length === practiceSet.prompts.length ? hydratedProgress.answers : blankAnswers;
    const nextUris = hydratedProgress?.recordingUris?.length === practiceSet.prompts.length ? hydratedProgress.recordingUris : blankUris;
    const nextTurnIndex = Math.min(Math.max(0, hydratedProgress?.turnIndex ?? 0), Math.max(0, practiceSet.prompts.length - 1));
    setTurnIndex(nextTurnIndex);
    setSecondsLeft(hydratedProgress?.secondsLeft ?? (mode === 'conversation' ? CONVERSATION_TURN_SECONDS : TEXTING_TURN_SECONDS));
    setAnswers(nextAnswers);
    answersRef.current = nextAnswers;
    setRecordingUris(nextUris);
    recordingUrisRef.current = nextUris;
    setReview(hydratedProgress?.review ?? null);
    setIsGrading(false);
    setSaveAfterReview(hydratedProgress?.saveAfterReview ?? false);
    saveAfterReviewRef.current = hydratedProgress?.saveAfterReview ?? false;
    completedRef.current = Boolean(hydratedProgress?.review);
    transcriptRef.current = '';
    textDraftRef.current = hydratedProgress?.textDraft ?? '';
    textAdvancingRef.current = false;
    turnFinishingRef.current = false;
    if (textAdvanceTimeoutRef.current) {
      clearTimeout(textAdvanceTimeoutRef.current);
      textAdvanceTimeoutRef.current = null;
    }
    setTextDraft(hydratedProgress?.textDraft ?? '');
    setIsTextAdvancing(false);
    setConversationPhase(hydratedProgress?.conversationPhase ?? (mode === 'conversation' ? 'prompting' : 'answering'));
    setIsPromptPlaying(false);
    promptPlaybackRef.current += 1;
    Speech.stop();
    reset();
    resetRecording();
  }, [hydratedProgress, mode, practiceSet, reset, resetRecording]);

  const activeSessionId = typeof params.sessionId === 'string' ? params.sessionId : null;

  useEffect(() => {
    if (!activeSessionId || !practiceSet) return;
    void saveDrillSessionProgress(langCode, mode, activeSessionId, {
      turnIndex,
      secondsLeft,
      answers,
      recordingUris,
      conversationPhase,
      textDraft,
      review,
      saveAfterReview,
    });
  }, [activeSessionId, answers, conversationPhase, langCode, mode, practiceSet, recordingUris, review, saveAfterReview, secondsLeft, textDraft, turnIndex]);

  const beginConversationAnswer = useCallback(async (playbackRun: number) => {
    if (!isConversation || promptPlaybackRef.current !== playbackRun || completedRef.current) return;
    setIsPromptPlaying(false);
    setConversationPhase('answering');
    setSecondsLeft(CONVERSATION_TURN_SECONDS);
    transcriptRef.current = '';
    reset();
    await resetRecording();
    await startRecording();
    startListening(undefined, { continuous: true });
  }, [isConversation, reset, resetRecording, startListening, startRecording]);

  const finishTurn = useCallback(async () => {
    if (!set) return;
    if (completedRef.current) return;
    if (turnFinishingRef.current) return;
    if (!isConversation && textAdvancingRef.current) return;
    turnFinishingRef.current = true;
    haptics.impact('light');
    promptPlaybackRef.current += 1;
    Speech.stop();
    setIsPromptPlaying(false);
    let stoppedRecordingUri: string | null = null;
    if (isConversation && recognitionStateRef.current === 'listening') {
      stopListening();
    }
    if (isConversation && recordingStateRef.current === 'recording') {
      const recording = await stopRecording();
      stoppedRecordingUri = recording.uri;
    }
    if (isConversation && stoppedRecordingUri) {
      const nextRecordingUris = replaceAt(recordingUrisRef.current, turnIndex, stoppedRecordingUri);
      recordingUrisRef.current = nextRecordingUris;
      setRecordingUris(nextRecordingUris);
    }
    let latestAnswers = answersRef.current;
    if (isConversation && transcriptRef.current.trim()) {
      latestAnswers = replaceAt(answersRef.current, turnIndex, transcriptRef.current.trim());
    }
    if (!isConversation) {
      latestAnswers = replaceAt(answersRef.current, turnIndex, textDraftRef.current.trim());
      textDraftRef.current = '';
      setTextDraft('');
    }
    answersRef.current = latestAnswers;
    setAnswers(latestAnswers);

    if (turnIndex + 1 >= set.prompts.length) {
      completedRef.current = true;
      setIsGrading(true);
      setReviewSecondsLeft(REVIEW_COUNTDOWN_SECONDS);
      try {
        const finalReview = await Promise.race([
          gradeAPSessionWithAI(set, latestAnswers),
          new Promise<APGradingResult>((resolve) => {
            setTimeout(() => resolve(gradeAPSessionLocally(set, latestAnswers)), REVIEW_HARD_TIMEOUT_MS);
          }),
        ]);
        const rewardKey = String(
          params.rewardKey
          ?? params.promptId
          ?? (params.mockId ? `${params.mockId}:${mode}` : `${mode}:${set.id}`),
        );
        const rewardClaimed = await hasCompletedRewardKey(langCode, mode, rewardKey);
        const baseXP = xpForAPScore(finalReview.score);
        const scoredReview = {
          ...finalReview,
          xpEarned: rewardClaimed ? 0 : applyChallengeBoostXP(baseXP, challengeBoost),
        };
        setReview(scoredReview);
        if (saveAfterReviewRef.current) {
          await upsertSavedItem(makeSavedReviewItem(mode, set, langCode, scoredReview, recordingUrisRef.current));
        }
        void recordAPPracticeSession(langCode, mode, scoredReview.score, params.mockId, rewardKey, {
          score: scoredReview.score,
          label: scoredReview.label,
          summary: scoredReview.summary,
          promptId: set.id,
          title: set.title,
          situation: set.situation,
          improvements: scoredReview.improvements,
          weakSkills: scoredReview.weakSkills,
          turns: scoredReview.turns.map((turn, index) => ({
            index: index + 1,
            prompt: turn.prompt,
            score: turn.score,
            answer: turn.answer || 'No response captured',
            modelAnswer: turn.modelAnswer,
            recordingUri: recordingUrisRef.current[index] ?? undefined,
            reason: turn.reason,
            improvements: turn.improvements,
            weakSkills: turn.weakSkills,
          })),
        }, scoredReview.xpEarned);
        void recordAttemptMemory(set.prompts.map((prompt, index) => {
          const turn = scoredReview.turns[index];
          const turnScore = typeof turn?.score === 'number'
            ? Math.round((turn.score / 5) * 100)
            : Math.round((scoredReview.score / 5) * 100);
          return {
            type: mode,
            languageCode: langCode,
            promptId: `${set.id}:${index + 1}`,
            score: turnScore,
            correct: turnScore >= 72,
            question: prompt,
            userAnswer: latestAnswers[index] ?? '',
            expectedAnswer: set.modelAnswers[index] ?? turn?.modelAnswer ?? '',
            context: `${set.title}: ${set.situation}`,
            weakSkills: [
              ...(turn?.weakSkills ?? []),
              ...(turn?.improvements ?? []),
            ].slice(0, 6),
          };
        }));
        Animated.sequence([
          Animated.spring(cardScale, { toValue: 1.03, useNativeDriver: true, friction: 5 }),
          Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
        ]).start();
      } finally {
        setIsGrading(false);
        turnFinishingRef.current = false;
      }
      return;
    }
    if (!isConversation) {
      textAdvancingRef.current = true;
      setIsTextAdvancing(true);
      setSecondsLeft(turnSeconds);
      if (textAdvanceTimeoutRef.current) clearTimeout(textAdvanceTimeoutRef.current);
      textAdvanceTimeoutRef.current = setTimeout(() => {
        textAdvanceTimeoutRef.current = null;
        textAdvancingRef.current = false;
        turnFinishingRef.current = false;
        setIsTextAdvancing(false);
        setTurnIndex((index) => index + 1);
      }, 900);
      return;
    }
    transcriptRef.current = '';
    reset();
    resetRecording();
    setConversationPhase('prompting');
    setSecondsLeft(turnSeconds);
    turnFinishingRef.current = false;
    setTurnIndex((index) => index + 1);
  }, [cardScale, challengeBoost, isConversation, langCode, mode, params.mockId, params.promptId, params.rewardKey, reset, resetRecording, set, stopListening, stopRecording, turnIndex, turnSeconds]);

  useEffect(() => {
    if (review || isGrading || isTextAdvancing) return;
    if (isConversation && conversationPhase !== 'answering') {
      setSecondsLeft(turnSeconds);
      return;
    }
    setSecondsLeft(turnSeconds);
    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          finishTurn();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [conversationPhase, finishTurn, isConversation, isGrading, isTextAdvancing, turnIndex, review, turnSeconds]);

  useEffect(() => {
    if (!isGrading) return;
    setReviewSecondsLeft(REVIEW_COUNTDOWN_SECONDS);
    const timer = setInterval(() => {
      setReviewSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isGrading]);

  useEffect(() => {
    if (mode === 'conversation' && transcript) {
      transcriptRef.current = transcript;
      setAnswers((current) => replaceAt(current, turnIndex, transcript));
    }
  }, [mode, transcript, turnIndex]);

  const prompt = set?.prompts[turnIndex] ?? '';

  useEffect(() => {
    if (!isConversation || !set || review || isGrading || !prompt) return;
    let cancelled = false;
    const playbackRun = promptPlaybackRef.current + 1;
    promptPlaybackRef.current = playbackRun;
    turnFinishingRef.current = false;
    transcriptRef.current = '';
    setConversationPhase('prompting');
    setSecondsLeft(CONVERSATION_TURN_SECONDS);
    setIsPromptPlaying(true);
    reset();
    void resetRecording();
    Speech.stop();
    Speech.speak(prompt, {
      language: language.ttsLocale,
      rate: 0.88,
      onDone: () => {
        if (!cancelled) void beginConversationAnswer(playbackRun);
      },
      onStopped: () => {
        if (!cancelled && promptPlaybackRef.current === playbackRun) setIsPromptPlaying(false);
      },
      onError: () => {
        if (!cancelled) void beginConversationAnswer(playbackRun);
      },
    });
    return () => {
      cancelled = true;
      if (promptPlaybackRef.current === playbackRun) {
        promptPlaybackRef.current += 1;
        Speech.stop();
        setIsPromptPlaying(false);
      }
    };
  }, [beginConversationAnswer, isConversation, isGrading, language.ttsLocale, prompt, reset, resetRecording, review, set, turnIndex]);

  useEffect(() => {
    if (!set) return;
    let cancelled = false;
    isItemSaved(set.id, mode).then((value) => {
      if (!cancelled) setSaved(value);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, set]);

  const exit = () => {
    promptPlaybackRef.current += 1;
    Speech.stop();
    setIsPromptPlaying(false);
    if (isConversation && recognitionStateRef.current === 'listening') stopListening();
    if (isConversation && recordingStateRef.current === 'recording') void stopRecording();
    router.replace(params.mockId ? '/mock' : '/(home)');
  };

  useEffect(() => {
    return () => {
      promptPlaybackRef.current += 1;
      Speech.stop();
      if (recognitionStateRef.current === 'listening') stopListening();
      if (recordingStateRef.current === 'recording') void stopRecording();
      if (textAdvanceTimeoutRef.current) {
        clearTimeout(textAdvanceTimeoutRef.current);
        textAdvanceTimeoutRef.current = null;
      }
    };
  }, [stopListening, stopRecording]);

  const updateTextDraft = (text: string) => {
    textDraftRef.current = text;
    setTextDraft(text);
  };

  const handleSave = async () => {
    if (!set) return;
    haptics.impact('light');
    if (!review) {
      if (saved) {
        await removeSavedItem(set.id, mode);
        setSaved(false);
        setSaveAfterReview(false);
        saveAfterReviewRef.current = false;
        return;
      }
      await upsertSavedItem(makeSavedPromptSetItem(mode, set, langCode, answersRef.current));
      setSaved(true);
      setSaveAfterReview(true);
      saveAfterReviewRef.current = true;
      return;
    }
    if (saved) {
      await removeSavedItem(set.id, mode);
      setSaved(false);
      setSaveAfterReview(false);
      saveAfterReviewRef.current = false;
      return;
    }
    await upsertSavedItem(makeSavedReviewItem(mode, set, langCode, review, recordingUrisRef.current));
    setSaved(true);
    setSaveAfterReview(true);
    saveAfterReviewRef.current = true;
  };

  if (isLoadingSet) {
    return (
      <SafeAreaView style={styles.safe}>
        <DrillLoadingState
          mode={mode === 'conversation' ? 'conversation' : 'texting'}
          title={mode === 'conversation' ? 'Building AP conversation' : 'Building text chat'}
          subtitle={mode === 'conversation'
            ? 'Preparing four spoken turns with your level and recent AP weak spots.'
            : 'Preparing four timed messages around your register and clarity patterns.'}
        />
      </SafeAreaView>
    );
  }

  if (!set) {
    return (
      <SafeAreaView style={styles.safe}>
        <DrillLoadRecovery onAction={exit} />
      </SafeAreaView>
    );
  }

  if (review) {
    const earnedXP = review.xpEarned ?? xpForAPScore(review.score);
    const answeredTurns = review.turns.filter((turn) => turn.answer.trim()).length;
    const scoreTone =
      review.score >= 4
        ? Colors.success
        : review.score >= 3
          ? Colors.secondary
          : modeAccent;
    const scoreToneDim =
      review.score >= 4
        ? Colors.successDim
        : review.score >= 3
          ? Colors.secondaryDim
          : modeAccentDim;
    const nextAction =
      review.score >= 4
        ? 'Keep the streak going with one more timed set.'
        : 'Restart this set and aim for one complete sentence each turn.';

    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.bgGlyph}>{backgroundGlyph}</Text>
        <View style={styles.container}>
          <DrillHeader
            accent={modeAccent}
            current={set.prompts.length}
            total={set.prompts.length}
            xp={earnedXP}
            saved={saved}
            onSave={handleSave}
            onQuit={exit}
            progressLabel="Turn"
          />

          <ScrollView contentContainerStyle={[styles.scroll, isCompact && styles.scrollCompact]} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.resultCard, isCompact && styles.resultCardCompact, { transform: [{ scale: cardScale }] }]}>
            <View style={[styles.resultScoreBadge, isCompact && styles.resultScoreBadgeCompact, { borderColor: scoreTone, backgroundColor: scoreToneDim }]}>
              <Text style={[styles.resultScoreValue, { color: scoreTone }]}>{review.score}</Text>
              <Text style={[styles.resultScoreMax, { color: scoreTone }]}>/5</Text>
            </View>
            <View style={styles.resultCopy}>
              <Text style={styles.resultKicker}>{isConversation ? 'AP Conversation review' : 'AP Text Chat review'}</Text>
              <Text style={styles.resultTitle}>{review.label}</Text>
              <Text style={styles.resultSummary}>{review.summary}</Text>
            </View>
            <View style={[styles.resultStats, isCompact && styles.resultStatsCompact]}>
              <View style={styles.resultStatTile}>
                <Text style={styles.resultStatValue}>+{earnedXP}</Text>
                <Text style={styles.resultStatLabel}>XP earned</Text>
              </View>
              <View style={styles.resultStatTile}>
                <Text style={styles.resultStatValue}>{answeredTurns}/{review.turns.length}</Text>
                <Text style={styles.resultStatLabel}>Turns answered</Text>
              </View>
            </View>
          </Animated.View>

          <View style={[styles.coachGrid, isCompact && styles.coachGridCompact]}>
            <View style={[styles.coachCard, styles.coachCardPrimary]}>
              <Text style={styles.feedbackTitle}>Next best move</Text>
              <Text style={styles.coachLead}>{nextAction}</Text>
              {review.improvements.length > 0 && (
                <View style={styles.coachNoteList}>
                  {review.improvements.slice(0, 2).map((item) => (
                    <View key={item} style={styles.coachNoteRow}>
                      <View style={styles.coachDot} />
                      <Text style={styles.coachNoteText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.coachCard}>
              <Text style={styles.feedbackTitle}>Weak skills</Text>
              <View style={styles.skillWrap}>
                {(review.weakSkills.length > 0 ? review.weakSkills : ['Sentence completion']).map((skill) => (
                  <View key={skill} style={styles.skillChip}>
                    <Text style={styles.skillChipText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.turnList}>
            {review.turns.map((turn, index) => (
              <View key={turn.prompt} style={styles.turnReview}>
                <View style={styles.turnReviewHeader}>
                  <View style={styles.turnNumberBadge}>
                    <Text style={styles.turnNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.turnHeaderCopy}>
                    <Text style={styles.turnReviewLabel}>Turn {index + 1}</Text>
                    <Text style={styles.turnPrompt}>{turn.prompt}</Text>
                  </View>
                  <View style={[
                    styles.turnScorePill,
                    turn.score >= 3 ? styles.turnScorePillStrong : styles.turnScorePillWeak,
                  ]}>
                    <Text style={[
                      styles.turnScoreText,
                      { color: turn.score >= 3 ? Colors.secondary : modeAccent },
                    ]}>{turn.score}/5</Text>
                  </View>
                </View>
                <Text style={styles.turnReason}>{turn.reason}</Text>
                <View style={[styles.answerCompare, isCompact && styles.answerCompareCompact]}>
                  <View style={styles.answerPane}>
                    <Text style={styles.answerPaneLabel}>Your answer</Text>
                    <Text style={styles.turnAnswer}>{turn.answer || 'No response captured'}</Text>
                  </View>
                  <View style={styles.answerPane}>
                    <Text style={styles.answerPaneLabel}>Example 5/5 answer</Text>
                    <Text style={styles.modelAnswer}>{turn.modelAnswer}</Text>
                  </View>
                </View>
                {turn.improvements.length > 0 && (
                  <View style={styles.turnTips}>
                    {turn.improvements.slice(0, 2).map((item) => (
                      <View key={item} style={styles.turnTipRow}>
                        <View style={styles.turnTipDot} />
                        <Text style={styles.turnTipText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={[styles.actionRow, isCompact && styles.actionRowCompact]}>
            <TouchableOpacity onPress={handleSave} style={[styles.secondaryBtn, saved && styles.savedBtn]}>
              {saved ? <CheckIcon size={17} color={Colors.success} /> : <BookmarkIcon size={17} color={Colors.textSub} />}
              <Text style={[styles.secondaryText, saved && styles.savedText]}>{saved ? 'Saved' : 'Save to Library'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={exit}
              accessibilityLabel="Finish AP practice"
              style={[
                styles.resultDoneBtn,
                { backgroundColor: modeAccent },
              ]}
            >
              <CheckIcon size={24} color="#fff" strokeWidth={2.8} />
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {isCompact && <Text style={styles.bgGlyph}>{backgroundGlyph}</Text>}
      <View style={styles.container}>
        <DrillHeader
          accent={modeAccent}
          current={turnIndex + 1}
          total={set.prompts.length}
          xp={0}
          saved={saved}
          onSave={handleSave}
          onQuit={exit}
          progressLabel="Turn"
        />

        <ScrollView contentContainerStyle={[styles.scroll, isCompact && styles.scrollCompact]} showsVerticalScrollIndicator={false}>
        <View style={[styles.practiceStage, !isCompact && styles.practiceStageDesktop]}>
          <View style={[styles.practiceMain, isCompact && styles.practiceMainCompact]}>
            <View style={[styles.sessionIntro, isCompact && styles.sessionIntroCompact]}>
              <Text style={styles.modeLabel}>{isConversation ? 'Conversation' : 'Text chat'}</Text>
              <Text style={[styles.sessionTitle, isCompact && styles.sessionTitleCompact]}>{set.title}</Text>
              <Text style={[styles.sessionSituation, isCompact && styles.sessionSituationCompact]}>
                {set.situation}
              </Text>
            </View>

            {isConversation ? (
              <View style={[styles.promptCard, isCompact && styles.promptCardCompact]}>
                <Text style={[styles.promptLabel, { color: modeAccent }, isCompact && styles.promptLabelCompact]}>
                  {conversationPhase === 'prompting' ? 'Listen first' : 'Prompt text'}
                </Text>
                <Text style={[styles.promptText, isCompact && styles.promptTextCompact]}>
                  {conversationPhase === 'prompting'
                    ? 'Audio prompt is playing. The text appears when the speaker finishes.'
                    : prompt}
                </Text>
                <View style={[
                  styles.promptStatusPill,
                  { borderColor: modeAccent, backgroundColor: modeAccentDim },
                  conversationPhase === 'answering' && styles.promptStatusPillActive,
                ]}>
                  {conversationPhase === 'prompting' ? (
                    <WaveformIcon size={16} color={modeAccent} strokeWidth={2.1} />
                  ) : (
                    <MicrophoneIcon size={16} color={Colors.teal} strokeWidth={2.1} />
                  )}
                  <Text style={[styles.promptStatusText, { color: modeAccent }, conversationPhase === 'answering' && styles.promptStatusTextActive]}>
                    {conversationPhase === 'prompting'
                      ? isPromptPlaying ? 'Playing prompt' : 'Preparing prompt'
                      : '20s recording window started'}
                  </Text>
                </View>
              </View>
            ) : (
              <TextChatTurn
                title={set.title}
                situation={set.situation}
                prompts={set.prompts}
                answers={answers}
                draft={textDraft}
                onChangeDraft={updateTextDraft}
                onSubmit={finishTurn}
                turnIndex={turnIndex}
                totalTurns={set.prompts.length}
                secondsLeft={secondsLeft}
                isGrading={isGrading}
                isAdvancing={isTextAdvancing}
                isCompact={isCompact}
              />
            )}

            {isConversation ? (
              <View style={[styles.responseArea, isCompact && styles.responseAreaCompact]}>
                <View
                  style={[
                    styles.recordBtn,
                    isCompact && styles.recordBtnCompact,
                    { backgroundColor: modeAccent, shadowColor: modeAccent },
                    conversationPhase === 'answering' && styles.recordBtnActive,
                  ]}
                >
                  {conversationPhase === 'prompting' ? (
                    <WaveformIcon size={32} color="#fff" strokeWidth={2.4} />
                  ) : recognitionState === 'listening' ? (
                    <StopIcon size={30} color="#fff" />
                  ) : (
                    <MicrophoneIcon size={30} color="#fff" />
                  )}
                </View>
                <Text style={[styles.recordLabel, isCompact && styles.recordLabelCompact]}>
                  {conversationPhase === 'prompting'
                    ? 'Listening to the prompt'
                    : recognitionState === 'listening'
                      ? 'Recording automatically'
                      : recognitionState === 'processing'
                        ? 'Saving your answer'
                        : 'Microphone starting'}
                </Text>
                {recordingState === 'stopped' && recordingUris[turnIndex] && (
                  <Text style={styles.recordingSavedText}>Audio captured for naturalness review</Text>
                )}
                <View style={[styles.answerBox, isCompact && styles.answerBoxCompact]}>
                  <Text style={[styles.answerBoxLabel, isCompact && styles.answerBoxLabelCompact]}>Captured answer</Text>
                  <Text style={[styles.answerPreview, isCompact && styles.answerPreviewCompact]} numberOfLines={isCompact ? 2 : undefined}>
                    {answers[turnIndex] || 'Your speech transcript will appear here.'}
                  </Text>
                </View>
                {(error || recordingError) && (
                  <View style={styles.micErrorBox}>
                    <Text style={styles.errorText}>{error ?? recordingError}</Text>
                    <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
                      <Text style={styles.permissionText}>Try microphone permission again</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {isGrading && (
                  <ReviewingPanel secondsLeft={reviewSecondsLeft} accent={modeAccent} />
                )}
              </View>
            ) : (
              <>
                {isGrading && (
                  <ReviewingPanel secondsLeft={reviewSecondsLeft} chatMode accent={modeAccent} />
                )}
              </>
            )}
          </View>

          <View style={[styles.practiceSide, isCompact && styles.practiceSideCompact]}>
            <Text style={[styles.sideLabel, { color: modeAccent }]}>{isConversation ? 'Live AP turn' : 'Written AP turn'}</Text>
            <Text style={styles.sideTitle}>Turn {turnIndex + 1} of {set.prompts.length}</Text>
            <View style={styles.sideStatRow}>
              <View style={styles.sideStat}>
                <Text style={styles.sideStatValue}>0</Text>
                <Text style={styles.sideStatLabel}>XP</Text>
              </View>
              <View style={styles.sideStat}>
                <Text style={styles.sideStatValue}>{answers.filter((answer) => answer.trim()).length}</Text>
                <Text style={styles.sideStatLabel}>Done</Text>
              </View>
            </View>
            <View style={[styles.timerPill, { borderColor: modeAccent, backgroundColor: modeAccentDim }, isCompact && styles.timerPillCompact]}>
              <Text style={[styles.timerText, isCompact && styles.timerTextCompact]}>{secondsLeft}s</Text>
            </View>
            <Text style={styles.sideHint}>
              {isConversation
                ? conversationPhase === 'prompting'
                  ? 'Listen first. Your 20-second answer window starts when the prompt ends.'
                  : 'Recording now. Answer fully before the timer hits zero.'
                : 'Write a direct reply with AP-appropriate detail.'}
            </Text>
            {isConversation ? (
              <View style={[
                styles.primaryBtn,
                isCompact && styles.primaryBtnCompact,
                styles.primaryBtnDisabled,
                { backgroundColor: modeAccent, borderBottomColor: modeAccentBottom, shadowColor: modeAccent },
              ]}>
                <Text style={[styles.primaryText, isCompact && styles.primaryTextCompact]}>
                  {conversationPhase === 'prompting' ? 'Listen' : turnIndex + 1 >= set.prompts.length ? 'Auto review at 0' : 'Auto next at 0'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={finishTurn}
                disabled={isGrading || isTextAdvancing}
                style={[
                  styles.primaryBtn,
                  isCompact && styles.primaryBtnCompact,
                  (isGrading || isTextAdvancing) && styles.primaryBtnDisabled,
                  { backgroundColor: modeAccent, borderBottomColor: modeAccentBottom, shadowColor: modeAccent },
                ]}
              >
                <Text style={[styles.primaryText, isCompact && styles.primaryTextCompact]}>
                  {isTextAdvancing ? 'Sending' : isGrading ? 'Reviewing' : turnIndex + 1 >= set.prompts.length ? 'Review' : 'Send Message'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSave} style={[styles.secondaryBtn, isCompact && styles.secondaryBtnCompact, saved && styles.savedBtn]}>
              {saved ? <CheckIcon size={17} color={Colors.success} /> : <BookmarkIcon size={17} color={Colors.textSub} />}
              <Text style={[styles.secondaryText, saved && styles.savedText]}>{saved ? 'Will save' : 'Save review'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function TextChatTurn({
  title,
  situation,
  prompts,
  answers,
  draft,
  onChangeDraft,
  onSubmit,
  turnIndex,
  totalTurns,
  secondsLeft,
  isGrading,
  isAdvancing,
  isCompact,
}: {
  title: string;
  situation: string;
  prompts: string[];
  answers: string[];
  draft: string;
  onChangeDraft: (text: string) => void;
  onSubmit: () => void;
  turnIndex: number;
  totalTurns: number;
  secondsLeft: number;
  isGrading: boolean;
  isAdvancing: boolean;
  isCompact: boolean;
}) {
  const inputMinHeight = isCompact ? 72 : 76;
  const inputLineHeight = isCompact ? 22 : 25;
  const inputMaxHeight = inputLineHeight * 5 + 26;
  const [draftHeight, setDraftHeight] = useState(inputMinHeight);
  const [draftCanScroll, setDraftCanScroll] = useState(false);
  const hasCommittedCurrent = (answers[turnIndex] ?? '').trim().length > 0;
  const remaining = Math.max(0, totalTurns - turnIndex - ((isAdvancing || hasCommittedCurrent) ? 1 : 0));
  const allMessages: Array<
    { id: string; type: 'incoming'; text: string } |
    { id: string; type: 'outgoing'; text: string }
  > = [];
  for (let index = 0; index <= turnIndex; index += 1) {
    const turnPrompt = prompts[index];
    const turnAnswer = answers[index] ?? '';
    if (turnPrompt) {
      allMessages.push({ id: `incoming-${index}`, type: 'incoming', text: turnPrompt });
    }
    if (turnAnswer.trim()) {
      allMessages.push({ id: `outgoing-${index}`, type: 'outgoing', text: turnAnswer });
    }
  }
  const threadMessages = allMessages.slice(-3);

  useEffect(() => {
    if (!draft) {
      setDraftHeight(inputMinHeight);
      setDraftCanScroll(false);
    }
  }, [draft, inputMinHeight]);

  const handleDraftContentSizeChange = useCallback((event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const measuredHeight = Math.ceil(event.nativeEvent.contentSize.height + 2);
    setDraftHeight(Math.max(inputMinHeight, Math.min(inputMaxHeight, measuredHeight)));
    setDraftCanScroll(measuredHeight > inputMaxHeight);
  }, [inputMaxHeight, inputMinHeight]);

  return (
    <View style={[styles.chatShell, isCompact && styles.chatShellCompact]}>
      <View style={[styles.chatScenarioCard, isCompact && styles.chatScenarioCardCompact]}>
        <View style={[styles.chatScenarioImage, isCompact && styles.chatScenarioImageCompact]}>
          <Text style={styles.chatScenarioGlyph}>文</Text>
        </View>
        <View style={styles.chatScenarioCopy}>
          <Text style={[styles.chatScenarioTitle, isCompact && styles.chatScenarioTitleCompact]}>{title}</Text>
          <Text style={[styles.chatScenarioGoal, isCompact && styles.chatScenarioGoalCompact]}>
            <Text style={styles.chatScenarioGoalStrong}>Goal: </Text>{situation}
          </Text>
        </View>
      </View>

      <View style={styles.chatPersonaRow}>
        <View style={styles.chatAvatar}>
          <Text style={styles.chatAvatarText}>先</Text>
        </View>
        <Text style={styles.chatPersonaName}>AP prompt partner</Text>
      </View>

      <View style={[styles.chatThread, isCompact && styles.chatThreadCompact]}>
        {threadMessages.map((message) => (
          message.type === 'incoming' ? (
            <View key={message.id} style={styles.chatTurnGroup}>
            <View style={[styles.incomingBubble, isCompact && styles.incomingBubbleCompact]}>
              <Text style={styles.bubbleRomaji} numberOfLines={2}>{message.text}</Text>
              <View style={styles.bubbleMainRow}>
                <Text style={[styles.incomingText, isCompact && styles.incomingTextCompact]}>{message.text}</Text>
                <TouchableOpacity activeOpacity={0.84} style={styles.bubbleAudioButton} accessibilityLabel="Audio unavailable for text prompt">
                  <WaveformIcon size={18} color={Colors.ink} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          ) : (
            <View key={message.id} style={styles.outgoingBubbleRow}>
              <View style={[styles.outgoingBubble, isCompact && styles.outgoingBubbleCompact]}>
                <Text style={styles.outgoingMeta}>Your reply</Text>
                <Text style={[styles.outgoingText, isCompact && styles.outgoingTextCompact]}>{message.text}</Text>
              </View>
            </View>
          )
        ))}

        {(isAdvancing || isGrading) && (
          <View style={styles.typingRow}>
            <View style={styles.chatAvatarSmall}>
              <Text style={styles.chatAvatarSmallText}>先</Text>
            </View>
            <View style={styles.typingBubble}>
              <TypingDots />
            </View>
          </View>
        )}
      </View>

      <View style={[styles.chatComposer, isCompact && styles.chatComposerCompact]}>
        <View style={styles.chatComposerTop}>
          <View style={styles.messagesLeftPill}>
            <Text style={[styles.messagesLeftText, isCompact && styles.messagesLeftTextCompact]}>Messages left: {remaining}</Text>
          </View>
          <View style={styles.chatTimerPill}>
            <Text style={styles.chatTimerText}>{secondsLeft}s</Text>
          </View>
        </View>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder="Type your Japanese response..."
          placeholderTextColor={Colors.textMuted}
          multiline
          editable={!isGrading && !isAdvancing}
          scrollEnabled={draftCanScroll}
          onContentSizeChange={handleDraftContentSizeChange}
          style={[
            styles.chatInput,
            isCompact && styles.chatInputCompact,
            { height: draftHeight, maxHeight: inputMaxHeight },
          ]}
          textAlignVertical="top"
        />
        <View style={styles.chatToolRow}>
          <TouchableOpacity
            activeOpacity={0.84}
            onPress={onSubmit}
            disabled={isGrading || isAdvancing}
            style={[styles.chatSendButton, (isGrading || isAdvancing) && styles.chatSendButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Send response"
          >
            <Text style={styles.chatSendText}>{isAdvancing ? 'Sent' : turnIndex + 1 >= totalTurns ? 'Review' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function TypingDots() {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const animations = dots.map((dot, index) => (
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(dot, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(240),
        ]),
      )
    ));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots]);

  return (
    <View style={styles.typingDots}>
      {dots.map((dot, index) => {
        const translateY = dot.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -5],
        });
        return (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              {
                opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                transform: [{ translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function ReviewingPanel({ secondsLeft, chatMode = false, accent }: { secondsLeft: number; chatMode?: boolean; accent: string }) {
  return (
    <View style={[styles.reviewingPanel, chatMode && styles.reviewingPanelChat]}>
      {chatMode ? <TypingDots /> : <ActivityIndicator color={accent} />}
      <View style={styles.reviewingCopy}>
        <Text style={styles.reviewingTitle}>{chatMode ? 'Kibbo is reading your replies' : 'Reviewing your session'}</Text>
        <Text style={styles.reviewingDetail}>
          {secondsLeft > 0
            ? `AI review usually finishes in about ${secondsLeft}s.`
            : 'Still checking. If AI stalls, a local AP rubric review will appear automatically.'}
        </Text>
      </View>
    </View>
  );
}

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  const next = [...items];
  next[index] = value;
  return next;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBFCFD' },
  container: { flex: 1, overflow: 'hidden' },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textSub,
    fontSize: 14,
    fontWeight: '700',
  },
  bgGlyph: {
    position: 'absolute',
    right: -85,
    top: 30,
    fontSize: 460,
    color: Colors.bgGlyph,
    fontFamily: undefined,
  },
  scroll: { paddingHorizontal: 32, paddingTop: 30, gap: 22, paddingBottom: 120, maxWidth: 1220, width: '100%', alignSelf: 'center' },
  scrollCompact: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 12,
    paddingBottom: 158,
  },
  practiceStage: { gap: 18 },
  practiceStageDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 42,
  },
  practiceMain: {
    flex: 1,
    minWidth: 0,
    gap: 18,
  },
  practiceMainCompact: {
    gap: 10,
  },
  practiceSide: {
    width: 280,
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
  practiceSideCompact: {
    display: 'none',
  },
  sessionIntro: { gap: 8 },
  sessionIntroCompact: { gap: 4 },
  sessionTopRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modeLabel: { color: '#475569', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  sessionTitle: { color: '#101820', fontSize: 34, lineHeight: 42, fontWeight: '900' },
  sessionTitleCompact: { fontSize: 24, lineHeight: 28 },
  sessionSituation: { color: '#526071', fontSize: 17, lineHeight: 24, fontWeight: '700' },
  sessionSituationCompact: { fontSize: 14, lineHeight: 19 },
  turnCount: { color: Colors.primary, fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 3 },
  timerPill: {
    alignSelf: 'flex-start',
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  timerPillCompact: {
    minHeight: 42,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  timerText: { color: Colors.text, fontSize: 26, lineHeight: 31, fontWeight: '900' },
  timerTextCompact: { fontSize: 20, lineHeight: 24 },
  promptCard: {
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
  promptCardCompact: {
    padding: 16,
    borderRadius: 24,
    gap: 11,
    backgroundColor: '#FFFFFFF0',
    borderColor: '#D9E2EC',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  promptLabel: { color: Colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  promptLabelCompact: { fontSize: 12, letterSpacing: 3.8 },
  promptText: { color: '#101820', fontSize: 29, lineHeight: 38, fontWeight: '900' },
  promptTextCompact: { fontSize: 22, lineHeight: 29 },
  promptStatusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 38,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryDim,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  promptStatusPillActive: {
    borderColor: Colors.teal,
    backgroundColor: Colors.tealDim,
  },
  promptStatusText: {
    color: Colors.primary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  promptStatusTextActive: {
    color: Colors.teal,
  },
  responseArea: {
    alignItems: 'center',
    gap: 14,
  },
  responseAreaCompact: {
    gap: 11,
    marginTop: 0,
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D9E2EC',
    backgroundColor: '#FFFFFFE8',
    shadowColor: Colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  recordBtn: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.20,
    shadowRadius: 18,
  },
  recordBtnCompact: {
    width: 82,
    height: 82,
    borderRadius: 41,
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  recordBtnActive: { backgroundColor: Colors.error },
  recordLabel: { color: Colors.textSub, fontSize: 13, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 0 },
  recordLabelCompact: { fontSize: 12, lineHeight: 15, letterSpacing: 1.1, marginBottom: 0 },
  recordingSavedText: { color: Colors.success, fontSize: 12, fontWeight: '800', marginTop: -6 },
  answerBox: {
    width: '100%',
    minHeight: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 5,
  },
  answerBoxCompact: {
    minHeight: 68,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 3,
  },
  answerBoxLabel: { color: Colors.textSub, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  answerBoxLabelCompact: { fontSize: 11, letterSpacing: 2.4 },
  answerPreview: { color: Colors.textSub, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  answerPreviewCompact: { fontSize: 14, lineHeight: 19 },
  errorText: { color: Colors.error, fontSize: 13, textAlign: 'center' },
  micErrorBox: { width: '100%', gap: 8, alignItems: 'center' },
  permissionBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  permissionText: { color: Colors.textSub, fontSize: 12, fontWeight: '900' },
  chatShell: {
    gap: 18,
  },
  chatShellCompact: {
    gap: 10,
  },
  chatScenarioCard: {
    minHeight: 142,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  chatScenarioCardCompact: {
    minHeight: 92,
    borderRadius: 24,
    backgroundColor: '#FFFFFFF0',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    shadowColor: Colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  chatScenarioImage: {
    width: 150,
    backgroundColor: Colors.tealDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatScenarioImageCompact: {
    width: 78,
  },
  chatScenarioGlyph: {
    color: Colors.teal,
    fontSize: 54,
    lineHeight: 62,
    fontWeight: '900',
  },
  chatScenarioCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 22,
    paddingVertical: 20,
    justifyContent: 'center',
    gap: 12,
  },
  chatScenarioTitle: {
    color: '#050B14',
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '900',
  },
  chatScenarioTitleCompact: {
    fontSize: 20,
    lineHeight: 24,
  },
  chatScenarioGoal: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  chatScenarioGoalCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  chatScenarioGoalStrong: {
    fontWeight: '900',
  },
  chatPersonaRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: {
    color: Colors.onPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  chatPersonaName: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  chatThread: {
    gap: 14,
  },
  chatThreadCompact: {
    gap: 10,
  },
  chatTurnGroup: {
    gap: 12,
  },
  incomingBubble: {
    alignSelf: 'flex-start',
    width: '72%',
    maxWidth: 760,
    borderRadius: 24,
    borderTopLeftRadius: 8,
    backgroundColor: '#D7F7FF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  incomingBubbleCompact: {
    width: '88%',
    borderRadius: 20,
    borderTopLeftRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleRomaji: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  bubbleMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  incomingText: {
    flex: 1,
    color: '#050B14',
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '900',
  },
  incomingTextCompact: {
    fontSize: 17,
    lineHeight: 24,
  },
  bubbleAudioButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outgoingBubbleRow: {
    width: '100%',
    alignItems: 'flex-end',
  },
  outgoingBubble: {
    width: '48%',
    minWidth: 280,
    borderRadius: 24,
    borderTopRightRadius: 8,
    backgroundColor: '#F1F2F4',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 7,
  },
  outgoingBubbleCompact: {
    width: '86%',
    minWidth: 0,
    borderRadius: 20,
    borderTopRightRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  outgoingMeta: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  outgoingText: {
    color: '#050B14',
    fontSize: 20,
    lineHeight: 29,
    fontWeight: '900',
  },
  outgoingTextCompact: {
    fontSize: 16,
    lineHeight: 22,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  chatAvatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarSmallText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  typingBubble: {
    minWidth: 74,
    minHeight: 44,
    borderRadius: 22,
    borderTopLeftRadius: 8,
    backgroundColor: '#D7F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  typingDots: {
    minWidth: 48,
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.ink,
  },
  chatComposer: {
    borderTopWidth: 5,
    borderTopColor: Colors.gold,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 14,
    gap: 11,
    shadowColor: Colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  chatComposerCompact: {
    borderRadius: 22,
    padding: 12,
    gap: 9,
    borderTopWidth: 4,
  },
  chatComposerTop: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  messagesLeftPill: {
    minHeight: 28,
    justifyContent: 'center',
  },
  messagesLeftText: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  messagesLeftTextCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  chatTimerPill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: '#F6C24755',
  },
  chatTimerText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  chatInput: {
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4BAEC5',
    backgroundColor: Colors.card,
    color: Colors.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chatInputCompact: {
    minHeight: 66,
    fontSize: 16,
    lineHeight: 21,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chatToolRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  chatToolButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  chatToolText: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  chatSendButton: {
    marginLeft: 'auto',
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: Colors.ink,
    borderBottomWidth: 4,
    borderBottomColor: '#070D17',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  chatSendButtonDisabled: {
    opacity: 0.5,
    borderBottomWidth: 0,
  },
  chatSendText: {
    color: Colors.onPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  textInput: {
    minHeight: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    color: Colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    padding: 16,
  },
  textInputCompact: {
    minHeight: 128,
    borderRadius: 18,
    fontSize: 17,
    lineHeight: 22,
    padding: 18,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderBottomWidth: 5,
    borderBottomColor: '#A93425',
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryBtnCompact: {
    minHeight: 46,
    borderRadius: 15,
    borderBottomWidth: 4,
  },
  primaryBtnDisabled: { opacity: 0.62, borderBottomWidth: 0, shadowOpacity: 0 },
  primaryText: { color: Colors.onPrimary, fontSize: 18, fontWeight: '900' },
  primaryTextCompact: { fontSize: 16, lineHeight: 20 },
  primaryDock: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 4,
  },
  primaryDockCompact: {
    paddingTop: 0,
    paddingBottom: 2,
  },
  sideLabel: {
    color: Colors.primary,
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
  sideHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  reviewingPanel: {
    width: '100%',
    minHeight: 84,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  reviewingPanelChat: {
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  reviewingCopy: { flex: 1, gap: 3 },
  reviewingTitle: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  reviewingDetail: { color: Colors.textSub, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  resultDoneBtn: {
    width: 58,
    minHeight: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 5,
    borderBottomColor: '#A93425',
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: Colors.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 24,
    shadowColor: '#0F1B2D',
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  resultCardCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 14,
    borderRadius: 24,
    padding: 18,
  },
  resultScoreBadge: {
    width: 106,
    height: 106,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
  },
  resultScoreBadgeCompact: {
    alignSelf: 'flex-start',
    width: 84,
    height: 84,
    borderRadius: 24,
  },
  resultScoreValue: { fontSize: 48, lineHeight: 54, fontWeight: '900' },
  resultScoreMax: { fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 18 },
  resultCopy: { flex: 1, gap: 6 },
  resultKicker: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  resultTitle: { color: Colors.text, fontSize: 34, lineHeight: 40, fontWeight: '900' },
  resultSubtitle: { color: Colors.textSub, fontSize: 15, fontWeight: '700' },
  resultSummary: { color: Colors.textSub, fontSize: 17, lineHeight: 25, fontWeight: '700' },
  resultStats: {
    width: 220,
    flexDirection: 'row',
    gap: 10,
  },
  resultStatsCompact: {
    width: '100%',
  },
  resultStatTile: {
    flex: 1,
    minHeight: 82,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  resultStatValue: { color: Colors.text, fontSize: 25, lineHeight: 31, fontWeight: '900' },
  resultStatLabel: {
    color: Colors.textSub,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  coachGrid: {
    flexDirection: 'row',
    gap: 14,
  },
  coachGridCompact: {
    flexDirection: 'column',
  },
  coachCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 18,
    gap: 12,
  },
  coachCardPrimary: {
    flex: 1.65,
    backgroundColor: Colors.surfaceTranslucent,
  },
  coachLead: { color: Colors.text, fontSize: 19, lineHeight: 26, fontWeight: '900' },
  coachNoteList: { gap: 9 },
  coachNoteRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  coachDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: Colors.primary,
  },
  coachNoteText: { flex: 1, color: Colors.textSub, fontSize: 15, lineHeight: 22, fontWeight: '800' },
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondaryDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skillChipText: { color: Colors.text, fontSize: 13, fontWeight: '900' },
  feedbackTitle: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  feedbackBullet: { color: Colors.textSub, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  turnList: { gap: 14 },
  turnReview: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 18,
    gap: 14,
  },
  turnReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  turnNumberBadge: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ink,
  },
  turnNumberText: { color: Colors.onPrimary, fontSize: 19, fontWeight: '900' },
  turnHeaderCopy: { flex: 1, gap: 3 },
  turnScorePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  turnScorePillStrong: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondaryDim,
  },
  turnScorePillWeak: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryDim,
  },
  turnScoreText: { fontSize: 14, fontWeight: '900' },
  turnReviewLabel: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  turnPrompt: { color: Colors.text, fontSize: 18, lineHeight: 25, fontWeight: '900' },
  turnReason: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  answerCompare: { flexDirection: 'row', gap: 10 },
  answerCompareCompact: { flexDirection: 'column' },
  answerPane: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 7,
  },
  answerPaneLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  turnAnswer: { color: Colors.textSub, fontSize: 15, lineHeight: 22, fontWeight: '800' },
  modelAnswer: { color: Colors.text, fontSize: 15, lineHeight: 22, fontWeight: '900' },
  turnTips: {
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  turnTipRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  turnTipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: Colors.secondary,
  },
  turnTipText: { flex: 1, color: Colors.textSub, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionRowCompact: { gap: 8 },
  secondaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 3,
    borderBottomColor: Colors.borderBright,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  secondaryBtnCompact: {
    minHeight: 44,
    borderRadius: 14,
  },
  secondaryText: { color: Colors.textSub, fontSize: 14, fontWeight: '900' },
  savedBtn: { borderColor: Colors.success, backgroundColor: Colors.successDim },
  savedText: { color: Colors.success },
});
