/** Do not expose database internals, row values, tokens or signed URLs in a dialog. */
export function presentError(error: unknown) {
  const value = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : {};
  const message = typeof error === 'string' ? error : typeof value.message === 'string' ? value.message : '';
  const code = typeof value.code === 'string' && /^[A-Z0-9_]{3,24}$/.test(value.code) ? value.code : undefined;
  if (code === 'PGRST201' || /more than one relationship|could not embed/i.test(message)) {
    return { category: 'configuration', code: code || 'PGRST201', title: 'Connexion aux données indisponible',
      message: 'L’application n’a pas pu relier les données nécessaires à cette page.',
      recovery: 'Rechargez les données. Si le problème persiste, communiquez le code de diagnostic à votre administrateur.' };
  }
  if (code === '42501' || /permission|row.level security|not authorized|non autoris|capacit|AAL2/i.test(message)) {
    return { category: 'access', code, title: 'Action non autorisée',
      message: 'Votre session actuelle ne permet pas d’effectuer cette opération.',
      recovery: 'Faites vérifier vos droits d’accès par un administrateur. Ne créez pas un autre enregistrement pour contourner cette restriction.' };
  }
  if (code === '40001' || /conflict|conflit|changé entre/i.test(message)) {
    return { category: 'conflict', code, title: 'Cet enregistrement a été modifié',
      message: 'Une autre opération a modifié cet enregistrement avant la fin de votre demande.',
      recovery: 'Rechargez l’enregistrement et vérifiez son état actuel avant de soumettre de nouveau la demande.' };
  }
  if (code === '23505' || /duplicate|already exists|existe déjà/i.test(message)) {
    return { category: 'duplicate', code, title: 'Enregistrement déjà existant',
      message: 'Un enregistrement portant la même référence ou la même expédition existe déjà.',
      recovery: 'Ouvrez l’enregistrement existant avant d’essayer d’en créer un autre.' };
  }
  if (/fetch|network|timeout|connection|réseau/i.test(message)) {
    return { category: 'network', code, title: 'Connexion interrompue',
      message: 'La réponse du serveur n’a pas pu être confirmée.',
      recovery: 'Vérifiez votre connexion. Après une demande d’enregistrement, contrôlez l’enregistrement avant de réessayer afin d’éviter un doublon.' };
  }
  return { category: 'operation', code, title: 'Opération non aboutie',
    message: 'La demande n’a pas été confirmée par le serveur.',
    recovery: 'Vérifiez les informations saisies. Après une demande d’enregistrement, contrôlez l’enregistrement avant de réessayer.' };
}

/**
 * Message unique à afficher à l'utilisateur pour une erreur.
 *
 * Règle : un message métier explicite, levé comme `Error` par un service ou une RPC
 * (ex. « Double contrôle requis… », « Référence de vente déjà utilisée »), est relayé
 * tel quel — il est plus utile que tout libellé générique. Les erreurs brutes de
 * PostgREST/PostgreSQL (objets simples portant un `code`) sont, elles, classées par
 * `presentError` afin de ne jamais exposer d'internes de base (RLS, colonnes, tokens).
 */
export function messageErreurUtilisateur(reason: unknown, repli?: string): string {
  if (reason instanceof Error && reason.message.trim()) return reason.message;
  const info = presentError(reason);
  // Erreur non reconnue : on préfère le repli contextuel du composant (« Impossible de
  // charger… ») au libellé générique, tout en n'exposant jamais le message PostgREST brut.
  if (info.category === 'operation' && repli && repli.trim()) return repli;
  return `${info.title}. ${info.message} ${info.recovery}`;
}
