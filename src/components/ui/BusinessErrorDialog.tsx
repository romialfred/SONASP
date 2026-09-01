import { ActionErrorDialog } from './ActionErrorDialog';
import { presentError } from '@/lib/presentError';

interface BusinessErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  technicalDetails?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function BusinessErrorDialog({ isOpen, onClose, title, message, technicalDetails,
  actionLabel, onAction }: BusinessErrorDialogProps) {
  const error = presentError(message);
  const technical = Boolean(technicalDetails) || error.category !== 'operation'
    || /constraint|relation|column|sql|stack:|postgres|token|https?:\/\//i.test(message);
  return <ActionErrorDialog isOpen={isOpen} onClose={onClose}
    title={technical ? error.title : title}
    message={technical ? error.message : message}
    recovery={technical ? error.recovery : 'Review the highlighted information, then try again. Your entries remain in the form.'}
    diagnosticCode={error.code} actionLabel={actionLabel} onAction={onAction} />;
}
