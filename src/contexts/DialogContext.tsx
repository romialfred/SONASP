import { createContext, useContext, useState, ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

type DialogType = 'info' | 'success' | 'warning' | 'error';

interface DialogConfig {
  type: DialogType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  showCancel?: boolean;
}

interface DialogContextType {
  showDialog: (config: DialogConfig) => void;
  showInfo: (title: string, message: string) => void;
  showSuccess: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  closeDialog: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return context;
}

const getDialogIcon = (type: DialogType) => {
  switch (type) {
    case 'info':
      return <Info className="w-12 h-12 text-blue-500" />;
    case 'success':
      return <CheckCircle className="w-12 h-12 text-green-500" />;
    case 'warning':
      return <AlertCircle className="w-12 h-12 text-yellow-500" />;
    case 'error':
      return <XCircle className="w-12 h-12 text-red-500" />;
  }
};

const getDialogColors = (type: DialogType) => {
  switch (type) {
    case 'info':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        button: 'primary'
      };
    case 'success':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        button: 'primary'
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        button: 'primary'
      };
    case 'error':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        button: 'danger'
      };
  }
};

interface DialogProviderProps {
  children: ReactNode;
}

export function DialogProvider({ children }: DialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<DialogConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const showDialog = (dialogConfig: DialogConfig) => {
    setConfig(dialogConfig);
    setIsOpen(true);
  };

  const showInfo = (title: string, message: string) => {
    showDialog({ type: 'info', title, message, confirmText: 'OK', showCancel: false });
  };

  const showSuccess = (title: string, message: string) => {
    showDialog({ type: 'success', title, message, confirmText: 'OK', showCancel: false });
  };

  const showWarning = (title: string, message: string) => {
    showDialog({ type: 'warning', title, message, confirmText: 'OK', showCancel: false });
  };

  const showError = (title: string, message: string) => {
    showDialog({ type: 'error', title, message, confirmText: 'OK', showCancel: false });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    showDialog({
      type: 'warning',
      title,
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm
    });
  };

  const closeDialog = () => {
    setIsOpen(false);
    setConfig(null);
    setIsProcessing(false);
  };

  const handleConfirm = async () => {
    if (config?.onConfirm) {
      setIsProcessing(true);
      try {
        await config.onConfirm();
      } catch (error) {
        console.error('Dialog confirm error:', error);
      } finally {
        setIsProcessing(false);
      }
    }
    closeDialog();
  };

  const handleCancel = () => {
    if (config?.onCancel) {
      config.onCancel();
    }
    closeDialog();
  };

  if (!config) {
    return <>{children}</>;
  }

  const colors = getDialogColors(config.type);

  return (
    <DialogContext.Provider
      value={{
        showDialog,
        showInfo,
        showSuccess,
        showWarning,
        showError,
        showConfirm,
        closeDialog
      }}
    >
      {children}

      <Modal isOpen={isOpen} onClose={handleCancel} title="">
        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            {getDialogIcon(config.type)}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-3">
            {config.title}
          </h2>

          {/* Message */}
          <div className={`rounded-lg p-4 border ${colors.bg} ${colors.border} mb-6`}>
            <p className={`text-center ${colors.text} whitespace-pre-line`}>
              {config.message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            {config.showCancel && (
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={isProcessing}
                className="min-w-[120px]"
              >
                {config.cancelText || 'Cancel'}
              </Button>
            )}
            <Button
              variant={colors.button as 'primary' | 'danger'}
              onClick={handleConfirm}
              loading={isProcessing}
              className="min-w-[120px]"
            >
              {config.confirmText || 'OK'}
            </Button>
          </div>
        </div>
      </Modal>
    </DialogContext.Provider>
  );
}
