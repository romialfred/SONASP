import type { ModuleDomain } from '@/lib/accessControl';

/**
 * Référentiel fonctionnel unique des modules visibles dans la navigation SONASP.
 *
 * `code` est immuable et partagé par :
 * - `snp_modules.code` pour la navigation et sa visibilité ;
 * - `modules.name` pour les habilitations de comptes ;
 * - `NavigationGroup.moduleCode` pour rattacher la sidebar au référentiel.
 *
 * Les libellés peuvent évoluer, jamais les codes.
 */
export interface PlatformModuleDefinition {
  navigationGroupId: string;
  code: string;
  label: string;
  description: string;
  category: string;
  accessDomain: ModuleDomain;
  route: string;
  sortOrder: number;
}

export interface PlatformSubmoduleDefinition {
  code: string;
  parentCode: PlatformModuleCode;
  label: string;
  description: string;
  route: string;
  sortOrder: number;
}

export const PLATFORM_MODULE_CATALOG = [
  {
    navigationGroupId: 'dashboard',
    code: 'dashboard',
    label: 'Tableau de bord',
    description: 'Vue nationale de pilotage de la plateforme.',
    category: 'pilotage',
    accessDomain: 'reports',
    route: '/dashboard',
    sortOrder: 1,
  },
  {
    navigationGroupId: 'sites-miniers',
    code: 'mining_sites',
    label: 'Sites artisanaux',
    description: 'Référentiel, formalisation et suivi des sites artisanaux.',
    category: 'mines_semi_mecanisees',
    accessDomain: 'sites',
    route: '/artisan-sites',
    sortOrder: 10,
  },
  {
    navigationGroupId: 'artisans',
    code: 'artisan-minier',
    label: 'Artisans miniers',
    description: 'Gestion des artisans, cartes et rattachements.',
    category: 'mines_semi_mecanisees',
    accessDomain: 'artisans',
    route: '/artisan-minier/liste',
    sortOrder: 11,
  },
  {
    navigationGroupId: 'marche-artisanal',
    code: 'artisan_gold_market',
    label: 'Marché d’or artisanal',
    description: 'Ventes, paiements et analyses de la collecte artisanale.',
    category: 'mines_semi_mecanisees',
    accessDomain: 'artisans',
    route: '/artisan-minier/paiements',
    sortOrder: 12,
  },
  {
    navigationGroupId: 'conciliation',
    code: 'conciliation',
    label: 'Conciliation',
    description: 'Dossiers de conciliation et règles fiscales applicables.',
    category: 'mines_industrielles',
    accessDomain: 'reconciliation',
    route: '/conciliation',
    sortOrder: 20,
  },
  {
    navigationGroupId: 'production',
    code: 'production',
    label: 'Collecte de l’or',
    description: 'Production, collecte, licences et prévisions.',
    category: 'mines_industrielles',
    accessDomain: 'production',
    route: '/production/daily',
    sortOrder: 21,
  },
  {
    navigationGroupId: 'achats-industriels',
    code: 'gold_purchases',
    label: 'Achats d’or',
    description: 'Contrats, plans, réquisitions et règlements des achats d’or.',
    category: 'mines_industrielles',
    accessDomain: 'purchases',
    route: '/achats/plans',
    sortOrder: 22,
  },
  {
    navigationGroupId: 'shipping',
    code: 'shipping',
    label: 'Expéditions',
    description: 'Préparation, fret et formalités douanières.',
    category: 'mines_industrielles',
    accessDomain: 'shipping',
    route: '/shipping/preparation',
    sortOrder: 23,
  },
  {
    navigationGroupId: 'refining',
    code: 'refining',
    label: 'Raffinage',
    description: 'Suivi des lots, traitements et résultats de raffinage.',
    category: 'mines_industrielles',
    accessDomain: 'refining',
    route: '/refining',
    sortOrder: 24,
  },
  {
    navigationGroupId: 'inventory',
    code: 'gold_inventory',
    label: 'Suivi des stocks',
    description: 'Position opérationnelle, disponibilités, transit et alimentation des stocks.',
    category: 'mines_industrielles',
    accessDomain: 'inventory',
    route: '/inventory',
    sortOrder: 25,
  },
  {
    navigationGroupId: 'national-reserve',
    code: 'national_reserve',
    label: 'Réserve nationale',
    description: 'Affectation, conservation, contrôle et valorisation du patrimoine aurifère national.',
    category: 'mines_industrielles',
    accessDomain: 'inventory',
    route: '/national-reserve',
    sortOrder: 26,
  },
  {
    navigationGroupId: 'market',
    code: 'international_markets',
    label: 'Marchés internationaux',
    description: 'Simulation financière, espace de négoce, cours de l’or et taux de change.',
    category: 'mines_industrielles',
    accessDomain: 'sales',
    route: '/sales/simulator',
    sortOrder: 27,
  },
  {
    navigationGroupId: 'sales',
    code: 'sales',
    label: 'Vente d’or international',
    description: 'Ventes internationales et règlements associés.',
    category: 'mines_industrielles',
    accessDomain: 'sales',
    route: '/sales',
    sortOrder: 28,
  },
  {
    navigationGroupId: 'stakeholders',
    code: 'stakeholders',
    label: 'Parties prenantes',
    description: 'Organisations et partenaires de la chaîne de valeur.',
    category: 'mines_industrielles',
    accessDomain: 'customers',
    route: '/stakeholders/organizations',
    sortOrder: 29,
  },
  {
    navigationGroupId: 'documents',
    code: 'documents',
    label: 'Documents',
    description: 'Certificats, pièces justificatives et rapports.',
    category: 'mines_industrielles',
    accessDomain: 'documents',
    route: '/documents/assay-certificates',
    sortOrder: 30,
  },
  {
    navigationGroupId: 'settings',
    code: 'settings',
    label: 'Paramètres',
    description: 'Paramètres généraux et référentiels fonctionnels.',
    category: 'administration',
    accessDomain: 'settings',
    route: '/parameters',
    sortOrder: 40,
  },
  {
    navigationGroupId: 'administration',
    code: 'administration',
    label: 'Administration',
    description: 'Utilisateurs, modules et messagerie administrative.',
    category: 'administration',
    accessDomain: 'users',
    route: '/admin/modules',
    sortOrder: 41,
  },
  {
    navigationGroupId: 'vue-ventes',
    code: 'sales_analytics',
    label: 'Analyses des ventes',
    description: 'Indicateurs et analyses consolidées des ventes.',
    category: 'rapports_analyses',
    accessDomain: 'reports',
    route: '/analytics/ventes',
    sortOrder: 50,
  },
  {
    navigationGroupId: 'vue-production',
    code: 'production_analytics',
    label: 'Rapports de production',
    description: 'Indicateurs et analyses consolidées de la production.',
    category: 'rapports_analyses',
    accessDomain: 'reports',
    route: '/analytics/production',
    sortOrder: 51,
  },
  {
    navigationGroupId: 'rapports-institutionnels',
    code: 'reports',
    label: 'Rapports institutionnels',
    description: 'Rapports réglementaires et institutionnels.',
    category: 'rapports_analyses',
    accessDomain: 'reports',
    route: '/reports',
    sortOrder: 52,
  },
  {
    navigationGroupId: 'performance-nationale',
    code: 'analytics',
    label: 'Performance nationale',
    description: 'Performance nationale et tendances consolidées.',
    category: 'rapports_analyses',
    accessDomain: 'reports',
    route: '/analytics',
    sortOrder: 53,
  },
] as const satisfies readonly PlatformModuleDefinition[];

