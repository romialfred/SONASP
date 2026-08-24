import { useEffect, useRef } from 'react';
import { CalendarDays, History, Scale, X } from 'lucide-react';
import type { HistoriqueStock } from './inventoryOverviewData';

const onces = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLongue = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

interface StockHistoryDialogProps {
  titre: string;
  totalOz: number;
  lignes: HistoriqueStock[];
  onClose: () => void;
}

function formaterDate(value: string | null) {
  if (!value) return 'Date non renseignée';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date non renseignée' : dateLongue.format(date);
}

export function StockHistoryDialog({ titre, totalOz, lignes, onClose }: StockHistoryDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="stocks-dialog__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="stocks-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stocks-dialog-title"
        aria-describedby="stocks-dialog-description"
      >
        <header className="stocks-dialog__header">
          <span className="stocks-dialog__icon" aria-hidden="true"><History /></span>
          <div>
            <p>Historique du poste</p>
            <h2 id="stocks-dialog-title">{titre}</h2>
          </div>
          <button ref={closeRef} type="button" className="stocks-dialog__close" onClick={onClose} aria-label="Fermer l’historique">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="stocks-dialog__summary" id="stocks-dialog-description">
          <div>
            <Scale aria-hidden="true" />
            <span>Position actuelle</span>
            <strong>{onces.format(totalOz)} oz</strong>
          </div>
          <div>
            <History aria-hidden="true" />
            <span>Lignes associées</span>
            <strong>{lignes.length}</strong>
          </div>
        </div>

        <div className="stocks-dialog__body">
          {lignes.length === 0 ? (
            <div className="stocks-dialog__empty">
              <History aria-hidden="true" />
              <h3>Aucun mouvement disponible</h3>
              <p>Le poste est vide ou aucune ligne source ne lui est encore rattachée.</p>
            </div>
          ) : (
            <ol className="stocks-dialog__timeline">
              {lignes.map((ligne) => (
                <li key={`${ligne.poste}-${ligne.id}`}>
                  <span className="stocks-dialog__dot" aria-hidden="true" />
                  <div className="stocks-dialog__date">
                    <CalendarDays aria-hidden="true" />
                    <time dateTime={ligne.date || undefined}>{formaterDate(ligne.date)}</time>
                  </div>
                  <div className="stocks-dialog__event">
                    <strong>{ligne.reference}</strong>
                    <span>{ligne.libelle} · {ligne.detail}</span>
                  </div>
                  <b>{onces.format(ligne.quantiteOz)} oz</b>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
