import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { BookOpenIcon, HomeIcon, TargetIcon } from '@/components/Icons';

function safePath(path: string | undefined) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/';
  if (path.startsWith('/__mobile-demo')) return '/';
  return path;
}

export default function MobileDemoRoute() {
  const params = useLocalSearchParams<{ path?: string }>();
  const initialPath = safePath(typeof params.path === 'string' ? params.path : '/');
  const [appPath, setAppPath] = React.useState(initialPath);
  const frameSrc = `${appPath}${appPath.includes('?') ? '&' : '?'}mobilePreview=1&hideFooter=1`;

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeFallback}>
        <Text style={styles.nativeTitle}>Mobile preview is web-only.</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.label}>Mobile app preview · 393 x 852</Text>
      <View style={styles.phone}>
        <View style={styles.speaker} pointerEvents="none" />
        <View style={styles.screen}>
          {React.createElement('iframe', {
            src: frameSrc,
            title: '',
            style: styles.iframe,
          })}
        </View>
        <View style={styles.previewDockBackdrop} pointerEvents="none" />
        <View style={styles.previewDock}>
          {([
            { key: 'home', label: 'Home', path: '/', icon: HomeIcon },
            { key: 'library', label: 'Library', path: '/library', icon: BookOpenIcon },
            { key: 'mock', label: 'Mock', path: '/mock', icon: TargetIcon },
          ] as const).map((item) => {
            const active = appPath === item.path;
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setAppPath(item.path)}
                activeOpacity={0.84}
                style={[styles.previewDockItem, active && styles.previewDockItemActive]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.label}`}
              >
                <Icon size={23} color={active ? Colors.primary : Colors.textMuted} strokeWidth={active ? 2.5 : 2.15} />
                <Text style={[styles.previewDockLabel, active && styles.previewDockLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = {
  page: {
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: '#211d1c',
  } as const,
  label: {
    color: '#fff8ed',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.1,
    textTransform: 'uppercase',
    opacity: 0.86,
  } as const,
  phone: {
    width: 'min(393px, calc(100vw - 28px))' as unknown as number,
    aspectRatio: 393 / 852,
    maxHeight: 'calc(100vh - 74px)' as unknown as number,
    borderWidth: 12,
    borderColor: '#1f1f22',
    borderRadius: 46,
    backgroundColor: '#1f1f22',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 28 },
  } as const,
  speaker: {
    position: 'absolute',
    zIndex: 4,
    top: 10,
    left: '50%',
    width: 92,
    height: 23,
    transform: [{ translateX: -46 }],
    borderRadius: 999,
    backgroundColor: '#171719',
  } as const,
  screen: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.bg,
  } as const,
  iframe: {
    width: '100%',
    height: '100%',
    border: 0,
    backgroundColor: Colors.bg,
    display: 'block',
  } as React.CSSProperties,
  previewDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    height: 76,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 7,
    shadowColor: '#101820',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    zIndex: 8,
  } as const,
  previewDockBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
    backgroundColor: Colors.bg,
    zIndex: 7,
  } as const,
  previewDockItem: {
    flex: 1,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  } as const,
  previewDockItemActive: {
    backgroundColor: Colors.primaryDim,
  } as const,
  previewDockLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  } as const,
  previewDockLabelActive: {
    color: Colors.primary,
  } as const,
  nativeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    padding: 24,
  } as const,
  nativeTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
  } as const,
};
