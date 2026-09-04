import { describe, it, expect } from 'vitest';
import { presentError } from './presentError';
describe('presentError', () => {
  it.each([['PGRST201', 'configuration'], ['42501', 'access'], ['23505', 'duplicate'], ['40001', 'conflict']])('classifies %s without leaking diagnostics', (code, category) => {
    const result = presentError({ code, message: 'secret row value', details: 'private' });
    expect(result.category).toBe(category); expect(result.code).toBe(code);
    expect(JSON.stringify(result)).not.toMatch(/secret|private/);
  });
  it('handles unknown errors without suggesting an automatic save retry', () => {
    expect(presentError(null).recovery).toContain('contrôlez l’enregistrement');
    expect(presentError({ code: 'https://private?token=secret' }).code).toBeUndefined();
  });

  it('presents user-facing errors in institutional French', () => {
    expect(presentError({ code: 'PGRST201' })).toMatchObject({
      title: 'Connexion aux données indisponible',
      message: 'L’application n’a pas pu relier les données nécessaires à cette page.',
    });
    expect(presentError({ code: '42501' }).title).toBe('Action non autorisée');
    expect(presentError({ code: '23505' }).title).toBe('Enregistrement déjà existant');
  });
});
