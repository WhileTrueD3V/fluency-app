import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AnswerChoice } from '@/components/AnswerChoice';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { DrillHeader } from '@/components/DrillHeader';
import { DrillLoadingState } from '@/components/DrillLoadingState';
import { FuriganaText } from '@/components/FuriganaText';
import { XpBurst } from '@/components/XpBurst';
import {
  BookmarkIcon,
  CheckIcon,
  FileTextIcon,
  FlameIcon,
  StarIcon,
  TargetIcon,
  XIcon,
} from '@/components/Icons';
import { Colors } from '@/constants/colors';
import { DrillAccents, tint } from '@/constants/drillAccents';
import { getLanguage, type LanguageCode } from '@/constants/languages';
import { getRandomReadingSets, getReadingSetById } from '@/data';
import type { ReadingPassageSet, ReadingPromptQuestion } from '@/data/types';
import { haptics } from '@/utils/haptics';
import {
  getGeneratedPracticeMemory,
  loadGeneratedPracticeCache,
  refreshGeneratedPracticeCache,
  selectPracticeItems,
} from '@/utils/practiceContentQueue';
import {
  getAppSettings,
  getStartingLevelProfile,
  getPrefs,
  getRecentPromptIds,
  getSavedItems,
  getSessionHistory,
  getStatsForLanguage,
  hasCompletedRewardKey,
  recordAttemptMemory,
  recordPromptExposure,
  recordReadingSession,
  removeSavedItem,
  saveItem,
  type ReadingTextSize,
} from '@/utils/storage';
import { getPlayerLevel } from '@/utils/progression';
import { LISTENING_ATTEMPT_XP, LISTENING_CORRECT_XP } from '@/utils/scoring';
import { parseTargetSkillsParam } from '@/utils/targetSkills';
import {
  applyChallengeBoostXP,
  chooseStrongestChallengeBoost,
  getAstroChallengeBoostState,
  getChallengeBoostState,
  type ChallengeBoostState,
} from '@/utils/challengeBoost';

const DEFAULT_PASSAGE_COUNT = 3;

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

function readingTextScaleFor(size: ReadingTextSize) {
  if (size === 'extraLarge') return 1.28;
  if (size === 'large') return 1.14;
  return 1;
}

type AnswerRecord = {
  questionId: string;
  passageId: string;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  xpEarned: number;
};

function secondsPerQuestionForDifficulty(difficulty: ReadingPassageSet['difficulty']) {
  if (difficulty === 'advanced') return 120;
  if (difficulty === 'intermediate') return 105;
  return 90;
}

function allowedReadingDifficultiesForBoost(
  level: ReturnType<typeof getPlayerLevel>,
  boost: ChallengeBoostState,
) {
  const allowed = new Set(level.allowedDifficulties);
  if (boost.active) allowed.add(boost.difficulty);
  return allowed;
}

