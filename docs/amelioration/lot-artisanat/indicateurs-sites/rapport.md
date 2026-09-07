# Indicateurs sans référence — tableau de bord des sites artisanaux

Date : 7 septembre 2026. Baseline examinée : `b654eb97`. Travail local uniquement, sans navigateur, requête distante, migration, commit ou déploiement par cet agent.

## Défauts reproduits et correction bornée

La route `/artisan-sites` utilise `ArtisanalSitesOverview.tsx`, et non un fichier nommé `ArtisanalSitesDashboard.tsx`. Le chargement `artisanalSiteService.loadSiteData()` retourne seulement les sites et les productions issues des ventes des artisans (`src/services/artisanalSiteService.ts:121`). Les champs de production ne contiennent ni objectif annuel, ni référence historique d’effectif, ni créance fiscale ou encaissement fiscal (`src/types/artisanalSite.ts:77`).

| Affirmation avant correction | Origine vérifiée sur la baseline | Traitement |
| --- | --- | --- |
| Sites : `+8,2 % vs année précédente` | Texte JSX constant, `ArtisanalSitesOverview.tsx:389` | Remplacé par « Comparaison annuelle : référence non disponible ». |
| Artisans : `+4,6 % vs année précédente` | Texte JSX constant, `ArtisanalSitesOverview.tsx:399` | Même état explicite ; aucune évolution inventée. |
| Objectif de production en pourcentage | Production chargée divisée par `ANNUAL_PRODUCTION_TARGET_KG = 4_500`, `ArtisanalSitesOverview.tsx:208` et `artisanalSiteInsights.ts:13` | Objectif indisponible ; calcul de réalisation supprimé. |
| Courbe d’objectif mensuel | Objectif annuel implicite divisé par douze, soit 375 kg, `artisanalSiteInsights.ts:229` | Courbe fictive retirée ; légende « Objectif mensuel : référence non disponible ». Le nombre 380 n’est pas une constante trouvée dans ces sources ; sa provenance dans le rendu n’a pas été testée au navigateur. |
| Taux de recouvrement | Taxes chargées divisées par le chiffre d’affaires multiplié par 3 %, limité à 100 %, `ArtisanalSitesOverview.tsx:210` | Ratio sans référence retiré ; « Recouvrement : référence non disponible ». |

Les totaux de sites, effectifs, volumes, chiffre d’affaires et taxes chargés restent inchangés. Le helper mensuel retourne `objective: null` par défaut et pour une référence invalide. Un objectif numérique explicite reste pris en charge pour un appelant disposant d’une référence ; l’unique appelant applicatif actuel est cette page et n’en fournit pas. Aucun nouvel objectif, seuil métier ou calcul de recouvrement n’a été ajouté.

Extension demandée après le premier gel : le compteur `permitsToRenew`, calculé sur `updatedAt > 365 jours`, est présenté comme « Fiches à actualiser ». Son aide accessible précise : « Fiches dont la dernière mise à jour du dossier remonte à plus de 365 jours. » Le nom interne, le calcul et l’action existante restent inchangés ; aucune échéance d’autorisation ou d’AEA n’est déduite de cette ancienneté.

Contre-vérification fiscale : la source actuelle affiche déjà « Taxes déclarées », avec une aide décrivant la somme de TVA et taxe de développement communautaire. La mention de « Taxes recouvrées » dans la première version de ce rapport était inexacte pour cette source. Aucun changement supplémentaire du libellé fiscal n’est effectué ; une assertion protège le libellé actuel.

## Périmètre des sources

Modifications limitées à :

- `src/pages/artisanal-sites/ArtisanalSitesOverview.tsx`
- `src/pages/artisanal-sites/ArtisanalSitesOverview.test.tsx`
- `src/services/artisanalSiteInsights.ts`
- `src/services/artisanalSiteInsights.test.ts`

Les formulaires, les droits, les données, la persistance, le service photos et le lot Collecteurs ne sont pas modifiés. Les empreintes avant et après le dernier rejeu sont enregistrées dans `evidence.json`.

## Vérifications exécutées

| Vérification locale | Résultat | Preuve |
| --- | --- | --- |
| Nouveaux tests contre le code avant correction | 7 échecs attendus, 19 réussites, 26 cas | `red.log` |
| Assertion du compteur avant son changement de libellé | 1 échec attendu, 7 réussites sur le fichier de page | `label-red.log` |
| Tests après correction, page rendue en DOM de test et helper réel | 26/26 réussis | `targeted-tests.log`, puis `frozen-tests.log` |
| ESLint sur les quatre fichiers, puis après extension du libellé | Code 0 | `lint.log`, `label-lint.log` (vides car aucun diagnostic) |
| `npm run typecheck:compiler`, premier gel avant l’extension de texte et d’aide | Code 0 | `typecheck.log` |
| `git diff --check` sur les quatre fichiers | Code 0 | Contrôle local ; avertissements Git de conversion LF/CRLF uniquement |

Les nouveaux cas vérifient l’absence des deux progressions fixes, l’absence de ligne d’objectif, les états de référence indisponible, la conservation d’un volume et d’un montant fiscal chargés, et le refus d’un objectif absent ou invalide. Le cas existant d’un objectif explicitement fourni reste couvert. L’extension ajoute au test de présentation existant le contrôle de « Fiches à actualiser », de son aide accessible, de l’absence de l’ancienne formulation et du maintien de « Taxes déclarées ».

Le premier gel reste conservé dans `initial-evidence.json` et `initial-frozen-tests.log`. Le fichier `evidence.json` décrit le dernier rejeu après l’extension et ses empreintes ; le nombre de cas reste 26, car les assertions ont été ajoutées à un test existant.

Les services et les composants graphiques sont doublés dans le test de page. Ces résultats ne constituent pas une recette navigateur, une comparaison visuelle ni une validation d’enregistrement dans la base. Aucun résultat de production n’est déclaré validé.

## Constats voisins, hors correction de ce lot

Ces constats proviennent de la lecture des sources ; ils ne sont pas des chiffres de démonstration fixes et nécessitent un cadrage séparé :

- En l’absence de site noté, `computeGlobalCompliance` renvoie 0 (`artisanalSiteInsights.ts:196`) ; ce comportement n’est pas modifié.
- La série mensuelle utilise les productions filtrées par période (`ArtisanalSitesOverview.tsx:211`), tandis que les tuiles utilisent aussi les filtres de région, statut, catégorie et recherche (`ArtisanalSitesOverview.tsx:172`). L’alignement du périmètre de ces indicateurs n’est pas modifié dans ce lot.

Ces limites restent explicites : le lot supprime les comparaisons non fondées identifiées, sans prétendre valider intégralement les règles du tableau de bord.
