import { describe, expect, it } from 'vitest';
import { isMineRouteAllowed, isMineScopedUser } from './mineAccess';

describe('matrice d’accès du portail Mine', () => {
  it('reconnaît le périmètre par le rattachement, y compris pour un rôle historique customer', () => {
    expect(isMineScopedUser({ is_active: true, role: 'customer', mining_company_id: 'mine-1' })).toBe(true);
    expect(isMineScopedUser({ is_active: true, role: 'customer', mining_company_id: null })).toBe(false);
  });

  it.each([
    '/production/daily', '/production/in-safe', '/production/licenses/123',
    '/performance/budgets', '/performance/forecasts', '/shipping', '/shipping/preparation/new',
    '/refining', '/inventory', '/sales/new', '/stakeholders/depositors/new',
    '/contrats/nouveau', '/contrats/123', '/requisitions/123', '/achats/reglements',
  ])('autorise %s', (route) => {
    expect(isMineRouteAllowed(route)).toBe(true);
  });

  it.each([
    '/production/achats-mines', '/achats/plans', '/achats/comptes',
    '/inventory/add', '/sales/approve/123', '/admin/users',
  ])('refuse %s', (route) => {
    expect(isMineRouteAllowed(route)).toBe(false);
  });
});
