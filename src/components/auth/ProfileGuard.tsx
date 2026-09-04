import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loading } from '@/components/ui/Loading';

interface ProfileGuardProps {
  children: ReactNode;
}

export function ProfileGuard({ children }: ProfileGuardProps) {
  const { profileLoading, profileError, user, refreshProfile } = useAuth();

  if (profileLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
          <Loading size="lg" />
          <p className="text-gray-600">Chargement du profil…</p>
        </div>
      </div>
    );
  }

  if (profileError && !user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Profil requis</h2>
          <p className="text-gray-600">
            {profileError || 'Impossible de charger les informations de votre profil. Veuillez réessayer pour continuer.'}
          </p>
          <div className="flex justify-center">
            <button
              onClick={refreshProfile}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Réessayer le chargement du profil
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Profil requis</h2>
          <p className="text-gray-600">
            Impossible de charger les informations de votre profil. Veuillez réessayer pour continuer.
          </p>
          <div className="flex justify-center">
            <button
              onClick={refreshProfile}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Réessayer le chargement du profil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {profileError && (
        <div
          className="pointer-events-auto fixed right-6 top-24 z-[60] max-w-sm rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800 shadow-lg"
          role="alert"
        >
          <p className="font-semibold">Informations de profil partielles</p>
          <p className="text-sm">{profileError}</p>
        </div>
      )}
      {children}
    </>
  );
}
