/**
 * Toggle Switch Amélioré
 * Version designer avec animations fluides
 */

import { cn } from '@/utils/cn';

interface ToggleImprovedProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ToggleImproved({
  checked,
  onChange,
  disabled = false,
  size = 'md',
}: ToggleImprovedProps) {
  const sizes = {
    sm: {
      container: 'w-9 h-5',
      circle: 'w-3.5 h-3.5',
      translate: 'translate-x-4',
    },
    md: {
      container: 'w-11 h-6',
      circle: 'w-4 h-4',
      translate: 'translate-x-5',
    },
    lg: {
      container: 'w-14 h-7',
      circle: 'w-5 h-5',
      translate: 'translate-x-7',
    },
  };

  const currentSize = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex flex-shrink-0 rounded-full transition-all duration-300 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        currentSize.container,
        checked
          ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/50 focus:ring-green-500'
          : 'bg-gray-300 hover:bg-gray-400 focus:ring-gray-400',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-lg transform transition-all duration-300 ease-in-out',
          currentSize.circle,
          'translate-y-0.5',
          checked ? currentSize.translate + ' scale-110' : 'translate-x-0.5 scale-100'
        )}
      />
    </button>
  );
}
