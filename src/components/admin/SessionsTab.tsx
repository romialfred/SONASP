import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, Tablet, X, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { userLoginService } from '@/services/userLoginService';
import type { UserSessionSummary } from '@/services/userSessionService';

interface SessionsTabProps {
  userId: string;
}

export default function SessionsTab({ userId }: SessionsTabProps) {
  const [sessions, setSessions] = useState<UserSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    setSessions([]);
    setError(null);
    void fetchSessions();
    return () => {
      requestVersion.current += 1;
    };
  }, [userId]);

  const fetchSessions = async () => {
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError(null);
      const data = await userLoginService.getActiveSessions(userId);
      if (version !== requestVersion.current) return;
      setSessions(data);
    } catch {
      if (version !== requestVersion.current) return;
      // Fail closed : ne jamais conserver une liste active potentiellement
      // obsolète après une erreur réseau, RLS ou de validation de réponse.
      setSessions([]);
      setError('Les sessions ne peuvent pas être vérifiées pour le moment.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir terminer cette session?')) return;

    try {
      setActionInProgress(sessionId);
      setError(null);
      await userLoginService.terminateSession(sessionId);
      await fetchSessions();
    } catch {
      setSessions([]);
      setError('La révocation n’a pas pu être confirmée. Actualisez avant toute autre action.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleTerminateAll = async () => {
    if (!confirm('Êtes-vous sûr de vouloir terminer toutes les sessions? L\'utilisateur devra se reconnecter.')) return;

    try {
      setActionInProgress('all');
      setError(null);
      await userLoginService.terminateAllSessions(userId);
      await fetchSessions();
    } catch {
      setSessions([]);
      setError('La révocation globale n’a pas pu être confirmée. Actualisez avant toute autre action.');
    } finally {
      setActionInProgress(null);
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-8 h-8 text-slate-600" />;
      case 'tablet':
        return <Tablet className="w-8 h-8 text-slate-600" />;
      default:
        return <Monitor className="w-8 h-8 text-slate-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-64 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {error}
        </Card>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Sessions Actives
          </h3>
          <p className="text-sm text-slate-600">
            {sessions.length} session{sessions.length > 1 ? 's' : ''} active{sessions.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={fetchSessions}
            disabled={actionInProgress !== null}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
          {sessions.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleTerminateAll}
              disabled={actionInProgress !== null}
              className="flex items-center gap-2 text-red-600 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
              Terminer Tout
            </Button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card className="p-12 text-center">
          <Monitor className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Aucune session active</p>
          <p className="text-sm text-slate-500 mt-2">
            L'utilisateur n'est actuellement connecté sur aucun appareil
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((session) => (
            <Card key={session.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getDeviceIcon(session.device_type)}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 capitalize">
                      {session.device_type || 'Desktop'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {session.browser || 'Navigateur inconnu'}
                    </p>
                    {session.is_current && (
                      <p className="mt-1 text-xs font-medium text-blue-700">Session courante</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTerminateSession(session.id)}
                  disabled={actionInProgress !== null}
                  className="text-red-600 hover:bg-red-50"
                  title="Terminer cette session"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-600">Adresse IP</span>
                  <span className="text-xs font-mono text-slate-900">
                    {session.ip_address || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-600">Localisation</span>
                  <span className="text-xs text-slate-900">
                    {session.location_country || 'Non disponible'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-600">Créée le</span>
                  <span className="text-xs text-slate-900">
                    {formatDate(session.created_at)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-600">Dernière activité</span>
                  <span className="text-xs text-slate-900">
                    {getTimeAgo(session.last_activity_at)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-slate-600">Expire le</span>
                  <span className="text-xs text-slate-900">
                    {formatDate(session.expires_at)}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs text-slate-600">Session active</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Monitor className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              À propos des Sessions
            </h4>
            <p className="text-sm text-blue-700">
              Les sessions représentent les connexions actives de l'utilisateur sur différents
              appareils. Terminer une session déconnectera l'utilisateur de cet appareil
              spécifique. Les informations de session sont conservées pour l'audit de sécurité.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
