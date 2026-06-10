import React from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { StarIcon, XIcon } from '@/components/Icons';
import {
  retryPendingFirstCompletionFeedbackToServer,
  submitAndTrackFirstCompletionFeedback,
} from '@/utils/feedbackApi';
import {
  dismissFirstCompletionFeedback,
  getFirstCompletionFeedback,
  submitFirstCompletionFeedback,
  subscribeFirstCompletionFeedback,
  type FirstCompletionFeedback,
} from '@/utils/storage';

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function FirstCompletionFeedbackModal() {
  const { width, height } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const [feedback, setFeedback] = React.useState<FirstCompletionFeedback | null>(null);
  const [rendered, setRendered] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const slide = React.useRef(new Animated.Value(520)).current;
  const shade = React.useRef(new Animated.Value(0)).current;

  const refresh = React.useCallback(async () => {
    const next = await getFirstCompletionFeedback();
    setFeedback(next?.status === 'pending' ? next : null);
  }, []);

  React.useEffect(() => {
    void refresh();
    void retryPendingFirstCompletionFeedbackToServer();
    return subscribeFirstCompletionFeedback(() => {
      void refresh();
    });
  }, [refresh]);

  React.useEffect(() => {
    if (!feedback) {
      setRendered(false);
      setRating(0);
      setComment('');
      slide.setValue(520);
      shade.setValue(0);
      return;
    }

    setRendered(true);
    setRating(0);
    setComment('');
    slide.setValue(520);
    shade.setValue(0);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(shade, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(slide, {
          toValue: 0,
          damping: 22,
          stiffness: 185,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [feedback, shade, slide]);

  const closeWithAnimation = React.useCallback((afterClose: () => Promise<unknown>) => {
    Animated.parallel([
      Animated.timing(shade, {
        toValue: 0,
        duration: 130,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 460,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRendered(false);
      void afterClose();
    });
  }, [shade, slide]);

  const dismiss = () => {
    closeWithAnimation(dismissFirstCompletionFeedback);
  };

  const submit = () => {
    if (!rating) return;
    closeWithAnimation(async () => {
      const submitted = await submitFirstCompletionFeedback(rating, comment);
      await submitAndTrackFirstCompletionFeedback(submitted);
    });
  };

  const hasRating = rating > 0;
  const responseTitle = rating <= 3
    ? 'What could be better?'
    : 'What did you like?';
  const responsePlaceholder = rating <= 3
    ? 'Tell us what felt confusing, slow, repetitive, or off.'
    : 'Tell us what felt useful, motivating, or clear.';

  if (!rendered) return null;

  return (
    <Modal transparent visible={rendered} animationType="none" onRequestClose={dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}
      >
        <Animated.View style={[styles.shade, isCompact && styles.shadeCompact, { opacity: shade }]}>
          <Animated.View
            style={[
              styles.card,
              isCompact && styles.cardCompact,
              isCompact && { maxHeight: Math.max(330, height - 92) },
              { transform: [{ translateY: slide }] },
            ]}
          >
            <Text style={styles.bgGlyph}>声</Text>
            <View style={[styles.topRow, isCompact && styles.topRowCompact]}>
              <View style={styles.copy}>
                <Text style={[styles.kicker, isCompact && styles.kickerCompact]}>Quick feedback</Text>
                <Text style={[styles.title, isCompact && styles.titleCompact]}>How was your first drill?</Text>
                <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>Your feedback helps shape the next Kibbo pass.</Text>
              </View>
              <TouchableOpacity onPress={dismiss} activeOpacity={0.82} style={[styles.closeBtn, isCompact && styles.closeBtnCompact]} accessibilityLabel="Close feedback">
                <XIcon size={18} color={Colors.textMuted} strokeWidth={2.25} />
              </TouchableOpacity>
            </View>

            <View style={[styles.starPanel, isCompact && styles.starPanelCompact]}>
              <Text style={[styles.starLabel, isCompact && styles.starLabelCompact]}>Choose a rating</Text>
              <View style={[styles.stars, isCompact && styles.starsCompact]}>
                {STAR_VALUES.map((value) => {
                  const selected = value <= rating;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setRating(value)}
                      activeOpacity={0.82}
                      style={[styles.starButton, isCompact && styles.starButtonCompact, selected && styles.starButtonSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                    >
                      <StarIcon size={isCompact ? 27 : 31} color={selected ? Colors.gold : Colors.textMuted} strokeWidth={selected ? 1.8 : 1.55} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {hasRating && (
              <View style={[styles.responsePanel, isCompact && styles.responsePanelCompact]}>
                <Text style={[styles.responseTitle, isCompact && styles.responseTitleCompact]}>{responseTitle}</Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder={responsePlaceholder}
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  textAlignVertical="top"
                  style={[styles.textInput, isCompact && styles.textInputCompact]}
                />
                <Pressable
                  onPress={submit}
                  style={({ hovered, pressed }) => [
                    styles.submitBtn,
                    isCompact && styles.submitBtnCompact,
                    hovered && styles.submitBtnHover,
                    pressed && styles.submitBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Submit feedback"
                >
                  <Text style={[styles.submitText, isCompact && styles.submitTextCompact]}>Submit feedback</Text>
                </Pressable>
              </View>
            )}

            <TouchableOpacity onPress={dismiss} activeOpacity={0.72} style={styles.notNowBtn} accessibilityLabel="Not now">
              <Text style={styles.notNowText}>not now</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
  },
  shade: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 27, 45, 0.48)',
    padding: 24,
  },
  shadeCompact: {
    padding: 14,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFF8',
    padding: 24,
    gap: 18,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.24,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 20 },
  },
  cardCompact: {
    maxWidth: 390,
    borderRadius: 26,
    padding: 16,
    gap: 12,
  },
  bgGlyph: {
    position: 'absolute',
    right: -26,
    bottom: -68,
    color: '#2FB9AE0B',
    fontSize: 184,
    lineHeight: 194,
    fontWeight: '900',
    transform: [{ rotate: '-12deg' }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  topRowCompact: {
    gap: 10,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  kickerCompact: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
  },
  title: {
    marginTop: 5,
    color: Colors.text,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
  },
  titleCompact: {
    fontSize: 25,
    lineHeight: 29,
  },
  subtitle: {
    marginTop: 7,
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  subtitleCompact: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnCompact: {
    width: 38,
    height: 38,
    borderRadius: 17,
  },
  starPanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#CDEDEA',
    backgroundColor: '#F2FFFD',
    padding: 14,
    gap: 12,
  },
  starPanelCompact: {
    borderRadius: 19,
    padding: 11,
    gap: 9,
  },
  starLabel: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  starLabelCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  stars: {
    flexDirection: 'row',
    gap: 8,
  },
  starsCompact: {
    gap: 6,
  },
  starButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButtonCompact: {
    minHeight: 48,
    borderRadius: 16,
  },
  starButtonSelected: {
    borderColor: '#F7D782',
    backgroundColor: '#FFF9E8',
    shadowColor: Colors.gold,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
  },
  responsePanel: {
    gap: 10,
  },
  responsePanelCompact: {
    gap: 8,
  },
  responseTitle: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  responseTitleCompact: {
    fontSize: 17,
    lineHeight: 22,
  },
  textInput: {
    minHeight: 118,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    paddingHorizontal: 15,
    paddingVertical: 13,
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  textInputCompact: {
    minHeight: 92,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    lineHeight: 20,
  },
  submitBtn: {
    minHeight: 58,
    borderRadius: 21,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
  },
  submitBtnCompact: {
    minHeight: 50,
    borderRadius: 18,
  },
  submitBtnHover: {
    transform: [{ translateY: -2 }, { scale: 1.01 }],
    shadowOpacity: 0.28,
  },
  submitBtnPressed: {
    transform: [{ translateY: 2 }, { scale: 0.985 }],
    shadowOpacity: 0.16,
  },
  submitText: {
    color: Colors.onPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  submitTextCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  notNowBtn: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    opacity: 0.58,
  },
  notNowText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
});
