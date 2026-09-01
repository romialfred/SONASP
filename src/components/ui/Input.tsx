import { ElementType, InputHTMLAttributes, ReactNode, createElement, forwardRef, isValidElement, useId } from 'react';
import { cn } from '@/utils/cn';

type InputIcon = ReactNode | ElementType;

const isIconComponent = (icon: InputIcon): icon is ElementType => {
  if (typeof icon === 'function') return true;
  if (typeof icon !== 'object' || icon === null || isValidElement(icon) || !('$$typeof' in icon)) return false;

  return [
    Symbol.for('react.forward_ref'),
    Symbol.for('react.memo'),
    Symbol.for('react.lazy'),
  ].includes(icon.$$typeof as symbol);
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** `true` pour l'état erreur, ou une chaîne = message d'erreur affiché sous le champ. */
  error?: boolean | string;
  success?: boolean;
  /** Icône optionnelle affichée à gauche du champ (composant ou élément React). */
  icon?: InputIcon;
  /** Libellé optionnel affiché au-dessus du champ (associé via htmlFor pour l'accessibilité). */
  label?: string;
  /** Message d'aide ou d'erreur affiché sous le champ. */
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, success, icon, label, helperText, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;
    const shownHelper = errorMessage ?? helperText;
    const helperId = shownHelper ? `${inputId}-description` : undefined;
    const ariaDescribedBy = [describedBy, helperId].filter(Boolean).join(' ') || undefined;
    const renderedIcon = icon && isIconComponent(icon)
      ? createElement(icon, { 'aria-hidden': true })
      : icon;

    const baseStyles = 'sn-input';

    const stateStyles = hasError ? 'sn-input--error' : success ? 'sn-input--success' : '';

    const inputEl = (
      <input
        id={inputId}
        ref={ref}
        aria-invalid={hasError || undefined}
        aria-describedby={ariaDescribedBy}
        className={cn(baseStyles, stateStyles, icon ? 'sn-input--with-icon' : undefined, className)}
        {...props}
      />
    );

    const fieldEl = icon ? (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          {renderedIcon}
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
          <p id={helperId} className={cn('text-xs', hasError ? 'text-red-600' : 'text-gray-500')}>{shownHelper}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
