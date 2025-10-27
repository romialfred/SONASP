import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  success?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, success, ...props }, ref) => {
    const baseStyles = 'flex w-full rounded-lg border px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

    const stateStyles = error
      ? 'border-red-500 focus:ring-red-500'
      : success
      ? 'border-accent-500 focus:ring-accent-500'
      : 'border-gray-300 focus:ring-primary-500';

    return (
      <input
        ref={ref}
        className={cn(baseStyles, stateStyles, className)}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
