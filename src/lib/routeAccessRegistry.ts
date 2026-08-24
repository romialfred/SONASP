import { CAPABILITIES, hasAnyCapability, hasCapability, type CapabilityCode } from '@/lib/capabilities';
import type { UserProfile, UserRole } from '@/types/auth';

export type AccountType =
  | 'owner'
  | 'admin'
  | 'direction'
  | 'sonasp'
  | 'mine'
  | 'comptoir'
  | 'collector'
  | 'factory'
  | 'airport'
  | 'refinery'
  | 'customer'
  | 'unknown';

export interface PrivateRoutePolicy {
  route: string;
  roles: readonly UserRole[];
  accountTypes: readonly Exclude<AccountType, 'unknown'>[];
  capabilities: readonly CapabilityCode[];
  readOnly: boolean;
  national: boolean;
}

type PolicyWithoutRoute = Omit<PrivateRoutePolicy, 'route'>;

const ALL_ROLES: readonly UserRole[] = [
  'owner', 'admin', 'manager', 'management', 'mine', 'factory', 'airport', 'refinery', 'customer',
];
const ALL_ACCOUNT_TYPES: readonly Exclude<AccountType, 'unknown'>[] = [
  'owner', 'admin', 'direction', 'sonasp', 'mine', 'comptoir', 'collector',
  'factory', 'airport', 'refinery', 'customer',
];
export const PARTNER_ACCOUNT_TYPES: readonly Exclude<AccountType, 'unknown'>[] = [
  'mine', 'comptoir', 'collector', 'factory', 'airport', 'refinery', 'customer',
];
const SCOPED_REDIRECT_ACCOUNT_TYPES: readonly Exclude<AccountType, 'unknown'>[] = [
  'mine', 'comptoir', 'collector',
];

const SONASP: PolicyWithoutRoute = {
  roles: ['management'],
  accountTypes: ['sonasp'],
  capabilities: [],
  readOnly: false,
  national: true,
};

function policies(
  routes: readonly string[],
  policy: PolicyWithoutRoute,
): PrivateRoutePolicy[] {
  return routes.map((route) => ({ route, ...policy }));
}

const relationReadCapabilities: readonly CapabilityCode[] = [
  CAPABILITIES.MINE_OPERATE,
  CAPABILITIES.SONASP_WORKFLOW_READ,
  CAPABILITIES.SONASP_PREPARE,
  CAPABILITIES.SONASP_APPROVE,
  CAPABILITIES.FINANCE_EXECUTE,
  CAPABILITIES.FINANCE_RECONCILE,
];

/**
 * Source unique de politique d'accès frontend.
 *
 * Les rôles et types de compte sont vérifiés ensemble. Les capabilities sont
 * ensuite appliquées en OR lorsqu'une route en déclare. `readOnly` indique les
 * routes compatibles avec le compte Direction consultatif. `national` permet
 * de prouver qu'aucun portail partenaire n'hérite de la navigation SONASP.
 * Les RLS/RPC restent l'autorité de sécurité sur les données.
 */
