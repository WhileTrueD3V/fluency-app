import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Animated,
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  Modal,
  TextInput,
  type GestureResponderEvent,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/colors';
import { getLanguage, type LanguageCode } from '@/constants/languages';
import {
  getSavedItems,
  getAttemptMemory,
  getSessionHistory,
  removeSavedItemById,
  removeSavedItemsByIds,
  saveItem,
  type AttemptMemory,
  type SavedItem,
  type SavedItemType,
  type SessionRecord,
} from '@/utils/storage';
import { getListeningQuestionById, getReadingSetById, getSpeakingPromptById } from '@/data';
import { useAppStorage } from '@/hooks/useAppStorage';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { MainTabHeader, MobileTabHeader } from '@/components/MainTabHeader';
import { APP_COMPACT_BREAKPOINT, DesktopSideRail, getDesktopContentInsets } from '@/components/AppFooterTabs';
import { KanjiBackdrop } from '@/components/KanjiBackdrop';
import {
  BookOpenIcon,
  CheckIcon,
  FileTextIcon,
  HeadphonesIcon,
  MessageCircleIcon,
  MicrophoneIcon,
  PlayIcon,
  StarIcon,
  StopIcon,
  WaveformIcon,
  XIcon,
} from '@/components/Icons';

const FILTERS: Array<{ type: SavedItemType | 'all'; label: string }> = [
  { type: 'all', label: 'All' },
  { type: 'listening', label: 'Listening' },
  { type: 'speaking', label: 'Speaking' },
  { type: 'conversation', label: 'Conversation' },
  { type: 'reading', label: 'Reading' },
  { type: 'texting', label: 'Text Chat' },
];

const AP_REVIEW_PREFIX = 'AP_REVIEW_JSON:';
const AP_PROMPT_SET_PREFIX = 'AP_PROMPT_SET_JSON:';
const LIBRARY_ACCENT = Colors.teal;
const SESSION_ATTEMPT_WINDOW_MS = 8 * 60 * 1000;
type LibraryTab = 'recent' | 'saved' | 'review';

type SavedAPReview = {
  score: number;
  label: string;
  summary: string;
  improvements: string[];
  weakSkills: string[];
  turns: Array<{
    index?: number;
    prompt: string;
    score?: number;
    answer: string;
    modelAnswer: string;
    recordingUri?: string | null;
    reason: string;
    improvements: string[];
    weakSkills?: string[];
  }>;
};

type SavedAPPromptSet = {
  mode: 'conversation' | 'texting';
  title: string;
  situation: string;
  prompts: Array<{
    index?: number;
    prompt: string;
    answer?: string;
    modelAnswer?: string;
  }>;
};

function parseReviewAnswer(item: SavedItem) {
  const audioMatch = item.answer.match(/^Audio:\s*([\s\S]*?)\nAnswer:\s*([\s\S]*)$/);
  if (!audioMatch) return { audio: null, answer: item.answer };
  return {
    audio: audioMatch[1].trim(),
    answer: audioMatch[2].trim(),
  };
}

function parseSavedAPReview(answer: string): SavedAPReview | null {
  if (!answer.startsWith(AP_REVIEW_PREFIX)) return null;
  try {
    const parsed = JSON.parse(answer.slice(AP_REVIEW_PREFIX.length)) as SavedAPReview;
    if (!parsed || !Array.isArray(parsed.turns)) return null;
    return {
      score: Number(parsed.score) || 1,
      label: parsed.label || 'Saved result',
      summary: parsed.summary || '',
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      weakSkills: Array.isArray(parsed.weakSkills) ? parsed.weakSkills : [],
      turns: parsed.turns.map((turn, index) => ({
        index: turn.index ?? index + 1,
        prompt: turn.prompt || `Turn ${index + 1}`,
        score: typeof turn.score === 'number' ? turn.score : undefined,
        answer: turn.answer || 'No response captured',
        modelAnswer: turn.modelAnswer || '',
        recordingUri: turn.recordingUri ?? null,
        reason: turn.reason || '',
        improvements: Array.isArray(turn.improvements) ? turn.improvements : [],
        weakSkills: Array.isArray(turn.weakSkills) ? turn.weakSkills : [],
      })),
    };
  } catch {
    return null;
  }
}

function parseSavedAPPromptSet(answer: string): SavedAPPromptSet | null {
  if (!answer.startsWith(AP_PROMPT_SET_PREFIX)) return null;
  try {
    const parsed = JSON.parse(answer.slice(AP_PROMPT_SET_PREFIX.length)) as SavedAPPromptSet;
    if (!parsed || !Array.isArray(parsed.prompts)) return null;
    const mode = parsed.mode === 'texting' ? 'texting' : 'conversation';
    return {
      mode,
      title: parsed.title || (mode === 'conversation' ? 'Saved conversation set' : 'Saved text-chat set'),
      situation: parsed.situation || '',
      prompts: parsed.prompts.map((prompt, index) => ({
        index: prompt.index ?? index + 1,
        prompt: prompt.prompt || `Turn ${index + 1}`,
        answer: prompt.answer || '',
        modelAnswer: prompt.modelAnswer || '',
      })),
    };
  } catch {
    return null;
  }
}

function getReviewSource(item: SavedItem) {
  const langCode = item.languageCode as LanguageCode;
  const parsed = parseReviewAnswer(item);
  const apReview = parseSavedAPReview(parsed.answer);
  const apPromptSet = parseSavedAPPromptSet(parsed.answer);

  if (item.type === 'listening') {
    const question = getListeningQuestionById(langCode, item.promptId);
    const audio = parsed.audio ?? question?.transcript ?? null;
    return {
      sourceLabel: 'Audio prompt',
      sourceText: question?.context ?? 'Listen to the prompt, then answer from memory.',
      audio,
      answer: parsed.answer,
      resultOnly: false,
      apReview: null,
      apPromptSet: null,
    };
  }

  if (item.type === 'reading') {
    const set = getReadingSetById(langCode, item.promptId);
    return {
      sourceLabel: 'Reading passage',
      sourceText: set?.passage ?? item.question,
      audio: null,
      answer: parsed.answer,
      resultOnly: false,
      apReview: null,
      apPromptSet: null,
    };
  }

  if (item.type === 'speaking') {
    const prompt = getSpeakingPromptById(langCode, item.promptId);
    return {
      sourceLabel: 'Speaking prompt',
      sourceText: prompt ? `Translate: ${prompt.english}` : item.question,
      audio: null,
      answer: parsed.answer,
      resultOnly: false,
      apReview: null,
      apPromptSet: null,
    };
  }

  if (item.type === 'conversation' || item.type === 'texting') {
    return {
      sourceLabel: apPromptSet
        ? item.type === 'conversation' ? 'Saved conversation prompt' : 'Saved text-chat prompt'
        : item.type === 'conversation' ? 'Saved conversation result' : 'Saved text-chat result',
      sourceText: apReview ? apReview.summary : apPromptSet ? apPromptSet.situation : parsed.answer,
      audio: null,
      answer: parsed.answer,
      resultOnly: true,
      apReview,
      apPromptSet,
    };
  }

  return {
    sourceLabel: 'Review prompt',
    sourceText: item.question,
    audio: null,
    answer: parsed.answer,
    resultOnly: false,
    apReview: null,
    apPromptSet: null,
  };
}

function getTypeLabel(type: SavedItemType) {
  return {
    listening: 'Listening',
    speaking: 'Speaking',
    reading: 'Reading',
    conversation: 'Conversation',
    texting: 'Text chat',
  }[type];
}

function getTypeAccent(type: SavedItemType) {
  return {
    listening: Colors.teal,
    speaking: Colors.primary,
    reading: Colors.teal,
    conversation: Colors.primary,
    texting: Colors.ink,
  }[type];
}

function typeIconFor(type: SavedItemType, size: number, color: string) {
  return {
    listening: <HeadphonesIcon size={size} color={color} strokeWidth={1.9} />,
    speaking: <MicrophoneIcon size={size} color={color} strokeWidth={1.9} />,
    reading: <FileTextIcon size={size} color={color} strokeWidth={1.9} />,
    conversation: <WaveformIcon size={size} color={color} strokeWidth={2} />,
    texting: <MessageCircleIcon size={size} color={color} strokeWidth={1.9} />,
  }[type];
}

function formatCompletedDate(date: number) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(date));
  } catch {
    return 'Recent';
  }
}

function getSessionTitle(session: SessionRecord) {
  const label = getTypeLabel(session.type);
  return session.mockId ? `Mini Mock ${label}` : `${label} practice`;
}

function getSessionDetail(session: SessionRecord) {
  return session.mockId
    ? 'Completed as part of your AP readiness check.'
    : 'Completed from your generated AP work.';
}

function getAttemptsForSession(session: SessionRecord, attemptMemory: AttemptMemory[]) {
  return attemptMemory
    .filter((attempt) => (
      attempt.languageCode === session.languageCode
      && attempt.type === session.type
      && Math.abs(attempt.date - session.date) <= SESSION_ATTEMPT_WINDOW_MS
    ))
    .sort((a, b) => a.date - b.date);
}

function commonPromptSetId(attempts: AttemptMemory[], fallback: string) {
  const ids = attempts
    .map((attempt) => attempt.promptId.split(':')[0])
    .filter(Boolean);
  const unique = Array.from(new Set(ids));
  return unique.length === 1 ? unique[0] : fallback;
}

function extractAudioFromContext(context?: string) {
  const audio = context?.match(/Audio:\s*([\s\S]*)$/i)?.[1]?.trim();
  return audio || null;
}

