import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import type { ListeningQuestion } from '@/data/types';
import { LISTENING_CORRECT_XP, LISTENING_ATTEMPT_XP } from '@/utils/scoring';

type WebSpeechSynthesis = {
  cancel: () => void;
  getVoices: () => SpeechSynthesisVoice[];
  onvoiceschanged: (() => void) | null;
  speak: (utterance: SpeechSynthesisUtterance) => void;
};

type WebSpeechGlobals = typeof globalThis & {
  speechSynthesis?: WebSpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
};

export interface AnswerRecord {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  xpEarned: number;
}

export type SessionPhase = 'idle' | 'playing' | 'answering' | 'feedback' | 'complete';

export interface ListeningSessionState {
  phase: SessionPhase;
  currentIndex: number;
  questions: ListeningQuestion[];
  answers: AnswerRecord[];
  playCounts: Record<string, number>;
  streak: number;
  bestStreak: number;
  totalXP: number;
  selectedIndex: number | null;
  isPlaying: boolean;
  audioError: string | null;
}

type PlaybackRate = 0.75 | 1 | 1.25;

function getNextPlaybackRate(rate: PlaybackRate): PlaybackRate {
  if (rate === 0.75) return 1;
  if (rate === 1) return 1.25;
  return 0.75;
}

function getPlaybackSpeedLabel(rate: PlaybackRate) {
  if (rate === 0.75) return 'Slow';
  if (rate === 1.25) return 'Fast';
  return 'Normal';
}

function speakText(text: string, language: string, rate: PlaybackRate): Promise<void> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const webGlobals = globalThis as WebSpeechGlobals;
      const synth = webGlobals.speechSynthesis;
      const Utterance = webGlobals.SpeechSynthesisUtterance;

      if (!synth || !Utterance) {
        reject(new Error('Speech playback is not available in this browser.'));
        return;
      }

      const loadVoices = (attemptsLeft = 8): Promise<SpeechSynthesisVoice[]> => {
        const voices = synth.getVoices?.() ?? [];
        if (voices.length > 0 || attemptsLeft <= 0) return Promise.resolve(voices);
        return new Promise((voiceResolve) => {
          const timer = setTimeout(() => {
            voiceResolve(loadVoices(attemptsLeft - 1));
          }, 120);
          synth.onvoiceschanged = () => {
            clearTimeout(timer);
            voiceResolve(synth.getVoices?.() ?? []);
          };
        });
      };

      loadVoices()
        .then((voices) => {
          synth.cancel();

          const languageRoot = language.split('-')[0];
          const voice = voices.find((v) => v.lang === language)
            ?? voices.find((v) => String(v.lang).toLowerCase().startsWith(languageRoot));
          const utterance = new Utterance(text);
          utterance.lang = language;
          utterance.rate = rate;
          if (voice) utterance.voice = voice;

          const startedAt = Date.now();
          utterance.onend = () => {
            const duration = Date.now() - startedAt;
            if (text.length > 6 && duration < 500) {
              reject(new Error('Speech playback ended too quickly.'));
              return;
            }
            resolve();
          };
          utterance.onerror = () => reject(new Error('Speech playback failed.'));
          synth.speak(utterance);
        })
        .catch(reject);
    });
  }

  return new Promise<void>((resolve, reject) => {
    Speech.speak(text, {
      language,
      rate,
      onDone: () => resolve(),
      onError: () => reject(new Error('Speech playback failed.')),
      onStopped: () => resolve(),
    });
  });
}

function stopSpeech() {
  if (Platform.OS === 'web') {
    const webGlobals = globalThis as WebSpeechGlobals;
    webGlobals.speechSynthesis?.cancel();
    return;
  }
  Speech.stop();
}

