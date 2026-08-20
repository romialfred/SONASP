/**
 * Identité du site national.
 *
 * Le socle héritait d'un autre déploiement : le site par défaut valait
 * `'guinea'` dans une dizaine de services, et les lignes de `daily_production`,
 * `annual_budgets` et `production_forecasts` portaient cette même valeur. Une
 * plateforme burkinabè filtrait donc sa production sur un site guinéen, et rien
 * dans l'application ne le disait.
 *
 * La valeur est ici, une fois, plutôt que répétée en défaut de paramètre : un
 * défaut dispersé se corrige à moitié.
 */

/** Clé du site national, telle qu'inscrite en base sur `site_id`. */
export const SITE_NATIONAL = 'burkina_faso';

/** Nom du pays, pour les libellés et les documents officiels. */
export const PAYS_NATIONAL = 'Burkina Faso';

/** Monnaie ayant cours : le franc CFA d'Afrique de l'Ouest. */
export const DEVISE_NATIONALE = 'XOF';
