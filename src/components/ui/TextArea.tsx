import { TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/utils/cn';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
  success?: boolean;
  label?: string;
  helperText?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, error, success, label, helperText, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;
    const shownHelper = errorMessage ?? helperText;
    const helperId = shownHelper ? `${textareaId}-description` : undefined;
    const ariaDescribedBy = [describedBy, helperId].filter(Boolean).join(' ') || undefined;
    const baseStyles = 'sn-input sn-input--textarea';

    const stateStyles = hasError ? 'sn-input--error' : success ? 'sn-input--success' : '';

    const field = (
      <textarea
        id={textareaId}
        ref={ref}
        aria-invalid={hasError || undefined}
        aria-describedby={ariaDescribedBy}
        className={cn(baseStyles, stateStyles, className)}
        {...props}
      />
    );

    if (!label && !shownHelper) return field;

    return (
      <div className="space-y-1">
        {label && <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700">{label}</label>}
        {field}
        {shownHelper && (
          <p id={helperId} className={cn('text-xs', hasError ? 'text-red-600' : 'text-gray-500')}>{shownHelper}</p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export { TextArea };
export default TextArea;
