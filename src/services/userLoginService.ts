import {
  userSessionService,
  type UserSessionSummary,
} from '@/services/userSessionService';

/**
 * Service d'historique de connexion.
 *
 * Il interrogeait auparavant une relation `user_login_history` et une procédure
 * `log_user_login` qui n'existent ni l'une ni l'autre en base : toutes ses
 * lectures échouaient en 404. Il s'appuie désormais sur `userSessionService`,
 * qui passe par les procédures réellement en place — `snp_sessions_lister`,
 * `snp_session_enregistrer`, `snp_session_revoquer`.
 *
 * Le modèle change en conséquence. La plateforme conserve des sessions, non des
 * tentatives : le succès, l'échec, le motif d'échec, le second facteur, le
 * système d'exploitation et la ville n'ont aucune source et ne sont donc plus
 * exposés. Les inventer aurait été pire que de les retirer.
 */

export interface LoginHistoryEntry {
  id: string;
  user_id: string;
  /** Ouverture de la session. */
  login_timestamp: string;
  /** Révocation, lorsqu'elle a eu lieu ; sinon la session court toujours. */
  logout_timestamp: string | null;
  /** Déduite de l'ouverture et du dernier signe d'activité, non stockée. */
  session_duration_seconds: number | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  location_country: string | null;
  is_active: boolean;
  is_current: boolean;
  revocation_reason: string | null;
  created_at: string;
}

export interface LoginStatistics {
  totalSessions: number;
  activeSessions: number;
  revokedSessions: number;
  uniqueDevices: number;
  uniqueLocations: number;
  mostUsedDevice: string;
  mostUsedBrowser: string;
  averageSessionDuration: number;
  recentSessions: LoginHistoryEntry[];
}

const LIMITE_RECENTES = 10;

function dureeEnSecondes(session: UserSessionSummary): number | null {
  const fin = session.revoked_at ?? session.last_activity_at;
  if (!fin) return null;
  const secondes = Math.round(
    (new Date(fin).getTime() - new Date(session.created_at).getTime()) / 1000,
  );
  return secondes >= 0 ? secondes : null;
}

function versEntree(session: UserSessionSummary): LoginHistoryEntry {
  return {
    id: session.id,
    user_id: session.user_id,
    login_timestamp: session.created_at,
    logout_timestamp: session.revoked_at,
    session_duration_seconds: dureeEnSecondes(session),
    ip_address: session.ip_address,
    user_agent: session.user_agent,
    device_type: session.device_type,
    browser: session.browser,
    location_country: session.location_country,
    is_active: session.is_active,
    is_current: session.is_current,
    revocation_reason: session.revocation_reason,
    created_at: session.created_at,
  };
}

