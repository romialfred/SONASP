import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  success?: boolean;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, error, success, ...props }, ref) => {
    const baseStyles = 'flex w-full rounded-lg border px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[80px]';

    const stateStyles = error
      ? 'border-red-500 focus:ring-red-500'
      : success
      ? 'border-accent-500 focus:ring-accent-500'
      : 'border-gray-300 focus:ring-primary-500';

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
