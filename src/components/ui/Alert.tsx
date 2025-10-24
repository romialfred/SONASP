import { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', children, className }: AlertProps) {
  const variants = {
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: <Info className="h-5 w-5 text-blue-500" />,
    },
    success: {
      container: 'bg-accent-50 border-accent-200 text-accent-800',
      icon: <CheckCircle className="h-5 w-5 text-accent-500" />,
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    },
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: <XCircle className="h-5 w-5 text-red-500" />,
    },
  };

  const { container, icon } = variants[variant];

  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-lg border', container, className)}>
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );
}
