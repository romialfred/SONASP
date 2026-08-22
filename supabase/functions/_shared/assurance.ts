/**
 * Lit uniquement le niveau d'assurance d'un JWT déjà vérifié par GoTrue.
 *
 * Cette fonction ne valide ni la signature ni l'expiration du jeton : l'appelant
 * doit impérativement avoir obtenu l'utilisateur via `auth.getUser(jeton)`
 * avant de l'utiliser. Elle évite que chaque fonction de bord interprète le
 * claim `aal` différemment.
 */
export function niveauAssurance(jeton: string): 'aal1' | 'aal2' {
  try {
    const segment = jeton.split('.')[1];
    if (!segment) return 'aal1';
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
    );
    return payload?.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}
