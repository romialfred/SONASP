# Pilote Clients : plan de recette et preuves attendues

Plan préparé par l’agent d’analyse métier/architecture, le 7 septembre 2026. **Aucun scénario de ce document n’a été exécuté dans l’interface par cet agent.** Il ne délivre aucune note de recette.

Baseline observée : `83f8c74ea83c81a2734ef9e086c2edd211573ebe`. Les sources de la matrice `03_MAPPING_FORMULAIRES_CHAMPS_TABLES.csv` sont figées sur ce commit. La migration candidate `20260907044811_enregistrer_dossier_client_atomique.sql` est citée séparément et identifiée par son SHA-256 dans la matrice ; son existence ne prouve ni application ni validation. Les corrections du frontend, en cours parallèlement, devront faire l’objet d’une relecture de correspondance avant exécution.

## Périmètre et IDs à conserver

| Objet | ID | Route/composant |
|---|---|---|
| Liste | `ECR-fb78963058ff` | `/customers` |
| Création | `ECR-57a476684b9a` | `/customers/new` |
| Modification | `ECR-90c316e4268e` | `/customers/:id/edit` |
| Détail | `ECR-4c59694d6d6f` | `/customers/:id` |
| Ancien raccourci paiement | `ECR-749eeaf88235` | `/customers/:id/payments` → `/payments/create` à la baseline |
| Formulaire parent | `FRM-d203fedbc345` | `CustomerForm` |
| Sous-formulaire bancaire | `FRM-3b57c7a1b9b7` | `BankAccountForm` |
| Composant liste | `CMP-2215414cf191` | `CustomerListing` |

Les 10 champs client sont : raison sociale, email, téléphone, contact, pays, identifiant fiscal, adresse, conditions de paiement, limite de crédit et statut. Les 8 champs bancaires sont : pays, ville, nom de banque, devise, numéro de compte, IBAN, SWIFT/BIC et indicateur principal. La saisie « Autre banque » est une variante du nom de banque, pas une donnée métier supplémentaire. Les IDs, rattachements, états de collection et dates système sont contrôlés en base sans créer de champs utilisateur artificiels.

## Environnements et niveau de preuve

| Niveau | Conditions | Ce qu’il peut démontrer | Ce qu’il ne démontre pas |
|---|---|---|---|
| Lecture du code et du schéma | Baseline et types locaux | Mapping, contraintes déclarées, chemins, anomalies statiques | Saisie, persistance réelle, permissions effectives |
| Tests de composants | Vitest/Testing Library avec contrats simulés | Validation locale, sérialisation, transitions UI testées | Auth réelle, PostgREST/RLS live, fichiers, rendu navigateur réel |
| Tests SQL isolés | Moteur PostgreSQL/PGlite isolé et schéma représentatif | Atomicité et règles effectivement exécutées sur ce moteur | Connexion/MFA, contrat HTTP, saisie navigateur, contexte réel Supabase |
| Navigateur de présentation | Composants réels montés sur banc isolé, transport simulé et déclaré | Mise en page, focus, saisie locale, validations affichées, responsive | Persistance backend réelle, droits serveur, succès métier |
| Recette UI intégrée requise | Application candidate + Auth/API/base isolées, profils autorisés et inspection fiable | Chaîne session → saisie → écriture → relecture → détail/liste → modification | Ne vaut pas homologation ou audit de sécurité complet |

**Point d’arrêt actuel du lot :** aucun endpoint Auth/API de test isolé, aucun compte test MFA et aucun accès de lecture des données persistées n’ont été fournis à cet agent. Les scénarios qui dépendent de cette chaîne restent **NON EXÉCUTÉS** ; leur exécution est **BLOQUÉE à la connexion/persistance tant que l’orchestrateur n’a pas identifié cette cible**. Une page locale branchée sur le projet de production ne constitue pas une base de test isolée. Ne jamais y créer les clients ci-dessous.

La cible connue `sonasp.data-univers.com` et le projet Supabase de production ne sont pas des destinations de recette écrite. Le déploiement reste conditionné à la recette intégrée et à l’audit demandé par le maître.

## Préparation indépendante obligatoire

