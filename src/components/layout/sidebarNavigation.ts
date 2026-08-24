import {
  AlertTriangle,
  BarChart3,
  BellRing,
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
  Layers,
  Mail,
  Mountain,
  PackageCheck,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserProfile } from '@/types/auth';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import { isComptoirScopedUser } from '@/lib/comptoirAccess';
import { isCollectorScopedUser } from '@/lib/collectorAccess';
import { isMineScopedUser } from '@/lib/mineAccess';
import { canAccessSonaspComptoirInbox } from '@/lib/sonaspComptoirAccess';
import {
  accountTypeFor,
  canAccessPrivateRoute,
  type AccountType,
} from '@/lib/routeAccessRegistry';

export type NavigationItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  color: string;
};

export type NavigationGroup = NavigationItem & {
  id: string;
  children?: NavigationItem[];
};

export type NavigationSection = {
  id: string;
  title: string;
  groups: NavigationGroup[];
};

/**
 * Navigation principale, organisée en quatre sections métier.
 *
 * Chaque entrée pointe vers une route effectivement déclarée dans `App.tsx` : une
 * entrée de menu vers une page inexistante est un cul-de-sac, défaut déjà relevé
 * ailleurs dans l'application.
 */
export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'semi-mecanise',
    title: 'Mines semi-mécanisées',
    groups: [
      {
        id: 'sites-miniers',
        label: 'Sites miniers',
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
        label: 'Artisans miniers',
        path: '/artisan-minier/liste',
        icon: Users,
        color: '#10976b',
        children: [
          { label: "Vue d'ensemble", path: '/artisan-minier', icon: Grid2X2, color: '#10976b' },
          { label: 'Liste des artisans', path: '/artisan-minier/liste', icon: Users, color: '#2f6fec' },
          { label: 'Suivi des cartes', path: '/artisan-minier/cartes/suivi', icon: TrendingUp, color: '#8b5cf6' },
          { label: 'Validation des cartes', path: '/artisan-minier/cartes/validation', icon: CheckCircle2, color: '#635bff' },
          { label: 'Expirations', path: '/artisan-minier/cartes/expirations', icon: AlertTriangle, color: '#f36b21' },
        ],
      },
      {
        id: 'marche-artisanal',
        label: "Marché d'or artisanal",
        path: '/artisan-minier/paiements',
        icon: CircleDollarSign,
        color: '#d79a00',
        children: [
          { label: "Vue d'ensemble", path: '/artisan-minier/paiements', icon: Grid2X2, color: '#16a363' },
          { label: "Ventes d'or", path: '/artisan-minier/ventes-or', icon: CircleDollarSign, color: '#d79a00' },
          { label: 'Paiements', path: '/artisan-minier/paiements/historique', icon: CircleDollarSign, color: '#2f6fec' },
          { label: 'Rapports et analyses', path: '/artisan-minier/rapports', icon: BarChart3, color: '#8b5cf6' },
        ],
      },
    ],
  },
  {
    id: 'industrielles',
    title: 'Mines industrielles',
    groups: [
      {
        id: 'production',
        label: "Collecte de l'or",
        path: '/production/daily',
        icon: Building2,
        color: '#10976b',
        children: [
          { label: 'Production journalière', path: '/production/daily', icon: Building2, color: '#10976b' },
          { label: 'Achats aux mines', path: '/production/achats-mines', icon: CircleDollarSign, color: '#d79a00' },
          { label: 'Or en coffre', path: '/production/in-safe', icon: PackageCheck, color: '#d79a00' },
          { label: "Licences d'exportation", path: '/production/licenses', icon: FileText, color: '#2f6fec' },
          { label: 'Demandes de licences', path: '/production/licenses/requests', icon: ClipboardCheck, color: '#0f7a56' },
          { label: 'Prévisions & Forecast', path: '/performance/budgets', icon: TrendingUp, color: '#14b8a6' },
        ],
      },
      {
        // Achat d'or industriel : de la planification mensuelle au règlement des
        // mines. Le groupe suit « Collecte de l'or », dont il consomme la
        // production déclarée.
        id: 'achats-industriels',
        label: 'Achats d’or',
        path: '/achats/plans',
        icon: CircleDollarSign,
        color: '#d79a00',
        children: [
          // Le contrat precede le plan : c'est lui qui fixe les quantites que le
          // plan mensuel reprend comme besoins prioritaires.
          { label: 'Contrats de fourniture', path: '/contrats', icon: FileSignature, color: '#0f7a56' },
          { label: 'Pilotage des engagements', path: '/contrats/pilotage', icon: BellRing, color: '#b97f00' },
          { label: 'Plans mensuels', path: '/achats/plans', icon: CalendarRange, color: '#d79a00' },
          { label: 'Demandes aux mines', path: '/achats/demandes', icon: FileText, color: '#2f6fec' },
          { label: 'Réquisitions', path: '/requisitions', icon: Gavel, color: '#b3261e' },
          { label: 'Règlements', path: '/achats/reglements', icon: CircleDollarSign, color: '#10976b' },
          { label: 'Comptes des mines', path: '/achats/comptes', icon: BarChart3, color: '#8b5cf6' },
        ],
      },
      {
        id: 'shipping',
        label: 'Expéditions',
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
      {
        id: 'refining',
        label: 'Raffinage',
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
        label: 'Suivi des stocks',
        path: '/inventory',
        icon: Layers,
        color: '#14b8a6',
        children: [
          { label: "Stock d'or", path: '/inventory', icon: PackageCheck, color: '#d79a00' },
          { label: "Stock d'argent", path: '/inventory/silver', icon: Layers, color: '#8b5cf6' },
          { label: 'Nouvelle entrée', path: '/inventory/add', icon: Grid2X2, color: '#10976b' },
        ],
      },
      {
        id: 'market',
        label: 'Marchés internationaux',
        path: '/sales/trade-space',
        icon: TrendingUp,
        color: '#f59e0b',
        children: [
          { label: 'Espace de négoce', path: '/sales/trade-space', icon: CircleDollarSign, color: '#f59e0b' },
          { label: "Cours de l'or", path: '/gold-prices', icon: TrendingUp, color: '#d79a00' },
          { label: 'Taux de change', path: '/fx-rates', icon: TrendingUp, color: '#2f6fec' },
        ],
      },
      {
        id: 'sales',
        label: 'Vente d’or international',
        path: '/sales',
        icon: CircleDollarSign,
        color: '#ec4899',
        children: [
          { label: 'Ventes', path: '/sales', icon: CircleDollarSign, color: '#ec4899' },
          { label: 'Paiements', path: '/payments', icon: CircleDollarSign, color: '#16a363' },
        ],
      },
      {
        id: 'stakeholders',
        label: 'Parties prenantes',
        path: '/stakeholders/mining-companies',
        icon: Users,
        color: '#10976b',
        children: [
          { label: 'Sociétés minières', path: '/stakeholders/mining-companies', icon: Building2, color: '#10976b' },
          { label: 'Clients internationaux', path: '/customers', icon: Users, color: '#14b8a6' },
          { label: 'Approbateurs', path: '/stakeholders/approvers', icon: CheckCircle2, color: '#2f6fec' },
          { label: 'Transporteurs', path: '/stakeholders/freight-companies', icon: Truck, color: '#d79a00' },
          { label: 'Raffineries', path: '/stakeholders/refinery-plants', icon: FlaskConical, color: '#8b5cf6' },
          { label: 'Dépositaires', path: '/stakeholders/depositors', icon: Users, color: '#10976b' },
        ],
      },
      {
        id: 'documents',
        label: 'Documents',
        path: '/documents/assay-certificates',
        icon: FileText,
        color: '#8b5cf6',
        children: [
          { label: "Certificats d'essai", path: '/documents/assay-certificates', icon: FileText, color: '#8b5cf6' },
          { label: 'Rapports', path: '/reports', icon: BarChart3, color: '#2f6fec' },
        ],
      },
    ],
  },
  {
    id: 'parametres',
    title: 'Paramètres et configuration',
    groups: [
      {
        id: 'settings',
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
        label: 'Administration',
        path: '/users',
        icon: Settings,
        color: '#f97316',
        children: [
          { label: 'Utilisateurs', path: '/users', icon: Users, color: '#f97316' },
          { label: 'Modules', path: '/admin/modules', icon: Layers, color: '#8b5cf6' },
          { label: 'Messagerie', path: '/admin/messagerie', icon: Mail, color: '#2f6fec' },
        ],
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Rapports et analyses',
    groups: [
      {
        id: 'vue-ventes',
        label: 'Analyses des ventes',
        path: '/analytics/ventes',
        icon: CircleDollarSign,
        color: '#087956',
      },
      {
        id: 'vue-production',
        label: 'Rapports de production',
        path: '/analytics/production',
        icon: Building2,
        color: '#087956',
      },
      {
        id: 'rapports-institutionnels',
        label: 'Rapports institutionnels',
        path: '/reports',
        icon: FileText,
        color: '#087956',
      },
      {
        id: 'performance-nationale',
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
        label: "Achats d’or",
        path: '/artisan-minier/ventes-or',
        icon: CircleDollarSign,
        color: '#c47a3b',
        children: [
          { label: 'Registre des achats', path: '/artisan-minier/ventes-or', icon: FileText, color: '#c47a3b' },
          { label: 'Nouvel achat', path: '/artisan-minier/ventes-or/nouvelle', icon: CircleDollarSign, color: '#7b3f61' },
        ],
      },
      {
        id: 'comptoir-orpailleurs',
        label: 'Orpailleurs rattachés',
        path: '/artisan-minier/liste',
        icon: Users,
        color: '#2f7d6d',
      },
    ],
  },
  {
    id: 'comptoir-conformite',
    title: 'Conformité et finances',
    groups: [
      {
        id: 'comptoir-factures',
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
        label: "Stock d’or",
        path: '/portail-comptoir/stock',
        icon: Layers,
        color: '#2f7d6d',
      },
      {
        id: 'comptoir-cessions',
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
 * sont assignés. Aucune création n'est proposée tant qu'un RPC transactionnel
 * dédié n'existe pas, et aucune route de cession/export n'entre dans ce menu.
 */
export const COLLECTOR_NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'collecteur-collecte',
    title: 'Collecte locale',
    groups: [
      {
        id: 'collecteur-accueil',
        label: 'Mon espace',
        path: '/portail-collecteur',
        icon: Grid2X2,
        color: '#2f7d6d',
      },
      {
        id: 'collecteur-orpailleurs',
        label: 'Orpailleurs assignés',
        path: '/artisan-minier/liste',
        icon: Users,
        color: '#2f6fec',
      },
      {
        id: 'collecteur-registre',
        label: 'Registre des collectes',
        path: '/artisan-minier/ventes-or',
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
        label: 'Stock du comptoir',
        path: '/portail-collecteur/stock',
        icon: Layers,
        color: '#2f7d6d',
      },
      {
        id: 'collecteur-paiements',
        label: 'Paiements',
        path: '/artisan-minier/paiements/historique',
        icon: CircleDollarSign,
        color: '#7b3f61',
      },
      {
        id: 'collecteur-taxes',
        label: 'Taxes et retenues',
        path: '/artisan-minier/rapports/taxes',
        icon: BarChart3,
        color: '#c47a3b',
      },
      {
        id: 'collecteur-documents',
        label: 'Documents',
        path: '/portail-collecteur/documents',
        icon: FileText,
        color: '#2f6fec',
      },
    ],
  },
];

export const SONASP_COMPTOIR_NAVIGATION_SECTION: NavigationSection = {
  id: 'relations-comptoirs',
  title: 'Relations avec les comptoirs',
  groups: [
    {
      id: 'sonasp-cessions-comptoirs',
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
  SONASP_COMPTOIR_NAVIGATION_SECTION,
].flatMap((section) => section.groups);

function filterNavigationSections(
  sections: NavigationSection[],
  user: UserProfile,
): NavigationSection[] {
  const canNavigate = (path: string) => (
    path !== '/production/licenses/requests'
    || hasSensitiveCapability(user, CAPABILITIES.SONASP_APPROVE)
  ) && canAccessPrivateRoute(user, path);

  return sections.flatMap((section) => {
    const groups = section.groups.flatMap((group) => {
      const groupAllowed = canNavigate(group.path);
      if (!group.children?.length) return groupAllowed ? [group] : [];

      const children = group.children.filter((item) => canNavigate(item.path));
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
  production: new Set([
    '/production/daily',
    '/production/in-safe',
    '/production/licenses',
    '/performance/budgets',
    '/performance/forecasts',
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
  market: new Set(['/sales/trade-space', '/gold-prices', '/fx-rates']),
  sales: new Set(['/sales', '/payments']),
  stakeholders: new Set([
    '/customers',
    '/stakeholders/freight-companies',
    '/stakeholders/refinery-plants',
    '/stakeholders/depositors',
  ]),
  documents: new Set(['/documents/assay-certificates', '/reports']),
};

/** Navigation unique, projetée selon le périmètre autoritatif du compte. */
export function getNavigationSectionsForUser(user: UserProfile | null): NavigationSection[] {
  const accountType: AccountType = accountTypeFor(user);
  if (!user || accountType === 'unknown' || accountType === 'direction') return [];
  if (isCollectorScopedUser(user)) return filterNavigationSections(COLLECTOR_NAVIGATION_SECTIONS, user);
  if (isComptoirScopedUser(user)) return filterNavigationSections(COMPTOIR_NAVIGATION_SECTIONS, user);
  if (!isMineScopedUser(user)) {
    const candidate = canAccessSonaspComptoirInbox(user)
      ? [...NAVIGATION_SECTIONS, SONASP_COMPTOIR_NAVIGATION_SECTION]
      : NAVIGATION_SECTIONS;
    return filterNavigationSections(candidate, user);
  }

  const industrial = NAVIGATION_SECTIONS.find((section) => section.id === 'industrielles');
  if (!industrial) return [];

  return filterNavigationSections([{
    ...industrial,
    groups: industrial.groups.flatMap((group) => {
      const allowed = MINE_GROUP_CHILDREN[group.id];
      if (!allowed) return [];
      const children = group.children?.filter((item) => allowed.has(item.path)) || [];
      if (children.length === 0) return [];
      return [{ ...group, path: children[0].path, children }];
    }),
  }], user);
}
