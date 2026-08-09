import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** `true` pour l'état erreur, ou une chaîne = message d'erreur affiché sous le champ. */
  error?: boolean | string;
  success?: boolean;
  /** Icône optionnelle affichée à gauche du champ. */
  icon?: ReactNode;
  /** Libellé optionnel affiché au-dessus du champ (associé via htmlFor pour l'accessibilité). */
  label?: string;
  /** Message d'aide ou d'erreur affiché sous le champ. */
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, success, icon, label, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;
    const shownHelper = errorMessage ?? helperText;

    const baseStyles = 'flex w-full rounded-lg border px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

    const stateStyles = hasError
      ? 'border-red-500 focus:ring-red-500'
      : success
      ? 'border-accent-500 focus:ring-accent-500'
      : 'border-gray-300 focus:ring-primary-500';

    const inputEl = (
      <input
        id={inputId}
        ref={ref}
        aria-invalid={hasError || undefined}
        className={cn(baseStyles, stateStyles, icon ? 'pl-10' : undefined, className)}
        {...props}
      />
    );

    const fieldEl = icon ? (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          {icon}
        </span>
        {inputEl}
      </div>
    ) : (
      inputEl
    );

    if (!label && !shownHelper) return fieldEl;

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        {fieldEl}
        {shownHelper && (
          <p className={cn('text-xs', hasError ? 'text-red-600' : 'text-gray-500')}>{shownHelper}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
