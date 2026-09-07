# Audit indépendant — lectures Collecteurs et Comptoirs

Date : 7 septembre 2026. Auditeur : `audit_independant`. Périmètre local, sans navigateur partagé, SQL distant, modification applicative, commit, push ou déploiement par l’auditeur.

## Avis borné

Le correctif de lecture est recevable techniquement sur la version décrite ci-dessous. Le rejeu indépendant obtient **78/78 tests sur 9 fichiers**, avec les 26 entrées suivies stables avant et après. Cette conclusion ne constitue ni une recette navigateur ni une validation de l’endpoint en ligne : l’ordre demandé au RPC `SETOF jsonb` doit encore être observé dans une session réelle autorisée.

Les formulaires de création/modification, les permissions et les migrations suivis dans ce lot ont conservé leurs empreintes. Il n’est pas affirmé que tous les workflows Collecteurs ou Comptoirs sont validés.

## Défaut supplémentaire découvert pendant l’audit

`COLL-CPT-SCOPE-001` : à utilisateur et URL constants, les deux pages conservaient les données de l’ancien organisme ou de l’ancien rôle d’accès. L’effet Collecteurs dépendait de `user.id`, mais pas des autres éléments du périmètre ; celui de Comptoirs dépendait seulement de la navigation. Une lecture ancienne différée pouvait donc rester la seule lecture prise en compte.

La reproduction indépendante est conservée dans `collector-comptoir-scope-independent.test.tsx` et `collector-comptoir-scope-before.json` : **4 échecs sur 4**, couvrant les deux registres, le changement d’organisation sans navigation et le changement de rôle avec une réponse tardive. Les anciens SHA des pages correspondent au manifeste initial de l’implémenteur.

La correction ajoute une frontière de composant par contexte complet : utilisateur, organisme, société minière, rôle d’accès, rôle, type d’organisme, activité, portail, catégorie, type de compte, capacités, modules, sites, responsabilités et domaines. Les listes sont triées avant sérialisation. Collecteurs inclut aussi l’ID de fiche. Au changement de contexte, l’ancienne instance est démontée, les états de liste et de délégation disparaissent immédiatement, et le nettoyage invalide les réponses de lecture tardives. Les quatre reproductions passent après cette correction. Le test de l’implémenteur sur la justification et l’échéance de délégation passe également.

Les quatre reproductions ne constituent pas un test combinatoire de chaque profil ou de chaque attribut d’accès. Les règles serveur restent l’autorité et n’ont pas été modifiées.

## Lecture du correctif

| Contrôle | Conclusion technique |
| --- | --- |
| Échec de chargement Collecteurs | L’erreur est distincte de l’absence vérifiée ; les compteurs, la liste et la fiche ne sont pas présentés comme un résultat vide confirmé. |
| Échec de chargement Comptoirs | Les compteurs non confirmés sont masqués ; les lignes sont retirées après échec et le tableau indique l’indisponibilité. |
| Reprise et réponses tardives | Le chargement courant est identifié ; un résultat antérieur ne remplace pas une réponse plus récente. Les cas de navigation et de changement de périmètre sont couverts. |
| Liste Collecteurs complète | Le même RPC de visibilité est appelé avec `count: exact`, une plage de 500 et un ordre incluant l’ID. Le helper avance du nombre effectivement reçu, y compris sous plafond serveur inférieur. |
| Réponse incohérente | Total absent ou changeant, page vide prématurée, doublon, ID invalide et réponse nulle sont refusés ; aucune première page partielle n’est déclarée complète. |
| Erreur RPC | La lecture traduit les erreurs structurées par le mécanisme existant ; elle ne renvoie pas directement le message SQL reçu. |
| Conservation fonctionnelle | Les deux formulaires, le registre d’accès et les deux migrations suivis ont les mêmes SHA que la baseline publiée. Les autres RPC du service n’ont pas été remplacés. |

