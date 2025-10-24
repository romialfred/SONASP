import { cn } from '@/utils/cn';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'primary' | 'accent' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  variant = 'primary',
  size = 'md'
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const variants = {
    primary: 'bg-primary-500',
    accent: 'bg-accent-500',
    secondary: 'bg-secondary-500'
  };

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-sm text-gray-700 font-medium">{label}</span>}
          {showPercentage && (
            <span className="text-xs text-gray-600 font-medium">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div className={cn('w-full bg-gray-200 rounded-full overflow-hidden', sizes[size])}>
        <div
          className={cn('h-full transition-all duration-300 ease-in-out', variants[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
