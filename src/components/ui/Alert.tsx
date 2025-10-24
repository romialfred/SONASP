import { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', type, title, children, className }: AlertProps) {
  const actualVariant = type || variant;

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

  const { container, icon } = variants[actualVariant];

  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-lg border', container, className)}>
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1">
        {title && <div className="font-semibold mb-1">{title}</div>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
