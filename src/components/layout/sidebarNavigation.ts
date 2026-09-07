import { navigation as managerNavigation } from '@/pages/manager/managerNavigation';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  BellRing,
  Calculator,
  CalendarRange,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileSignature,
  FileText,
  FlaskConical,
  Gavel,
  Grid2X2,
  Landmark,
  Layers,
  KeyRound,
  Mail,
  Mountain,
  PackageCheck,
  PanelsTopLeft,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserProfile } from '@/types/auth';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import { hasGlobalPlatformAccess } from '@/lib/permissions';
import { isComptoirScopedUser } from '@/lib/comptoirAccess';
import { isCollectorScopedUser } from '@/lib/collectorAccess';
import { isMineScopedUser } from '@/lib/mineAccess';
import { canAccessSonaspComptoirInbox } from '@/lib/sonaspComptoirAccess';
import { moduleDomainForPath } from '@/lib/accessControl';
import {
  accountTypeFor,
  canAccessPrivateRoute,
  type AccountType,
} from '@/lib/routeAccessRegistry';
import type {
  ModuleAvailabilityMap,
  PlatformModuleCode,
} from '@/lib/platformModuleCatalog';
import { ACCESS_GOVERNANCE_SUBMODULE_CATALOG, ADMINISTRATION_SUBMODULE_CATALOG } from '@/lib/platformModuleCatalog';

export type NavigationItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  color: string;
  /** Regroupement visuel facultatif dans un sous-menu, sans niveau cliquable supplémentaire. */
  category?: string;
  /** Module canonique de l'entrée lorsqu'il diffère de celui du groupe visuel. */
  moduleCode?: PlatformModuleCode;
  /** Code du sous-module dans `snp_modules`, utilisé pour sa visibilité. */
  catalogCode?: string;
};

export type NavigationGroup = NavigationItem & {
  id: string;
  /** Code immuable partagé avec `modules.name` et `snp_modules.code`. */
  moduleCode?: PlatformModuleCode;
  children?: NavigationItem[];
};

export type NavigationSection = {
  id: string;
  title: string;
  groups: NavigationGroup[];
};

const ADMINISTRATION_ICONS: Record<string, LucideIcon> = {
  'admin-portals': PanelsTopLeft,
  'admin-users': Users,
  'admin-modules': Layers,
  'admin-roles': KeyRound,
  'admin-messaging': Mail,
  'admin-settings': SlidersHorizontal,
  'admin-audit': ClipboardCheck,
};

const ADMINISTRATION_COLORS: Record<string, string> = {
  'admin-users': '#f97316',
  'admin-modules': '#8b5cf6',
  'admin-roles': '#0f7a56',
  'admin-messaging': '#2f6fec',
  'admin-settings': '#f59e0b',
  'admin-audit': '#64748b',
};

export const ADMINISTRATION_NAVIGATION_ITEMS: NavigationItem[] =
  ADMINISTRATION_SUBMODULE_CATALOG.map((module) => ({
    label: module.label,
    path: module.route,
    icon: ADMINISTRATION_ICONS[module.code] || Settings,
    color: ADMINISTRATION_COLORS[module.code] || '#64748b',
    catalogCode: module.code,
  }));

export const ACCESS_GOVERNANCE_NAVIGATION_ITEMS: NavigationItem[] =
  ACCESS_GOVERNANCE_SUBMODULE_CATALOG.map((module) => ({
    label: module.label,
    path: module.route,
    icon: ADMINISTRATION_ICONS[module.code] || ShieldCheck,
    color: ADMINISTRATION_COLORS[module.code] || '#0f7a56',
    catalogCode: module.code,
  }));

/**
 * Navigation principale, organisée selon la chaîne de valeur SONASP.
 *
 * Chaque entrée pointe vers une route effectivement déclarée dans `App.tsx` : une
 * entrée de menu vers une page inexistante est un cul-de-sac, défaut déjà relevé
 * ailleurs dans l'application.
 */
