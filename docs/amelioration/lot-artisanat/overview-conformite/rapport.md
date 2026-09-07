# Indice global de conformité absent — distinguer null et zéro

7 septembre 2026. Extension locale après le P1 Overview, sur la baseline Git `901b5ebb` avec le correctif de lecture déjà présent. Observation UI fournie par le pilote : `docs/amelioration/preuves/lecture-sites-ui/04-overview-vide.txt`, explicitement issue d’un banc isolé avec données et Auth simulés. Cet agent n’a pas piloté le navigateur.

## Inventaire avant changement de type

La recherche de `computeGlobalCompliance` dans `src` puis dans le dépôt hors dépendances, builds et documentation a trouvé :

- sa définition dans `src/services/artisanalSiteInsights.ts` ;
- son unique appelant applicatif, `src/pages/artisanal-sites/ArtisanalSitesOverview.tsx` ;
- les tests du helper dans `src/services/artisanalSiteInsights.test.ts`.

Aucun autre appelant n’a besoin de recevoir le type `number | null`. Les pages Details et Production, le hook partagé, les schémas et les formulaires ne sont pas modifiés.

## Delta

Auparavant, `computeGlobalCompliance` renvoyait 0 quand la liste des sites évalués était vide. La page dessinait alors une jauge 0/100, ce qui assimilait absence d’évaluation et résultat nul.

Le helper renvoie désormais `null` uniquement lorsque cette liste est vide. Le filtrage des sites non évalués, la pondération par les artisans actifs et les règles de score restent inchangés. Un score calculé de 0 reste une note incluse dans la moyenne.

Overview affiche « Non évalué » et « Aucun site évalué dans le périmètre sélectionné. » quand la valeur est null, sans jauge ni suffixe `/ 100`. Toute valeur numérique, y compris zéro, conserve le rendu précédent. La distinction fonctionne aussi pour une sélection composée exclusivement de sites planifiés.

Les seules sources modifiées dans cette extension sont le helper, son test, Overview et son test. Les 38 cas du lot P1 précédent sont conservés.

## Scénarios et preuves

Sept cas sont ajoutés : quatre sur le helper et trois sur la page. Ils couvrent liste vide, sites tous planifiés, vrai zéro et moyenne mélangeant des notes `null`, `0` et `70`. Le vrai zéro est obtenu par les règles actuelles : suspension, dépassement de capacité et absence de déclaration. Aucun score fictif n’est injecté dans le rendu de page pour ce contrôle.

Le test de reproduction avant correction obtient **4 échecs attendus et 57 réussites sur 61 cas** (`red.log`). Les cas qui conservent les scores réellement égaux à zéro passaient déjà ; les quatre échecs concernent l’absence d’évaluation présentée comme zéro.

Le rejeu final inclut le test du helper et les deux cas préexistants du vrai hook : **39 cas Overview + 22 cas helper + 2 cas hook = 63/63 réussites**, code 0. Les empreintes avant/après sont identiques du 7 septembre 2026 à 13:55:26–13:55:56 UTC (`frozen-tests.log`, `evidence.json`). ESLint sur les quatre fichiers et `npm run typecheck:compiler` réussissent chacun avec code 0 (`lint.log`, `typecheck.log`). `git diff --check` retourne 0 ; seuls les avertissements de conversion LF/CRLF sont présents.

Ce lot ne déclare ni recette de base, ni persistance, ni validation visuelle nouvelle. Les tests utilisent le vrai hook et le vrai helper, avec Auth, transport et composants graphiques doublés. Le pilote reste responsable de la vérification navigateur du build intégré.
