import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Clock, LogOut, ShieldAlert } from 'lucide-react';

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
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    continueButtonRef.current?.focus();
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
        aria-describedby="session-warning-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl"
      >
        <div className="h-1 bg-gradient-to-r from-emerald-700 via-amber-400 to-red-600" />
        <div className="p-7 sm:p-8">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Sécurité de la session</p>
          <h2 id="session-warning-title" className="mt-2 text-2xl font-bold text-slate-950">
            Votre session arrive à expiration
          </h2>
          <p id="session-warning-description" className="mt-3 leading-7 text-slate-600">
            Après dix minutes sans activité, l’accès est fermé automatiquement. Confirmez que vous êtes toujours présent pour continuer.
          </p>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" aria-live="polite">
            <Clock className="h-5 w-5 text-amber-700" aria-hidden="true" />
            <span className="text-sm text-slate-600">Fermeture dans</span>
            <strong className="ml-auto tabular-nums text-lg text-slate-950">{formatTime(remainingSeconds)}</strong>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button onClick={onLogout} variant="secondary" size="lg">
              <LogOut className="mr-2 h-5 w-5" aria-hidden="true" /> Fermer la session
            </Button>
            <Button ref={continueButtonRef} onClick={onExtend} size="lg" className="bg-emerald-700 text-white hover:bg-emerald-800">
              Continuer ma session
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
