import { describe, expect, it } from 'vitest';
import {
  ORIGINE_APPLICATION_PRODUCTION,
  origineApplication,
  urlModificationMotDePasse,
  urlRecuperationCompte,
} from './application-url';

describe('origineApplication', () => {
  it.each([
    undefined,
    null,
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'https://localhost:3000',
    'valeur-invalide',
  ])('remplace une origine absente, locale ou invalide (%s)', (valeur) => {
    expect(origineApplication(valeur)).toBe(ORIGINE_APPLICATION_PRODUCTION);
  });

  it('conserve une origine HTTPS publique sans chemin final', () => {
    expect(origineApplication('https://sonasp.vercel.app/previsualisation/'))
      .toBe('https://sonasp.vercel.app');
  });

  it('construit la page publique de changement du mot de passe', () => {
    expect(urlModificationMotDePasse('http://localhost:3000'))
      .toBe('https://sonasp.data-univers.com/modifier-mot-de-passe');
  });

  it('construit un lien de récupération entièrement hébergé par la plateforme', () => {
    const url = new URL(urlRecuperationCompte('jeton+/signé', 'http://localhost:3000'));

    expect(url.origin).toBe(ORIGINE_APPLICATION_PRODUCTION);
    expect(url.pathname).toBe('/modifier-mot-de-passe');
    expect(url.searchParams.get('token_hash')).toBe('jeton+/signé');
    expect(url.searchParams.get('type')).toBe('recovery');
  });
});
