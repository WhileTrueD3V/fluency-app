import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/colors';
import { DrillAccents, tint } from '@/constants/drillAccents';
import {
  getPrefs,
  getRecentPromptIds,
  getStartingLevelProfile,
  getSessionHistory,
  getStatsForLanguage,
  hasCompletedRewardKey,
  isItemSaved,
  recordPromptExposure,
} from '@/utils/storage';
import { getRandomSpeakingPrompts, getSpeakingPromptById } from '@/data';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import type { SpeechDeliveryMetrics } from '@/hooks/useSpeechRecognition';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { evaluateSpeaking, xpForScore } from '@/utils/scoring';
import { recordAttemptMemory, recordSpeakingScore, removeSavedItem, saveItem } from '@/utils/storage';
import { reviewSpeakingAttemptWithAI } from '@/utils/aiSpeaking';
import { stringSimilarityScore } from '@/utils/pronunciationScoring';
import {
  getGeneratedPracticeMemory,
  loadGeneratedPracticeCache,
  refreshGeneratedPracticeCache,
  selectPracticeItems,
  uniquePracticeItems,
} from '@/utils/practiceContentQueue';
import { parseTargetSkillsParam } from '@/utils/targetSkills';
import {
  applyChallengeBoostXP,
  chooseStrongestChallengeBoost,
  getAstroChallengeBoostState,
  getChallengeBoostState,
  type ChallengeBoostState,
} from '@/utils/challengeBoost';
import { getPlayerLevel } from '@/utils/progression';
import { getLanguage, type LanguageCode } from '@/constants/languages';
import { RecordButton } from '@/components/RecordButton';
import { XpBurst } from '@/components/XpBurst';
import { Card } from '@/components/ui/Card';
import { DrillHeader } from '@/components/DrillHeader';
import { DrillLoadingState } from '@/components/DrillLoadingState';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { BookmarkIcon } from '@/components/Icons';
import type { SpeakingPrompt } from '@/data/types';
import type { SpeakingResult } from '@/utils/scoring';

type Phase = 'prompt' | 'recording' | 'transcript' | 'evaluating' | 'result';

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

interface DeliveryAnalysis {
  expectedDurationMs: number;
  spokenDurationMs: number;
  paceRatio: number;
  firstSpeechDelayMs: number | null;
  finalSegmentCount: number;
  restartCount: number;
  naturalnessCap: number;
  notes: string[];
}

interface UnifiedSpeakingResult {
  translation: SpeakingResult;
  pronunciationScore: number;
  pronunciationFeedback: string;
  naturalnessScore: number;
  naturalnessFeedback: string;
  coachNotes: string[];
  reviewProvider: 'remote-ai' | 'local-rubric';
  overallScore: number;
  xpEarned: number;
  passed: boolean;
  targetWasHeard: boolean;
}

function pronunciationFeedback(score: number): string {
  if (score >= 90) return 'Crisp and fluent. Your speech recognition match was excellent.';
  if (score >= 75) return 'Clearly understandable. Smooth out the last few sounds and rhythm.';
  if (score >= 55) return 'Recognisable, but pronunciation needs another pass.';
  return 'Listen to the example, slow down, and try to match the target sounds.';
}

function hasJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

function hasPoliteShape(text: string): boolean {
  return /(です|ます|ください|お願いします|ませんか|でしょうか|ありがとう)/.test(text);
}

function hasNaturalJapaneseEnding(text: string): boolean {
  return /(です|ます|だ|だよ|だね|ね|よ|かな|かも|んだけど|たい|ください|お願いします|ませんか|ましょうか|しようか)[。！？!?\s]*$/.test(text.trim());
}

function registerFitScore(transcript: string, target: string): number {
  const targetPolite = hasPoliteShape(target);
  const transcriptPolite = hasPoliteShape(transcript);
  if (targetPolite) return transcriptPolite ? 1 : 0.82;
  return 1;
}

function lengthBalanceScore(transcript: string, target: string): number {
  const spokenLength = transcript.replace(/\s/g, '').length;
  const targetLength = target.replace(/\s/g, '').length;
  if (!spokenLength || !targetLength) return 0;
  const ratio = Math.min(spokenLength, targetLength) / Math.max(spokenLength, targetLength);
  return Math.round(ratio * 100);
}

function repeatedChunkPenalty(text: string): number {
  const compact = text.replace(/\s/g, '');
  if (/(.)\1{4,}/.test(compact)) return 18;
  if (/(えー|あの|その|まあ){2,}/.test(compact)) return 10;
  return 0;
}

function naturalnessFeedback(score: number): string {
  if (score >= 90) return 'Natural phrasing, register, and sentence ending for this prompt.';
  if (score >= 75) return 'Good naturalness. Tighten the word choice or ending so it sounds less translated.';
  if (score >= 55) return 'Understandable, but the phrase choice or pronunciation shape still sounds learner-like.';
  return 'Focus on a short natural sentence, the right politeness level, and clear pronunciation of the key words.';
}

