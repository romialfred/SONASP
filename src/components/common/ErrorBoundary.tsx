import { Component, ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { browserNetworkState, requestPwaUpdateCheck } from '@/lib/pwaUpdate';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (reset: () => void, error?: Error) => ReactNode;
  onReset?: () => void;
  /** Change de valeur a chaque navigation ; efface l'erreur sans remonter les enfants. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class BaseErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled error captured:', error, errorInfo);
  }

  /**
   * Efface l'erreur quand la cle de reinitialisation change.
   *
   * L'appelant posait cette cle sur `key`, ce qui **remontait tout le sous-arbre**
   * a chaque navigation : mise en page, barre laterale et filtres repartaient de
   * zero. La cle est desormais une simple propriete : seul l'etat d'erreur est
   * remis a plat, les enfants restent montes.
   */
  componentDidUpdate(precedentes: ErrorBoundaryProps) {
    if (this.state.hasError && precedentes.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  private reset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.reset, this.state.error);
      }

      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Une erreur est survenue</h1>
          <p className="text-gray-600 max-w-md">
            Une erreur inattendue s’est produite pendant l’affichage de cette partie de l’application. Vous pouvez
            recharger cette section pour réessayer.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Recharger cette section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const DYNAMIC_IMPORT_ERROR =
  /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i;

function RouteErrorFallback({ reset, error }: { reset: () => void; error?: Error }) {
  const [isOnline, setIsOnline] = useState(() => browserNetworkState() === 'online');
  const [reloading, setReloading] = useState(false);
  const requiresReload = DYNAMIC_IMPORT_ERROR.test(`${error?.name ?? ''} ${error?.message ?? ''}`);

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

  useEffect(() => {
    if (requiresReload && isOnline) void requestPwaUpdateCheck();
  }, [isOnline, requiresReload]);

  const handleRetry = () => {
    if (!isOnline && requiresReload) return;
    if (requiresReload) {
      setReloading(true);
      // Uniquement après ce clic. Le shell et la session du même onglet restent
      // intacts ; aucune purge de sessionStorage ou du niveau MFA n'est faite.
      window.location.reload();
      return;
    }
    reset();
  };

  /**
   * L'absence de réseau n'explique l'erreur que si celle-ci vient d'un
   * chargement. Une erreur survenue pendant le rendu — un champ nul formaté,
   * par exemple — reste identique une fois la connexion rétablie : l'annoncer
   * comme une coupure Internet désigne une cause fausse et, le bouton étant
   * alors désactivé, laisse l'utilisateur attendre un réseau sans rapport.
   */
  const offlineExplique = !isOnline && requiresReload;
  const title = offlineExplique
    ? 'Connexion Internet interrompue'
    : requiresReload
      ? 'Écran temporairement indisponible'
      : 'Une erreur est survenue';
  const description = offlineExplique
    ? 'Le tableau de bord ne peut pas terminer son chargement hors ligne. Rétablissez la connexion Internet, puis réessayez.'
    : requiresReload
      ? 'Un fichier de cet écran n’a pas pu être chargé. Une vérification de version a été demandée sans interrompre votre session. Vous pouvez recharger cet écran manuellement.'
      : 'Cette page n’a pas pu être chargée. Vous pouvez réessayer ou ouvrir une autre rubrique.';
  const actionLabel = reloading
    ? 'Rechargement…'
    : offlineExplique
      ? 'En attente du réseau'
      : requiresReload
        ? 'Recharger cet écran'
        : 'Réessayer';

  return (
    <div className="min-h-[50vh] flex items-center justify-center bg-gray-50" aria-live="polite">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
        <button
          type="button"
          onClick={handleRetry}
          disabled={offlineExplique || reloading}
          aria-busy={reloading}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <BaseErrorBoundary>{children}</BaseErrorBoundary>;
}

export function RouteErrorBoundary({
  children,
  onReset,
  resetKey,
}: {
  children: ReactNode;
  onReset?: () => void;
  /** Change de valeur a chaque navigation ; efface l'erreur sans remonter les enfants. */
  resetKey?: string;
}) {
  return (
    <BaseErrorBoundary
      onReset={onReset}
      resetKey={resetKey}
      fallback={(reset, error) => <RouteErrorFallback reset={reset} error={error} />}
    >
      {children}
    </BaseErrorBoundary>
  );
}
