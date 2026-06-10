import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, type DimensionValue } from 'react-native';
import { Colors } from '@/constants/colors';
import { BookmarkIcon, CheckIcon, FlameIcon, StarIcon, XIcon } from '@/components/Icons';
import { APP_COMPACT_BREAKPOINT, DrillLeaveConfirm } from '@/components/AppFooterTabs';

export function DrillHeader({
  current,
  total,
  xp,
  saved,
  onQuit,
  onSave,
  accent = Colors.primary,
  streak = 0,
  progressLabel = 'Question',
}: {
  current: number;
  total: number;
  xp: number;
  saved: boolean;
  onQuit: () => void;
  onSave: () => void;
  accent?: string;
  streak?: number;
  progressLabel?: string;
}) {
  const { width } = useWindowDimensions();
  const useTightHeader = width < 1120;
  const isMobile = width < APP_COMPACT_BREAKPOINT;
  const [exitConfirmVisible, setExitConfirmVisible] = React.useState(false);
  const safeTotal = Math.max(total, 1);
  const filledSegments = Math.max(0, Math.min(current, safeTotal));
  const progressPercent = `${Math.max(0, Math.min(100, (filledSegments / safeTotal) * 100))}%` as DimensionValue;

  return (
    <>
      <View style={[styles.header, useTightHeader && styles.headerCompact, isMobile && styles.headerMobile]}>
        <View style={[styles.headerTop, useTightHeader && styles.headerTopCompact]}>
          <TouchableOpacity
            onPress={() => setExitConfirmVisible(true)}
            style={[styles.iconBtn, useTightHeader && styles.iconBtnCompact]}
            accessibilityRole="button"
            accessibilityLabel="Exit drill"
          >
            <XIcon size={useTightHeader ? 18 : 20} color={Colors.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
          {useTightHeader ? (
            <View style={styles.headerCompactSpacer} />
          ) : (
            <View style={styles.headerCenter}>
              <Text style={styles.progressLabel}>{progressLabel}</Text>
              <Text style={styles.progressCount}>{filledSegments} / {safeTotal}</Text>
            </View>
          )}
          <View style={styles.headerStats}>
            {streak > 1 && (
              <View style={[styles.streakPill, useTightHeader && styles.streakPillCompact]}>
                <FlameIcon size={useTightHeader ? 15 : 18} color={Colors.warning} />
                <Text style={[styles.streakText, useTightHeader && styles.streakTextCompact]}>{streak}</Text>
              </View>
            )}
            <View style={[styles.xpPill, useTightHeader && styles.xpPillCompact]}>
              <StarIcon size={useTightHeader ? 15 : 18} color={Colors.gold} />
              <Text style={[styles.xpText, useTightHeader && styles.xpTextCompact]}>{xp}</Text>
            </View>
            <TouchableOpacity
              onPress={onSave}
              style={[styles.iconBtn, useTightHeader && styles.iconBtnCompact]}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from Library' : 'Save to Library'}
            >
              {saved ? (
                <CheckIcon size={useTightHeader ? 17 : 19} color={Colors.success} strokeWidth={2.4} />
              ) : (
                <BookmarkIcon size={useTightHeader ? 17 : 19} color={Colors.textSub} strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        {useTightHeader ? (
          <View style={[styles.compactProgressRow, isMobile && styles.compactProgressRowMobile]} accessibilityLabel={`${progressLabel} ${filledSegments} of ${safeTotal}`}>
            <View style={[styles.compactProgressBadge, isMobile && styles.compactProgressBadgeMobile]}>
              <Text style={styles.compactProgressCount}>{filledSegments}/{safeTotal}</Text>
              <Text style={styles.compactProgressLabel}>{progressLabel}</Text>
            </View>
            <View style={[styles.compactProgressRail, isMobile && styles.compactProgressRailMobile]}>
              <View style={[styles.compactProgressFill, isMobile && styles.compactProgressFillMobile, { width: progressPercent, backgroundColor: accent, shadowColor: accent }]}>
                <View style={styles.compactProgressFillShine} />
                <View style={styles.compactProgressFillCap} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.progressWrapper} accessibilityLabel={`${progressLabel} ${filledSegments} of ${safeTotal}`}>
            {Array.from({ length: safeTotal }).map((_, index) => (
              <View
                key={`drill-progress-${index}`}
                style={[
                  styles.progressSegment,
                  index < filledSegments && { backgroundColor: accent },
                ]}
              />
            ))}
          </View>
        )}
      </View>
      <DrillLeaveConfirm
        visible={exitConfirmVisible}
        leaveLabel="Leave drill"
        onCancel={() => setExitConfirmVisible(false)}
        onLeave={() => {
          setExitConfirmVisible(false);
          onQuit();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 1220,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 18,
    gap: 16,
  },
  headerCompact: {
    paddingHorizontal: 14,
    paddingTop: 36,
    paddingBottom: 12,
    gap: 12,
  },
  headerMobile: {
    paddingTop: 40,
    paddingBottom: 14,
    gap: 14,
  },
  headerTop: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTopCompact: {
    minHeight: 38,
  },
  headerCompactSpacer: {
    flex: 1,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBtnCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  progressWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 0,
    paddingTop: 2,
  },
  progressWrapperCompact: {
    gap: 6,
    paddingHorizontal: 2,
  },
  compactProgressBadge: {
    minHeight: 38,
    minWidth: 78,
    borderRadius: 18,
    backgroundColor: '#FFFFFFF5',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: Colors.ink,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  compactProgressBadgeMobile: {
    minHeight: 42,
    minWidth: 86,
    borderRadius: 20,
    backgroundColor: '#FFFFFFFA',
    shadowOpacity: 0.045,
    shadowRadius: 12,
  },
  compactProgressCount: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  compactProgressLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  compactProgressRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactProgressRowMobile: {
    minHeight: 44,
    gap: 12,
  },
  compactProgressRail: {
    flex: 1,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#EDF3F7',
    borderWidth: 1,
    borderColor: '#D4E0EA',
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  compactProgressRailMobile: {
    height: 22,
    backgroundColor: '#E8EEF5',
    borderColor: '#D3DFEA',
    shadowOpacity: 0.055,
    shadowRadius: 12,
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 999,
    minWidth: 24,
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    overflow: 'hidden',
  },
  compactProgressFillMobile: {
    minWidth: 28,
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  compactProgressFillShine: {
    position: 'absolute',
    left: 6,
    right: 12,
    top: 3,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF52',
  },
  compactProgressFillCap: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#FFFFFF66',
  },
  progressSegment: {
    flex: 1,
    height: 8,
    borderRadius: 99,
    backgroundColor: '#E3E8EF',
  },
  progressSegmentCompact: {
    height: 6,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  progressLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  progressCount: {
    color: '#101820',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  streakPillCompact: {
    minHeight: 38,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  streakText: { color: Colors.warning, fontSize: 18, fontWeight: '900' },
  streakTextCompact: { fontSize: 15 },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    minHeight: 46,
    minWidth: 74,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  xpPillCompact: {
    minHeight: 38,
    minWidth: 58,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  xpText: { color: Colors.gold, fontSize: 18, fontWeight: '900' },
  xpTextCompact: { fontSize: 15 },
});
