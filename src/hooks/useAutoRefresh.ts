import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface UseAutoRefreshOptions {
  /** Enable auto-refresh functionality */
  enabled?: boolean;
  /** Delay before refresh in milliseconds (default: 100ms) */
  delay?: number;
  /** Callback to execute on refresh */
  onRefresh?: () => void;
}

/**
 * Hook to automatically refresh data when returning to a page
 * Useful for pages that need to reflect changes made in other pages
 *
 * Example: ReceivingDashboard refreshes when user validates batch and returns
 */
export function useAutoRefresh(options: UseAutoRefreshOptions = {}) {
  const {
    enabled = true,
    delay = 100,
    onRefresh,
  } = options;

  const location = useLocation();
  const locationState = location.state as { autoRefresh?: boolean } | null;
  const hasRefreshedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Check if we should auto-refresh based on navigation state
    const shouldRefresh = locationState?.autoRefresh === true;

    if (shouldRefresh && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true;

      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        if (onRefresh) {
          onRefresh();
        }

        // Clear the autoRefresh flag from location state
        // This prevents refresh on subsequent renders
        if (window.history.state) {
          window.history.replaceState(
            { ...window.history.state, usr: { ...window.history.state.usr, autoRefresh: undefined } },
            ''
          );
        }
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [enabled, delay, onRefresh, locationState?.autoRefresh]);

  // Reset ref when location changes
  useEffect(() => {
    return () => {
      hasRefreshedRef.current = false;
    };
  }, [location.pathname]);
}

/**
 * Helper function to navigate with auto-refresh flag
 * Use this when navigating to a page that should auto-refresh
 *
 * @example
 * ```tsx
 * import { useNavigate } from 'react-router-dom';
 * import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';
 *
 * const navigate = useNavigate();
 *
 * // After updating batch status
 * navigateWithAutoRefresh(navigate, '/receiving');
 * ```
 */
export function navigateWithAutoRefresh(
  navigate: ReturnType<typeof import('react-router-dom').useNavigate>,
  path: string,
  additionalState?: Record<string, any>
) {
  navigate(path, {
    state: {
      autoRefresh: true,
      ...additionalState,
    },
  });
}
