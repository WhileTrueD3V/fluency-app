import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { BookOpenIcon, HomeIcon, TargetIcon, XIcon } from '@/components/Icons';
import { KibboLogo } from '@/components/KibboLogo';
import { getStartingLevelProfile, type StartingLevelProfile } from '@/utils/storage';

export const APP_COMPACT_BREAKPOINT = 900;
export const DESKTOP_RAIL_WIDTH = 232;
export const DESKTOP_RAIL_NARROW_WIDTH = 104;
export const DESKTOP_RAIL_NARROW_BREAKPOINT = 1040;

const WEB_FIXED_FOOTER_STYLE = Platform.OS === 'web'
  ? ({ position: 'fixed', left: 12, right: 12, bottom: 8 } as unknown as ViewStyle)
  : null;

export function isCompactWidth(width: number) {
  return width < APP_COMPACT_BREAKPOINT;
}

export function getDesktopRailWidth(width: number) {
  if (isCompactWidth(width)) return 0;
  return width < DESKTOP_RAIL_NARROW_BREAKPOINT ? DESKTOP_RAIL_NARROW_WIDTH : DESKTOP_RAIL_WIDTH;
}

export function getDesktopContentInsets(width: number, options?: { wideGap?: number; narrowGap?: number; right?: number }) {
  if (isCompactWidth(width)) {
    return { paddingLeft: 0, paddingRight: 0 };
  }

  const railWidth = getDesktopRailWidth(width);
  const gap = width < DESKTOP_RAIL_NARROW_BREAKPOINT ? (options?.narrowGap ?? 18) : (options?.wideGap ?? 82);
  const right = width < DESKTOP_RAIL_NARROW_BREAKPOINT ? Math.min(options?.right ?? 34, 24) : (options?.right ?? 34);
  return {
    paddingLeft: railWidth + gap,
    paddingRight: right,
  };
}

export type FooterTarget = {
  key: string;
  label: string;
  href: '/' | '/library' | '/mock';
  icon: (focused: boolean, size: number) => React.ReactNode;
};

const DRILL_PATHS = [
  '/ap/reading',
  '/ap/texting',
  '/ap/conversation',
  '/listening/session',
  '/speaking',
  '/speaking/translation',
  '/speaking/pronunciation',
];

const DIRECT_FOOTER_PATHS = [
  '/development',
];

const MAIN_FOOTER_PATHS = [
  '/',
  '/library',
  '/mock',
  '/(home)',
  '/(home)/library',
  '/(home)/mock',
];

export const FOOTER_TARGETS: FooterTarget[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/',
    icon: (focused, size) => (
      <HomeIcon size={size} color={focused ? Colors.primary : Colors.textMuted} strokeWidth={focused ? 2.4 : 2} />
    ),
  },
  {
    key: 'library',
    label: 'Library',
    href: '/library',
    icon: (focused, size) => (
      <BookOpenIcon size={size} color={focused ? Colors.primary : Colors.textMuted} strokeWidth={focused ? 2.4 : 2} />
    ),
  },
  {
    key: 'mock',
    label: 'Mock',
    href: '/mock',
    icon: (focused, size) => (
      <TargetIcon size={size} color={focused ? Colors.primary : Colors.textMuted} strokeWidth={focused ? 2.4 : 2} />
    ),
  },
];