function plusFrequent(valeurs: Array<string | null>): string {
  const comptes = new Map<string, number>();
  valeurs.forEach((valeur) => {
    if (!valeur) return;
    comptes.set(valeur, (comptes.get(valeur) || 0) + 1);
  });
  return Array.from(comptes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Non renseigné';
}

export const userLoginService = {
  /**
   * Enregistre la session courante. La plateforme ne consigne pas les échecs
   * d'authentification : cette méthode n'est appelée qu'après une connexion
   * réussie.
   */
  async enregistrerConnexion(): Promise<UserSessionSummary> {
    return userSessionService.registerCurrentSession();
  },

  /**
   * Sessions d'un compte, de la plus récente à la plus ancienne.
   */
  async getLoginHistory(
    userId: string,
    options?: { limit?: number; offset?: number; startDate?: string; endDate?: string },
  ): Promise<LoginHistoryEntry[]> {
    const sessions = await userSessionService.list(userId, false);

    let entrees = sessions
      .map(versEntree)
      .sort(
        (a, b) =>
          new Date(b.login_timestamp).getTime() - new Date(a.login_timestamp).getTime(),
      );

    if (options?.startDate) {
      const debut = new Date(options.startDate).getTime();
      entrees = entrees.filter((e) => new Date(e.login_timestamp).getTime() >= debut);
    }
    if (options?.endDate) {
      const fin = new Date(options.endDate).getTime();
      entrees = entrees.filter((e) => new Date(e.login_timestamp).getTime() <= fin);
    }

    // La procédure ne pagine pas : le découpage se fait ici, sur un volume borné
    // par le nombre de sessions d'un compte.
    const debut = options?.offset ?? 0;
    const fin = options?.limit ? debut + options.limit : undefined;
    return entrees.slice(debut, fin);
  },

  /**
   * Synthèse des sessions sur une période. Les statistiques de réussite et
   * d'échec ont disparu : elles n'ont jamais eu de source.
   */
  async getLoginStatistics(userId: string, days: number = 30): Promise<LoginStatistics> {
    const debut = new Date();
    debut.setDate(debut.getDate() - days);

    const entrees = await this.getLoginHistory(userId, { startDate: debut.toISOString() });

    const actives = entrees.filter((e) => e.is_active && !e.logout_timestamp).length;
    const revoquees = entrees.filter((e) => e.logout_timestamp !== null).length;

    const durees = entrees
      .map((e) => e.session_duration_seconds)
      .filter((d): d is number => d !== null);

    return {
      totalSessions: entrees.length,
      activeSessions: actives,
      revokedSessions: revoquees,
      uniqueDevices: new Set(entrees.map((e) => e.device_type).filter(Boolean)).size,
      uniqueLocations: new Set(entrees.map((e) => e.location_country).filter(Boolean)).size,
      mostUsedDevice: plusFrequent(entrees.map((e) => e.device_type)),
      mostUsedBrowser: plusFrequent(entrees.map((e) => e.browser)),
      averageSessionDuration:
        durees.length > 0 ? durees.reduce((somme, d) => somme + d, 0) / durees.length : 0,
      recentSessions: entrees.slice(0, LIMITE_RECENTES),
    };
  },

  async getActiveSessions(userId: string): Promise<UserSessionSummary[]> {
    return userSessionService.list(userId, true);
  },

  async terminateSession(sessionId: string): Promise<UserSessionSummary> {
    return userSessionService.revoke(sessionId);
  },

  async terminateAllSessions(userId: string): Promise<number> {
    return userSessionService.revokeAll(userId, true);
  },

  /**
   * Export des sessions au format CSV, séparateur point-virgule pour être lu
   * tel quel par un tableur en français.
   */
  async exportLoginHistory(userId: string, days: number = 30): Promise<string> {
    const debut = new Date();
    debut.setDate(debut.getDate() - days);
    const entrees = await this.getLoginHistory(userId, { startDate: debut.toISOString() });

    const entetes = [
      'Ouverture',
      'Etat',
      'Revocation',
      'Motif de revocation',
      'Duree',
      'Appareil',
      'Navigateur',
      'Pays',
      'Adresse IP',
    ];

    const lignes = entrees.map((entree) => [
      new Date(entree.login_timestamp).toLocaleString('fr-FR'),
      entree.logout_timestamp ? 'Revoquee' : entree.is_active ? 'Active' : 'Expiree',
      entree.logout_timestamp ? new Date(entree.logout_timestamp).toLocaleString('fr-FR') : '-',
      entree.revocation_reason || '-',
      formatDureeCsv(entree.session_duration_seconds),
      entree.device_type || 'Poste fixe',
      entree.browser || '-',
      entree.location_country || '-',
      entree.ip_address || '-',
    ]);

    return [
      entetes.join(';'),
      ...lignes.map((ligne) => ligne.map((cellule) => `"${cellule}"`).join(';')),
    ].join('\n');
  },
};

function formatDureeCsv(secondes: number | null): string {
  if (secondes === null) return '-';
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  if (heures > 0) return `${heures} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${secondes} s`;
}
