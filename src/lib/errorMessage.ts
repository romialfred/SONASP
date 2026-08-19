/**
 * Message lisible d'une erreur, quelle que soit sa forme.
 *
 * Les erreurs Supabase sont des objets simples portant `message`, pas des instances
 * d'`Error` : un test `instanceof Error` les remplaçait par un libellé générique et
 * la cause réelle n'atteignait jamais l'utilisateur.
 */
export function errorMessage(reason: unknown, repli: string): string {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === 'string' && reason.trim()) return reason;
  if (reason && typeof reason === 'object') {
    const message = (reason as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return repli;
}
