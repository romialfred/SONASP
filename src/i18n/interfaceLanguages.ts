export type InterfaceLanguage = 'fr' | 'en';

export const INTERFACE_LANGUAGE_STORAGE_KEY = 'sonasp-language';
export const DEFAULT_INTERFACE_LANGUAGE: InterfaceLanguage = 'fr';

/**
 * Le catalogue anglais reste conservé pour la prochaine phase bilingue.
 * Tant que toutes les vues privées ne sont pas cataloguées, seul le français
 * peut être activé afin de ne jamais produire une interface hybride.
 */
export const INTERFACE_LANGUAGES: ReadonlyArray<{
  code: InterfaceLanguage;
  label: string;
  enabled: boolean;
}> = [
  { code: 'fr', label: 'Français', enabled: true },
  { code: 'en', label: 'Anglais — bientôt disponible', enabled: false },
];

export function isInterfaceLanguageEnabled(language: string): language is InterfaceLanguage {
  return INTERFACE_LANGUAGES.some((option) => option.code === language && option.enabled);
}

export function normalizeInterfaceLanguage(language: string | null | undefined): InterfaceLanguage {
  return isInterfaceLanguageEnabled(language || '') ? language as InterfaceLanguage : DEFAULT_INTERFACE_LANGUAGE;
}
