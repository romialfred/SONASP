import { createContext, useContext, useState, ReactNode } from 'react';
import { NotificationDialog } from '@/components/ui/NotificationDialog';

interface NotificationOptions {
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  showCancel?: boolean;
}

interface NotificationContextType {
  showNotification: (
    type: 'success' | 'error' | 'warning' | 'info',
    titleOrMessage: string,
    message?: string | ReactNode,
    options?: NotificationOptions,
  ) => void;
  showSuccess: (title: string, message: string | ReactNode, options?: NotificationOptions) => void;
  showError: (title: string, message: string | ReactNode, options?: NotificationOptions) => void;
  showWarning: (title: string, message: string | ReactNode, options?: NotificationOptions) => void;
  showInfo: (title: string, message: string | ReactNode, options?: NotificationOptions) => void;
  closeNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string | ReactNode;
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
    titleOrMessage: string,
    message?: string | ReactNode,
    options?: NotificationOptions
  ) => {
    const defaultTitles = {
      success: 'Succès',
      error: 'Erreur',
      warning: 'Attention',
      info: 'Information',
    } as const;
    setNotification({
      isOpen: true,
      type,
      title: message === undefined ? defaultTitles[type] : titleOrMessage,
      message: message === undefined ? titleOrMessage : message,
      ...options,
    });
  };

  const closeNotification = () => {
    setNotification((prev) => ({ ...prev, isOpen: false }));
  };

  const showSuccess = (title: string, message: string | ReactNode, options?: NotificationOptions) =>
    showNotification('success', title, message, options);

  const showError = (title: string, message: string | ReactNode, options?: NotificationOptions) =>
    showNotification('error', title, message, options);

  const showWarning = (title: string, message: string | ReactNode, options?: NotificationOptions) =>
    showNotification('warning', title, message, options);

  const showInfo = (title: string, message: string | ReactNode, options?: NotificationOptions) =>
    showNotification('info', title, message, options);

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        closeNotification,
      }}
    >
      {children}
      <NotificationDialog
        isOpen={notification.isOpen}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        confirmText={notification.confirmText}
        onConfirm={notification.onConfirm}
        cancelText={notification.cancelText}
        showCancel={notification.showCancel}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
