import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function RecoverPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus('error');
      return;
    }
    setStatus('sending');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/modifier-mot-de-passe`,
    });
    setStatus(error ? 'error' : 'sent');
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f5ec] p-5">
      <section className="w-full max-w-md border border-slate-200 border-t-4 border-t-amber-500 bg-white p-7 shadow-xl shadow-emerald-950/10 sm:p-9" aria-labelledby="recover-title">
        <img src="/SONASP v2.png" alt="SONASP" className="h-auto w-32" />
        <div className="mt-7 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Mail aria-hidden="true" className="h-5 w-5" /></div>
        <h1 id="recover-title" className="mt-5 text-2xl font-semibold text-slate-900">Récupérer mon accès</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Saisissez l’adresse électronique associée à votre compte. Si elle est reconnue, un lien sécurisé sera envoyé.</p>
        <form onSubmit={submit} className="mt-7 grid gap-5" noValidate>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Adresse électronique<input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setStatus('idle'); }} autoComplete="email" className="min-h-12 rounded-md border border-slate-300 px-3 font-normal" required /></label>
          <button type="submit" disabled={status === 'sending' || status === 'sent'} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"><ShieldCheck aria-hidden="true" className="h-4 w-4" />{status === 'sending' ? 'Envoi…' : 'Envoyer le lien sécurisé'}</button>
          <div aria-live="polite" className="min-h-10 text-sm leading-5">{status === 'sent' && <p className="text-emerald-800">Si cette adresse correspond à un compte, les instructions de récupération ont été envoyées.</p>}{status === 'error' && <p className="text-red-700">La demande n’a pas pu être transmise. Vérifiez l’adresse et réessayez.</p>}</div>
        </form>
        <Link to="/login" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Retour à la connexion</Link>
      </section>
    </main>
  );
}
