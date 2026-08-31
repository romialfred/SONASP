export type BrowserNetworkState = 'online' | 'offline';
export type PwaUpdateCheckResult = 'checked' | 'unsupported' | 'failed';

/**
 * `navigator.onLine === false` est le seul signal navigateur qui autorise
 * l'interface à annoncer une coupure. Une erreur HTTP, API, CORS ou CSP ne doit
 * jamais être convertie en faux état « Internet coupé ».
 */
export function browserNetworkState(): BrowserNetworkState {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return 'online';
}

/**
 * Point unique du rechargement PWA volontaire. Le client Workbox appelle son
 * callback `controlling` dans tous les onglets quand une version est activée ;
 * cette fonction ne doit donc être invoquée qu'après un geste explicite dans
 * l'onglet courant.
 */
export function reloadCurrentDocument(): void {
  window.location.reload();
}

/**
 * Demande au navigateur de vérifier le worker courant, sans l'activer et sans
 * recharger la page. Si une version attend, le composant PwaUpdatePrompt sera
 * notifié par Workbox et laissera l'utilisateur décider du moment du reload.
 */
export async function requestPwaUpdateCheck(): Promise<PwaUpdateCheckResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return 'unsupported';
    await registration.update();
    return 'checked';
  } catch {
    return 'failed';
  }
}
