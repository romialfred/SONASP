# Revue indépendante statique — indicateurs des sites artisanaux

7 septembre 2026. Périmètre : les quatre fichiers du lot `indicateurs-sites`, relus après gel. Aucun changement de source/test, SQL, navigateur, commit ou déploiement par l’auditeur. Conformément au gel de la suite globale, aucun rejeu supplémentaire n’a été ajouté.

## Conclusion sur le delta

La suppression des comparaisons sans référence est cohérente avec les sources chargées. Aucun nouveau défaut concret identifié dans ce delta ne justifie de le rouvrir avant la porte globale. Cette conclusion est une revue statique, pas une validation visuelle ni une recette de tout le tableau de bord.

| Élément vérifié | Résultat |
| --- | --- |
| Progression des sites et artisans | Les valeurs constantes `+8,2 %` et `+4,6 %` disparaissent du JSX applicatif. Chaque tuile annonce une référence annuelle indisponible. |
| Objectif de production | La constante implicite de 4 500 kg et le calcul de réalisation sont supprimés. Aucun objectif n’est déduit du volume déclaré. |
| Graphique mensuel | La ligne d’objectif est retirée ; la série de production reste présente. Le helper retourne `objective: null` quand aucun objectif valide n’est fourni. |
| Référence explicite | Le helper conserve la possibilité de recevoir un objectif numérique fini et positif ou nul. Les anciens tests d’un objectif explicitement fourni restent présents. Le seul appelant applicatif actuel n’en fournit pas. |
| Recouvrement | Le rapport `taxes / (chiffre d’affaires × 3 %)` et son plafonnement disparaissent. Le montant fiscal chargé reste affiché avec une référence de recouvrement indisponible. |
| « Fiches à actualiser » | Le libellé reflète le calcul existant sur `updatedAt` datant de plus de 365 jours. Le `title` explique cette règle. Aucune date d’expiration de permis ou d’AEA n’est inventée. |
| Taxes du tableau | Le libellé actuel est bien « Taxes déclarées », avec l’aide décrivant TVA et taxe de développement communautaire. Le lot ne l’a pas rebaptisé en taxe effectivement recouvrée. |

Le champ interne `permitsToRenew` et l’action du bouton restent inchangés : le bouton revient à la vue « Tous », il ne filtre pas spécifiquement les fiches anciennes. Le lot corrige le sens du libellé et ne prétend pas avoir ajouté un workflow de renouvellement.

## Preuves relues

- `../lot-artisanat/indicateurs-sites/evidence.json` : SHA des quatre sources/tests avant et après le rejeu de l’implémenteur.
- `../lot-artisanat/indicateurs-sites/frozen-tests.log` : **26/26 tests dans deux fichiers**, code 0, publiés par l’implémenteur. Le test de page double les services et les graphiques.
- `indicateurs-sites-static-independent.evidence.json` : comparaison locale exécutée par l’auditeur ; les quatre fichiers courants correspondent tous aux SHA du gel.

Les tests relus vérifient l’absence des valeurs et de la série d’objectif, les états indisponibles, le maintien de 2,5 kg et de 120 FCFA provenant du double de service, et les références d’objectif absentes ou invalides. Le test de présentation contrôle aussi le nom et la description accessible du bouton « Fiches à actualiser ». Ces 26 cas ne sont pas présentés comme un rejeu indépendant et ne s’ajoutent pas aux comptes de la suite globale.

SHA applicatifs :

- `ArtisanalSitesOverview.tsx` : `dba9083c6c3bced6e0ee65146c76b87b36fbd5d93de4ac46451d7dcb00ed2c8f`
- `artisanalSiteInsights.ts` : `8d5f93cf35ee5162f76d8dcf51b03d6f6da1939759b1a5ca232fcc2a3ee0917c`

## Limites et voisins hors du delta

Le rapport de l’implémenteur signale déjà le score global nul quand aucun site n’est noté et le périmètre du graphique mensuel limité au filtre de période, alors que les tuiles appliquent également les filtres de région/statut/catégorie/recherche. Ils restent ouverts et n’ont pas été corrigés ici.

La revue relève aussi, sans nouvelle reproduction pendant le gel, deux chemins préexistants à cadrer séparément : les tuiles sont rendues même lorsque le hook signale un chargement ou une erreur ; cette page ne porte pas de frontière de contexte Auth autour de `useArtisanalSiteData`, dont l’effet dépend de la navigation, de la révision et du message d’erreur. Cela ne prouve pas, à lui seul, un incident réel de changement de compte : le comportement de la frontière de routage et du contexte global devra être contrôlé. Il interdit en revanche de déduire de ce lot une validation complète des états de lecture ou de cloisonnement de la page.

Aucun de ces constats voisins n’est masqué par la disparition des chiffres de démonstration. Aucun test visuel, persistance, correction de concurrence ou déploiement n’est déclaré validé par cette revue.
