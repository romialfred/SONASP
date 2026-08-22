# Rapport de non-régression

## Résultats

| Contrôle | Résultat | Observation |
| --- | --- | --- |
| Tests Vitest complets | réussi | 89 fichiers, 821 tests réussis |
| Tests publics ajoutés | réussi | contenu du hero, CTA Portail Mine, langue, validation assistance, métadonnées |
| TypeScript ciblé / transpilation | réussi | nouveaux modules validés par ESLint typé et build Vite |
| TypeScript global `tsc -p tsconfig.app.json` | dette existante | 129 diagnostics dans le back-office historique, hors de la tranche publique |
| Build Vite/PWA | réussi | 79 entrées précachées, environ 1,15 Mio ; bundle privé exclu du précache |
| ESLint ciblé | réussi | aucune erreur dans les nouveaux modules publics, Mine Portal, SEO et récupération d’accès |
| ESLint global | dette existante | 75 erreurs et 95 avertissements hors de la nouvelle tranche |

## Parcours contrôlés

- la racine ouvre la vitrine et non le back-office ;
- `/portail-mine` redirige un visiteur non authentifié vers `/login` ;
- les représentants de mine sont redirigés vers leur portail après connexion ;
- les profils absents, inactifs ou non rattachés échouent de manière fermée ;
- chaque requête du portail est filtrée par `mining_company_id` et la migration renforce le cloisonnement côté base ;
- les routes publiques, juridiques, actualités et assistance rendent un titre principal unique ;
- une URL inconnue aboutit à `/404` ;
- récupération et modification du mot de passe utilisent les API d’authentification existantes ;
- la feuille publique est limitée au conteneur `.public-site` et n’altère pas les styles privés ;
- aucune donnée réelle du tableau de bord ou d’une mine n’est affichée dans la vitrine.

## Avertissements non bloquants

- le bundle privé historique reste supérieur à 4 Mio avant compression ; il est désormais chargé à la demande et exclu du précache PWA public ;
- `pdfjs-dist` utilise `eval` et `xlsx` limite le découpage de certains chunks existants ;
- Browserslist signale une base `caniuse-lite` ancienne ;
- la configuration Vitest utilise une option de pool dépréciée, sans impact sur le résultat courant.

## Dépendances

L’audit npm est passé de 26 alertes (dont 3 critiques) à 3 alertes sans aucune critique après mises à jour et revalidation complète. Restent deux alertes élevées : `xlsx` côté runtime, sans correctif publié dans le registre npm, et Vite côté serveur de développement/outillage. Une alerte modérée transitive concerne `esbuild` via Vite. Voir `RAPPORT-DEPENDANCES.md`.
