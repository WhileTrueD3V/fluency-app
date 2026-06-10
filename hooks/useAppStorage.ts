import { useState, useEffect, useCallback } from 'react';
import { getPrefs, getStats, savePrefs, type AppStats, type UserPrefs } from '@/utils/storage';
import type { LanguageCode } from '@/constants/languages';

export function useAppStorage() {
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s] = await Promise.all([getPrefs(), getStats()]);
    setPrefs(p);
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    await savePrefs({ selectedLanguage: code, onboardingComplete: true });
    setPrefs((prev) => ({
      ...(prev ?? { selectedLanguage: null, onboardingComplete: false }),
      selectedLanguage: code,
      onboardingComplete: true,
    }));
  }, []);

  return { prefs, stats, loading, reload: load, setLanguage };
}
