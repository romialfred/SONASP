import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { Button } from './Button';

interface CustomConfirmProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export function CustomConfirm({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  type = 'warning'
}: CustomConfirmProps) {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      bgColor: 'bg-gradient-to-br from-red-50 to-rose-50',
      borderColor: 'border-red-500',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      confirmButtonColor: 'bg-red-600 hover:bg-red-700',
      icon: <AlertCircle className="w-12 h-12" />,
      defaultTitle: 'Confirmation requise'
    },
    warning: {
      bgColor: 'bg-gradient-to-br from-amber-50 to-yellow-50',
      borderColor: 'border-amber-500',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900',
      confirmButtonColor: 'bg-amber-600 hover:bg-amber-700',
      icon: <HelpCircle className="w-12 h-12" />,
      defaultTitle: 'Êtes-vous sûr ?'
    },
    info: {
      bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50',
      borderColor: 'border-blue-500',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      confirmButtonColor: 'bg-blue-600 hover:bg-blue-700',
      icon: <CheckCircle className="w-12 h-12" />,
      defaultTitle: 'Confirmation'
    }
  };

  const config = typeConfig[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className={`relative max-w-md w-full ${config.bgColor} rounded-2xl shadow-2xl border-2 ${config.borderColor} overflow-hidden animate-in fade-in zoom-in duration-300`}>
        <div className="p-8 text-center">
          <div className={`inline-flex items-center justify-center ${config.iconColor} mb-4`}>
            {config.icon}
          </div>

          <h3 className={`text-2xl font-bold ${config.titleColor} mb-3`}>
            {title || config.defaultTitle}
          </h3>

          <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line mb-6">
            {message}
          </p>

          <div className="flex gap-3 justify-center">
            <Button
              onClick={onCancel}
              variant="outline"
              className="px-6 py-2.5 font-semibold border-2 hover:bg-gray-100"
            >
              {cancelText}
            </Button>
            <Button
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`${config.confirmButtonColor} text-white px-6 py-2.5 font-semibold shadow-lg`}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
