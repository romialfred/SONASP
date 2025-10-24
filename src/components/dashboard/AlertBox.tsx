import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertBoxProps {
  type: AlertType;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function AlertBox({ type, title, message, action }: AlertBoxProps) {
  const config = {
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-900',
      buttonColor: 'text-blue-700 hover:bg-blue-100'
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      textColor: 'text-green-900',
      buttonColor: 'text-green-700 hover:bg-green-100'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      textColor: 'text-yellow-900',
      buttonColor: 'text-yellow-700 hover:bg-yellow-100'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      textColor: 'text-red-900',
      buttonColor: 'text-red-700 hover:bg-red-100'
    }
  };

  const { icon: Icon, bgColor, borderColor, iconColor, textColor, buttonColor } = config[type];

  return (
    <div className={cn('rounded-lg border p-4', bgColor, borderColor)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconColor)} />
        <div className="flex-1 min-w-0">
          <h4 className={cn('text-sm font-semibold mb-1', textColor)}>{title}</h4>
          <p className={cn('text-sm', textColor)}>{message}</p>
          {action && (
            <button
              onClick={action.onClick}
              className={cn('text-sm font-medium mt-2', buttonColor)}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
