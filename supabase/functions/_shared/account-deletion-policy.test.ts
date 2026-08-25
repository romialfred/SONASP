import { describe, expect, it } from 'vitest';
import {
  isAccountTechnicalReference,
  isKnownAccountActivityColumn,
  isSecurityOnlyPurchaseAudit,
} from './account-deletion-policy';

describe('politique de suppression des comptes', () => {
  it('ne confond pas connexion, audit et permissions avec une activité métier', () => {
    expect(isAccountTechnicalReference('security_events', 'user_id')).toBe(true);
    expect(isAccountTechnicalReference('user_activity_logs', 'user_id')).toBe(true);
    expect(isAccountTechnicalReference('audit_logs', 'user_id')).toBe(true);
    expect(isAccountTechnicalReference('user_permissions', 'granted_by')).toBe(true);
  });

  it('conserve les références aux transactions comme blocages métier', () => {
    expect(isAccountTechnicalReference('shipments', 'created_by')).toBe(false);
    expect(isAccountTechnicalReference('snp_artisan_ventes_or', 'validee_par')).toBe(false);
  });

  it.each([
    'assigned_to', 'completed_by', 'cancelled_by', 'failed_by',
    'executed_by', 'rejected_by', 'reversement_started_by', 'reversed_by',
  ])('reconnaît la référence métier %s', (column) => {
    expect(isKnownAccountActivityColumn(column)).toBe(true);
  });

  it('distingue les audits de sécurité des audits portant sur une opération', () => {
    expect(isSecurityOnlyPurchaseAudit({ objet: 'user_profiles', action: 'compte_cree' })).toBe(true);
    expect(isSecurityOnlyPurchaseAudit({ objet: 'user_profiles', action: 'mfa_enrole' })).toBe(true);
    expect(isSecurityOnlyPurchaseAudit({ objet: 'vente_or', action: 'validation' })).toBe(false);
  });
});
