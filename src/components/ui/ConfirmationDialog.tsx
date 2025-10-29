/**
 * Confirmation Dialog Component
 *
 * Professional confirmation dialog for critical actions with:
 * - Clear action description
 * - Impact summary
 * - Optional comment requirement
 * - Visual severity indicators
 * - Keyboard accessibility
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { TextArea } from './TextArea';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment?: string) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'info' | 'warning' | 'danger';
  requireComment?: boolean;
  commentPlaceholder?: string;
  impacts?: string[];
  details?: Record<string, string | number>;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'info',
  requireComment = false,
  commentPlaceholder = 'Enter a comment (optional)...',
  impacts = [],
  details = {},
  isLoading = false
}: ConfirmationDialogProps) {
  const [comment, setComment] = useState('');
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setComment('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (requireComment && !comment.trim()) {
      return;
    }
    onConfirm(comment.trim() || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleConfirm();
    }
  };

  if (!isOpen) return null;

  const severityColors = {
    info: {
      border: 'border-blue-500',
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      button: 'primary'
    },
    warning: {
      border: 'border-yellow-500',
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
      button: 'primary'
    },
    danger: {
      border: 'border-red-500',
      bg: 'bg-red-50',
      icon: 'text-red-600',
      button: 'danger'
    }
  };

  const colors = severityColors[severity];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 border-t-4 ${colors.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 ${colors.bg}`}>
          <div className="flex items-start">
            <div className={`flex-shrink-0 ${colors.icon}`}>
              {severity === 'danger' && (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {severity === 'warning' && (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {severity === 'info' && (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-700 mb-4">{message}</p>

          {/* Details */}
          {Object.keys(details).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Details:</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {Object.entries(details).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <dt className="text-sm text-gray-600">{key}:</dt>
                    <dd className="text-sm font-medium text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Impacts */}
          {impacts.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-blue-900 mb-2">This action will:</h4>
              <ul className="list-disc list-inside space-y-1">
                {impacts.map((impact, index) => (
                  <li key={index} className="text-sm text-blue-800">{impact}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Comment Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comment {requireComment && <span className="text-red-500">*</span>}
            </label>
            <TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={commentPlaceholder}
              rows={3}
              disabled={isLoading}
              className="w-full"
            />
            {requireComment && !comment.trim() && (
              <p className="mt-1 text-sm text-red-600">
                A comment is required for this action
              </p>
            )}
          </div>

          {/* Keyboard Shortcuts Help */}
          <div className="text-xs text-gray-500 mb-4">
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">Esc</span> to cancel
            {!requireComment || comment.trim() ? (
              <>
                {' '} or <span className="font-mono bg-gray-100 px-2 py-1 rounded">Ctrl+Enter</span> to confirm
              </>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
          <Button
            ref={cancelButtonRef}
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={colors.button as 'primary' | 'danger'}
            onClick={handleConfirm}
            disabled={isLoading || (requireComment && !comment.trim())}
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage confirmation dialog state
 */
export function useConfirmationDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Partial<ConfirmationDialogProps>>({});
  const [resolvePromise, setResolvePromise] = useState<((result: boolean | string) => void) | null>(null);

  const open = (dialogConfig: Partial<ConfirmationDialogProps>): Promise<boolean | string> => {
    setConfig(dialogConfig);
    setIsOpen(true);

    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
    });
  };

  const handleConfirm = (comment?: string) => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(comment || true);
      setResolvePromise(null);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  };

  return {
    isOpen,
    config,
    open,
    handleConfirm,
    handleClose,
    ConfirmationDialog: () => (
      <ConfirmationDialog
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={config.title || 'Confirm Action'}
        message={config.message || 'Are you sure?'}
        {...config}
      />
    )
  };
}
