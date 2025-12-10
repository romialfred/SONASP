import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from './Button';

interface UserFriendlyErrorProps {
  title?: string;
  message: string;
  technicalDetails?: string;
  onClose?: () => void;
  variant?: 'error' | 'warning' | 'info';
}

export function UserFriendlyError({
  title,
  message,
  technicalDetails,
  onClose,
  variant = 'error'
}: UserFriendlyErrorProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const variantStyles = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      textColor: 'text-red-800',
      buttonBg: 'bg-red-100 hover:bg-red-200',
      buttonText: 'text-red-800'
    },
    warning: {
      bg: 'bg-orange-50',
      border: 'border-orange-300',
      iconColor: 'text-orange-600',
      titleColor: 'text-orange-900',
      textColor: 'text-orange-800',
      buttonBg: 'bg-orange-100 hover:bg-orange-200',
      buttonText: 'text-orange-800'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      textColor: 'text-blue-800',
      buttonBg: 'bg-blue-100 hover:bg-blue-200',
      buttonText: 'text-blue-800'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={`rounded-lg border-2 ${styles.border} ${styles.bg} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <AlertCircle className={`w-5 h-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`text-sm font-semibold ${styles.titleColor} mb-1`}>
              {title}
            </h3>
          )}
          <p className={`text-sm ${styles.textColor}`}>
            {message}
          </p>

          {technicalDetails && (
            <div className="mt-3">
              <button
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                className={`flex items-center gap-2 text-xs font-medium ${styles.buttonText} ${styles.buttonBg} px-3 py-1.5 rounded-md transition-colors`}
              >
                {isDetailsExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Masquer les détails techniques
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Afficher les détails techniques
                  </>
                )}
              </button>

              {isDetailsExpanded && (
                <div className="mt-2 p-3 bg-white/70 rounded-md border border-gray-200">
                  <p className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
                    {technicalDetails}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className={`flex-shrink-0 ${styles.iconColor} hover:opacity-70 transition-opacity`}
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Modal version
interface UserFriendlyErrorModalProps extends UserFriendlyErrorProps {
  isOpen: boolean;
}

export function UserFriendlyErrorModal({
  isOpen,
  title = 'Une erreur est survenue',
  message,
  technicalDetails,
  onClose,
  variant = 'error'
}: UserFriendlyErrorModalProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  if (!isOpen) return null;

  const variantStyles = {
    error: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      textColor: 'text-gray-700'
    },
    warning: {
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      titleColor: 'text-orange-900',
      textColor: 'text-gray-700'
    },
    info: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      textColor: 'text-gray-700'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-gray-200">
          <div className={`flex-shrink-0 w-12 h-12 ${styles.iconBg} rounded-full flex items-center justify-center`}>
            <AlertCircle className={`w-6 h-6 ${styles.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-xl font-bold ${styles.titleColor}`}>
              {title}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className={`text-base ${styles.textColor} leading-relaxed`}>
            {message}
          </p>

          {technicalDetails && (
            <div className="mt-4">
              <button
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                {isDetailsExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Masquer les détails techniques
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Afficher les détails techniques
                  </>
                )}
              </button>

              {isDetailsExpanded && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                    {technicalDetails}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={onClose}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
