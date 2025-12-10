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
      {/* Tabs Navigation with Strong Hover Effects */}
      <div className="border-b-2 border-gray-200 -mx-6 px-6">
        <nav className="-mb-0.5 flex space-x-2 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            const displayBadge = tab.count !== undefined ? tab.count : tab.badge;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  relative whitespace-nowrap py-4 px-5 font-semibold text-sm transition-all duration-200
                  flex items-center gap-2.5 min-w-fit border-b-3
                  ${
                    isActive
                      ? 'text-emerald-700 border-b-3 border-emerald-600 bg-emerald-50/50'
                      : 'text-gray-600 border-b-3 border-transparent hover:text-gray-900 hover:bg-gray-100 hover:border-gray-400'
                  }
                `}
              >
                {/* Icon */}
                {Icon && (
                  <Icon
                    className={`
                      w-5 h-5 transition-colors duration-200
                      ${
                        isActive
                          ? 'text-emerald-600'
                          : 'text-gray-400'
                      }
                    `}
                  />
                )}

                {/* Label */}
                <span>{tab.label}</span>

                {/* Badge */}
                {displayBadge !== undefined && displayBadge !== null && (
                  <span
                    className={`
                      inline-flex items-center justify-center min-w-[1.75rem] h-6 px-2.5 rounded-full text-xs font-bold
                      transition-all duration-200
                      ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-300 text-gray-700'
                      }
                    `}
                  >
                    {displayBadge}
                  </span>
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
