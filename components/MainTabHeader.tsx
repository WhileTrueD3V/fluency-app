import React from 'react';
import { Alert, Animated, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand } from '@/constants/brand';
import { Colors } from '@/constants/colors';
import { APP_COMPACT_BREAKPOINT } from '@/components/AppFooterTabs';
import { CheckIcon, ChevronRightIcon, FlameIcon, StarIcon, TargetIcon, TrophyIcon, SettingsIcon, SwitchIcon, XIcon } from '@/components/Icons';
import { KibboLogo } from '@/components/KibboLogo';
import {
  changeSubscriptionPlan,
  getAppSettings,
  getCreditUsage,
  getSubscriptionPlan,
  saveAppSettings,
  SUBSCRIPTION_PLANS,
  type AppSettings,
  type ReadingTextSize,
  type SubscriptionPlanId,
} from '@/utils/storage';

export function MainTabHeader({
  streak,
  onSwitch,
  openSubscriptionsSignal = 0,
  onSubscriptionChange,
}: {
  streak: number;
  onSwitch: () => void;
  openSubscriptionsSignal?: number;
  onSubscriptionChange?: () => void;
}) {
  const [settingsVisible, setSettingsVisible] = React.useState(false);
  const [streakVisible, setStreakVisible] = React.useState(false);
  const [openSubscriptionsInitially, setOpenSubscriptionsInitially] = React.useState(false);

  React.useEffect(() => {
    if (!openSubscriptionsSignal) return;
    setOpenSubscriptionsInitially(true);
    setSettingsVisible(true);
  }, [openSubscriptionsSignal]);

  const openSettings = () => {
    setOpenSubscriptionsInitially(false);
    setSettingsVisible(true);
  };

  const closeSettings = () => {
    setSettingsVisible(false);
    setOpenSubscriptionsInitially(false);
  };

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setStreakVisible(true)}
            style={styles.streakPill}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="Open streak details"
          >
            <FlameIcon size={25} color={Colors.primary} strokeWidth={2.25} />
            <Text style={styles.streakPillText}>{streak || 0} {streak === 1 ? 'day' : 'days'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSwitch} style={styles.switchBtn} activeOpacity={0.82}>
            <SwitchIcon size={17} color={Colors.textSub} strokeWidth={2} />
            <Text style={styles.switchText}>Switch</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openSettings}
            style={styles.settingsBtn}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <SettingsIcon size={22} color={Colors.textSub} strokeWidth={2.1} />
          </TouchableOpacity>
        </View>
      </View>
      <StreakMenu streak={streak || 0} visible={streakVisible} onClose={() => setStreakVisible(false)} />
      <SettingsMenu
        visible={settingsVisible}
        openSubscriptionsInitially={openSubscriptionsInitially}
        onSubscriptionChange={onSubscriptionChange}
        onClose={closeSettings}
      />
    </>
  );
}

export function MobileTabHeader({
  streak,
  onSwitch,
  openSubscriptionsSignal = 0,
  onSubscriptionChange,
}: {
  streak: number;
  onSwitch: () => void;
  openSubscriptionsSignal?: number;
  onSubscriptionChange?: () => void;
}) {
  const router = useRouter();
  const [settingsVisible, setSettingsVisible] = React.useState(false);
  const [streakVisible, setStreakVisible] = React.useState(false);
  const [openSubscriptionsInitially, setOpenSubscriptionsInitially] = React.useState(false);

  React.useEffect(() => {
    if (!openSubscriptionsSignal) return;
    setOpenSubscriptionsInitially(true);
    setSettingsVisible(true);
  }, [openSubscriptionsSignal]);

  const openSettings = () => {
    setOpenSubscriptionsInitially(false);
    setSettingsVisible(true);
  };

  const closeSettings = () => {
    setSettingsVisible(false);
    setOpenSubscriptionsInitially(false);
  };

  return (
    <>
      <View style={styles.mobileHeader}>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Go to Home"
          style={styles.mobileLogoButton}
        >
          <KibboLogo size="sm" singleLine />
        </TouchableOpacity>
        <View style={styles.mobileActions}>
          <TouchableOpacity
            onPress={() => setStreakVisible(true)}
            activeOpacity={0.84}
            style={styles.mobilePill}
            accessibilityRole="button"
            accessibilityLabel="Open streak details"
          >
            <FlameIcon size={23} color={Colors.primary} strokeWidth={2.3} />
            <Text style={styles.mobilePillText}>{streak || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSwitch} activeOpacity={0.82} style={styles.mobileSwitchBtn} accessibilityLabel="Switch language">
            <SwitchIcon size={22} color={Colors.textSub} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openSettings}
            activeOpacity={0.82}
            style={styles.mobileSettingsBtn}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <SettingsIcon size={23} color={Colors.textSub} strokeWidth={2.15} />
          </TouchableOpacity>
        </View>
      </View>
      <StreakMenu streak={streak || 0} visible={streakVisible} onClose={() => setStreakVisible(false)} />
      <SettingsMenu
        visible={settingsVisible}
        openSubscriptionsInitially={openSubscriptionsInitially}
        onSubscriptionChange={onSubscriptionChange}
        onClose={closeSettings}
      />
    </>
  );
}

function SoftModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={[styles.settingsShade, isCompact && styles.settingsShadeCompact]}>
        <View style={styles.modalMotion}>
          <TouchableOpacity activeOpacity={1} onPress={(event) => event.stopPropagation()}>
            {children}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function StreakMenu({
  streak,
  visible,
  onClose,
}: {
  streak: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const activeDays = Math.min(5, Math.max(0, streak));
  const weekDays = ['M', 'T', 'W', 'T', 'F'];

  return (
    <SoftModal visible={visible} onClose={onClose}>
      <View style={[styles.streakCard, isCompact && styles.streakCardCompact]}>
        <View style={styles.streakTop}>
          <View style={styles.streakHeroIcon}>
            <FlameIcon size={34} color={Colors.primary} strokeWidth={2.35} />
          </View>
          <TouchableOpacity onPress={onClose} style={styles.settingsClose} accessibilityLabel="Close streak details">
            <XIcon size={18} color={Colors.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.streakCopy}>
          <Text style={styles.settingsKicker}>Study streak</Text>
          <Text style={[styles.streakTitle, isCompact && styles.streakTitleCompact]}>
            {streak > 0 ? `${streak} ${streak === 1 ? 'day' : 'days'} warm` : 'Start today'}
          </Text>
          <Text style={styles.streakBody}>
            Finish any AP drill or Mini Mock part to keep your practice chain alive. Library review stays useful, but practice sessions grow the streak.
          </Text>
        </View>

        <View style={styles.streakWeek}>
          {weekDays.map((day, index) => {
            const active = index < activeDays;
            const today = index === Math.max(0, activeDays - 1);
            return (
              <View key={`${day}-${index}`} style={styles.streakDayWrap}>
                <View style={[styles.streakDay, active && styles.streakDayActive, today && styles.streakDayToday]}>
                  {active ? <CheckIcon size={16} color={Colors.onPrimary} strokeWidth={2.6} /> : <Text style={styles.streakDayDot}>·</Text>}
                </View>
                <Text style={[styles.streakDayLabel, active && styles.streakDayLabelActive]}>{day}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.streakNextCard}>
          <Text style={styles.streakNextLabel}>Next goal</Text>
          <Text style={styles.streakNextText}>
            {streak > 0 ? 'Complete one focused set tomorrow.' : 'Complete one focused set to begin the chain.'}
          </Text>
        </View>

        <TouchableOpacity onPress={onClose} activeOpacity={0.86} style={styles.streakDoneBtn}>
          <Text style={styles.streakDoneText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </SoftModal>
  );
}

function CurrentPlanHero({
  activePlanId,
  activePlan,
  creditsLimitLabel,
  pendingPlan,
  onPress,
}: {
  activePlanId: SubscriptionPlanId;
  activePlan: ReturnType<typeof getSubscriptionPlan>;
  creditsLimitLabel: string;
  pendingPlan?: ReturnType<typeof getSubscriptionPlan> | null;
  onPress?: () => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const normalizedPlanId = activePlanId === 'premium' ? 'elite' : activePlanId;
  const heroStyle = normalizedPlanId === 'elite'
    ? {
      glyph: '極',
      hero: styles.subscriptionHeroElite,
      badge: styles.planBadgeElite,
      glyphStyle: styles.planHeroGlyphElite,
      icon: <TrophyIcon size={isCompact ? 22 : 28} color={Colors.onPrimary} strokeWidth={2.2} />,
    }
    : activePlanId === 'pro'
      ? {
        glyph: '伸',
        hero: styles.subscriptionHeroPro,
        badge: styles.planBadgePro,
        glyphStyle: styles.planHeroGlyphPro,
        icon: <TargetIcon size={isCompact ? 22 : 28} color={Colors.onPrimary} strokeWidth={2.2} />,
      }
      : {
        glyph: '始',
        hero: styles.subscriptionHeroBasic,
        badge: styles.planBadgeBasic,
        glyphStyle: styles.planHeroGlyphBasic,
        icon: <StarIcon size={isCompact ? 21 : 27} color={Colors.onPrimary} strokeWidth={2.2} />,
      };

  const content = (
    <>
      <Text style={[styles.planHeroGlyph, heroStyle.glyphStyle, isCompact && styles.planHeroGlyphCompact]}>{heroStyle.glyph}</Text>
      <View style={[styles.planHeroCopy, isCompact && styles.planHeroCopyCompact]}>
        <Text style={[styles.settingsSectionLabel, styles.subscriptionHeroLabel]}>Current plan</Text>
        <Text style={[styles.planHeroName, isCompact && styles.planHeroNameCompact]}>{activePlan.name}</Text>
        <Text style={[styles.planHeroText, isCompact && styles.planHeroTextCompact]} numberOfLines={isCompact ? 2 : undefined}>
          {creditsLimitLabel} · {activePlan.aiFeedback} AP coach
        </Text>
        {pendingPlan && pendingPlan.id !== activePlan.id && (
          <Text style={styles.planHeroPending}>Switches to {pendingPlan.name} at cycle end.</Text>
        )}
      </View>
      <View style={[styles.planBadge, isCompact && styles.planBadgeCompact, heroStyle.badge]}>
        {heroStyle.icon}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={[styles.subscriptionHero, isCompact && styles.subscriptionHeroCompact, heroStyle.hero]}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.subscriptionHero, isCompact && styles.subscriptionHeroCompact, heroStyle.hero]}>
      {content}
    </View>
  );
}

function monthlyPriceValue(price: string) {
  const match = price.match(/\$([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
}

function planDailyPriceLabel(price: string) {
  const value = monthlyPriceValue(price);
  if (!value) return 'No monthly charge';
  return `about $${(value / 30).toFixed(2)}/day`;
}

function planCreditValueLabel(price: string, credits: number) {
  const value = monthlyPriceValue(price);
  if (!value || credits <= 0) return 'Starter access';
  return `$${(value / credits).toFixed(2)}/credit`;
}

function SettingsMenu({
  visible,
  openSubscriptionsInitially = false,
  onSubscriptionChange,
  onClose,
}: {
  visible: boolean;
  openSubscriptionsInitially?: boolean;
  onSubscriptionChange?: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const modalMaxHeight = Math.max(320, height - (isCompact ? 52 : 64));
  const [settings, setSettings] = React.useState<AppSettings | null>(null);
  const [creditsSpent, setCreditsSpent] = React.useState(0);
  const [subscriptionsVisible, setSubscriptionsVisible] = React.useState(false);

  const activePlan = getSubscriptionPlan(settings?.subscriptionPlan ?? 'basic');
  const pendingPlan = settings?.pendingSubscriptionPlan ? getSubscriptionPlan(settings.pendingSubscriptionPlan) : null;
  const creditsRemaining = Math.max(0, activePlan.creditAllowance - creditsSpent);
  const creditsLimitLabel = activePlan.creditCadence === 'starter'
    ? `${creditsRemaining}/${activePlan.creditAllowance} starter credits`
    : `${creditsRemaining}/${activePlan.creditAllowance} credits this month`;

  React.useEffect(() => {
    if (!visible) return;
    let mounted = true;
    Promise.all([getAppSettings(), getCreditUsage()]).then(([nextSettings, usage]) => {
      if (!mounted) return;
      setSettings(nextSettings);
      setCreditsSpent(usage.creditsSpent);
    });
    return () => {
      mounted = false;
    };
  }, [visible]);

  React.useEffect(() => {
    if (!visible || !openSubscriptionsInitially) return;
    setSubscriptionsVisible(true);
  }, [openSubscriptionsInitially, visible]);

  const closeSettingsMenu = () => {
    setSubscriptionsVisible(false);
    onClose();
  };

  const closeSubscriptions = () => {
    setSubscriptionsVisible(false);
    if (openSubscriptionsInitially) onClose();
  };

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const updated = await saveAppSettings(patch);
    setSettings(updated);
  };

  const selectPlan = async (planId: SubscriptionPlanId) => {
    const result = await changeSubscriptionPlan(planId);
    setSettings(result.settings);
    setCreditsSpent(result.usage.creditsSpent);
    onSubscriptionChange?.();
    if (result.scheduledDowngrade) {
      Alert.alert(
        'Downgrade scheduled',
        `${result.plan.name} stays active until this billing cycle ends. Your credits stay available until then.`,
      );
    }
  };

  const selectReadingTextSize = async (readingTextSize: ReadingTextSize) => {
    await updateSettings({ readingTextSize });
  };

  const shareApp = async () => {
    try {
      await Share.share({
        title: Brand.edition,
        message: `Try ${Brand.edition} for AP Japanese practice: listening, reading, speaking, text chat, and Mini Mock prep.`,
      });
    } catch {
      Alert.alert('Share unavailable', 'Sharing is not available on this device right now.');
    }
  };

  const openLegalScreen = (pathname: '/legal/privacy' | '/legal/terms') => {
    closeSettingsMenu();
    const runtime = globalThis as typeof globalThis & { setTimeout?: typeof setTimeout };
    runtime.setTimeout?.(() => {
      router.push({ pathname } as never);
    }, 80);
  };

  return (
    <>
      <SoftModal visible={visible} onClose={closeSettingsMenu}>
        <View style={[styles.settingsCard, { maxHeight: modalMaxHeight }, isCompact && styles.settingsCardCompact]}>
          <Text style={styles.settingsBgGlyph}>設</Text>
          <View style={[styles.settingsTop, isCompact && styles.settingsTopCompact]}>
            <View style={[styles.settingsTopBadge, isCompact && styles.settingsTopBadgeCompact]}>
              <SettingsIcon size={24} color={Colors.onPrimary} strokeWidth={2.25} />
            </View>
            <View style={styles.settingsTopCopy}>
              <Text style={styles.settingsKicker}>Kibbo settings</Text>
              <Text style={[styles.settingsTitle, isCompact && styles.settingsTitleCompact]}>Control center</Text>
              <Text style={[styles.settingsTopSubtitle, isCompact && styles.settingsTopSubtitleCompact]}>Tune the coach, credits, and reading comfort without leaving today’s work.</Text>
            </View>
              <TouchableOpacity onPress={closeSettingsMenu} style={[styles.settingsClose, isCompact && styles.settingsCloseCompact]} accessibilityLabel="Close settings">
                <XIcon size={18} color={Colors.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.settingsScroll}
              contentContainerStyle={[styles.settingsScrollContent, isCompact && styles.settingsScrollContentCompact]}
              showsVerticalScrollIndicator={false}
            >
              <CurrentPlanHero
                activePlanId={settings?.subscriptionPlan ?? 'basic'}
                activePlan={activePlan}
                creditsLimitLabel={creditsLimitLabel}
                pendingPlan={pendingPlan}
                onPress={() => setSubscriptionsVisible(true)}
              />

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>Reading text</Text>
                <View style={styles.segmented}>
                  {([
                    ['standard', 'Normal'],
                    ['large', 'Large'],
                    ['extraLarge', 'XL'],
                  ] as const).map(([value, label]) => {
                    const active = (settings?.readingTextSize ?? 'extraLarge') === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => selectReadingTextSize(value)}
                        activeOpacity={0.84}
                        style={[styles.segment, active && styles.segmentActive]}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.settingsHelper}>Applies to AP Reading passage text on mobile and desktop.</Text>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>Account</Text>
                <View style={styles.settingsList}>
                  <SettingActionRow
                    label="Subscriptions"
                    detail={`${activePlan.name} · ${creditsLimitLabel}`}
                    onPress={() => setSubscriptionsVisible(true)}
                  />
                  <SettingActionRow
                    label="Restore purchases"
                    detail="Recover an existing App Store plan"
                    onPress={() => Alert.alert('Restore purchases', 'This will recover an existing plan after App Store billing is connected.')}
                  />
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>App</Text>
                <View style={styles.settingsList}>
                  <SettingSwitchRow
                    label="Study reminders"
                    value={settings?.studyReminders ?? false}
                    onValueChange={(value) => updateSettings({ studyReminders: value })}
                  />
                  <SettingSwitchRow
                    label="Sound effects"
                    value={settings?.soundEffects ?? true}
                    onValueChange={(value) => updateSettings({ soundEffects: value })}
                  />
                  <SettingSwitchRow
                    label="Haptics"
                    value={settings?.haptics ?? true}
                    onValueChange={(value) => updateSettings({ haptics: value })}
                  />
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>Important</Text>
                <View style={styles.settingsList}>
                  <SettingActionRow label="Privacy policy" detail="Local-first preview policy" onPress={() => openLegalScreen('/legal/privacy')} />
                  <SettingActionRow label="Terms of use" detail="AI feedback and subscription preview terms" onPress={() => openLegalScreen('/legal/terms')} />
                  <SettingActionRow
                    label="AI disclosure"
                    detail="Feedback is coaching, not an official AP score"
                    onPress={() => Alert.alert('AI disclosure', `AI feedback can be useful but imperfect. ${Brand.name} estimates AP readiness for practice. ${Brand.collegeBoardDisclaimer}`)}
                  />
                  <SettingActionRow label="Share app" detail={`Send ${Brand.edition} to a friend`} onPress={shareApp} />
                </View>
              </View>
            </ScrollView>
        </View>
      </SoftModal>

      <SubscriptionMenu
        visible={subscriptionsVisible}
        settings={settings}
        activePlanId={settings?.subscriptionPlan ?? 'basic'}
        creditsLimitLabel={creditsLimitLabel}
        pendingPlan={pendingPlan}
        onClose={closeSubscriptions}
        onSelectPlan={selectPlan}
      />
    </>
  );
}

function SettingSwitchRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const slide = React.useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(slide, {
      toValue: value ? 1 : 0,
      tension: 190,
      friction: 18,
      useNativeDriver: true,
    }).start();
  }, [slide, value]);

  const thumbTranslateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 22],
  });

  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsRowText}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onValueChange(!value)}
        style={[styles.toggleTrack, value && styles.toggleTrackOn]}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      >
        <Animated.View
          style={[
            styles.toggleThumb,
            value && styles.toggleThumbOn,
            { transform: [{ translateX: thumbTranslateX }] },
          ]}
        />
      </TouchableOpacity>
    </View>
  );
}

