import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  success?: boolean;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, error, success, ...props }, ref) => {
    const baseStyles = 'sn-input sn-input--textarea';

    const stateStyles = error ? 'sn-input--error' : success ? 'sn-input--success' : '';

    return (
      <textarea
        ref={ref}
        className={cn(baseStyles, stateStyles, className)}
        {...props}
      />
    );
  }
);

TextArea.displayName = 'TextArea';

export { TextArea };
export default TextArea;
