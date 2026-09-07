# R02 — revue indépendante du protocole de recette

7 septembre 2026. Lecture des fichiers locaux seulement ; aucune connexion SQL distante, écriture applicative, migration ou interaction navigateur par l'auditeur.

## Éléments relus

Sous `docs/amelioration/environnement/reprise-r02` : `health.json`, `preflight.sql/.json/.execution.json`, `functions-readonly.sql/functions.json`, `affiliation-contract.sql`, `baseline.sql`, `baseline-before.json/.execution.json`, `prepare-baseline.mjs`, `prepare-dossier-read.mjs`, `run-readonly.mjs`, `compare-dossier.mjs`.

Le préflight déclare `transaction_read_only=on` ; les reçus préflight/baseline portent exit0. La santé HTTP montre Auth200 et REST401 sans authentification : service joignable, pas preuve d'un accès métier. Baseline : 9 sites, 64 artisans, 25 cartes, 31 moyens de paiement ; trois métadonnées d'objets Storage. Ce sont des compteurs de référence, pas un nombre de formulaires validés.

## Garde-fous recevables

- Cible Supabase liée explicitement vérifiée par l'opérateur ; fichier SQL borné au répertoire R02, label limité, verrou exclusif local pour éviter deux CLI concurrents.
- Scripts examinés en transaction READ ONLY, timeout borné, ROLLBACK final. L'auditeur n'a pas lancé ces scripts ; l'opérateur reste le seul lecteur distant.
- Lecture de dossier préparée seulement avec type site/artisan, UUID strict et préfixe `QA20260907-R02`. Le SQL exige à la fois l'UUID et un nom du RUN ; aucune recherche libre dans les données de tiers.
- Comptage des références par clés étrangères observées au préflight. Les projections de carte excluent les jetons ; les URLs inline/externes du parent sont expurgées. Les informations restent celles du seul dossier QA désigné.
- Comparateur : tableaux de cardinalité exacte, association sans réutilisation et correspondance unique ; un appariement ambigu échoue. Les reçus et comparaisons existants ne sont pas écrasés.

Ces protections encadrent les SQL relus. Le contrôle textuel BEGIN/ROLLBACK du runner n'est pas un parseur général de SQL arbitraire ; tout nouveau SQL doit être relu avant exécution. Aucun nouveau script de mutation n'est autorisé par cette revue.

## Corrections de preuve transmises à l'opérateur

1. Dans le snapshot relu, `compare-dossier.mjs` exige des champs parent mais ne rend pas obligatoires `expected.id` et `expected.kind`. Les exiger puis les comparer empêche un résultat positif attribué au mauvais dossier du même RUN. Les attendus doivent rester ceux de la saisie UI, pas être recopiés depuis la réponse SQL.
2. Les champs nommés `content_md5` sont calculés à partir de JSON de métadonnées Storage (et, dans la baseline, des attributs de l'objet). Ils ne hachent pas les octets du fichier. Renommer/qualifier comme empreinte de métadonnées ; l'affichage réel ou une empreinte du fichier téléchargé reste une preuve distincte.

Ces remarques ne bloquent pas la préparation/lecture du UUID exact que le navigateur aura créé. À cette revue, aucun UUID R02 n'était fourni à l'auditeur et aucun scénario R02 n'est déclaré réussi.

Relecture locale après ajustement de l'opérateur : le comparateur exige désormais UUID valide et type du dossier, compare ces deux valeurs avant le contenu, et la projection dossier nomme l'empreinte Storage `metadata_md5`. Les deux remarques sont traitées pour les futures lectures. La baseline historique conserve son ancienne clé `content_md5` ; sa signification reste strictement celle d'une empreinte de métadonnées. Aucun reçu historique ni résultat réel n'est remplacé par cette précision.

## Conditions pour auditer les prochains résultats

1. Manifeste UI : build/hash des sources, URL, contexte utilisateur/organisation/MFA constaté sans extraire de jeton, RUN et étapes saisie→soumission→message obtenu→UUID réellement ouvert.
2. Attendus indépendants et complets des champs saisis, contacts, catégorie/AEA, photos/documents et moyens de paiement concernés. Séparer valeurs automatiques attendues des champs non saisis.
3. Lecture SQL exacte ; comparaison parent/enfants, clés et références Storage. Puis rechargement réel de la route/liste et constat visuel des valeurs enregistrées.
4. Édition UI puis nouvelle lecture SQL : mêmes IDs/created_at pour les entités existantes, seules modifications prévues. Une réussite de dépôt Storage seule ne vaut pas sauvegarde du dossier.
5. Pour l'affiliation, distinguer dossier/émission/droit/encaissement/activation. Une ligne de carte générée ne démontre ni paiement, ni carte active, ni éligibilité dans une vente. Chaque transition revendiquée nécessite sa propre preuve.
6. Nettoyage uniquement après autorisation et inventaire précis des dépendances ; jamais relâcher les triggers ou RLS pour supprimer une fixture. Conserver les traces d'audit légitimes attendues. Comparer la baseline hors RUN et les références externes avant/après ; investiguer une divergence sans la corriger arbitrairement.

**Avis : protocole de lecture bornée recevable avec les deux précisions ci-dessus ; recette R02 en attente de parcours et de preuves. Les preuves SQL de persistance ne remplacent pas un test d'accès Auth/RLS, et les hashes de métadonnées ne prouvent pas l'intégrité binaire des documents.**
