import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { InputProps } from './Input';

const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, success, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const baseStyles = 'flex w-full rounded-lg border px-3 py-2 text-sm transition-all placeholder:text-gray-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10 bg-gray-800/40 backdrop-blur-sm text-white';

    const stateStyles = error
      ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-400'
      : success
      ? 'border-green-500/50 focus:ring-green-500/50 focus:border-green-400'
      : 'border-gray-600/50 focus:ring-amber-500/50 focus:border-amber-400/50 hover:border-gray-500/70';

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
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-400 transition-colors"
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
