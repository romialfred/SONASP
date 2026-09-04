import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { publicContent, type PublicLocale } from './publicContent';
import {
  DEFAULT_INTERFACE_LANGUAGE,
  INTERFACE_LANGUAGE_STORAGE_KEY,
  normalizeInterfaceLanguage,
} from '@/i18n/interfaceLanguages';

type PublicLocaleValue = {
  locale: PublicLocale;
  setLocale: (locale: PublicLocale) => void;
  content: (typeof publicContent)[PublicLocale];
};

const PublicLocaleContext = createContext<PublicLocaleValue | null>(null);

function getInitialLocale(): PublicLocale {
  if (typeof window === 'undefined') return DEFAULT_INTERFACE_LANGUAGE;
  return normalizeInterfaceLanguage(window.localStorage.getItem(INTERFACE_LANGUAGE_STORAGE_KEY));
}

export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PublicLocale>(getInitialLocale);
  const setLocale = useCallback((nextLocale: PublicLocale) => {
    setLocaleState(normalizeInterfaceLanguage(nextLocale));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, content: publicContent[locale] }),
    [locale, setLocale],
  );

  return <PublicLocaleContext.Provider value={value}>{children}</PublicLocaleContext.Provider>;
}

export function usePublicLocale() {
  const context = useContext(PublicLocaleContext);
  if (!context) throw new Error('usePublicLocale must be used inside PublicLocaleProvider');
  return context;
}
