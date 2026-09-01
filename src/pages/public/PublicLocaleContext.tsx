import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { publicContent, type PublicLocale } from './publicContent';

type PublicLocaleValue = {
  locale: PublicLocale;
  setLocale: (locale: PublicLocale) => void;
  content: (typeof publicContent)[PublicLocale];
};

const PublicLocaleContext = createContext<PublicLocaleValue | null>(null);

function getInitialLocale(): PublicLocale {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem('sonasp-public-locale') === 'fr' ? 'fr' : 'en';
}

export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<PublicLocale>(getInitialLocale);

  useEffect(() => {
    window.localStorage.setItem('sonasp-public-locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, content: publicContent[locale] }),
    [locale],
  );

  return <PublicLocaleContext.Provider value={value}>{children}</PublicLocaleContext.Provider>;
}

export function usePublicLocale() {
  const context = useContext(PublicLocaleContext);
  if (!context) throw new Error('usePublicLocale must be used inside PublicLocaleProvider');
  return context;
}
