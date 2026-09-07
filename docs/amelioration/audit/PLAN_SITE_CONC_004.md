# SITE-CONC-004 — proposition concrète de protection des éditions concurrentes

Date : 7 septembre 2026. Auteur : audit indépendant. **Plan non implémenté, sans migration canonique créée ni commande SQL distante exécutée par l'auditeur.** La recette R02 en cours ne donne pas, à elle seule, autorisation d'appliquer ce changement de contrat.

## Défaut et périmètre

Deux utilisateurs ouvrent la même fiche. A modifie son nom et un responsable puis enregistre. B enregistre son ancien formulaire : l'UPSERT remplace silencieusement les changements de A. La transaction actuelle garantit l'atomicité, pas la détection de cette concurrence.

Le contrat distant relu dans `environnement/reprise-r02/functions.json` expose `snp_save_artisanal_site(jsonb,jsonb)`, SECURITY INVOKER, avec le contrôle existant `snp_peut_gerer_sites_artisanaux()`. Le MD5 de sa définition du préflight est `373f1c8c87555647b7fb041dfadb25ee`. Les deux tables ont un trigger BEFORE UPDATE appelant `set_artisanal_site_updated_at()` ; chaque ligne est horodatée séparément par `now()`. Aucun trigger observé sur les responsables ne touche le parent.

Le formulaire n'envoie pas `ArtisanalSite.updatedAt`. `saveSite` choisit actuellement un nouvel UUID à chaque appel de création. Le seul writer applicatif trouvé dans `src` est ce service/RPC ; les policies autorisent aussi certaines écritures directes sur les deux tables. L'inventaire des fonctions distantes capables d'écrire dans ces tables reste à compléter avant migration.

Le périmètre proposé est le **dossier édité par le formulaire** : champs du site, AEA, références photos et les deux responsables. Les productions, ventes, rattachements d'artisans et affectations de collecteurs ne sont pas réécrits par ce formulaire ; ils ne doivent pas être modifiés par ce correctif.

## Décisions proposées

1. Ajouter un RPC nommé explicitement `snp_save_artisanal_site_v2`, sans surcharge homonyme ambiguë. Arguments requis : `p_site jsonb`, `p_assignments jsonb`, `p_operation text` (`create` ou `update`), `p_expected_updated_at timestamptz`. Aucun défaut ne doit transformer une édition sans version en écriture autorisée.
2. En édition, transmettre `expectedUpdatedAt` comme chaîne serveur intacte : aucune conversion par `Date`, aucun arrondi aux millisecondes, aucune date calculée dans le navigateur. En création, exiger une valeur explicitement NULL et un UUID de création stable conservé pendant la vie du brouillon.
3. Faire de `artisanal_sites.updated_at` le jeton commun du dossier. Son trigger doit produire une valeur strictement supérieure à OLD.updated_at, par exemple le maximum entre l'horloge serveur courante et OLD.updated_at + une microseconde. Cela évite qu'une transaction ancienne utilisant `now()` produise un jeton identique ou antérieur après attente de verrou.
4. Ajouter une propagation pour INSERT/UPDATE/DELETE de `artisanal_site_assignments` : toucher le parent concerné. Un changement de `site_id` touche OLD et NEW dans un ordre UUID déterministe. Ne pas modifier silencieusement le comportement du trigger partagé actuel : préférer une fonction dédiée au parent et un trigger dédié à cette propagation.
5. Conserver le contrôle d'autorisation existant, SECURITY INVOKER, des noms de tables/fonctions qualifiés et un search_path fermé. Aucun GRANT sur un helper privé, aucun élargissement RLS, aucune désactivation de trigger de sécurité.
6. Remplacer dans la même migration le corps de l'ancien RPC à deux arguments par un refus explicite de mutation « Cette version du formulaire doit être actualisée ». Conserver ses ACL ; ne pas laisser l'ancien UPSERT accessible ni le convertir en wrapper inventant la version courante. Cette rupture contrôlée est préférable à un ancien client qui écrase encore les données.

Le nom `v2` est un contrat proposé, pas une fonction réputée existante. La restriction volontaire de l'ancienne voie exige une promotion coordonnée du frontend ; les anciens onglets seront invités à recharger.

## Algorithme transactionnel à implémenter

Ce bloc est du pseudocode de revue, pas un script de migration :

