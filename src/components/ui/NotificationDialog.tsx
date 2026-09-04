import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';
import Button from './Button';
import { ActionErrorDialog } from './ActionErrorDialog';
import { presentError } from '@/lib/presentError';

interface NotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  showCancel?: boolean;
}

export function NotificationDialog({
  isOpen,
  onClose,
  type,
  title,
  message,
  confirmText = 'OK',
  onConfirm,
  cancelText = 'Annuler',
  showCancel = false,
}: NotificationDialogProps) {
  if (!isOpen) return null;

  if (type === 'error' && typeof message === 'string') {
    const technical = /PGRST|SQLSTATE|constraint|could not embed|foreign key|row.level security|fetch|network/i.test(message);
    const error = presentError(message);
    return <ActionErrorDialog isOpen onClose={onClose}
      title={technical ? error.title : title === 'Erreur' ? 'Impossible d’effectuer cette action' : title}
      message={technical ? error.message : message} recovery={technical ? error.recovery : undefined}
      diagnosticCode={error.code} onAction={onConfirm ? () => { onConfirm(); onClose(); } : undefined}
      actionLabel={confirmText} />;
  }

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      iconBg: 'bg-green-100',
      gradient: 'from-green-50 to-emerald-50',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      iconBg: 'bg-red-100',
      gradient: 'from-red-50 to-rose-50',
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900',
      iconBg: 'bg-amber-100',
      gradient: 'from-amber-50 to-yellow-50',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      iconBg: 'bg-blue-100',
      gradient: 'from-blue-50 to-indigo-50',
    },
  };

  const { icon: Icon, bgColor, borderColor, iconColor, titleColor, iconBg, gradient } = config[type];

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md animate-slideUp">
        <div className={`bg-gradient-to-br ${gradient} border-2 ${borderColor} rounded-2xl shadow-2xl overflow-hidden`}>
          {/* Header with close button */}
          <div className="relative px-6 pt-6 pb-4">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/50 transition-colors"
              aria-label="Fermer"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className={`${iconBg} p-4 rounded-full`}>
                <Icon className={`h-12 w-12 ${iconColor}`} strokeWidth={2.5} />
              </div>
            </div>

            {/* Title */}
            <h2 className={`text-2xl font-bold text-center ${titleColor} mb-2`}>
              {title}
            </h2>
          </div>

          {/* Message */}
          <div className="px-6 pb-6">
            <div className={`${bgColor} border ${borderColor} rounded-xl p-4 mb-6`}>
              {typeof message === 'string' ? (
                <p className="text-gray-700 text-center leading-relaxed">{message}</p>
              ) : (
                message
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {showCancel && (
                <Button
                  variant="secondary"
                  onClick={onClose}
                  className="flex-1"
                >
                  {cancelText}
                </Button>
              )}
              <Button
                variant={type === 'error' ? 'secondary' : 'primary'}
                onClick={handleConfirm}
                className={`${showCancel ? 'flex-1' : 'w-full'}`}
              >
                {confirmText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for easy usage
export function useNotification() {
  const [notification, setNotification] = React.useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    onConfirm?: () => void;
    cancelText?: string;
    showCancel?: boolean;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string | React.ReactNode,
    options?: {
      confirmText?: string;
      onConfirm?: () => void;
      cancelText?: string;
      showCancel?: boolean;
    }
  ) => {
    setNotification({
      isOpen: true,
      type,
      title,
      message,
      ...options,
    });
  };

  const closeNotification = () => {
    setNotification((prev) => ({ ...prev, isOpen: false }));
  };

  return {
    notification,
    showNotification,
    closeNotification,
    showSuccess: (title: string, message: string | React.ReactNode, options?: any) =>
      showNotification('success', title, message, options),
    showError: (title: string, message: string | React.ReactNode, options?: any) =>
      showNotification('error', title, message, options),
    showWarning: (title: string, message: string | React.ReactNode, options?: any) =>
      showNotification('warning', title, message, options),
    showInfo: (title: string, message: string | React.ReactNode, options?: any) =>
      showNotification('info', title, message, options),
  };
}

// Add to global styles (in index.css)
/*
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out;
}
*/
