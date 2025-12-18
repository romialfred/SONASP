/**
 * Refined Checkbox Component
 * Bouton checkbox raffiné pour les permissions
 */

import { Check } from 'lucide-react';

interface RefinedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RefinedCheckbox({
  checked,
  onChange,
  disabled = false,
  size = 'md',
}: RefinedCheckboxProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        inline-flex items-center justify-center
        rounded-lg
        border-2
        transition-all duration-200
        ${
          checked
            ? 'bg-blue-600 border-blue-600 shadow-md'
            : 'bg-white border-gray-300 hover:border-blue-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      `}
    >
      {checked && (
        <Check
          className={`${iconSizes[size]} text-white animate-in fade-in zoom-in duration-150`}
          strokeWidth={3}
        />
      )}
    </button>
  );
}