export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'semi-mecanise',
    title: 'Sites artisanaux & Artisans',
    groups: [
      {
        id: 'sites-miniers',
        moduleCode: 'mining_sites',
        label: 'Sites artisanaux',
        path: '/artisan-sites',
        icon: Mountain,
        color: '#21c995',
        children: [
          { label: "Vue d'ensemble", path: '/artisan-sites', icon: Grid2X2, color: '#21c995' },
          { label: 'Productions', path: '/artisan-sites/production', icon: Building2, color: '#d79a00' },
        ],
      },
      {
        id: 'artisans',
        moduleCode: 'artisan-minier',
        label: 'Artisans miniers',
        path: '/artisan-minier/liste',
        icon: Users,
        color: '#10976b',
        children: [
          { label: "Vue d'ensemble", path: '/artisan-minier', icon: Grid2X2, color: '#10976b' },
          { label: 'Liste des artisans', path: '/artisan-minier/liste', icon: Users, color: '#2f6fec' },
          { label: 'Collecteurs', path: '/artisan-minier/collecteurs', icon: Users, color: '#10976b' },
          { label: 'Comptoirs', path: '/artisan-minier/comptoirs', icon: Building2, color: '#2f6fec' },
          { label: 'Affiliations & Cartes', path: '/artisan-minier/cartes/suivi', icon: TrendingUp, color: '#8b5cf6' },
          { label: 'Validation des cartes', path: '/artisan-minier/cartes/validation', icon: CheckCircle2, color: '#635bff' },
          { label: 'Expirations', path: '/artisan-minier/cartes/expirations', icon: AlertTriangle, color: '#f36b21' },
        ],
      },
    ],
  },
  {
    id: 'industrielles',
    title: 'Mine industrielle',
    groups: [
      {
        id: 'previsions-licences',
        moduleCode: 'production',
        label: 'Prévisions & licences',
        path: '/production/licenses/requests',
        icon: FileSignature,
        color: '#2f6fec',
        children: [
          { label: 'Demandes de licence', path: '/production/licenses/requests', icon: ClipboardCheck, color: '#0f7a56' },
          { label: 'Licences d’exportation', path: '/production/licenses', icon: FileText, color: '#2f6fec' },
          { label: 'Prévisions & Forecast', path: '/performance/budgets', icon: TrendingUp, color: '#14b8a6' },
        ],
      },
      {
        id: 'production',
        moduleCode: 'production',
        label: 'Gestion de la production',
        path: '/production/daily',
        icon: Building2,
        color: '#10976b',
        children: [
          { label: 'Production journalière', path: '/production/daily', icon: Building2, color: '#10976b' },
          { label: 'Or en coffre', path: '/production/in-safe', icon: PackageCheck, color: '#d79a00' },
        ],
      },
      {
        id: 'achats-industriels',
        moduleCode: 'gold_purchases',
        label: 'Achat aux mines industrielles',
        path: '/achats/plans',
        icon: CircleDollarSign,
        color: '#d79a00',
        children: [
          { label: 'Achat aux mines', path: '/production/achats-mines', icon: CircleDollarSign, color: '#d79a00' },
          { label: 'Contrats de fourniture', path: '/contrats', icon: FileSignature, color: '#0f7a56' },
          { label: 'Pilotage des engagements', path: '/contrats/pilotage', icon: BellRing, color: '#b97f00' },
          { label: 'Plans mensuels', path: '/achats/plans', icon: CalendarRange, color: '#d79a00' },
          { label: 'Demandes aux mines', path: '/achats/demandes', icon: FileText, color: '#2f6fec' },
          { label: 'Réquisitions', path: '/requisitions', icon: Gavel, color: '#b3261e' },
          { label: 'Vue d’ensemble', path: '/achats/comptes-paiements', icon: Grid2X2, color: '#10976b', category: 'Suivi des comptes & paiements' },
          { label: 'Suivi des paiements', path: '/achats/reglements', icon: CircleDollarSign, color: '#10976b', category: 'Suivi des comptes & paiements' },
          { label: 'Comptes des mines', path: '/achats/comptes', icon: BarChart3, color: '#8b5cf6', category: 'Suivi des comptes & paiements' },
        ],
      },
      {
        id: 'shipping',
        moduleCode: 'shipping',
        label: 'Gestion des expéditions',
        path: '/shipping/preparation',
        icon: Truck,
        color: '#2f6fec',
        children: [
          { label: 'Préparations', path: '/shipping/preparation', icon: PackageCheck, color: '#2f6fec' },
          { label: 'Nouvelle préparation', path: '/shipping/preparation/new', icon: Truck, color: '#10976b' },
          { label: 'Expéditions de fret', path: '/freight', icon: Truck, color: '#d79a00' },
          { label: 'Formalités douanières', path: '/freight-customs', icon: FileText, color: '#8b5cf6' },
        ],
      },
    ],
  },
  {
    id: 'vente-achat-or',
    title: 'Vente & achat d’or',
    groups: [
      {
        id: 'marche-artisanal',
        moduleCode: 'artisan_gold_market',
        label: 'Marché d’or artisanal',
        path: '/artisan-minier/paiements',
        icon: CircleDollarSign,
        color: '#d79a00',
        children: [
          { label: 'Vue d’ensemble', path: '/artisan-minier/paiements', icon: Grid2X2, color: '#16a363' },
          { label: 'Achat d’or local', path: '/artisan-minier/ventes-or', icon: CircleDollarSign, color: '#d79a00' },
          { label: 'Paiements', path: '/artisan-minier/paiements/historique', icon: CircleDollarSign, color: '#2f6fec' },
        ],
      },
    ],
  },
  {
    id: 'raffinage-stocks',
    title: 'Raffinage & stocks',
    groups: [
      {
        id: 'refining',
        moduleCode: 'refining',
        label: 'Gestion du raffinage',
        path: '/refining',
        icon: FlaskConical,
        color: '#8b5cf6',
        children: [
          { label: 'Suivi du raffinage', path: '/refining', icon: FlaskConical, color: '#10976b' },
          { label: 'Lots réceptionnés', path: '/refining/freight-shipments', icon: PackageCheck, color: '#2f6fec' },
        ],
      },
      {
        id: 'inventory',
        moduleCode: 'gold_inventory',
        label: 'Suivi du stock d’or',
        path: '/inventory',
        icon: Layers,
        color: '#14b8a6',
        children: [
          { label: 'Position des stocks', path: '/inventory', icon: Grid2X2, color: '#10976b', catalogCode: 'inventory-overview' },
          { label: "Position argent", path: '/inventory/silver', icon: Layers, color: '#8b5cf6', catalogCode: 'inventory-silver' },
          { label: 'Nouvelle entrée de stock', path: '/inventory/add', icon: ClipboardCheck, color: '#d79a00', catalogCode: 'inventory-new-entry' },
        ],
      },
    ],
  },
  {
    id: 'reserve-or-burkina',
    title: 'Réserve d’or du Burkina Faso',
    groups: [
      {
        id: 'national-reserve',
        moduleCode: 'national_reserve',
        label: 'Réserve nationale d’or',
        path: '/national-reserve',
        icon: Landmark,
        color: '#0c8a5f',
        children: [
          { label: 'Vue d’ensemble', path: '/national-reserve', icon: Grid2X2, color: '#10976b', catalogCode: 'reserve-overview' },
          { label: 'Affectations à la réserve', path: '/national-reserve/allocations', icon: PackageCheck, color: '#10976b', catalogCode: 'inventory-allocations' },
          { label: 'Réserve physique', path: '/national-reserve/physical', icon: Layers, color: '#d79a00', catalogCode: 'inventory-physical' },
          { label: 'Contrôles & écarts', path: '/national-reserve/controls', icon: ClipboardCheck, color: '#2f6fec', catalogCode: 'inventory-controls' },
          { label: 'Valorisation et analyse', path: '/national-reserve/valuation', icon: TrendingUp, color: '#8b5cf6', catalogCode: 'inventory-valuation' },
          { label: 'Rapports et audit', path: '/national-reserve/audit', icon: FileText, color: '#64748b', catalogCode: 'inventory-audit' },
        ],
      },
    ],
  },
  {
    id: 'vente-internationale',
    title: 'Vente internationale',
    groups: [
      {
        id: 'market',
        moduleCode: 'international_markets',
        label: 'Marchés internationaux',
        path: '/sales/simulator',
        icon: TrendingUp,
        color: '#f59e0b',
        children: [
          { label: 'Simulateur de vente', path: '/sales/simulator', icon: Calculator, color: '#087f5b' },
          { label: 'Espace de négoce', path: '/sales/trade-space', icon: CircleDollarSign, color: '#f59e0b' },
          { label: "Cours de l'or", path: '/gold-prices', icon: TrendingUp, color: '#d79a00' },
          { label: 'Taux de change', path: '/fx-rates', icon: TrendingUp, color: '#2f6fec' },
        ],
      },
      {
        id: 'sales',
        moduleCode: 'sales',
        label: 'Ventes d’or internationales',
        path: '/sales',
        icon: CircleDollarSign,
        color: '#ec4899',
        children: [
          { label: 'Ventes', path: '/sales', icon: CircleDollarSign, color: '#ec4899' },
          { label: 'Paiements', path: '/payments', icon: CircleDollarSign, color: '#16a363' },
          { label: 'Dossiers de conciliation', path: '/conciliation', icon: Scale, color: '#635bff', category: 'Conciliation', moduleCode: 'conciliation' },
          { label: 'Règles fiscales', path: '/conciliation/regles-fiscales', icon: Gavel, color: '#b97f00', category: 'Conciliation', moduleCode: 'conciliation' },
        ],
      },
      {
        id: 'stakeholders',
        moduleCode: 'stakeholders',
        label: 'Parties prenantes',
        path: '/stakeholders/organizations',
        icon: Users,
        color: '#10976b',
        children: [
          { label: 'Organisations', path: '/stakeholders/organizations', icon: Landmark, color: '#10976b' },
          { label: 'Sociétés minières', path: '/stakeholders/mining-companies', icon: Building2, color: '#10976b' },
          { label: 'Clients internationaux', path: '/customers', icon: Users, color: '#14b8a6' },
          { label: 'Transporteurs', path: '/stakeholders/freight-companies', icon: Truck, color: '#d79a00' },
          { label: 'Raffineries', path: '/stakeholders/refinery-plants', icon: FlaskConical, color: '#8b5cf6' },
          { label: 'Dépositaires', path: '/stakeholders/depositors', icon: Users, color: '#10976b' },
        ],
      },
      {
        id: 'documents',
        moduleCode: 'documents',
        label: 'Documents',
        path: '/documents/assay-certificates',
        icon: FileText,
        color: '#8b5cf6',
        children: [
          { label: "Certificats d'essai", path: '/documents/assay-certificates', icon: FileText, color: '#8b5cf6' },
        ],
      },
    ],
  },
  {
    id: 'utilisateurs-portails',
    title: 'Utilisateurs & Portails',
    groups: [
      {
        id: 'access-governance',
        moduleCode: 'administration',
        label: 'Accès & portails',
        path: '/access/portals',
        icon: ShieldCheck,
        color: '#0f7a56',
        children: ACCESS_GOVERNANCE_NAVIGATION_ITEMS,
      },
    ],
  },
  {
    id: 'parametres',
    title: 'Paramètres et configuration',
    groups: [
      {
        id: 'settings',
        moduleCode: 'settings',
        label: 'Paramètres',
        path: '/parameters',
        icon: SlidersHorizontal,
        color: '#f59e0b',
        children: [
          { label: 'Paramètres généraux', path: '/parameters', icon: SlidersHorizontal, color: '#f59e0b' },
          { label: 'Paramètres des ventes', path: '/admin/gold-sales-settings', icon: CircleDollarSign, color: '#d79a00' },
          { label: 'Référentiel des statuts', path: '/admin/status-manager', icon: Layers, color: '#14b8a6' },
          { label: 'Circuit de traçabilité', path: '/admin/workflow', icon: TrendingUp, color: '#2f6fec' },
        ],
      },
      {
        id: 'administration',
        moduleCode: 'administration',
        label: 'Administration',
        path: '/admin/modules',
        icon: Settings,
        color: '#f97316',
        children: ADMINISTRATION_NAVIGATION_ITEMS,
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Rapports et analyses',
    groups: [
      {
        id: 'vue-ventes',
        moduleCode: 'sales_analytics',
        label: 'Analyses des ventes',
        path: '/analytics/ventes',
        icon: CircleDollarSign,
        color: '#087956',
      },
      {
        id: 'vue-production',
        moduleCode: 'production_analytics',
        label: 'Rapports de production',
        path: '/analytics/production',
        icon: Building2,
        color: '#087956',
      },
      {
        id: 'rapports-institutionnels',
        moduleCode: 'reports',
        label: 'Rapports institutionnels',
        path: '/reports',
        icon: FileText,
        color: '#087956',
      },
      {
        id: 'performance-nationale',
        moduleCode: 'analytics',
        label: 'Performance nationale',
        path: '/analytics',
        icon: TrendingUp,
        color: '#087956',
      },
    ],
  },
];

/**
 * Le comptoir réutilise les écrans éprouvés du marché artisanal, mais son menu
 * exprime son vrai cycle de travail. Aucune route d'export ou de négoce
 * international n'est exposée dans ce périmètre.
 */
export const COMPTOIR_NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'comptoir-collecte',
    title: 'Collecte',
    groups: [
      {
        id: 'comptoir-achats',
        moduleCode: 'artisan_gold_market',
        label: "Achats d’or",
        path: '/artisan-minier/ventes-or',
        icon: CircleDollarSign,
        color: '#c47a3b',
        children: [
          { label: 'Registre des achats', path: '/artisan-minier/ventes-or', icon: FileText, color: '#c47a3b' },
          { label: 'Ventes des collecteurs', path: '/collecte/ventes', icon: CheckCircle2, color: '#10976b' },
          { label: 'Nouvel achat', path: '/artisan-minier/ventes-or/nouvelle', icon: CircleDollarSign, color: '#7b3f61' },
        ],
      },
        {
          id: 'comptoir-orpailleurs',
        moduleCode: 'artisan-minier',
        label: 'Orpailleurs rattachés',
        path: '/artisan-minier/liste',
        icon: Users,
          color: '#2f7d6d',
        },
        { id: 'comptoir-collecteurs', moduleCode: 'artisan-minier', label: 'Collecteurs', path: '/artisan-minier/collecteurs', icon: Users, color: '#2f7d6d' },
    ],
  },
  {
    id: 'comptoir-conformite',
    title: 'Conformité et finances',
    groups: [
      {
        id: 'comptoir-factures',
        moduleCode: 'artisan_gold_market',
        label: 'DGI et paiements',
        path: '/artisan-minier/paiements',
        icon: FileSignature,
        color: '#7b3f61',
        children: [
          { label: 'Factures à traiter', path: '/artisan-minier/paiements', icon: FileSignature, color: '#7b3f61' },
          { label: 'Historique des paiements', path: '/artisan-minier/paiements/historique', icon: CircleDollarSign, color: '#2f7d6d' },
          { label: 'Taxes collectées', path: '/artisan-minier/rapports/taxes', icon: BarChart3, color: '#c47a3b' },
        ],
      },
    ],
  },
  {
    id: 'comptoir-stock',
    title: 'Stock et SONASP',
    groups: [
      {
        id: 'comptoir-stock-or',
        moduleCode: 'gold_inventory',
        label: "Stock d’or",
        path: '/portail-comptoir/stock',
        icon: Layers,
        color: '#2f7d6d',
      },
      {
        id: 'comptoir-cessions',
        moduleCode: 'sales',
        label: 'Cessions à la SONASP',
        path: '/portail-comptoir/ventes-sonasp',
        icon: Building2,
        color: '#c47a3b',
      },
    ],
  },
  {
    id: 'comptoir-analyses',
    title: 'Pilotage',
    groups: [
      {
        id: 'comptoir-rapports',
        moduleCode: 'analytics',
        label: 'Rapports et analyses',
        path: '/artisan-minier/rapports',
        icon: BarChart3,
        color: '#7b3f61',
        children: [
          { label: "Vue d’ensemble", path: '/artisan-minier/rapports', icon: Grid2X2, color: '#7b3f61' },
          { label: 'Volumes collectés', path: '/artisan-minier/rapports/quantites', icon: BarChart3, color: '#2f7d6d' },
          { label: "Chiffre d’affaires", path: '/artisan-minier/rapports/chiffre-affaires', icon: TrendingUp, color: '#c47a3b' },
        ],
      },
    ],
  },
];