```text
Vérifier la session, le contrôle métier existant et la forme complète du dossier.
Exiger exactement les deux rôles attendus, noms/téléphones et contraintes existantes.

Si operation = update :
  Exiger site.id et expected_updated_at non NULL.
  Verrouiller le parent accessible avec SELECT ... FOR UPDATE.
  Si absent/inaccessible : refuser, sans créer de remplacement.
  Si updated_at IS DISTINCT FROM expected_updated_at :
    lever une erreur de conflit (SQLSTATE 40001) avant toute mutation.
  Mettre à jour le parent par UPDATE explicite, pas par UPSERT création/édition.

Si operation = create :
  Exiger site.id stable et expected_updated_at NULL.
  INSERT seulement : aucun ON CONFLICT ... DO UPDATE.
  Un UUID/code déjà existant ne doit jamais être écrasé.

Mettre à jour/insérer les deux responsables par (site_id, role).
Préserver id et created_at des responsables existants.
Laisser toutes les contraintes/guards de l'AEA et les RLS agir normalement.
Relire le parent APRÈS les mutations enfants et leur propagation de version.
Retourner site et responsables avec cette version finale exacte.
```

Une erreur après la mutation du premier responsable annule toute la transaction. Le retour ne peut pas utiliser le `v_saved` pris avant la boucle enfants : après ajout du trigger de propagation, ce serait un jeton déjà périmé.

La propagation des enfants doit échouer si elle ne peut pas protéger le parent attendu ; elle ne doit pas ignorer silencieusement un parent filtré par RLS. Lors d'une suppression en cascade du parent, prévoir explicitement le cas où celui-ci est déjà supprimé dans la même transaction. Tester la suppression autorisée existante sans élargir son périmètre.

Des écritures directes d'enfant peuvent prendre leur verrou de ligne avant le verrou du parent et entrer en interblocage avec un RPC verrouillant d'abord le parent. PostgreSQL doit alors annuler une transaction ; l'interface doit conserver le brouillon et afficher une reprise explicite, sans annoncer un succès. Ne pas promettre zéro attente/interblocage. Les futurs writers métier doivent suivre le même ordre parent puis enfants.

La garantie porte sur les éditions par le RPC versionné et la détection des changements enfants observés. Elle ne transforme pas une écriture administrative SQL arbitraire en édition versionnée. Ne pas retirer des droits de table existants sans inventaire et décision séparée.

## Préflight requis avant une candidate de migration

- Lire les définitions complètes de tous les triggers/fonctions écrivant dans les deux tables et tous les overloads de `snp_save_artisanal_site`. Comparer avec le snapshot R02 ; arrêter sur divergence non expliquée.
- Relever types, précision et nullabilité de `updated_at`, contraintes AEA, unicité `(site_id, role)`, clés étrangères, index, triggers activés, propriétaires, ACL des tables/fonctions et policies. Le préflight R02 ne contient pas encore tous les privilèges d'écriture ni toutes les contraintes CHECK/UNIQUE : le compléter, pas les déduire.
- Confirmer le contrat et les dépendances de `snp_peut_gerer_sites_artisanaux()`, notamment session/MFA. Ne pas réintroduire l'appel direct au helper de session privé qui a déjà causé un incident.
- Vérifier l'absence d'un writer annexe qui remet le timestamp à `now()` ou modifie les contacts sans propagation. Vérifier les triggers AFTER/BEFORE, les cascades et les comptes habilités à écrire seulement les enfants.
- Capturer les empreintes des deux tables, des relations externes concernées, des policies/ACL/guards et les métadonnées Storage. Aucun renommage d'objet, recalcul de code, modification de photo ou de donnée historique nécessaire à la migration.
- Geler la candidate SQL et les sources frontend par SHA256 avant la répétition. Wrapper transactionnel : timeout de verrou court, garde de métadonnées, répétition avec ROLLBACK puis comparaison ; application séparée seulement après autorisation explicite.

## Frontend et comportement de conflit

Fichiers envisagés : `types/artisanalSite.ts`, `types/database.ts`, `services/artisanalSiteService.ts`, `pages/artisanal-sites/ArtisanalSiteForm.tsx`, tests correspondants. L'interface de détails peut simplement consommer le résultat final ; aucun autre formulaire à modifier pour ce lot.

