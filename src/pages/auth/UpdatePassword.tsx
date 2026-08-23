import { CheckCircle2, LockKeyhole } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
import { supabase } from '@/lib/supabase';
import { mfaService } from '@/services/mfaService';

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const afficherEnrolement = sessionState === 'ready' && status === 'success';

  useEffect(() => {
    let active = true;

    const { data: ecoute } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setSessionState('ready');
    });

    const verifierLien = async () => {
      const jetonHache = searchParams.get('token_hash');
      const type = searchParams.get('type');

      if (jetonHache && type === 'recovery') {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: jetonHache,
          type: 'recovery',
        });
        if (!active) return;
        setSessionState(!error && data.session ? 'ready' : 'invalid');
        if (!error && data.session) navigate('/modifier-mot-de-passe', { replace: true });
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (active) setSessionState(!error && data.session ? 'ready' : 'invalid');
    };

    void verifierLien().catch(() => {
      if (active) setSessionState('invalid');
    });

    return () => {
      active = false;
      ecoute.subscription.unsubscribe();
    };
  }, [navigate, searchParams]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 12 || password !== confirmation) {
      setStatus('error');
      setMessage('Utilisez au moins 12 caractères et confirmez le même mot de passe.');
      return;
    }
    setStatus('saving');
    try {
      // Cette opération change le secret Auth et lève, dans le même parcours,
      // le marqueur de première connexion lu par la barrière MFA.
      await mfaService.changerMotDePasse(password);
    } catch {
      setStatus('error');
      setMessage('Le lien est invalide ou expiré. Recommencez la procédure de récupération.');
      return;
    }
    setStatus('success');
    setMessage('Votre mot de passe a été mis à jour.');
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f5ec] p-5">
      <section
        className={`w-full border border-slate-200 border-t-4 border-t-amber-500 bg-white shadow-xl shadow-emerald-950/10 ${afficherEnrolement ? 'max-w-xl p-4 sm:p-5' : 'max-w-md p-7 sm:p-9'}`}
        aria-label={afficherEnrolement ? 'Activation du second facteur' : undefined}
        aria-labelledby={afficherEnrolement ? undefined : 'update-password-title'}
      >
        {afficherEnrolement ? (
          <div>
            <p className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
              Mot de passe enregistré. Finalisez avec le second facteur.
            </p>
            <TwoFactorSetup
              obligatoire
              onComplete={() => navigate('/dashboard', { replace: true })}
            />
          </div>
        ) : (
          <>
            <img src="/SONASP v2.png" alt="SONASP" className="h-auto w-32" />
            <div className="mt-7 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><LockKeyhole aria-hidden="true" className="h-5 w-5" /></div>
            <h1 id="update-password-title" className="mt-5 text-2xl font-semibold text-slate-900">Définir un nouveau mot de passe</h1>
            {sessionState === 'checking' && <p className="mt-7 text-sm text-slate-600" role="status">Vérification du lien sécurisé…</p>}
            {sessionState === 'invalid' && (
              <div className="mt-7" role="alert">
                <p className="text-sm leading-6 text-red-700">Ce lien est invalide, expiré ou a déjà été utilisé.</p>
                <Link to="/recuperer-acces" className="mt-5 inline-flex min-h-11 items-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white">Recevoir un nouveau lien</Link>
              </div>
            )}
            {sessionState === 'ready' && (
              <form onSubmit={submit} className="mt-7 grid gap-5" noValidate>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Nouveau mot de passe
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} className="min-h-12 rounded-md border border-slate-300 px-3 font-normal" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Confirmer le mot de passe
                  <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} className="min-h-12 rounded-md border border-slate-300 px-3 font-normal" />
                </label>
                <button type="submit" disabled={status === 'saving'} className="min-h-12 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                  {status === 'saving' ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
                </button>
                <p aria-live="polite" className="min-h-6 text-sm text-red-700">{status === 'error' ? message : ''}</p>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