1. Enregistrer commit candidat, état des fichiers, hash build et migration exacte ; vérifier qu’il s’agit bien de la version consolidée.
2. Identifier par URL/nom de projet la préproduction **isolée** et le dispositif de lecture en base. Conserver uniquement des références publiques, jamais des clés ou tokens dans les preuves.
3. Installer les migrations autorisées avec préflight/postflight. Vérifier l’exposition et le droit d’exécution de `save_customer_dossier(uuid,jsonb,jsonb)` et l’état RLS réel. Aucun grant large ni désactivation de MFA/RLS pour faciliter le test.
4. Préparer les profils de test sans inventer de rôles : agent SONASP `management` avec `sonasp.prepare`, un compte administrateur technique sans cette capacité métier, deux sociétés minières A/B, un client `customer` et un compte inactif/session révoquée. Ajouter le profil Owner si la matrice le requiert, sans lui attribuer automatiquement une capacité sensible.
5. Préparer des références isolées pour les ventes/paiements uniquement si elles sont nécessaires aux lectures aval. Ces données sont préparatoires : elles ne remplacent jamais la création du client par l’interface.
6. Confirmer le contrat réel de lecture : la migration `20260905000000_durcir_rls_clients.sql` conserve la lecture des référentiels `customers` et `customer_banks` à `authenticated`, tandis que les écritures exigent `snp_est_agent_sonasp()`. Ne pas inventer une propriété mono-tenant du référentiel global pour faire passer un test négatif. Les routes et actions restent plus restrictives que cette lecture SQL.
7. Réserver une session navigateur et un préfixe de données à l’exécutant QA. Sérialiser avec les autres agents ; aucune session partagée simultanément.

## Jeu d’essai proposé, exclusivement isolé

Remplacer `RUN` par la date UTC et un suffixe unique du lot. Les valeurs suivantes sont des données fictives de recette, jamais des données de production.

| Champ | Valeur A | Modification B |
|---|---|---|
| Raison sociale | `QA CLIENT RUN Alpha` | `QA CLIENT RUN Alpha modifié` |
| Email | `QA.CLIENTS.RUN@EXAMPLE.INVALID` | `qa.clients.run.modifie@example.invalid` |
| Téléphone | `+226 00 00 00 01` | `+226 00 00 00 02` |
| Contact | `Responsable QA Alpha` | `Responsable QA Beta` |
| Pays | `Burkina Faso` | Autre valeur existante dans `COUNTRIES` |
| Identifiant fiscal | `QA-IFU-RUN-A` | `QA-IFU-RUN-B` |
| Adresse | `Adresse de test RUN, quartier Alpha` | `Adresse de test RUN, quartier Beta` |
| Conditions de paiement | `Paiement à 30 jours` | `Paiement immédiat` |
| Limite de crédit USD | `0` | `1234.56` |
| Statut | `En attente` | `Actif`, puis `Inactif` pour la variante existante |
| Banque 1 | Banque existante proposée pour Burkina Faso | Modifier la ville, conserver son ID |
| Ville bancaire | `Ouagadougou QA` | `Bobo-Dioulasso QA` |
| Devise | `XOF` | `EUR` |
| Numéro de compte | `QA-000001-RUN` | `QA-000002-RUN` |
| IBAN | `QA000000000000000000RUN` | Autre valeur de test distincte |
| SWIFT/BIC | `QABANK01` | `QABANK02` |
| Principal | Banque 1 principale | Banque 2 principale |
| Banque 2 | `Autre` → `Banque de test RUN` | Retirer via l’interface dans un scénario distinct |

Le formulaire actuel ne valide pas un checksum IBAN, ni un format IFU national, ni une existence réelle de compte bancaire ; ne pas présenter ces données de test comme coordonnées valides auprès d’une banque. Si une contrainte existante nouvellement observée impose une autre forme, adapter le jeu d’essai et citer cette contrainte, sans inventer de règle.

## Scénarios à exécuter et à auditer

Tous les scénarios sont initialement **NON EXÉCUTÉS**. Le statut d’exécution et les preuves devront être enregistrés dans `05_PLAN_ET_RESULTATS_RECETTE.csv` par QA, puis examinés dans `07_AUDIT_QUALITE.md`.

### CLI-UI-001 — Création complète et dix étapes du protocole

1. Se connecter avec le compte SONASP autorisé, vérifier portail, organisation et menus.
2. Aller par navigation réelle à Clients → Ajouter un client.
3. Saisir les 10 champs A, puis ajouter deux banques et renseigner les 8 valeurs de chacune ; utiliser la variante banque libre pour la seconde.
4. Cliquer une seule fois sur Créer ; attendre la réponse réelle sans interpréter l’alerte seule comme preuve.
5. Conserver l’UUID client retourné et les UUID bancaires créés ; lire `customers` et `customer_banks` en lecture seule. Comparer toutes les valeurs de `03_MAPPING...`, les normalisations, la clé parent et l’unicité du principal.
6. Ouvrir le détail de **cet UUID** via la liste. Vérifier les 10 champs, banques, relations et le statut ; zéro doit être affiché comme zéro.
7. Recharger le détail et le rouvrir par URL directe ; les valeurs doivent provenir des données persistées.
8. Revenir à la liste, rechercher le préfixe RUN et vérifier ligne/compteurs/filtres.
9. Ouvrir Modifier, relire les valeurs sans saisie préalable, changer le contact, enregistrer et relire la base puis le détail.
10. Capturer liste, formulaire, détail, détail rechargé et preuve de relecture base du même UUID.

