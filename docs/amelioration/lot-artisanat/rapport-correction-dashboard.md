# Correction ciblée du tableau de bord Artisan

7 septembre 2026 — sous-lot ART-DASH-002 / ART-DASH-003. Base Git de cette itération : `4d6d828d76515dee68266c6db85504923c364eec`. Les quatre fichiers applicatifs et de tests sont figés ; leurs empreintes figurent dans `dashboard-evidence.json`. Aucun commit, push ou déploiement effectué par ce sous-lot.

## Défauts et correction

**ART-DASH-002 — lecture indisponible transformée en chiffres nuls.** Les trois requêtes convertissaient chaque rejet en `[]`, rendant le message d’erreur extérieur inopérant. Le tableau de bord attend désormais un ensemble cohérent de trois listes effectivement reçues. Un rejet ou une réponse absente laisse les six indicateurs à « — » et masque les cartes, tableaux et graphiques dépendants. Un message français propose **Réessayer**, qui relance les trois lectures. Une réponse réussie contenant trois tableaux vides affiche bien l’état vide et ses vrais zéros. Les détails techniques d’une exception ne sont pas exposés.

**ART-DASH-003 — rattachement déduit de la localité.** Le filtre de site/province et les lignes du tableau utilisaient la commune de l’artisan comme clé de jointure. Ils utilisent maintenant `artisanal_site_id`. Les sélecteurs et la colonne Site affichent `site.name`, et non sa localité. Deux sites de même localité restent distincts ; une fiche historique sans relation n’est pas rattachée automatiquement.

La relation particulière des **aides exploitants** est conservée : leur site est celui de leur `exploitant_id`, seulement si cet exploitant figure dans les données déjà retournées au compte. L’index complet du périmètre autorisé reste disponible après un filtre « Aide exploitant », même si l’exploitant n’est plus dans les lignes filtrées. Aucun nouvel accès réseau ni élargissement des droits n’est ajouté.

Ce rattachement est celui du registre : les indicateurs existants comptent les artisans enregistrés sans filtre général `actif`. Un lien explicite vers un exploitant historiquement inactif reste donc lisible. Cela ne rend pas l’aide éligible à une carte ou à une opération : le trigger exige un exploitant actif à la saisie et interdit sa désactivation tant que des aides lui sont rattachés (`20260906111030_refonte_dossier_artisan.sql:88–96`) ; le snapshot de carte contrôle aussi l’activité. Une telle incohérence historique éventuelle reste à examiner sur les données réelles, sans importer dans ce tableau de bord une règle nouvelle d’émission/activation. Ce choix analytique a été confirmé par le pilote et l’auditeur.

Le changement de contexte de lecture remonte uniquement le contenu du tableau de bord, efface les données/filtres précédents et invalide les réponses tardives. Le cadre de navigation conserve son composant. Le périmètre comprend l’utilisateur, l’organisation, la mine, le rôle d’accès, le rôle, le type de compte éventuellement présent, le type d’organisation, l’activité, les capacités, modules, sites, responsabilités, domaines, portail et catégorie d’acteur.

## Sources et impact

| Source | Observation / changement |
|---|---|
| `src/pages/artisan-minier/ArtisanMinierDashboard.tsx:69` | Contexte de lecture et invalidation des données précédentes. |
| `src/pages/artisan-minier/ArtisanMinierDashboard.tsx:124` | Trois lectures, erreur explicite, réponse absente refusée. |
| `src/pages/artisan-minier/ArtisanMinierDashboard.tsx:178` | Filtre par identifiant de site effectif. |
| `src/pages/artisan-minier/ArtisanMinierDashboard.tsx:378` | Indicateurs inconnus, chargement et reprise. |
| `src/services/artisanTerritoryInsights.ts:45` | Résolution explicite du site et agrégation des lignes. |
| `src/services/artisanMinierService.ts:77`, `:112` | FK explicite présente dans le modèle et retournée par la lecture existante. Fichier non modifié. |
| `supabase/migrations/20260906111030_refonte_dossier_artisan.sql:25`, `:372` | Contrainte aide/exploitant et origine du site de l’aide. Migration non modifiée. |
| `supabase/migrations/20260906235254_affiliation_payment_evidence_and_paid_generation.sql:204` | Snapshot de carte utilisant le site de l’exploitant pour l’aide. Migration non modifiée. |

Recherche des appelants effectuée dans `src` : `buildSiteRows` n’a qu’un appelant applicatif, ce tableau de bord ; `artisansOfSite` est appelé par cet agrégateur. Les autres fonctions de répartition, règles de carte et calculs de statut restent inchangés. Aucun formulaire, service d’écriture, garde de route, permission, migration ou matrice générale 05 n’est modifié.

## Vérifications exécutées

| Contrôle | Résultat constaté | Preuve |
|---|---|---|
| Régression avant correction, test Dashboard étendu | 24 échecs / 31 tests, 7 réussites | `test-dashboard-red.log` |
| Composant Dashboard et calculs territoriaux | **42 / 42 réussis**, 2 fichiers (33 composant + 9 calculs) | `test-dashboard.log` |
| ESLint, quatre fichiers du lot | Code 0 | `eslint-dashboard.log` |
| Compilateur TypeScript, `tsconfig.app.json` | Code 0 | `typecheck-dashboard.log` |
| Relecture et tests indépendants, mêmes sources figées | **55 / 55 réussis**, dont 13 scénarios indépendants supplémentaires | Rapport et preuves distincts du dossier `docs/amelioration/audit` |

La batterie couvre séparément le rejet et la réponse absente des trois sources, l’attente de toutes les lectures, les reprises réussies/échouées, la distinction vrai vide/inconnu, les noms de site, les sites homonymes, le filtre province, l’aide sans parent visible et l’aide après filtrage par type, les changements de contexte et les réponses obsolètes. Les anciens scénarios d’onglets et de volet de filtres restent inclus. Les services sont simulés dans ces tests ; les composants et calculs ciblés sont réels.

## Limites et suite

Ce résultat est une **vérification automatisée de composant et de calcul**, pas une validation fonctionnelle complète du module. Aucun navigateur, appel Auth/API réel, lecture/écriture de base, contrôle RLS ou capture responsive n’a été exécuté par ce sous-lot. La base en ligne a été déclarée base de test autorisée ; sa recette réelle est coordonnée séparément par le pilote. Les scénarios généraux restent NON EXÉCUTÉS tant que cette chaîne n’est pas attestée.

Le risque LECT-VOL-006 de listes plafonnées sans pagination reste ouvert. Si l’exploitant d’une aide n’est pas présent dans les lignes visibles, son site reste inconnu ; aucune attribution par commune ne compense cette absence. Les statuts et calculs de conformité des cartes, la carte géographique et ses autres métriques ne sont pas recertifiés par ce correctif. L’audit indépendant a confirmé les 55 tests et la stabilité des quatre sources ; il ne certifie pas la recette réelle Auth/API/base.
