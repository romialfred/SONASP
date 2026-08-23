import { AlertTriangle, ArrowLeft, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Route de compatibilite pour les anciens liens `/activate-account`.
 *
 * L'ancien parcours demandait et comparait un mot de passe provisoire dans le
 * navigateur, puis ecrivait directement des marqueurs d'activation et de MFA.
 * Ces operations sont desormais reservees a Supabase Auth et aux controles
 * serveur. Un lien moderne cree d'abord une session de recuperation signee et
 * conduit l'utilisateur vers `/modifier-mot-de-passe`.
 */
export default function ActivateAccount() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const orienter = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (!error && data.session) {
        navigate('/modifier-mot-de-passe', { replace: true });
        return;
      }

      setChecking(false);
    };

    void orienter();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f5ec] p-5">
      <section
        className="w-full max-w-md border border-slate-200 border-t-4 border-t-amber-500 bg-white p-7 shadow-xl shadow-emerald-950/10 sm:p-9"
        aria-labelledby="activation-title"
        aria-busy={checking}
      >
        <img src="/SONASP v2.png" alt="SONASP" className="h-auto w-32" />

        {checking ? (
          <div className="mt-8" role="status" aria-live="polite">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <KeyRound aria-hidden="true" className="h-5 w-5 animate-pulse" />
            </div>
            <h1 id="activation-title" className="mt-5 text-2xl font-semibold text-slate-900">
              Vérification du lien
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Nous vérifions la session sécurisée associée à votre invitation.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700">
              <AlertTriangle aria-hidden="true" className="h-5 w-5" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              Lien d’activation remplacé
            </p>
            <h1 id="activation-title" className="mt-2 text-2xl font-semibold text-slate-900">
              Demandez un nouveau lien sécurisé
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Cet ancien lien ne permet plus de transmettre un mot de passe provisoire. Utilisez la
              procédure de récupération pour recevoir un lien signé et limité dans le temps.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link
                to="/recuperer-acces"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                Recevoir un lien
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Retour à la connexion
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
