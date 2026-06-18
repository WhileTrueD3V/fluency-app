import React from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { CheckIcon, ChevronRightIcon, StarIcon, TargetIcon, TrophyIcon, XIcon } from '@/components/Icons';
import { getCreditsRemaining, type CreditUsage, type SubscriptionPlan } from '@/utils/storage';

type CreditStartNoticeProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  cost: number;
  usage: CreditUsage | null;
  plan: SubscriptionPlan | null;
  onClose: () => void;
  onStart: () => void;
  onComparePlans?: () => void;
};

function pluralizeCredits(value: number) {
  return `${value} ${value === 1 ? 'credit' : 'credits'}`;
}

export function CreditStartNotice({
  visible,
  title,
  subtitle,
  cost,
  usage,
  plan,
  onClose,
  onStart,
  onComparePlans,
}: CreditStartNoticeProps) {
  const { width, height } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const isTight = width < 1120;
  const buttonScale = React.useRef(new Animated.Value(1)).current;
  const buttonShift = React.useRef(new Animated.Value(0)).current;
  const arrowOffset = React.useRef(new Animated.Value(0)).current;
  const buttonHoveredRef = React.useRef(false);
  const [buttonHovered, setButtonHovered] = React.useState(false);
  const creditsRemaining = usage && plan ? getCreditsRemaining(usage, plan) : 0;
  const allowance = plan?.creditAllowance ?? 0;
  const hasEnough = Boolean(usage && plan && creditsRemaining >= cost);
  const remainingLabel = `${pluralizeCredits(creditsRemaining)} available`;
  const compactTitle = hasEnough ? `Use ${pluralizeCredits(cost)}?` : 'Need more credits';
  const compactSubtitle = hasEnough ? title : `${remainingLabel}. Upgrade to keep generating AP practice.`;
  const startLabel = isCompact ? 'Start' : `Start for ${pluralizeCredits(cost)}`;
  const allowanceLabel = plan
    ? plan.creditCadence === 'starter'
      ? `${pluralizeCredits(allowance)} starter balance`
      : `${pluralizeCredits(allowance)} refresh monthly`
    : 'Credit balance loading';

  React.useEffect(() => {
    if (!visible) {
      buttonScale.setValue(1);
      buttonShift.setValue(0);
      arrowOffset.setValue(0);
      buttonHoveredRef.current = false;
      setButtonHovered(false);
      return;
    }
  }, [arrowOffset, buttonScale, buttonShift, visible]);

  const animateStartButton = React.useCallback((scale: number, shift: number, arrow: number) => {
    Animated.parallel([
      Animated.spring(buttonScale, {
        toValue: scale,
        tension: 240,
        friction: 17,
        useNativeDriver: true,
      }),
      Animated.spring(buttonShift, {
        toValue: shift,
        tension: 220,
        friction: 18,
        useNativeDriver: true,
      }),
      Animated.timing(arrowOffset, {
        toValue: arrow,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start();
  }, [arrowOffset, buttonScale, buttonShift]);

  const setStartHover = React.useCallback((hovered: boolean) => {
    buttonHoveredRef.current = hovered;
    setButtonHovered(hovered);
    animateStartButton(hovered ? 1.016 : 1, hovered ? -3 : 0, hovered ? 5 : 0);
  }, [animateStartButton]);

  const openPlans = () => {
    onClose();
    onComparePlans?.();
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={[styles.overlay, isCompact && styles.overlayCompact, isTight && styles.overlayTight]}>
        <View
          style={[
            styles.card,
            isTight && styles.cardTight,
            isCompact && styles.cardCompact,
            {
              maxHeight: Math.max(320, height - (isCompact ? 36 : isTight ? 28 : 56)),
            },
          ]}
        >
          <Text style={styles.bgGlyph}>点</Text>

          <View style={[styles.topRow, isTight && styles.topRowTight, isCompact && styles.topRowCompact]}>
            <View style={[styles.kickerPill, isTight && styles.kickerPillTight, isCompact && styles.kickerPillCompact]}>
              <StarIcon size={isTight ? 13 : 15} color={Colors.primary} strokeWidth={2.2} />
              <Text style={[styles.kicker, isTight && styles.kickerTight]}>Credit check</Text>
            </View>
            {isCompact && (
              <View style={styles.mobileCostPill}>
                <TrophyIcon size={14} color={Colors.gold} strokeWidth={2.35} />
                <Text style={styles.mobileCostText}>{pluralizeCredits(cost)}</Text>
              </View>
            )}
            <TouchableOpacity onPress={onClose} style={[styles.close, isTight && styles.closeTight, isCompact && styles.closeCompact]} accessibilityLabel="Close credit check">
              <XIcon size={isTight ? 16 : 18} color={Colors.textMuted} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.heroRow, isTight && styles.heroRowTight, isCompact && styles.heroRowCompact]}>
            {!isCompact && (
              <View style={[styles.creditOrb, isTight && styles.creditOrbTight, !hasEnough && styles.creditOrbLow]}>
                <Text style={[styles.creditValue, isTight && styles.creditValueTight]}>{cost}</Text>
                <Text style={[styles.creditLabel, isTight && styles.creditLabelTight]}>{cost === 1 ? 'credit' : 'credits'}</Text>
              </View>
            )}
            <View style={styles.heroCopy}>
              <Text style={[styles.title, isTight && styles.titleTight, isCompact && styles.titleCompact]} numberOfLines={isTight ? 2 : undefined}>
                {isCompact ? compactTitle : title}
              </Text>
              <Text style={[styles.subtitle, isTight && styles.subtitleTight, isCompact && styles.subtitleCompact]} numberOfLines={isTight ? 2 : undefined}>
                {isCompact ? compactSubtitle : isTight ? 'Generated AP practice from your rubric profile.' : subtitle ?? 'Kibbo will generate this AP Japanese coach task from your rubric profile.'}
              </Text>
            </View>
          </View>

          <View style={[styles.balanceBox, isTight && styles.balanceBoxTight, isCompact && styles.balanceBoxCompact, !hasEnough && styles.balanceBoxLow]}>
            <View style={[styles.balanceIcon, isTight && styles.balanceIconTight]}>
              {hasEnough ? (
                <CheckIcon size={isTight ? 15 : 18} color={Colors.secondary} strokeWidth={2.6} />
              ) : (
                <TargetIcon size={isTight ? 15 : 18} color={Colors.primary} strokeWidth={2.4} />
              )}
            </View>
            <View style={styles.balanceCopy}>
              <Text style={[styles.balanceTitle, isTight && styles.balanceTitleTight]}>{hasEnough ? remainingLabel : 'Not enough credits'}</Text>
              <Text style={[styles.balanceText, isTight && styles.balanceTextTight, isCompact && styles.balanceTextCompact]} numberOfLines={isCompact || isTight ? 1 : undefined}>
                {hasEnough
                  ? `${plan?.name ?? 'Starter'} plan · ${allowanceLabel}`
                  : `This costs ${pluralizeCredits(cost)}. ${remainingLabel}. Upgrade to keep generating AP work.`}
              </Text>
            </View>
          </View>

          {!hasEnough ? (
            <TouchableOpacity
              onPress={openPlans}
              activeOpacity={0.88}
              style={styles.upgradePanel}
              accessibilityRole="button"
              accessibilityLabel="Upgrade for more credits"
            >
              <View style={styles.upgradePanelIcon}>
                <TrophyIcon size={18} color={Colors.onPrimary} strokeWidth={2.25} />
              </View>
              <View style={styles.upgradePanelCopy}>
                <Text style={styles.upgradePanelKicker}>UPGRADE</Text>
                <Text style={styles.upgradePanelText}>Pro: 100 credits/month · Elite: 300 credits/month</Text>
              </View>
              <ChevronRightIcon size={20} color={Colors.primary} strokeWidth={2.4} />
            </TouchableOpacity>
          ) : null}

          {hasEnough ? (
            <Pressable
              onPress={onStart}
              onHoverIn={() => setStartHover(true)}
              onHoverOut={() => setStartHover(false)}
              onFocus={() => setStartHover(true)}
              onBlur={() => setStartHover(false)}
              onPressIn={() => {
                animateStartButton(0.986, 2, buttonHoveredRef.current ? 5 : 0);
              }}
              onPressOut={() => {
                animateStartButton(
                  buttonHoveredRef.current ? 1.016 : 1,
                  buttonHoveredRef.current ? -3 : 0,
                  buttonHoveredRef.current ? 5 : 0,
                );
              }}
              style={({ pressed }) => [styles.primaryPressable, pressed && styles.primaryPressablePressed]}
            >
              <Animated.View
                style={[
                  styles.primaryBtn,
                  isTight && styles.primaryBtnTight,
                  isCompact && styles.primaryBtnCompact,
                  buttonHovered && styles.primaryBtnHover,
                  { transform: [{ translateY: buttonShift }, { scale: buttonScale }] },
                ]}
              >
                <Text style={[styles.primaryText, isTight && styles.primaryTextTight]}>{startLabel}</Text>
                <Animated.View style={{ transform: [{ translateX: arrowOffset }] }}>
                  <ChevronRightIcon size={20} color={Colors.onPrimary} strokeWidth={2.5} />
                </Animated.View>
              </Animated.View>
            </Pressable>
          ) : (
            <View style={styles.lockedActions}>
              <TouchableOpacity onPress={openPlans} activeOpacity={0.86} style={styles.upgradeBtn}>
                <Text style={styles.upgradeText}>UPGRADE</Text>
                <ChevronRightIcon size={18} color={Colors.onPrimary} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 27, 45, 0.48)',
    padding: 22,
  },
  overlayCompact: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  overlayTight: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    width: '100%',
    maxWidth: 610,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    padding: 24,
    gap: 16,
    shadowColor: Colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    overflow: 'hidden',
  },
  cardCompact: {
    maxWidth: 390,
    borderRadius: 26,
    padding: 16,
    gap: 11,
  },
  cardTight: {
    maxWidth: 520,
    borderRadius: 22,
    padding: 12,
    gap: 9,
  },
  bgGlyph: {
    position: 'absolute',
    right: -22,
    bottom: -62,
    color: Colors.bgGlyph,
    fontSize: 188,
    lineHeight: 198,
    fontWeight: '900',
    opacity: 0.82,
    transform: [{ rotate: '-12deg' }],
  },
  topRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topRowCompact: {
    minHeight: 34,
    gap: 8,
  },
  topRowTight: {
    minHeight: 32,
  },
  kickerPill: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  kickerPillCompact: {
    minHeight: 32,
    gap: 7,
    paddingHorizontal: 10,
  },
  kickerPillTight: {
    minHeight: 30,
    gap: 6,
    paddingHorizontal: 11,
  },
  kicker: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  kickerTight: {
    fontSize: 10,
    letterSpacing: 3,
  },
  mobileCostPill: {
    minHeight: 31,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F7D782',
    backgroundColor: '#FFF8E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
  },
  mobileCostText: {
    color: Colors.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  close: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  closeCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  closeTight: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  heroRowCompact: {
    alignItems: 'center',
    gap: 0,
  },
  heroRowTight: {
    alignItems: 'center',
    gap: 12,
  },
  creditOrb: {
    width: 124,
    height: 124,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.26,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
  },
  creditOrbTight: {
    width: 68,
    height: 68,
    borderRadius: 19,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  creditOrbLow: {
    backgroundColor: Colors.ink,
    shadowColor: Colors.ink,
  },
  creditValue: {
    color: Colors.onPrimary,
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '900',
    letterSpacing: 0,
  },
  creditValueTight: {
    fontSize: 34,
    lineHeight: 38,
  },
  creditLabel: {
    color: Colors.onPrimaryMuted,
    fontSize: 14,
    fontWeight: '900',
  },
  creditLabelTight: {
    fontSize: 10,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  title: {
    color: Colors.text,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: 0,
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  titleTight: {
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  subtitleTight: {
    fontSize: 12,
    lineHeight: 16,
  },
  balanceBox: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.secondaryDim,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceBoxTight: {
    borderRadius: 16,
    padding: 9,
    gap: 9,
  },
  balanceBoxCompact: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  balanceBoxLow: {
    backgroundColor: Colors.errorDim,
    borderColor: Colors.primaryGlow,
  },
  balanceIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceIconTight: {
    width: 34,
    height: 34,
    borderRadius: 13,
  },
  balanceCopy: {
    flex: 1,
    minWidth: 0,
  },
  balanceTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  balanceTitleTight: {
    fontSize: 14,
  },
  balanceText: {
    marginTop: 3,
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  balanceTextTight: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  balanceTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  upgradePanel: {
    minHeight: 78,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    backgroundColor: Colors.primaryDim,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradePanelIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  upgradePanelCopy: {
    flex: 1,
    minWidth: 0,
  },
  upgradePanelKicker: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
  upgradePanelText: {
    marginTop: 3,
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  primaryPressable: {
    borderRadius: 24,
  },
  primaryPressablePressed: {
    opacity: 0.96,
  },
  primaryBtn: {
    minHeight: 68,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    borderBottomWidth: 6,
    borderBottomColor: '#A93425',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 22,
    shadowColor: Colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  primaryBtnCompact: {
    backgroundColor: Colors.ink,
    borderBottomColor: '#06101E',
    shadowColor: Colors.ink,
  },
  primaryBtnTight: {
    minHeight: 48,
    borderRadius: 17,
    borderBottomWidth: 4,
    paddingHorizontal: 16,
  },
  primaryBtnHover: {
    shadowOpacity: 0.32,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  primaryText: {
    color: Colors.onPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  primaryTextTight: {
    fontSize: 15,
  },
  lockedActions: {
    gap: 10,
  },
  upgradeBtn: {
    minHeight: 60,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.primary,
    borderBottomWidth: 5,
    borderBottomColor: '#A93425',
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  upgradeText: {
    color: Colors.onPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
});
