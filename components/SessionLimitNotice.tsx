import React from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { TargetIcon, TrophyIcon, XIcon } from '@/components/Icons';
import type { CreditUsage, SubscriptionPlan } from '@/utils/storage';

type SessionLimitNoticeProps = {
  visible: boolean;
  usage: CreditUsage | null;
  plan: SubscriptionPlan | null;
  context?: string;
  onClose: () => void;
  onComparePlans?: () => void;
};

export function SessionLimitNotice({ visible, usage, plan, context = 'practice sessions', onClose, onComparePlans }: SessionLimitNoticeProps) {
  const { width, height } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const limit = plan?.creditAllowance ?? 10;
  const used = usage?.creditsSpent ?? limit;
  const cappedUsed = Math.min(used, limit);
  const remaining = Math.max(0, limit - used);
  const cadenceLabel = plan?.creditCadence === 'monthly' ? 'this month' : 'in your starter balance';
  const entrance = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;
  const buttonScale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!visible) {
      entrance.setValue(0);
      pulse.setValue(0);
      buttonScale.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(entrance, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.spring(pulse, {
          toValue: 1,
          tension: 210,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(pulse, {
          toValue: 0,
          tension: 170,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [buttonScale, entrance, pulse, visible]);

  const cardTranslateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const cardScale = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const usageScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.045],
  });
  const usageRotate = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '-2.5deg', '0deg'],
  });
  const comparePlans = () => {
    onClose();
    onComparePlans?.();
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={[styles.overlay, isCompact && styles.overlayCompact]}>
        <Animated.View
          style={[
            styles.card,
            isCompact && styles.cardCompact,
            {
              maxHeight: Math.max(420, height - (isCompact ? 96 : 56)),
              opacity: entrance,
              transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
            },
          ]}
        >
          <Text style={styles.bgGlyph}>続</Text>

          <View style={[styles.topRow, isCompact && styles.topRowCompact]}>
            <View style={[styles.kickerPill, isCompact && styles.kickerPillCompact]}>
              <View style={styles.kickerDot} />
              <Text style={styles.kicker}>Credits</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.close, isCompact && styles.closeCompact]} accessibilityLabel="Close credit notice">
              <XIcon size={18} color={Colors.textMuted} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.heroRow, isCompact && styles.heroRowCompact]}>
            <Animated.View style={[styles.usageOrb, isCompact && styles.usageOrbCompact, { transform: [{ scale: usageScale }, { rotate: usageRotate }] }]}>
              <Text style={[styles.usageValue, isCompact && styles.usageValueCompact]}>{cappedUsed}</Text>
              <Text style={[styles.usageLimit, isCompact && styles.usageLimitCompact]}>/{limit}</Text>
            </Animated.View>
            <View style={styles.heroCopy}>
              <Text style={[styles.title, isCompact && styles.titleCompact]}>Not enough credits.</Text>
              <Text style={[styles.body, isCompact && styles.bodyCompact]}>
                This {context} needs more credits. You have {remaining}/{limit} credits available {cadenceLabel}.
              </Text>
            </View>
          </View>

          <View style={[styles.upgradeBox, isCompact && styles.upgradeBoxCompact]}>
            <Text style={[styles.upgradeLabel, isCompact && styles.upgradeLabelCompact]}>Upgrade balance</Text>
            <View style={[styles.planRow, isCompact && styles.planRowCompact]}>
              <TouchableOpacity
                onPress={comparePlans}
                activeOpacity={0.84}
                style={[styles.planTile, isCompact && styles.planTileCompact]}
                accessibilityRole="button"
                accessibilityLabel="Compare Pro plan"
              >
                <View style={styles.planIcon}>
                  <TargetIcon size={18} color={Colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.planName}>Pro</Text>
                <Text style={styles.planText}>100 credits/month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={comparePlans}
                activeOpacity={0.84}
                style={[styles.planTile, styles.eliteTile, isCompact && styles.planTileCompact]}
                accessibilityRole="button"
                accessibilityLabel="Compare Elite plan"
              >
                <View style={[styles.planIcon, styles.eliteIcon]}>
                  <TrophyIcon size={18} color={Colors.onPrimary} strokeWidth={2.2} />
                </View>
                <Text style={styles.planName}>Elite</Text>
                <Text style={styles.planText}>300 credits/month</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={comparePlans} activeOpacity={0.82}>
            <Text style={styles.helper}>Tap a plan to compare monthly credits and AP rubric feedback.</Text>
          </TouchableOpacity>
          <Pressable
            onPress={onClose}
            onPressIn={() => {
              Animated.spring(buttonScale, {
                toValue: 0.97,
                tension: 260,
                friction: 16,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(buttonScale, {
                toValue: 1,
                tension: 220,
                friction: 14,
                useNativeDriver: true,
              }).start();
            }}
            style={({ pressed }) => [styles.primaryPressable, pressed && styles.primaryPressablePressed]}
          >
            <Animated.View style={[styles.primaryBtn, { transform: [{ scale: buttonScale }] }]}>
            <Text style={styles.primaryText}>Got it</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 24, 32, 0.46)',
    padding: 22,
  },
  overlayCompact: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 22,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    overflow: 'hidden',
  },
  cardCompact: {
    maxWidth: 390,
    borderRadius: 26,
    padding: 16,
    gap: 11,
  },
  bgGlyph: {
    position: 'absolute',
    right: -38,
    bottom: -70,
    color: Colors.primaryDim,
    fontFamily: undefined,
    fontSize: 188,
    lineHeight: 198,
    fontWeight: '700',
    opacity: 0.5,
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
  },
  kickerPill: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
  },
  kickerPillCompact: {
    minHeight: 32,
    paddingHorizontal: 12,
  },
  kickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexShrink: 0,
  },
  closeCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  kicker: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroRowCompact: {
    alignItems: 'center',
    gap: 12,
  },
  usageOrb: {
    width: 96,
    height: 96,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    flexShrink: 0,
  },
  usageOrbCompact: {
    width: 72,
    height: 72,
    borderRadius: 22,
  },
  usageValue: {
    color: Colors.onPrimary,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
  },
  usageValueCompact: {
    fontSize: 32,
    lineHeight: 36,
  },
  usageLimit: {
    color: Colors.onPrimary,
    opacity: 0.78,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 17,
  },
  usageLimitCompact: {
    fontSize: 14,
    marginTop: 12,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  title: {
    color: Colors.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
  },
  titleCompact: {
    fontSize: 25,
    lineHeight: 29,
  },
  body: {
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  bodyCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  upgradeBox: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
    gap: 11,
  },
  upgradeBoxCompact: {
    padding: 12,
    borderRadius: 22,
  },
  upgradeLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  upgradeLabelCompact: {
    fontSize: 14,
  },
  planRow: {
    flexDirection: 'row',
    gap: 10,
  },
  planRowCompact: {
    gap: 8,
  },
  planTile: {
    flex: 1,
    minHeight: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 12,
    gap: 6,
  },
  planTileCompact: {
    minHeight: 82,
    borderRadius: 16,
    padding: 10,
  },
  eliteTile: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryDim,
  },
  planIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDim,
  },
  eliteIcon: {
    backgroundColor: Colors.primary,
  },
  planName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  planText: {
    color: Colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  helper: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    borderBottomWidth: 5,
    borderBottomColor: '#A93425',
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryPressable: {
    borderRadius: 18,
  },
  primaryPressablePressed: {
    opacity: 0.96,
    transform: [{ translateY: 2 }],
  },
  primaryText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
});
