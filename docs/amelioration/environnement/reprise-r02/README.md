# Reprise R02 — préparation des vérifications de persistance

Mission autorisée par l'orchestrateur après confirmation utilisateur d'une connexion Chrome sur `127.0.0.1:5192`. Cible existante : projet de test `SONASP_OPS`, référence `yyverzuhkdonjjuficor`. Aucune migration, écriture métier, changement de permission, publication Git ou déploiement n'est autorisé pour cet agent. Les créations sont faites par l'orchestrateur dans l'interface ; le lecteur attend leurs UUID.

## Résultat des lectures initiales

Le 7 septembre 2026 à 11:38 UTC, le préflight SQL a réussi avec `transaction_read_only=on`. Les dix tables attendues existent et disposent de RLS et du privilège SELECT pour `authenticated`. Les fonctions du dossier artisan, du site et du registre d'affiliations existent avec les arguments attendus. Les colonnes photos, catégorie de site, AEA, responsable et pièces sont présentes. Les trois buckets `artisanal-sites`, `artisanal-site-aea` et `artisan-dossiers` existent et sont privés.

La santé Auth retourne HTTP 200. L'index REST interrogé avec la seule clé publique, sans session utilisateur, retourne 401 ; ce résultat ne teste pas la session connectée de Chrome. Aucun token du navigateur n'est extrait ou utilisé ici. La présence d'un privilège SELECT ne certifie pas l'acceptation RLS d'un compte réel.

Le registre d'affiliations est exposé par la RPC `snp_lister_affiliations(uuid)` et non par une nouvelle vue. Sa définition lit `snp_cartes_professionnelles`, applique `snp_affiliation_readable` et produit le contrat via `snp_affiliation_card_json`. La définition actuelle expose les informations du titulaire/site, droits, statut effectif, dates, jours restants et rendu attendus par `AffiliationCard`. Ces définitions ont été inspectées ; aucun appel métier de la RPC n'a été exécuté sans contexte Auth.

## Référence avant nouveaux dossiers

`baseline-before.json` contient les comptes et empreintes par UUID des données existantes, dans un snapshot `REPEATABLE READ READ ONLY` :

| Table | Lignes |
|---|---:|
| artisanal_sites | 9 |
| artisanal_site_assignments | 18 |
| snp_artisans_miniers | 64 |
| snp_cartes_professionnelles | 25 |
| snp_artisan_moyens_paiement | 31 |
| snp_artisan_responsables | 0 |
| snp_artisan_documents | 0 |
| snp_adhesion_baremes / droits / encaissements | 0 chacune |
| Objets des trois buckets concernés | 3 |

Les lignes existantes sont représentées par identifiants et empreintes ; leurs noms, coordonnées, documents et jetons de carte ne sont pas extraits. Pour Storage, les chemins existants sont hachés et le contenu binaire n'est pas téléchargé. L'empreinte des métadonnées n'est pas une preuve du contenu binaire d'un fichier. Le champ historique `content_md5` du relevé `baseline-before.json` désigne uniquement ces métadonnées (bucket, nom, metadata, propriétaire, dates) ; ce relevé et son SQL exécuté sont conservés sans modification. Les nouvelles relectures ciblées utilisent le nom explicite `metadata_md5`.

## Exécution séquentielle obligatoire

`run-readonly.mjs` vérifie la référence liée, le chemin SQL dans ce dossier, l'en-tête de transaction en lecture seule et le `ROLLBACK` final. Il refuse l'écrasement d'une preuve et utilise un verrou local empêchant deux lectures simultanées. Le CLI configuré est réutilisé ; aucun secret n'est imprimé. Chaque tentative reçoit son reçu daté, son code de sortie et le SHA256 du SQL.

Ne pas lancer d'autre commande SQL CLI en parallèle : des rotations de connexion concurrentes ont causé des erreurs de connexion lors de la première recette. Ne jamais appliquer une migration pour permettre ces lectures.

## Relecture après réception d'un UUID de l'interface

Le nom du site ou le nom/raison sociale de l'artisan doit commencer par **QA20260907-R02**. Le script refuse tout autre préfixe ou UUID mal formé. Il prépare seulement le SQL ; il ne crée ni ne modifie aucun dossier.

```powershell
node docs/amelioration/environnement/reprise-r02/prepare-dossier-read.mjs site <UUID-fourni-par-interface> creation
# Exécuter ensuite uniquement la commande run-readonly affichée.
node docs/amelioration/environnement/reprise-r02/prepare-dossier-read.mjs artisan <UUID-fourni-par-interface> creation
```

La sortie comprend le parent, les enfants propres au dossier, les comptes de références FK vers cet UUID et les métadonnées des objets Storage rattachés. Les images inline/URL externes sont expurgées, leurs empreintes conservées ; les jetons de vérification, numéros de sécurité et URLs de carte ne sont pas extraits. Les éventuels enfants supprimés logiquement restent visibles dans la preuve SQL, contrairement aux vues filtrées de l'interface.