function expectedSpokenDurationMs(text: string): number {
  const spokenUnits = text
    .replace(/\s/g, '')
    .replace(/[。、，,.!?！？;；:：「」『』"“”'’`]/g, '')
    .length;
  return Math.max(1100, Math.min(9000, spokenUnits * 165));
}

function analyzeDelivery(
  transcript: string,
  target: string,
  confidence: number,
  metrics: SpeechDeliveryMetrics,
): DeliveryAnalysis {
  const expectedDurationMs = expectedSpokenDurationMs(target || transcript);
  const spokenDurationMs = metrics.totalDurationMs || expectedDurationMs;
  const paceRatio = spokenDurationMs / expectedDurationMs;
  const notes: string[] = [];
  let naturalnessCap = 100;

  if (paceRatio > 2.35) {
    notes.push('After speech began, the answer sounded overly segmented compared with the model phrase.');
    naturalnessCap = Math.min(naturalnessCap, 68);
  } else if (paceRatio > 1.75) {
    notes.push('The key words sounded spaced out; try linking the phrase more smoothly.');
    naturalnessCap = Math.min(naturalnessCap, 78);
  } else if (paceRatio < 0.52) {
    notes.push('The response may have clipped some key sounds; try a cleaner model-speed repeat.');
    naturalnessCap = Math.min(naturalnessCap, 76);
  }
  if (metrics.finalSegmentCount >= 4) {
    notes.push('Several in-answer restarts made the phrase sound blocky.');
    naturalnessCap = Math.min(naturalnessCap, 72);
  } else if (metrics.finalSegmentCount >= 3) {
    notes.push('The phrase broke into chunks; connect the particle and ending more naturally.');
    naturalnessCap = Math.min(naturalnessCap, 82);
  }
  if (metrics.restartCount > 0) {
    notes.push('A restart inside the answer made the phrase sound less native-like.');
    naturalnessCap = Math.min(naturalnessCap, 78);
  }
  if (confidence < 0.5) {
    notes.push('Speech recognition confidence was low, so pronunciation or clarity may need another pass.');
    naturalnessCap = Math.min(naturalnessCap, 88);
  }

  return {
    expectedDurationMs,
    spokenDurationMs,
    paceRatio,
    firstSpeechDelayMs: metrics.firstSpeechDelayMs,
    finalSegmentCount: metrics.finalSegmentCount,
    restartCount: metrics.restartCount,
    naturalnessCap,
    notes,
  };
}

function scoreNaturalness(
  transcript: string,
  target: string,
  confidence: number,
  delivery: DeliveryAnalysis,
): number {
  if (!transcript.trim()) return 0;

  const lengthShape = lengthBalanceScore(transcript, target) / 100;
  const scriptScore = hasJapanese(transcript) ? 1 : 0.35;
  const endingScore = hasNaturalJapaneseEnding(transcript) ? 1 : 0.76;
  const registerScore = registerFitScore(transcript, target);
  const deliveryScore = Math.min(1, delivery.naturalnessCap / 100);
  const confidenceShape = Math.max(0.62, confidence);
  const raw = (
    confidenceShape * 0.1
    + lengthShape * 0.16
    + scriptScore * 0.2
    + endingScore * 0.2
    + registerScore * 0.14
    + deliveryScore * 0.2
  ) * 100;

  const scored = Math.round(raw - repeatedChunkPenalty(transcript));
  return Math.max(0, Math.min(delivery.naturalnessCap, scored));
}

export default function TranslationScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const params = useLocalSearchParams<{
    promptId?: string;
    languageCode?: string;
    mockId?: string;
    rewardKey?: string;
    targetSkills?: string;
  }>();
  const initialLangCode = ((params.languageCode as LanguageCode | undefined) ?? 'ja') as LanguageCode;
  const initialSavedPrompt = params.promptId
    ? getSpeakingPromptById(initialLangCode, params.promptId)
    : null;
  const initialCachedPrompts = getGeneratedPracticeMemory<SpeakingPrompt>('speaking', initialLangCode);
  const initialLocalPrompts = getRandomSpeakingPrompts(
    initialLangCode,
    10,
    0,
    initialCachedPrompts.map((prompt) => prompt.id),
  );
  const initialPrompts = initialSavedPrompt
    ? [initialSavedPrompt]
    : uniquePracticeItems([
      ...initialLocalPrompts,
      ...initialCachedPrompts,
    ]).slice(0, 10);
  const [prompts, setPrompts] = useState<SpeakingPrompt[]>(initialPrompts);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('prompt');
  const [result, setResult] = useState<UnifiedSpeakingResult | null>(null);
  const [langCode, setLangCode] = useState<LanguageCode>('ja');
  const [showHint, setShowHint] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [targetWasHeard, setTargetWasHeard] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);
  const [challengeBoost, setChallengeBoost] = useState<ChallengeBoostState>(INACTIVE_CHALLENGE_BOOST);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [editableTranscript, setEditableTranscript] = useState('');
  const [scoredTranscript, setScoredTranscript] = useState('');

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const xpOpacity = useRef(new Animated.Value(0)).current;
  const xpTranslateY = useRef(new Animated.Value(12)).current;
  const xpScale = useRef(new Animated.Value(0.82)).current;
  const evaluatedAttemptRef = useRef<string | null>(null);
  const targetPlaybackRef = useRef(0);
  const attemptRunRef = useRef(0);
  const promptLoadRunRef = useRef(0);
  const userPlaybackRef = useRef<Audio.Sound | null>(null);
  const webUserPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const [isUserRecordingPlaying, setIsUserRecordingPlaying] = useState(false);

  useEffect(() => {
    const loadRun = promptLoadRunRef.current + 1;
    promptLoadRunRef.current = loadRun;
    let cancelled = false;
    setPrompts([]);
    getPrefs().then(async (p) => {
      const code = ((params.languageCode as LanguageCode | undefined) ?? p.selectedLanguage ?? 'ja') as LanguageCode;
      const routeTargetSkills = parseTargetSkillsParam(params.targetSkills);
      const stats = await getStatsForLanguage(code);
      const savedPrompt = params.promptId
        ? getSpeakingPromptById(code, params.promptId)
        : null;
      const [recentPromptIds, storedGenerated, sessions] = await Promise.all([
        getRecentPromptIds(code, 'speaking'),
        loadGeneratedPracticeCache<SpeakingPrompt>('speaking', code),
        getSessionHistory(),
      ]);
      if (promptLoadRunRef.current !== loadRun || cancelled) return;
      setLangCode(code);
      const level = getPlayerLevel(stats.totalXP);
      const startingProfile = await getStartingLevelProfile();
      const languageSessions = sessions.filter((session) => session.languageCode === code);
      const boost = !savedPrompt && !params.mockId
        ? chooseStrongestChallengeBoost(
          getChallengeBoostState(level.level, languageSessions, 'speaking'),
          getAstroChallengeBoostState(level.level, startingProfile, sessions, code),
        )
        : INACTIVE_CHALLENGE_BOOST;
      setChallengeBoost(boost);

      if (savedPrompt) {
        setPrompts([savedPrompt]);
        setCurrentIdx(0);
        return;
      }

      let cachedPrompts = selectPracticeItems([
        ...storedGenerated,
        ...getGeneratedPracticeMemory<SpeakingPrompt>('speaking', code),
      ], 10, recentPromptIds);
      if (cachedPrompts.length < 8) {
        const refreshed = await refreshGeneratedPracticeCache({
          mode: 'speaking',
          languageCode: code,
          totalXP: stats.totalXP,
          recentPromptIds,
          count: 8,
          targetSkills: [
            ...routeTargetSkills,
            'varied meaning targets',
            'short natural spoken Japanese',
            'no punctuation-dependent prompts',
            'avoid repeating recent speech act and topic families',
          ],
        });
        if (promptLoadRunRef.current !== loadRun || cancelled) return;
        cachedPrompts = selectPracticeItems([
          ...(refreshed as SpeakingPrompt[]),
          ...storedGenerated,
          ...getGeneratedPracticeMemory<SpeakingPrompt>('speaking', code),
        ], 10, recentPromptIds);
      }
      const localPrompts = getRandomSpeakingPrompts(
        code,
        10,
        stats.totalXP,
        [
          ...recentPromptIds,
          ...cachedPrompts.map((prompt) => prompt.id),
        ],
      );
      const nextPrompts = selectPracticeItems([
        ...cachedPrompts,
        ...localPrompts,
        ...getRandomSpeakingPrompts(code, 10, 0, []),
      ], 10, recentPromptIds, cachedPrompts);

      setPrompts(nextPrompts);
      setCurrentIdx(0);
      if (nextPrompts.length > 0) {
        void recordPromptExposure(code, 'speaking', nextPrompts.map((prompt) => prompt.id));
      }
      if (cachedPrompts.length < 8) {
        void refreshGeneratedPracticeCache({
          mode: 'speaking',
          languageCode: code,
          totalXP: stats.totalXP,
          recentPromptIds: [
            ...recentPromptIds,
            ...nextPrompts.map((prompt) => prompt.id),
          ],
          count: 8,
          targetSkills: [
            ...routeTargetSkills,
            'varied meaning targets',
            'short natural spoken Japanese',
            'no punctuation-dependent prompts',
          ],
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [params.languageCode, params.promptId, params.targetSkills]);

  const language = getLanguage(langCode);
  const currentPrompt = prompts[currentIdx] ?? null;
  const targetSentence = currentPrompt?.acceptableAnswers[0] ?? '';

  const { recognitionState, transcript, confidence, deliveryMetrics, error, startListening, stopListening, reset, requestPermission } =
    useSpeechRecognition(language.sttLocale);
  const {
    recordingState,
    recordingError,
    startRecording,
    stopRecording,
    resetRecording,
  } = useVoiceRecorder();

  const stopTargetAudio = useCallback(() => {
    targetPlaybackRef.current += 1;
    Speech.stop();
    setIsTTSPlaying(false);
  }, []);

  const stopUserRecordingPlayback = useCallback(async () => {
    const webAudio = webUserPlaybackRef.current;
    webUserPlaybackRef.current = null;
    if (webAudio) {
      webAudio.pause();
      webAudio.currentTime = 0;
      webAudio.onended = null;
    }
    const sound = userPlaybackRef.current;
    userPlaybackRef.current = null;
    setIsUserRecordingPlaying(false);
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        // Playback cleanup should never block the speaking flow.
      }
    }
  }, []);

  const toggleUserRecordingPlayback = useCallback(async () => {
    if (!recordingUri) return;
    if (isUserRecordingPlaying) {
      await stopUserRecordingPlayback();
      return;
    }
    stopTargetAudio();
    await stopUserRecordingPlayback();
    if (Platform.OS === 'web') {
      try {
        const audio = new globalThis.Audio(recordingUri);
        webUserPlaybackRef.current = audio;
        setIsUserRecordingPlaying(true);
        audio.onended = () => void stopUserRecordingPlayback();
        await audio.play();
      } catch {
        setIsUserRecordingPlaying(false);
      }
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: recordingUri });
      userPlaybackRef.current = sound;
      setIsUserRecordingPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          void stopUserRecordingPlayback();
        }
      });
      await sound.playAsync();
    } catch {
      setIsUserRecordingPlaying(false);
    }
  }, [isUserRecordingPlaying, recordingUri, stopTargetAudio, stopUserRecordingPlayback]);

  const goBack = () => {
    stopTargetAudio();
    void stopUserRecordingPlayback();
    resetRecording();
    router.replace(params.mockId ? '/mock' : '/(home)');
  };

  useEffect(() => {
    return () => {
      targetPlaybackRef.current += 1;
      Speech.stop();
      void stopUserRecordingPlayback();
    };
  }, [stopUserRecordingPlayback]);

  useEffect(() => {
    if (!currentPrompt) return;
    isItemSaved(currentPrompt.id, 'speaking').then(setSaved);
  }, [currentPrompt]);

  const playExample = async (markTargetHeard = true) => {
    if (isTTSPlaying) {
      stopTargetAudio();
      return;
    }
    if (!targetSentence) return;
    const playbackRun = targetPlaybackRef.current + 1;
    targetPlaybackRef.current = playbackRun;
    if (markTargetHeard) setTargetWasHeard(true);
    setIsTTSPlaying(true);
    await new Promise<void>((resolve) => {
      Speech.stop();
      Speech.speak(targetSentence, {
        language: language.ttsLocale,
        rate: 0.82,
        onDone: () => resolve(),
        onError: () => resolve(),
        onStopped: () => resolve(),
      });
    });
    if (targetPlaybackRef.current === playbackRun) setIsTTSPlaying(false);
  };

  const playModelResponse = async () => {
    await stopUserRecordingPlayback();
    await playExample(false);
  };

  const runFeedbackAnimation = useCallback((passed: boolean) => {
    flashOpacity.setValue(0);
    cardScale.setValue(1);
    shakeX.setValue(0);
    xpOpacity.setValue(0);
    xpTranslateY.setValue(12);
    xpScale.setValue(0.82);

    if (passed) {
      haptics.success();
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 520, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.spring(cardScale, { toValue: 1.04, friction: 4, tension: 160, useNativeDriver: true }),
          Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(120),
          Animated.parallel([
            Animated.timing(xpOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
            Animated.spring(xpTranslateY, { toValue: -24, friction: 7, tension: 80, useNativeDriver: true }),
            Animated.spring(xpScale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
          ]),
          Animated.timing(xpOpacity, { toValue: 0, duration: 450, delay: 450, useNativeDriver: true }),
        ]),
      ]).start();
      return;
    }

    haptics.error();
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start();
  }, [cardScale, flashOpacity, shakeX, xpOpacity, xpScale, xpTranslateY]);

  const handleRecordToggle = () => {
    if (phase === 'evaluating') return;
    if (recognitionState === 'idle' || recognitionState === 'done' || recognitionState === 'error') {
      attemptRunRef.current += 1;
      setPhase('recording');
      setSaved(false);
      setResult(null);
      setEditableTranscript('');
      setScoredTranscript('');
      reset();
      resetRecording();
      setRecordingUri(null);
      startRecording();
      startListening(undefined, { continuous: true });
    } else if (recognitionState === 'listening') {
      stopListening();
      stopRecording().then((recording) => setRecordingUri(recording.uri));
    }
  };

  const handleScoreTranscript = () => {
    setScoredTranscript(editableTranscript);
    setPhase('evaluating');
  };

  useEffect(() => {
    if (recognitionState === 'done' && currentPrompt && phase === 'recording') {
      setEditableTranscript(transcript);
      setScoredTranscript('');
      setPhase('transcript');
    }
  }, [currentPrompt, phase, recognitionState, transcript]);

  useEffect(() => {
    if (phase === 'evaluating' && currentPrompt) {
      const reviewedTranscript = scoredTranscript;
      const attemptKey = `${currentPrompt.id}:${reviewedTranscript}:${confidence}:${targetWasHeard}`;
      if (evaluatedAttemptRef.current === attemptKey) return;
      evaluatedAttemptRef.current = attemptKey;
      const attemptRun = attemptRunRef.current;

      const rawTranslation = evaluateSpeaking(reviewedTranscript, currentPrompt.acceptableAnswers, confidence);
      const translationAccuracyScore = targetWasHeard && reviewedTranscript.trim()
        ? 25
        : rawTranslation.accuracyScore;
      const translation = {
        ...rawTranslation,
        accuracyScore: translationAccuracyScore,
        feedback: targetWasHeard
          ? 'Target audio was played, so translation credit is set to 25%. Pronunciation is still graded normally.'
          : rawTranslation.feedback,
      };
      const pronunciationMatch = stringSimilarityScore(reviewedTranscript, targetSentence);
      const pronunciationScore = reviewedTranscript.trim()
        ? Math.round((pronunciationMatch * 0.75 + confidence * 0.25) * 100)
        : 0;
      const delivery = analyzeDelivery(reviewedTranscript, targetSentence, confidence, deliveryMetrics);
      const naturalnessScore = scoreNaturalness(reviewedTranscript, targetSentence, confidence, delivery);
      const overallScore = Math.round(
        translation.accuracyScore * 0.45
        + pronunciationScore * 0.35
        + naturalnessScore * 0.2,
      );
      const applyResult = async () => {
        const aiReview = await reviewSpeakingAttemptWithAI({
          languageCode: langCode,
          englishPrompt: currentPrompt.english,
          targetAnswer: targetSentence,
          acceptableAnswers: currentPrompt.acceptableAnswers,
          transcript: reviewedTranscript,
          confidence,
          targetWasHeard,
          delivery,
          localScores: {
            translationAccuracy: translation.accuracyScore,
            pronunciation: pronunciationScore,
            naturalness: naturalnessScore,
            overall: overallScore,
          },
        });
        const remoteReview = aiReview?.provider === 'remote-ai' ? aiReview : null;
        const aiUnavailableReason = aiReview?.provider === 'unavailable' ? aiReview.error : null;

        if (attemptRunRef.current !== attemptRun) return;

        const finalTranslationScore = targetWasHeard && reviewedTranscript.trim()
          ? Math.min(remoteReview?.translationAccuracy ?? translation.accuracyScore, 25)
          : remoteReview?.translationAccuracy ?? translation.accuracyScore;
        const finalPronunciationScore = remoteReview?.pronunciation ?? pronunciationScore;
        const remoteNaturalness = remoteReview?.naturalness ?? naturalnessScore;
        const finalNaturalnessScore = Math.min(remoteNaturalness, delivery.naturalnessCap);
        const naturalnessWasDeliveryCapped = remoteNaturalness > delivery.naturalnessCap;
        const finalOverallScore = Math.round(
          finalTranslationScore * 0.45
          + finalPronunciationScore * 0.35
          + finalNaturalnessScore * 0.2,
        );
        const rewardKey = String(
          params.rewardKey
          ?? params.promptId
          ?? (params.mockId ? `${params.mockId}:speaking:${currentPrompt.id}` : currentPrompt.id),
        );
        const rewardClaimed = await hasCompletedRewardKey(langCode, 'speaking', rewardKey);
        const baseXP = xpForScore(finalOverallScore);
        const xpEarned = rewardClaimed ? 0 : applyChallengeBoostXP(baseXP, challengeBoost);
        const passed = finalTranslationScore >= 55 && finalPronunciationScore >= 55 && finalNaturalnessScore >= 55;

        setResult({
          translation: {
            ...translation,
            accuracyScore: finalTranslationScore,
            feedback: remoteReview?.meaningFeedback ?? translation.feedback,
          },
          pronunciationScore: finalPronunciationScore,
          pronunciationFeedback: remoteReview?.pronunciationFeedback
            ?? pronunciationFeedback(finalPronunciationScore),
          naturalnessScore: finalNaturalnessScore,
          naturalnessFeedback: naturalnessWasDeliveryCapped
            ? (delivery.notes[0] ?? naturalnessFeedback(finalNaturalnessScore))
            : (remoteReview?.naturalnessFeedback
              ?? delivery.notes[0]
              ?? naturalnessFeedback(finalNaturalnessScore)),
          coachNotes: [
            ...delivery.notes.slice(0, 2),
            ...(remoteReview?.coachNotes ?? []),
            ...(aiUnavailableReason ? [`AI review unavailable: ${aiUnavailableReason}`] : []),
          ].slice(0, 3),
          reviewProvider: remoteReview?.provider ?? 'local-rubric',
          overallScore: finalOverallScore,
          xpEarned,
          passed,
          targetWasHeard,
        });
        setPhase('result');
        runFeedbackAnimation(passed);
        setSessionXP((xp) => xp + xpEarned);
        void recordSpeakingScore(langCode, finalOverallScore, xpEarned, params.mockId, rewardKey);
        void recordAttemptMemory({
          type: 'speaking',
          languageCode: langCode,
          promptId: currentPrompt.id,
          score: finalOverallScore,
          correct: passed,
          question: currentPrompt.english,
          userAnswer: reviewedTranscript,
          expectedAnswer: targetSentence,
          context: `Spoken translation drill. Hint: ${currentPrompt.hint}`,
          weakSkills: [
            finalTranslationScore < 55 ? 'Meaning' : '',
            finalPronunciationScore < 55 ? 'Pronunciation' : '',
            finalNaturalnessScore < 55 ? 'Naturalness' : '',
            ...delivery.notes,
          ].filter((skill): skill is string => Boolean(skill)),
        });
      };

      applyResult();
    }
  }, [
    confidence,
    currentPrompt,
    challengeBoost,
    deliveryMetrics,
    langCode,
    params.mockId,
    params.promptId,
    params.rewardKey,
    phase,
    runFeedbackAnimation,
    scoredTranscript,
    targetSentence,
    targetWasHeard,
  ]);

  const handleNext = () => {
    stopTargetAudio();
    void stopUserRecordingPlayback();
    attemptRunRef.current += 1;
    if (currentIdx + 1 >= prompts.length) {
      goBack();
      return;
    }
    setCurrentIdx((i) => i + 1);
    setPhase('prompt');
    setResult(null);
    setShowHint(false);
    setSaved(false);
    setTargetWasHeard(false);
    setRecordingUri(null);
    setEditableTranscript('');
    setScoredTranscript('');
    resetRecording();
    evaluatedAttemptRef.current = null;
    reset();
  };

  const handleRetry = () => {
    stopTargetAudio();
    void stopUserRecordingPlayback();
    attemptRunRef.current += 1;
    setPhase('prompt');
    setResult(null);
    setShowHint(false);
    setSaved(false);
    setTargetWasHeard(false);
    setRecordingUri(null);
    setEditableTranscript('');
    setScoredTranscript('');
    evaluatedAttemptRef.current = null;
    resetRecording();
    reset();
  };

  const handleSave = async () => {
    if (!currentPrompt) return;
    haptics.impact('light');
    if (saved) {
      await removeSavedItem(currentPrompt.id, 'speaking');
      setSaved(false);
      return;
    }
    await saveItem({
      id: `sp-${currentPrompt.id}-${Date.now()}`,
      type: 'speaking',
      languageCode: langCode,
      promptId: currentPrompt.id,
      question: currentPrompt.english,
      answer: targetSentence,
    });
    setSaved(true);
  };

  if (!currentPrompt) {
    return (
      <SafeAreaView style={styles.safe}>
        <DrillLoadingState mode="speaking" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {result?.passed && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flash,
            { backgroundColor: Colors.success, opacity: flashOpacity },
          ]}
        />
      )}
      {result?.passed && result.xpEarned > 0 && (
        <XpBurst xp={result.xpEarned} opacity={xpOpacity} translateY={xpTranslateY} scale={xpScale} />
      )}

      <Text style={styles.bgGlyph}>話</Text>
      <View style={styles.container}>
        <DrillHeader
          current={Math.min(currentIdx + 1, prompts.length)}
          total={prompts.length}
          xp={sessionXP}
          saved={saved}
          onQuit={goBack}
          onSave={handleSave}
          accent={isCompact ? Colors.teal : DrillAccents.speaking}
          progressLabel="Prompt"
        />

        <ScrollView contentContainerStyle={[styles.scroll, isCompact && styles.scrollCompact]} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ transform: [{ scale: cardScale }, { translateX: shakeX }] }}>
          <View style={[styles.promptCard, isCompact && styles.promptCardCompact, isCompact && styles.promptCardMobile]}>
            <View style={[styles.promptHeader, isCompact && styles.promptHeaderCompact]}>
              <Text style={styles.promptLabel}>Translate, then speak it clearly</Text>
              <View style={styles.diffBadge}>
                <Text style={styles.diffText}>
                  {currentPrompt.difficulty}
                </Text>
              </View>
            </View>
            <Text style={[styles.englishPrompt, isCompact && styles.englishPromptCompact]}>{currentPrompt.english}</Text>

            {phase === 'prompt' && (
              <View style={styles.promptActions}>
                <TouchableOpacity onPress={() => setShowHint((h) => !h)} style={styles.ghostBtn}>
                  <Text style={styles.ghostBtnText}>{showHint ? 'Hide hint' : 'Hint'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void playExample()}
                  style={[styles.ghostBtn, isTTSPlaying && styles.ghostBtnDisabled]}
                >
                  <Text style={styles.ghostBtnText}>
                    {isTTSPlaying ? 'Stop target' : 'Hear target'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {showHint && (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>{currentPrompt.hint}</Text>
              </View>
            )}
            {targetWasHeard && phase !== 'result' && (
              <View style={styles.revealNotice}>
                <Text style={styles.revealNoticeText}>
                  Target heard. Translation score will be set to 25; pronunciation still counts normally.
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {phase !== 'result' && (
          <View style={[styles.recordArea, isCompact && styles.recordAreaCompact, isCompact && styles.recordAreaMobile]}>
            {phase === 'transcript' ? (
              <View style={styles.transcriptReviewCard}>
                <Text style={styles.transcriptReviewKicker}>Check what Kibbo heard</Text>
                <Text style={styles.transcriptReviewTitle}>Edit the transcript before scoring</Text>
                <Text style={styles.transcriptReviewText}>
                  This transcript is used for the meaning, pronunciation, and naturalness review.
                </Text>
                <TextInput
                  value={editableTranscript}
                  onChangeText={setEditableTranscript}
                  multiline
                  textAlignVertical="top"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Type or fix what you said..."
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={DrillAccents.speaking}
                  style={styles.transcriptInput}
                />
                {recordingState === 'stopped' && recordingUri && (
                  <Text style={styles.recordingSavedText}>Audio captured for naturalness comparison</Text>
                )}
                <View style={styles.transcriptReviewActions}>
                  <TouchableOpacity onPress={handleRetry} activeOpacity={0.84} style={styles.transcriptSecondaryBtn}>
                    <Text style={styles.transcriptSecondaryText}>Record again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleScoreTranscript} activeOpacity={0.86} style={styles.transcriptScoreBtn}>
                    <Text style={styles.transcriptScoreText}>Score this transcript</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={[styles.mobileRecordStage, isCompact && styles.mobileRecordStageCompact]}>
                  <RecordButton state={recognitionState} onPress={handleRecordToggle} />
                </View>
                {phase === 'evaluating' && (
                  <Text style={styles.recordHint}>Reviewing your answer...</Text>
                )}
                {recordingState === 'stopped' && recordingUri && (
                  <Text style={styles.recordingSavedText}>Audio captured for pronunciation and naturalness review</Text>
                )}
                {transcript.length > 0 && (
                  <View style={styles.transcriptBox}>
                    <Text style={styles.transcriptLabel}>You said</Text>
                    <Text style={styles.transcript}>{transcript}</Text>
                  </View>
                )}
              </>
            )}
            {(error || recordingError) && (
              <View style={styles.micErrorBox}>
                <Text style={styles.errorText}>{error ?? recordingError}</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
                  <Text style={styles.permissionText}>Try microphone permission again</Text>
                </TouchableOpacity>
              </View>
            )}
            {phase === 'evaluating' && (
              <View style={styles.reviewingBox}>
                <Text style={styles.reviewingText}>
                  Checking meaning, pronunciation, and naturalness.
                </Text>
              </View>
            )}
          </View>
        )}

        {phase === 'result' && result && (
          <View style={styles.resultArea}>
            <View style={[styles.scoreRow, isCompact && styles.scoreRowCompact]}>
              <View style={[styles.scoreTile, { borderColor: Colors.success }]}>
                <Text style={[styles.scoreValue, isCompact && styles.scoreValueCompact, { color: Colors.success }]}>
                  {result.translation.accuracyScore}
                </Text>
                <Text style={styles.scoreLabel}>Translation</Text>
              </View>
              <View style={[styles.scoreTile, { borderColor: DrillAccents.speaking }]}>
                <Text style={[styles.scoreValue, isCompact && styles.scoreValueCompact, { color: DrillAccents.speaking }]}>
                  {result.pronunciationScore}
                </Text>
                <Text style={styles.scoreLabel}>Pronunciation</Text>
              </View>
              <View style={[styles.scoreTile, { borderColor: DrillAccents.speaking }]}>
                <Text style={[styles.scoreValue, isCompact && styles.scoreValueCompact, { color: DrillAccents.speaking }]}>
                  {result.naturalnessScore}
                </Text>
                <Text style={styles.scoreLabel}>Naturalness</Text>
              </View>
              <View style={[styles.scoreTile, { borderColor: Colors.gold }]}>
                <Text style={[styles.scoreValue, isCompact && styles.scoreValueCompact, { color: Colors.gold }]}>
                  {result.overallScore}
                </Text>
                <Text style={styles.scoreLabel}>Overall</Text>
              </View>
            </View>

            <View style={[
              styles.resultBadge,
              { borderColor: result.passed ? Colors.success : Colors.error },
            ]}>
              <Text style={[
                styles.resultText,
                { color: result.passed ? Colors.success : Colors.error },
              ]}>
                {result.passed ? 'Strong rep' : 'Try again'}
              </Text>
              <Text style={styles.resultXp}>+{result.xpEarned} XP</Text>
            </View>
            <View style={[
              styles.providerBadge,
              {
                borderColor: result.reviewProvider === 'remote-ai' ? DrillAccents.speaking : Colors.border,
                backgroundColor: result.reviewProvider === 'remote-ai' ? tint(DrillAccents.speaking) : Colors.surface,
              },
            ]}>
              <Text style={[
                styles.providerText,
                { color: result.reviewProvider === 'remote-ai' ? DrillAccents.speaking : Colors.textMuted },
              ]}>
                {result.reviewProvider === 'remote-ai' ? 'AI reviewed' : 'Local review'}
              </Text>
            </View>

            <Card style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>Translation Accuracy</Text>
              <Text style={styles.feedbackText}>{result.translation.feedback}</Text>
              {result.targetWasHeard && (
                <Text style={styles.scoreNote}>Answer was revealed before recording.</Text>
              )}
              <View style={styles.divider} />
              <Text style={styles.feedbackTitle}>Pronunciation Fluency</Text>
              <Text style={styles.feedbackText}>{result.pronunciationFeedback}</Text>
              <View style={styles.divider} />
              <Text style={styles.feedbackTitle}>Naturalness</Text>
              <Text style={styles.feedbackText}>{result.naturalnessFeedback}</Text>
              <View style={styles.naturalnessCompareBox}>
                <Text style={styles.audioCompareLabel}>Compare the sound</Text>
                <View style={styles.audioCompareRow}>
                  <TouchableOpacity
                    onPress={toggleUserRecordingPlayback}
                    disabled={!recordingUri}
                    activeOpacity={0.82}
                    style={[
                      styles.audioCompareButton,
                      !recordingUri && styles.audioCompareButtonDisabled,
                    ]}
                  >
                    <Text style={[
                      styles.audioCompareText,
                      !recordingUri && styles.audioCompareTextDisabled,
                    ]}>
                      {isUserRecordingPlaying ? 'Stop yours' : 'Play yours'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={playModelResponse}
                    activeOpacity={0.82}
                    style={[styles.audioCompareButton, styles.audioCompareButtonModel]}
                  >
                    <Text style={[styles.audioCompareText, styles.audioCompareTextModel]}>
                      {isTTSPlaying ? 'Stop model' : 'Play model'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {!recordingUri && (
                  <Text style={styles.audioCompareNote}>Record an answer first, then compare your audio with the model.</Text>
                )}
              </View>
              {result.coachNotes.length > 0 && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.feedbackTitle}>Coach Notes</Text>
                  {result.coachNotes.map((note) => (
                    <Text key={note} style={styles.feedbackText}>- {note}</Text>
                  ))}
                </>
              )}
            </Card>

            <Card style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>You said</Text>
              <Text style={styles.reviewTranscript}>{scoredTranscript || transcript || '(no speech detected)'}</Text>
              <Text style={styles.reviewLabel}>Target answer</Text>
              <Text style={styles.reviewAnswer}>{targetSentence}</Text>
            </Card>

            <View style={[styles.feedbackActions, isCompact && styles.feedbackActionsCompact]}>
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.82}
                style={[styles.feedbackSaveBtn, saved && styles.feedbackSaveBtnDone]}
              >
                <BookmarkIcon size={17} color={saved ? Colors.success : Colors.textSub} />
                <Text style={[styles.feedbackSaveText, saved && styles.feedbackSaveTextDone]}>
                  {saved ? 'Saved' : 'Save to Library'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNext} activeOpacity={0.86} style={styles.nextBtn}>
                <Text style={styles.nextBtnText}>
                  {currentIdx + 1 >= prompts.length ? 'Finish' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleRetry} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1 },
  bgGlyph: {
    position: 'absolute',
    right: -70,
    top: 70,
    fontSize: 430,
    color: Colors.bgGlyph,
    fontFamily: undefined,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  scroll: { padding: 24, paddingTop: 18, gap: 22, paddingBottom: 190, maxWidth: 900, width: '100%', alignSelf: 'center' },
  scrollCompact: { paddingHorizontal: 14, paddingTop: 18, gap: 14, paddingBottom: 176 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textSub },

  promptCard: {
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
  promptCardCompact: {
    borderRadius: 26,
    padding: 20,
    gap: 14,
    backgroundColor: '#FFFFFFF2',
    borderColor: '#D9E2EC',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  promptCardMobile: {
    padding: 22,
    gap: 16,
    backgroundColor: '#FFFFFFF8',
    shadowOpacity: 0.055,
  },
  promptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  promptHeaderCompact: { alignItems: 'center' },
  promptLabel: { flex: 1, color: '#475569', fontSize: 13, lineHeight: 18, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.2 },
  diffBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  diffText: { color: Colors.textSub, fontSize: 11, fontWeight: '900', textTransform: 'capitalize' },
  englishPrompt: { fontSize: 46, fontWeight: '900', color: Colors.text, lineHeight: 54 },
  englishPromptCompact: { fontSize: 29, lineHeight: 36 },
  promptActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  ghostBtn: {
    backgroundColor: Colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ghostBtnDisabled: { opacity: 0.55 },
  ghostBtnText: { color: DrillAccents.speaking, fontSize: 15, fontWeight: '900' },
  hintBox: { backgroundColor: tint(DrillAccents.speaking), borderRadius: 12, padding: 12, borderWidth: 1, borderColor: DrillAccents.speaking },
  hintText: { color: Colors.textSub, fontSize: 13, lineHeight: 19 },
  revealNotice: {
    backgroundColor: Colors.warningDim,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: 12,
  },
  revealNoticeText: { color: Colors.textSub, fontSize: 13, lineHeight: 19 },

  recordArea: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFE8',
    shadowColor: Colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  recordAreaCompact: {
    borderRadius: 26,
    borderColor: '#D9E2EC',
    backgroundColor: '#FFFFFFF0',
    paddingVertical: 22,
    paddingHorizontal: 20,
    gap: 18,
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  recordAreaMobile: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
    backgroundColor: '#FFFFFFF8',
    shadowOpacity: 0.055,
  },
  mobileRecordStage: {
    width: '100%',
    minHeight: 158,
    borderRadius: 28,
    backgroundColor: '#F1F8F8',
    borderWidth: 1,
    borderColor: '#D7E7EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileRecordStageCompact: {
    minHeight: 174,
    paddingVertical: 18,
  },
  recordHint: { color: Colors.textSub, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 350, fontWeight: '800' },
  reviewingBox: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: DrillAccents.speaking,
    backgroundColor: tint(DrillAccents.speaking),
    padding: 12,
  },
  reviewingText: { color: Colors.textSub, fontSize: 13, lineHeight: 19, textAlign: 'center', fontWeight: '700' },
  recordingSavedText: { color: Colors.success, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  transcriptBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    gap: 4,
  },
  transcriptLabel: { color: Colors.textSub, fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 3 },
  transcript: { color: Colors.text, fontSize: 19, lineHeight: 28 },
  transcriptReviewCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: tint(DrillAccents.speaking, '44'),
    padding: 18,
    gap: 10,
    shadowColor: Colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  transcriptReviewKicker: {
    color: DrillAccents.speaking,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
  },
  transcriptReviewTitle: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  transcriptReviewText: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  transcriptInput: {
    minHeight: 118,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 20,
    lineHeight: 29,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  transcriptReviewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  transcriptSecondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptSecondaryText: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  transcriptScoreBtn: {
    flex: 1.3,
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: Colors.ink,
    borderBottomWidth: 4,
    borderBottomColor: '#06101E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptScoreText: {
    color: Colors.onPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
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

  resultArea: { gap: 16, alignItems: 'center' },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' },
  scoreRowCompact: { gap: 8 },
  scoreTile: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    gap: 3,
  },
  scoreValue: { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  scoreValueCompact: { fontSize: 28 },
  scoreLabel: { color: Colors.textSub, fontSize: 11, fontWeight: '700' },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resultText: { fontSize: 20, fontWeight: '900' },
  resultXp: { color: Colors.gold, fontSize: 15, fontWeight: '800' },
  providerBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  providerText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  feedbackCard: { width: '100%', gap: 8 },
  feedbackTitle: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  feedbackText: { color: Colors.textSub, fontSize: 14, lineHeight: 21 },
  scoreNote: { color: Colors.warning, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  reviewCard: { width: '100%', gap: 6 },
  naturalnessCompareBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 12,
    gap: 8,
    marginTop: 3,
  },
  audioCompareLabel: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  audioCompareRow: {
    flexDirection: 'row',
    gap: 10,
  },
  audioCompareButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioCompareButtonModel: {
    backgroundColor: tint(DrillAccents.speaking),
    borderColor: tint(DrillAccents.speaking, '44'),
  },
  audioCompareButtonDisabled: {
    opacity: 0.5,
  },
  audioCompareText: {
    color: Colors.textSub,
    fontSize: 13,
    fontWeight: '800',
  },
  audioCompareTextModel: {
    color: DrillAccents.speaking,
  },
  audioCompareTextDisabled: {
    color: Colors.textMuted,
  },
  audioCompareNote: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  reviewLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  reviewTranscript: { color: Colors.textSub, fontSize: 15, lineHeight: 22 },
  reviewAnswer: { color: Colors.success, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  feedbackActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  feedbackActionsCompact: { gap: 8 },
  feedbackSaveBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
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
  feedbackSaveText: { color: Colors.textSub, fontSize: 14, fontWeight: '800' },
  feedbackSaveTextDone: { color: Colors.success },
  retryBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  retryBtnText: { color: Colors.textSub, fontWeight: '700', fontSize: 15 },
  nextBtn: {
    flex: 1,
    minHeight: 48,
    backgroundColor: DrillAccents.speaking,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DrillAccents.speaking,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
