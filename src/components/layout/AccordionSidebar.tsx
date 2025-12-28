import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  FlaskConical,
  Users,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  BarChart3,
  FileText,
  Settings,
  Shield,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Menu,
  CreditCard,
  Warehouse,
  PackagePlus,
  Sparkles,
  Coins,
  Building2,
  Factory,
  Handshake,
  Store,
  Activity,
  ScanText,
  Lock,
  Award,
  Layers,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  Pickaxe,
  Flame,
  Ship,
  Grid,
  Calendar,
  Plus,
  FileCheck,
  LineChart,
  Send,
  Network,
  PackageCheck,
  CalendarDays,
  Calculator,
  List,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface MenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
  groupIconColor: string;
  groupIcon?: React.ComponentType<{ className?: string }>;
}

const STORAGE_KEY = 'sidebar:lastGroup';
const COLLAPSED_KEY = 'sidebar:collapsed';

const menuGroups: MenuGroup[] = [
  {
    id: 'production',
    label: 'Production',
    groupIconColor: 'text-amber-600',
    groupIcon: Factory,
    items: [
      { label: 'Production Journalière', path: '/production/daily', icon: CalendarDays, iconColor: 'text-amber-600' },
      { label: 'Production en Coffre', path: '/production/in-safe', icon: Shield, iconColor: 'text-amber-600' },
      { label: 'Licences d\'Export', path: '/production/export-licenses', icon: FileCheck, iconColor: 'text-amber-600' },
      { label: 'Budget Annuel', path: '/production/budget', icon: Calculator, iconColor: 'text-amber-600' },
    ],
  },
  {
    id: 'shipping',
    label: 'Expédition',
    groupIconColor: 'text-blue-600',
    groupIcon: Package,
    items: [
      { label: 'Liste des Expéditions', path: '/shipping', icon: List, iconColor: 'text-blue-600' },
      { label: 'Nouvelle Expédition', path: '/shipping/new', icon: Plus, iconColor: 'text-blue-600' },
      { label: 'Transport Douane', path: '/freight/customs', icon: Truck, iconColor: 'text-blue-600' },
      { label: 'Envois de Fret', path: '/freight/shipments', icon: Ship, iconColor: 'text-blue-600' },
    ],
  },
  {
    id: 'refining',
    label: 'Affinage',
    groupIconColor: 'text-orange-600',
    groupIcon: Flame,
    items: [
      { label: 'Tableau de Bord', path: '/refining', icon: LayoutDashboard, iconColor: 'text-orange-600' },
      { label: 'Envois en Affinage', path: '/refining/shipments', icon: Send, iconColor: 'text-orange-600' },
      { label: 'Réception Raffinerie', path: '/refining/receiving', icon: PackageCheck, iconColor: 'text-orange-600' },
    ],
  },
  {
    id: 'sales',
    label: 'Ventes',
    groupIconColor: 'text-green-600',
    groupIcon: DollarSign,
    items: [
      { label: 'Liste des Ventes', path: '/sales', icon: List, iconColor: 'text-green-600' },
      { label: 'Nouvelle Vente', path: '/sales/new', icon: Plus, iconColor: 'text-green-600' },
      { label: 'Espace Trading Or', path: '/sales/trade-space', icon: Store, iconColor: 'text-green-600' },
      { label: 'Pré-Ventes', path: '/presales', icon: Calendar, iconColor: 'text-green-600' },
    ],
  },
  {
    id: 'artisan',
    label: 'Artisans Miniers',
    groupIconColor: 'text-yellow-700',
    groupIcon: Pickaxe,
    items: [
      { label: 'Tableau de Bord', path: '/artisan-minier', icon: LayoutDashboard, iconColor: 'text-yellow-700' },
      { label: 'Liste des Artisans', path: '/artisan-minier/liste', icon: List, iconColor: 'text-yellow-700' },
      { label: 'Validation Cartes', path: '/artisan-minier/carte-validation', icon: CheckCircle, iconColor: 'text-yellow-700' },
      { label: 'Suivi des Cartes', path: '/artisan-minier/carte-suivi', icon: Activity, iconColor: 'text-yellow-700' },
      { label: 'Expirations', path: '/artisan-minier/carte-expirations', icon: AlertTriangle, iconColor: 'text-yellow-700' },
      { label: 'Ventes d\'Or', path: '/artisan-minier/ventes-or', icon: Coins, iconColor: 'text-yellow-700' },
    ],
  },
  {
    id: 'customers',
    label: 'Clients',
    groupIconColor: 'text-purple-600',
    groupIcon: Users,
    items: [
      { label: 'Liste des Clients', path: '/customers', icon: List, iconColor: 'text-purple-600' },
      { label: 'Nouveau Client', path: '/customers/new', icon: UserPlus, iconColor: 'text-purple-600' },
    ],
  },
  {
    id: 'stakeholders',
    label: 'Parties Prenantes',
    groupIconColor: 'text-indigo-600',
    groupIcon: Network,
    items: [
      { label: 'Sociétés Minières', path: '/stakeholders/mining-companies', icon: Building2, iconColor: 'text-indigo-600' },
      { label: 'Raffineries', path: '/stakeholders/refineries', icon: FlaskConical, iconColor: 'text-indigo-600' },
      { label: 'Déposants', path: '/stakeholders/depositors', icon: Handshake, iconColor: 'text-indigo-600' },
      { label: 'Transporteurs', path: '/stakeholders/freight-companies', icon: Truck, iconColor: 'text-indigo-600' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventaire',
    groupIconColor: 'text-cyan-600',
    groupIcon: Warehouse,
    items: [
      { label: 'Stock Or', path: '/inventory', icon: PackageCheck, iconColor: 'text-cyan-600' },
      { label: 'Stock Argent', path: '/inventory/silver', icon: Sparkles, iconColor: 'text-cyan-600' },
      { label: 'Nouveau Stock', path: '/inventory/add', icon: PackagePlus, iconColor: 'text-cyan-600' },
    ],
  },
  {
    id: 'payments',
    label: 'Paiements',
    groupIconColor: 'text-emerald-600',
    groupIcon: CreditCard,
    items: [
      { label: 'Liste des Paiements', path: '/payments', icon: List, iconColor: 'text-emerald-600' },
      { label: 'Nouveau Paiement', path: '/payments/new', icon: Plus, iconColor: 'text-emerald-600' },
      { label: 'Paiements Virtuels', path: '/payments/virtual', icon: Coins, iconColor: 'text-emerald-600' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytique',
    groupIconColor: 'text-pink-600',
    groupIcon: BarChart3,
    items: [
      { label: 'Tableau de Bord', path: '/analytics', icon: LayoutDashboard, iconColor: 'text-pink-600' },
      { label: 'Rapports', path: '/reports', icon: FileText, iconColor: 'text-pink-600' },
      { label: 'Centre d\'Analyses', path: '/analytics/intelligence', icon: TrendingUp, iconColor: 'text-pink-600' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    groupIconColor: 'text-slate-600',
    groupIcon: FileText,
    items: [
      { label: 'Certificats d\'Essai', path: '/documents/assay-certificates', icon: FileCheck, iconColor: 'text-slate-600' },
    ],
  },
  {
    id: 'prices',
    label: 'Prix & Taux',
    groupIconColor: 'text-teal-600',
    groupIcon: LineChart,
    items: [
      { label: 'Prix de l\'Or', path: '/prices/gold', icon: Coins, iconColor: 'text-teal-600' },
      { label: 'Taux de Change', path: '/prices/fx-rates', icon: DollarSign, iconColor: 'text-teal-600' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    groupIconColor: 'text-red-600',
    groupIcon: Settings,
    items: [
      { label: 'Utilisateurs', path: '/admin/users', icon: Users, iconColor: 'text-red-600' },
      { label: 'Gestion des Modules', path: '/admin/modules', icon: Grid, iconColor: 'text-red-600' },
      { label: 'Paramètres Ventes', path: '/admin/gold-sales-settings', icon: Settings, iconColor: 'text-red-600' },
      { label: 'Gestion des Statuts', path: '/admin/status-manager', icon: GitBranch, iconColor: 'text-red-600' },
      { label: 'Paramètres Système', path: '/admin/settings', icon: Settings, iconColor: 'text-red-600' },
      { label: 'Journal d\'Audit', path: '/admin/audit', icon: Shield, iconColor: 'text-red-600' },
      { label: 'Approbations', path: '/admin/approvals', icon: CheckCircle, iconColor: 'text-red-600' },
    ],
  },
];

export const AccordionSidebar = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    return new Set();
  });

  const [showDashboard, setShowDashboard] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    return saved === 'true';
  });

  useEffect(() => {
    const currentPath = location.pathname;
    for (const group of menuGroups) {
      for (const item of group.items) {
        if (currentPath.startsWith(item.path)) {
          setExpandedGroups(prev => new Set([...prev, group.id]));
          break;
        }
      }
    }
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const toggleSidebar = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem(COLLAPSED_KEY, String(newCollapsed));
  };

  return (
    <aside
      className={cn(
        'h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <h2 className="text-lg font-semibold text-gray-800">
            {t('common.myApplications', 'My Applications')}
          </h2>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {showDashboard && (
          <Link
            to="/dashboard"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg mb-2 transition-colors group',
              location.pathname === '/dashboard'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )}
            title={collapsed ? 'Dashboard' : undefined}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="font-medium">{t('common.dashboard', 'Dashboard')}</span>
            )}
          </Link>
        )}

        <div className="space-y-1">
          {menuGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const GroupIcon = group.groupIcon || Package;

            return (
              <div key={group.id} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group',
                    isExpanded
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                  title={collapsed ? group.label : undefined}
                >
                  <GroupIcon className={cn('w-5 h-5 flex-shrink-0', group.groupIconColor)} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left font-medium text-sm">
                        {group.label}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </>
                  )}
                </button>

                {isExpanded && !collapsed && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = location.pathname === item.path ||
                                     location.pathname.startsWith(item.path + '/');

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm',
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          )}
                        >
                          <ItemIcon className={cn('w-4 h-4 flex-shrink-0', item.iconColor)} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-gray-200 text-xs text-gray-500 text-center">
        {!collapsed && '© 2025 Mansa Resources'}
      </div>
    </aside>
  );
};
