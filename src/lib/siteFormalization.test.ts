import { describe, expect, it } from 'vitest';
import { aeaExpiryDate, emptyAea, siteAeaState, validateSiteAea } from './siteFormalization';
import { canManageMiningRegistry } from './miningRegistryAccess';
import type { UserProfile } from '@/types/auth';

describe('Formalisation et AEA', () => {
  it('calcule les échéances en mois calendaires, y compris les fins de mois et années bissextiles', () => {
    expect(aeaExpiryDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(aeaExpiryDate('2024-01-31', 1)).toBe('2024-02-29');
    expect(aeaExpiryDate('2024-02-29', 12)).toBe('2025-02-28');
    expect(aeaExpiryDate('2026-09-06', 24)).toBe('2028-09-06');
  });
  it.each([['2026-02-30', 12], ['2026-01-01', 0], ['2026-01-01', 1.5], ['2026-13-01', 12], ['9999-12-31', 12]])('refuse une échéance invalide %s / %s', (date, months) => {
    expect(aeaExpiryDate(String(date), Number(months))).toBeNull();
  });
  it('exige les références et le document pour une AEA', () => {
    expect(validateSiteAea(emptyAea())).toMatch(/numéro/);
    const aea = { ...emptyAea(), number: 'AEA-2026-01', issuedOn: '2026-01-31' };
    expect(validateSiteAea(aea)).toMatch(/Joignez/);
    expect(validateSiteAea(aea, true)).toBeNull();
    expect(validateSiteAea({ ...aea, documentPath: 'site/attestation.pdf' })).toBeNull();
  });
  it('distingue dossier historique, absence d’AEA et expiration, sans modifier la catégorie', () => {
    expect(siteAeaState({ formalization: null }).label).toMatch(/renseigner/i);
    expect(siteAeaState({ formalization: 'non_formalized' }).label).toMatch(/AEA/);
    const site = { formalization: 'formalized' as const, aea: { ...emptyAea(), number: 'AEA', issuedOn: '2025-09-06', documentPath: 'site/aea.pdf' } };
    expect(siteAeaState(site, '2026-09-06').tone).toBe('good');
    expect(siteAeaState(site, '2026-09-07').tone).toBe('bad');
    expect(site.formalization).toBe('formalized');
  });
});

describe('Gestion du référentiel minier', () => {
  it.each(['owner', 'admin', 'dgmg'])('autorise le profil %s actif hors société minière', role => {
    expect(canManageMiningRegistry({ role, is_active: true } as UserProfile)).toBe(true);
    expect(canManageMiningRegistry({ role, is_active: false } as UserProfile)).toBe(false);
    expect(canManageMiningRegistry({ role, is_active: true, mining_company_id: 'mine' } as UserProfile)).toBe(false);
  });
  it.each(['management', 'manager', 'dgi', 'comptoir', 'collector', 'mine', 'customer'])('refuse la création pour %s', role => {
    expect(canManageMiningRegistry({ role, is_active: true } as UserProfile)).toBe(false);
  });
});
