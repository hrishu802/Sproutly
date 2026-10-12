import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { translations, type TranslationKey, type SupportedLanguage } from '../locales/translations';
import { getGardenProfile, saveGardenProfile } from '../services/storage/db';
import type { GardenProfile, Language } from '../types';

// ========== Language Context ==========

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationKey;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  useEffect(() => {
    getGardenProfile().then((profile) => {
      if (profile?.preferences?.language) {
        setLanguageState(profile.preferences.language as SupportedLanguage);
      }
    });
  }, []);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    const profile = await getGardenProfile();
    if (profile) {
      await saveGardenProfile({
        ...profile,
        preferences: { ...profile.preferences, language: lang as Language },
      });
    }
  }, []);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ========== Garden Context ==========

interface GardenContextType {
  profile: GardenProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<GardenProfile>) => Promise<void>;
}

const GardenContext = createContext<GardenContextType>({
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  updateProfile: async () => {},
});

export function useGarden() {
  return useContext(GardenContext);
}

export function GardenProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<GardenProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await getGardenProfile();
      setProfile(p || null);
    } catch (err) {
      console.error('Failed to load garden profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const updateProfile = useCallback(async (updates: Partial<GardenProfile>) => {
    const now = new Date().toISOString();
    const existing = profile || {
      name: 'My Garden',
      preferences: { language: 'en' as Language },
      createdAt: now,
      updatedAt: now,
    };
    const updated = await saveGardenProfile({
      ...existing,
      ...updates,
      updatedAt: now,
    });
    setProfile(updated);
  }, [profile]);

  return (
    <GardenContext.Provider value={{ profile, loading, refreshProfile, updateProfile }}>
      {children}
    </GardenContext.Provider>
  );
}
