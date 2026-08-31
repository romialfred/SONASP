# Audit et correctifs IAM / inter-portails — 30 août 2026

## État de livraison

**Correctifs implémentés et testés localement ; aucun déploiement distant effectué.**

L'audit a consulté le schéma et les référentiels Supabase en lecture seule. Les
modifications SQL ont été exécutées exclusivement dans une base PostgreSQL isolée.
Les comptes réels ne bénéficient pas encore des nouvelles protections serveur.

Ce rapport clôt le lot IAM / échanges décrit ci-dessous, pas un audit exhaustif
certifiant l'absence d'anomalie dans toute la plateforme. Le raccordement des droits
financiers fins du Comptoir est inclus ; la certification DGI et l'exécution bancaire
réelles restent hors de la validation locale.

## Périmètre et méthode

- Parcours étudié : interface → services → Edge Functions → RPC → RLS, privilèges,
  contraintes et triggers → lecture par le portail destinataire.
- Source serveur : export du **schéma public réel**, sans données métier ; support
  Auth/extensions issu du miroir local. Des référentiels minimaux et des utilisateurs
  synthétiques servent de fixtures, pas de copie de comptes réels.
- PostgreSQL 17.6, conteneur `supabase_db_SONASP-local-mirror`, base dédiée
  `sonasp_iam_audit_20260830`. La base métier du miroir n'a pas été réinitialisée.
- Les fonctions d'autorisation ne sont pas simulées dans les tests SQL. Les acteurs
  sont exécutés sous `SET ROLE authenticated`, avec claims/session/MFA synthétiques.
- Les jeux de données de test sont annulés par `ROLLBACK`. Les migrations restent
  dans la base d'audit pour permettre la contre-analyse combinée.
- Les revues backend, sécurité et frontend ont conduit à traiter ensemble les
  droits d'accès SQL, la hiérarchie serveur et les choix proposés par les formulaires.

## Constats corrigés

| Constat vérifié | Correction locale |
| --- | --- |
| Owner absent de la création interactive ; verrou serveur interdisant également l'administration d'un autre Owner | Catalogue, hiérarchie frontend/Edge/SQL alignés. Un autre Owner peut être créé, promu ou administré par Owner, jamais par Admin. |
| D'anciennes policies permissives et des privilèges DML autorisaient encore la suppression directe de permissions d'un supérieur | Privilèges directs retirés ; écritures canoniques, hiérarchie recontrôlée et audit transactionnel. Le scénario Direction → permissions Owner échouait avant correction. |
| Le titulaire pouvait modifier des champs sensibles de son profil, notamment l'enrôlement MFA et le drapeau d'approbation | UPDATE limité aux coordonnées/préférences autorisées ; les attributs de sécurité restent accessibles par leurs procédures dédiées. |
| Une absence d'enrôlement MFA était considérée comme satisfaisant la MFA | Les opérations sensibles exigent un profil actif enrôlé et une assurance AAL2. L'enrôlement personnel reste utilisable. |
| Administration des sessions et ancien RPC de capacités moins restrictifs que la gestion des comptes | Même hiérarchie et interdiction de s'auto-attribuer des droits. Les anciens RPC non utilisés de configuration/rattachement ne sont plus exécutables par le navigateur. |
| Modification de statut annulée par un contexte de trigger absent, puis par un trigger d'audit utilisant des colonnes inexistantes | Contexte canonique de mutation et insertion dans le schéma réel d'audit. Activation, désactivation et promotion atomiques testées. |
| Contrainte de rôle limitée aux anciennes valeurs, incompatible avec DGI, DGMG, Comptoir et Collecteur proposés par le formulaire | Contrainte alignée sur les 13 rôles canoniques et historiques ; anciens profils conservés. |
| Modules inactifs absents des choix et de la représentation des droits Owner | Chargement complet du catalogue pour Owner, droits complets non décochables, indépendance vis-à-vis de l'activation/visibilité vérifiée par SQL. Aucun élargissement équivalent pour les autres profils. |
| Rattachement facultatif national contrôlé contre un type d'organisation `owner`/`admin` inexistant | Les profils nationaux sont vérifiés contre le type `sonasp`, Collecteur contre `comptoir`. Le RPC reste autoritatif. |
| Bouton de réponse Mine appelant une RPC absente | Adaptateur Mine rétabli, tenant dérivé côté serveur, délégation au traitement canonique créant achat et facture dans la même transaction. |
| Appel direct au traitement canonique de demande possible sans AAL2 | Contrôle de session et de capability sensible ajouté avant le traitement. |
| Deux demandes approuvées pour une même mine et une même période produisaient la même référence d'achat | Séquence de références via le générateur existant, verrou transactionnel par espace de numérotation. Les références historiques ne sont pas modifiées. |
| Profil personnel envoyant une colonne inexistante et montrant un historique d'activité fictif | Payload limité aux vrais champs ; historique chargé depuis le service réel, états vide/erreur distincts ; e-mail en lecture seule. |
| « Gestion du comptoir » ne permettait pas d'attribuer les capacités réellement exigées par les RPC de facturation/paiement/taxes | Quatre responsabilités financières explicites raccordées au formulaire, au validateur Edge, au catalogue SQL et aux plafonds CRUD. Aucun droit financier Comptoir implicite. |
| Deux configurations dans une même transaction pouvaient fermer un rattachement à sa date d'ouverture et violer sa contrainte de validité | Date réelle de changement commune à la fermeture et à l'ouverture du rattachement. Le retrait successif de droits dans la même transaction passe désormais. |

