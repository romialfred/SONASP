import { describe, expect, it } from 'vitest';
import { secureNumericCode, secureRandomId } from './secureRandom';

describe('secureRandom', () => {
  it('produit des identifiants distincts au format UUID', () => {
    const first = secureRandomId();
    const second = secureRandomId();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(second).not.toBe(first);
  });

  it('produit un code numérique de la longueur demandée', () => {
    expect(secureNumericCode(10)).toMatch(/^\d{10}$/);
  });

  it('refuse une longueur invalide', () => {
    expect(() => secureNumericCode(0)).toThrow('Longueur de code de sécurité invalide');
  });
});
