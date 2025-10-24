import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  success?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, success, children, ...props }, ref) => {
    const baseStyles = 'flex w-full appearance-none rounded-lg border px-3 py-2 pr-10 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white';

    const stateStyles = error
      ? 'border-red-500 focus:ring-red-500'
      : success
      ? 'border-accent-500 focus:ring-accent-500'
      : 'border-gray-300 focus:ring-primary-500';

    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(baseStyles, stateStyles, className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