function SubscriptionMenu({
  visible,
  settings,
  activePlanId,
  creditsLimitLabel,
  pendingPlan,
  onClose,
  onSelectPlan,
}: {
  visible: boolean;
  settings: AppSettings | null;
  activePlanId: SubscriptionPlanId;
  creditsLimitLabel: string;
  pendingPlan?: ReturnType<typeof getSubscriptionPlan> | null;
  onClose: () => void;
  onSelectPlan: (planId: SubscriptionPlanId) => void;
}) {
  const { width, height } = useWindowDimensions();
  const isCompact = width < APP_COMPACT_BREAKPOINT;
  const modalMaxHeight = Math.max(320, height - (isCompact ? 52 : 64));
  const activePlan = getSubscriptionPlan(activePlanId);

  return (
    <SoftModal visible={visible} onClose={onClose}>
      <View style={[styles.settingsCard, styles.subscriptionCard, { maxHeight: modalMaxHeight }, isCompact && styles.settingsCardCompact]}>
          <Text style={[styles.settingsBgGlyph, styles.subscriptionBgGlyph]}>料</Text>
          <View style={[styles.settingsTop, isCompact && styles.settingsTopCompact]}>
            <View style={[styles.settingsTopBadge, styles.subscriptionTopBadge, isCompact && styles.settingsTopBadgeCompact]}>
              <TrophyIcon size={24} color={Colors.onPrimary} strokeWidth={2.2} />
            </View>
            <View style={styles.settingsTopCopy}>
              <Text style={styles.settingsKicker}>Subscriptions</Text>
              <Text style={[styles.settingsTitle, isCompact && styles.settingsTitleCompact]}>More AP reps</Text>
              <Text style={[styles.settingsTopSubtitle, isCompact && styles.settingsTopSubtitleCompact]}>Credits buy coach-generated AP work, not a fixed lesson library.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.settingsClose, isCompact && styles.settingsCloseCompact]} accessibilityLabel="Close subscriptions">
              <XIcon size={18} color={Colors.textMuted} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.settingsScroll} contentContainerStyle={[styles.settingsScrollContent, isCompact && styles.settingsScrollContentCompact]} showsVerticalScrollIndicator={false}>
            <CurrentPlanHero activePlanId={activePlanId} activePlan={activePlan} creditsLimitLabel={creditsLimitLabel} pendingPlan={pendingPlan} />

            <View style={[styles.creditSalesHero, isCompact && styles.creditSalesHeroCompact]}>
              <View style={styles.creditSalesCopy}>
                <Text style={[styles.creditSalesKicker, isCompact && styles.creditSalesKickerCompact]}>Kibbo Credits</Text>
                <Text style={[styles.creditSalesTitle, isCompact && styles.creditSalesTitleCompact]}>Buy more coach-generated AP work.</Text>
                <Text style={[styles.creditSalesText, isCompact && styles.creditSalesTextCompact]}>
                  Credits spend only on generated drills, Mini Mocks, and rubric feedback. The goal is fewer random lessons and more work that targets your score path.
                </Text>
              </View>
              <View style={[styles.creditSalesOrb, isCompact && styles.creditSalesOrbCompact]}>
                <StarIcon size={26} color={Colors.onPrimary} strokeWidth={2.35} />
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionLabel}>Plans</Text>
              <View style={styles.planGrid}>
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const isActive = getSubscriptionPlan(settings?.subscriptionPlan ?? 'basic').id === plan.id;
                  const normalizedPlanId = plan.id === 'premium' ? 'elite' : plan.id;
                  const normalizedPendingPlanId = pendingPlan?.id === 'premium' ? 'elite' : pendingPlan?.id;
                  const isPending = normalizedPendingPlanId === normalizedPlanId && !isActive;
                  const creditLabel = plan.creditCadence === 'starter'
                    ? `${plan.creditAllowance} starter credits`
                    : `${plan.creditAllowance} credits/month`;
                  const dailyLabel = planDailyPriceLabel(plan.price);
                  const creditValueLabel = planCreditValueLabel(plan.price, plan.creditAllowance);
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      onPress={() => onSelectPlan(plan.id)}
                      activeOpacity={0.86}
                      style={[
                        styles.planCard,
                        normalizedPlanId === 'pro' && styles.planCardPro,
                        normalizedPlanId === 'elite' && styles.planCardElite,
                        isPending && styles.planCardPending,
                        isActive && styles.planCardActive,
                      ]}
                    >
                      <View style={styles.planCardTop}>
                        <View style={styles.planNameBlock}>
                          <Text style={[styles.planName, isActive && styles.planNameActive]}>{plan.name}</Text>
                          <View style={styles.planPillRow}>
                            {isActive && (
                              <View style={styles.planCurrentPill}>
                                <CheckIcon size={12} color={Colors.onPrimary} strokeWidth={2.6} />
                                <Text style={styles.planCurrentText}>Current plan</Text>
                              </View>
                            )}
                            {isPending && (
                              <View style={styles.planPendingPill}>
                                <Text style={styles.planPendingText}>Switches at cycle end</Text>
                              </View>
                            )}
                            {normalizedPlanId === 'elite' && (
                              <View style={styles.planPopularPill}>
                                <StarIcon size={12} color={Colors.onPrimary} strokeWidth={2.2} />
                                <Text style={styles.planPopularText}>Best value</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.planPriceBlock}>
                          <Text style={[styles.planPrice, isActive && styles.planPriceActive]}>{plan.price}</Text>
                          <Text style={[styles.planDailyPrice, isActive && styles.planDailyPriceActive]}>{dailyLabel}</Text>
                        </View>
                      </View>
                      <Text style={[styles.planSummary, isActive && styles.planSummaryActive]}>{plan.summary}</Text>
                      <View style={styles.planValueRow}>
                        <Text style={[styles.planLimit, isActive && styles.planLimitActive]}>{creditLabel}</Text>
                        <Text style={[styles.planCreditValue, isActive && styles.planCreditValueActive]}>{creditValueLabel}</Text>
                      </View>
                      <Text style={[styles.planFeedback, isActive && styles.planFeedbackActive]}>{plan.aiFeedback} AP coach feedback</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          </ScrollView>
      </View>
    </SoftModal>
  );
}

