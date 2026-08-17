import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { X, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';

/**
 * Non-blocking banner that shows profile loading errors
 * Appears at the top of the screen when profile fails to load
 * Allows user to retry without blocking the app
 */
export function ProfileErrorBanner() {
  const { profileError, refreshProfile, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  // Reset dismissed state when error changes
  useEffect(() => {
    if (profileError) {
      setDismissed(false);
    }
  }, [profileError]);

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setIsOnline(true);

      if (profileError && user) {
        void refreshProfile();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [profileError, refreshProfile, user]);

  // Don't show if no error or dismissed
  if (!profileError || dismissed || !user) {
    return null;
  }

  // Only show if the error explicitly indicates we're using fallback
  // Check if the profile error is about using defaults (not just any error)
  const isFallbackError = profileError.includes('account defaults') || profileError.includes('full profile');

  if (!isFallbackError) {
    // Not a fallback error, don't show banner
    return null;
  }

  const handleRetry = async () => {
    if (!isOnline) return;

    setRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 right-4 z-[70] sm:bottom-6 sm:left-auto sm:right-6 sm:w-full sm:max-w-md"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-auto rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 text-amber-600" aria-hidden="true">
            {isOnline ? <AlertCircle className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {isOnline ? 'Profil temporairement indisponible' : 'Connexion réseau indisponible'}
            </p>
            <p className="mt-1 text-sm leading-5 text-amber-800">
              {isOnline
                ? 'Le profil complet n’a pas pu être chargé. Les paramètres de base restent actifs.'
                : 'Les données en ligne sont inaccessibles. Rétablissez la connexion pour relancer automatiquement le chargement.'}
            </p>

            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying || !isOnline}
              className="mt-3 inline-flex items-center rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${retrying ? 'animate-spin motion-reduce:animate-none' : ''}`}
                aria-hidden="true"
              />
              {retrying ? 'Nouvelle tentative…' : isOnline ? 'Réessayer' : 'Hors ligne'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 rounded-md p-1 text-amber-700 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
            aria-label="Fermer la notification"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
