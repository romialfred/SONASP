import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import {
  hasAdministrativePlatformAccess,
  hasGlobalPlatformAccess,
  hasPermission,
  isReadOnlyManager,
} from '@/lib/permissions';
import { PlatformLoading } from '@/components/common/PlatformLoading';
import { isComptoirRouteAllowed, isComptoirScopedUser } from '@/lib/comptoirAccess';
import { isCollectorRouteAllowed, isCollectorScopedUser } from '@/lib/collectorAccess';
import { isMineRouteAllowed, isMineScopedUser, isMineTenantProfile } from '@/lib/mineAccess';
import {
  hasAnyCapability,
  hasSensitiveCapability,
  type CapabilityCode,
} from '@/lib/capabilities';
import { evaluatePrivateRouteAccess } from '@/lib/routeAccessRegistry';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: string;
  requiredAnyCapabilities?: CapabilityCode[];
  /** Capability issue du contrat autoritatif (AAL2), sans repli par rôle. */
  requiredSensitiveCapability?: CapabilityCode;
  fallbackPath?: string;
}

const ADMINISTRATIVE_COMPATIBILITY_PATHS = [
  '/admin/transport-companies',
  '/admin/refineries',
  '/admin/gold-sales-settings',
  '/admin/modules',
  '/admin/messagerie',
] as const;

function isAdministrativeCompatibilityPath(pathname: string): boolean {
  return ADMINISTRATIVE_COMPATIBILITY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requiredPermission,
  requiredAnyCapabilities,
  requiredSensitiveCapability,
  fallbackPath = '/login',
}: ProtectedRouteProps) {
  const {
    user,
    session,
    loading,
    initialized,
    profileLoading,
    profileError,
    refreshProfile,
  } = useAuth();
  const location = useLocation();

  if (loading || !initialized || (session && profileLoading)) {
    return (
      <PlatformLoading
        title="Chargement de votre espace"
        message="Préparation de vos données et de vos habilitations…"
      />
    );
  }

  if (!session) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Profil indisponible</h2>
          <p className="text-gray-600">
            {profileError || 'Le profil autorisé n’a pas pu être chargé. Aucun accès privé n’est accordé.'}
          </p>
          <div className="flex justify-center">
            <button
              onClick={refreshProfile}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Compte désactivé</h2>
          <p className="text-gray-600 mb-6">
            Votre compte a été désactivé. Contactez l’administrateur de la plateforme.
          </p>
        </div>
      </div>
    );
  }

  // Le collecteur dispose du périmètre le plus étroit. Ce contrôle précède celui
  // du comptoir afin qu'un compte cumulant les deux capabilities ne puisse pas
  // hériter des fonctions de cession ou de création du comptoir.
  if (isCollectorScopedUser(user) && !isCollectorRouteAllowed(location.pathname)) {
    return <Navigate to="/portail-collecteur" replace />;
  }

  // Le comptoir partage certains écrans artisanaux avec la SONASP, mais pas son
  // périmètre. Cette allowlist bloque les routes nationales et internationales,
  // y compris lorsqu'elles sont saisies directement dans la barre d'adresse.
  if (isComptoirScopedUser(user) && !isComptoirRouteAllowed(location.pathname)) {
    return <Navigate to="/portail-comptoir" replace />;
  }

  // Le tenant ne confère jamais à lui seul les droits d'exploitation. Si le
  // serveur a fourni une liste de capacités sans `mine.operate`, aucune route
  // privée n'est ouverte, même si mining_company_id est encore renseigné.
  if (isMineTenantProfile(user) && !isMineScopedUser(user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Habilitation Société minière requise</h2>
          <p className="text-gray-600">Votre rattachement est connu, mais la capacité mine.operate n’est pas active.</p>
        </div>
      </div>
    );
  }

  const registryDecision = evaluatePrivateRouteAccess(user, location.pathname);
  if (
    !registryDecision.allowed
    && registryDecision.redirectTo
    && registryDecision.redirectTo !== location.pathname
  ) {
    return <Navigate to={registryDecision.redirectTo} replace />;
  }

  // Une mine utilise désormais les vrais modules industriels. L'allowlist
  // empêche toutefois qu'une route historique sans `allowedRoles` ouvre une
  // fonction SONASP par saisie directe de son URL.
  if (isMineScopedUser(user) && !isMineRouteAllowed(location.pathname)) {
    return <Navigate to="/portail-mine" replace />;
  }

  // Le Manager dispose d'un portail distinct et ne peut pas atteindre les
  // formulaires historiques via une URL saisie manuellement.
  if (
    isReadOnlyManager(user)
    && !location.pathname.startsWith('/portail-direction')
    && !['/profile', '/help'].includes(location.pathname)
  ) {
    return <Navigate to="/portail-direction" replace />;
  }

  if (!registryDecision.allowed && registryDecision.reason !== 'capability') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h2>
          <p className="text-gray-600 mb-6">
            Cette route n’est pas ouverte à votre type de compte.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const ownerHasGlobalAccess = hasGlobalPlatformAccess(user);
  const administratorHasModuleAccess = hasAdministrativePlatformAccess(user)
    && registryDecision.allowed;
  const roleAutorise = ownerHasGlobalAccess
    || administratorHasModuleAccess
    || !allowedRoles
    || allowedRoles.includes(user.role)
    || (isMineScopedUser(user) && allowedRoles.includes('mine'));
  const perimetreAdministrateurAutorise = Boolean(
    allowedRoles?.includes('management')
    && hasAdministrativePlatformAccess(user)
    && isAdministrativeCompatibilityPath(location.pathname),
  );
  if (
    allowedRoles
    && !perimetreAdministrateurAutorise
    && !roleAutorise
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h2>
          <p className="text-gray-600 mb-6">
            Votre profil n’est pas autorisé à accéder à cette page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const missingPermission = Boolean(
    !ownerHasGlobalAccess
    && !administratorHasModuleAccess
    && requiredPermission
    && !hasPermission(user, requiredPermission),
  );
  const missingCapability = Boolean(
    !ownerHasGlobalAccess
    && (
      (!registryDecision.allowed && registryDecision.reason === 'capability')
      || (
        requiredAnyCapabilities?.length
        && !hasAnyCapability(user, requiredAnyCapabilities)
      )
      || Boolean(
        requiredSensitiveCapability
        && !hasSensitiveCapability(user, requiredSensitiveCapability)
      )
    ),
  );

  if (missingPermission || missingCapability) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Habilitations insuffisantes</h2>
          <p className="text-gray-600 mb-6">
            Les habilitations requises pour accéder à cette ressource ne vous ont pas été accordées.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
