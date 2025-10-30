import React from 'react';
import { LucideIcon } from 'lucide-react';

export type InfoPanelVariant =
  | 'blue'
  | 'purple'
  | 'amber'
  | 'green'
  | 'red'
  | 'teal'
  | 'pink'
  | 'orange'
  | 'slate';

interface InfoPanelItem {
  text: string;
  icon?: string;
}

interface InfoPanelProps {
  title: string;
  icon: LucideIcon;
  items: InfoPanelItem[];
  variant?: InfoPanelVariant;
  className?: string;
}

const variantStyles: Record<InfoPanelVariant, {
  container: string;
  iconBg: string;
  icon: string;
  bullet: string;
  border: string;
}> = {
  blue: {
    container: 'bg-gradient-to-br from-blue-50 via-blue-50 to-sky-100',
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    icon: 'text-white',
    bullet: 'text-blue-600',
    border: 'border-blue-200',
  },
  purple: {
    container: 'bg-gradient-to-br from-purple-50 via-purple-50 to-violet-100',
    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
    icon: 'text-white',
    bullet: 'text-purple-600',
    border: 'border-purple-200',
  },
  amber: {
    container: 'bg-gradient-to-br from-amber-50 via-amber-50 to-orange-100',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    icon: 'text-white',
    bullet: 'text-amber-600',
    border: 'border-amber-200',
  },
  green: {
    container: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-100',
    iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600',
    icon: 'text-white',
    bullet: 'text-green-600',
    border: 'border-green-200',
  },
  red: {
    container: 'bg-gradient-to-br from-red-50 via-rose-50 to-pink-100',
    iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
    icon: 'text-white',
    bullet: 'text-red-600',
    border: 'border-red-200',
  },
  teal: {
    container: 'bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-100',
    iconBg: 'bg-gradient-to-br from-teal-500 to-cyan-600',
    icon: 'text-white',
    bullet: 'text-teal-600',
    border: 'border-teal-200',
  },
  pink: {
    container: 'bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-100',
    iconBg: 'bg-gradient-to-br from-pink-500 to-fuchsia-600',
    icon: 'text-white',
    bullet: 'text-pink-600',
    border: 'border-pink-200',
  },
  orange: {
    container: 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100',
    iconBg: 'bg-gradient-to-br from-orange-500 to-amber-600',
    icon: 'text-white',
    bullet: 'text-orange-600',
    border: 'border-orange-200',
  },
  slate: {
    container: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100',
    iconBg: 'bg-gradient-to-br from-slate-600 to-gray-700',
    icon: 'text-white',
    bullet: 'text-slate-600',
    border: 'border-slate-200',
  },
};

export function InfoPanel({
  title,
  icon: Icon,
  items,
  variant = 'blue',
  className = ''
}: InfoPanelProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`
        rounded-xl border shadow-sm overflow-hidden
        ${styles.container}
        ${styles.border}
        ${className}
      `}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={`
              w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
              shadow-md
              ${styles.iconBg}
            `}
          >
            <Icon className={`w-6 h-6 ${styles.icon}`} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 mb-3">
              {title}
            </h3>

            <ul className="space-y-2.5">
              {items.map((item, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span className={`font-semibold text-base mt-0.5 flex-shrink-0 ${styles.bullet}`}>
                    {item.icon || '•'}
                  </span>
                  <span className="text-sm text-gray-700 leading-relaxed">
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

interface InfoPanelGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function InfoPanelGroup({ children, className = '' }: InfoPanelGroupProps) {
  return (
    <div className={`space-y-5 ${className}`}>
      {children}
    </div>
  );
}