function SettingActionRow({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.settingsRow}>
      <View style={styles.settingsRowCopy}>
        <Text style={styles.settingsRowText}>{label}</Text>
        <Text style={styles.settingsRowDetail}>{detail}</Text>
      </View>
      <ChevronRightIcon size={18} color={Colors.textMuted} strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    padding: 5,
    shadowColor: '#101820',
    shadowOpacity: 0.055,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  streakPill: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    backgroundColor: Colors.primaryDim,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 15,
  },
  streakPillText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  switchBtn: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderRadius: 999,
    borderWidth: 0,
    paddingHorizontal: 12,
  },
  switchText: {
    color: Colors.textSub,
    fontSize: 14,
    fontWeight: '900',
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 0,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileHeader: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
    marginBottom: 10,
  },
  mobileLogoButton: {
    flexShrink: 0,
  },
  mobileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobilePill: {
    minHeight: 44,
    minWidth: 62,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    backgroundColor: Colors.primaryDim,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  mobilePillText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  mobileSwitchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileSettingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsShade: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 27, 45, 0.46)',
    padding: 24,
  },
  settingsShadeCompact: {
    justifyContent: 'center',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  modalMotion: {
    width: '100%',
    alignItems: 'center',
  },
  settingsCard: {
    width: '100%',
    maxWidth: 720,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: '#FFFFFFF7',
    padding: 24,
    gap: 18,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.24,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 20 },
  },
  subscriptionCard: {
    maxWidth: 760,
  },
  settingsCardCompact: {
    maxWidth: 390,
    borderRadius: 24,
    padding: 14,
    gap: 11,
  },
  settingsTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  settingsTopCompact: {
    gap: 10,
  },
  settingsTopCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  settingsTopBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    shadowColor: Colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  settingsTopBadgeCompact: {
    width: 44,
    height: 44,
    borderRadius: 16,
  },
  subscriptionTopBadge: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
  },
  settingsBgGlyph: {
    position: 'absolute',
    right: -34,
    top: 78,
    color: '#0F1B2D08',
    fontSize: 214,
    lineHeight: 230,
    fontWeight: '900',
    transform: [{ rotate: '-10deg' }],
  },
  subscriptionBgGlyph: {
    color: '#D947340B',
    top: 104,
  },
  settingsKicker: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  settingsTitle: {
    marginTop: 3,
    color: Colors.text,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
  },
  settingsTitleCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  settingsClose: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  settingsCloseCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  streakCard: {
    width: '100%',
    maxWidth: 470,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    padding: 24,
    gap: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
  },
  streakCardCompact: {
    maxWidth: 390,
    borderRadius: 24,
    padding: 16,
    gap: 13,
  },
  streakTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  streakHeroIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCopy: {
    gap: 5,
  },
  streakTitle: {
    color: Colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  streakTitleCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  streakBody: {
    color: Colors.textSub,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
  },
  streakWeek: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  streakDayWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  streakDay: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  streakDayToday: {
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  streakDayDot: {
    color: Colors.textMuted,
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '900',
  },
  streakDayLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  streakDayLabelActive: {
    color: Colors.text,
  },
  streakNextCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondaryDim,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  streakNextLabel: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  streakNextText: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  streakDoneBtn: {
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 5,
    borderBottomColor: '#A93425',
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  streakDoneText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  settingsIntro: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  settingsScroll: {
    width: '100%',
    flexShrink: 1,
    minHeight: 0,
  },
  settingsScrollContent: {
    gap: 18,
    paddingBottom: 10,
  },
  settingsScrollContentCompact: {
    gap: 16,
    paddingBottom: 4,
  },
  subscriptionHero: {
    borderRadius: 24,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    overflow: 'hidden',
  },
  subscriptionHeroCompact: {
    minHeight: 88,
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 10,
  },
  subscriptionHeroBasic: {
    backgroundColor: '#F4F7FA',
  },
  subscriptionHeroPro: {
    backgroundColor: '#FFF7F4',
    borderColor: Colors.primaryGlow,
  },
  subscriptionHeroElite: {
    backgroundColor: '#EDF8F7',
    borderColor: '#BEE8E5',
  },
  creditSalesHero: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.ink,
    padding: 18,
    minHeight: 142,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  creditSalesHeroCompact: {
    minHeight: 0,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  creditSalesCopy: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  creditSalesKicker: {
    color: Colors.onPrimaryMuted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  creditSalesKickerCompact: {
    fontSize: 10,
    letterSpacing: 1.8,
  },
  creditSalesTitle: {
    color: Colors.onPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  creditSalesTitleCompact: {
    fontSize: 20,
    lineHeight: 24,
  },
  creditSalesText: {
    color: Colors.onPrimaryMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  creditSalesTextCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  creditSalesOrb: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  creditSalesOrbCompact: {
    width: 58,
    height: 58,
    borderRadius: 20,
  },
  planHeroGlyph: {
    position: 'absolute',
    right: -18,
    bottom: -46,
    color: 'rgba(255, 248, 237, 0.13)',
    fontFamily: undefined,
    fontSize: 154,
    lineHeight: 168,
    fontWeight: '700',
    transform: [{ rotate: '-8deg' }],
  },
  planHeroGlyphCompact: {
    right: -28,
    bottom: -36,
    fontSize: 118,
    lineHeight: 130,
  },
  planHeroGlyphBasic: {
    color: 'rgba(255, 248, 237, 0.12)',
  },
  planHeroGlyphPro: {
    color: 'rgba(255, 248, 237, 0.16)',
    right: -4,
    bottom: -52,
  },
  planHeroGlyphElite: {
    color: 'rgba(255, 248, 237, 0.20)',
    right: -2,
    bottom: -58,
    fontSize: 170,
  },
  planHeroCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  planHeroCopyCompact: {
    paddingRight: 2,
  },
  planHeroName: {
    marginTop: 4,
    color: '#101820',
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  planHeroNameCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  subscriptionHeroEliteText: {
    color: Colors.onPrimary,
  },
  planHeroText: {
    marginTop: 4,
    color: '#586273',
    opacity: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  planHeroTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  planHeroPending: {
    marginTop: 7,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BEE8E5',
    backgroundColor: '#EFFFFD',
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planBadge: {
    width: 58,
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planBadgeCompact: {
    width: 50,
    height: 48,
    borderRadius: 18,
  },
  planBadgeBasic: {
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 248, 237, 0.10)',
  },
  planBadgePro: {
    borderColor: 'rgba(255, 248, 237, 0.42)',
    backgroundColor: 'rgba(255, 248, 237, 0.18)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  planBadgeElite: {
    borderColor: 'rgba(255, 248, 237, 0.52)',
    backgroundColor: 'rgba(255, 248, 237, 0.16)',
    transform: [{ rotate: '-5deg' }],
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
  },
  planBadgeText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  settingsSection: {
    gap: 10,
  },
  settingsTopSubtitle: {
    marginTop: 7,
    color: Colors.textSub,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    maxWidth: 470,
  },
  settingsTopSubtitleCompact: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
  },
  settingsSectionLabel: {
    color: '#101820',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'none',
  },
  subscriptionHeroLabel: {
    color: '#586273',
    opacity: 1,
  },
  settingsHelper: {
    color: '#687386',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  segmented: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: '#F1F2F4',
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  segmentText: {
    color: '#586273',
    fontSize: 14,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: '#101820',
  },
  planGrid: {
    gap: 12,
  },
  planCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 5,
    borderColor: Colors.border,
    borderBottomColor: Colors.borderBright,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
    shadowColor: Colors.ink,
    shadowOpacity: 0.055,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  planCardPro: {
    borderColor: '#BFDDF7',
    borderBottomColor: '#84BEEB',
    backgroundColor: '#EFF8FF',
  },
  planCardElite: {
    borderColor: '#D8CAF7',
    borderBottomColor: '#A78BDB',
    backgroundColor: '#F7F1FF',
  },
  planCardPending: {
    borderColor: Colors.secondary,
    borderBottomColor: Colors.secondary,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  planCardActive: {
    borderColor: Colors.secondary,
    borderBottomColor: Colors.secondary,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  planNameBlock: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  planName: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  planNameActive: {
    color: Colors.text,
  },
  planPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  planCurrentPill: {
    alignSelf: 'flex-start',
    minHeight: 25,
    borderRadius: 999,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  planCurrentText: {
    color: Colors.onPrimary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  planPendingPill: {
    alignSelf: 'flex-start',
    minHeight: 25,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BEE8E5',
    backgroundColor: '#EFFFFD',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  planPendingText: {
    color: Colors.secondary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  planPopularPill: {
    alignSelf: 'flex-start',
    minHeight: 25,
    borderRadius: 999,
    backgroundColor: Colors.ink,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  planPopularText: {
    color: Colors.onPrimary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  planPriceBlock: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 110,
  },
  planPrice: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  planPriceActive: {
    color: Colors.text,
  },
  planDailyPrice: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  planDailyPriceActive: {
    color: Colors.textSub,
  },
  planSummary: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  planSummaryActive: {
    color: Colors.text,
  },
  planLimit: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  planLimitActive: {
    color: Colors.text,
  },
  planValueRow: {
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  planCreditValue: {
    color: Colors.textSub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  planCreditValueActive: {
    color: Colors.textSub,
  },
  planFeedback: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  planFeedbackActive: {
    color: Colors.secondary,
  },
  settingsList: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  settingsRow: {
    minHeight: 58,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  settingsRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  settingsRowText: {
    color: '#101820',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  settingsRowDetail: {
    color: '#687386',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  toggleTrack: {
    width: 54,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DDE5',
    backgroundColor: '#E9EDF3',
    padding: 3,
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  toggleTrackOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  toggleThumbOn: {
    backgroundColor: '#FFFFFF',
  },
});
