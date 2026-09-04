import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INTERFACE_LANGUAGE,
  INTERFACE_LANGUAGES,
  isInterfaceLanguageEnabled,
  normalizeInterfaceLanguage,
} from './interfaceLanguages';

describe('langues de l’interface privée', () => {
  it('impose le français dans la version institutionnelle courante', () => {
    expect(DEFAULT_INTERFACE_LANGUAGE).toBe('fr');
    expect(normalizeInterfaceLanguage(null)).toBe('fr');
    expect(normalizeInterfaceLanguage('en')).toBe('fr');
    expect(isInterfaceLanguageEnabled('fr')).toBe(true);
    expect(isInterfaceLanguageEnabled('en')).toBe(false);
  });

  it('conserve une option anglaise visible mais non activable', () => {
    expect(INTERFACE_LANGUAGES).toContainEqual({
      code: 'en',
      label: 'Anglais — bientôt disponible',
      enabled: false,
    });
  });
});
