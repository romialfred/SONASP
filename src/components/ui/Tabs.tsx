import { ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  children?: (activeTab: string) => ReactNode;
  className?: string;
}

export function Tabs({ tabs, activeTab, defaultTab, onChange, children, className = '' }: TabsProps) {
  const currentTab = activeTab || defaultTab || tabs[0]?.id;

  const handleTabChange = (tabId: string) => {
    onChange?.(tabId);
  };

  return (
    <div className={className}>
      {/* Modern Tabs Navigation */}
      <div className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white -mx-6 px-6">
        <nav className="-mb-px flex space-x-1 overflow-x-auto scrollbar-thin" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            const displayBadge = tab.count !== undefined ? tab.count : tab.badge;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  group relative whitespace-nowrap py-4 px-6 font-medium text-sm transition-all duration-200
                  flex items-center gap-2.5 min-w-fit
                  ${
                    isActive
                      ? 'text-emerald-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                {/* Active indicator line */}
                <span
                  className={`
                    absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-200
                    ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                        : 'bg-transparent group-hover:bg-gray-300'
                    }
                  `}
                />

                {/* Icon */}
                {Icon && (
                  <Icon
                    className={`
                      w-5 h-5 transition-all duration-200
                      ${
                        isActive
                          ? 'text-emerald-600'
                          : 'text-gray-400 group-hover:text-gray-600'
                      }
                    `}
                  />
                )}

                {/* Label */}
                <span className="font-semibold">{tab.label}</span>

                {/* Badge */}
                {displayBadge !== undefined && displayBadge !== null && (
                  <span
                    className={`
                      inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-bold
                      transition-all duration-200
                      ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
                          : 'bg-gray-200 text-gray-700 group-hover:bg-gray-300'
                      }
                    `}
                  >
                    {displayBadge}
                  </span>
                )}

                {/* Hover effect background */}
                {!isActive && (
                  <span className="absolute inset-0 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-t-lg" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {children && (
        <div className="mt-6">
          {children(currentTab)}
        </div>
      )}
    </div>
  );
}
