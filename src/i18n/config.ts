import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enCommon from './locales/en/common.json';
import frCommon from './locales/fr/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enCommon,
      },
      fr: {
        translation: frCommon,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['fr', 'en'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'sonasp-language',
      caches: ['localStorage'],
    },
  });

// An explicit language choice persists; the platform defaults to English.
const updateDocumentLanguage = (language: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = language.startsWith('fr') ? 'fr' : 'en';
};
i18n.on('languageChanged', updateDocumentLanguage);
updateDocumentLanguage(i18n.resolvedLanguage || 'en');

export default i18n;
