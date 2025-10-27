import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  success?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, success, ...props }, ref) => {
    const baseStyles = 'flex w-full rounded-lg border px-3 py-2 text-sm transition-all placeholder:text-gray-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 bg-gray-800/40 backdrop-blur-sm text-white';

    const stateStyles = error
      ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-400'
      : success
      ? 'border-green-500/50 focus:ring-green-500/50 focus:border-green-400'
      : 'border-gray-600/50 focus:ring-amber-500/50 focus:border-amber-400/50 hover:border-gray-500/70';

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
