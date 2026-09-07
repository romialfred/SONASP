# Reprise de recette sur la base en ligne autorisée

7 septembre 2026 — audit indépendant, préparation sans navigateur ni écriture en base.

## Autorisation et portée de cette révision

L'utilisateur a explicitement indiqué que la base en ligne est une base de test et autorisé son utilisation. Cette instruction remplace la qualification antérieure de cette cible comme production interdite à la recette. **Il n'est pas nécessaire d'obtenir une autre préproduction ni une nouvelle autorisation générale d'écrire pour poursuivre sur cette cible.** Les anciens constats décrivent leur contexte historique ; ils ne doivent pas continuer à bloquer l'exécution au seul motif de l'URL distante.

Le runner `environnement/preflight.mjs` classe encore le project-ref connu comme `production` par constante. Ce classement technique historique ne contredit pas l'autorisation donnée. Le prochain rapport doit distinguer l'identifiant de la cible, la déclaration du commanditaire et la disponibilité réellement observée des accès. Un seul blocage effectivement rencontré — par exemple compte requis inaccessible, MFA non disponible ou contrat réel incompatible — doit être consigné à l'étape concernée. Aucun de ces problèmes n'est présumé ici.

Les jeux d'essai restent identifiés et séparés des autres dossiers présents par leurs UUID et un identifiant de run. Les secrets, jetons, codes TOTP et documents étrangers au run ne sont pas collectés dans les preuves. RLS, MFA, sessions et capacités existants restent appliqués.

## Préflight à rapprocher du contrat audité

La migration candidate est `20260907044811_enregistrer_dossier_client_atomique.sql`, SHA-256 `0b87f4df5de4e59c7c7252550018c92d923d978f356289109c142b417c31cb0f`. Les tests embarqués et leur audit sont décrits dans `REVUE_BACKEND_CLIENTS.md`. Ils ne démontrent pas l'état de la cible distante.

| Point | Contrôle déjà présent | Preuve minimale attendue sur la cible autorisée |
|---|---|---|
| Cible et version | Configuration locale et empreintes du lot | Frontend effectivement servi, commit/build, backend réel correspondant à la cible autorisée ; absence de transport fixture et de sauvegarde simulée |
| Fonctions prérequises | Existence de `auth.uid`, `snp_est_agent_sonasp`, `snp_session_est_active` | Définitions et dépendances effectivement installées, dont capacité et MFA ; comparaison avec le contrat source, sans remplacer les helpers pour faire passer les tests |
| Tables/colonnes | Existence des colonnes clients et banques | Types, nullabilité, defaults UUID/dates, précision/échelle numérique, contraintes uniques/CHECK, triggers actifs, grants et RLS ; la fixture PGlite n'est pas leur source d'autorité |
| Privilèges | RLS active et absence de CREATE public pour anon/authenticated | Policies et privilèges avant/après ; aucune policy permissive ajoutée, désactivation RLS ou élévation de rôle pour la recette |
| Relations bancaires | Requête des FK dans `clients-verification.sql` | FK réellement présentes, actions ON DELETE/UPDATE, trigger du compte principal ; IDs et liens aval du jeu de test relus avant/après |
| Migration | Transaction, préflight et postflight intégrés | État avant application, éventuelle définition précédente du RPC, sortie réelle, version/hash appliqués et transaction terminée ; aucun reset ni réparation générale de l'historique pour ce seul ajout |

Le préflight actuel vérifie essentiellement présence et permissions structurelles. `clients-verification.sql` complète la lecture RLS/RPC/FK mais ne vérifie pas encore tout le détail des types, defaults, triggers et helpers. La simple absence d'erreur du préflight ne doit pas être appelée compatibilité exhaustive.

Le postflight de la migration attend SECURITY INVOKER, exécution refusée à anon et accordée à authenticated. Vérifier également la signature de retour UUID, le `search_path` attendu et la disponibilité effective de la fonction via PostgREST après rechargement du cache. Un succès SQL d'installation ne prouve pas l'appel HTTP. Comparer les policies/grants/triggers des tables avant/après : ils ne doivent pas être modifiés par cette migration additive.

## Contrats d'accès à tester sans les élargir

- Le RPC exige un utilisateur Auth, `snp_est_agent_sonasp()` vrai et une session active. Le helper source reconnaît exactement `sonasp.prepare`, `sonasp.approve`, `sonasp.finance.execute`, `sonasp.finance.reconcile`. Les capacités sensibles dépendent du contrôle MFA existant ; examiner ses définitions réellement installées.
- La route UI de création/édition Clients est plus étroite : compte SONASP/management et `sonasp.prepare`, sous réserve des gardes administrateur/Owner réellement présents. Un thème Administrateur n'est pas à lui seul une habilitation d'écriture.
- Les politiques SELECT des référentiels `customers` et `customer_banks` autorisent actuellement la lecture pour authenticated. Une lecture intersociétés prévue par ce contrat ne doit pas être présentée comme une fuite ni rendue artificiellement interdite. Les ventes, paiements et actions conservent leurs règles propres.
- Tester séparément UI et API avec les comptes de test réellement disponibles : cas habilité AAL2, rôle sans capacité, AAL1, compte inactif et session révoquée selon les mécanismes existants. Un compte de test ne doit pas être transformé en Owner pour contourner une difficulté d'accès.
- Une lecture SQL administrative peut établir les valeurs persistées. Elle ne prouve jamais les droits du compte utilisateur. Les appels servant de preuve d'autorisation doivent porter sa vraie session et ne pas utiliser `service_role`.

## Chaîne minimale recevable du pilote

