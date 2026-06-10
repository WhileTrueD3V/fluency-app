import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { AppFooterTabs } from '@/components/AppFooterTabs';
import { FirstCompletionFeedbackModal } from '@/components/FirstCompletionFeedbackModal';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="__mobile-demo" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="development" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="legal/privacy" />
        <Stack.Screen name="legal/terms" />
        <Stack.Screen name="(home)" />
        <Stack.Screen name="speaking/index" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="speaking/translation" options={{ animation: 'slide_from_bottom', animationDuration: 420 }} />
        <Stack.Screen name="speaking/pronunciation" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="speaking/score" />
        <Stack.Screen name="listening/session" options={{ animation: 'slide_from_bottom', animationDuration: 420 }} />
        <Stack.Screen name="ap/reading" options={{ animation: 'slide_from_bottom', animationDuration: 420 }} />
        <Stack.Screen name="listening/summary" />
        <Stack.Screen name="ap/conversation" options={{ animation: 'slide_from_bottom', animationDuration: 420 }} />
        <Stack.Screen name="ap/texting" options={{ animation: 'slide_from_bottom', animationDuration: 420 }} />
      </Stack>
      <AppFooterTabs />
      <FirstCompletionFeedbackModal />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