L'orchestrateur fournit le type et l'UUID exacts créés dans l'interface ainsi que les valeurs réellement saisies dans un fichier attendu, par exemple `{"kind":"site","id":"UUID-fourni-par-interface","parent":{"name":"QA20260907-R02-site"},"assignments":[{"role":"site_manager","full_name":"..."},{"role":"collection_officer","full_name":"..."}]}`. Le comparateur refuse l'absence ou la différence du type/UUID. Il vérifie les champs explicitement fournis ; les tableaux exigent le même nombre d'éléments et une correspondance unique de chaque élément. Il ne prétend pas avoir vérifié un champ absent des attentes.

```powershell
node docs/amelioration/environnement/reprise-r02/compare-dossier.mjs <relecture.json> <attendu.json> <preuve-comparaison.json>
```

## Préservation des données antérieures

Après les étapes UI, rejouer `baseline.sql` avec un **nouveau label**. `compare-baseline.mjs` compare chaque UUID antérieur, signale disparition ou modification, et distingue les nouvelles lignes autorisées des ajouts non attribués. Un manifeste peut contenir `runPrefix`, `entities` (table vers liste d'UUID QA constatés) et `storageObjects` (UUID d'objets QA constatés). Sans manifeste, tout ajout est signalé à attribuer ; il n'est jamais supposé automatiquement lié à la recette.

```powershell
node docs/amelioration/environnement/reprise-r02/run-readonly.mjs baseline.sql baseline-apres-etape
node docs/amelioration/environnement/reprise-r02/compare-baseline.mjs <baseline-before.json> <baseline-apres-etape.json> <preuve-integrite.json> <manifeste-QA.json>
```

La création réelle du site R02 et de ses deux responsables a été comparée aux valeurs saisies : 18 champs parent et deux contacts conformes. Les photographies, l’AEA et la modification restent non vérifiées.

## Tentative de nettoyage du 7 septembre 2026

Après autorisation séparée du principal, le candidat SHA256 `3da1169b8d0497d277c12aed2715bbca099c096692d0ac520a55fd2161238650` a été tenté une seule fois à 15:50 UTC. Il a échoué **avant les DELETE** lors du calcul des empreintes de préservation : `42703 column t.id does not exist`. Le générateur supposait à tort que chacune des tables supplémentaires avait une colonne `id` ; `snp_artisan_vente_site_origins` possède une clé `vente_id`.

La relecture `cleanup-apres-echec.json` à 15:51:30 UTC confirme le site et les deux responsables toujours présents et inchangés, toutes les lignes de la baseline, les dépendances, le schéma et les métadonnées Storage identiques au préflight. Voir `cleanup-echec-verification.json`. Le nettoyage **n’est pas terminé**. Aucun retry ni desserrement des gardes n’a été effectué. Le candidat et le reçu échoué sont conservés ; une correction nécessite une nouvelle revue et une instruction distincte avant toute autre tentative.

La V2 a ensuite été préparée sur instruction du principal : seuls les ordres des agrégats hors manifeste utilisent le contenu JSON complet avec collation `C`, sans dépendance au nom de clé. Les UUID, hashes des trois lignes, gardes, verrous et DELETE sont inchangés. Le bloc complet des gardes et les expressions before/after ont été exécutés en `READ ONLY`, puis le postflight complet également : codes 0, quatorze tables calculées, site et deux responsables présents, baseline/schéma/Storage inchangés. Voir `cleanup-validation-v2.evidence.json` et `cleanup-plan-v2.json`. Ces contrôles ont précédé la nouvelle revue et l’instruction distincte du principal.

## Nettoyage terminé et vérifié à 16:01 UTC

La V2 SHA256 `7420606a3828626d652dfd79887f89da1cfc90b3865478e1af520901743a5a73` a été exécutée **une seule fois** après cette instruction, de 16:00:08 à 16:00:19 UTC, code 0. `cleanup-result-v2.json` confirme les comptes exacts de deux responsables et un site supprimés. Le postflight distinct `cleanup-postflight-v2-apres-delete.json` en `READ ONLY` a réussi ; `verify-cleanup-v2.mjs` confirme l’absence des trois UUID, la disparition exacte de ces lignes dans la baseline, les quatorze tables hors manifeste inchangées, le schéma et les métadonnées Storage préservés. Les trois changements tiers antérieurement signalés sont conservés, sans rétablissement d’anciennes valeurs.

Preuve finale : `cleanup-verification-v2.json`. Les reçus V1 et sa relecture d’absence de mutation restent disponibles. Aucune migration, modification Auth, mutation Storage ou suppression supplémentaire. Le nettoyage clôt la **recette de création** R02 ; modification, AEA et photos distantes restent non vérifiées. Les hashes Storage désignent les métadonnées, pas les octets des fichiers.
