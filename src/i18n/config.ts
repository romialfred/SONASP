import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enCommon from './locales/en/common.json';
import frCommon from './locales/fr/common.json';
import {
  DEFAULT_INTERFACE_LANGUAGE,
  INTERFACE_LANGUAGE_STORAGE_KEY,
  normalizeInterfaceLanguage,
} from './interfaceLanguages';

const initialLanguage = typeof window === 'undefined'
  ? DEFAULT_INTERFACE_LANGUAGE
  : normalizeInterfaceLanguage(window.localStorage.getItem(INTERFACE_LANGUAGE_STORAGE_KEY));

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
    lng: initialLanguage,
    fallbackLng: DEFAULT_INTERFACE_LANGUAGE,
    supportedLngs: ['fr', 'en'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: INTERFACE_LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

// La version institutionnelle courante s'ouvre intégralement en français.
const updateDocumentLanguage = (language: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = language.startsWith('fr') ? 'fr' : 'en';
};
i18n.on('languageChanged', updateDocumentLanguage);
updateDocumentLanguage(i18n.resolvedLanguage || DEFAULT_INTERFACE_LANGUAGE);

export default i18n;
