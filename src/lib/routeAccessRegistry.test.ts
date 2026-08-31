import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, hasAnyCapability } from '@/lib/capabilities';
import type { UserProfile, UserRole } from '@/types/auth';
import { PLATFORM_MODULE_CATALOG, platformModuleCodeForPath } from './platformModuleCatalog';
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
  const institutionalOrganization = role === 'dgmg' || role === 'dgi'
    ? { organization_id: `${role}-organization`, organization_type: role }
    : {};
  return {
    id: `${role}-user`, email: `${role}@example.bf`, full_name: role, phone: null,
    role, mining_company_id: miningCompanyId, site_ids: [], is_active: true,
    ...institutionalOrganization,
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
  dgmg: profile('dgmg', [CAPABILITIES.DGMG_SUPERVISE]),
  dgi: profile('dgi', [CAPABILITIES.DGI_FISCAL_CONTROL]),
  mine: profile('mine', [CAPABILITIES.MINE_OPERATE], '9b3fcaaa-9367-4c91-a82d-788f043f33f1'),
  comptoir: profile('comptoir', [CAPABILITIES.COMPTOIR_MANAGE]),
  collector: profile('collector', [
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
          || hasAnyCapability(user, [...policy.capabilities]);
        const expected = accountType === 'owner' || (
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

  it('ouvre au Owner actif toutes les routes privées enregistrées, et seulement celles-ci', () => {
    PRIVATE_ROUTE_REGISTRY.forEach(({ route }) => {
      expect(
        evaluatePrivateRouteAccess(profiles.owner, materialize(route)).allowed,
        route,
      ).toBe(true);
    });
    expect(evaluatePrivateRouteAccess(profiles.owner, '/route-non-enregistree').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess({ ...profiles.owner, is_active: false }, '/dashboard').allowed).toBe(false);
  });

  it('ouvre à l’Administrateur les modules nationaux explicitement attribués, jamais les portails partenaires', () => {
    const administrator = {
      ...profiles.admin,
      module_codes: ['mining_sites', 'administration'],
    };

    expect(evaluatePrivateRouteAccess(administrator, '/artisan-sites').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(administrator, '/admin/permissions').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(administrator, '/admin/audit').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(administrator, '/sales').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(administrator, '/portail-mine').allowed).toBe(false);
  });

  it('ouvre tous les écrans nationaux attribués à Admin, dont le raffinage de la capture', () => {
    const administrator = { ...profiles.admin, module_codes: PLATFORM_MODULE_CATALOG.map(({ code }) => code) };
    for (const policy of PRIVATE_ROUTE_REGISTRY) {
      const path = materialize(policy.route);
      if (!path.startsWith('/portail-') && platformModuleCodeForPath(path)) {
        expect(evaluatePrivateRouteAccess(administrator, path).allowed, path).toBe(true);
      }
    }
    expect(evaluatePrivateRouteAccess(administrator, '/refining').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess({ ...administrator, module_codes: [] }, '/refining')).toMatchObject({
      allowed: false, reason: 'module',
    });
    expect(evaluatePrivateRouteAccess({ ...administrator, is_active: false }, '/refining').allowed).toBe(false);
  });

  it('refuse aussi une URL directe lorsque le module canonique n’est pas attribué', () => {
    const agent = {
      ...profiles.sonasp,
      module_codes: ['dashboard', 'production'],
    };

    expect(evaluatePrivateRouteAccess(agent, '/production/daily').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(agent, '/national-reserve/allocations')).toMatchObject({
      allowed: false,
      reason: 'module',
    });
    expect(evaluatePrivateRouteAccess(agent, '/sales')).toMatchObject({
      allowed: false,
      reason: 'module',
    });
  });

  it('oppose les modules attribués aux portails DGI et DGMG, y compris par URL directe', () => {
    const dgi = { ...profiles.dgi, module_codes: ['dashboard', 'conciliation'] };
    const dgmg = { ...profiles.dgmg, module_codes: ['dashboard', 'mining_sites'] };

    expect(evaluatePrivateRouteAccess(dgi, '/portail-dgi').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(dgi, '/conciliation').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(dgi, '/artisan-minier/paiements/historique')).toMatchObject({
      allowed: false,
      reason: 'module',
    });
    expect(evaluatePrivateRouteAccess(dgmg, '/artisan-sites').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(dgmg, '/production/daily')).toMatchObject({
      allowed: false,
      reason: 'module',
    });
  });

  it('ferme le portail institutionnel si le rattachement est absent ou incompatible', () => {
    const dgiSansOrganisation = {
      ...profiles.dgi,
      organization_id: null,
      organization_type: null,
    };
    const dgmgDansUneOrganisationDgi = {
      ...profiles.dgmg,
      organization_id: 'dgi-organization',
      organization_type: 'dgi',
    };

    expect(accountTypeFor(dgiSansOrganisation)).toBe('unknown');
    expect(accountTypeFor(dgmgDansUneOrganisationDgi)).toBe('unknown');
    expect(evaluatePrivateRouteAccess(dgiSansOrganisation, '/portail-dgi')).toMatchObject({
      allowed: false,
      reason: 'unknown-profile',
    });
    expect(evaluatePrivateRouteAccess(dgmgDansUneOrganisationDgi, '/portail-dgmg')).toMatchObject({
      allowed: false,
      reason: 'unknown-profile',
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
    expect(evaluatePrivateRouteAccess(mine, '/production/licenses/requests').allowed).toBe(false);
  });

  it('réserve la mutation des affectations nationales à la SONASP', () => {
    expect(evaluatePrivateRouteAccess(profiles.owner, '/national-reserve/allocations/new').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(profiles.sonasp, '/national-reserve/allocations/new').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(profiles.dgmg, '/national-reserve/allocations').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(profiles.dgmg, '/national-reserve/allocations/new').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(profiles.mine, '/national-reserve/allocations').allowed).toBe(false);
    expect(routePolicyFor('/national-reserve/allocations/new')).toMatchObject({
      accountTypes: ['sonasp'], national: true, readOnly: false,
    });
  });

  it('ouvre à la DGMG uniquement la file niveau 1 attribuée, jamais les routes patrimoniales', () => {
    const validator = {
      ...profiles.dgmg,
      capabilities: [
        CAPABILITIES.DGMG_SUPERVISE,
        CAPABILITIES.RESERVE_ALLOCATIONS_VALIDATE_LEVEL_1,
      ],
      module_codes: ['dashboard', 'national_reserve'],
    };
    const noModule = { ...validator, module_codes: ['dashboard'] };
    const noCapability = {
      ...validator,
      capabilities: [CAPABILITIES.DGMG_SUPERVISE],
    };

    expect(evaluatePrivateRouteAccess(validator, '/portail-dgmg/reserve-validations').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(noModule, '/portail-dgmg/reserve-validations')).toMatchObject({
      allowed: false, reason: 'module',
    });
    expect(evaluatePrivateRouteAccess(noCapability, '/portail-dgmg/reserve-validations')).toMatchObject({
      allowed: false, reason: 'capability',
    });
    expect(evaluatePrivateRouteAccess(validator, '/national-reserve')).toMatchObject({ allowed: false });
    expect(evaluatePrivateRouteAccess(validator, '/national-reserve/allocations')).toMatchObject({ allowed: false });
    expect(evaluatePrivateRouteAccess(validator, '/national-reserve/audit')).toMatchObject({ allowed: false });
  });

  it('réserve la boîte des demandes de licences au périmètre national SONASP approbateur', () => {
    const approver = profile('management', [CAPABILITIES.SONASP_APPROVE]);
    const preparer = profile('management', [CAPABILITIES.SONASP_PREPARE]);
    const injectedMine = profile('mine', [CAPABILITIES.MINE_OPERATE, CAPABILITIES.SONASP_APPROVE], 'mine-1');
    const policy = routePolicyFor('/production/licenses/requests');

    expect(evaluatePrivateRouteAccess(approver, '/production/licenses/requests').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(preparer, '/production/licenses/requests')).toMatchObject({
      allowed: false,
      reason: 'capability',
    });
    expect(evaluatePrivateRouteAccess(injectedMine, '/production/licenses/requests').allowed).toBe(false);
    expect(policy).toMatchObject({ accountTypes: ['sonasp'], national: true, readOnly: false });
  });

  it('résout le pattern le plus spécifique avant un paramètre générique', () => {
    expect(routePolicyFor('/artisan-minier/ventes-or/nouvelle')?.readOnly).toBe(false);
    expect(routePolicyFor('/production/licenses/edit/123e4567-e89b-42d3-a456-426614174000')?.accountTypes)
      .toEqual(['sonasp']);
    expect(routePolicyFor('/production/licenses/requests')?.capabilities)
      .toEqual([CAPABILITIES.SONASP_APPROVE]);
  });

  it('refuse une capability SONASP injectée dans un compte partenaire', () => {
    const comptoir = profile('customer', [CAPABILITIES.COMPTOIR_MANAGE, CAPABILITIES.SONASP_APPROVE]);
    const decision = evaluatePrivateRouteAccess(comptoir, '/sonasp/cessions-comptoirs');
    expect(accountTypeFor(comptoir)).toBe('comptoir');
    expect(decision.allowed).toBe(false);
  });
});
