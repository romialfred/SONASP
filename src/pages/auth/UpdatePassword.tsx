import { CheckCircle2, LockKeyhole } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { mfaService } from '@/services/mfaService';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

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
      <section className="w-full max-w-md border border-slate-200 border-t-4 border-t-amber-500 bg-white p-7 shadow-xl shadow-emerald-950/10 sm:p-9" aria-labelledby="update-password-title">
        <img src="/SONASP v2.png" alt="SONASP" className="h-auto w-32" />
        <div className="mt-7 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><LockKeyhole aria-hidden="true" className="h-5 w-5" /></div>
        <h1 id="update-password-title" className="mt-5 text-2xl font-semibold text-slate-900">Définir un nouveau mot de passe</h1>
        {status === 'success' ? <div className="mt-7"><p className="flex items-center gap-2 text-emerald-800"><CheckCircle2 aria-hidden="true" className="h-5 w-5" />{message}</p><Link to="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white">Configurer le second facteur</Link></div> : <form onSubmit={submit} className="mt-7 grid gap-5" noValidate><label className="grid gap-2 text-sm font-semibold text-slate-700">Nouveau mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} className="min-h-12 rounded-md border border-slate-300 px-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold text-slate-700">Confirmer le mot de passe<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} className="min-h-12 rounded-md border border-slate-300 px-3 font-normal" /></label><button type="submit" disabled={status === 'saving'} className="min-h-12 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{status === 'saving' ? 'Enregistrement…' : 'Enregistrer le mot de passe'}</button><p aria-live="polite" className="min-h-6 text-sm text-red-700">{status === 'error' ? message : ''}</p></form>}
      </section>
    </main>
  );
}
