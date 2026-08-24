import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/types/auth';
import { isComptoirRouteAllowed, isComptoirScopedUser } from './comptoirAccess';

const comptoir = {
  id: 'counter-user', email: 'counter@example.bf', full_name: 'Comptoir Exemple', phone: null,
  role: 'customer', mining_company_id: null, site_ids: [], is_active: true,
  capabilities: ['customer.operate', 'comptoir.manage'],
  is_sales_approver: false, two_factor_enabled: true, language: 'fr',
  email_notifications: true, batch_notifications: true, approval_notifications: true,
  created_at: '2026-01-01', updated_at: '2026-01-01',
} satisfies UserProfile;

describe('périmètre du portail Comptoir', () => {
  it('exige le rôle partenaire et la capacité serveur', () => {
    expect(isComptoirScopedUser(comptoir)).toBe(true);
    expect(isComptoirScopedUser({ ...comptoir, capabilities: ['customer.operate'] })).toBe(false);
    expect(isComptoirScopedUser({ ...comptoir, role: 'management' })).toBe(false);
  });

  it.each([
    '/portail-comptoir',
    '/portail-comptoir/stock',
    '/artisan-minier/liste',
    '/artisan-minier/ventes-or/nouvelle',
    '/artisan-minier/ventes-or/123/facture',
    '/artisan-minier/paiements/historique',
    '/artisan-minier/rapports/taxes',
    '/artisan-minier/123e4567-e89b-12d3-a456-426614174000',
  ])('autorise %s', (route) => {
    expect(isComptoirRouteAllowed(route)).toBe(true);
  });

  it.each([
    '/sales', '/gold-prices', '/production/licenses', '/shipping/preparation',
    '/artisan-minier/123e4567-e89b-12d3-a456-426614174000/edit',
    '/artisan-minier/cartes/validation', '/users', '/admin/modules',
  ])('refuse %s', (route) => {
    expect(isComptoirRouteAllowed(route)).toBe(false);
  });
});