export const PRIVATE_ROUTE_REGISTRY: readonly PrivateRoutePolicy[] = Object.freeze([
  ...policies(['/help', '/profile'], {
    roles: ALL_ROLES, accountTypes: ALL_ACCOUNT_TYPES, capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/portail-direction/*'], {
    roles: ['manager'], accountTypes: ['direction'], capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/portail-collecteur', '/portail-collecteur/stock', '/portail-collecteur/documents'], {
    roles: ['customer'], accountTypes: ['collector'], capabilities: [CAPABILITIES.COLLECTOR_OPERATE],
    readOnly: true, national: false,
  }),
  ...policies(['/portail-comptoir', '/portail-comptoir/stock', '/portail-comptoir/ventes-sonasp'], {
    roles: ['customer'], accountTypes: ['comptoir'], capabilities: [CAPABILITIES.COMPTOIR_MANAGE],
    readOnly: false, national: false,
  }),
  ...policies(['/portail-mine'], {
    roles: ['mine', 'customer'], accountTypes: ['mine'], capabilities: [CAPABILITIES.MINE_OPERATE],
    readOnly: false, national: false,
  }),
  ...policies(['/sonasp/cessions-comptoirs'], {
    roles: ['management', 'admin'], accountTypes: ['sonasp', 'admin'],
    capabilities: [
      CAPABILITIES.SONASP_PREPARE,
      CAPABILITIES.SONASP_APPROVE,
      CAPABILITIES.FINANCE_EXECUTE,
      CAPABILITIES.FINANCE_RECONCILE,
    ],
    readOnly: true, national: true,
  }),

  ...policies(['/dashboard'], {
    roles: ['owner', 'admin', 'management'], accountTypes: ['owner', 'admin', 'sonasp'],
    capabilities: [], readOnly: true, national: true,
  }),
  ...policies(['/dashboard/production-modern', '/dashboard/management'], {
    roles: ['management'], accountTypes: ['sonasp'],
    capabilities: [CAPABILITIES.REPORTS_READ, CAPABILITIES.SONASP_WORKFLOW_READ],
    readOnly: true, national: true,
  }),
  ...policies(['/dashboard/factory'], {
    roles: ['factory'], accountTypes: ['factory'], capabilities: [CAPABILITIES.FACTORY_OPERATE],
    readOnly: true, national: false,
  }),
  ...policies(['/dashboard/airport'], {
    roles: ['airport'], accountTypes: ['airport'], capabilities: [CAPABILITIES.AIRPORT_OPERATE],
    readOnly: true, national: false,
  }),
  ...policies(['/dashboard/refinery'], {
    roles: ['refinery'], accountTypes: ['refinery'], capabilities: [CAPABILITIES.REFINERY_OPERATE],
    readOnly: true, national: false,
  }),
  ...policies(['/dashboard/customer'], {
    roles: ['customer'], accountTypes: ['customer'], capabilities: [CAPABILITIES.CUSTOMER_OPERATE],
    readOnly: true, national: false,
  }),

  ...policies([
    '/artisan-minier',
    '/artisan-minier/cartes/suivi',
    '/artisan-minier/cartes/validation',
    '/artisan-minier/cartes/expirations',
    '/artisan-minier/:id/edit',
    '/artisan-minier/:artisanId/infractions/nouvelle',
    '/artisan-minier/:artisanId/infractions/:infractionId',
    '/artisan-minier/:artisanId/infractions/:infractionId/modifier',
  ], SONASP),
  ...policies(['/artisan-minier/liste', '/artisan-minier/:id'], {
    roles: ['management', 'customer'], accountTypes: ['sonasp', 'comptoir', 'collector'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/artisan-minier/ventes-or', '/artisan-minier/ventes-or/:id'], {
    roles: ['management', 'customer'], accountTypes: ['sonasp', 'comptoir', 'collector'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies([
    '/artisan-minier/ventes-or/nouvelle',
    '/artisan-minier/ventes-or/:id/modifier',
    '/artisan-minier/paiements/:venteId/nouveau',
  ], {
    roles: ['management', 'customer'], accountTypes: ['sonasp', 'comptoir'],
    capabilities: [], readOnly: false, national: false,
  }),
  ...policies(['/artisan-minier/ventes-or/:id/facture'], {
    roles: ['management', 'customer'], accountTypes: ['sonasp', 'comptoir'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/artisan-minier/paiements', '/artisan-minier/rapports'], {
    roles: ['management', 'customer'], accountTypes: ['sonasp', 'comptoir'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/artisan-minier/paiements/historique', '/artisan-minier/rapports/taxes'], {
    roles: ['management', 'customer'], accountTypes: ['sonasp', 'comptoir', 'collector'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/artisan-minier/rapports/chiffre-affaires', '/artisan-minier/rapports/quantites'], {
    roles: ['management', 'customer'], accountTypes: ['sonasp', 'comptoir'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/artisan-sites', '/artisan-sites/nouveau', '/artisan-sites/:siteId/modifier', '/artisan-sites/production'], SONASP),

  ...policies(['/production/achats-mines', '/achats/plans', '/achats/plans/:id', '/achats/comptes'], SONASP),
  ...policies(['/achats/demandes'], {
    roles: ['management', 'mine', 'customer'], accountTypes: ['sonasp', 'mine'],
    capabilities: relationReadCapabilities, readOnly: true, national: false,
  }),
  ...policies(['/achats/reglements'], {
    roles: ['management', 'mine', 'customer'], accountTypes: ['sonasp', 'mine'],
    capabilities: relationReadCapabilities, readOnly: true, national: false,
  }),
  ...policies(['/achats/reglements/nouveau'], {
    roles: ['management'], accountTypes: ['sonasp'], capabilities: [CAPABILITIES.FINANCE_EXECUTE],
    readOnly: false, national: true,
  }),
  ...policies(['/contrats', '/contrats/:id'], {
    roles: ['management', 'mine', 'customer'], accountTypes: ['sonasp', 'mine'],
    capabilities: relationReadCapabilities, readOnly: true, national: false,
  }),
  ...policies(['/contrats/pilotage'], {
    roles: ['management'], accountTypes: ['sonasp'],
    capabilities: [CAPABILITIES.SONASP_WORKFLOW_READ, CAPABILITIES.SONASP_PREPARE],
    readOnly: true, national: true,
  }),
  ...policies(['/contrats/nouveau'], {
    roles: ['management', 'mine', 'customer'], accountTypes: ['sonasp', 'mine'],
    capabilities: [CAPABILITIES.MINE_OPERATE, CAPABILITIES.SONASP_PREPARE],
    readOnly: false, national: false,
  }),
  ...policies(['/contrats/:id/modifier'], {
    roles: ['management'], accountTypes: ['sonasp'], capabilities: [CAPABILITIES.SONASP_PREPARE],
    readOnly: false, national: true,
  }),
  ...policies(['/requisitions', '/requisitions/:id'], {
    roles: ['management', 'mine', 'customer'], accountTypes: ['sonasp', 'mine'],
    capabilities: relationReadCapabilities, readOnly: true, national: false,
  }),
  ...policies(['/requisitions/nouvelle', '/requisitions/:id/modifier'], {
    roles: ['management'], accountTypes: ['sonasp'], capabilities: [CAPABILITIES.SONASP_PREPARE],
    readOnly: false, national: true,
  }),
  ...policies(['/production/daily', '/production/:id', '/production/in-safe'], {
    roles: ['management', 'mine', 'customer', 'factory'], accountTypes: ['sonasp', 'mine', 'factory'],
    capabilities: [
      CAPABILITIES.SONASP_WORKFLOW_READ,
      CAPABILITIES.SONASP_PREPARE,
      CAPABILITIES.REPORTS_READ,
      CAPABILITIES.MINE_OPERATE,
      CAPABILITIES.FACTORY_OPERATE,
    ],
    readOnly: false, national: false,
  }),
  ...policies([
    '/production/licenses', '/production/licenses/new',
    '/production/licenses/:id', '/performance/budgets', '/performance/forecasts',
  ], {
    roles: ['management', 'mine', 'customer'], accountTypes: ['sonasp', 'mine'],
    capabilities: [CAPABILITIES.SONASP_PREPARE, CAPABILITIES.SONASP_WORKFLOW_READ, CAPABILITIES.MINE_OPERATE],
    readOnly: false, national: false,
  }),
  ...policies(['/production/licenses/requests'], {
    roles: ['management'], accountTypes: ['sonasp'], capabilities: [CAPABILITIES.SONASP_APPROVE],
    readOnly: false, national: true,
  }),
  ...policies(['/production/licenses/edit/:id'], {
    roles: ['management'], accountTypes: ['sonasp'], capabilities: [CAPABILITIES.SONASP_PREPARE],
    readOnly: false, national: true,
  }),

  ...policies(['/users', '/users/new', '/users/edit', '/users/:userId', '/admin/users', '/admin/users/:userId/permissions'], {
    roles: ['admin'], accountTypes: ['admin'], capabilities: [CAPABILITIES.ACCOUNTS_MANAGE],
    readOnly: false, national: true,
  }),
  ...policies(['/admin/status-manager', '/admin/modules'], {
    roles: ['admin'], accountTypes: ['admin'], capabilities: [CAPABILITIES.REFERENTIALS_MANAGE],
    readOnly: false, national: true,
  }),
  ...policies(['/parameters'], {
    roles: ['admin', 'management'], accountTypes: ['admin', 'sonasp'], capabilities: [],
    readOnly: true, national: true,
  }),
  ...policies(['/approvals'], {
    roles: ['management'], accountTypes: ['sonasp'], capabilities: [CAPABILITIES.SONASP_APPROVE],
    readOnly: false, national: true,
  }),
  ...policies([
    '/admin/transport-companies', '/admin/transport-companies/new', '/admin/transport-companies/edit/:id',
    '/admin/refineries', '/admin/refineries/new', '/admin/refineries/edit/:id',
    '/admin/gold-sales-settings',
  ], {
    roles: ['admin', 'management'], accountTypes: ['admin', 'sonasp'],
    capabilities: [CAPABILITIES.REFERENTIALS_MANAGE, CAPABILITIES.SONASP_PREPARE],
    readOnly: false, national: true,
  }),
  ...policies(['/admin/workflow'], {
    roles: ['management'], accountTypes: ['sonasp'], capabilities: [CAPABILITIES.SONASP_WORKFLOW_READ],
    readOnly: true, national: true,
  }),
  ...policies(['/admin/messagerie', '/admin/messagerie/nouveau', '/admin/messagerie/:uid'], {
    roles: ['admin'], accountTypes: ['admin'], capabilities: [CAPABILITIES.EMAIL_SETTINGS_MANAGE],
    readOnly: false, national: true,
  }),

  ...policies(['/gold-prices', '/fx-rates'], {
    roles: ['management', 'mine', 'customer', 'factory', 'airport', 'refinery'],
    accountTypes: ['sonasp', 'mine', 'factory', 'airport', 'refinery', 'customer'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies([
    '/shipping/preparation', '/shipping/preparation/:id', '/shipping/preparation/:id/details',
    '/freight', '/freight/shipments/:id', '/documents/assay-certificates', '/shipping',
  ], {
    roles: ['management', 'mine', 'customer', 'factory', 'airport'],
    accountTypes: ['sonasp', 'mine', 'factory', 'airport'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies([
    '/shipping/preparation/new', '/shipping/preparation/edit/:id', '/shipping/preparation/:id/edit',
    '/freight/shipments/create',
  ], {
    roles: ['management', 'mine', 'customer', 'factory', 'airport'],
    accountTypes: ['sonasp', 'mine', 'factory', 'airport'],
    capabilities: [], readOnly: false, national: false,
  }),
  ...policies(['/freight-customs', '/freight-customs/:id'], {
    roles: ['management', 'mine', 'customer', 'airport'], accountTypes: ['sonasp', 'mine', 'airport'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/freight-customs/create'], {
    roles: ['management', 'mine', 'customer', 'airport'], accountTypes: ['sonasp', 'mine', 'airport'],
    capabilities: [], readOnly: false, national: false,
  }),
  ...policies(['/inventory', '/inventory/silver'], {
    roles: ['management', 'mine', 'customer', 'refinery'], accountTypes: ['sonasp', 'mine', 'refinery'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/inventory/add'], {
    roles: ['management', 'refinery'], accountTypes: ['sonasp', 'refinery'],
    capabilities: [], readOnly: false, national: false,
  }),
  ...policies(['/refining', '/refining/freight-shipments'], {
    roles: ['management', 'mine', 'customer', 'refinery'], accountTypes: ['sonasp', 'mine', 'refinery'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/refining/:id/process'], {
    roles: ['management', 'refinery'], accountTypes: ['sonasp', 'refinery'],
    capabilities: [], readOnly: false, national: false,
  }),

  ...policies(['/sales', '/sales/:id'], {
    roles: ['management', 'mine', 'customer', 'refinery'], accountTypes: ['sonasp', 'mine', 'refinery', 'customer'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/sales/new', '/sales/trade-space'], {
    roles: ['management', 'mine', 'customer'], accountTypes: ['sonasp', 'mine'],
    capabilities: [CAPABILITIES.SONASP_PREPARE, CAPABILITIES.MINE_OPERATE],
    readOnly: false, national: false,
  }),
  ...policies(['/sales/approve/:saleId', '/sales/approve/:saleId/:token'], {
    roles: ['management', 'customer'], accountTypes: ['sonasp', 'customer'],
    capabilities: [], readOnly: false, national: false,
  }),
  ...policies(['/customers', '/customers/:id'], {
    roles: ['management', 'mine', 'customer'], accountTypes: ['sonasp', 'mine'],
    capabilities: [CAPABILITIES.SONASP_WORKFLOW_READ, CAPABILITIES.SONASP_PREPARE, CAPABILITIES.MINE_OPERATE],
    readOnly: true, national: false,
  }),
  ...policies(['/customers/new', '/customers/:id/edit'], {
    roles: ['management'], accountTypes: ['sonasp'], capabilities: [CAPABILITIES.SONASP_PREPARE],
    readOnly: false, national: true,
  }),
  ...policies(['/payments', '/payments/:id', '/payments/virtual'], {
    roles: ['management', 'mine', 'customer'], accountTypes: ['sonasp', 'mine', 'customer'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/payments/create', '/payments/record'], {
    roles: ['management', 'customer'], accountTypes: ['sonasp', 'customer'],
    capabilities: [], readOnly: false, national: false,
  }),
  ...policies(['/analytics', '/analytics/national', '/analytics/ventes', '/analytics/production'], {
    roles: ['management'], accountTypes: ['sonasp'], capabilities: [CAPABILITIES.REPORTS_READ],
    readOnly: true, national: true,
  }),
  ...policies(['/reports'], {
    roles: ['management', 'mine', 'customer', 'factory', 'airport', 'refinery'],
    accountTypes: ['sonasp', 'mine', 'factory', 'airport', 'refinery', 'customer'],
    capabilities: [
      CAPABILITIES.REPORTS_READ,
      CAPABILITIES.MINE_OPERATE,
      CAPABILITIES.FACTORY_OPERATE,
      CAPABILITIES.AIRPORT_OPERATE,
      CAPABILITIES.REFINERY_OPERATE,
      CAPABILITIES.CUSTOMER_OPERATE,
    ],
    readOnly: true, national: false,
  }),

  ...policies([
    '/stakeholders/mining-companies', '/stakeholders/mining-companies/new',
    '/stakeholders/mining-companies/:id', '/stakeholders/mining-companies/:id/edit',
    '/stakeholders/approvers',
  ], {
    roles: ['management', 'admin'], accountTypes: ['sonasp', 'admin'],
    capabilities: [CAPABILITIES.REFERENTIALS_MANAGE, CAPABILITIES.SONASP_PREPARE],
    readOnly: false, national: true,
  }),
  ...policies(['/stakeholders/depositors'], {
    roles: ['management', 'admin', 'mine', 'customer'], accountTypes: ['sonasp', 'admin', 'mine'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/stakeholders/depositors/new', '/stakeholders/depositors/:id/edit'], {
    roles: ['management', 'admin', 'mine', 'customer'], accountTypes: ['sonasp', 'admin', 'mine'],
    capabilities: [], readOnly: false, national: false,
  }),
  ...policies(['/stakeholders/freight-companies', '/stakeholders/refinery-plants'], {
    roles: ['management', 'admin', 'mine', 'customer'], accountTypes: ['sonasp', 'admin', 'mine'],
    capabilities: [], readOnly: true, national: false,
  }),
  ...policies(['/audit'], {
    roles: ['management', 'admin'], accountTypes: ['sonasp', 'admin'], capabilities: [CAPABILITIES.REPORTS_READ],
    readOnly: true, national: true,
  }),
]);

const KNOWN_ROLES = new Set<UserRole>(ALL_ROLES);

/** Déduit un seul périmètre ; toute combinaison non reconnue reste fermée. */
export function accountTypeFor(user: Partial<UserProfile> | null | undefined): AccountType {
  if (!user?.is_active || !KNOWN_ROLES.has(user.role as UserRole)) return 'unknown';
  const role = user.role as UserRole;
  const hasMineTenant = typeof user.mining_company_id === 'string' && user.mining_company_id.length > 0;

  if (role === 'owner') return hasMineTenant ? 'unknown' : 'owner';
  if (role === 'admin') return hasMineTenant ? 'unknown' : 'admin';
  if (role === 'management') return hasMineTenant ? 'unknown' : 'sonasp';
  if (role === 'manager') return hasMineTenant ? 'unknown' : 'direction';
  if (role === 'mine') {
    return hasMineTenant && hasCapability(user as UserProfile, CAPABILITIES.MINE_OPERATE)
      ? 'mine'
      : 'unknown';
  }
  if (role === 'factory') {
    return !hasMineTenant && hasCapability(user as UserProfile, CAPABILITIES.FACTORY_OPERATE)
      ? 'factory'
      : 'unknown';
  }
  if (role === 'airport') {
    return !hasMineTenant && hasCapability(user as UserProfile, CAPABILITIES.AIRPORT_OPERATE)
      ? 'airport'
      : 'unknown';
  }
  if (role === 'refinery') {
    return !hasMineTenant && hasCapability(user as UserProfile, CAPABILITIES.REFINERY_OPERATE)
      ? 'refinery'
      : 'unknown';
  }

  // Les anciens comptes Société minière utilisent parfois encore `customer`.
  if (hasMineTenant) {
    return hasCapability(user as UserProfile, CAPABILITIES.MINE_OPERATE) ? 'mine' : 'unknown';
  }
  // Un collecteur peut aussi porter comptoir.manage : le périmètre le plus
  // étroit gagne, sans jamais lui ouvrir les opérations du comptoir.
  if (hasCapability(user as UserProfile, CAPABILITIES.COLLECTOR_OPERATE)) return 'collector';
  if (hasCapability(user as UserProfile, CAPABILITIES.COMPTOIR_MANAGE)) return 'comptoir';
  return hasCapability(user as UserProfile, CAPABILITIES.CUSTOMER_OPERATE) ? 'customer' : 'unknown';
}

function normalizePath(pathname: string): string | null {
  const raw = pathname.split(/[?#]/u, 1)[0];
  if (!raw.startsWith('/') || raw.length > 2_048 || /[\\\u0000-\u001f\u007f]/u.test(raw)) return null;
  return raw.length > 1 ? raw.replace(/\/+$/u, '') : raw;
}

function matchesRoutePattern(pattern: string, pathname: string): boolean {
  const path = normalizePath(pathname);
  const expected = normalizePath(pattern);
  if (!path || !expected) return false;
  if (path === expected) return true;
  const pathSegments = path.split('/').slice(1);
  const patternSegments = expected.split('/').slice(1);

  for (let index = 0; index < patternSegments.length; index += 1) {
    const segment = patternSegments[index];
    if (segment === '*') return true;
    const actual = pathSegments[index];
    if (!actual || (!segment.startsWith(':') && segment !== actual)) return false;
  }
  return pathSegments.length === patternSegments.length;
}

function specificity(pattern: string): number {
  return pattern.split('/').reduce((score, segment) => {
    if (segment === '*') return score - 100;
    if (segment.startsWith(':')) return score + 1;
    return score + 20;
  }, pattern.length);
}

export function routePolicyFor(pathname: string): PrivateRoutePolicy | null {
  const matches = PRIVATE_ROUTE_REGISTRY.filter((policy) => matchesRoutePattern(policy.route, pathname));
  matches.sort((left, right) => specificity(right.route) - specificity(left.route));
  return matches[0] ?? null;
}

export type RouteDenialReason = 'unknown-profile' | 'unregistered-route' | 'role' | 'account-type' | 'capability' | 'read-only';

export type RouteAccessDecision =
  | { allowed: true; accountType: Exclude<AccountType, 'unknown'>; policy: PrivateRoutePolicy }
  | {
      allowed: false;
      accountType: AccountType;
      policy: PrivateRoutePolicy | null;
      reason: RouteDenialReason;
      redirectTo: string | null;
    };

export function homePathForAccountType(accountType: AccountType): string | null {
  switch (accountType) {
    case 'owner':
    case 'admin':
    case 'sonasp': return '/dashboard';
    case 'direction': return '/portail-direction';
    case 'mine': return '/portail-mine';
    case 'comptoir': return '/portail-comptoir';
    case 'collector': return '/portail-collecteur';
    case 'factory': return '/dashboard/factory';
    case 'airport': return '/dashboard/airport';
    case 'refinery': return '/dashboard/refinery';
    case 'customer': return '/dashboard/customer';
    case 'unknown': return null;
  }
}

export function evaluatePrivateRouteAccess(
  user: Partial<UserProfile> | null | undefined,
  pathname: string,
): RouteAccessDecision {
  const accountType = accountTypeFor(user);
  const policy = routePolicyFor(pathname);
  const partnerRedirect = SCOPED_REDIRECT_ACCOUNT_TYPES.includes(accountType as Exclude<AccountType, 'unknown'>)
    || accountType === 'direction';
  const redirectTo = partnerRedirect ? homePathForAccountType(accountType) : null;
  if (accountType === 'unknown') {
    return { allowed: false, accountType, policy, reason: 'unknown-profile', redirectTo: null };
  }
  if (!policy) {
    return { allowed: false, accountType, policy: null, reason: 'unregistered-route', redirectTo };
  }
  // Le propriétaire reste le seul périmètre transversal, mais uniquement sur
  // une route explicitement enregistrée : aucune URL privée inconnue n'est ouverte.
  if (accountType === 'owner') return { allowed: true, accountType, policy };
  if (!policy.roles.includes(user?.role as UserRole)) {
    return { allowed: false, accountType, policy, reason: 'role', redirectTo };
  }
  if (!policy.accountTypes.includes(accountType)) {
    return { allowed: false, accountType, policy, reason: 'account-type', redirectTo };
  }
  if (accountType === 'direction' && !policy.readOnly) {
    return { allowed: false, accountType, policy, reason: 'read-only', redirectTo };
  }
  if (
    policy.capabilities.length > 0
    && !hasAnyCapability(user as UserProfile, [...policy.capabilities])
  ) {
    return { allowed: false, accountType, policy, reason: 'capability', redirectTo };
  }
  return { allowed: true, accountType, policy };
}

export function canAccessPrivateRoute(
  user: Partial<UserProfile> | null | undefined,
  pathname: string,
): boolean {
  return evaluatePrivateRouteAccess(user, pathname).allowed;
}

/** Compatibilité des anciens helpers de portail, désormais adossés au registre. */
export function canAccountTypeAccessPath(
  accountType: Exclude<AccountType, 'unknown'>,
  pathname: string,
): boolean {
  const policy = routePolicyFor(pathname);
  return Boolean(policy?.accountTypes.includes(accountType));
}

/** Utilisé dans PrivateApp pour faire échouer immédiatement une route mal enregistrée. */
export function privateRoutePath<TPath extends string>(path: TPath): TPath {
  if (!PRIVATE_ROUTE_REGISTRY.some((policy) => policy.route === path)) {
    throw new Error(`Route privée non enregistrée: ${path}`);
  }
  return path;
}
