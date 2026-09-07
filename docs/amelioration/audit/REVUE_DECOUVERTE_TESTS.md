# Audit indépendant de la découverte des tests

Date : 7 septembre 2026. Portée : changement de `vitest.config.ts` ajoutant uniquement `backups/**` aux exclusions par défaut de Vitest.

Le premier rapport global ne constitue pas une réussite globale : `vitest-application.json` à 05:42 UTC contient 2 862 assertions réussies, mais `numFailedTestSuites = 1` et `success = false`. Un fichier d’archive ne pouvait pas résoudre ses imports. Le nombre d’assertions vertes ne doit pas masquer cet échec de découverte/import.

La correction examinée conserve `configDefaults.exclude` et ajoute seulement `backups/**`. Les dossiers applicatifs, fonctions Supabase et tests indépendants de `docs/amelioration/audit` ne sont pas exclus.

L’inventaire [decouverte-tests-inventaire.json](decouverte-tests-inventaire.json) recense 31 copies d’archives et leurs sources canoniques. L’auditeur a recalculé les SHA-256 des deux chemins de chaque paire : **31 sources présentes, 31 paires identiques, aucune source absente, aucune différence** lors de ce contrôle. Il s’agit de ne plus redécouvrir des copies historiques, et non de retirer un scénario applicatif parce qu’il échoue. Ce constat ne prouve pas le passage des tests canoniques : leur exécution complète demeure une porte distincte.

Après modification, un nouveau rapport de suite complète doit confirmer les fichiers réellement découverts, les nombres d’assertions, les éventuels échecs/skips et `success`. Les anciens rapports à `success=false` restent des éléments historiques et ne doivent pas être présentés comme la preuve de la candidate actuelle. Les nouveaux cas d’audit ajoutés depuis leur génération changent aussi le nombre attendu de tests.

Cette revue ne déclare pas la suite globale réussie et n’attribue aucun point de recette UI/persistance.
