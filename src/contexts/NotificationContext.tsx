import React, { createContext, useContext, useState, ReactNode } from 'react';
import { NotificationDialog } from '@/components/ui/NotificationDialog';

interface NotificationOptions {
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  showCancel?: boolean;
}

interface NotificationContextType {
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
    title: string,
    message: string | ReactNode,
    options?: NotificationOptions
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
