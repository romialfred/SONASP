import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 max-w-md">
            An unexpected error occurred while rendering this part of the application. You can try reloading the page to
            recover.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Reload section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
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
      fallback={(reset) => (
        <div className="min-h-[50vh] flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-500" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">We hit a snag</h2>
            <p className="text-sm text-gray-600">
              This view encountered an error while loading. Please try refreshing the page or navigating to another section.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </BaseErrorBoundary>
  );
}
