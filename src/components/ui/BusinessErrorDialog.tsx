import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from './Button';

interface BusinessErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  technicalDetails?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function BusinessErrorDialog({
  isOpen,
  onClose,
  title = 'Un problème est survenu',
  message,
  technicalDetails,
  actionLabel = 'Fermer',
  onAction
}: BusinessErrorDialogProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!isOpen) return null;

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full animate-fade-in">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {message}
              </p>

              {technicalDetails && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showTechnicalDetails ? (
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

                  {showTechnicalDetails && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                        {technicalDetails}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          {onAction && (
            <Button
              variant="secondary"
              onClick={onClose}
              size="sm"
            >
              Annuler
            </Button>
          )}
          <Button
            onClick={handleAction}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