- Charger le jeton avec le dossier et le conserver hors des champs éditables. Ne pas le remplacer automatiquement lorsqu'un événement de refresh survient pendant la saisie.
- Distinguer explicitement création/édition ; générer une fois l'UUID du brouillon de création, le réutiliser après timeout. Si l'UUID existe après une réponse perdue, relire ce seul dossier et comparer : ne pas le réinsérer avec un nouvel UUID ni annoncer une réussite sans confirmation. Une relance qui retourne « déjà existant » n'est pas un nouveau succès de sauvegarde.
- Avant tout nouveau dépôt Storage, détecter autant que possible la disponibilité du contrat v2. Aucun fallback vers l'ancien RPC si v2 est absent. L'erreur « version du service indisponible » bloque la sauvegarde et conserve le brouillon.
- Sur 40001, afficher « Ce site a été modifié depuis son ouverture. Vos saisies sont conservées. » ; proposer de consulter/recharger la version actuelle avec choix explicite, sans écraser automatiquement la saisie ni réenvoyer la mutation avec un jeton frais.
- Un vrai rechargement accepté remplace ensemble champs, responsables et jeton. Après sauvegarde confirmée, utiliser le résultat final/relecture, annoncer le succès et naviguer selon le workflow existant.
- Conserver la protection de contexte et les gardes de réponses tardives déjà ajoutées. Un changement de rôle/périmètre ne doit pas laisser réapparaître le brouillon précédent.
- Ne pas supprimer une AEA ou photo déjà référencée. Après un conflit SQL certain, seuls les nouveaux objets propres à cette tentative et non référencés peuvent être candidats au nettoyage. Après timeout/réponse ambiguë, conserver le traitement prudent actuel et vérifier le rattachement avant toute compensation. Les historiques inline demeurent inchangés.

## Ordre de promotion et retour arrière

1. Implémenter et éprouver localement le RPC proposé, le trigger commun et le frontend. Produire les preuves ci-dessous sur un environnement autorisé ; rien n'est encore appliqué par ce plan.
2. Geler la candidate, préparer frontend prêt à publier, reçus/hash et procédure de réversion. Annoncer le court créneau où les anciennes sauvegardes seront refusées, sans interrompre les lectures.
3. Après Go : préflight récent, répétition ROLLBACK, comparaison, puis migration atomique : RPC v2 + horodatage/propagation + ancien RPC rendu non mutatif. Aucun intervalle avec v2 prétendument sûr et ancien UPSERT encore disponible.
4. Recharger le cache de schéma PostgREST selon le mécanisme existant ; prouver la présence du contrat v2. Publier le frontend associé, contrôler l'ancien onglet et le nouvel onglet.
5. Si frontend en défaut, conserver un état de refus de sauvegarde contrôlé ou republier un frontend compatible v2. Ne pas restaurer automatiquement l'ancien UPSERT sans version. Si une réversion du contrat est indispensable, faire décider explicitement le retour du risque de perte d'édition, après préflight et sans restauration de données historiques.

## Matrice minimale de preuves avant recevabilité

| ID | Scénario | Preuve attendue |
|---|---|---|
| CONC-01 | A et B lisent le même jeton ; A sauve puis B | B reçoit 40001 ; site, deux IDs enfants, AEA et photos restent exactement ceux de A |
| CONC-02 | B recharge après conflit puis sauve | Nouveau jeton utilisé ; changement B persiste, sans recréer les contacts |
| CONC-03 | Modification directe autorisée d'un contact entre lecture et sauvegarde UI | Jeton parent avancé ; ancienne version UI refusée |
| CONC-04 | INSERT/DELETE/reparenting autorisé d'affectation | Parents concernés avancent ; cascades historiques préservées ; pas d'omission RLS |
| CONC-05 | Erreur du deuxième enfant/AEA invalide après préparation | Aucune mutation du parent, premier enfant ou version durable |
| CONC-06 | Transaction ancienne attend un verrou | Jeton final strictement croissant ; aucun retour à `now()` antérieur |
| CONC-07 | Retour RPC après les deux enfants | Jeton retourné = jeton effectivement stocké ; sauvegarde suivante sans faux conflit |
| CONC-08 | Ancienne signature ; version NULL/absente ; mode inconnu | Refus avant mutation ; aucun fallback client masquant ce refus |
| CONC-09 | Nouvelle création, collision UUID/code, réponse réseau perdue | UUID stable, aucune deuxième fiche ni écrasement ; confirmation explicite par relecture |
| CONC-10 | Permissions existantes : DGMG/admin autorisés et périmètres/MFA/session refusés | Cas positifs/négatifs distincts ; ACL/RLS/helpers privés identiques au préflight |
| CONC-11 | Deux onglets dans l'interface avec saisie et fichiers candidats | Brouillon conservé après conflit ; aucun bouton de succès mensonger ; pièces de A lisibles |
| CONC-12 | Intégrité et nettoyage du RUN de recette | UUID exacts, lectures après recharge, métadonnées/relations historiques inchangées ; absence des seules fixtures après nettoyage autorisé |

Chaque preuve doit identifier commit/hash, version SQL, cible, acteur/périmètre (sans jeton), étapes, attendu/obtenu, capture utile, résultat SQL et nettoyage. Les doubles de services ne prouvent pas 10–12 ; une lecture SQL privilégiée ne prouve pas les RLS. Une capture seule ne prouve pas la persistance.

**Statut : SITE-CONC-004 ouvert. Ce plan rend le changement examinable ; il ne constitue ni un correctif exécuté ni une demande d'autorisation anticipée.**