Réutiliser les IDs `CLI-UI-001` à `CLI-UI-012` du plan et de 05 ; ne pas créer un second jeu d'IDs contradictoire. Chaque exécution possède un ID de preuve et un run distincts.

| Étape réelle | Preuve à conserver | Invariant contrôlé |
|---|---|---|
| Préparer le run | Cible autorisée, version servie, alias des acteurs/organismes de test ; références du jeu et lecture initiale ciblée | Aucun dossier préexistant confondu avec une création de ce run |
| Connexion et entrée | Parcours Auth/MFA, niveau obtenu, compte/capacités observés, route depuis le menu Clients | Session réelle et actions accessibles selon droits existants |
| Saisie complète | Valeur attendue de chacun des dix champs client et huit types de champs pour chacune des deux banques ; capture après saisie | Types de champs distincts de leur nombre d'occurrences ; nom libre complet, crédit zéro et champs facultatifs inclus |
| Enregistrer depuis l'UI | Action réellement effectuée, statut HTTP et UUID retourné, message UI ; aucune clé/token dans la trace | Un seul client et deux banques, pas un succès fixture ni une insertion directe remplaçant l'UI |
| Lire la base | Requête ciblée sur l'UUID retourné ; valeurs/IDs client et banques, dates et flags ; comparaison champ par champ | Même UUID et rattachements, normalisations attendues, zéro préservé, au plus une banque principale |
| Détail et rechargement | Fiche ouverte, URL/UUID, capture des données puis rechargement et nouvelle lecture effective | La fiche provient de la persistance et non du seul état React |
| Liste et retour | Recherche du dossier exact, filtres, pagination, détail puis retour | Ligne retrouvée, contexte conservé, compteurs cohérents sans doublonner les banques |
| Modification | Édition ouverte sans ressaisie initiale, changements documentés de chaque champ, sauvegarde UI et relecture DB | IDs des banques conservées inchangés ; champs non modifiés conservés ; décimales et valeurs historiques relues |
| Retrait d'une banque | Avant/après de la banque et de ses relations de paiement/prévente de test | `is_active=false`, `is_primary=false`, même UUID et FK historique intacte ; absente des nouvelles sélections qui exigent une banque active |
| Erreurs et droits | Erreurs locales/API réellement provoquées et absence d'écriture, correction puis reprise ; contexte A/B | Aucun faux zéro, aucune perte du formulaire, aucune réaffectation bancaire ni succès après échec |
| Nettoyage | Liste fermée des UUID créés, dépendances découvertes, ordre de retrait, relecture après suppression | Seuls les objets du run retirés ; preuves conservées ; aucune suppression large par préfixe ni restauration globale de la base partagée |

Les captures doivent couvrir liste, formulaire renseigné, erreurs, sous-formulaire bancaire déplié et détail sur les dimensions prévues par le plan, ainsi que le zoom navigateur réel. Elles complètent les données relues ; elles ne les remplacent pas. Les captures de fixtures antérieures ne deviennent pas des preuves de ce run.

## Points d'intégrité à surveiller spécialement

1. **IDs/FK** : modifier en place, ne pas supprimer/réinsérer les banques ; retrait logique et historique consultable. Toute donnée aval préparatoire doit appartenir au même jeu de test et sa méthode de création être déclarée séparément.
2. **Normalisation** : email trim/minuscules, champs bancaires facultatifs vides → NULL, pays/devise/conditions historiques conservés comme valeurs API. `status` et `payment_terms` explicitement NULL sont autorisés ; ne pas étendre cette garantie à toutes les chaînes sans vérifier leur normalisation existante.
3. **Précision et agrégats** : zéro distinct de NULL/échec ; centimes visibles, pas de somme entre devises différentes ou montants inconnus. Rapprocher les ventes effectivement accessibles, leur statut et leur devise, sans injecter des transactions fixtures dans la preuve réelle.
4. **Atomicité** : un refus doit laisser parent, banques, flags et dates inchangés. Pour démontrer une erreur enfant après écriture parent, préférer une contrainte réelle de la cible et un jeu dédié. Ne pas installer un trigger de panne global sur une base partagée. Si une injection spécifique est nécessaire, faire relire séparément son périmètre exact et son retrait ; un simple rejet de validation avant toute écriture ne prouve pas ce sous-cas d'atomicité.
5. **Concurrence et réponse perdue** : double clic, latence et changement de contexte ; deux sessions si disponibles. Le RPC n'a pas de clé d'idempotence ni de version attendue. Le verrou SQL sérialise les appels mais n'empêche pas, à lui seul, l'écrasement d'une édition ancienne par une seconde session. Ne déclarer ces propriétés ni garanties ni testées avant leur observation.
6. **Périmètres** : ID bancaire d'un autre client refusé sans effet sur les deux dossiers ; ancienne réponse ignorée après changement de route/rôle/organisme. Les vérifications SQL administratives restent distinctes des refus API sous session utilisateur.

## Acceptation des futures preuves

Utiliser `MODELE_PREUVE.json` avec IDs de scénario/critères, date UTC, cible, version, acteur, étapes attendues/observées, UUID, valeurs relues, artefacts et hashes. La déclaration de test du commanditaire est la référence actuelle d'autorisation de cible ; elle ne doit pas être remplacée par une prétendue création d'une nouvelle préproduction.

Chaque sous-cas passe à RÉUSSI uniquement après ses assertions réelles et la revue indépendante. Les sous-cas sans compte, accès ou donnée requis restent explicitement à exécuter, avec la cause observée. Le nettoyage est attesté séparément de la création. La réussite du pilote ne valide pas automatiquement les autres portails/modules et ne donne pas à elle seule l'autorisation de clôturer la mission intégrale.
