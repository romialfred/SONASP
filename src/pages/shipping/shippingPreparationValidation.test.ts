import { describe, expect, it } from 'vitest';
import {
  SHIPPING_ELIGIBLE_PRODUCTION_STATUS,
  summarizeShippingProductionIssues,
  validateShippingProduction,
  validateShippingProductionSelection,
  type ShippingProductionCandidate,
} from './shippingPreparationValidation';

const validProduction: ShippingProductionCandidate = {
  id: 'production-a',
  reference: 'BAR-2026-001',
  miningCompanyId: 'mine-a',
  status: SHIPPING_ELIGIBLE_PRODUCTION_STATUS,
  grossWeightGrams: 1_000,
  netWeightGrams: 990,
  pureGoldGrams: 980,
  finenessPercent: 99,
};

describe('shipping preparation physical validation', () => {
  it('accepts a production satisfying all physical and eligibility invariants', () => {
    expect(validateShippingProduction(validProduction, 'mine-a')).toEqual([]);
  });

  it.each([0, 100])('accepts the inclusive purity boundary %s%%', (finenessPercent) => {
    expect(validateShippingProduction({ ...validProduction, finenessPercent }, 'mine-a')).toEqual([]);
  });

  it.each([
    ['invalid-gross-weight', { grossWeightGrams: 0 }],
    ['invalid-net-weight', { netWeightGrams: Number.NaN }],
    ['net-exceeds-gross', { netWeightGrams: 1_001 }],
    ['invalid-fineness', { finenessPercent: -0.01 }],
    ['invalid-fineness', { finenessPercent: 100.01 }],
    ['invalid-pure-gold', { pureGoldGrams: -1 }],
    ['pure-gold-exceeds-net', { pureGoldGrams: 991 }],
  ] as const)('rejects %s', (expectedCode, patch) => {
    const issues = validateShippingProduction({ ...validProduction, ...patch }, 'mine-a');
    expect(issues.map((issue) => issue.code)).toContain(expectedCode);
  });

  it('rejects a production outside the company, workflow or available shipment pool', () => {
    const issues = validateShippingProduction({
      ...validProduction,
      miningCompanyId: 'mine-b',
      status: 'draft',
      alreadyAssigned: true,
    }, 'mine-a');

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'wrong-company',
      'invalid-status',
      'already-assigned',
    ]));
  });

  it('rejects duplicate productions and provides a concise user-facing summary', () => {
    const issues = validateShippingProductionSelection([validProduction, validProduction], 'mine-a');
    expect(issues.map((issue) => issue.code)).toContain('duplicate-production');
    expect(summarizeShippingProductionIssues(issues)).toMatch(/sélectionnée plusieurs fois/i);
  });
});
