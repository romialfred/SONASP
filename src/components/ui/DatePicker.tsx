import { forwardRef, InputHTMLAttributes } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean;
  success?: boolean;
}

const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, error, success, ...props }, ref) => {
    const baseStyles = 'flex w-full rounded-lg border px-3 py-2 pr-10 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

    const stateStyles = error
      ? 'border-red-500 focus:ring-red-500'
      : success
      ? 'border-accent-500 focus:ring-accent-500'
      : 'border-gray-300 focus:ring-primary-500';

    return (
      <div className="relative">
        <input
          ref={ref}
          type="date"
          className={cn(baseStyles, stateStyles, className)}
          {...props}
        />
        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

export default DatePicker;