export type PlatformModuleCode = (typeof PLATFORM_MODULE_CATALOG)[number]['code'];

/**
 * Sous-modules d'administration réellement routés par l'application.
 *
 * Cette liste alimente la sidebar et sert de contrat à la migration SQL. Une
 * entrée visible dans « Gestion des modules » ne peut donc plus être oubliée
 * dans la navigation du Owner/Administrateur.
 */
export const ADMINISTRATION_SUBMODULE_CATALOG = [
  {
    code: 'admin-modules',
    parentCode: 'administration',
    label: 'Modules',
    description: 'Gestion du catalogue fonctionnel et de sa visibilité.',
    route: '/admin/modules',
    sortOrder: 1,
  },
  {
    code: 'admin-messaging',
    parentCode: 'administration',
    label: 'Messagerie',
    description: 'Paramètres de la messagerie transactionnelle.',
    route: '/admin/messagerie',
    sortOrder: 2,
  },
  {
    code: 'admin-settings',
    parentCode: 'administration',
    label: 'Paramètres système',
    description: 'Configuration générale et référentiels de la plateforme.',
    route: '/admin/settings',
    sortOrder: 3,
  },
] as const satisfies readonly PlatformSubmoduleDefinition[];

export type AdministrationSubmoduleCode = (typeof ADMINISTRATION_SUBMODULE_CATALOG)[number]['code'];

