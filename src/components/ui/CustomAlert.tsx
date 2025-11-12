import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { Button } from './Button';

interface CustomAlertProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  icon?: React.ReactNode;
}

export function CustomAlert({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  icon
}: CustomAlertProps) {
  if (!isOpen) return null;

  const typeConfig = {
    success: {
      bgColor: 'bg-gradient-to-br from-emerald-50 to-green-50',
      borderColor: 'border-emerald-500',
      iconColor: 'text-emerald-600',
      titleColor: 'text-emerald-900',
      buttonColor: 'bg-emerald-600 hover:bg-emerald-700',
      defaultIcon: <CheckCircle className="w-12 h-12" />,
      defaultTitle: 'Succès'
    },
    error: {
      bgColor: 'bg-gradient-to-br from-red-50 to-rose-50',
      borderColor: 'border-red-500',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      buttonColor: 'bg-red-600 hover:bg-red-700',
      defaultIcon: <AlertCircle className="w-12 h-12" />,
      defaultTitle: 'Erreur'
    },
    warning: {
      bgColor: 'bg-gradient-to-br from-amber-50 to-yellow-50',
      borderColor: 'border-amber-500',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900',
      buttonColor: 'bg-amber-600 hover:bg-amber-700',
      defaultIcon: <AlertCircle className="w-12 h-12" />,
      defaultTitle: 'Attention'
    },
    info: {
      bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50',
      borderColor: 'border-blue-500',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      defaultIcon: <Info className="w-12 h-12" />,
      defaultTitle: 'Information'
    }
  };

  const config = typeConfig[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className={`relative max-w-md w-full ${config.bgColor} rounded-2xl shadow-2xl border-2 ${config.borderColor} overflow-hidden animate-in fade-in zoom-in duration-300`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 text-center">
          <div className={`inline-flex items-center justify-center ${config.iconColor} mb-4`}>
            {icon || config.defaultIcon}
          </div>

          <h3 className={`text-2xl font-bold ${config.titleColor} mb-3`}>
            {title || config.defaultTitle}
          </h3>

          <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
            {message}
          </p>

          <div className="mt-6">
            <Button
              onClick={onClose}
              className={`${config.buttonColor} text-white px-8 py-2.5 font-semibold shadow-lg`}
            >
              OK
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
