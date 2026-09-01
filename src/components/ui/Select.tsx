import { SelectHTMLAttributes, forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** `true` pour l'état erreur, ou une chaîne = message d'erreur affiché sous le champ. */
  error?: boolean | string;
  success?: boolean;
  /** Libellé optionnel affiché au-dessus du champ (associé via htmlFor pour l'accessibilité). */
  label?: string;
  /** Message d'aide ou d'erreur affiché sous le champ. */
  helperText?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, success, label, helperText, id, children, 'aria-describedby': describedBy, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;
    const shownHelper = errorMessage ?? helperText;
    const helperId = shownHelper ? `${selectId}-description` : undefined;
    const ariaDescribedBy = [describedBy, helperId].filter(Boolean).join(' ') || undefined;

    const baseStyles = 'sn-input sn-input--select';

    const stateStyles = hasError ? 'sn-input--error' : success ? 'sn-input--success' : '';

    const fieldEl = (
      <div className="relative">
        <select
          id={selectId}
          ref={ref}
          aria-invalid={hasError || undefined}
          aria-describedby={ariaDescribedBy}
          className={cn(baseStyles, stateStyles, className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      </div>
    );

    if (!label && !shownHelper) return fieldEl;

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        {fieldEl}
        {shownHelper && (
          <p id={helperId} className={cn('text-xs', hasError ? 'text-red-600' : 'text-gray-500')}>{shownHelper}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
export default Select;
