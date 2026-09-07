# LECT-VOL-006 — Lectures complètes du référentiel artisanal

Lot réalisé localement le 7 septembre 2026 sur `codex/amelioration-integrale`, à partir du HEAD `04b1826c`. Aucun appel à la base distante, aucune migration, aucun commit, push ou déploiement n'a été effectué pour ce lot. Le navigateur partagé reste sous le contrôle de l'orchestrateur.

## Cause reproduite et correction

Les lectures de liste acceptaient la première réponse REST comme un résultat complet. Le test simule un plafond de 1 000 lignes : une population de 1 001 lignes est tronquée avant correction. `getSite` cherchait dans cette liste et ne retrouvait pas le dossier placé après cette limite. Les affectations de responsables pouvaient aussi être perdues après le plafond propre à leur table. L'orchestrateur a ensuite étendu le lot à `getAllCartes`, autre source du tableau de bord présentant le même défaut.

Les services utilisent désormais `readAllPages` : chaque requête demande `count: 'exact'`, conserve son filtre et son tri métier, et ajoute l'identifiant comme départage déterministe. Les plages inclusives de 500 avancent du nombre réellement reçu. Un plafond serveur inférieur, testé à 73 et à 1, ne produit donc ni saut ni arrêt prématuré. La fin n'est confirmée que lorsque le nombre de lignes uniques reçues atteint le total exact.

Une erreur distante ou réseau reste propagée. Un total absent/invalide/changeant, une page vide avant la fin, des identifiants absents/répétés ou une réponse incohérente déclenchent une erreur explicite en français, sans publier la liste partielle. Les appels restent effectués avec le même client connecté et les mêmes tables/relations ; aucun contrôle RLS, rôle, permission ou workflow de sauvegarde n'est modifié.

`getSite(id)` lit directement le site par identifiant, puis ses seules affectations avec `site_id = id`. Le résultat `null` signifie que le site n'est pas retourné par le lecteur courant : absent ou non visible selon les droits. Une erreur du site ou de ses affectations est propagée. Les données et la normalisation de la fiche, de l'AEA, des responsables et des ventes restent inchangées.

## Fichiers

- `src/lib/readAllPages.ts` et `readAllPages.test.ts` : helper neutre ; extension de propriété autorisée par l'orchestrateur.
- `src/services/artisanMinierService.ts` : `getAll` uniquement.
- `src/services/artisanGoldSalesService.ts` : `getAll` et `getByArtisan` uniquement.
- `src/services/artisanalSiteService.ts` : `listSites` et `getSite` uniquement.
- `src/services/carteProfessionnelleService.ts` : `getAllCartes` uniquement ; filtre statut appliqué à chaque requête, filtres historiques type d'artisan/société minière conservés après lecture complète, relations et transitions de cartes inchangées.
- `src/services/artisanReadVolume.test.ts` : tests transversaux sur les vrais services, client Supabase simulé.

## Preuves locales

| Exécution | Résultat | Artefact |
|---|---|---|
| Avant correction, nouveaux tests de services | 2 réussis / 72 ; 70 échecs attendus | `avant.json`, `avant.log` |
| Après première correction, services et tests de sauvegarde/métriques | 78 / 78 | `apres-initial.json` |
| Extension du banc helper | 104 / 108 ; 4 défauts du paramétrage `it.each` du nouveau test | `apres.json` |
| Après correction de ce paramétrage, helper + services + zone | 135 / 135, 7 fichiers | `apres-final.json`, `apres-final.log` |
| Extension cartes avant correction | 17 échecs reproduits ; 74 tests hors filtre ignorés | `cartes-avant.json`, `cartes-avant.log` |
| Après extension cartes, helper + services + zone | **159 / 159, 8 fichiers** | `apres-cartes-final.json`, `apres-cartes-final.log` |
| ESLint des 7 fichiers ajoutés/modifiés | Voir sortie finale dans `preuves.json` | `lint-final.log` |
| Typage global avant l'extension cartes | Sortie 0 ; typage final après extension confié à l'orchestrateur | `typecheck-final.log` |

