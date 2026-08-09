import { useDialog } from '@/contexts/DialogContext';
import { useTranslation } from 'react-i18next';

export function useAlert() {
  const dialog = useDialog();
  const { t } = useTranslation();

  return {
    // Success alerts
    success: (message: string, title?: string) => {
      dialog.showSuccess(
        title || t('common.success', 'Success'),
        message
      );
    },

    // Error alerts
    error: (message: string, title?: string) => {
      dialog.showError(
        title || t('common.error', 'Error'),
        message
      );
    },

    // Info alerts
    info: (message: string, title?: string) => {
      dialog.showInfo(
        title || t('common.information', 'Information'),
        message
      );
    },

    // Warning alerts
    warning: (message: string, title?: string) => {
      dialog.showWarning(
        title || t('common.warning', 'Warning'),
        message
      );
    },

    // Confirmation dialog
    confirm: (
      message: string,
      onConfirm: () => void | Promise<void>,
      title?: string
    ) => {
      dialog.showConfirm(
        title || t('common.confirm', 'Confirmation'),
        message,
        onConfirm
      );
    },

    // Dispatch générique par type (compat) : showAlert(message, 'error' | 'success' | ...)
    showAlert: (
      message: string,
      type: 'success' | 'error' | 'info' | 'warning' = 'info',
      title?: string
    ) => {
      switch (type) {
        case 'success':
          dialog.showSuccess(title || t('common.success', 'Success'), message);
          break;
        case 'error':
          dialog.showError(title || t('common.error', 'Error'), message);
          break;
        case 'warning':
          dialog.showWarning(title || t('common.warning', 'Warning'), message);
          break;
        default:
          dialog.showInfo(title || t('common.information', 'Information'), message);
      }
    },

    // Custom dialog with full control
    custom: dialog.showDialog,

    // Close dialog
    close: dialog.closeDialog
  };
}
