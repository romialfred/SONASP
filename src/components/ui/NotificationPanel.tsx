import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export interface NotificationPanelProps {
  notifications: Notification[];
  onNotificationClick?: (id: string) => void;
  onMarkAllRead?: () => void;
}

export function NotificationPanel({
  notifications,
  onNotificationClick,
  onMarkAllRead
}: NotificationPanelProps) {
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-accent-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="w-96 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Notifications</h3>
        {notifications.some(n => !n.read) && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => onNotificationClick?.(notification.id)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100",
                !notification.read && "bg-primary-50/50"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {notification.title}
                  </p>
                  {!notification.read && (
                    <span className="flex-shrink-0 w-2 h-2 bg-primary-600 rounded-full mt-1.5" />
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{notification.message}</p>
                <p className="text-xs text-gray-400 mt-1">{notification.time}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