function minimumSecondsForDifficulty(difficulty: ReadingPassageSet['difficulty']) {
  if (difficulty === 'advanced') return 240;
  if (difficulty === 'intermediate') return 210;
  return 180;
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

type ReadingEvidenceHint = {
  evidence: string;
  keyword: string;
  explanation: string;
};

function splitPassageSentences(passage: string) {
  const matches = passage.match(/[^。！？!?]+[。！？!?]?/g) ?? [];
  return matches.map((part) => part.trim()).filter(Boolean);
}

function compactEvidenceText(text: string) {
  return text.toLowerCase().replace(/[\s。、，,.!?！？;；:：「」『』()（）"'’“”]/g, '');
}

const ENGLISH_EVIDENCE_CUES: Array<[RegExp, string[]]> = [
  [/cafe|coffee shop|coffee/i, ["カフェ"]],
  [/park/i, ["公園"]],
  [/study|studying/i, ["勉強"]],
  [/quiet/i, ["静か"]],
  [/station/i, ["駅前", "駅"]],
  [/weekend/i, ["週末"]],
  [/crowd|crowded|busy/i, ["こんで", "混んで"]],
  [/seat|spacious/i, ["席", "広く"]],
  [/staff|rush/i, ["店員", "急がされる", "急かされる"]],
  [/cash/i, ["現金"]],
  [/smartphone|phone/i, ["スマートフォン"]],
  [/young/i, ["若い人"]],
  [/discount/i, ["割引"]],
  [/student id/i, ["学生証"]],
  [/rain/i, ["雨"]],
  [/ticket/i, ["チケット"]],
  [/meeting|start time/i, ["会議", "開始時間"]],
  [/train.*delay|delayed/i, ["電車が遅れて", "遅れて"]],
  [/exchange|replace/i, ["交換"]],
  [/zipper|broke|broken/i, ["チャック", "こわれて"]],
];

function inferEvidenceKeyword(evidence: string) {
  const phrase = evidence.match(/[一-龯][一-龯ぁ-んァ-ヶー]*(?:を|が|は|に|で)?[一-龯ぁ-んァ-ヶー]*/)?.[0];
  return phrase ?? evidence.slice(0, Math.min(16, evidence.length));
}

function cueTermsForQuestion(question: ReadingPromptQuestion) {
  const correctChoice = question.choices[question.correctIndex] ?? "";
  const source = [question.question, correctChoice].join(" ");
  const cueTerms = ENGLISH_EVIDENCE_CUES
    .filter(([pattern]) => pattern.test(source))
    .flatMap(([, terms]) => terms);
  const japaneseTerms = [question.evidence ?? "", question.keyword ?? ""]
    .flatMap((text) => text.split(/[^一-龯ぁ-んァ-ヶー]+/))
    .filter((term) => term.length >= 2);
  return Array.from(new Set([...cueTerms, ...japaneseTerms].map(compactEvidenceText).filter((term) => term.length >= 2)));
}

function scoreEvidenceSentence(sentence: string, terms: string[]) {
  const compactSentence = compactEvidenceText(sentence);
  return terms.reduce((sum, term) => sum + (compactSentence.includes(term) ? 1 : 0), 0);
}

function getReadingEvidenceHint(passage: ReadingPassageSet, question: ReadingPromptQuestion): ReadingEvidenceHint {
  const sentences = splitPassageSentences(passage.passage);
  const explicitEvidence = question.evidence?.trim();
  const explicitKeyword = question.keyword?.trim();

  if (explicitEvidence) {
    return {
      evidence: passage.passage.includes(explicitEvidence)
        ? explicitEvidence
        : sentences.find((sentence) => sentence.includes(explicitEvidence) || explicitEvidence.includes(sentence)) ?? explicitEvidence,
      keyword: explicitKeyword || inferEvidenceKeyword(explicitEvidence),
      explanation: question.explanation?.trim() || "This line gives the detail needed to choose the correct answer.",
    };
  }

  const cueTerms = cueTermsForQuestion(question);
  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: scoreEvidenceSentence(sentence, cueTerms) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const best = ranked[0];

  if (!best || best.score <= 0) {
    return {
      evidence: "",
      keyword: explicitKeyword || "",
      explanation: question.explanation?.trim() || "",
    };
  }

  return {
    evidence: best.sentence,
    keyword: explicitKeyword || inferEvidenceKeyword(best.sentence),
    explanation: question.explanation?.trim() || "This line gives the detail needed to choose the correct answer.",
  };
}

function readingExposureIds(passages: ReadingPassageSet[]) {
  return passages.flatMap((passage) => [
    passage.id,
    compactEvidenceText([passage.title, passage.context, passage.passage].join(" ")).slice(0, 180),
    ...passage.questions.flatMap((question) => [
      question.id,
      `${passage.id}:${question.id}`,
      compactEvidenceText([
        passage.title,
        question.question,
        question.choices[question.correctIndex] ?? "",
        question.evidence ?? "",
        question.keyword ?? "",
      ].join(" ")).slice(0, 180),
    ]),
  ].filter(Boolean));
}

export default function APReadingSession() {
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
  const [langCode, setLangCode] = useState<LanguageCode>('ja');
  const [passages, setPassages] = useState<ReadingPassageSet[]>([]);
  const [ready, setReady] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [currentPassageIndex, setCurrentPassageIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<'answering' | 'feedback' | 'complete'>('answering');
  const [readingTextSize, setReadingTextSize] = useState<ReadingTextSize>('extraLarge');
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [challengeBoost, setChallengeBoost] = useState<ChallengeBoostState>(INACTIVE_CHALLENGE_BOOST);
  const [secondsLeft, setSecondsLeft] = useState(180);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const xpOpacity = useRef(new Animated.Value(0)).current;
  const xpTranslateY = useRef(new Animated.Value(12)).current;
  const xpScale = useRef(new Animated.Value(0.82)).current;
  const completedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAppSettings().then((settings) => {
      if (!cancelled) setReadingTextSize(settings.readingTextSize);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const prefs = await getPrefs();
      const code = ((params.languageCode as LanguageCode | undefined) ?? prefs.selectedLanguage ?? 'ja') as LanguageCode;
      const savedPassage = params.promptId ? getReadingSetById(code, params.promptId) : null;
      const requestedCount = Number(params.count);
      const passageCount = Number.isFinite(requestedCount)
        ? Math.max(1, Math.min(DEFAULT_PASSAGE_COUNT, requestedCount))
        : DEFAULT_PASSAGE_COUNT;
      const routeTargetSkills = parseTargetSkillsParam(params.targetSkills);
      setLangCode(code);
      setReady(false);

      const [savedItems, stats, recentPromptIds, storedGenerated, sessions] = await Promise.all([
        getSavedItems(),
        getStatsForLanguage(code),
        getRecentPromptIds(code, 'reading'),
        loadGeneratedPracticeCache<ReadingPassageSet>('reading', code),
        getSessionHistory(),
      ]);
      if (cancelled) return;
      const level = getPlayerLevel(stats.totalXP);
      const startingProfile = await getStartingLevelProfile();
      const languageSessions = sessions.filter((session) => session.languageCode === code);
      const boost = !savedPassage && !params.mockId
        ? chooseStrongestChallengeBoost(
          getChallengeBoostState(level.level, languageSessions, 'reading'),
          getAstroChallengeBoostState(level.level, startingProfile, sessions, code),
        )
        : INACTIVE_CHALLENGE_BOOST;
      const allowedDifficulties = allowedReadingDifficultiesForBoost(level, boost);
      setChallengeBoost(boost);
      let cachedPassages = selectPracticeItems([
        ...getGeneratedPracticeMemory<ReadingPassageSet>('reading', code),
        ...storedGenerated,
      ], passageCount, recentPromptIds)
        .filter((passage) => allowedDifficulties.has(passage.difficulty));
      if (!savedPassage && cachedPassages.length < passageCount) {
        const refreshed = await refreshGeneratedPracticeCache({
          mode: 'reading',
          languageCode: code,
          totalXP: stats.totalXP,
          recentPromptIds,
          count: Math.max(3, passageCount),
          targetSkills: [
            ...routeTargetSkills,
            'linked passage questions',
            'detail and inference mix',
            'level-appropriate kanji load',
            'avoid repeating recent passage topic families',
          ],
        });
        if (cancelled) return;
        cachedPassages = selectPracticeItems([
          ...(refreshed as ReadingPassageSet[]),
          ...getGeneratedPracticeMemory<ReadingPassageSet>('reading', code),
          ...storedGenerated,
        ], passageCount, recentPromptIds)
          .filter((passage) => allowedDifficulties.has(passage.difficulty));
      }
      const localPassages = getRandomReadingSets(
        code,
        passageCount,
        stats.totalXP,
        [
          ...recentPromptIds,
          ...cachedPassages.map((passage) => passage.id),
        ],
      );
      const nextPassages = savedPassage
        ? [savedPassage]
        : selectPracticeItems([
          ...cachedPassages,
          ...localPassages,
          ...getRandomReadingSets(code, passageCount, 0, []),
        ], passageCount, recentPromptIds, cachedPassages);

      if (!savedPassage && nextPassages.length > 0) {
        void recordPromptExposure(code, "reading", readingExposureIds(nextPassages));
      }

      setPassages(nextPassages);
      setCurrentPassageIndex(0);
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setSelectedIndex(null);
      setPhase('answering');
      setStreak(0);
      setBestStreak(0);
      setTotalXP(0);
      setReady(nextPassages.length > 0);
      setSavedIds(new Set(
        savedItems
          .filter((item) => item.type === 'reading' && item.languageCode === code)
          .map((item) => item.promptId),
      ));
      if (!savedPassage && cachedPassages.length < passageCount) {
        void refreshGeneratedPracticeCache({
          mode: 'reading',
          languageCode: code,
          totalXP: stats.totalXP,
          recentPromptIds: [
            ...recentPromptIds,
            ...nextPassages.map((passage) => passage.id),
          ],
          count: Math.max(3, passageCount),
          targetSkills: [
            ...routeTargetSkills,
            'linked passage questions',
            'detail and inference mix',
            'level-appropriate kanji load',
          ],
        });
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [params.count, params.languageCode, params.promptId, params.sessionId, params.targetSkills]);

  const currentPassage = passages[currentPassageIndex] ?? null;
  const currentQuestion: ReadingPromptQuestion | null = currentPassage?.questions[currentQuestionIndex] ?? null;
  const readingEvidenceHint = currentPassage && currentQuestion
    ? getReadingEvidenceHint(currentPassage, currentQuestion)
    : null;
  const shouldHighlightEvidence = phase === 'feedback'
    && selectedIndex !== currentQuestion?.correctIndex;
  const highlightedEvidenceText = shouldHighlightEvidence ? readingEvidenceHint?.evidence : null;
  const latestAnswer = answers[answers.length - 1];
  const isSaved = currentPassage ? savedIds.has(currentPassage.id) : false;
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const totalQuestionCount = passages.reduce((sum, passage) => sum + passage.questions.length, 0);
  const previousPassageQuestionCount = passages
    .slice(0, currentPassageIndex)
    .reduce((sum, passage) => sum + passage.questions.length, 0);
  const currentQuestionNumber = Math.min(previousPassageQuestionCount + currentQuestionIndex + 1, totalQuestionCount);
  const isLastQuestionForPassage = currentPassage
    ? currentQuestionIndex + 1 >= currentPassage.questions.length
    : false;
  const passageSeconds = currentPassage
    ? Math.max(
      minimumSecondsForDifficulty(currentPassage.difficulty),
      currentPassage.questions.length * secondsPerQuestionForDifficulty(currentPassage.difficulty),
    )
    : 180;
  const passageBodyMaxHeight = isTight
    ? Math.min(230, Math.max(150, height * 0.22))
    : isCompact
    ? Math.min(350, Math.max(235, height * 0.34))
    : Math.min(430, Math.max(280, height * 0.36));
  const readingTextScale = readingTextScaleFor(readingTextSize);
  const rewardKey = String(
    params.rewardKey
    ?? params.sessionId
    ?? params.promptId
    ?? (params.mockId ? `${params.mockId}:reading` : passages.map((passage) => passage.id).join('|')),
  );

  useEffect(() => {
    let cancelled = false;
    hasCompletedRewardKey(langCode, 'reading', rewardKey).then((claimed) => {
      if (!cancelled) setRewardClaimed(claimed);
    });
    return () => {
      cancelled = true;
    };
  }, [langCode, rewardKey]);

  useEffect(() => {
    if (!currentPassage || phase === 'complete') return;
    setSecondsLeft(passageSeconds);
  }, [currentPassageIndex, currentPassage, passageSeconds, phase]);

  useEffect(() => {
    if (!currentPassage || phase !== 'answering') return;
    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          submitAnswer(null);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentPassage, currentQuestionIndex, phase]);

  useEffect(() => {
    if (phase !== 'feedback' || !latestAnswer) return;

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
  }, [cardScale, flashOpacity, latestAnswer, phase, shakeX, xpOpacity, xpScale, xpTranslateY]);

  useEffect(() => {
    if (phase === 'complete' && passages.length > 0) {
      if (completedSessionRef.current === rewardKey) return;
      completedSessionRef.current = rewardKey;
      void recordReadingSession(langCode, correctCount, answers.length, bestStreak, totalXP, params.mockId, rewardKey);
      void recordAttemptMemory(answers.map((answer) => {
        const passage = passages.find((item) => item.id === answer.passageId);
        const question = passage?.questions.find((item) => item.id === answer.questionId);
        return {
          type: 'reading' as const,
          languageCode: langCode,
          promptId: answer.questionId,
          score: answer.isCorrect ? 100 : 0,
          correct: answer.isCorrect,
          question: question?.question ?? 'Reading question',
          userAnswer: answer.selectedIndex === null
            ? 'Timed out / no answer'
            : question?.choices[answer.selectedIndex] ?? 'No answer captured',
          expectedAnswer: question?.choices[answer.correctIndex] ?? '',
          context: passage ? `${passage.title}: ${passage.context}. ${passage.passage}` : undefined,
          weakSkills: answer.isCorrect ? [] : ['Task completion', 'Reading evidence'],
        };
      }));
    }
  }, [answers, bestStreak, correctCount, langCode, params.mockId, passages, phase, rewardKey, totalXP]);

  const submitAnswer = (choiceIndex: number | null) => {
    if (!currentQuestion || !currentPassage || phase !== 'answering') return;
    haptics.impact('light');
    const isCorrect = choiceIndex === currentQuestion.correctIndex;
    const baseXP = isCorrect ? LISTENING_CORRECT_XP : LISTENING_ATTEMPT_XP;
    const xpEarned = rewardClaimed ? 0 : applyChallengeBoostXP(baseXP, challengeBoost);
    const newStreak = isCorrect ? streak + 1 : 0;
    const answerRecord: AnswerRecord = {
      questionId: currentQuestion.id,
      passageId: currentPassage.id,
      selectedIndex: choiceIndex,
      correctIndex: currentQuestion.correctIndex,
      isCorrect,
      xpEarned,
    };
    setSelectedIndex(choiceIndex);
    setAnswers((current) => [...current, answerRecord]);
    setStreak(newStreak);
    setBestStreak((current) => Math.max(current, newStreak));
    setTotalXP((current) => current + xpEarned);
    setPhase('feedback');
  };

  const advanceAfterFeedback = () => {
    if (!currentPassage) return;
    const nextQuestionIndex = currentQuestionIndex + 1;

    if (nextQuestionIndex < currentPassage.questions.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      setSelectedIndex(null);
      setPhase('answering');
      return;
    }

    if (currentPassageIndex + 1 >= passages.length) {
      setPhase('complete');
      return;
    }
    setCurrentPassageIndex((index) => index + 1);
    setCurrentQuestionIndex(0);
    setSelectedIndex(null);
    setPhase('answering');
  };

  const handleSave = async () => {
    if (!currentPassage) return;
    haptics.impact('light');
    if (isSaved) {
      await removeSavedItem(currentPassage.id, 'reading');
      setSavedIds((current) => {
        const next = new Set(current);
        next.delete(currentPassage.id);
        return next;
      });
      return;
    }
    await saveItem({
      id: `rd-${currentPassage.id}-${Date.now()}`,
      type: 'reading',
      languageCode: langCode,
      promptId: currentPassage.id,
      question: `${currentPassage.title}: ${currentPassage.context}`,
      answer: `${currentPassage.questions.length} reading questions`,
    });
    setSavedIds((current) => new Set([...current, currentPassage.id]));
  };

  const exitSession = () => {
    router.replace(params.mockId ? '/mock' : '/(home)');
  };

  if (!ready || passages.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <DrillLoadingState mode="reading" />
      </SafeAreaView>
    );
  }

  if (phase === 'complete') {
    const accuracy = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.completeScroll}>
          <View style={styles.completeIcon}>
            <TargetIcon size={42} color={accuracy >= 70 ? Colors.success : DrillAccents.reading} strokeWidth={1.8} />
          </View>
          <Text style={styles.completeTitle}>Reading Set Complete</Text>

          <View style={styles.completeStats}>
            <View style={styles.completeStat}>
              <Text style={styles.completeStatValue}>{correctCount}/{answers.length}</Text>
              <Text style={styles.completeStatLabel}>Correct</Text>
            </View>
            <View style={styles.completeStat}>
              <Text style={[styles.completeStatValue, { color: Colors.success }]}>{accuracy}%</Text>
              <Text style={styles.completeStatLabel}>Accuracy</Text>
            </View>
            <View style={styles.completeStat}>
              <View style={styles.completeValueRow}>
                <FlameIcon size={22} color={Colors.warning} />
                <Text style={[styles.completeStatValue, { color: Colors.warning }]}>{bestStreak}</Text>
              </View>
              <Text style={styles.completeStatLabel}>Best Streak</Text>
            </View>
            <View style={styles.completeStat}>
              <View style={styles.completeValueRow}>
                <StarIcon size={22} color={Colors.gold} />
                <Text style={[styles.completeStatValue, { color: Colors.gold }]}>{totalXP}</Text>
              </View>
              <Text style={styles.completeStatLabel}>XP Earned</Text>
            </View>
          </View>

          <View style={[styles.completeActions, isCompact && styles.completeActionsCompact]}>
            {!params.mockId && (
              <TouchableOpacity
                onPress={() => router.replace({
                  pathname: '/ap/reading',
                  params: { sessionId: `${Date.now()}`, rewardKey, languageCode: langCode },
                })}
                style={styles.playAgainBtn}
              >
                <Text style={styles.playAgainText}>Read Again</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.replace(params.mockId ? '/mock' : '/(home)')} style={styles.homeBtn}>
              <Text style={styles.homeBtnText}>{params.mockId ? 'Back' : 'Home'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!currentQuestion || !currentPassage) {
    return (
      <SafeAreaView style={styles.safe}>
        <DrillLoadingState
          mode="reading"
          title="Preparing reading round"
          subtitle="Keeping the passage, questions, and answer logic aligned."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {drillCompact && <Text style={[styles.bgGlyph, isTight && styles.bgGlyphTight]}>読</Text>}
      {latestAnswer?.isCorrect && (
        <Animated.View
          pointerEvents="none"
          style={[styles.flash, { backgroundColor: Colors.success, opacity: flashOpacity }]}
        />
      )}
      {latestAnswer?.isCorrect && phase === 'feedback' && latestAnswer.xpEarned > 0 && (
        <XpBurst xp={latestAnswer.xpEarned} opacity={xpOpacity} translateY={xpTranslateY} scale={xpScale} />
      )}
      <View style={styles.container}>
        <DrillHeader
          current={currentQuestionNumber}
          total={totalQuestionCount}
          streak={streak}
          xp={totalXP}
          saved={isSaved}
          onQuit={exitSession}
          onSave={handleSave}
          accent={DrillAccents.reading}
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
              <View style={[styles.contextBadge, drillCompact && styles.contextBadgeCompact]}>
                <Text style={[styles.contextText, isTight && styles.contextTextTight]}>{currentPassage.context}</Text>
              </View>

              <Animated.View
                style={[
                  styles.passageCard,
                  drillCompact && styles.passageCardCompact,
                  isTight && styles.passageCardTight,
                  { transform: [{ scale: cardScale }, { translateX: shakeX }] },
                ]}
              >
                <View style={[styles.passageHeader, drillCompact && styles.passageHeaderCompact]}>
                  <View style={[styles.passageIcon, drillCompact && styles.passageIconCompact, isTight && styles.passageIconTight, { backgroundColor: tint(DrillAccents.reading) }]}>
                    <FileTextIcon size={isTight ? 15 : 18} color={DrillAccents.reading} strokeWidth={1.9} />
                  </View>
                  <View style={styles.passageCopy}>
                    {!drillCompact && <Text style={styles.passageEyebrow}>AP Reading</Text>}
                    <Text style={[styles.passageTitle, drillCompact && styles.passageTitleCompact, isTight && styles.passageTitleTight]}>
                      {currentPassage.title}
                    </Text>
                  </View>
                  <View style={[styles.pacingPill, drillCompact && styles.pacingPillCompact]}>
                    <Text style={[styles.pacingText, drillCompact && styles.pacingTextCompact]}>{phase === 'answering' ? formatCountdown(secondsLeft) : 'Review'}</Text>
                  </View>
                </View>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={currentPassage.passage.length > 80}
                  style={[styles.passageBody, drillCompact && styles.passageBodyCompact, { maxHeight: passageBodyMaxHeight }]}
                  contentContainerStyle={[styles.passageBodyContent, drillCompact && styles.passageBodyContentCompact]}
                >
                  {langCode === 'ja' ? (
                    <FuriganaText
                      text={currentPassage.passage}
                      mode={phase === 'feedback' ? 'full' : 'ap-support'}
                      compact={drillCompact}
                      textScale={readingTextScale}
                      highlightText={highlightedEvidenceText}
                      highlightStyle={styles.passageEvidenceHighlight}
                    />
                  ) : (
                    <Text style={[styles.passageText, { fontSize: (isTight ? 22 : 32) * readingTextScale, lineHeight: (isTight ? 32 : 54) * readingTextScale }]}>
                      {currentPassage.passage}
                    </Text>
                  )}
                </ScrollView>
              </Animated.View>

              <View style={[styles.questionMeta, drillCompact && styles.questionMetaCompact]}>
                <Text style={[styles.questionCount, drillCompact && styles.questionCountCompact, isTight && styles.questionCountTight]}>
                  {isTight ? `Q${currentQuestionNumber}/${totalQuestionCount}` : `Question ${currentQuestionIndex + 1} of ${currentPassage.questions.length} for this passage`}
                </Text>
                {!drillCompact && <Text style={styles.questionCountMuted}>Take your time and read for meaning.</Text>}
              </View>

              <Text style={[styles.question, drillCompact && styles.questionCompact, isTight && styles.questionTight]}>{currentQuestion.question}</Text>

              <View style={[styles.choices, drillCompact && styles.choicesCompact, isTight && styles.choicesTight]}>
                {currentQuestion.choices.map((choice, idx) => {
                  let choiceState: 'idle' | 'selected-correct' | 'selected-wrong' | 'reveal-correct' = 'idle';
                  if (phase === 'feedback') {
                    if (idx === currentQuestion.correctIndex) {
                      choiceState = 'reveal-correct';
                    } else if (idx === selectedIndex) {
                      choiceState = 'selected-wrong';
                    }
                    if (idx === selectedIndex && idx === currentQuestion.correctIndex) {
                      choiceState = 'selected-correct';
                    }
                  }

                  return (
                    <AnswerChoice
                      key={idx}
                      label={choice}
                      index={idx}
                      choiceState={choiceState}
                      disabled={phase === 'feedback'}
                      onPress={() => submitAnswer(idx)}
                      compact={drillCompact}
                      mobile={isCompact}
                      accent={DrillAccents.reading}
                    />
                  );
                })}
              </View>

              {phase === 'feedback' && (
                <View
                  style={[
                    styles.feedbackBanner,
                    {
                      backgroundColor:
                        selectedIndex === currentQuestion.correctIndex ? Colors.successDim : Colors.errorDim,
                      borderColor:
                        selectedIndex === currentQuestion.correctIndex ? Colors.success : Colors.error,
                    },
                  ]}
                >
                  <View style={styles.feedbackIcon}>
                    {selectedIndex === currentQuestion.correctIndex ? (
                      <CheckIcon size={20} color={Colors.success} />
                    ) : (
                      <XIcon size={20} color={Colors.error} />
                    )}
                  </View>
                  <View style={styles.feedbackBody}>
                    <Text
                      style={[
                        styles.feedbackResult,
                        { color: selectedIndex === currentQuestion.correctIndex ? Colors.success : Colors.error },
                      ]}
                    >
                      {selectedIndex === currentQuestion.correctIndex ? 'Correct!' : selectedIndex === null ? "Time's up" : 'Not quite'}
                    </Text>

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

              {phase === 'feedback' && isLastQuestionForPassage && (
                <View style={styles.translationReveal}>
                  <Text style={styles.translationLabel}>Passage meaning:</Text>
                  <Text style={styles.translationText}>{currentPassage.translation}</Text>
                </View>
              )}

              {phase === 'feedback' && drillCompact && (
                <View style={[styles.feedbackActions, styles.feedbackActionsCompact]}>
                  <Pressable
                    onPress={handleSave}
                    style={({ hovered, pressed }) => [
                      styles.feedbackSaveBtn,
                      isSaved && styles.feedbackSaveBtnDone,
                      hovered && styles.feedbackSaveBtnHover,
                      pressed && styles.feedbackActionBtnPress,
                    ]}
                  >
                    {isSaved
                      ? <CheckIcon size={17} color={Colors.success} />
                      : <BookmarkIcon size={17} color={Colors.textSub} />}
                    <Text style={[styles.feedbackSaveText, isSaved && styles.feedbackSaveTextDone]}>
                      {isSaved ? 'Saved' : 'Save to Library'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={advanceAfterFeedback}
                    style={({ hovered, pressed }) => [
                      styles.feedbackNextBtn,
                      hovered && styles.feedbackNextBtnHover,
                      pressed && styles.feedbackActionBtnPress,
                    ]}
                  >
                    <Text style={styles.feedbackNextText}>
                      {currentQuestionIndex + 1 < currentPassage.questions.length
                        ? 'Next Question'
                        : currentPassageIndex + 1 >= passages.length
                          ? 'Finish'
                          : 'Next Passage'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {!isTight && <View style={[styles.stageSide, isCompact && styles.stageSideCompact]}>
              <Text style={styles.sideLabel}>Reading round</Text>
              <Text style={styles.sideTitle}>Question {currentQuestionNumber} of {totalQuestionCount}</Text>
              <View style={styles.sideStatRow}>
                <View style={styles.sideStat}>
                  <Text style={styles.sideStatValue}>{totalXP}</Text>
                  <Text style={styles.sideStatLabel}>XP</Text>
                </View>
                <View style={styles.sideStat}>
                  <Text style={styles.sideStatValue}>{streak}</Text>
                  <Text style={styles.sideStatLabel}>Streak</Text>
                </View>
              </View>
              <View style={styles.sideTimerCard}>
                <Text style={styles.sideTimerLabel}>{phase === 'answering' ? 'Time left' : 'Ready'}</Text>
                <Text style={styles.sideTimerText}>{phase === 'answering' ? formatCountdown(secondsLeft) : 'Review'}</Text>
              </View>
              {!isCompact && (
                <Text style={styles.sideHint}>Read the passage, then choose the answer with the strongest evidence.</Text>
              )}
              <TouchableOpacity
                onPress={phase === 'feedback' ? advanceAfterFeedback : undefined}
                disabled={phase !== 'feedback'}
                activeOpacity={0.86}
                style={[styles.sidePrimaryBtn, phase !== 'feedback' && styles.sidePrimaryBtnDisabled]}
              >
                <Text style={[styles.sidePrimaryText, phase !== 'feedback' && styles.sidePrimaryTextDisabled]}>
                  {phase === 'feedback'
                    ? currentQuestionIndex + 1 < currentPassage.questions.length
                      ? 'Next question'
                      : currentPassageIndex + 1 >= passages.length
                        ? 'Finish'
                        : 'Next passage'
                    : 'Choose an answer'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.82}
                style={[styles.feedbackSaveBtn, styles.sideSaveBtn, isSaved && styles.feedbackSaveBtnDone]}
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
    top: 40,
    fontSize: 470,
    color: Colors.bgGlyph,
    fontFamily: undefined,
  },
  bgGlyphTight: {
    right: -58,
    top: 32,
    fontSize: 360,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textSub, fontSize: 16 },
  scroll: { paddingHorizontal: 32, paddingTop: 30, gap: 18, paddingBottom: 120, maxWidth: 1220, width: '100%', alignSelf: 'center' },
  scrollCompact: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
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
    paddingTop: 6,
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
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  contextBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  contextBadgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  contextText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  contextTextTight: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.5,
  },
  passageCard: {
    backgroundColor: '#F4F7F9',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5EAF1',
    padding: 22,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  passageCardCompact: {
    padding: 16,
    gap: 12,
    borderRadius: 26,
    backgroundColor: '#FFFFFFF0',
    borderColor: '#D9E2EC',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  passageCardTight: {
    padding: 14,
    gap: 10,
    borderRadius: 23,
  },
  passageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passageHeaderCompact: {
    gap: 9,
  },
  passageIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passageIconCompact: {
    width: 42,
    height: 42,
    borderRadius: 15,
  },
  passageIconTight: {
    width: 38,
    height: 38,
    borderRadius: 14,
  },
  passageCopy: { flex: 1, minWidth: 0, gap: 3 },
  pacingPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DrillAccents.reading,
    backgroundColor: tint(DrillAccents.reading),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pacingPillCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pacingText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  pacingTextCompact: {
    fontSize: 13,
  },
  passageEyebrow: {
    color: DrillAccents.reading,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  passageTitle: {
    color: '#101820',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  passageTitleCompact: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: undefined,
    fontStyle: 'normal',
    fontWeight: '900',
  },
  passageTitleTight: {
    fontSize: 16,
    lineHeight: 19,
  },
  passageText: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 38,
    fontWeight: '800',
  },
  passageBody: {
    alignSelf: 'stretch',
  },
  passageBodyCompact: {
    marginHorizontal: -2,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passageBodyContent: {
    paddingRight: 4,
    paddingBottom: 2,
  },
  passageBodyContentCompact: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passageEvidenceHighlight: {
    backgroundColor: '#CFF5ED',
  },
  questionMeta: {
    gap: 4,
  },
  questionMetaCompact: {
    gap: 2,
    marginTop: 2,
  },
  questionCount: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  questionCountCompact: {
    fontSize: 11,
    letterSpacing: 2.2,
  },
  questionCountTight: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.7,
  },
  questionCountMuted: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  question: {
    color: '#101820',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
  },
  questionCompact: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: undefined,
    fontWeight: '900',
  },
  questionTight: {
    fontSize: 22,
    lineHeight: 27,
  },
  choices: { gap: 10 },
  choicesCompact: { gap: 8 },
  choicesTight: { gap: 7 },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  feedbackIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  feedbackBody: { flex: 1, gap: 2 },
  feedbackEvidenceStack: {
    gap: 8,
  },
  feedbackResult: {
    fontSize: 16,
    fontWeight: '900',
  },
  feedbackCorrect: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  feedbackEvidenceCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 7,
  },
  feedbackEvidenceLabel: {
    color: DrillAccents.reading,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  feedbackEvidenceText: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '800',
  },
  feedbackKeyword: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  feedbackExplanation: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
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
  translationReveal: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
  },
  translationLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  translationText: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
    fontWeight: '700',
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  feedbackActionsCompact: {
    flexDirection: 'column',
  },
  feedbackSaveBtn: {
    flex: 1,
    minHeight: 66,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  feedbackSaveBtnDone: {
    borderColor: Colors.success,
    backgroundColor: Colors.successDim,
  },
  feedbackSaveBtnHover: {
    borderColor: Colors.teal,
    backgroundColor: '#F7FFFD',
    transform: [{ translateY: -2 }],
  },
  feedbackSaveText: {
    color: Colors.textSub,
    fontSize: 15,
    fontWeight: '800',
  },
  feedbackSaveTextDone: { color: Colors.success },
  feedbackNextBtn: {
    flex: 1,
    minHeight: 66,
    borderRadius: 28,
    backgroundColor: DrillAccents.reading,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  feedbackNextBtnHover: {
    backgroundColor: '#26B990',
    transform: [{ translateY: -2 }],
  },
  feedbackActionBtnPress: {
    transform: [{ translateY: 1 }, { scale: 0.99 }],
  },
  feedbackNextText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  sideLabel: {
    color: DrillAccents.reading,
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
  sideTimerCard: {
    minHeight: 74,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: DrillAccents.reading,
    backgroundColor: tint(DrillAccents.reading),
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sideTimerLabel: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sideTimerText: {
    color: '#101820',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  sideHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  sidePrimaryBtn: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: DrillAccents.reading,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 5,
    borderBottomColor: '#1D6847',
    shadowColor: DrillAccents.reading,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  sidePrimaryBtnDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    borderBottomWidth: 0,
    shadowOpacity: 0,
  },
  sidePrimaryText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  sidePrimaryTextDisabled: {
    color: Colors.textMuted,
  },
  sideSaveBtn: {
    flex: 0,
    minHeight: 50,
    borderRadius: 16,
  },
  completeScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 190,
    gap: 18,
  },
  completeIcon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  completeStats: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  completeStat: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 88,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 12,
  },
  completeStatValue: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  completeStatLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  completeValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completeActions: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    gap: 12,
  },
  completeActionsCompact: {
    flexDirection: 'column',
  },
  playAgainBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: Colors.borderBright,
    borderBottomColor: Colors.borderBright,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: Colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  playAgainText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  homeBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: DrillAccents.reading,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: 5,
    borderBottomColor: '#1D6847',
    shadowColor: DrillAccents.reading,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  homeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});