**Critère éliminatoire :** champ absent au détail, erreur masquée, banque manquante ou donnée non relue en base = scénario non réussi.

### CLI-UI-002 — Modification de chaque champ et conservation

Reprendre le client A. Modifier successivement les champs client et bancaires vers B, avec au moins une relecture après chaque groupe cohérent. Tous les champs de la matrice doivent être contrôlés. Vérifier que les autres champs et IDs ne changent pas. Contrôler explicitement `credit_limit=0` à l’ouverture, puis la valeur décimale `1234.56` persistée et affichée sans arrondi trompeur. Modifier une banque existante ne crée pas un nouvel UUID. `created_at`, `company` et `customers.is_active` ne sont pas remplacés arbitrairement.

### CLI-UI-003 — Validations client existantes

Cas distincts : nom vide/blanc ; email absent/invalide ; téléphone absent ; contact absent ; pays vide ; adresse vide ; crédit vide/non numérique/négatif ; crédit zéro accepté ; espaces et casse normalisés ; taxId facultatif vide. Pour chaque cas invalide, vérifier erreur française près du champ, focus utile, absence d’écriture, conservation des autres valeurs et nouvelle soumission possible après correction. Tester les trois statuts et cinq conditions de paiement existants sans inventer une approbation client absente du formulaire.

### CLI-UI-004 — Validations bancaires et retrait avant enregistrement

Ajouter une banque, laisser chacun des quatre champs requis vide à tour de rôle : pays, ville, nom, devise. Vérifier refus sans écriture parent/enfant. Tester les champs facultatifs vides → null. Ajouter puis retirer un compte avant soumission : aucune banque fantôme. Basculer principal A→B, retirer le principal et contrôler la règle UI existante de transfert. Si l’utilisateur décoche tout principal, vérifier le contrat actuel « au plus un », sans exiger artificiellement « exactement un ». Vérifier création sans banque selon contrat autorisé ; l’aide « au moins une » et l’absence de contrainte doivent être harmonisées sans inventer de règle.

### CLI-UI-005 — Banque libre, pays dépendant et saisie au clavier

Choisir un pays proposant une liste, choisir Autre, taper le nom complet (pas une seule lettre), enregistrer et rouvrir. Le nom personnalisé doit rester visible. Passer à un pays sans liste, saisir un nom libre, puis revenir à un pays avec liste ; aucune valeur invisible ou sentinel `__other__` ne doit être persisté. Tous les contrôles ont un nom accessible ; les groupes bancaires et suppression sont utilisables au clavier avec focus visible.

### CLI-UI-006 — Liste, recherche, filtres, navigation et totaux

Préparer au moins deux clients aux statuts/pays distincts. Rechercher nom et email, combiner pays/statut, tester résultat vide, réinitialiser, ouvrir un détail puis revenir. Vérifier les compteurs selon le périmètre déclaré, sans double comptage des banques. Inspecter les boutons Ajouter/Modifier avec chaque profil autorisé/interdit. Vérifier absence des progressions fictives `+3`, `+24 %`, `+8 %`. Tester les accents seulement selon la normalisation effectivement supportée ; ne pas déclarer cette fonction existante sans preuve.

### CLI-UI-007 — Banques référencées et atomicité

En base isolée, préparer un paiement/prévente existant qui référence la banque A du client de test. Par UI, modifier sa ville puis retirer cette banque dans un scénario séparé. Lire `payments.customer_bank_id` et/ou `pre_sales.customer_bank_id` : la référence doit rester valide et identique. La banque retirée devient inactive, sans suppression historique. Injecter un échec réel **dans la cible isolée** pendant l’écriture enfant : ni parent modifié seul, ni banque perdue, ni succès UI. Vérifier rollback complet. Une exception simulée uniquement dans Vitest n’est pas cette preuve d’intégration.

### CLI-UI-008 — Erreurs, latence, relecture et double soumission

