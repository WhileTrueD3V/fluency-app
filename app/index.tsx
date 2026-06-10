import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { getPrefs } from '@/utils/storage';
import { Colors } from '@/constants/colors';

/** Entry point: redirect to onboarding or home based on stored prefs. */
export default function Entry() {
  const router = useRouter();

  useEffect(() => {
    getPrefs().then((prefs) => {
      if (prefs.onboardingComplete && prefs.selectedLanguage) {
        router.replace('/(home)');
      } else {
        router.replace('/onboarding');
      }
    });
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