/**
 * Le collecteur ne gère que la collecte locale auprès des orpailleurs qui lui
   * sont assignés. Le registre utilise le RPC de soumission et l’approbation
   * distincte de l’organisme ; aucune route d’export n’entre dans ce menu.
 */
export const COLLECTOR_NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'collecteur-collecte',
    title: 'Collecte locale',
    groups: [
      {
        id: 'collecteur-accueil',
        moduleCode: 'dashboard',
        label: 'Mon espace',
        path: '/portail-collecteur',
        icon: Grid2X2,
        color: '#2f7d6d',
      },
      {
        id: 'collecteur-orpailleurs',
        moduleCode: 'artisan-minier',
        label: 'Orpailleurs assignés',
        path: '/artisan-minier/liste',
        icon: Users,
        color: '#2f6fec',
      },
      {
        id: 'collecteur-registre',
        moduleCode: 'artisan_gold_market',
        label: 'Registre des collectes',
        path: '/collecte/ventes',
        icon: CircleDollarSign,
        color: '#c47a3b',
      },
    ],
  },
  {
    id: 'collecteur-suivi',
    title: 'Suivi autorisé',
    groups: [
      {
        id: 'collecteur-stock',
        moduleCode: 'gold_inventory',
        label: 'Stock du comptoir',
        path: '/portail-collecteur/stock',
        icon: Layers,
        color: '#2f7d6d',
      },
      {
        id: 'collecteur-paiements',
        moduleCode: 'artisan_gold_market',
        label: 'Paiements',
        path: '/artisan-minier/paiements/historique',
        icon: CircleDollarSign,
        color: '#7b3f61',
      },
      {
        id: 'collecteur-taxes',
        moduleCode: 'artisan_gold_market',
        label: 'Taxes et retenues',
        path: '/artisan-minier/rapports/taxes',
        icon: BarChart3,
        color: '#c47a3b',
      },
      {
        id: 'collecteur-documents',
        moduleCode: 'documents',
        label: 'Documents',
        path: '/portail-collecteur/documents',
        icon: FileText,
        color: '#2f6fec',
      },
    ],
  },
];