La création Auth d'un Owner passe par un profil initial inactif de faible privilège,
puis par la configuration SQL avec le JWT de l'Owner demandeur. La clé de service
seule ne remplace pas cette revalidation. Les erreurs de nettoyage restent consignées ;
l'interface ne promet plus qu'aucun compte incomplet subsiste si le nettoyage échoue.

## Règles d'administration retenues

| Acteur | Ses propres habilitations | Autre compte inférieur | Autre Admin | Autre Owner / création Owner |
| --- | --- | --- | --- | --- |
| Owner | Refusées | Autorisé | Autorisé | Autorisé |
| Admin | Refusées | Autorisé | Refusé | Refusé |
| Autres profils | Refusées | Refusé | Refusé | Refusé |

Les coordonnées et préférences personnelles ne sont pas des habilitations : elles
restent modifiables par leur titulaire. Les modifications d'accès de comptes non
Owner révoquent leurs sessions ; les changements de configuration Owner passent
aussi par la révocation canonique. Les opérations sont auditées.

Les droits complets Owner n'annulent ni la MFA, ni les sessions révoquées, ni les
contrôles de séparation des tâches propres aux opérations métier. La protection
contre la suppression d'un Owner n'a pas été supprimée.

## Échanges inter-portails effectivement testés

- **Mine → SONASP** : déclaration de production, calcul de l'or fin en grammes,
  visibilité nationale, absence de lecture par une seconde mine.
- **SONASP → Mine** : seules les demandes soumises destinées à la mine sont visibles ;
  refus d'une réponse inter-mine ou sur brouillon ; approbation/rejet autorisés pour
  le destinataire. Deux approbations d'une même période créent deux achats distincts.
- **Réquisition → Mine** : lecture et réponse limitées à la mine destinataire.
  Les réquisitions de test sont des fixtures : leur création administrative complète
  et leur notification externe ne sont pas testées par ce scénario.
- **Comptoir → SONASP** : soumission sur stock, invisibilité pour un second comptoir,
  réception par SONASP, acceptation répercutée au comptoir, sortie du ledger conforme.
  Le stock initial est synthétique ; cela ne valide pas toute la chaîne paiement → stock.

### Habilitations financières Comptoir

Les responsabilités `comptoir.invoices.issue`, `comptoir.payments.execute`,
`comptoir.payments.reconcile` et `comptoir.tax.execute` sont proposées uniquement
au rôle Comptoir, décochées par défaut. Exécution et contrôle d'un paiement ne sont
pas cumulables sur le même compte. Le catalogue et cette règle sont protégés contre
les écritures directes du navigateur.

