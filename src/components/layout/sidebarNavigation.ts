import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  FlaskConical,
  Grid2X2,
  Layers,
  Mountain,
  PackageCheck,
  Settings,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

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
          { label: 'Budgets', path: '/performance/budgets', icon: BarChart3, color: '#8b5cf6' },
          { label: 'Prévisions', path: '/performance/forecasts', icon: TrendingUp, color: '#14b8a6' },
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
          { label: 'Plans mensuels', path: '/achats/plans', icon: CalendarRange, color: '#d79a00' },
          { label: 'Demandes aux mines', path: '/achats/demandes', icon: FileText, color: '#2f6fec' },
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
        label: 'Marché',
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
        label: 'Ventes',
        path: '/sales',
        icon: CircleDollarSign,
        color: '#ec4899',
        children: [
          { label: 'Ventes', path: '/sales', icon: CircleDollarSign, color: '#ec4899' },
          { label: 'Clients', path: '/customers', icon: Users, color: '#14b8a6' },
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
          { label: 'Approbateurs', path: '/stakeholders/approvers', icon: CheckCircle2, color: '#2f6fec' },
          { label: 'Transporteurs', path: '/stakeholders/freight-companies', icon: Truck, color: '#d79a00' },
          { label: 'Raffineries', path: '/stakeholders/refinery-plants', icon: FlaskConical, color: '#8b5cf6' },
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
          { label: 'Approbations', path: '/approvals', icon: CheckCircle2, color: '#16a363' },
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
        path: '/sales',
        icon: CircleDollarSign,
        color: '#ec4899',
      },
      {
        id: 'vue-production',
        label: 'Rapports de production',
        path: '/dashboard/production-modern',
        icon: Building2,
        color: '#10976b',
      },
      {
        id: 'assistance-ia',
        label: 'Assistant IA',
        path: '/analytics/assistant',
        icon: Sparkles,
        color: '#7c3aed',
      },
      {
        id: 'rapports-institutionnels',
        label: 'Rapports institutionnels',
        path: '/reports',
        icon: FileText,
        color: '#2f6fec',
      },
      {
        id: 'performance-nationale',
        label: 'Performance nationale',
        path: '/analytics',
        icon: TrendingUp,
        color: '#8b5cf6',
      },
    ],
  },
];

/** Tous les groupes, toutes sections confondues. */
export const ALL_GROUPS: NavigationGroup[] = NAVIGATION_SECTIONS.flatMap((section) => section.groups);
