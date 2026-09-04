import { describe, expect, it } from 'vitest';
import { evaluateEffectiveAccess } from './effectiveAccess';

const allowedFactors = {
  accountActive: true,
  sessionActive: true,
  portalActive: true,
  roleActive: true,
  roleBelongsToPortal: true,
  moduleGloballyActive: true,
  moduleActiveForPortal: true,
  moduleActiveForRole: true,
  permissionApplicable: true,
  permissionGrantedToRole: true,
  individualGrantWithinCeiling: true,
  individuallyDenied: false,
} as const;

describe('evaluateEffectiveAccess', () => {
  it('autorise uniquement lorsque tous les plafonds sont ouverts', () => {
    expect(evaluateEffectiveAccess('view', allowedFactors)).toEqual({
      allowed: true,
      permission: 'view',
      failedFactor: null,
    });
  });

  it.each([
    'accountActive',
    'sessionActive',
    'portalActive',
    'roleActive',
    'roleBelongsToPortal',
    'moduleGloballyActive',
    'moduleActiveForPortal',
    'moduleActiveForRole',
    'permissionApplicable',
    'permissionGrantedToRole',
    'individualGrantWithinCeiling',
  ] as const)('refuse par défaut lorsque %s est fermé', (factor) => {
    const decision = evaluateEffectiveAccess('edit', { ...allowedFactors, [factor]: false });
    expect(decision.allowed).toBe(false);
    expect(decision.failedFactor).toBe(factor);
  });

  it('fait toujours primer une restriction individuelle', () => {
    expect(evaluateEffectiveAccess('export', {
      ...allowedFactors,
      individuallyDenied: true,
    })).toMatchObject({ allowed: false, failedFactor: 'individuallyDenied' });
  });
});
