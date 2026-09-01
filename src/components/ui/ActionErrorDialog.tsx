import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Copy, Check, X } from 'lucide-react';
import { Button } from './Button';
import './action-error-dialog.css';

export interface ActionErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  recovery?: string;
  diagnosticCode?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ActionErrorDialog({ isOpen, onClose, title = 'Unable to complete this action', message,
  recovery, diagnosticCode, actionLabel = 'Try again', onAction }: ActionErrorDialogProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setCopied(false);
    setCopyFailed(false);
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button, a[href], summary, [tabindex="0"]') ?? [])]
        .filter(element => {
          const details = element.closest('details');
          return !(element as HTMLButtonElement).disabled && !element.closest('[hidden]')
            && (element.tagName === 'SUMMARY' || !details || details.open);
        });
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return createPortal(
    <div className="sn-error-overlay">
      <div className="sn-error-dialog" ref={panel} tabIndex={-1} role="alertdialog" aria-modal="true"
        aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}>
        <header className="sn-error-dialog__head">
          <span className="sn-error-dialog__icon"><AlertTriangle aria-hidden="true" /></span>
          <div><span className="sn-error-dialog__eyebrow">Action requires attention</span><h2 id={`${id}-title`}>{title}</h2></div>
          <button type="button" className="sn-error-dialog__close" onClick={onClose} aria-label="Close error dialog"><X aria-hidden="true" /></button>
        </header>
        <div className="sn-error-dialog__body">
          <p id={`${id}-message`}>{message}</p>
          {recovery && <div className="sn-error-dialog__recovery"><h3>What you can do</h3><p>{recovery}</p></div>}
          {diagnosticCode && <details className="sn-error-dialog__details"><summary>Diagnostic information</summary>
            <div><code>{diagnosticCode}</code><button type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(diagnosticCode); setCopied(true); setCopyFailed(false); }
              catch { setCopyFailed(true); }
            }}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? 'Copied' : 'Copy code'}</button></div>
            {copyFailed && <p role="status">Copy is unavailable. Select and copy the code above.</p>}
          </details>}
        </div>
        <footer className="sn-error-dialog__actions"><Button type="button" variant="outline" onClick={onClose}>Close</Button>
          {onAction && <Button type="button" onClick={onAction}>{actionLabel}</Button>}
        </footer>
      </div>
    </div>, document.body);
}