Le client Supabase installé est réellement utilisé dans les tests de transport, avec `fetch` simulé sur `collector-fixture.invalid`. Les tests contrôlent le chemin RPC, le corps vide, la préférence de comptage, les offsets et l’ordre demandé. Ils couvrent 0, 1, 499, 500, 501, 1000, 1001 et 1500 résultats, ainsi qu’un plafond de 73. Le double HTTP ne prouve pas que le serveur trie réellement les homonymes.

Le nom `pgrst_scalar` est confirmé indépendamment dans le générateur SQL de [PostgREST v14.1](https://github.com/PostgREST/postgrest/blob/v14.1/src/PostgREST/Query/QueryBuilder.hs). Le plan d’appel construit également une lecture autour de la routine ([source officielle](https://github.com/PostgREST/postgrest/blob/v14.1/src/PostgREST/Plan.hs)). Cela étaye le choix technique des chemins JSON ; le cache local `rest-version` n’est pas une mesure actuelle du serveur et ces sources ne remplacent pas sa réponse.

## Preuves réexécutées et contrôlées

| Preuve | Résultat et portée |
| --- | --- |
| `collector-comptoir-scope-before.json` | 4/4 rouges avant frontière de contexte ; nouveaux cas écrits par l’auditeur. |
| `collecteurs-comptoirs-independent-20260907.evidence.json` et `.txt` | Première tentative interrompue par `ETIMEDOUT` après 180 secondes, 12:54:52–12:57:54 UTC. Aucun résultat global retenu ; journal conservé. |
| `collecteurs-comptoirs-independent-20260907-r2.evidence.json`, `.json`, `.txt` | Même sélection et mêmes assertions, délai d’exécution augmenté : 78/78, code 0, 13:02:01–13:04:35 UTC. SHA avant/après identiques. |
| `collector-comptoir-manifest-independent.json` | Comparaison locale exécutée : les 7 sources/tests, 5 fichiers préservés et 6 artefacts du manifeste final correspondent à leurs empreintes. |
| `../lot-artisanat/collecteurs-comptoirs/correction-scope-evidence.json` | 78/78, lint 0 et typecheck 0 publiés par l’implémenteur ; relecture documentaire, sans second lint/typecheck par l’auditeur. |

Le commit observé au début et à la fin du rejeu indépendant est `b654eb97a6aee6e05486767b0778c29c93aae2c6`, accompagné des changements locaux suivis par empreintes. Il ne suffit pas, à lui seul, à identifier le candidat.

SHA applicatifs :

- `CollectorsPage.tsx` : `d5b8981f93608a60cc081d98258b375fb8e63e19486983056c9fa67260790454`
- `ComptoirsPage.tsx` : `4decc33ba596568fc08c993f415b45a3b90e39b1a7fa134cd790557680bf1b74`
- `collectorService.ts` : `8b650d5ca91c1be6d831a5e5c9c8d79f786be90ea0071ca10e8d1b4b4da72bdc`

## Réserves qui restent ouvertes

1. **API réelle** : aucune réponse distante du RPC avec cet ordre et ce comptage n’est attestée par cet audit. Root doit la relier au build essayé et au contexte d’accès, sans divulguer de jeton. La recette UI/DB R02 du site ne valide pas ce RPC Collecteurs.
2. **Volumétrie concurrente** : les pages HTTP ne constituent pas un instantané transactionnel. Le helper détecte certaines incohérences ; une substitution de lignes conservant le total peut échapper aux contrôles.
3. **`COLL-CONTRACT-001`** : la forme complète du dossier JSON n’est pas validée. La pagination protège les tableaux et les ID, mais une propriété métier absente, telle que `identity` ou `site_ids`, reste un risque de rendu. C’est un constat existant, explicitement hors du correctif gelé, pas un incident distant reproduit.
4. **Workflows** : création, modification, pièces jointes, délégation et permissions multi-profils réelles ne sont pas déclarées validées. Les tests locaux des formulaires restent des simulations ; aucun dossier de test distant n’a été créé ou supprimé dans ce lot par l’auditeur.

Les 78 cas comprennent les quatre cas indépendants et les tests déjà présents : ne pas additionner ce résultat aux 73 ou 78 cas publiés par l’implémenteur comme s’il s’agissait de scénarios distincts. Aucun score global ni clôture de module n’est attribué.