function apScoreFromSession(session: SessionRecord) {
  if (session.type === 'conversation' || session.type === 'texting') {
    return Math.max(1, Math.min(5, Math.round(session.score / 20)));
  }
  return session.score >= 90 ? 5 : session.score >= 75 ? 4 : session.score >= 55 ? 3 : session.score >= 35 ? 2 : 1;
}

function savedItemsFromSession(
  session: SessionRecord,
  attempts: AttemptMemory[],
): Array<Omit<SavedItem, 'savedAt'>> {
  if ((session.type === 'conversation' || session.type === 'texting') && session.apReview) {
    const promptId = session.apReview.promptId ?? (session.apReview.turns
      .map((turn) => turn.prompt)
      .filter(Boolean)
      .join('|')
      .slice(0, 80) || `recent-${session.id}`);
    return [{
      id: `recent-${session.type}-${session.id}`,
      type: session.type,
      languageCode: session.languageCode,
      promptId,
      question: session.apReview.title && session.apReview.situation
        ? `${session.apReview.title}: ${session.apReview.situation}`
        : session.apReview.summary || getSessionTitle(session),
      answer: `${AP_REVIEW_PREFIX}${JSON.stringify(session.apReview)}`,
    }];
  }

  if ((session.type === 'conversation' || session.type === 'texting') && attempts.length > 0) {
    const promptId = commonPromptSetId(attempts, `recent-${session.id}`);
    const weakSkills = Array.from(new Set(attempts.flatMap((attempt) => attempt.weakSkills ?? []))).slice(0, 6);
    const score = apScoreFromSession(session);
    const review: SavedAPReview = {
      score,
      label: score >= 4 ? 'Strong saved result' : score >= 3 ? 'Building saved result' : 'Needs review',
      summary: attempts[0]?.context ?? `${getSessionTitle(session)} · ${session.score}%`,
      improvements: weakSkills.length > 0 ? weakSkills : ['Review the saved turns and compare them with model answers.'],
      weakSkills,
      turns: attempts.map((attempt, index) => ({
        index: index + 1,
        prompt: attempt.question,
        score: Math.max(1, Math.min(5, Math.round(attempt.score / 20))),
        answer: attempt.userAnswer || 'No answer captured',
        modelAnswer: attempt.expectedAnswer || '',
        reason: attempt.correct ? 'This turn met the expected answer logic.' : 'Review the model answer and repair the weak skill noted below.',
        improvements: attempt.weakSkills ?? [],
        weakSkills: attempt.weakSkills,
      })),
    };
    return [{
      id: `recent-${session.type}-${promptId}-${session.id}`,
      type: session.type,
      languageCode: session.languageCode,
      promptId,
      question: attempts[0]?.context ?? getSessionTitle(session),
      answer: `${AP_REVIEW_PREFIX}${JSON.stringify(review)}`,
    }];
  }

  if (attempts.length > 0) {
    return attempts.map((attempt, index) => {
      const base = {
        id: `recent-${attempt.type}-${attempt.promptId}-${session.id}-${index}`,
        type: attempt.type,
        languageCode: attempt.languageCode,
        promptId: attempt.promptId,
        question: attempt.question || getSessionTitle(session),
      } as const;

      if (attempt.type === 'listening') {
        const audio = extractAudioFromContext(attempt.context);
        return {
          ...base,
          answer: audio
            ? `Audio: ${audio}\nAnswer: ${attempt.expectedAnswer}`
            : `Answer: ${attempt.expectedAnswer}`,
        };
      }

      if (attempt.type === 'reading') {
        return {
          ...base,
          question: attempt.context || attempt.question || getSessionTitle(session),
          answer: [
            `Question: ${attempt.question}`,
            `Your answer: ${attempt.userAnswer || 'No answer captured'}`,
            `Correct answer: ${attempt.expectedAnswer || 'Review the passage evidence.'}`,
          ].join('\n'),
        };
      }

      if (attempt.type === 'speaking') {
        return {
          ...base,
          answer: attempt.expectedAnswer || attempt.userAnswer || 'No model answer captured',
        };
      }

      return {
        ...base,
        answer: attempt.expectedAnswer || attempt.userAnswer || getSessionDetail(session),
      };
    });
  }

  return [{
    id: `recent-${session.type}-${session.id}`,
    type: session.type,
    languageCode: session.languageCode,
    promptId: `recent-${session.id}`,
    question: getSessionTitle(session),
    answer: `${getSessionDetail(session)}\nScore: ${session.score}%\nXP: ${session.xpEarned}`,
  }];
}

function savedCandidateStatus(candidates: Array<Omit<SavedItem, 'savedAt'>>, items: SavedItem[]) {
  const savedKeys = new Set(items.map((item) => `${item.type}:${item.promptId}`));
  return candidates.filter((item) => savedKeys.has(`${item.type}:${item.promptId}`)).length;
}

function savedCandidateKey(candidate: Pick<SavedItem, 'type' | 'promptId'>) {
  return `${candidate.type}:${candidate.promptId}`;
}

function findSavedCandidate(candidate: Pick<SavedItem, 'type' | 'promptId'>, items: SavedItem[]) {
  const key = savedCandidateKey(candidate);
  return items.find((item) => savedCandidateKey(item) === key) ?? null;
}

