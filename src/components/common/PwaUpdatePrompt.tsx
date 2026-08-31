import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { browserNetworkState, reloadCurrentDocument } from '@/lib/pwaUpdate';
import { usePwaRegistration } from '@/lib/pwaRegistration';

/**
 * Notification unique pilotée par le cycle d'attente Workbox. La version ne
 * s'active qu'après un clic : aucun événement focus/visibility/online ne peut
 * provoquer un rechargement ou interrompre une saisie métier.
 */
export function PwaUpdatePrompt() {
  const updateRequestedHereRef = useRef(false);
  const [activatedElsewhere, setActivatedElsewhere] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = usePwaRegistration({
    onNeedReload: () => {
      // vite-plugin-pwa déclenche `controlling` dans chaque onglet. Sans ce
      // garde, l'activation demandée ailleurs recharge silencieusement celui-ci
      // et détruit potentiellement un formulaire non enregistré.
      if (updateRequestedHereRef.current) {
        reloadCurrentDocument();
        return;
      }
      setActivatedElsewhere(true);
    },
  });
  const [isOnline, setIsOnline] = useState(() => browserNetworkState() === 'online');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!needRefresh && !activatedElsewhere) return null;

  const applyUpdate = async () => {
    if (!isOnline || applying) return;

    if (activatedElsewhere) {
      // La nouvelle version contrôle déjà ce document : le rechargement reste
      // néanmoins un choix explicite de l'utilisateur dans cet onglet.
      reloadCurrentDocument();
      return;
    }

    setApplying(true);
    setError(null);
    updateRequestedHereRef.current = true;
    try {
      // `onNeedReload` effectuera l'unique reload lorsque le worker devient
      // contrôleur. Le paramètre historique de cette API est ignoré depuis la
      // version 0.13.2 de vite-plugin-pwa.
      await updateServiceWorker();
    } catch {
      updateRequestedHereRef.current = false;
      setApplying(false);
      setError('La mise à jour n’a pas pu être préparée. Vous pouvez réessayer.');
    }
  };

  return (
    <aside
      className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-lg rounded-xl border border-emerald-200 bg-white p-4 shadow-xl"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className={`mt-0.5 h-5 w-5 text-emerald-700 ${applying ? 'animate-spin' : ''}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {activatedElsewhere ? 'La nouvelle version SONASP est prête' : 'Une mise à jour SONASP est disponible'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {activatedElsewhere
              ? 'Cet écran reste intact. Enregistrez votre travail, puis rechargez-le au moment qui vous convient.'
              : 'Enregistrez votre travail, puis choisissez le moment de charger la nouvelle version.'}
          </p>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <button
            type="button"
            onClick={() => void applyUpdate()}
            disabled={!isOnline || applying}
            aria-busy={applying}
            className="mt-3 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {applying
              ? 'Installation…'
              : !isOnline
                ? 'Connexion requise'
                : activatedElsewhere
                  ? 'Recharger maintenant'
                  : 'Mettre à jour maintenant'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setNeedRefresh(false);
            setActivatedElsewhere(false);
          }}
          disabled={applying}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-60"
          aria-label="Reporter cette mise à jour"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