export const DGMG_NAVIGATION_SECTIONS: NavigationSection[] = [{
  id: 'dgmg-supervision',
  title: 'Supervision & régulation',
  groups: [
    { id: 'dgmg-overview', moduleCode: 'dashboard', label: 'Vue d’ensemble', path: '/portail-dgmg', icon: Grid2X2, color: '#e5fbfa' },
    { id: 'dgmg-sites', moduleCode: 'mining_sites', label: 'Registre des sites', path: '/artisan-sites', icon: Mountain, color: '#e5fbfa' },
    { id: 'dgmg-artisans', moduleCode: 'artisan-minier', label: 'Artisans et opérateurs', path: '/artisan-minier/liste', icon: Users, color: '#e5fbfa' },
    { id: 'dgmg-collecteurs', moduleCode: 'artisan-minier', label: 'Collecteurs', path: '/artisan-minier/collecteurs', icon: Users, color: '#e5fbfa' },
    { id: 'dgmg-industrial-sites', moduleCode: 'mining_sites', label: 'Sociétés minières', path: '/stakeholders/mining-companies', icon: Building2, color: '#e5fbfa' },
    { id: 'dgmg-comptoirs', moduleCode: 'mining_sites', label: 'Comptoirs', path: '/stakeholders/organizations', icon: Landmark, color: '#e5fbfa' },
    { id: 'dgmg-productions', moduleCode: 'production', label: 'Déclarations de production', path: '/production/daily', icon: TrendingUp, color: '#e5fbfa' },
    { id: 'dgmg-reserve-validations', moduleCode: 'national_reserve', label: 'Validations Réserve', path: '/portail-dgmg/reserve-validations', icon: ShieldCheck, color: '#e5fbfa' },
  ],
}];

