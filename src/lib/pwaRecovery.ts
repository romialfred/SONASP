/**
 * Retire le service worker et les caches applicatifs qui peuvent encore servir
 * un ancien point d'entrée après un déploiement. Le rechargement qui suit repart
 * alors du réseau et enregistre le worker de la version courante.
 */
export async function purgerVersionPwaObsolete(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const inscriptions = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(
      inscriptions
        .filter((inscription) => inscription.scope.startsWith(window.location.origin))
        .map((inscription) => inscription.unregister().catch(() => false)),
    );
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    const noms = await window.caches.keys().catch(() => []);
    await Promise.all(
      noms
        .filter((nom) => nom.startsWith('sonasp-') || nom.startsWith('workbox-precache'))
        .map((nom) => window.caches.delete(nom).catch(() => false)),
    );
  }
}
