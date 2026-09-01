import { BusinessErrorDialog } from './BusinessErrorDialog';

interface ErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export function ErrorDialog(props: ErrorDialogProps) {
  return <BusinessErrorDialog {...props} />;
}
