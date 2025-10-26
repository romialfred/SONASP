import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { X, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * Non-blocking banner that shows profile loading errors
 * Appears at the top of the screen when profile fails to load
 * Allows user to retry without blocking the app
 */
export function ProfileErrorBanner() {
  const { profileError, refreshProfile, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Reset dismissed state when error changes
  useEffect(() => {
    if (profileError) {
      setDismissed(false);
    }
  }, [profileError]);

  // Don't show if no error, dismissed, or if we have full profile data
  if (!profileError || dismissed) {
    return null;
  }

  // Check if we're using fallback profile (missing certain fields that should exist in full profile)
  const isUsingFallback = user && (!user.created_at || user.email === 'user@example.com');

  if (!isUsingFallback) {
    // We have a full profile, don't show banner
    return null;
  }

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 border-b border-yellow-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1 min-w-0">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-yellow-800">
                Profile loading issue
              </p>
              <p className="text-sm text-yellow-700 mt-0.5">
                {profileError} The app is using basic account settings.
              </p>
            </div>
          </div>
          <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {retrying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Retry
                </>
              )}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="inline-flex items-center p-1.5 rounded-md text-yellow-600 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
