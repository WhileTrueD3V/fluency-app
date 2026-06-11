import React from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';

function safePath(path: string | undefined) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/';
  if (path.startsWith('/__mobile-demo')) return '/';
  return path;
}

export default function MobileDemoRoute() {
  const params = useLocalSearchParams<{ path?: string; fresh?: string }>();
  const initialPath = safePath(typeof params.path === 'string' ? params.path : '/');
  const fresh = typeof params.fresh === 'string' ? params.fresh : '';
  const appPath = initialPath;
  const frameSrc = `${appPath}${appPath.includes('?') ? '&' : '?'}mobilePreview=1${fresh ? `&previewFresh=${encodeURIComponent(fresh)}` : ''}`;

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