export const DGI_NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'dgi-controle-fiscal',
    title: 'Contrôle fiscal',
    groups: [
      { id: 'dgi-overview', moduleCode: 'dashboard', label: 'Vue fiscale', path: '/portail-dgi', icon: Scale, color: '#b9d6ff' },
      { id: 'dgi-productions', moduleCode: 'production', label: 'Productions', path: '/production/daily', icon: TrendingUp, color: '#b9d6ff' },
      { id: 'dgi-ventes', moduleCode: 'artisan_gold_market', label: 'Ventes déclarées', path: '/artisan-minier/ventes-or', icon: CircleDollarSign, color: '#b9d6ff' },
    ],
  },
  {
    id: 'dgi-paiements-recettes',
    title: 'Paiements & recettes',
    groups: [
      { id: 'dgi-paiements', moduleCode: 'artisan_gold_market', label: 'Paiements fiscaux', path: '/portail-dgi/paiements', icon: FileSignature, color: '#b9d6ff' },
      { id: 'dgi-taxes', moduleCode: 'artisan_gold_market', label: 'Taxes et redevances', path: '/artisan-minier/rapports/taxes', icon: BarChart3, color: '#b9d6ff' },
    ],
  },
  {
    id: 'dgi-rapprochement',
    title: 'Rapprochement',
    groups: [
      { id: 'dgi-conciliations', moduleCode: 'conciliation', label: 'Conciliations', path: '/conciliation', icon: ClipboardCheck, color: '#b9d6ff' },
      { id: 'dgi-regles', moduleCode: 'conciliation', label: 'Règles fiscales', path: '/conciliation/regles-fiscales', icon: Gavel, color: '#b9d6ff' },
    ],
  },
];

