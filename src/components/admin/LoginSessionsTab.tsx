import { useEffect, useMemo, useState } from 'react';
import {
  Download, Monitor, Smartphone, Tablet, ShieldCheck, ShieldOff,
  RefreshCw, Clock, CircleSlash
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';

interface LoginSessionsTabProps {
  userId: string;
}

/**
 * Reflet du type `snp_session_public` renvoyé par `snp_sessions_lister`.
 *
 * L'écran interrogeait auparavant une relation `user_login_history` qui n'a
 * jamais existé en base : il attendait un historique de tentatives de connexion,
 * avec succès, échec et second facteur. La plateforme conserve des sessions, non
 * des tentatives. Les colonnes affichées sont donc celles qui existent
 * réellement ; rien n'est déduit ni supposé.
 */
interface SessionEntry {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  location_country: string | null;
  created_at: string;
  last_activity_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  is_current: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
}

type EtatSession = 'active' | 'revoquee' | 'expiree';

const TAILLE_PAGE = 20;

function etatDeLaSession(session: SessionEntry): EtatSession {
  if (session.revoked_at) return 'revoquee';
  if (!session.is_active) return 'expiree';
  if (session.expires_at && new Date(session.expires_at) <= new Date()) return 'expiree';
  return 'active';
}

function libelleEtat(etat: EtatSession): string {
  switch (etat) {
    case 'active':
      return 'Active';
    case 'revoquee':
      return 'Révoquée';
    case 'expiree':
      return 'Expirée';
  }
}

function formatDate(valeur: string): string {
  return new Date(valeur).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * La durée n'est pas stockée : elle se déduit de l'ouverture et du dernier signe
 * d'activité, ou de la révocation lorsqu'elle a eu lieu.
 */
function formatDuree(session: SessionEntry): string {
  const debut = new Date(session.created_at).getTime();
  const finBrute = session.revoked_at ?? session.last_activity_at;
  if (!finBrute) return '-';

  const fin = new Date(finBrute).getTime();
  const secondes = Math.max(0, Math.round((fin - debut) / 1000));
  if (secondes < 60) return `${secondes} s`;

  const heures = Math.floor(secondes / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  if (heures > 0) return `${heures} h ${minutes} min`;
  return `${minutes} min`;
}

export default function LoginSessionsTab({ userId }: LoginSessionsTabProps) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<'history' | 'stats'>('history');

  const chargerSessions = async () => {
    try {
      setLoading(true);
      setErreur(null);
      // La lecture passe par la procédure dédiée : la table des sessions n'est
      // pas exposée à l'API, et la procédure applique elle-même le contrôle
      // d'accès et ne renvoie que les champs publics.
      const { data, error } = await supabase.rpc('snp_sessions_lister', {
        p_user_id: userId,
        p_actives_seulement: false,
      });

      if (error) throw error;
      setSessions((data ?? []) as SessionEntry[]);
    } catch (error) {
      setErreur(errorMessage(error, 'Les sessions de ce compte n’ont pas pu être chargées.'));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    void chargerSessions();
  }, [userId]);

  const pageCourante = useMemo(
    () => sessions.slice(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE),
    [sessions, page],
  );
  const aPageSuivante = (page + 1) * TAILLE_PAGE < sessions.length;

  const stats = useMemo(() => {
    const total = sessions.length;
    const actives = sessions.filter((s) => etatDeLaSession(s) === 'active').length;
    const revoquees = sessions.filter((s) => etatDeLaSession(s) === 'revoquee').length;
    const expirees = sessions.filter((s) => etatDeLaSession(s) === 'expiree').length;

    const appareils = sessions.reduce((acc, s) => {
      const appareil = s.device_type || 'Poste fixe';
      acc[appareil] = (acc[appareil] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pays = sessions.reduce((acc, s) => {
      // Le pays n'est pas toujours renseigné : on le dit plutôt que de le deviner.
      const libelle = s.location_country || 'Non renseigné';
      acc[libelle] = (acc[libelle] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, actives, revoquees, expirees, appareils, pays };
  }, [sessions]);

  const handleExport = () => {
    const lignes = [
      ['Ouverture', 'Etat', 'Derniere activite', 'Duree', 'Appareil', 'Navigateur', 'Pays', 'IP', 'Motif de revocation'].join(';'),
      ...sessions.map((session) => [
        formatDate(session.created_at),
        libelleEtat(etatDeLaSession(session)),
        session.last_activity_at ? formatDate(session.last_activity_at) : '-',
        formatDuree(session),
        session.device_type || 'Poste fixe',
        session.browser || '-',
        session.location_country || '-',
        session.ip_address || '-',
        session.revocation_reason || '-',
      ].join(';')),
    ].join('\n');

    const blob = new Blob([lignes], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `sessions-${userId}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    window.URL.revokeObjectURL(url);
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-blue-600" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-purple-600" />;
      default:
        return <Monitor className="w-4 h-4 text-slate-600" />;
    }
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Ouverture',
      render: (_valeur: unknown, session: SessionEntry) => (
        <div>
          <div className="text-sm font-medium text-slate-900">
            {formatDate(session.created_at)}
          </div>
          {session.last_activity_at && (
            <div className="text-xs text-slate-500">
              Dernière activité : {formatDate(session.last_activity_at)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'etat',
      label: 'État',
      render: (_valeur: unknown, session: SessionEntry) => {
        const etat = etatDeLaSession(session);
        return (
          <div className="flex items-center gap-2">
            {etat === 'active' && <ShieldCheck className="w-4 h-4 text-emerald-600" />}
            {etat === 'revoquee' && <ShieldOff className="w-4 h-4 text-red-600" />}
            {etat === 'expiree' && <CircleSlash className="w-4 h-4 text-slate-500" />}
            <div>
              <span
                className={`text-sm font-medium ${
                  etat === 'active'
                    ? 'text-emerald-700'
                    : etat === 'revoquee'
                      ? 'text-red-700'
                      : 'text-slate-600'
                }`}
              >
                {libelleEtat(etat)}
              </span>
              {session.is_current && (
                <span className="ml-2 text-xs text-blue-700">session courante</span>
              )}
              {session.revocation_reason && (
                <div className="text-xs text-slate-500">{session.revocation_reason}</div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'appareil',
      label: 'Appareil',
      render: (_valeur: unknown, session: SessionEntry) => (
        <div className="flex items-center gap-2">
          {getDeviceIcon(session.device_type)}
          <div>
            <div className="text-sm text-slate-900 capitalize">
              {session.device_type || 'Poste fixe'}
            </div>
            <div className="text-xs text-slate-500">
              {session.browser || 'Navigateur non identifié'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'location_country',
      label: 'Pays',
      render: (_valeur: unknown, session: SessionEntry) => (
        <div className="text-sm text-slate-900">
          {session.location_country || 'Non renseigné'}
        </div>
      ),
    },
    {
      key: 'ip_address',
      label: 'Adresse IP',
      render: (_valeur: unknown, session: SessionEntry) => (
        <div className="text-sm font-mono text-slate-600">
          {session.ip_address || 'Non renseignée'}
        </div>
      ),
    },
    {
      key: 'duree',
      label: 'Durée',
      render: (_valeur: unknown, session: SessionEntry) => (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-sm text-slate-900">{formatDuree(session)}</span>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-96 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Sessions de connexion</h3>
          <p className="text-sm text-slate-600">
            {stats.total} session{stats.total > 1 ? 's' : ''} enregistrée
            {stats.total > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={chargerSessions} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={stats.total === 0}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exporter
          </Button>
        </div>
      </div>

      {erreur && (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{erreur}</p>
        </Card>
      )}

      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sessions
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Synthèse
        </button>
      </div>

      {activeTab === 'history' && (
        <>
          {stats.total === 0 ? (
            <Card className="p-12 text-center">
              <Monitor className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Aucune session enregistrée pour ce compte</p>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <Table columns={columns} data={pageCourante} />
              </Card>

              {sessions.length > TAILLE_PAGE && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Précédent
                  </Button>
                  <span className="text-sm text-slate-600">
                    Page {page + 1} sur {Math.ceil(sessions.length / TAILLE_PAGE)}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!aPageSuivante}
                  >
                    Suivant
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="text-3xl font-bold text-slate-900 mb-1">{stats.total}</div>
              <div className="text-sm text-slate-600">Sessions enregistrées</div>
            </Card>
            <Card className="p-6">
              <div className="text-3xl font-bold text-emerald-700 mb-1">{stats.actives}</div>
              <div className="text-sm text-slate-600">Actives</div>
            </Card>
            <Card className="p-6">
              <div className="text-3xl font-bold text-red-700 mb-1">{stats.revoquees}</div>
              <div className="text-sm text-slate-600">Révoquées</div>
            </Card>
            <Card className="p-6">
              <div className="text-3xl font-bold text-slate-700 mb-1">{stats.expirees}</div>
              <div className="text-sm text-slate-600">Expirées</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h4 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-600" />
                Appareils
              </h4>
              <div className="space-y-3">
                {Object.entries(stats.appareils).map(([appareil, nombre]) => (
                  <div key={appareil} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(appareil)}
                      <span className="text-sm text-slate-900 capitalize">{appareil}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${stats.total > 0 ? (nombre / stats.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-slate-900 w-8 text-right">
                        {nombre}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h4 className="text-base font-semibold text-slate-900 mb-4">Pays d’origine</h4>
              <div className="space-y-3">
                {Object.entries(stats.pays)
                  .slice(0, 5)
                  .map(([pays, nombre]) => (
                    <div key={pays} className="flex items-center justify-between">
                      <span className="text-sm text-slate-900">{pays}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-emerald-600 h-2 rounded-full"
                            style={{
                              width: `${stats.total > 0 ? (nombre / stats.total) * 100 : 0}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-slate-900 w-8 text-right">
                          {nombre}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </div>

          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  Ce que montre cet écran
                </h4>
                <p className="text-sm text-blue-700">
                  Les sessions ouvertes par ce compte, leur appareil, leur origine et leur état :
                  active, révoquée ou expirée. La plateforme conserve les sessions, non les
                  tentatives de connexion : un échec d’authentification n’y figure donc pas.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
