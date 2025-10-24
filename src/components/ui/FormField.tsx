import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function FormField({ label, error, hint, required, className, children, ...props }: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
