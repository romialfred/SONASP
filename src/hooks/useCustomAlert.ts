import { useState } from 'react';

interface AlertState {
  isOpen: boolean;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ConfirmState {
  isOpen: boolean;
  title?: string;
  message: string;
  type: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function useCustomAlert() {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    type: 'warning',
    onConfirm: () => {}
  });

  const showAlert = (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    title?: string
  ) => {
    setAlertState({
      isOpen: true,
      message,
      type,
      title
    });
  };

  const showSuccess = (message: string, title?: string) => {
    showAlert(message, 'success', title);
  };

  const showError = (message: string, title?: string) => {
    showAlert(message, 'error', title);
  };

  const showInfo = (message: string, title?: string) => {
    showAlert(message, 'info', title);
  };

  const showWarning = (message: string, title?: string) => {
    showAlert(message, 'warning', title);
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  };

  const showConfirm = (
    title: string,
    message: string,
    options?: {
      type?: 'danger' | 'warning' | 'info';
      confirmText?: string;
      cancelText?: string;
    }
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const handleConfirm = () => {
        resolve(true);
      };

      const handleCancel = () => {
        resolve(false);
      };

      setConfirmState({
        isOpen: true,
        message,
        type: options?.type || 'warning',
        title,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        onConfirm: handleConfirm,
        onCancel: handleCancel
      });
    });
  };

  const closeConfirm = () => {
    if (confirmState.onCancel) {
      confirmState.onCancel();
    }
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirmAction = () => {
    if (confirmState.onConfirm) {
      confirmState.onConfirm();
    }
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  return {
    alertState,
    confirmState,
    showAlert,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    closeAlert,
    showConfirm,
    closeConfirm,
    handleConfirmAction
  };
}
