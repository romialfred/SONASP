import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/types/auth';
import { isCollectorRouteAllowed, isCollectorScopedUser } from './collectorAccess';
import { isComptoirScopedUser } from './comptoirAccess';

const profile = (capabilities: string[]): UserProfile => ({
  id: 'collector-user', email: 'collector@example.bf', full_name: 'Collecteur', phone: null,
  role: 'customer', mining_company_id: null, site_ids: [], is_active: true, capabilities,
  is_sales_approver: false, two_factor_enabled: true, language: 'fr',
  email_notifications: true, batch_notifications: true, approval_notifications: true,
  created_at: '2026-01-01', updated_at: '2026-01-01',
});

describe('matrice d’accès du portail Collecteur', () => {
  it('reconnaît la capacité serveur et lui donne priorité sur le Comptoir', () => {
    const dual = profile(['collector.operate', 'comptoir.manage']);
    expect(isCollectorScopedUser(dual)).toBe(true);
    expect(isComptoirScopedUser(dual)).toBe(false);
    expect(isCollectorScopedUser(profile(['comptoir.manage']))).toBe(false);
  });

  it.each([
    '/portail-collecteur', '/portail-collecteur/stock', '/portail-collecteur/documents',
    '/artisan-minier/liste', '/artisan-minier/ventes-or',
    '/artisan-minier/paiements/historique', '/artisan-minier/rapports/taxes', '/profile', '/help',
    '/artisan-minier/123e4567-e89b-12d3-a456-426614174000',
    '/artisan-minier/ventes-or/123e4567-e89b-12d3-a456-426614174000',
  ])('autorise la consultation %s', (route) => {
    expect(isCollectorRouteAllowed(route)).toBe(true);
  });

  it.each([
    '/portail-comptoir', '/portail-comptoir/ventes-sonasp', '/sales', '/gold-prices',
    '/artisan-minier', '/artisan-minier/ventes-or/nouvelle',
    '/artisan-minier/ventes-or/123e4567-e89b-12d3-a456-426614174000/modifier',
    '/artisan-minier/paiements',
    '/artisan-minier/123e4567-e89b-12d3-a456-426614174000/infractions/nouvelle',
  ])('refuse l’opération hors périmètre %s', (route) => {
    expect(isCollectorRouteAllowed(route)).toBe(false);
  });
});