Tester séparément : lecture client en erreur, lecture banques en erreur, lecture ventes en erreur, écriture refusée, latence longue, coupure réseau et reprise. Pas de faux vide/zéro, d’erreur SQL brute ni de formulaire vidé. Éditer rapidement deux clients A puis B sous latence : aucune réponse A tardive dans B. Double-cliquer et utiliser Entrée pendant la soumission : un seul dossier et un seul jeu de banques. Vérifier annulation/retour selon mécanisme de confirmation existant, sans quitter la session de l’utilisateur.

### CLI-UI-009 — Détail et ventes réelles

Le client sans vente affiche une absence explicite, jamais les ventes 2024 ni la courbe littérale de baseline. Avec références isolées liées au client, vérifier les UUID, numéros, dates, quantités, montants, statuts, liens de détail et agrégats. Les filtres de statuts de la liste et du détail doivent être cohérents ou clairement expliqués. Distinguer ratio d’états « paiement reçu » et ratio de montants effectivement payés. Cliquer chaque action existante : vente, paiement et contact email ; ne pas envoyer réellement un message externe pendant la recette. Un `console.log` ne valide aucune action.

### CLI-UI-010 — Droits et relations interdites

Tester accès direct création/modification pour profils non habilités, compte inactif, session révoquée, société minière et client. Refus côté serveur requis, pas seulement bouton caché. Contrôler qu’un utilisateur technique sans rôle métier ne reçoit pas une autorisation financière du seul thème Administrateur. Pour la RPC de modification, tenter d’attacher l’UUID bancaire d’un autre client de test : refus et absence de modification sur les deux dossiers. Tester identité client inexistante. Pour la lecture des référentiels globalement autorisés, documenter l’accès attendu plutôt que prétendre qu’une visibilité intersociétés prévue est une fuite.

### CLI-UI-011 — Design du parcours exécuté

Sur formulaire renseigné, sous-formulaire bancaire déplié, erreurs visibles, liste et détail réels : captures 360, 768, 1366, 1440 et 1920 px. Vérifier header/logo/sidebar, actions non recouvertes, colonne de contexte utile, tableaux dans leur conteneur et aucun défilement horizontal global. Vérifier zoom navigateur 200 % réel, clavier, labels, focus, modales et contraste. La capture avant saisie ne valide pas la mise en page des erreurs/banques. Ne pas considérer un viewport réduit comme preuve équivalente au zoom 200 %.

### CLI-UI-012 — Nettoyage limité et preuve conservée

Après audit des traces, vérifier la liste exacte d’UUID créés sous RUN et leurs relations. Supprimer seulement les objets de recette autorisés en base isolée, dans l’ordre compatible avec les FK, ou restaurer le snapshot isolé prévu. Aucun DELETE par préfixe ambigu et aucun nettoyage de production. L’UI n’offre pas de suppression du client à la baseline : ne pas inventer un bouton CRUD pour ce test. Conserver les preuves expurgées avant nettoyage.

## Contrôles navigateur possibles avant levée du blocage

Les scénarios suivants peuvent être exécutés sur un banc de **présentation** avec transport simulé, en les nommant `CLI-PRES-*` et en conservant la mention de simulation sur chaque capture :

- `CLI-PRES-001` : affichage des dix champs et deux groupes bancaires, labels et focus.
- `CLI-PRES-002` : saisie locale complète, affichage des validations, retour et valeurs préservées dans l’état local.
- `CLI-PRES-003` : sélection Autre, saisie du nom complet, changement de pays et compte principal.
- `CLI-PRES-004` : capture responsive et erreurs/chargement simulés sur liste, formulaire, détail.
- `CLI-PRES-005` : structure des onglets/actions/liens et rendu des données de fixture, sans affirmer leur provenance en base.

Ces contrôles ne font passer **aucun** `CLI-UI-*` à RÉUSSI et n’ouvrent pas le déploiement conditionnel. Ils permettent seulement de corriger des défauts visuels et de préparer l’exécution réelle.

## Dossier de preuve par scénario

Conserver : ID scénario et ligne(s) de mapping ; date UTC ; environnement isolé ; version/hash ; profil/capabilities et organisation de test sans secret ; route d’entrée ; valeurs d’essai ; étapes réellement effectuées ; UUID client/banques ; attendu/observé ; captures après saisie et après reload ; relecture SQL/API autorisée ; résultat ; nom de l’exécutant ; décision du réviseur indépendant. Toute modification ultérieure invalide les preuves des parcours concernés.

Une réussite de build, un test SQL, un succès RPC ou une capture seule ne peuvent remplacer la chaîne de recette UI. Le lot n’est clos que lorsque tous les critères applicables sont prouvés et audités.