La nouvelle métadonnée `requires_explicit_assignment` conserve le comportement
des responsabilités historiques. Pour les quatre capacités financières, une
attribution historique par rôle reste possible : aucun droit Admin préexistant
n'est perdu par simple édition de ses coordonnées. Les refus explicites existants
sont respectés. Aucun grant de rôle financier automatique n'est ajouté à Comptoir.

Les tests vérifient le retrait effectif après reconnexion, le plafond de création
ou de contrôle du module Paiements, la hiérarchie d'attribution et le refus du
comptoir voisin. La garde financière privée est appelée par un harnais
`SECURITY DEFINER` conservant le JWT de l'acteur ; ce n'est pas une simulation
de l'autorisation, mais pas non plus une opération bancaire complète.

### Dépendance institutionnelle déjà présente, mais non déployée

La lecture du serveur le 30 août a confirmé l'absence de :

- `snp_dgi_lister_paiements_fiscaux(uuid,integer,integer)` ;
- `snp_4i_can_read_payment_scope(uuid,uuid)` ;
- `snp_dgmg_can_validate_reserve_level_1()` ;
- l'attribution DGMG `reserve.allocations.validate_level_1`.

Le correctif existant `20260829213000_borner_portails_fiscaux_dgi_dgmg.sql` a donc été
relu et exécuté **uniquement dans la base d'audit**, sans réécrire cette migration.
Ses 25 contrats passent avec le nouveau socle IAM : DGI correctement rattachée,
projection fiscale sans les preuves/notes de paiement, mauvais rattachements refusés,
file DGMG minimale et limitée au premier niveau, refus sans MFA et de la RPC générale.
Les deux derniers contrôles de transition inspectent le contrat de fonction ; ils
ne constituent pas une affectation Réserve entièrement exécutée en bout en bout.

## Vérifications

| Contrôle exécuté | Résultat |
| --- | --- |
| Première suite Vitest complète, 233 fichiers | 1 767 tests réussis, 0 échec |
| Seconde suite Vitest complète après raccordement financier, 234 fichiers | **1 781 tests réussis, 0 échec** |
| Suite ciblée finale (comptes, profil, rôles, capacités, services, contrats Edge), 8 fichiers | 95 tests réussis |
| `iam_owner_administration_flow_test.sql` | 42 assertions réussies |
| `interportal_iam_flow_test.sql` | 24 assertions réussies |
| `owner_role_lock_test.sql` | 10 assertions réussies |
| `owner_module_continuity_test.sql` | 26 assertions réussies |
| `institutional_fiscal_reserve_boundaries_test.sql` | 25 assertions réussies |
| `comptoir_finance_habilitations_test.sql` | 28 assertions réussies |
| Contre-analyse combinée des six scénarios SQL | **155 assertions réussies** après réapplication des trois nouvelles migrations |
| Lint / TypeScript | Réussis après raccordement financier |
| Build Vite / PWA | Réussi avec raccordement financier ; build local `local-mtfpfx8o` |
| Intégrité du catalogue des migrations | 219 fichiers vérifiés ; dette historique inchangée |
| Tests du vérificateur de migrations | 10 tests réussis |
| `git diff --check` | Réussi |
| Navigateur local sans session, `/users/new` | Redirection vers la connexion, pas d'accès anonyme au formulaire |

La configuration ESLint existante exclut les Edge Functions : le succès du lint
concerne le frontend, pas une compilation Deno des fonctions. Les politiques
partagées ont des tests Vitest ; les limites du test intégré Edge sont précisées
ci-dessous.

La seconde suite globale a terminé avec succès après le raccordement financier.
Les 95 tests ciblés incluent le dernier cas d'interface Comptoir ajouté pendant
cette exécution globale. Les résultats se recoupent : ne pas additionner ces
nombres pour prétendre à un total de tests distincts. Les avertissements des doubles
graphiques et erreurs intentionnelles des tests négatifs ne constituent pas des
échecs d'assertion.

Avant le premier correctif IAM, 19 des 29 assertions alors présentes échouaient
sur la copie du schéma serveur. La réponse Mine manquante et la collision de
références ont aussi été reproduites avant correction. Le scénario d'attribution
financière Comptoir échouait sur 10 de ses 26 premières assertions avant correction.

