import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Package,
  Truck,
  FlaskConical,
  Users,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface MenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    id: 'batches',
    label: 'Batches Management',
    items: [
      { label: 'Batches', path: '/batches', icon: Package },
      { label: 'Shipping', path: '/shipping', icon: Truck },
      { label: 'Refining', path: '/refining', icon: FlaskConical },
    ],
  },
  {
    id: 'sales',
    label: 'Sales Management',
    items: [
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Sales', path: '/sales', icon: ShoppingCart },
      { label: 'Gold Price', path: '/gold-prices', icon: TrendingUp },
      { label: 'FX Rates', path: '/fx-rates', icon: DollarSign },
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
    <aside className="w-[280px] bg-slate-900 min-h-screen border-r border-slate-800 flex flex-col">
      {/* Sidebar Header */}
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-white font-bold text-lg leading-tight">
          Mansa Resources
          <span className="block text-sm font-normal text-slate-400 mt-1">
            Gold Sales Management
          </span>
        </h2>
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
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900',
                  isOpen || hasActiveItem
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-200 hover:bg-slate-800'
                )}
                aria-expanded={isOpen}
                aria-controls={`group-${group.id}`}
              >
                <span className="text-sm">{group.label}</span>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 transition-transform" />
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
                          'flex items-center gap-3 px-4 py-2 rounded-md transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900',
                          active
                            ? 'bg-amber-500/20 text-amber-300 border-l-4 border-amber-400 pl-[14px]'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon
                          className={cn(
                            'w-5 h-5 flex-shrink-0',
                            active ? 'text-amber-300' : 'text-slate-400'
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
      <div className="p-4 border-t border-slate-800">
        <Link
          to="/users"
          className={cn(
            'flex items-center gap-3 px-4 py-2 rounded-md transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900',
            isActive('/users')
              ? 'bg-amber-500/20 text-amber-300 border-l-4 border-amber-400 pl-[14px]'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          )}
          aria-current={isActive('/users') ? 'page' : undefined}
        >
          <Users
            className={cn(
              'w-5 h-5 flex-shrink-0',
              isActive('/users') ? 'text-amber-300' : 'text-slate-400'
            )}
          />
          <span className="text-sm">Users Management</span>
        </Link>
      </div>
    </aside>
  );
}
