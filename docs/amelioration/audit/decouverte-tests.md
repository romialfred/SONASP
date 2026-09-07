# Découverte des tests Vitest — archives de sauvegarde

Le rapport précédent affichait 2 862 cas réussis mais `success=false` : une suite copiée sous `backups/artisan-regression-20260906/live-qa/supabase/functions/create-user/index.runtime.test.ts` échouait à l'import, avant toute assertion. Sa dépendance relative `../../../src/lib/accessControl` pointe vers un répertoire `live-qa/src` absent de cette sauvegarde.

Le test canonique est `supabase/functions/create-user/index.runtime.test.ts`. Son contenu et celui de la copie ont exactement le même SHA256 : `cf0006273554f9f5317853ac2147df6cfcd96ef011b02e8aab3813d761767cf6`. L'inventaire vérifie **31 tests archivés, tous identiques octet par octet à une source canonique présente**. La correspondance complète et les empreintes sont dans [l'inventaire](decouverte-tests-inventaire.json).

`vitest.config.ts` ajoute uniquement `backups/**` à `test.exclude`, en conservant `configDefaults.exclude` (`**/node_modules/**`, `**/.git/**`). Les motifs s'appliquent depuis la racine du projet. Aucun test sous `src`, `supabase`, `tests` ou autre répertoire applicatif n'est exclu ; la correction de découverte ne modifie aucun scénario, délai, permission ou assertion. `coverage.exclude` reste inchangé : il ne pilote pas la découverte des suites. [Référence officielle Vitest](https://vitest.dev/config/exclude).

Le décompte précédent contient **352 fichiers canoniques / 2 599 cas**, plus **31 copies / 263 cas dupliqués**. La comparaison finale doit préserver chacun des fichiers et cas canoniques ; une baisse des seuls doublons n'est pas une perte de couverture métier.

Depuis ce rapport, les lots Clients, Artisan et leurs audits indépendants ajoutent des cas légitimes. La [comparaison détaillée](decouverte-tests-comparaison.json) les énumère individuellement au lieu de se fonder sur un total attendu devenu obsolète après ces ajouts.

Deux exécutions ont été interrompues volontairement sur instruction de coordination, avant les changements applicatifs suivants. Leurs journaux [avant premier gel](decouverte-tests-vitest-avant-gel.log) et [avant correctifs d'audit](decouverte-tests-vitest-avant-correctifs.log) sont conservés ; aucun ne vaut preuve de réussite. La troisième exécution a été menée jusqu'à son terme après le signal de gel, avec la réserve de modification ponctuelle décrite ci-dessous.

## Réexécution complète

Commande, sans filtre applicatif :

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=4 --reporter=default --reporter=json --outputFile.json=docs/amelioration/audit/decouverte-tests-vitest.json
```

Résultat du 7 septembre 2026, de 06:24 à 06:33 UTC : **354 fichiers réussis, 2 634 tests réussis, aucun échec ni cas ignoré, code de sortie 0**. Durée Vitest : 539,59 s. Aucun fichier `backups/` découvert ; les 352 suites canoniques antérieures sont toutes présentes, avec deux nouveaux fichiers.

La comparaison des chemins et noms complets avec multiplicité trouve 36 noms nouveaux et un nom remplacé, soit **35 cas supplémentaires nets**. Le seul remplacement est le scénario Artisan « reste consultable quand les sources annexes échouent », renforcé en « reste consultable mais ne présente aucun faux zéro quand les sources annexes échouent ». Le diff a été relu : la consultation demeure vérifiée ; l'attente incorrecte d'une liste vide après erreur est remplacée par des états indisponibles et des assertions de reprise. Aucun ancien cas ne disparaît sans remplacement examiné. Référence et différences brutes restent conservées dans les JSON, sans effacer ce renommage.

## Réserve de version et preuve ciblée

Les empreintes couvrent 1 485 fichiers, dont les tests d'audit. **Trois fichiers ont changé pendant la suite** : `CustomerProfile.tsx` (correction ponctuelle d'une valeur nullable), `customer-frontend-independent.test.tsx` et `run-frontend-audit.mjs` (complément de l'audit ciblé). Aucun autre fichier du périmètre empreinté n'a changé, été ajouté ou supprimé ; la configuration Vitest est restée stable. Le runner n'a pas été interrompu, conformément à l'instruction de coordination.

La preuve indépendante [frontend-independent.evidence.json](frontend-independent.evidence.json), exécutée de 06:26:50 à 06:28:02 UTC sur la correction, rapporte **46 tests réussis dans six fichiers**, avec entrées stables. Les 22 empreintes consignées et celle du journal ont été comparées aux fichiers finaux : elles correspondent toutes, notamment `CustomerProfile.tsx` et la suite d'audit modifiés. Ce complément couvre le delta testé ; **il ne transforme pas la suite globale en exécution sur un arbre entièrement figé**. Les deux preuves doivent être lues ensemble.

Preuves : [JSON Vitest](decouverte-tests-vitest.json), [journal brut](decouverte-tests-vitest.log), [exécution et code de sortie](decouverte-tests-execution.json), [référence](decouverte-tests-reference.json), [comparaison et empreintes](decouverte-tests-comparaison.json). Ce résultat automatisé ne remplace pas les essais UI authentifiés, la persistance réelle ni les contrôles d'isolation encore requis.
