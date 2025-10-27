import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { InputProps } from './Input';

const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, success, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const baseStyles = 'flex w-full rounded-lg border px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10';

    const stateStyles = error
      ? 'border-red-500 focus:ring-red-500'
      : success
      ? 'border-accent-500 focus:ring-accent-500'
      : 'border-gray-300 focus:ring-primary-500';

    return (
      <div className="relative">
        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          className={cn(baseStyles, stateStyles, className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
