import { ButtonHTMLAttributes, ReactNode, forwardRef, ComponentType } from 'react';
import { Loader2, LucideProps } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode | ComponentType<LucideProps>;
}

/**
 * Bouton de la plateforme.
 *
 * L'API publique est inchangée ; le rendu s'appuie desormais sur le design system
 * (`sn-btn`). Les variantes historiques sont projetees sur les trois intentions
 * retenues : action principale, action neutre, action destructrice.
 */
const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'sn-btn--primary',
  success: 'sn-btn--primary',
  secondary: '',
  outline: '',
  ghost: 'sn-btn--ghost',
  danger: 'sn-btn--danger',
};

const SIZE_CLASS: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'sn-btn--sm',
  md: '',
  lg: 'sn-btn--lg',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    loading,
    disabled,
    fullWidth = false,
    icon,
    children,
    ...props
  }, ref) => {
    const renderIcon = () => {
      if (!icon || loading) return null;

      if (typeof icon === 'function') {
        const IconComponent = icon as ComponentType<LucideProps>;
        return (
          <span className="flex items-center" data-testid="button-icon-wrapper">
            <IconComponent className="h-4 w-4" />
          </span>
        );
      }

      return (
        <span className="flex items-center" data-testid="button-icon-wrapper">
          {icon as ReactNode}
        </span>
      );
    };

    return (
      <button
        ref={ref}
        className={cn(
          'sn-btn',
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 sn-spin" aria-hidden="true" />}
        {renderIcon()}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export default Button;