export const SONASP_COMPTOIR_NAVIGATION_SECTION: NavigationSection = {
  id: 'relations-comptoirs',
  title: 'Relations avec les comptoirs',
  groups: [
    {
      id: 'sonasp-cessions-comptoirs',
      moduleCode: 'gold_purchases',
      label: 'Cessions comptoirs',
      path: '/sonasp/cessions-comptoirs',
      icon: Building2,
      color: '#9a5a3a',
    },
  ],
};

/** Tous les groupes, toutes sections confondues. */
export const ALL_GROUPS: NavigationGroup[] = [
  ...NAVIGATION_SECTIONS,
  ...COMPTOIR_NAVIGATION_SECTIONS,
  ...COLLECTOR_NAVIGATION_SECTIONS,
  ...DGMG_NAVIGATION_SECTIONS,
  ...DGI_NAVIGATION_SECTIONS,
  SONASP_COMPTOIR_NAVIGATION_SECTION,
].flatMap((section) => section.groups);

function filterNavigationSections(
  sections: NavigationSection[],
  user: UserProfile,
  moduleAvailability?: ModuleAvailabilityMap | null,
): NavigationSection[] {
  const ownerHasGlobalAccess = hasGlobalPlatformAccess(user);
  // Les codes canoniques sont plus précis que les domaines : un groupe achats
  // comprend aussi des contrats. Ne pas refuser son enfant avec un second filtre
  // de domaine quand le registre a déjà vérifié l'attribution du module parent.
  const effectiveDomains = ownerHasGlobalAccess || Array.isArray(user.module_codes) || !user.module_domains
    ? null
    : new Set(user.module_domains);
  const canNavigate = (path: string) => ownerHasGlobalAccess || ((
      path !== '/production/licenses/requests'
      || hasSensitiveCapability(user, CAPABILITIES.SONASP_APPROVE)
    ) && canAccessPrivateRoute(user, path)
      && (!moduleDomainForPath(path) || effectiveDomains === null || effectiveDomains.has(moduleDomainForPath(path) as string)));

  return sections.flatMap((section) => {
    const groups = section.groups.flatMap((group) => {
      const moduleVisible = (code?: PlatformModuleCode) => {
        if (ownerHasGlobalAccess || !moduleAvailability || !code) return true;
        const state = moduleAvailability[code];
        return Boolean(state?.isActive && state.isVisibleInMenu);
      };
      const groupAllowed = moduleVisible(group.moduleCode) && canNavigate(group.path);
      if (!group.children?.length) return groupAllowed ? [group] : [];

      const children = group.children.filter((item) => {
        // Un groupe est une famille visuelle, pas une frontière d'autorisation.
        // Ainsi les dossiers de conciliation restent gouvernés par le module
        // `conciliation`, même lorsqu'ils sont rangés avec les ventes.
        if (!moduleVisible(item.moduleCode ?? group.moduleCode)) return false;
        if (!ownerHasGlobalAccess && moduleAvailability && item.catalogCode) {
          const state = moduleAvailability[item.catalogCode];
          if (!state?.isActive || !state.isVisibleInMenu) return false;
        }
        return canNavigate(item.path);
      });
      if (children.length === 0) return groupAllowed ? [{ ...group, children: undefined }] : [];
      return [{
        ...group,
        path: groupAllowed ? group.path : children[0].path,
        children,
      }];
    });
    return groups.length > 0 ? [{ ...section, groups }] : [];
  });
}