export function FooterTabBar({
  pathname,
  onPressTarget,
  floating = false,
}: {
  pathname: string;
  onPressTarget: (target: FooterTarget) => void;
  floating?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isCompact = isCompactWidth(width);

  return (
    <View style={[styles.bar, isCompact && styles.barCompact, isCompact && floating && styles.barCompactFloating]}>
      {FOOTER_TARGETS.map((target) => {
        const focused = pathname === target.href || (target.href !== '/' && pathname.startsWith(target.href));
        const iconSize = isCompact ? 25 : 24;
        return (
          <TouchableOpacity
            key={target.key}
            onPress={() => onPressTarget(target)}
            activeOpacity={0.82}
            hitSlop={8}
            style={[styles.item, isCompact && styles.itemCompact, isCompact && focused && styles.itemCompactActive]}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${target.label}`}
          >
            <View style={[styles.iconSlot, isCompact && styles.iconSlotCompact, focused && styles.iconSlotActive]}>
              {target.icon(focused, iconSize)}
            </View>
            <Text style={[styles.label, isCompact && styles.labelCompact, focused && styles.labelActive]}>{target.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function DesktopSideRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isCompact = isCompactWidth(width);
  const railWidth = getDesktopRailWidth(width);
  const isNarrowRail = railWidth === DESKTOP_RAIL_NARROW_WIDTH;

  if (isCompact) return null;

  return (
    <View style={[styles.desktopRail, { width: railWidth }, isNarrowRail && styles.desktopRailNarrow]}>
      <View style={[styles.desktopBrandBlock, isNarrowRail && styles.desktopBrandBlockNarrow]}>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Go to Home"
          style={[styles.desktopLogoButton, isNarrowRail && styles.desktopLogoButtonNarrow]}
        >
          <KibboLogo size={isNarrowRail ? 'sm' : 'md'} singleLine={!isNarrowRail} markOnly={isNarrowRail} style={styles.desktopLogo} />
        </TouchableOpacity>
        {!isNarrowRail && (
          <View style={styles.desktopEditionPill}>
            <View style={styles.desktopEditionDot} />
            <Text style={styles.desktopEditionText}>AP Edition</Text>
          </View>
        )}
      </View>
      <View style={[styles.desktopNav, isNarrowRail && styles.desktopNavNarrow]}>
        {FOOTER_TARGETS.map((target) => {
          const focused = pathname === target.href || (target.href !== '/' && pathname.startsWith(target.href));
          return (
            <TouchableOpacity
              key={target.key}
              onPress={() => router.replace(target.href)}
              activeOpacity={0.82}
              style={[styles.desktopItem, isNarrowRail && styles.desktopItemNarrow, focused && styles.desktopItemActive]}
              accessibilityRole="button"
              accessibilityLabel={`Go to ${target.label}`}
            >
              <View style={[styles.desktopIconSlot, focused && styles.desktopIconSlotActive]}>
                {target.icon(focused, 23)}
              </View>
              {!isNarrowRail && <Text style={[styles.desktopLabel, focused && styles.desktopLabelActive]}>{target.label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function AppFooterTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ hideFooter?: string }>();
  const { width } = useWindowDimensions();
  const isCompact = isCompactWidth(width);
  const [startingLevelProfile, setStartingLevelProfile] = useState<StartingLevelProfile | null | undefined>(undefined);
  const isDrillRoute = useMemo(
    () => DRILL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
    [pathname],
  );
  const isDirectFooterRoute = useMemo(
    () => DIRECT_FOOTER_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
    [pathname],
  );
  const isMainFooterRoute = useMemo(
    () => MAIN_FOOTER_PATHS.some((path) => pathname === path),
    [pathname],
  );
  const isMobileDemoShell = Platform.OS === 'web'
    && typeof window !== 'undefined'
    && window.location.pathname.includes('/__mobile-demo');

  useEffect(() => {
    if (!isMainFooterRoute) {
      setStartingLevelProfile(undefined);
      return undefined;
    }

    let mounted = true;
    let interval: ReturnType<typeof setInterval> | undefined;
    const refreshStartingProfile = () => {
      getStartingLevelProfile().then((profile) => {
        if (!mounted) return;
        setStartingLevelProfile(profile);
        if (profile && interval) {
          clearInterval(interval);
          interval = undefined;
        }
      });
    };

    refreshStartingProfile();
    interval = setInterval(refreshStartingProfile, 450);
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [isMainFooterRoute]);

  if (!isDrillRoute && !isDirectFooterRoute && !isMainFooterRoute) return null;
  if (isMobileDemoShell) return null;
  if (!isCompact) return null;
  if (Platform.OS === 'web' && params.hideFooter === '1') return null;
  if (isMainFooterRoute && startingLevelProfile == null) return null;

  const goToTarget = (target: FooterTarget) => {
    router.replace(target.href);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, isCompact && styles.wrapCompact, isCompact && WEB_FIXED_FOOTER_STYLE]}>
      <FooterTabBar
        floating
        pathname={pathname}
        onPressTarget={goToTarget}
      />
    </View>
  );
}

export function DrillLeaveConfirm({
  visible,
  leaveLabel = 'Leave drill',
  onCancel,
  onLeave,
}: {
  visible: boolean;
  leaveLabel?: string;
  onCancel: () => void;
  onLeave: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const isCompact = isCompactWidth(width);
  const compactMaxHeight = Math.max(320, height - 96);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onCancel}>
      <View style={[styles.modalShade, isCompact && styles.modalShadeCompact]}>
        <View style={[styles.modalCard, isCompact && styles.modalCardCompact, isCompact && { maxHeight: compactMaxHeight }]}>
          <Text style={[styles.modalGlyph, isCompact && styles.modalGlyphCompact]}>中</Text>
          <View style={styles.modalTop}>
            <View style={styles.modalKickerPill}>
              <Text style={styles.modalKicker}>In progress</Text>
            </View>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.modalClose}
              accessibilityLabel="Keep practicing"
            >
              <XIcon size={18} color={Colors.textMuted} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalTitle, isCompact && styles.modalTitleCompact]}>Leave this drill?</Text>
          <Text style={[styles.modalText, isCompact && styles.modalTextCompact]}>
            Your current answers will be discarded and XP will not be awarded.
          </Text>
          <View style={[styles.modalInfoBox, isCompact && styles.modalInfoBoxCompact]}>
            <Text style={styles.modalInfoTitle}>Library saves are safe</Text>
            <Text style={styles.modalInfoText}>Anything you already saved stays in Library for review.</Text>
          </View>
          <View style={[styles.modalActions, isCompact && styles.modalActionsCompact]}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.84} style={[styles.stayBtn, isCompact && styles.stayBtnCompact]}>
              <Text style={styles.stayText}>Keep practicing</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onLeave} activeOpacity={0.84} style={[styles.leaveBtn, isCompact && styles.leaveBtnCompact]}>
              <Text style={styles.leaveText}>{leaveLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 36,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  wrapCompact: {
    bottom: 8,
    left: 12,
    right: 12,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#101820',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 36,
  },
  desktopRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 232,
    zIndex: 80,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingTop: 36,
    paddingHorizontal: 20,
    shadowColor: '#101820',
    shadowOpacity: 0.035,
    shadowRadius: 18,
    shadowOffset: { width: 6, height: 0 },
  },
  desktopRailNarrow: {
    paddingTop: 28,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  desktopBrandBlock: {
    minHeight: 88,
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  desktopBrandBlockNarrow: {
    minHeight: 62,
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  desktopLogo: {
    alignSelf: 'flex-start',
  },
  desktopLogoButton: {
    alignSelf: 'flex-start',
  },
  desktopLogoButtonNarrow: {
    alignSelf: 'center',
  },
  desktopEditionPill: {
    alignSelf: 'flex-start',
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
  },
  desktopEditionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  desktopEditionText: {
    color: Colors.text,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  desktopNav: {
    marginTop: 42,
    gap: 10,
  },
  desktopNavNarrow: {
    width: '100%',
    marginTop: 26,
    alignItems: 'center',
  },
  desktopItem: {
    minHeight: 58,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  desktopItemNarrow: {
    width: 64,
    minHeight: 58,
    justifyContent: 'center',
    gap: 0,
    paddingHorizontal: 0,
  },
  desktopItemActive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  desktopIconSlot: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopIconSlotActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#101820',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  desktopLabel: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  desktopLabelActive: {
    color: Colors.text,
  },
  bar: {
    width: '100%',
    height: 108,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 24,
  },
  barCompact: {
    height: 76,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderTopWidth: 0,
    backgroundColor: 'transparent',
  },
  barCompactFloating: {
    transform: [{ translateY: 0 }],
  },
  item: {
    minWidth: 72,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingTop: 4,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  itemCompact: {
    minHeight: 62,
    minWidth: 82,
    borderRadius: 22,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 1,
    justifyContent: 'center',
  },
  itemCompactActive: {
    backgroundColor: Colors.primaryDim,
  },
  iconSlot: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotCompact: {
    width: 48,
    height: 38,
    borderRadius: 19,
  },
  iconSlotActive: {
    backgroundColor: '#FFFFFF',
  },
  label: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    lineHeight: 16,
    marginTop: 0,
    textTransform: 'uppercase',
  },
  labelActive: {
    color: Colors.primary,
  },
  labelCompact: {
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0,
    textTransform: 'none',
  },
  modalShade: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 24, 32, 0.42)',
    padding: 24,
  },
  modalShadeCompact: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingTop: 46,
    paddingBottom: 46,
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 28,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
    gap: 13,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    overflow: 'hidden',
  },
  modalCardCompact: {
    maxWidth: 390,
    borderRadius: 24,
    padding: 14,
    gap: 9,
  },
  modalGlyph: {
    position: 'absolute',
    right: -24,
    bottom: -54,
    color: Colors.primaryDim,
    fontFamily: undefined,
    fontSize: 150,
    lineHeight: 160,
    fontWeight: '700',
    opacity: 0.55,
    transform: [{ rotate: '-10deg' }],
  },
  modalGlyphCompact: {
    right: -28,
    bottom: -46,
    fontSize: 124,
    lineHeight: 136,
    opacity: 0.46,
  },
  modalTop: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalKickerPill: {
    minHeight: 31,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  modalKicker: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 0,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
  },
  modalTitleCompact: {
    fontSize: 23,
    lineHeight: 27,
  },
  modalText: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
  },
  modalTextCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  modalInfoBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
    gap: 4,
  },
  modalInfoBoxCompact: {
    borderRadius: 15,
    padding: 10,
  },
  modalInfoTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  modalInfoText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  modalActions: {
    gap: 10,
    marginTop: 4,
  },
  modalActionsCompact: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 1,
  },
  stayBtn: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  stayBtnCompact: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  stayText: {
    color: Colors.textSub,
    fontSize: 15,
    fontWeight: '900',
  },
  leaveBtn: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
  },
  leaveBtnCompact: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  leaveText: {
    color: Colors.onPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
});