export function useListeningSession(questions: ListeningQuestion[], ttsLocale: string, awardXP = true, xpMultiplier = 1, initialState?: Partial<ListeningSessionState> | null) {
  const [state, setState] = useState<ListeningSessionState>({
    phase: 'idle',
    currentIndex: 0,
    questions,
    answers: [],
    playCounts: {},
    streak: 0,
    bestStreak: 0,
    totalXP: 0,
    selectedIndex: null,
    isPlaying: false,
    audioError: null,
  });

  const ttsRef = useRef<boolean>(false);
  const playbackRunRef = useRef(0);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);

  useEffect(() => {
    return () => {
      playbackRunRef.current += 1;
      stopSpeech();
      ttsRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (questions.length === 0) return;
    playbackRunRef.current += 1;
    stopSpeech();
    ttsRef.current = false;
    const restoredIndex = Math.min(Math.max(0, initialState?.currentIndex ?? 0), Math.max(0, questions.length - 1));
    const restoredPhase = initialState?.phase === 'playing' ? 'answering' : initialState?.phase;
    setState({
      phase: restoredPhase ?? 'idle',
      currentIndex: restoredIndex,
      questions,
      answers: initialState?.answers ?? [],
      playCounts: initialState?.playCounts ?? {},
      streak: initialState?.streak ?? 0,
      bestStreak: initialState?.bestStreak ?? 0,
      totalXP: initialState?.totalXP ?? 0,
      selectedIndex: initialState?.selectedIndex ?? null,
      isPlaying: false,
      audioError: null,
    });
  }, [questions, initialState]);

  const currentQuestion = state.questions[state.currentIndex] ?? null;
  const currentPlayCount = currentQuestion ? (state.playCounts[currentQuestion.id] ?? 0) : 0;
  const canPlayCurrentAudio = currentPlayCount < 2;

  const playAudio = useCallback(async () => {
    if (!currentQuestion || ttsRef.current || currentPlayCount >= 2) return;
    const playbackRun = playbackRunRef.current + 1;
    playbackRunRef.current = playbackRun;
    const questionId = currentQuestion.id;
    const questionIndex = state.currentIndex;
    ttsRef.current = true;
    setState((s) => {
      const activeQuestion = s.questions[s.currentIndex];
      if (
        !activeQuestion
        || activeQuestion.id !== questionId
        || s.currentIndex !== questionIndex
        || (s.phase !== 'idle' && s.phase !== 'answering')
      ) {
        return s;
      }

      const nextPlayCounts = {
        ...s.playCounts,
        [questionId]: (s.playCounts[questionId] ?? 0) + 1,
      };
      return {
        ...s,
        phase: 'playing',
        isPlaying: true,
        selectedIndex: null,
        audioError: null,
        playCounts: nextPlayCounts,
      };
    });

    try {
      await speakText(currentQuestion.transcript, ttsLocale, playbackRate);
    } catch {
      if (playbackRunRef.current === playbackRun) {
        setState((s) => {
          const activeQuestion = s.questions[s.currentIndex];
          if (!activeQuestion || activeQuestion.id !== questionId || s.currentIndex !== questionIndex) {
            return s;
          }
          return {
            ...s,
            audioError: 'Audio playback is unavailable here. Try a device build if this keeps happening.',
          };
        });
      }
    } finally {
      if (playbackRunRef.current !== playbackRun) return;
      ttsRef.current = false;
      setState((s) => {
        const activeQuestion = s.questions[s.currentIndex];
        if (
          !activeQuestion
          || activeQuestion.id !== questionId
          || s.currentIndex !== questionIndex
          || s.phase !== 'playing'
        ) {
          return { ...s, isPlaying: false };
        }

        return { ...s, phase: 'answering', isPlaying: false };
      });
    }
  }, [currentPlayCount, currentQuestion, playbackRate, state.currentIndex, ttsLocale]);

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((rate) => getNextPlaybackRate(rate));
  }, []);

  const stopAudio = useCallback(() => {
    playbackRunRef.current += 1;
    stopSpeech();
    ttsRef.current = false;
    setState((s) => {
      if (s.phase !== 'playing') return { ...s, isPlaying: false };
      return { ...s, phase: 'answering', isPlaying: false };
    });
  }, []);

  const submitAnswer = useCallback(
    (selectedIndex: number) => {
      playbackRunRef.current += 1;
      stopSpeech();
      ttsRef.current = false;

      setState((s) => {
        const activeQuestion = s.questions[s.currentIndex];
        if (
          !activeQuestion
          || (s.phase !== 'answering' && s.phase !== 'idle' && s.phase !== 'playing')
        ) {
          return s;
        }

        const isCorrect = selectedIndex === activeQuestion.correctIndex;
        const baseXP = isCorrect ? LISTENING_CORRECT_XP : LISTENING_ATTEMPT_XP;
        const xpEarned = awardXP ? Math.round(baseXP * Math.max(1, xpMultiplier)) : 0;
        const newStreak = isCorrect ? s.streak + 1 : 0;
        const record: AnswerRecord = {
          questionId: activeQuestion.id,
          selectedIndex,
          correctIndex: activeQuestion.correctIndex,
          isCorrect,
          xpEarned,
        };

        return {
          ...s,
          phase: 'feedback',
          selectedIndex,
          answers: [...s.answers, record],
          streak: newStreak,
          bestStreak: Math.max(s.bestStreak, newStreak),
          totalXP: s.totalXP + xpEarned,
          isPlaying: false,
        };
      });
    },
    [awardXP, xpMultiplier],
  );

  const nextQuestion = useCallback(() => {
    playbackRunRef.current += 1;
    stopSpeech();
    ttsRef.current = false;
    setState((s) => {
      if (s.phase !== 'feedback') return s;
      const nextIndex = s.currentIndex + 1;
      if (nextIndex >= s.questions.length) {
        return { ...s, phase: 'complete', isPlaying: false };
      }
      return {
        ...s,
        currentIndex: nextIndex,
        phase: 'idle',
        selectedIndex: null,
        isPlaying: false,
        audioError: null,
      };
    });
  }, []);

  // Auto-advance from feedback after a short pause
  const advanceAfterFeedback = useCallback(() => {
    nextQuestion();
  }, [nextQuestion]);

  const correctCount = state.answers.filter((a) => a.isCorrect).length;
  const accuracyPct =
    state.answers.length > 0
      ? Math.round((correctCount / state.answers.length) * 100)
      : 0;

  return {
    state,
    currentQuestion,
    correctCount,
    accuracyPct,
    currentPlayCount,
    canPlayCurrentAudio,
    playbackRate,
    playbackSpeedLabel: getPlaybackSpeedLabel(playbackRate),
    cyclePlaybackRate,
    playAudio,
    stopAudio,
    submitAnswer,
    advanceAfterFeedback,
  };
}
