import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '@/lib/capabilities';
import type { UserProfile, UserRole } from '@/types/auth';
import {
  PARTNER_ACCOUNT_TYPES,
  PRIVATE_ROUTE_REGISTRY,
  accountTypeFor,
  evaluatePrivateRouteAccess,
  homePathForAccountType,
  routePolicyFor,
  type AccountType,
} from './routeAccessRegistry';

const PUBLIC_OR_REDIRECT_ROUTES = new Set([
  '/', '/login', '/activate-account', '/auth/callback', '/recuperer-acces',
  '/modifier-mot-de-passe', '/settings', '/customers/:id/payments', '*',
]);

function profile(
  role: UserRole,
  capabilities?: string[],
  miningCompanyId: string | null = null,
): UserProfile {
  return {
    id: `${role}-user`, email: `${role}@example.bf`, full_name: role, phone: null,
    role, mining_company_id: miningCompanyId, site_ids: [], is_active: true,
    capabilities, is_sales_approver: false, two_factor_enabled: true, language: 'fr',
    email_notifications: true, batch_notifications: true, approval_notifications: true,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  };
}

const profiles: Record<Exclude<AccountType, 'unknown'>, UserProfile> = {
  owner: profile('owner'),
  admin: profile('admin', Object.values(CAPABILITIES)),
  direction: profile('manager', [CAPABILITIES.REPORTS_READ, CAPABILITIES.SONASP_WORKFLOW_READ]),
  sonasp: profile('management', Object.values(CAPABILITIES)),
  mine: profile('mine', [CAPABILITIES.MINE_OPERATE], '9b3fcaaa-9367-4c91-a82d-788f043f33f1'),
  comptoir: profile('customer', [CAPABILITIES.CUSTOMER_OPERATE, CAPABILITIES.COMPTOIR_MANAGE]),
  collector: profile('customer', [
    CAPABILITIES.CUSTOMER_OPERATE,
    CAPABILITIES.COMPTOIR_MANAGE,
    CAPABILITIES.COLLECTOR_OPERATE,
  ]),
  factory: profile('factory', [CAPABILITIES.FACTORY_OPERATE]),
  airport: profile('airport', [CAPABILITIES.AIRPORT_OPERATE]),
  refinery: profile('refinery', [CAPABILITIES.REFINERY_OPERATE]),
  customer: profile('customer', [CAPABILITIES.CUSTOMER_OPERATE]),
};

function materialize(pattern: string): string {
  return pattern
    .replace('*', 'tableau-de-bord')
    .replace(/:[^/]+/gu, '123e4567-e89b-42d3-a456-426614174000');
}

