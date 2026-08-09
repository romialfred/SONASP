import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Message optionnel affiché sous l'indicateur. */
  message?: string;
}

export function Loading({ size = 'md', className, message }: LoadingProps) {
  const sizeStyles = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-primary-500', sizeStyles[size])} />
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
    />
  );
}
