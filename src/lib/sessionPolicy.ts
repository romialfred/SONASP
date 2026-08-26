/**
 * Politique commune au minuteur local et aux RPC de session du serveur.
 *
 * La durée d'inactivité est un paramètre de plateforme, tenu en base et lu par
 * `snp_session_timeout_minutes()`. C'est le serveur qui décide : il fixe
 * `user_sessions.expires_at` à chaque battement d'activité. Le minuteur local ne
 * fait que devancer cette échéance pour prévenir l'utilisateur et le déconnecter
 * proprement.
 *
 * La valeur ci-dessous n'est donc pas la règle, mais le repli employé tant que
 * la valeur du serveur n'est pas connue — au tout début de la session, ou si sa
 * lecture échoue. Elle vaut dix minutes, la borne la plus prudente : mieux vaut
 * déconnecter trop tôt et laisser le serveur démentir que promettre une durée
 * que la base ne tiendrait pas.
 */
export const SESSION_INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
export const SESSION_WARNING_BEFORE_TIMEOUT_MS = 60 * 1000;
export const SESSION_ACTIVITY_HEARTBEAT_MS = 30 * 1000;

/** Bornes appliquées par le serveur, reprises ici pour refuser une valeur folle. */
export const SESSION_INACTIVITY_MIN_MINUTES = 5;
export const SESSION_INACTIVITY_MAX_MINUTES = 120;

let dureeEffectiveMs: number = SESSION_INACTIVITY_TIMEOUT_MS;

/** Durée d'inactivité en vigueur, à lire à chaque échéance plutôt qu'à l'import. */
export function dureeInactiviteMs(): number {
  return dureeEffectiveMs;
}

/**
 * Applique la durée annoncée par le serveur. La valeur est bornée ici aussi :
 * une réponse inattendue ne doit pas pouvoir désarmer le minuteur.
 * Renvoie la durée finalement retenue, en minutes.
 */
export function appliquerDureeInactivite(minutes: number): number {
  if (!Number.isFinite(minutes)) return dureeEffectiveMs / 60_000;

  const bornees = Math.min(
    SESSION_INACTIVITY_MAX_MINUTES,
    Math.max(SESSION_INACTIVITY_MIN_MINUTES, Math.floor(minutes)),
  );
  dureeEffectiveMs = bornees * 60 * 1000;
  return bornees;
}

/** Rétablit le repli. Utilisé à la déconnexion et par les tests. */
export function reinitialiserDureeInactivite(): void {
  dureeEffectiveMs = SESSION_INACTIVITY_TIMEOUT_MS;
}