describe('registre contractuel des routes privées', () => {
  it('déclare une politique complète et unique pour chaque pattern', () => {
    const routes = PRIVATE_ROUTE_REGISTRY.map(({ route }) => route);
    expect(new Set(routes).size).toBe(routes.length);
    PRIVATE_ROUTE_REGISTRY.forEach((policy) => {
      expect(policy.route).toMatch(/^\//u);
      expect(policy.roles.length).toBeGreaterThan(0);
      expect(policy.accountTypes.length).toBeGreaterThan(0);
      expect(Array.isArray(policy.capabilities)).toBe(true);
      expect(typeof policy.readOnly).toBe('boolean');
      expect(typeof policy.national).toBe('boolean');
    });
  });

  it('couvre toutes les routes sensibles déclarées par PrivateApp', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/PrivateApp.tsx'), 'utf8');
    const literals = [...source.matchAll(/\bpath="([^"]+)"/gu)].map((match) => match[1]);
    const registeredCalls = [...source.matchAll(/privateRoutePath\('([^']+)'\)/gu)].map((match) => match[1]);
    const appRoutes = [...new Set([...literals, ...registeredCalls])]
      .filter((route) => !PUBLIC_OR_REDIRECT_ROUTES.has(route));
    const registered = new Set(PRIVATE_ROUTE_REGISTRY.map(({ route }) => route));

    expect(appRoutes.filter((route) => !registered.has(route))).toEqual([]);
  });

  it('échoue fermé pour tout profil ou rôle inconnu sur toutes les routes', () => {
    const unknown = { ...profiles.customer, role: 'super-admin' as UserRole };
    expect(accountTypeFor(unknown)).toBe('unknown');
    PRIVATE_ROUTE_REGISTRY.forEach(({ route }) => {
      expect(evaluatePrivateRouteAccess(unknown, materialize(route)).allowed).toBe(false);
      expect(evaluatePrivateRouteAccess(null, materialize(route)).allowed).toBe(false);
    });
  });

  it('applique la matrice déclarée à chaque route et chaque type de compte', () => {
    PRIVATE_ROUTE_REGISTRY.forEach((policy) => {
      Object.entries(profiles).forEach(([type, user]) => {
        const accountType = type as Exclude<AccountType, 'unknown'>;
        const hasDeclaredCapability = policy.capabilities.length === 0
          || policy.capabilities.some((capability) => user.capabilities?.includes(capability));
        const expected = accountType === 'owner'
          || (
            policy.roles.includes(user.role)
            && policy.accountTypes.includes(accountType)
            && hasDeclaredCapability
            && (accountType !== 'direction' || policy.readOnly)
          );

        expect(
          evaluatePrivateRouteAccess(user, materialize(policy.route)).allowed,
          `${type} / ${policy.route}`,
        ).toBe(expected);
      });
    });
  });

  it.each(Object.entries(profiles))('reconnaît %s et ouvre uniquement son accueil déclaré', (type, user) => {
    expect(accountTypeFor(user)).toBe(type);
    const home = homePathForAccountType(type as AccountType);
    expect(home).not.toBeNull();
    expect(evaluatePrivateRouteAccess(user, home as string).allowed).toBe(true);
  });

  it('ne donne aucune route nationale aux profils partenaires', () => {
    const nationalRoutes = PRIVATE_ROUTE_REGISTRY.filter(({ national }) => national);
    PARTNER_ACCOUNT_TYPES.forEach((type) => {
      nationalRoutes.forEach(({ route }) => {
        expect(
          evaluatePrivateRouteAccess(profiles[type], materialize(route)).allowed,
          `${type} ne doit pas ouvrir ${route}`,
        ).toBe(false);
      });
    });
  });

  it('n’ouvre à la Direction que des routes explicitement consultatives', () => {
    PRIVATE_ROUTE_REGISTRY.forEach((policy) => {
      const decision = evaluatePrivateRouteAccess(profiles.direction, materialize(policy.route));
      if (decision.allowed) expect(policy.readOnly).toBe(true);
    });
    expect(evaluatePrivateRouteAccess(profiles.direction, '/portail-direction').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(profiles.direction, '/payments/create').allowed).toBe(false);
  });

  it('préserve les interdits métier Mine les plus sensibles', () => {
    const mine = profiles.mine;
    expect(evaluatePrivateRouteAccess(mine, '/production/licenses/new').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(mine, '/production/licenses/123e4567-e89b-42d3-a456-426614174000').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(mine, '/production/licenses/edit/123e4567-e89b-42d3-a456-426614174000').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(mine, '/contrats/pilotage').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(mine, '/contrats/123e4567-e89b-42d3-a456-426614174000/modifier').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(mine, '/requisitions/nouvelle').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(mine, '/production/achats-mines').allowed).toBe(false);
  });

  it('résout le pattern le plus spécifique avant un paramètre générique', () => {
    expect(routePolicyFor('/artisan-minier/ventes-or/nouvelle')?.readOnly).toBe(false);
    expect(routePolicyFor('/production/licenses/edit/123e4567-e89b-42d3-a456-426614174000')?.accountTypes)
      .toEqual(['sonasp']);
  });

  it('refuse une capability SONASP injectée dans un compte partenaire', () => {
    const comptoir = profile('customer', [CAPABILITIES.COMPTOIR_MANAGE, CAPABILITIES.SONASP_APPROVE]);
    const decision = evaluatePrivateRouteAccess(comptoir, '/sonasp/cessions-comptoirs');
    expect(accountTypeFor(comptoir)).toBe('comptoir');
    expect(decision.allowed).toBe(false);
  });
});