## Livraison et application distante à autoriser

Nouvelles migrations de ce lot :

1. `20260830103000_securiser_administration_owner_et_profils.sql`
2. `20260830110000_retablir_reponse_demande_portail_mine.sql`
3. `20260830111500_raccorder_habilitations_financieres_comptoir.sql`

Le catalogue a été mis à jour sans modifier d'anciennes migrations. Les trois
migrations sont transactionnelles, contiennent leurs contrôles de cohérence et
ont été rejouées dans la base isolée.

Le déploiement institutionnel doit aussi inclure le correctif préexistant
`20260829213000_borner_portails_fiscaux_dgi_dgmg.sql`, absent du serveur observé.
Il a été validé dans ce lot, mais n'est pas une nouvelle migration écrite ici.

Le helper partagé de hiérarchie implique de redéployer, de façon coordonnée, les
sept Edge Functions : `create-user`, `get-users`, `get-user-details`, `delete-user`,
`manage-user-status`, `reset-user-password`, `revoke-user-sessions`.

Procédure avant toute écriture distante :

1. Obtenir l'autorisation explicite ; relire le diff exact de chaque fonction et
   vérifier ses dépendances. L'arbre partagé contient de nombreux changements
   d'autres lots : ne pas le publier en bloc.
2. Refaire les préflights read-only, contrôler le catalogue et préparer une
   sauvegarde/restauration validée. Vérifier qu'un Owner actif dispose d'un facteur
   vérifié. Le contrôle agrégé présent a trouvé **1 Owner actif, enrôlé, avec facteur
   vérifié** ; il ne remplace pas une connexion AAL2 réelle au moment du déploiement.
3. Examiner `supabase db push --linked --dry-run`. L'historique est divergent : ne
   pas exécuter un `repair`, un reset ou une application globale improvisée.
   Si le dry-run bloque, approuver une procédure ciblée avec reçu et historique.
4. Appliquer uniquement les migrations relues dans l'ordre retenu, puis les Edge
   Functions et le frontend correspondant. Contrôler les versions actives.
5. Sur des comptes de recette autorisés : création d'un second Owner, enrôlement,
   édition d'un autre compte, refus d'auto-élévation et inter-tenant, réponse Mine,
   cession Comptoir, puis vérification des lectures DGI/DGMG.
6. Vérifier les audits et les sessions révoquées. Aucune donnée de test ne doit être
   créée dans un compte réel sans accord et identification des cibles.

En cas d'incident, privilégier une correction en avant ou la fermeture temporaire
du parcours concerné. **Ne pas restaurer les anciennes écritures directes sensibles
pour contourner un blocage**, ni supprimer des utilisateurs ou des données métier.

## Travaux restants / limites explicites

1. **Application aux comptes réels encore à réaliser.** Après le déploiement autorisé,
   Owner devra attribuer explicitement les responsabilités financières souhaitées
   aux comptes Comptoir concernés. Le lot ne choisit pas à sa place les personnes
   exécutant ou contrôlant les paiements et n'accorde pas ces droits en masse.
2. Pas de validation navigateur authentifiée Owner/Mine/Comptoir/DGI/DGMG : le
   navigateur de recette était déconnecté. L'accès anonyme a été vérifié ; les tests
   positifs d'interface ont utilisé Testing Library, pas un compte réel connecté.
3. Pas de création d'identité Auth réelle ni d'envoi d'e-mail d'activation. Le test
   Edge de création vérifie notamment l'ordre des contrôles dans le code ; il ne
   remplace pas un test intégré Auth → RPC → courriel → MFA.
4. Aucun test de charge concurrent multi-transactions, aucune certification DGI
   externe ou opération bancaire réelle. Les verrous, l'idempotence et les refus
   sont testés/revus sur les chemins indiqués, sans garantie globale de performance.
5. Les contrôles Storage et l'ensemble des workflows Réserve ne sont pas certifiés
   par ce lot. Les résultats SQL cités concernent exactement les scénarios nommés.

Aucun commit, push, déploiement Supabase/Vercel ou changement de droits d'un compte
réel n'a été effectué pendant cet audit.
