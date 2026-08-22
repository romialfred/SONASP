export const ORIGINE_APPLICATION_PRODUCTION = 'https://sonasp.data-univers.com';

const HOTES_LOCAUX = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Rend l'origine publique de la plateforme sans jamais laisser une ancienne
 * valeur locale contaminer les liens envoyes par courriel.
 */
export function origineApplication(valeurConfiguree?: string | null): string {
  try {
    const url = new URL(valeurConfiguree || ORIGINE_APPLICATION_PRODUCTION);
    if (url.protocol !== 'https:' || HOTES_LOCAUX.has(url.hostname.toLowerCase())) {
      return ORIGINE_APPLICATION_PRODUCTION;
    }
    return url.origin;
  } catch {
    return ORIGINE_APPLICATION_PRODUCTION;
  }
}

export function urlModificationMotDePasse(valeurConfiguree?: string | null): string {
  return `${origineApplication(valeurConfiguree)}/modifier-mot-de-passe`;
}

export function urlRecuperationCompte(
  jetonHache: string,
  valeurConfiguree?: string | null,
): string {
  const url = new URL(urlModificationMotDePasse(valeurConfiguree));
  url.searchParams.set('token_hash', jetonHache);
  url.searchParams.set('type', 'recovery');
  return url.toString();
}
