# Revue finale bornée — intégration R03 et nettoyage R02

7 septembre 2026. Vérification indépendante des preuves locales existantes, sans nouvelle suite de tests, navigateur, SQL, réseau, migration ou modification applicative. Les rapports précédents restent conservés.

## Avis

Les preuves de l’intégration technique locale R03 sont recevables : **2 938 assertions réussies sur 2 938 dans 366 fichiers**, sept portes terminées au code 0, fin Vitest `passed`, aucune erreur non gérée et sources stables. Le nettoyage R02 V2 est attesté pour **un site et ses deux responsables exacts**, avec préservation des données contrôlées hors manifeste. La capture 15 lève la réserve de visibilité du bouton de reprise Production sur ordinateur.

Ces conclusions ne certifient pas le fonctionnement intégral de tous les modules ou des permissions réelles. La modification d’un site, son AEA et les photos dans Storage distant restent explicitement non vérifiées dans le manifeste R02. Aucun déploiement n’est déduit de ces reçus.

## Intégration locale R03

Run du **14:00:05 au 14:18:37 UTC**, HEAD déclaré `5d0d29f9fc9cc20564298a9346f0a67c17387381`. Le runner `run-integration-locale.mjs` lance chaque commande dans un processus Node, capture les codes de fermeture et conserve stdout/stderr séparément.

La somme des résultats individuels donne bien 2 938 assertions, toutes `passed`. Les 366 fichiers du JSON correspondent à 366 modules de fin, tous `passed`, sans cas ignoré, pending ou todo. Le nombre de groupes de tests n’est pas présenté comme un nombre de fichiers. Le reçu de fin recueille `unhandledErrors: []`.

| Porte | Code capturé | Contrôle de preuve |
|---|---:|---|
| Tests Vitest | 0 | JSON, résultats individuels et reçu de fin cohérents |
| Couverture des types de base | 0 | Journal présent et empreinte conforme |
| TypeScript | 0 | stdout/stderr conformes au reçu |
| ESLint | 0 | stdout/stderr conformes au reçu |
| Contrôle des libellés français | 0 | Journal présent et empreinte conforme |
| Vérification de la source de build | 0 | Journal présent et empreinte conforme |
| Build Vite local | 0 | Sortie vers `node_modules/.cache/reprise-integree-r03` |

Les **14 empreintes stdout/stderr** des sept portes concordent. Les **1 628 entrées** du manifeste sont identiques avant/après le run et correspondent encore aux fichiers présents lors de cet audit. Le stderr des tests conserve des exceptions déclenchées par les tests ErrorBoundary ; le reçu de fin ne les classe pas comme erreurs non gérées.

La preuve antérieure `reprise-locale-suite-finale.json` à 2 870 assertions et le rapport du code de sortie 1 sont toujours présents. R03 constitue une nouvelle porte technique réussie ; il ne change pas rétroactivement ce résultat historique et n’en explique pas la cause.

## Nettoyage R02 V2

La première tentative V1 a échoué sur `ORDER BY t.id` dans une table à clé `vente_id`, avant les DELETE. La relecture après échec retrouve les mêmes données et le même schéma. La V2 diffère strictement par le remplacement des 28 ordres d’agrégats par `ORDER BY to_jsonb(t)::text COLLATE "C"` ; les deux instructions DELETE et les autres gardes sont conservées. Cette égalité des candidats a été recalculée localement.

Candidate appliquée : SHA256 `7420606a3828626d652dfd79887f89da1cfc90b3865478e1af520901743a5a73`. Le reçu d’exécution unique termine au code 0 à **16:00:19 UTC** ; le postflight READ ONLY termine au code 0 à **16:00:55 UTC**. Candidate, wrapper, SQL de postflight et empreintes des reçus concordent avec les fichiers conservés.

Différence recalculée entre les empreintes de lignes avant et après :

| Table | UUID supprimé |
|---|---|
| artisanal_sites | `d9f7160a-aadd-41d9-ad4d-c9f886d41e0c` |
| artisanal_site_assignments | `12bd6c4e-52f4-4e9d-a2aa-81e101ab5e12` |
| artisanal_site_assignments | `d585b8e2-8f0c-4acd-bb90-bfd03acd6a8c` |

Ces UUID sont exactement ceux du manifeste de recette. La comparaison de lignes des **10 tables détaillées** ne trouve aucun autre ajout, retrait ou changement. Les **14 tables** de l’agrégat hors manifeste ont les mêmes effectifs et empreintes avant/après ; le postflight confirme zéro parent et zéro responsable QA restant. Les deux DELETE renvoient respectivement 2 et 1 lignes.

Les trois lignes tierces observées auparavant sont toujours présentes avec leur empreinte antérieure au nettoyage : artisan `5a29b656-c992-4a84-91fa-eb6819121ebb`, artisan `be44ea0d-fb3b-4b02-88b4-cc6ccaf67c56`, carte `b0035b68-1fbb-45ef-a911-36a03d2e10e6`. Leur provenance reste indéterminée ; leur existence ne doit pas être attribuée à notre recette.

Les comparaisons excluent uniquement l’horodatage de collecte du baseline, qui doit changer entre deux lectures. Toutes les lignes, leurs empreintes, effectifs, métadonnées Storage et informations de schéma présentes dans les preuves restent comparées. Les métadonnées des trois buckets contrôlés et le schéma inspecté sont inchangés. Il ne s’agit ni d’une empreinte des fichiers binaires Storage, ni d’un inventaire exhaustif de la base, ni d’une nouvelle lecture du serveur par l’auditeur.

## Capture complémentaire 15

`15-production-erreur-sans-panneau.jpg` a été inspectée directement. Dans ce viewport **1280 × 720**, le message d’indisponibilité et le bouton « Réessayer » sont visibles intégralement. Le panneau du banc est replié en bas et ne les recouvre plus. Le DOM complémentaire concorde ; les deux SHA correspondent au manifeste mis à jour.

La réserve de la capture 07 est levée **pour la visibilité de cet état sur ordinateur**, grâce à cette nouvelle preuve. La capture 07 demeure historique. Les autres limites du rapport `REVUE_PIXELS_LECTURES_SITES.md` subsistent : viewport, banc mémoire, absence de preuve de page entière ou de permissions réelles.

## Manifest indépendant

`final-r03-r02-v2-independent.evidence.json` conserve les résultats recalculés, les sept portes, le périmètre exact du nettoyage, les vérifications des lignes tierces, la capture 15 et les SHA de **42 artefacts de preuve**. Le lecteur reproductible `verify-final-r03-cleanup-proof.mjs` utilise seulement les fichiers locaux et n’exécute aucune commande externe. Il a terminé au code 0. Aucun nouveau run global n’a été lancé par cet audit.
