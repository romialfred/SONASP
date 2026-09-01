import { describe, expect, it } from 'vitest';
import helpSource from './helpContent.ts?raw';
import analyticsSource from '../pages/analytics/BusinessIntelligenceWorkspace.tsx?raw';
import invoiceSource from '../pages/artisan-minier/FactureVente.tsx?raw';

describe('Libellés métier', () => {
  it.each([['aide', helpSource], ['analyses', analyticsSource], ['facture', invoiceSource]])(
    'ne présente pas %s comme une démonstration', (_name, source) => {
      expect(/\bd[eé]monstration\b|\bPORTAIL-TEST-/i.test(source)).toBe(false);
    },
  );

  it('conserve la transparence sur la certification de la facture', () => {
    expect(invoiceSource).toContain('non une certification');
    expect(invoiceSource).toContain('non certifié');
  });
});
