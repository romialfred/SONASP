import { describe, expect, it } from 'vitest';
import { coquille } from './gabarit';

describe('gabarit des courriels SONASP', () => {
  it('affiche le logo officiel dans un en-tête vert et rouge', () => {
    const html = coquille({
      titre: 'Bienvenue',
      corps: '<p>Votre compte est prêt.</p>',
      origineApplication: 'https://sonasp.data-univers.com',
    });

    expect(html).toContain('https://sonasp.data-univers.com/sonasp_logo.png');
    expect(html).toContain('background-color:#0f7a56');
    expect(html).toContain('background-color:#d71920');
    expect(html).not.toContain('background-color:#10243e;padding:20px 30px');
  });
});