Les 70 échecs initiaux comprennent les nouvelles assertions de tri/total et de gestion d'erreur ; ils ne représentent pas 70 pertes de données constatées. `preuves.json` isole les échecs spécifiques à 1 001 lignes, au plafond réduit et au faux dossier introuvable, et donne les empreintes SHA256 des sept sources du lot.

La série couvre 0, 1, 499, 500, 501, 999, 1 000, 1 001 et 1 500 lignes ; les plafonds réduits ; une erreur tardive ; les totaux/pages incohérents ; les doublons ; les filtres et tris métier ; la conservation de la relation historique des ventes (site renseigné, null explicite, absence historique) ; les affectations paginées en liste et détail ; l'échec du pipeline de production sans faux agrégat partiel.

Le test du helper utilise aussi le véritable client installé `@supabase/supabase-js`, avec `fetch` entièrement remplacé et un domaine réservé `.invalid`. Il vérifie les paramètres HTTP générés : `count=exact`, ordre date/id, filtre artisan, limite 500 et décalage ajusté à une ligne reçue. Il ne réalise aucune requête réseau ni authentification réelle.

Commandes finales :

```powershell
npx vitest run src/lib/readAllPages.test.ts src/services/artisanReadVolume.test.ts src/services/artisanalSiteService.test.ts src/services/artisanalSiteSave.test.ts src/services/artisanalSiteInsights.test.ts src/services/artisanTerritoryInsights.test.ts src/services/factureVenteService.test.ts src/services/carteProfessionnelleService.test.ts --maxWorkers=2 --reporter=json --outputFile=docs/amelioration/lot-artisanat/lecture-volume/apres-cartes-final.json
npx eslint src/lib/readAllPages.ts src/lib/readAllPages.test.ts src/services/artisanReadVolume.test.ts src/services/artisanMinierService.ts src/services/artisanGoldSalesService.ts src/services/artisanalSiteService.ts src/services/carteProfessionnelleService.ts
npm run typecheck
```

## Limites précises

- Les tests de frontière sont des simulations locales ; aucun dépassement du plafond de la base hébergée, parcours navigateur, Auth/MFA ou cloisonnement multi-organismes réel n'a été exécuté pour ce lot. La recette distante reste soumise au nouveau Go explicite.
- Les pages HTTP distinctes ne constituent pas un snapshot transactionnel. Le changement de total et les doublons détectent certaines modifications concurrentes, mais une insertion et une suppression compensées, ou une modification du tri conservant le total sans doublon, peuvent encore produire une lecture de plusieurs instants. Une garantie de snapshot demanderait un contrat serveur distinct, non implémenté ici.
- Le total exact est recalculé à chaque tranche ; son coût et le chargement intégral en mémoire sont à mesurer sur la volumétrie réelle. Aucun seuil métier limitant silencieusement la liste n'est ajouté.
- Les autres méthodes de lecture, notamment `getArtisanStatistics`, conservent leur comportement existant et ne sont pas validées comme exhaustives par ce lot. La correction est limitée aux méthodes confiées.
- Ce résultat ne remplace pas la suite globale, le build final ni la recette des écrans, coordonnés séparément par l'orchestrateur.
- Doubles de présentation examinés : `docs/multiportail-qa/supabase.ts` accepte `range` via Proxy et renvoie un total ; ses fixtures actuelles restent sous 500 lignes. Il ignore toutefois réellement la plage et ne doit pas servir de preuve de volumétrie. Le transport `docs/affiliation-qa/workflow-supabase.ts` n'expose pas `range`/demande de total ; cette incompatibilité d'un autre banc a été signalée à l'orchestrateur, sans appeler son serveur SQL ni le modifier hors propriété. Les mocks de pages utilisent généralement les services remplacés en entier, dont les signatures sont conservées.

## Références consultées

Skill Supabase et `CLAUDE.md` relus ; documentation officielle [select](https://supabase.com/docs/reference/javascript/select), [plages et ordre](https://docs-supabase.vercel.app/docs/reference/javascript/using-modifiers-range), [changelog](https://supabase.com/changelog.md). Les signatures ont également été vérifiées dans les sources installées de `@supabase/postgrest-js`. Aucune évolution du schéma n'est nécessaire à cette correction.
