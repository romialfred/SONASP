import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
}

export function SessionTimeoutWarning({
  isOpen,
  remainingSeconds,
  onExtend,
  onLogout,
}: SessionTimeoutWarningProps) {
  const [countdown, setCountdown] = useState(remainingSeconds);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(remainingSeconds);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, remainingSeconds, onLogout]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <Modal isOpen={isOpen} onClose={onExtend} title="">
      <div className="text-center p-6">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-yellow-600" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Session Expiring Soon
        </h2>

        <p className="text-gray-600 mb-6">
          Your session will expire due to inactivity. You will be logged out in:
        </p>

        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-4xl font-bold text-gray-900">
            <Clock className="h-8 w-8" />
            <span>
              {minutes.toString().padStart(2, '0')}:
              {seconds.toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onLogout}
            className="flex-1"
          >
            Logout Now
          </Button>
          <Button
            variant="primary"
            onClick={onExtend}
            className="flex-1"
          >
            Stay Logged In
          </Button>
        </div>
      </div>
    </Modal>
  );
}
