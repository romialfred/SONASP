import { useState, useEffect } from 'react';
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
  ChevronDown,
  ChevronRight,
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
  groupColor: string;
}

const menuGroups: MenuGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    groupColor: 'text-blue-400',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, iconColor: 'text-blue-400' },
    ],
  },
  {
    id: 'batches',
    label: 'Batches Management',
    groupColor: 'text-green-400',
    items: [
      { label: 'Batches', path: '/batches', icon: Package, iconColor: 'text-green-400' },
      { label: 'Shipping', path: '/shipping', icon: Truck, iconColor: 'text-cyan-400' },
      { label: 'Refining', path: '/refining', icon: FlaskConical, iconColor: 'text-teal-400' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales Management',
    groupColor: 'text-amber-400',
    items: [
      { label: 'Customers', path: '/customers', icon: Users, iconColor: 'text-purple-400' },
      { label: 'Sales', path: '/sales', icon: ShoppingCart, iconColor: 'text-pink-400' },
      { label: 'Gold Price', path: '/gold-prices', icon: TrendingUp, iconColor: 'text-yellow-400' },
      { label: 'FX Rates', path: '/fx-rates', icon: DollarSign, iconColor: 'text-emerald-400' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights & Reports',
    groupColor: 'text-indigo-400',
    items: [
      { label: 'Analytics', path: '/analytics', icon: BarChart3, iconColor: 'text-indigo-400' },
      { label: 'Reports', path: '/reports', icon: FileText, iconColor: 'text-violet-400' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    groupColor: 'text-red-400',
    items: [
      { label: 'Settings', path: '/settings', icon: Settings, iconColor: 'text-orange-400' },
      { label: 'Audit Trail', path: '/audit', icon: Shield, iconColor: 'text-red-400' },
      { label: 'Users', path: '/users', icon: Users, iconColor: 'text-slate-400' },
    ],
  },
];

const STORAGE_KEY = 'sidebar:lastGroup';

export function AccordionSidebar() {
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    // Initialize from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || null;
  });

  // Determine which group should be open based on current route
  useEffect(() => {
    const currentPath = location.pathname;
    for (const group of menuGroups) {
      const isInGroup = group.items.some(item => currentPath.startsWith(item.path));
      if (isInGroup && openGroup !== group.id) {
        setOpenGroup(group.id);
        localStorage.setItem(STORAGE_KEY, group.id);
        break;
      }
    }
  }, [location.pathname, openGroup]);

  const toggleGroup = (groupId: string) => {
    const newOpenGroup = openGroup === groupId ? null : groupId;
    setOpenGroup(newOpenGroup);
    if (newOpenGroup) {
      localStorage.setItem(STORAGE_KEY, newOpenGroup);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <aside className="w-[280px] bg-gradient-to-b from-amber-500/20 via-yellow-500/15 to-amber-600/20 backdrop-blur-sm min-h-screen border-r border-amber-500/30 flex flex-col shadow-xl">
      {/* Sidebar Header */}
      <div className="p-6 border-b border-amber-500/30 bg-gradient-to-r from-amber-500/30 to-yellow-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          <div>
            <h2 className="text-gray-900 font-bold text-lg leading-tight">
              Mansa Resources
            </h2>
            <span className="block text-xs font-normal text-gray-700">
              Gold Sales Management
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuGroups.map((group) => {
          const isOpen = openGroup === group.id;
          const hasActiveItem = group.items.some(item => isActive(item.path));

          return (
            <div key={group.id} className="space-y-1">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleGroup(group.id);
                  }
                }}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-transparent',
                  isOpen || hasActiveItem
                    ? 'bg-white/80 backdrop-blur-sm text-gray-900 font-semibold shadow-md'
                    : 'text-gray-800 hover:bg-white/50 hover:backdrop-blur-sm'
                )}
                aria-expanded={isOpen}
                aria-controls={`group-${group.id}`}
              >
                <span className={cn('text-sm flex items-center gap-2', group.groupColor)}>
                  {group.label}
                </span>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-600 transition-transform" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600 transition-transform" />
                )}
              </button>

              {/* Group Items */}
              {isOpen && (
                <div
                  id={`group-${group.id}`}
                  className="space-y-1 pl-2 pt-1"
                  role="group"
                  aria-label={group.label}
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2 rounded-md transition-all',
                          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-transparent',
                          active
                            ? 'bg-gradient-to-r from-amber-400/40 to-yellow-400/30 backdrop-blur-sm text-gray-900 font-medium border-l-4 border-amber-500 pl-[14px] shadow-md'
                            : 'text-gray-700 hover:bg-white/40 hover:backdrop-blur-sm hover:text-gray-900'
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon
                          className={cn(
                            'w-5 h-5 flex-shrink-0',
                            active ? item.iconColor : 'text-gray-600'
                          )}
                        />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-yellow-500/10">
        <p className="text-xs text-gray-600 text-center">
          © 2025 Mansa Resources
        </p>
      </div>
    </aside>
  );
}