export const ACCESS_GOVERNANCE_SUBMODULE_CATALOG = [
  { code: 'admin-portals', parentCode: 'administration', label: 'Portails', description: 'Configuration des portails et de leurs menus.', route: '/access/portals', sortOrder: 1 },
  { code: 'admin-roles', parentCode: 'administration', label: 'Rôles & Permissions', description: 'Rôles précis et matrice des autorisations.', route: '/access/roles', sortOrder: 2 },
  { code: 'admin-users', parentCode: 'administration', label: 'Utilisateurs', description: 'Comptes, rattachements et restrictions individuelles.', route: '/users', sortOrder: 3 },
  { code: 'admin-audit', parentCode: 'administration', label: 'Audit des accès', description: 'Journal immuable des changements et décisions d’accès.', route: '/access/audit', sortOrder: 4 },
] as const satisfies readonly PlatformSubmoduleDefinition[];

export type AccessGovernanceSubmoduleCode = (typeof ACCESS_GOVERNANCE_SUBMODULE_CATALOG)[number]['code'];

export const PLATFORM_MODULE_BY_CODE = new Map(
  PLATFORM_MODULE_CATALOG.map((module) => [module.code, module]),
);

export const PLATFORM_MODULE_BY_NAVIGATION_ID = new Map(
  PLATFORM_MODULE_CATALOG.map((module) => [module.navigationGroupId, module]),
);

export interface ModuleAvailability {
  isActive: boolean;
  isVisibleInMenu: boolean;
}

export type ModuleAvailabilityMap = Record<string, ModuleAvailability>;

/**
 * Résout la route vers le module racine qui la gouverne. Les préfixes les plus
 * spécifiques précèdent volontairement les préfixes génériques : le marché
 * artisanal, par exemple, ne doit pas hériter du module « Artisans miniers ».
 */
const ROUTE_MODULE_PREFIXES: readonly [string, PlatformModuleCode][] = [
  ['/collecte/ventes', 'artisan_gold_market'],
  ['/portail-dgmg/reserve-validations', 'national_reserve'],
  ['/portail-dgi/paiements', 'artisan_gold_market'],
  ['/artisan-minier/ventes-or', 'artisan_gold_market'],
  ['/artisan-minier/paiements', 'artisan_gold_market'],
  ['/artisan-minier/rapports', 'artisan_gold_market'],
  ['/artisan-minier', 'artisan-minier'],
  ['/artisan-sites', 'mining_sites'],
  ['/conciliation', 'conciliation'],
  ['/national-reserve', 'national_reserve'],
  ['/inventory', 'gold_inventory'],
  ['/production', 'production'],
  ['/performance/budgets', 'production'],
  ['/performance/forecasts', 'production'],
  ['/achats', 'gold_purchases'],
  ['/requisitions', 'gold_purchases'],
  ['/contrats', 'gold_purchases'],
  ['/freight-customs', 'shipping'],
  ['/freight', 'shipping'],
  ['/shipping', 'shipping'],
  ['/refining', 'refining'],
  ['/sales/simulator', 'international_markets'],
  ['/sales/simulations', 'international_markets'],
  ['/sales/trade-space', 'international_markets'],
  ['/gold-prices', 'international_markets'],
  ['/fx-rates', 'international_markets'],
  ['/sales', 'sales'],
  ['/payments', 'sales'],
  ['/stakeholders', 'stakeholders'],
  ['/customers', 'stakeholders'],
  ['/documents', 'documents'],
  ['/admin/gold-sales-settings', 'settings'],
  ['/admin/status-manager', 'settings'],
  ['/admin/workflow', 'settings'],
  ['/parameters', 'settings'],
  ['/users', 'administration'],
  ['/access', 'administration'],
  ['/admin/modules', 'administration'],
  ['/admin/permissions', 'administration'],
  ['/admin/messagerie', 'administration'],
  ['/admin/settings', 'administration'],
  ['/admin/audit', 'administration'],
  ['/analytics/ventes', 'sales_analytics'],
  ['/analytics/production', 'production_analytics'],
  ['/analytics', 'analytics'],
  ['/reports', 'reports'],
  ['/dashboard', 'dashboard'],
];

export function platformModuleCodeForPath(pathname: string): PlatformModuleCode | null {
  const path = pathname.split(/[?#]/u, 1)[0].replace(/\/+$/u, '') || '/';
  return ROUTE_MODULE_PREFIXES.find(([prefix]) => (
    path === prefix || path.startsWith(`${prefix}/`)
  ))?.[1] ?? null;
}
