import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, KeyRound, Loader2, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { mfaService, type EtatMfa } from '@/services/mfaService';
import { TwoFactorSetup } from './TwoFactorSetup';

const EXEMPT_PATHS = new Set([
  '/activate-account',
  '/auth/callback',
  '/recuperer-acces',
  '/modifier-mot-de-passe',
]);

type GateState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; etat: EtatMfa };

export function MandatoryMfaGate({ children }: { children: ReactNode }) {
  const { session, initialized, signOut, refreshProfile } = useAuth();
  const location = useLocation();
  const [gate, setGate] = useState<GateState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const exempt = EXEMPT_PATHS.has(location.pathname);

  useEffect(() => {
    if (!initialized || !session || exempt) return;
    let active = true;
    setGate({ status: 'loading' });
    setActionError(null);

    void mfaService.etat()
      .then((etat) => {
        if (!active) return;
        if (!etat) {
          setGate({ status: 'error', message: 'L’état de sécurité de votre compte est indisponible.' });
          return;
        }
        setGate({ status: 'ready', etat });
      })
      .catch(() => {
        if (active) setGate({ status: 'error', message: 'La vérification du second facteur a échoué.' });
      });

    return () => { active = false; };
  }, [exempt, initialized, refreshKey, session?.access_token]);

  if (!initialized || !session || exempt) return <>{children}</>;
  if (gate.status === 'ready' && gate.etat.etape_suivante === 'pret') return <>{children}</>;

  const recheck = async () => {
    await refreshProfile();
    setRefreshKey((current) => current + 1);
  };

  const afficheEnrolement = gate.status === 'ready' && gate.etat.etape_suivante === 'enrolement';

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      setActionError('Saisissez le code à six chiffres affiché dans votre application.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const factor = await mfaService.facteurVerifie();
      if (!factor) throw new Error('Aucun second facteur vérifié n’est rattaché à ce compte.');
      await mfaService.verifierCode(factor.id, code);
      await recheck();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Le code n’a pas pu être vérifié.');
    } finally {
      setSubmitting(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== passwordConfirmation) {
      setActionError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await mfaService.changerMotDePasse(password);
      setPassword('');
      setPasswordConfirmation('');
      await recheck();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Le mot de passe n’a pas pu être modifié.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f6] px-4 py-10">
      <section
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-xl"
        aria-label={afficheEnrolement ? 'Activation du second facteur' : undefined}
        aria-labelledby={afficheEnrolement ? undefined : 'mfa-gate-title'}
      >
        <div className="h-1 bg-gradient-to-r from-emerald-700 via-amber-400 to-red-600" />
        <div className={afficheEnrolement ? 'p-4 sm:p-5' : 'p-7 sm:p-10'}>
          {!afficheEnrolement && <div className="mb-6 flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Protection du compte</p>
              <h1 id="mfa-gate-title" className="mt-2 text-2xl font-bold text-slate-950">Double authentification obligatoire</h1>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <ShieldCheck aria-hidden="true" />
            </span>
          </div>}

          {gate.status === 'loading' && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-5 text-slate-600" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-700" aria-hidden="true" /> Vérification de votre session…
            </div>
          )}

          {gate.status === 'error' && (
            <div>
              <p className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> {gate.message}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => setRefreshKey((current) => current + 1)}>Réessayer</button>
                <button type="button" className="sn-btn" onClick={() => void signOut()}><LogOut aria-hidden="true" /> Fermer la session</button>
              </div>
            </div>
          )}

          {gate.status === 'ready' && gate.etat.etape_suivante === 'enrolement' && (
            <TwoFactorSetup obligatoire onComplete={() => void recheck()} />
          )}

          {gate.status === 'ready' && gate.etat.etape_suivante === 'verification' && (
            <form onSubmit={verifyCode}>
              <p className="leading-7 text-slate-600">Ouvrez votre application d’authentification et saisissez le code temporaire associé à SONASP.</p>
              <label htmlFor="mfa-code" className="mt-6 block text-sm font-semibold text-slate-900">Code de sécurité</label>
              <div className="relative mt-2">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="mfa-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="h-14 w-full rounded-xl border border-slate-300 pl-12 pr-4 text-lg tracking-[0.3em] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                  autoFocus
                  required
                />
              </div>
              {actionError && <p className="mt-3 text-sm font-medium text-red-700" role="alert">{actionError}</p>}
              <div className="mt-7 flex flex-wrap gap-3">
                <button className="sn-btn sn-btn--primary" type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="sn-spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />} Vérifier et continuer
                </button>
                <button className="sn-btn" type="button" onClick={() => void signOut()}>Fermer la session</button>
              </div>
            </form>
          )}

          {gate.status === 'ready' && gate.etat.etape_suivante === 'mot_de_passe' && (
            <form onSubmit={changePassword}>
              <p className="leading-7 text-slate-600">Votre mot de passe temporaire doit être remplacé avant l’enrôlement du second facteur.</p>
              <label htmlFor="mandatory-password" className="mt-5 block text-sm font-semibold text-slate-900">Nouveau mot de passe</label>
              <input id="mandatory-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-14 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" required minLength={12} />
              <label htmlFor="mandatory-password-confirmation" className="mt-4 block text-sm font-semibold text-slate-900">Confirmer le mot de passe</label>
              <input id="mandatory-password-confirmation" type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} className="mt-2 h-14 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" required minLength={12} />
              {actionError && <p className="mt-3 text-sm font-medium text-red-700" role="alert">{actionError}</p>}
              <button className="sn-btn sn-btn--primary mt-7" type="submit" disabled={submitting}>{submitting && <Loader2 className="sn-spin" aria-hidden="true" />} Enregistrer et continuer</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