const MINE_GROUP_CHILDREN: Record<string, Set<string>> = {
  'previsions-licences': new Set([
    '/production/licenses',
    '/performance/budgets',
    '/performance/forecasts',
  ]),
  production: new Set([
    '/production/daily',
    '/production/in-safe',
  ]),
  'achats-industriels': new Set([
    '/contrats',
    '/achats/demandes',
    '/requisitions',
    '/achats/reglements',
  ]),
  shipping: new Set([
    '/shipping/preparation',
    '/shipping/preparation/new',
    '/freight',
    '/freight-customs',
  ]),
  refining: new Set(['/refining', '/refining/freight-shipments']),
  inventory: new Set(['/inventory', '/inventory/silver']),
  market: new Set(['/sales/simulator', '/sales/simulations', '/sales/trade-space', '/gold-prices', '/fx-rates']),
  sales: new Set(['/sales', '/payments']),
  stakeholders: new Set([
    '/customers',
    '/stakeholders/organizations',
    '/stakeholders/freight-companies',
    '/stakeholders/refinery-plants',
    '/stakeholders/depositors',
  ]),
  documents: new Set(['/documents/assay-certificates']),
  'rapports-institutionnels': new Set(['/reports']),
};

/** Navigation unique, projetée selon le périmètre autoritatif du compte. */
export function getNavigationSectionsForUser(
  user: UserProfile | null,
  moduleAvailability?: ModuleAvailabilityMap | null,
): NavigationSection[] {
  const accountType: AccountType = accountTypeFor(user);
  if (!user || accountType === 'unknown') return [];
  if (accountType === 'direction') return [{ id: 'direction', title: 'Pilotage et consultation', groups: managerNavigation.filter(item => item.id !== 'synthese').map(item => ({ id: `direction-${item.id}`, label: item.label, icon: item.icon, color: '#8B995C', path: `/portail-direction/${item.id}` })) }];
  if (accountType === 'dgmg') return filterNavigationSections(DGMG_NAVIGATION_SECTIONS, user, moduleAvailability);
  if (accountType === 'dgi') return filterNavigationSections(DGI_NAVIGATION_SECTIONS, user, moduleAvailability);
  if (isCollectorScopedUser(user)) return filterNavigationSections(COLLECTOR_NAVIGATION_SECTIONS, user, moduleAvailability);
  if (isComptoirScopedUser(user)) return filterNavigationSections(COMPTOIR_NAVIGATION_SECTIONS, user, moduleAvailability);
  if (!isMineScopedUser(user)) {
    const candidate = canAccessSonaspComptoirInbox(user)
      ? [...NAVIGATION_SECTIONS, SONASP_COMPTOIR_NAVIGATION_SECTION]
      : NAVIGATION_SECTIONS;
    return filterNavigationSections(candidate, user, moduleAvailability);
  }

  const projected = NAVIGATION_SECTIONS.flatMap((section) => {
    const groups = section.groups.flatMap((group) => {
      const allowed = MINE_GROUP_CHILDREN[group.id];
      if (!allowed) return [];
      if (!group.children?.length) return allowed.has(group.path) ? [group] : [];
      const children = group.children?.filter((item) => allowed.has(item.path)) || [];
      if (children.length === 0) return [];
      return [{ ...group, path: children[0].path, children }];
    });
    return groups.length > 0 ? [{ ...section, groups }] : [];
  });

  return filterNavigationSections(projected, user, moduleAvailability);
}
