import { describe, expect, it } from 'vitest';
import { canRequestSessionRevocation } from './session-revocation-policy.ts';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';

function input(overrides: Partial<Parameters<typeof canRequestSessionRevocation>[0]> = {}) {
  return {
    actorId: ACTOR_ID,
    actorRole: 'admin',
    actorIsActive: true,
    actorMiningCompanyId: null,
    actorHasMfa: true,
    actorAal: 'aal2' as const,
    targetId: TARGET_ID,
    targetRole: 'mine',
    hasAccountManagementCapability: true,
    hierarchyAllowsTarget: true,
    ...overrides,
  };
}

describe('session revocation policy', () => {
  it('autorise la révocation self AAL2 pour un profil partenaire', () => {
    expect(canRequestSessionRevocation(input({
      actorRole: 'mine',
      actorMiningCompanyId: '33333333-3333-4333-8333-333333333333',
      targetId: ACTOR_ID,
      targetRole: 'mine',
      hasAccountManagementCapability: false,
      hierarchyAllowsTarget: false,
    }))).toBe(true);
  });

  it('refuse self si le profil est inactif ou si AAL2 manque', () => {
    expect(canRequestSessionRevocation(input({ targetId: ACTOR_ID, actorIsActive: false }))).toBe(false);
    expect(canRequestSessionRevocation(input({ targetId: ACTOR_ID, actorAal: 'aal1' }))).toBe(false);
  });

  it('autorise Owner/Admin national avec capability et hiérarchie sur une cible inférieure', () => {
    expect(canRequestSessionRevocation(input())).toBe(true);
    expect(canRequestSessionRevocation(input({ actorRole: 'owner', targetRole: 'admin' }))).toBe(true);
  });

  it('refuse toute administration tierce depuis un tenant partenaire', () => {
    expect(canRequestSessionRevocation(input({
      actorRole: 'mine',
      actorMiningCompanyId: '33333333-3333-4333-8333-333333333333',
    }))).toBe(false);
  });

  it('échoue fermé sans capability, hiérarchie ou rôle cible reconnu', () => {
    expect(canRequestSessionRevocation(input({ hasAccountManagementCapability: false }))).toBe(false);
    expect(canRequestSessionRevocation(input({ hierarchyAllowsTarget: false }))).toBe(false);
    expect(canRequestSessionRevocation(input({ targetRole: null }))).toBe(false);
    expect(canRequestSessionRevocation(input({ targetRole: 'owner' }))).toBe(false);
  });
});