function CompletedCard({
  session,
  compact,
  savedCount,
  itemCount,
  onPress,
}: {
  session: SessionRecord;
  compact?: boolean;
  savedCount: number;
  itemCount: number;
  onPress: () => void;
}) {
  const accent = getTypeAccent(session.type);
  const label = getTypeLabel(session.type);
  const title = getSessionTitle(session);
  const detail = getSessionDetail(session);
  const allSaved = itemCount > 0 && savedCount >= itemCount;
  const cardLift = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = hovered || pressed;

  useEffect(() => {
    Animated.spring(cardLift, {
      toValue: active ? 1 : 0,
      tension: 190,
      friction: 16,
      useNativeDriver: true,
    }).start();
  }, [active, cardLift]);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => {
        setHovered(false);
        setPressed(false);
      }}
      onFocus={() => setHovered(true)}
      onBlur={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`Open recent ${label} completion`}
    >
      <Animated.View
        style={[
          styles.completedCard,
          compact && styles.completedCardCompact,
          active && styles.completedCardHover,
          {
            borderColor: active ? `${accent}88` : Colors.borderBright,
            transform: [
              { translateY: cardLift.interpolate({ inputRange: [0, 1], outputRange: [0, pressed ? 1 : -3] }) },
              { scale: cardLift.interpolate({ inputRange: [0, 1], outputRange: [1, pressed ? 0.996 : 1.006] }) },
            ],
          },
        ]}
      >
        <View style={[styles.completedTopRow, compact && styles.completedTopRowCompact]}>
          <View style={[styles.completedGlyph, compact && styles.completedGlyphCompact, { backgroundColor: `${accent}12`, borderColor: `${accent}35` }]}>
            {typeIconFor(session.type, compact ? 21 : 23, accent)}
          </View>
          <View style={[styles.completedSavedPill, compact && styles.completedSavedPillCompact, allSaved && styles.completedSavedPillActive]}>
            <Text style={[styles.completedSavedText, compact && styles.completedSavedTextCompact, allSaved && styles.completedSavedTextActive]}>
              {allSaved ? 'Saved' : `${savedCount}/${itemCount} saved`}
            </Text>
          </View>
        </View>
        <View style={styles.completedCopy}>
          <View style={styles.completedMetaRow}>
            <Text style={[styles.completedType, { color: accent }]}>{label}</Text>
            <Text style={styles.completedDate}>{formatCompletedDate(session.date)}</Text>
          </View>
          <Text style={[styles.completedTitle, compact && styles.completedTitleCompact]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.completedDetail, compact && styles.completedDetailCompact]} numberOfLines={compact ? 1 : 2}>{detail}</Text>
        </View>
        <View style={[styles.completedFooter, compact && styles.completedFooterCompact]}>
          <View>
            <Text style={[styles.completedFooterLabel, compact && styles.completedFooterLabelCompact]}>Reviewable</Text>
            <Text style={[styles.completedFooterValue, compact && styles.completedFooterValueCompact]}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
          </View>
          <View style={[styles.completedScoreBox, compact && styles.completedScoreBoxCompact]}>
            <Text style={[styles.completedScore, compact && styles.completedScoreCompact]}>{session.score}%</Text>
            <Text style={[styles.completedXp, compact && styles.completedXpCompact]}>{session.xpEarned} XP</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function SavedCard({
  item,
  onPress,
  onRequestRemove,
  selecting,
  selected,
  onSelect,
  showRemove = true,
  compact,
}: {
  item: SavedItem;
  onPress: () => void;
  onRequestRemove: () => void;
  selecting: boolean;
  selected: boolean;
  onSelect: () => void;
  showRemove?: boolean;
  compact?: boolean;
}) {
  const accent = LIBRARY_ACCENT;
  const typeLabel = {
    listening: 'Listening',
    speaking: 'Speaking',
    reading: 'Reading',
    conversation: 'Conversation',
    texting: 'Texting',
  }[item.type];
  const isAPReview = item.type === 'conversation' || item.type === 'texting';
  const structuredReview = parseSavedAPReview(item.answer);
  const structuredPromptSet = parseSavedAPPromptSet(item.answer);
  const scoreMatch = structuredReview ? [`AP ${structuredReview.score}/5`, String(structuredReview.score)] : item.answer.match(/AP\s+(\d)\/5/);
  const reviewDisplayAnswer = parseReviewAnswer(item).answer;
  const reviewTitle = structuredReview || structuredPromptSet ? item.question.split(':')[0].trim() || item.question : item.question;
  const reviewSummary = structuredReview
    ? `${structuredReview.label} · ${structuredReview.turns.length} saved ${structuredReview.turns.length === 1 ? 'turn' : 'turns'}`
    : structuredPromptSet
      ? `${structuredPromptSet.prompts.length} saved ${structuredPromptSet.prompts.length === 1 ? 'prompt' : 'prompts'} · review pending`
    : scoreMatch
      ? reviewDisplayAnswer.replace(/^AP\s+\d\/5\s+-\s*/, '')
      : reviewDisplayAnswer;
  const typeIcon = {
    listening: <HeadphonesIcon size={compact ? 30 : 24} color={accent} strokeWidth={1.9} />,
    speaking: <MicrophoneIcon size={compact ? 30 : 24} color={accent} strokeWidth={1.9} />,
    reading: <FileTextIcon size={compact ? 30 : 24} color={accent} strokeWidth={1.9} />,
    conversation: <WaveformIcon size={compact ? 30 : 24} color={accent} strokeWidth={2} />,
    texting: <MessageCircleIcon size={compact ? 30 : 24} color={accent} strokeWidth={1.9} />,
  }[item.type];
  const removeScale = useRef(new Animated.Value(1)).current;
  const removeRotate = useRef(new Animated.Value(0)).current;
  const cardLift = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = hovered || pressed;

  useEffect(() => {
    Animated.spring(cardLift, {
      toValue: active ? 1 : 0,
      tension: 190,
      friction: 16,
      useNativeDriver: true,
    }).start();
  }, [active, cardLift]);

  const confirmRemove = (event?: GestureResponderEvent) => {
    event?.stopPropagation?.();
    haptics.impact('heavy');
    onRequestRemove();
    removeScale.stopAnimation();
    removeRotate.stopAnimation();
    removeScale.setValue(1);
    removeRotate.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(removeScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
        Animated.spring(removeScale, { toValue: 1.08, friction: 5, tension: 170, useNativeDriver: true }),
        Animated.spring(removeScale, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(removeRotate, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.spring(removeRotate, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const removeRotation = removeRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-10deg'],
  });

  return (
    <Pressable
      onPress={selecting ? onSelect : onPress}
      onLongPress={selecting ? undefined : confirmRemove}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => {
        setHovered(false);
        setPressed(false);
      }}
      onFocus={() => setHovered(true)}
      onBlur={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`Open saved ${typeLabel}`}
    >
      <Animated.View
        style={[
          styles.card,
          compact && styles.cardCompact,
          active && styles.cardHover,
          pressed && styles.cardPress,
          selected && styles.cardSelected,
          {
            transform: [
              { translateY: cardLift.interpolate({ inputRange: [0, 1], outputRange: [0, pressed ? 1 : -3] }) },
              { scale: cardLift.interpolate({ inputRange: [0, 1], outputRange: [1, pressed ? 0.996 : 1.006] }) },
            ],
          },
        ]}
      >
        {selecting && (
          <View style={[styles.selectDot, selected && styles.selectDotActive]}>
            {selected && <CheckIcon size={14} color={Colors.onPrimary} strokeWidth={3} />}
          </View>
        )}
        <View style={[styles.savedGlyph, compact && styles.savedGlyphCompact, active && styles.savedGlyphHover]}>
          {typeIcon}
        </View>
        <View style={styles.savedCopy}>
          <View style={styles.tagRow}>
            <Text style={styles.typeTag}>
              {isAPReview ? 'AP review' : typeLabel}
            </Text>
            {scoreMatch && !isAPReview && <Text style={[styles.apReviewTag, { color: accent, borderColor: accent }]}>AP {scoreMatch[1]}/5</Text>}
          </View>
          <Text
            numberOfLines={structuredReview || structuredPromptSet ? 1 : compact ? 2 : undefined}
            style={[styles.question, compact && styles.questionCompact, (structuredReview || structuredPromptSet) && styles.questionReviewPreview]}
          >
            {reviewTitle}
          </Text>
        </View>
        <View style={styles.savedAnswerColumn}>
          <Text
            numberOfLines={structuredReview || structuredPromptSet || compact ? 1 : undefined}
            style={[styles.answer, (structuredReview || structuredPromptSet) && styles.answerReviewPreview]}
          >
            {reviewSummary}
          </Text>
        </View>
        {showRemove && (
          <Pressable
            onPress={confirmRemove}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityRole="button"
            accessibilityLabel="Remove saved item"
            style={styles.removeBtn}
          >
            <Animated.View
              style={[
                styles.removeStar,
                { transform: [{ scale: removeScale }, { rotate: removeRotation }] },
              ]}
            >
              <StarIcon size={34} color={accent} strokeWidth={1.9} />
            </Animated.View>
          </Pressable>
        )}
      </Animated.View>
    </Pressable>
  );
}

function APReviewReport({ review, kind }: { review: SavedAPReview; kind: SavedItemType }) {
  return (
    <ScrollView
      style={styles.reviewResultScroll}
      contentContainerStyle={styles.reviewResultContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.reviewResultHero}>
        <Text style={styles.reviewAnswerLabel}>{kind === 'conversation' ? 'Saved conversation result' : 'Saved text-chat result'}</Text>
        <Text style={styles.reviewResultScore}>AP {review.score}/5</Text>
        <Text style={styles.reviewResultLabel}>{review.label}</Text>
        {review.summary ? <Text style={styles.reviewResultBody}>{review.summary}</Text> : null}
      </View>

      {review.improvements.length > 0 && (
        <View style={styles.reviewResultSection}>
          <Text style={styles.reviewResultSectionTitle}>Things to work on</Text>
          {review.improvements.map((item, index) => (
            <Text key={`improvement-${index}`} style={styles.reviewResultBullet}>- {item}</Text>
          ))}
        </View>
      )}

      {review.weakSkills.length > 0 && (
        <View style={styles.reviewResultSection}>
          <Text style={styles.reviewResultSectionTitle}>Weak skills</Text>
          <Text style={styles.reviewResultBody}>{review.weakSkills.join(' · ')}</Text>
        </View>
      )}

      {review.turns.map((turn, index) => (
        <View key={`${turn.prompt}-${index}`} style={styles.reviewTurnCard}>
          <View style={styles.reviewTurnTop}>
            <Text style={styles.reviewTurnLabel}>Question {turn.index ?? index + 1}</Text>
            {typeof turn.score === 'number' && <Text style={styles.reviewTurnScore}>{turn.score}/5</Text>}
          </View>
          <Text style={styles.reviewTurnPrompt}>{turn.prompt}</Text>
          <Text style={styles.reviewTurnKicker}>Your answer</Text>
          <Text style={styles.reviewResultBody}>{turn.answer}</Text>
          {turn.modelAnswer ? (
            <>
              <Text style={styles.reviewTurnKicker}>Model answer</Text>
              <Text style={styles.reviewResultBody}>{turn.modelAnswer}</Text>
            </>
          ) : null}
          {turn.reason ? (
            <>
              <Text style={styles.reviewTurnKicker}>AP note</Text>
              <Text style={styles.reviewResultBody}>{turn.reason}</Text>
            </>
          ) : null}
          {turn.improvements.length > 0 && (
            <>
              <Text style={styles.reviewTurnKicker}>Work on</Text>
              {turn.improvements.map((item, itemIndex) => (
                <Text key={`turn-${index}-improvement-${itemIndex}`} style={styles.reviewResultBullet}>- {item}</Text>
              ))}
            </>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function APPromptSetReport({ promptSet, kind }: { promptSet: SavedAPPromptSet; kind: SavedItemType }) {
  return (
    <ScrollView
      style={styles.reviewResultScroll}
      contentContainerStyle={styles.reviewResultContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.reviewResultHero}>
        <Text style={styles.reviewAnswerLabel}>{kind === 'conversation' ? 'Saved conversation prompt' : 'Saved text-chat prompt'}</Text>
        <Text style={styles.reviewResultLabel}>{promptSet.title}</Text>
        {promptSet.situation ? <Text style={styles.reviewResultBody}>{promptSet.situation}</Text> : null}
      </View>

      {promptSet.prompts.map((turn, index) => (
        <View key={`${turn.prompt}-${index}`} style={styles.reviewTurnCard}>
          <View style={styles.reviewTurnTop}>
            <Text style={styles.reviewTurnLabel}>Prompt {turn.index ?? index + 1}</Text>
          </View>
          <Text style={styles.reviewTurnPrompt}>{turn.prompt}</Text>
          {turn.answer ? (
            <>
              <Text style={styles.reviewTurnKicker}>Captured answer</Text>
              <Text style={styles.reviewResultBody}>{turn.answer}</Text>
            </>
          ) : null}
          {turn.modelAnswer ? (
            <>
              <Text style={styles.reviewTurnKicker}>Model answer</Text>
              <Text style={styles.reviewResultBody}>{turn.modelAnswer}</Text>
            </>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const compactModalMaxHeight = Math.max(330, height - 92);
  const desktopInsets = getDesktopContentInsets(width, { wideGap: 40, narrowGap: 18, right: 56 });
  const { stats } = useAppStorage();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [attemptMemory, setAttemptMemory] = useState<AttemptMemory[]>([]);
  const [activeTab, setActiveTab] = useState<LibraryTab>('recent');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<SavedItemType | 'all'>('all');
  const [reviewAll, setReviewAll] = useState(true);
  const [reviewTypes, setReviewTypes] = useState<Set<SavedItemType>>(new Set());
  const [reviewSelectionOpen, setReviewSelectionOpen] = useState(false);
  const [reviewCustomIds, setReviewCustomIds] = useState<Set<string> | null>(null);
  const [reviewItems, setReviewItems] = useState<SavedItem[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewAnswerVisible, setReviewAnswerVisible] = useState(false);
  const [reviewAudioPlaying, setReviewAudioPlaying] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<SavedItem | null>(null);
  const [activeRecentSession, setActiveRecentSession] = useState<SessionRecord | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [reviewEmptyOpen, setReviewEmptyOpen] = useState(false);
  const activeReviewItem = reviewItems[reviewIndex];
  const activeReviewSource = activeReviewItem ? getReviewSource(activeReviewItem) : null;
  const activeReviewLanguage = getLanguage(((activeReviewItem?.languageCode ?? 'ja') as LanguageCode));
  const {
    recognitionState,
    transcript,
    error: speechError,
    startListening,
    stopListening,
    reset: resetSpeech,
  } = useSpeechRecognition(activeReviewLanguage.sttLocale);

  const load = useCallback(async () => {
    const [saved, history, memory] = await Promise.all([getSavedItems(), getSessionHistory(), getAttemptMemory()]);
    setItems(saved);
    setSessions(history);
    setAttemptMemory(memory);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRemove = async (item: SavedItem) => {
    await removeSavedItemById(item.id);
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== item.id);
      if (next.length === 0) {
        setSelecting(false);
        setSearchOpen(false);
        setQuery('');
        setActiveType('all');
      }
      return next;
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    setReviewCustomIds((current) => {
      if (!current) return current;
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
  };

  const toggleSelecting = () => {
    setSelecting((current) => !current);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmBulkRemove = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    setBulkDeleteOpen(true);
  };

  const handleBulkRemove = async () => {
    const ids = Array.from(selectedIds);
    const idSet = new Set(ids);
    await removeSavedItemsByIds(ids);
    setItems((prev) => {
      const next = prev.filter((item) => !idSet.has(item.id));
      if (next.length === 0) {
        setSearchOpen(false);
        setQuery('');
        setActiveType('all');
      }
      return next;
    });
    setSelectedIds(new Set());
    setReviewCustomIds((current) => {
      if (!current) return current;
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setSelecting(false);
    setBulkDeleteOpen(false);
  };

  const matchesSearch = (item: SavedItem) => {
    const typeMatches = activeType === 'all' || item.type === activeType;
    const needle = query.trim().toLowerCase();
    if (!needle) return typeMatches;
    const content = `${item.type} ${item.question} ${item.answer}`.toLowerCase();
    return typeMatches && content.includes(needle);
  };

  const filteredItems = items.filter(matchesSearch);
  const recentCompleted = useMemo(
    () => sessions.slice().sort((a, b) => b.date - a.date).slice(0, 3),
    [sessions],
  );
  const selectedReviewItems = useMemo(() => {
    if (reviewCustomIds) return items.filter((item) => reviewCustomIds.has(item.id));
    return reviewAll ? items : items.filter((item) => reviewTypes.has(item.type));
  }, [items, reviewAll, reviewCustomIds, reviewTypes]);
  const selectedReviewIdSet = useMemo(
    () => new Set(selectedReviewItems.map((item) => item.id)),
    [selectedReviewItems],
  );
  const libraryTabs = useMemo<Array<{ id: LibraryTab; label: string; count?: number }>>(() => [
    { id: 'recent', label: 'Recently completed', count: recentCompleted.length },
    { id: 'saved', label: 'Saved', count: items.length },
    { id: 'review', label: 'Review' },
  ], [items.length, recentCompleted.length]);
  const activeHeader = {
    recent: {
      title: 'Recent work',
      subtitle: recentCompleted.length > 0
        ? `${recentCompleted.length} most recent ${recentCompleted.length === 1 ? 'completion' : 'completions'}`
        : 'Completed work appears here after drills.',
    },
    saved: {
      title: 'Saved work',
      subtitle: `${items.length} saved ${items.length === 1 ? 'item' : 'items'}`,
    },
    review: {
      title: 'Review builder',
      subtitle: items.length > 0 ? `${selectedReviewItems.length} saved ${selectedReviewItems.length === 1 ? 'item' : 'items'} selected` : 'Save items first, then build review sets.',
    },
  }[activeTab];

  const switchTab = (tab: LibraryTab) => {
    haptics.impact('light');
    setActiveTab(tab);
    setSelecting(false);
    setSelectedIds(new Set());
    if (tab !== 'review') setReviewSelectionOpen(false);
    if (tab !== 'saved') {
      setSearchOpen(false);
      setQuery('');
      setActiveType('all');
    }
  };

  const availableSearchFilters = useMemo(() => {
    const counts = items.reduce<Record<SavedItemType, number>>((acc, item) => {
      acc[item.type] += 1;
      return acc;
    }, {
      listening: 0,
      speaking: 0,
      conversation: 0,
      reading: 0,
      texting: 0,
    });

    return FILTERS.filter((filter) => filter.type === 'all' || counts[filter.type] > 0);
  }, [items]);

  const availableReviewFilters = useMemo(() => {
    const counts = items.reduce<Record<SavedItemType, number>>((acc, item) => {
      acc[item.type] += 1;
      return acc;
    }, {
      listening: 0,
      speaking: 0,
      conversation: 0,
      reading: 0,
      texting: 0,
    });

    return FILTERS
      .filter((filter) => filter.type === 'all' || counts[filter.type] > 0)
      .map((filter) => ({
        ...filter,
        count: filter.type === 'all' ? items.length : counts[filter.type],
      }));
  }, [items]);

  const activeRecentAttempts = useMemo(
    () => (activeRecentSession ? getAttemptsForSession(activeRecentSession, attemptMemory) : []),
    [activeRecentSession, attemptMemory],
  );
  const activeRecentCandidates = useMemo(
    () => (activeRecentSession ? savedItemsFromSession(activeRecentSession, activeRecentAttempts) : []),
    [activeRecentAttempts, activeRecentSession],
  );
  const activeRecentSavedCount = useMemo(
    () => savedCandidateStatus(activeRecentCandidates, items),
    [activeRecentCandidates, items],
  );
  const activeRecentFullySaved = activeRecentCandidates.length > 0 && activeRecentSavedCount >= activeRecentCandidates.length;

  const toggleReviewFilter = (type: SavedItemType | 'all') => {
    setReviewCustomIds(null);
    if (type === 'all') {
      setReviewAll(true);
      setReviewTypes(new Set());
      return;
    }

    setReviewAll(false);
    setReviewTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      if (next.size === 0) setReviewAll(true);
      return next;
    });
  };

  const openReviewSelection = () => {
    haptics.impact('light');
    setReviewCustomIds(new Set(selectedReviewItems.map((item) => item.id)));
    setReviewSelectionOpen(true);
  };

  const closeReviewSelection = () => {
    haptics.impact('light');
    setReviewSelectionOpen(false);
  };

  const toggleReviewPoolItem = (id: string) => {
    haptics.impact('light');
    setReviewCustomIds((current) => {
      const next = new Set(current ?? selectedReviewItems.map((item) => item.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllReviewItems = () => {
    haptics.impact('light');
    setReviewCustomIds(new Set(items.map((item) => item.id)));
  };

  const clearReviewItems = () => {
    haptics.impact('light');
    setReviewCustomIds(new Set());
  };

  const startReview = () => {
    const nextItems = selectedReviewItems;
    if (nextItems.length === 0) {
      setReviewEmptyOpen(true);
      return;
    }
    setReviewItems(nextItems);
    setReviewIndex(0);
    setReviewAnswerVisible(false);
  };

  const openRecentCompletion = (session: SessionRecord) => {
    haptics.impact('light');
    setActiveRecentSession(session);
  };

  const toggleRecentCandidateSaved = async (candidate: Omit<SavedItem, 'savedAt'>) => {
    haptics.impact('medium');
    const existing = findSavedCandidate(candidate, items);
    if (existing) {
      await removeSavedItemById(existing.id);
    } else {
      await saveItem(candidate);
    }
    await load();
  };

  const finishReview = () => {
    Speech.stop();
    if (recognitionState === 'listening') stopListening();
    resetSpeech();
    setReviewAudioPlaying(false);
    setReviewItems([]);
    setReviewIndex(0);
    setReviewAnswerVisible(false);
  };

  const closeReview = () => {
    if (reviewItems.length > 0) {
      finishReview();
      return;
    }
  };

  const advanceReview = () => {
    Speech.stop();
    if (recognitionState === 'listening') stopListening();
    resetSpeech();
    setReviewAudioPlaying(false);
    const current = reviewItems[reviewIndex];
    const currentSource = current ? getReviewSource(current) : null;
    const isResultOnly = Boolean(currentSource?.resultOnly);
    if (!isResultOnly && !reviewAnswerVisible) {
      setReviewAnswerVisible(true);
      return;
    }
    if (reviewIndex + 1 >= reviewItems.length) {
      finishReview();
      return;
    }
    setReviewIndex((index) => index + 1);
    setReviewAnswerVisible(false);
  };

  const playReviewAudio = (text: string) => {
    if (reviewAudioPlaying) {
      Speech.stop();
      setReviewAudioPlaying(false);
      return;
    }
    setReviewAudioPlaying(true);
    Speech.stop();
    Speech.speak(text, {
      language: 'ja-JP',
      rate: 0.88,
      onDone: () => setReviewAudioPlaying(false),
      onStopped: () => setReviewAudioPlaying(false),
      onError: () => setReviewAudioPlaying(false),
    });
  };

  const toggleSpeakingReview = () => {
    if (recognitionState === 'listening') {
      stopListening();
      return;
    }
    resetSpeech();
    startListening(undefined, { continuous: true });
  };

  const openSavedReview = (item: SavedItem) => {
    haptics.impact('light');
    Speech.stop();
    setReviewAudioPlaying(false);
    setReviewItems([item]);
    setReviewIndex(0);
    setReviewAnswerVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KanjiBackdrop variant="library" compact={isCompact} />
      <DesktopSideRail />
      {!isCompact && (
        <View style={[styles.desktopShell, desktopInsets]}>
          <View style={styles.desktopShellContent}>
            <MainTabHeader streak={stats?.currentStreak ?? 0} onSwitch={() => router.push('/onboarding')} />
          </View>
        </View>
      )}
      {isCompact && (
        <View style={styles.mobileShell}>
          <MobileTabHeader streak={stats?.currentStreak ?? 0} onSwitch={() => router.push('/onboarding')} />
        </View>
      )}
      <View style={[styles.header, !isCompact && styles.headerDesktop, !isCompact && desktopInsets, isCompact && styles.headerCompact]}>
        <View style={styles.headerTop}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Library</Text>
            <Text style={[styles.title, isCompact && styles.titleCompact]} numberOfLines={1}>{activeHeader.title}</Text>
            <Text style={styles.subtitle}>{activeHeader.subtitle}</Text>
          </View>
        </View>
        <View style={[styles.libraryTabs, isCompact && styles.libraryTabsCompact]}>
          {libraryTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => switchTab(tab.id)}
                activeOpacity={0.86}
                style={[styles.libraryTab, active && styles.libraryTabActive]}
                accessibilityRole="button"
                accessibilityLabel={`Show ${tab.label}`}
              >
                <Text style={[styles.libraryTabText, active && styles.libraryTabTextActive]}>
                  {isCompact && tab.id === 'recent' ? 'Recent' : tab.label}
                </Text>
                {typeof tab.count === 'number' && (
                  <View style={[styles.libraryTabCount, active && styles.libraryTabCountActive]}>
                    <Text style={[styles.libraryTabCountText, active && styles.libraryTabCountTextActive]}>{tab.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {activeTab === 'saved' && items.length > 0 && (
          <View style={[styles.savedToolsPanel, isCompact && styles.savedToolsPanelCompact]}>
            <View style={styles.savedToolsTop}>
              <View style={styles.savedToolsCopy}>
                <Text style={styles.savedToolsKicker}>Saved controls</Text>
                <Text style={styles.savedToolsTitle}>
                  {selecting ? `${selectedIds.size} selected` : searchOpen ? 'Search saved work' : 'Manage the shelf'}
                </Text>
              </View>
              <View style={styles.libraryActions}>
                <TouchableOpacity onPress={() => setSearchOpen((open) => !open)} activeOpacity={0.82} style={[styles.actionChip, isCompact && styles.actionChipCompact, searchOpen && styles.actionChipActive]}>
                  <Text style={[styles.actionChipText, searchOpen && styles.actionChipTextActive]}>{searchOpen ? 'Close search' : 'Search'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleSelecting} activeOpacity={0.82} style={[styles.actionChip, isCompact && styles.actionChipCompact, selecting && styles.actionChipActive]}>
                  <Text style={[styles.actionChipText, selecting && styles.actionChipTextActive]}>{selecting ? 'Cancel select' : 'Select'}</Text>
                </TouchableOpacity>
                {selecting && selectedIds.size > 0 && (
                  <TouchableOpacity onPress={confirmBulkRemove} activeOpacity={0.82} style={[styles.deleteChip, isCompact && styles.actionChipCompact]}>
                    <Text style={styles.deleteChipText}>Delete {selectedIds.size}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {searchOpen && (
              <View style={styles.searchPanel}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search saved questions"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.searchInput}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {availableSearchFilters.map((filter) => (
                    <TouchableOpacity
                      key={filter.type}
                      onPress={() => setActiveType(filter.type)}
                      activeOpacity={0.82}
                      style={[styles.filterChip, activeType === filter.type && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterText, activeType === filter.type && styles.filterTextActive]}>{filter.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

      {activeTab === 'recent' ? (
        recentCompleted.length === 0 ? (
          <View style={[styles.sectionEmpty, !isCompact && desktopInsets, isCompact && styles.sectionEmptyCompact]}>
            <View style={styles.emptyIcon}>
              <CheckIcon size={34} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No completed work yet</Text>
            <Text style={styles.emptyText}>
              Finish a generated drill or Mini Mock part and Kibbo will keep the three most recent completions here.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.list, styles.recentList, !isCompact && desktopInsets, isCompact && styles.listCompact]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.completedGrid, isCompact && styles.completedGridCompact]}>
              {recentCompleted.map((session) => {
                const attempts = getAttemptsForSession(session, attemptMemory);
                const candidates = savedItemsFromSession(session, attempts);
                const savedCount = savedCandidateStatus(candidates, items);
                return (
                  <CompletedCard
                    key={session.id}
                    session={session}
                    compact={isCompact}
                    savedCount={savedCount}
                    itemCount={candidates.length}
                    onPress={() => openRecentCompletion(session)}
                  />
                );
              })}
            </View>
          </ScrollView>
        )
      ) : activeTab === 'saved' ? (
        items.length === 0 ? (
          <View style={[styles.sectionEmpty, !isCompact && desktopInsets, isCompact && styles.sectionEmptyCompact]}>
            <View style={styles.emptyIcon}>
              <BookOpenIcon size={34} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>
              Tap the bookmark icon during practice sessions to save questions and AP reviews here for later.
            </Text>
          </View>
        ) : (
          <>
            {!isCompact && (
              <View style={[styles.fixedListHeaderWrap, !isCompact && desktopInsets]}>
                <View style={styles.listHeaderRow}>
                  <Text style={styles.listHeaderLabel}>Saved item</Text>
                  <Text style={styles.listHeaderLabel}>Answer / review</Text>
                  <Text style={[styles.listHeaderLabel, styles.listHeaderAction]}>Actions</Text>
                </View>
              </View>
            )}
            <ScrollView
              contentContainerStyle={[styles.list, styles.savedList, !isCompact && desktopInsets, isCompact && styles.listCompact]}
              showsVerticalScrollIndicator={false}
            >
              {filteredItems.map((item) => (
                <SavedCard
                  key={item.id}
                  item={item}
                  onPress={() => openSavedReview(item)}
                  onRequestRemove={() => setPendingDeleteItem(item)}
                  selecting={selecting}
                  selected={selectedIds.has(item.id)}
                  onSelect={() => toggleSelected(item.id)}
                  compact={isCompact}
                />
              ))}
              {filteredItems.length === 0 && (
                <Text style={styles.emptySearch}>No saved items match this search.</Text>
              )}
              <Text style={[styles.listFooter, isCompact && styles.listFooterCompact]}>
                {selecting ? 'Tap cards to select them for deletion' : 'Use the star to remove one item, or Select to remove several'}
              </Text>
            </ScrollView>
          </>
        )
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, styles.reviewList, !isCompact && desktopInsets, isCompact && styles.listCompact]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.reviewBuilderPanel, isCompact && styles.reviewBuilderPanelCompact]}>
            <View style={styles.reviewBuilderTop}>
              <View style={styles.reviewBuilderIcon}>
                <StarIcon size={25} color={Colors.onPrimary} strokeWidth={2.1} />
              </View>
              <View style={styles.reviewBuilderCopy}>
                <Text style={styles.reviewBuilderKicker}>Library review</Text>
                <Text style={styles.reviewBuilderTitle}>Build a recall set</Text>
                <Text style={styles.reviewBuilderText}>Pick a fast pool by type, or open Selection review to manually add and remove saved work.</Text>
              </View>
              <View style={styles.reviewPoolCount}>
                <Text style={styles.reviewPoolCountValue}>{selectedReviewItems.length}</Text>
                <Text style={styles.reviewPoolCountLabel}>ready</Text>
              </View>
            </View>
            <View style={styles.reviewBuilderBody}>
              <View style={styles.reviewFilterBlock}>
                <Text style={styles.reviewSectionLabel}>Fast pool selection</Text>
                <View style={styles.reviewFilters}>
                  {availableReviewFilters.map((filter) => {
                    const selected = !reviewCustomIds && (filter.type === 'all' ? reviewAll : !reviewAll && reviewTypes.has(filter.type));
                    return (
                      <TouchableOpacity
                        key={filter.type}
                        onPress={() => toggleReviewFilter(filter.type)}
                        activeOpacity={0.82}
                        style={[styles.reviewFilterChip, selected && styles.reviewFilterChipActive]}
                      >
                        <Text style={[styles.reviewFilterText, selected && styles.reviewFilterTextActive]}>
                          {filter.label}
                        </Text>
                        <View style={[styles.filterCountBadge, selected && styles.filterCountBadgeActive]}>
                          <Text style={[styles.filterCountText, selected && styles.filterCountTextActive]}>{filter.count}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={[styles.reviewStartRow, isCompact && styles.reviewStartRowCompact]}>
                <TouchableOpacity
                  onPress={startReview}
                  disabled={selectedReviewItems.length === 0}
                  activeOpacity={0.86}
                  style={[styles.startReviewBtn, styles.reviewStartButton, selectedReviewItems.length === 0 && styles.startReviewBtnDisabled]}
                >
                  <Text style={styles.startReviewText}>Start Review</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={reviewSelectionOpen ? closeReviewSelection : openReviewSelection}
                  disabled={items.length === 0}
                  activeOpacity={0.86}
                  style={[styles.selectionReviewBtn, styles.reviewStartButton, items.length === 0 && styles.startReviewBtnDisabled]}
                >
                  <Text style={styles.selectionReviewText}>{reviewSelectionOpen ? 'Done selecting' : 'Selection review'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptySearch}>Save a few lessons first, then Kibbo can turn them into a review set.</Text>
          ) : selectedReviewItems.length === 0 ? (
            <Text style={styles.emptySearch}>No saved items match this review selection.</Text>
          ) : null}

          {reviewSelectionOpen && items.length > 0 && (
            <View style={styles.reviewSelectionPanel}>
              <View style={styles.reviewSelectionTop}>
                <View>
                  <Text style={styles.reviewSectionLabel}>Selection review</Text>
                  <Text style={styles.reviewSelectionTitle}>Edit review pool</Text>
                </View>
                <View style={styles.reviewSelectionActions}>
                  <TouchableOpacity onPress={selectAllReviewItems} activeOpacity={0.82} style={styles.actionChip}>
                    <Text style={styles.actionChipText}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearReviewItems} activeOpacity={0.82} style={styles.actionChip}>
                    <Text style={styles.actionChipText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={closeReviewSelection} activeOpacity={0.82} style={[styles.actionChip, styles.actionChipActive]}>
                    <Text style={[styles.actionChipText, styles.actionChipTextActive]}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {!isCompact && (
                <View style={styles.listHeaderRow}>
                  <Text style={styles.listHeaderLabel}>Saved item</Text>
                  <Text style={styles.listHeaderLabel}>Answer / review</Text>
                  <Text style={[styles.listHeaderLabel, styles.listHeaderAction]}>Pool</Text>
                </View>
              )}
              {items.map((item) => (
                <SavedCard
                  key={item.id}
                  item={item}
                  onPress={() => toggleReviewPoolItem(item.id)}
                  onRequestRemove={() => setPendingDeleteItem(item)}
                  selecting
                  selected={selectedReviewIdSet.has(item.id)}
                  onSelect={() => toggleReviewPoolItem(item.id)}
                  showRemove={false}
                  compact={isCompact}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
      <Modal transparent visible={reviewEmptyOpen} animationType="none" onRequestClose={() => setReviewEmptyOpen(false)}>
        <View style={[styles.modalShade, isCompact && styles.modalShadeCompact]}>
          <View style={[styles.modalCard, isCompact && styles.modalCardCompact, isCompact && { maxHeight: compactModalMaxHeight }]}>
            <View style={styles.modalTop}>
              <Text style={[styles.modalTitle, isCompact && styles.modalTitleCompact]}>Nothing selected</Text>
              <TouchableOpacity onPress={() => setReviewEmptyOpen(false)} style={styles.modalClose}>
                <XIcon size={18} color={Colors.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>Choose at least one saved category to review.</Text>
            <TouchableOpacity onPress={() => setReviewEmptyOpen(false)} activeOpacity={0.86} style={styles.startReviewBtn}>
              <Text style={styles.startReviewText}>Choose Categories</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={Boolean(activeRecentSession)} animationType="none" onRequestClose={() => setActiveRecentSession(null)}>
        <View style={[styles.modalShade, isCompact && styles.modalShadeCompact]}>
          {activeRecentSession && (
            <View style={[styles.recentModalCard, isCompact && styles.recentModalCardCompact, isCompact && { maxHeight: compactModalMaxHeight }]}>
              <View style={styles.modalTop}>
                <View style={styles.recentModalTitleWrap}>
                  <Text style={styles.recentModalKicker}>{getTypeLabel(activeRecentSession.type)}</Text>
                  <Text style={[styles.recentModalTitle, isCompact && styles.recentModalTitleCompact]}>{getSessionTitle(activeRecentSession)}</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveRecentSession(null)} style={styles.modalClose}>
                  <XIcon size={18} color={Colors.textSub} />
                </TouchableOpacity>
              </View>
              <View style={[styles.recentModalStats, isCompact && styles.recentModalStatsCompact]}>
                <View style={[styles.recentModalStat, isCompact && styles.recentModalStatCompact]}>
                  <Text style={styles.recentModalStatValue}>{activeRecentSession.score}%</Text>
                  <Text style={styles.recentModalStatLabel}>score</Text>
                </View>
                <View style={[styles.recentModalStat, isCompact && styles.recentModalStatCompact]}>
                  <Text style={styles.recentModalStatValue}>{activeRecentSession.xpEarned}</Text>
                  <Text style={styles.recentModalStatLabel}>XP</Text>
                </View>
                <View style={[styles.recentModalStat, isCompact && styles.recentModalStatCompact]}>
                  <Text style={styles.recentModalStatValue}>{activeRecentCandidates.length}</Text>
                  <Text style={styles.recentModalStatLabel}>saveable</Text>
                </View>
              </View>
              <View style={[styles.recentSaveStatus, activeRecentFullySaved && styles.recentSaveStatusDone]}>
                <Text style={[styles.recentSaveStatusText, activeRecentFullySaved && styles.recentSaveStatusTextDone]}>
                  {activeRecentFullySaved
                    ? 'Already saved in Library'
                    : `${activeRecentSavedCount} of ${activeRecentCandidates.length} saved`}
                </Text>
              </View>
              <View style={styles.recentModalPreview}>
                <Text style={styles.reviewSectionLabel}>Tap drills to save</Text>
                <ScrollView style={[styles.recentCandidateScroller, isCompact && styles.recentCandidateScrollerCompact]} contentContainerStyle={styles.recentCandidateList} showsVerticalScrollIndicator={false}>
                  {activeRecentCandidates.map((candidate) => {
                    const savedCandidate = findSavedCandidate(candidate, items);
                    const isSaved = Boolean(savedCandidate);
                    return (
                      <TouchableOpacity
                        key={`${candidate.type}:${candidate.promptId}`}
                        onPress={() => toggleRecentCandidateSaved(candidate)}
                        activeOpacity={0.86}
                        style={[styles.recentCandidateRow, isSaved && styles.recentCandidateRowSaved]}
                        accessibilityRole="button"
                        accessibilityLabel={`${isSaved ? 'Remove' : 'Save'} ${candidate.question} from Library`}
                      >
                        <View style={[styles.recentCandidateDot, { backgroundColor: `${getTypeAccent(candidate.type)}18` }]}>
                          {typeIconFor(candidate.type, 16, getTypeAccent(candidate.type))}
                        </View>
                        <View style={styles.recentCandidateCopy}>
                          <Text style={styles.recentCandidateTitle} numberOfLines={1}>{candidate.question}</Text>
                          <Text style={styles.recentCandidateMeta} numberOfLines={1}>{getTypeLabel(candidate.type)} · {candidate.promptId}</Text>
                        </View>
                        <View style={[styles.recentCandidateSaveBadge, isSaved && styles.recentCandidateSaveBadgeActive]}>
                          {isSaved && <CheckIcon size={15} color={Colors.onPrimary} strokeWidth={3} />}
                          <Text style={[styles.recentCandidateSaveText, isSaved && styles.recentCandidateSaveTextActive]}>
                            {isSaved ? 'Saved' : 'Save'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.recentModalActions}>
                <TouchableOpacity onPress={() => setActiveRecentSession(null)} activeOpacity={0.84} style={[styles.confirmCancelBtn, styles.recentModalCloseBtn]}>
                  <Text style={styles.confirmCancelText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
      <Modal transparent visible={Boolean(pendingDeleteItem)} animationType="none" onRequestClose={() => setPendingDeleteItem(null)}>
        <View style={[styles.modalShade, isCompact && styles.modalShadeCompact]}>
          <View style={[styles.modalCard, isCompact && styles.modalCardCompact, isCompact && { maxHeight: compactModalMaxHeight }]}>
            <View style={styles.modalTop}>
              <Text style={[styles.modalTitle, isCompact && styles.modalTitleCompact]}>Remove from Library?</Text>
              <TouchableOpacity onPress={() => setPendingDeleteItem(null)} style={styles.modalClose}>
                <XIcon size={18} color={Colors.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText} numberOfLines={3}>
              {pendingDeleteItem?.question}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity onPress={() => setPendingDeleteItem(null)} style={styles.confirmCancelBtn} activeOpacity={0.84}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!pendingDeleteItem) return;
                  const item = pendingDeleteItem;
                  setPendingDeleteItem(null);
                  await handleRemove(item);
                }}
                style={styles.confirmDeleteBtn}
                activeOpacity={0.84}
              >
                <Text style={styles.confirmDeleteText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={bulkDeleteOpen} animationType="none" onRequestClose={() => setBulkDeleteOpen(false)}>
        <View style={[styles.modalShade, isCompact && styles.modalShadeCompact]}>
          <View style={[styles.modalCard, isCompact && styles.modalCardCompact, isCompact && { maxHeight: compactModalMaxHeight }]}>
            <View style={styles.modalTop}>
              <Text style={[styles.modalTitle, isCompact && styles.modalTitleCompact]}>Delete {selectedIds.size} saved {selectedIds.size === 1 ? 'item' : 'items'}?</Text>
              <TouchableOpacity onPress={() => setBulkDeleteOpen(false)} style={styles.modalClose}>
                <XIcon size={18} color={Colors.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>This only removes them from your Library. Practice history stays intact.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity onPress={() => setBulkDeleteOpen(false)} style={styles.confirmCancelBtn} activeOpacity={0.84}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleBulkRemove} style={styles.confirmDeleteBtn} activeOpacity={0.84}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={reviewItems.length > 0} animationType="none" onRequestClose={closeReview}>
        <View style={[styles.modalShade, styles.reviewModalShade, isCompact && styles.modalShadeCompact]}>
          <View style={[styles.reviewCard, isCompact && styles.reviewCardCompact, isCompact && { maxHeight: compactModalMaxHeight }]}>
            <View style={styles.modalTop}>
              <Text numberOfLines={1} style={styles.reviewCounter}>Review {reviewIndex + 1} of {reviewItems.length}</Text>
              <TouchableOpacity onPress={closeReview} style={styles.modalClose}>
                <XIcon size={18} color={Colors.textSub} />
              </TouchableOpacity>
            </View>
            {activeReviewItem && activeReviewSource && (
              <>
                <Text style={styles.reviewType}>{activeReviewItem.type}</Text>
                <Text style={styles.reviewQuestion}>{activeReviewItem.question}</Text>
                <View style={[styles.reviewSourceBox, (activeReviewSource.apReview || activeReviewSource.apPromptSet) && styles.reviewSourceBoxResult]}>
                  <Text style={styles.reviewAnswerLabel}>{activeReviewSource.sourceLabel}</Text>
                  {activeReviewSource.apReview ? (
                    <APReviewReport review={activeReviewSource.apReview} kind={activeReviewItem.type} />
                  ) : activeReviewSource.apPromptSet ? (
                    <APPromptSetReport promptSet={activeReviewSource.apPromptSet} kind={activeReviewItem.type} />
                  ) : activeReviewItem.type === 'listening' && activeReviewSource.audio ? (
                    <TouchableOpacity
                      onPress={() => {
                        const audio = activeReviewSource.audio;
                        if (audio) playReviewAudio(audio);
                      }}
                      activeOpacity={0.84}
                      style={styles.reviewListenBtn}
                    >
                      {reviewAudioPlaying ? (
                        <StopIcon size={18} color={Colors.onPrimary} strokeWidth={2.2} />
                      ) : (
                        <PlayIcon size={18} color={Colors.onPrimary} strokeWidth={2.2} />
                      )}
                      <Text style={styles.reviewListenText}>{reviewAudioPlaying ? 'Stop audio' : 'Listen'}</Text>
                    </TouchableOpacity>
                  ) : activeReviewItem.type === 'speaking' ? (
                    <>
                      <Text style={styles.reviewSourceText}>{activeReviewSource.sourceText}</Text>
                      <TouchableOpacity onPress={toggleSpeakingReview} activeOpacity={0.84} style={styles.reviewSpeakBtn}>
                        {recognitionState === 'listening' ? (
                          <StopIcon size={18} color={Colors.onPrimary} strokeWidth={2.2} />
                        ) : (
                          <MicrophoneIcon size={18} color={Colors.onPrimary} strokeWidth={2.2} />
                        )}
                        <Text style={styles.reviewListenText}>{recognitionState === 'listening' ? 'Stop speaking' : 'Speak'}</Text>
                      </TouchableOpacity>
                      {(transcript || speechError) && (
                        <View style={styles.reviewTranscriptBox}>
                          <Text style={styles.reviewAnswerLabel}>{speechError ? 'Microphone' : 'You said'}</Text>
                          <Text style={styles.reviewSourceText}>{speechError ?? transcript}</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={styles.reviewSourceText}>{activeReviewSource.sourceText}</Text>
                  )}
                </View>
                {activeReviewSource.resultOnly ? null : reviewAnswerVisible ? (
                  <View style={styles.reviewAnswerBox}>
                    <Text style={styles.reviewAnswerLabel}>{activeReviewItem.type === 'speaking' ? 'What to say' : 'Answer'}</Text>
                    <Text style={styles.reviewAnswer}>{activeReviewSource.answer}</Text>
                  </View>
                ) : (
                  <View style={styles.reviewPromptBox}>
                    <Text style={styles.reviewPromptText}>
                      {activeReviewItem.type === 'listening'
                        ? 'Listen first, then reveal the answer.'
                        : activeReviewItem.type === 'reading'
                          ? 'Read the passage, then reveal the saved answer.'
                          : activeReviewItem.type === 'speaking'
                            ? 'Speak your answer, then reveal what you should have said.'
                            : 'Use the saved result as your review.'}
                    </Text>
                  </View>
                )}
              </>
            )}
            <View style={styles.reviewNav}>
              <TouchableOpacity
                disabled={reviewIndex === 0}
                onPress={() => {
                  setReviewIndex((index) => Math.max(0, index - 1));
                  setReviewAnswerVisible(false);
                }}
                style={[styles.reviewNavBtn, reviewIndex === 0 && styles.reviewNavBtnDisabled]}
              >
                <Text style={styles.reviewNavText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={advanceReview}
                style={styles.reviewNavBtnPrimary}
              >
                <Text style={styles.reviewNavPrimaryText}>
                  {activeReviewSource?.resultOnly
                    ? (reviewIndex + 1 >= reviewItems.length ? 'Complete' : 'Next')
                    : !reviewAnswerVisible
                    ? 'Show Answer'
                    : reviewIndex + 1 >= reviewItems.length
                      ? 'Complete'
                      : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  desktopShell: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: 18,
  },
  desktopShellContent: {
    width: '100%',
    maxWidth: 1500,
    alignSelf: 'center',
  },
  mobileShell: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 14,
  },
  headerDesktop: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: 24,
  },
  headerCompact: {
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 0,
  },
  titleCompact: {
    fontSize: 34,
    lineHeight: 39,
  },
  kicker: { color: Colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
  subtitle: {
    fontSize: 16,
    color: Colors.textSub,
    fontWeight: '600',
  },
  libraryTabs: {
    width: '100%',
    minHeight: 58,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceTranslucent,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    gap: 5,
  },
  libraryTabsCompact: {
    minHeight: 48,
    borderRadius: 18,
  },
  libraryTab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  libraryTabActive: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: '#CDEDEA',
    shadowColor: Colors.ink,
    shadowOpacity: 0.055,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  libraryTabText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  libraryTabTextActive: {
    color: Colors.text,
    fontWeight: '900',
  },
  libraryTabCount: {
    minWidth: 26,
    minHeight: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  libraryTabCountActive: {
    backgroundColor: Colors.tealDim,
  },
  libraryTabCountText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  libraryTabCountTextActive: {
    color: Colors.teal,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  switchBtnCompact: {
    position: 'absolute',
    right: 24,
    top: 28,
    paddingHorizontal: 12,
  },
  switchText: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  list: { paddingTop: 24, gap: 12, paddingBottom: 48, width: '100%', alignSelf: 'center' },
  listCompact: { paddingLeft: 14, paddingRight: 14, paddingTop: 2, paddingBottom: 126, gap: 8 },
  savedList: {
    paddingTop: 10,
  },
  recentList: {
    paddingTop: 8,
  },
  reviewList: {
    paddingTop: 14,
  },
  completedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  completedGridCompact: {
    flexDirection: 'column',
    gap: 8,
  },
  completedCard: {
    flex: 1,
    minWidth: 280,
    minHeight: 198,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFF5',
    padding: 18,
    gap: 14,
    shadowColor: Colors.ink,
    shadowOpacity: 0.055,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  completedCardHover: {
    backgroundColor: '#FBFEFD',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  completedCardCompact: {
    minWidth: 0,
    minHeight: 116,
    borderRadius: 18,
    padding: 11,
    gap: 8,
  },
  completedTopRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  completedTopRowCompact: {
    minHeight: 38,
    alignItems: 'center',
  },
  completedGlyph: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedGlyphCompact: {
    width: 38,
    height: 38,
    borderRadius: 14,
  },
  completedSavedPill: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  completedSavedPillCompact: {
    minHeight: 26,
    paddingHorizontal: 8,
  },
  completedSavedPillActive: {
    borderColor: '#AEE5DF',
    backgroundColor: Colors.tealDim,
  },
  completedSavedText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  completedSavedTextCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  completedSavedTextActive: {
    color: Colors.teal,
  },
  completedCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  completedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  completedType: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  completedDate: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  completedTitle: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  completedTitleCompact: {
    fontSize: 18,
    lineHeight: 22,
  },
  completedDetail: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  completedDetailCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  completedFooter: {
    marginTop: 'auto',
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: Colors.surfaceTranslucent,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  completedFooterCompact: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  completedFooterLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  completedFooterLabelCompact: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.8,
  },
  completedFooterValue: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  completedFooterValueCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
  completedScoreBox: {
    minWidth: 82,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  completedScoreBoxCompact: {
    minWidth: 68,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  completedScore: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  completedScoreCompact: {
    fontSize: 16,
    lineHeight: 19,
  },
  completedXp: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  completedXpCompact: {
    fontSize: 9,
    lineHeight: 11,
  },
  listHeaderRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.surfaceTranslucent,
    paddingLeft: 92,
    paddingRight: 56,
    gap: 22,
    marginBottom: 2,
  },
  fixedListHeaderWrap: {
    paddingTop: 12,
  },
  listHeaderLabel: {
    flex: 1,
    color: '#586273',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  listHeaderAction: {
    flex: 0,
    width: 70,
    textAlign: 'right',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFFF2',
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderRadius: 22,
    minHeight: 92,
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.045,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
  },
  cardHover: {
    borderColor: '#92DCD6',
    backgroundColor: '#FBFEFD',
    shadowOpacity: 0.09,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 11 },
  },
  cardPress: {
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  cardCompact: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 11,
    minHeight: 92,
    borderRadius: 19,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  savedGlyph: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: Colors.tealDim,
    borderWidth: 1,
    borderColor: '#CDEDEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedGlyphCompact: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  savedGlyphHover: {
    backgroundColor: '#E6F7F5',
    borderColor: '#A9E1DC',
  },
  savedGlyphText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', lineHeight: 30 },
  savedCopy: { flex: 1, gap: 4, minWidth: 0 },
  savedAnswerColumn: {
    flex: 1.12,
    minWidth: 0,
  },
  removeBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeStar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTag: { color: LIBRARY_ACCENT, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  apReviewTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'transparent',
  },
  dateText: { fontSize: 12, color: Colors.textMuted },
  question: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 21,
  },
  questionCompact: {
    fontSize: 17,
    lineHeight: 21,
  },
  questionReviewPreview: {
    fontSize: 17,
    lineHeight: 22,
  },
  answer: {
    fontSize: 15,
    color: Colors.textSub,
    lineHeight: 21,
    flex: 1,
    fontWeight: '600',
  },
  answerReviewPreview: {
    flex: 0,
    fontSize: 16,
    lineHeight: 20,
  },
  scoreLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  scorePill: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '900',
  },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  sectionEmpty: {
    marginTop: 18,
    minHeight: 300,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFE8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  sectionEmptyCompact: {
    marginLeft: 14,
    marginRight: 14,
    marginTop: 6,
    minHeight: 230,
    borderRadius: 22,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  listFooter: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  listFooterCompact: {
    display: 'none',
  },
  libraryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 0,
    justifyContent: 'flex-end',
  },
  savedToolsPanel: {
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceTranslucent,
    padding: 12,
    gap: 12,
  },
  savedToolsPanelCompact: {
    borderRadius: 20,
    padding: 10,
  },
  savedToolsTop: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  savedToolsCopy: {
    flex: 1,
    minWidth: 0,
  },
  savedToolsKicker: {
    color: Colors.teal,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  savedToolsTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  actionChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipCompact: {
    minHeight: 40,
    paddingHorizontal: 13,
  },
  actionChipActive: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primary,
  },
  actionChipText: {
    color: Colors.textSub,
    fontSize: 13,
    fontWeight: '900',
  },
  actionChipTextActive: {
    color: Colors.primary,
  },
  deleteChip: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: Colors.error,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  searchPanel: {
    gap: 10,
  },
  searchInput: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  filterRow: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryDim,
  },
  filterText: {
    color: Colors.textSub,
    fontSize: 12,
    fontWeight: '900',
  },
  filterTextActive: {
    color: Colors.primary,
  },
  cardSelected: {
    backgroundColor: '#F3D8CF88',
    borderColor: Colors.primary,
    borderBottomColor: Colors.primary,
  },
  selectDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  selectDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  emptySearch: {
    color: Colors.textSub,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 34,
  },
  modalShade: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 32, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalShadeCompact: {
    paddingHorizontal: 14,
    paddingTop: 46,
    paddingBottom: 46,
  },
  reviewModalShade: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 22,
    gap: 14,
  },
  modalCardCompact: {
    maxWidth: 390,
    borderRadius: 24,
    padding: 14,
    gap: 9,
  },
  modalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
  },
  modalTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  modalTitleCompact: {
    fontSize: 23,
    lineHeight: 28,
  },
  modalClose: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalText: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 22,
  },
  recentModalCard: {
    width: '100%',
    maxWidth: 620,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 22,
    gap: 14,
    shadowColor: Colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  recentModalCardCompact: {
    maxWidth: 390,
    borderRadius: 24,
    padding: 14,
    gap: 9,
  },
  recentModalTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  recentModalKicker: {
    color: Colors.teal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  recentModalTitle: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  recentModalTitleCompact: {
    fontSize: 23,
    lineHeight: 28,
  },
  recentModalStats: {
    flexDirection: 'row',
    gap: 10,
  },
  recentModalStatsCompact: {
    gap: 7,
  },
  recentModalStat: {
    flex: 1,
    minHeight: 82,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceTranslucent,
    padding: 12,
    justifyContent: 'center',
  },
  recentModalStatCompact: {
    minHeight: 66,
    borderRadius: 17,
    padding: 10,
  },
  recentModalStatValue: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  recentModalStatLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  recentSaveStatus: {
    minHeight: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  recentSaveStatusDone: {
    borderColor: '#AEE5DF',
    backgroundColor: Colors.tealDim,
  },
  recentSaveStatusText: {
    color: Colors.textSub,
    fontSize: 14,
    fontWeight: '900',
  },
  recentSaveStatusTextDone: {
    color: Colors.teal,
  },
  recentModalPreview: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFFEA',
    padding: 12,
    gap: 9,
  },
  recentCandidateScroller: {
    maxHeight: 310,
  },
  recentCandidateScrollerCompact: {
    maxHeight: 210,
  },
  recentCandidateList: {
    gap: 8,
  },
  recentCandidateRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  recentCandidateRowSaved: {
    backgroundColor: Colors.tealDim,
    borderColor: '#AEE5DF',
  },
  recentCandidateDot: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentCandidateCopy: {
    flex: 1,
    minWidth: 0,
  },
  recentCandidateTitle: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  recentCandidateMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  recentCandidateSaveBadge: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 11,
  },
  recentCandidateSaveBadgeActive: {
    borderColor: Colors.teal,
    backgroundColor: Colors.teal,
  },
  recentCandidateSaveText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  recentCandidateSaveTextActive: {
    color: Colors.onPrimary,
  },
  recentModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  recentModalCloseBtn: {
    flex: 1,
  },
  reviewFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reviewBuilderPanel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#BFEDEA',
    backgroundColor: '#F4FBFA',
    padding: 20,
    gap: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  reviewBuilderPanelCompact: {
    borderRadius: 24,
    padding: 16,
    gap: 13,
  },
  reviewBuilderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  reviewBuilderIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBuilderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  reviewBuilderKicker: {
    color: Colors.primary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  reviewBuilderTitle: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  reviewBuilderText: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  reviewPoolCount: {
    minWidth: 82,
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7ECEA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reviewPoolCountValue: {
    color: Colors.ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  reviewPoolCountLabel: {
    color: Colors.teal,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reviewBuilderBody: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCEFED',
    padding: 14,
    gap: 14,
  },
  reviewFilterBlock: {
    gap: 12,
  },
  reviewSectionLabel: {
    color: Colors.teal,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  reviewFilterChip: {
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D5E3EA',
    backgroundColor: Colors.surface,
    paddingLeft: 18,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  reviewFilterChipActive: {
    borderColor: '#6CCBC4',
    backgroundColor: '#E9F8F6',
    shadowColor: Colors.teal,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  reviewFilterText: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  reviewFilterTextActive: {
    color: Colors.ink,
  },
  filterCountBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2EA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  filterCountBadgeActive: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
  },
  filterCountText: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  filterCountTextActive: {
    color: Colors.onPrimary,
  },
  reviewStartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewStartRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  reviewStartButton: {
    flex: 1,
  },
  startReviewBtn: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  startReviewBtnDisabled: {
    opacity: 0.45,
  },
  startReviewText: {
    color: Colors.onPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  selectionReviewBtn: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: '#EEF5F7',
    borderWidth: 1,
    borderColor: '#D5E3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionReviewText: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  reviewSelectionPanel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFD9',
    padding: 14,
    gap: 12,
  },
  reviewSelectionTop: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewSelectionTitle: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  reviewSelectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  reviewCard: {
    width: '100%',
    maxWidth: 620,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 22,
    gap: 14,
    marginBottom: 28,
  },
  reviewCardCompact: {
    maxWidth: 390,
    padding: 14,
    borderRadius: 24,
    gap: 10,
  },
  reviewCounter: {
    flex: 1,
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
  reviewType: {
    color: LIBRARY_ACCENT,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  reviewQuestion: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  reviewAnswerBox: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 6,
  },
  reviewSourceBox: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
    maxHeight: 220,
  },
  reviewSourceBoxResult: {
    maxHeight: 420,
    padding: 12,
  },
  reviewSourceText: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '600',
  },
  reviewResultScroll: {
    maxHeight: 360,
    alignSelf: 'stretch',
  },
  reviewResultContent: {
    gap: 12,
    paddingBottom: 4,
  },
  reviewResultHero: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 16,
    gap: 7,
  },
  reviewResultScore: {
    color: Colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  reviewResultLabel: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  reviewResultBody: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  reviewResultSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 14,
    gap: 6,
  },
  reviewResultSectionTitle: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
  },
  reviewResultBullet: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  reviewTurnCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 15,
    gap: 8,
  },
  reviewTurnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewTurnLabel: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
  },
  reviewTurnScore: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  reviewTurnPrompt: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
  },
  reviewTurnKicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 3,
  },
  reviewPromptBox: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    minHeight: 84,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPromptText: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '800',
    textAlign: 'center',
  },
  reviewListenBtn: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
    alignSelf: 'center',
  },
  reviewSpeakBtn: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  reviewListenText: {
    color: Colors.onPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  reviewTranscriptBox: {
    alignSelf: 'stretch',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 12,
    gap: 5,
  },
  reviewAnswerLabel: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  reviewAnswer: {
    color: Colors.textSub,
    fontSize: 17,
    lineHeight: 24,
  },
  reviewNav: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  reviewNavBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewNavBtnDisabled: {
    opacity: 0.45,
  },
  reviewNavText: {
    color: Colors.textSub,
    fontSize: 14,
    fontWeight: '900',
  },
  reviewNavBtnPrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewNavPrimaryText: {
    color: Colors.onPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  confirmCancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    color: Colors.textSub,
    fontSize: 14,
    fontWeight: '900',
  },
  confirmDeleteBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteText: {
    color: Colors.onPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
});
