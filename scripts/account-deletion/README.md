# Suppression autorisée du compte de développement

Le 30 août 2026, l'utilisateur a expressément demandé, puis confirmé la suppression
définitive forcée de `otingueri@gmail.com`, afin de recréer ce compte.

## Résultat vérifié

- Projet vérifié : `yyverzuhkdonjjuficor`.
- Ancien UUID : `c7570144-0075-4cb0-8a59-4713c1ebe07f`, rôle `admin`.
- Suppression transactionnelle validée à 16:19 UTC, après répétition avec ROLLBACK.
- Vérification indépendante : identité Auth, profil, habilitations, capacités,
  sessions applicatives/Auth, MFA et les huit catégories d'identifiants/flux Auth
  contrôlées ne contiennent plus de ligne pour cet utilisateur.
- Un événement `account_deleted` confirme l'opération
  `a2988a04-1f35-4b98-b583-28ac9a08c118`.
- Aucune activité métier et aucun objet Storage détenu par la cible.
- Les 2 événements de workflow et les 6 événements de sécurité sont conservés.
  Leurs identifiants sont rattachés à l'ancien UUID dans l'audit de suppression,
  avant application des contraintes ON DELETE SET NULL.
- Les journaux administratifs/achats liés au compte et les autres comptes sont
  inchangés (comparaisons transactionnelles avant/après).

## Correctif limité publié

Migration `20260830170000_reparer_controles_suppression_comptes.sql` :

1. Ajout des 28 dépendances explicitement relues au registre existant.
2. Les déconnexions personnelles `session.self` sont distinguées des activités
   métier. L'appartenance de la session est vérifiée ; les autres activités,
   événements incomplets et futures dépendances inconnues restent bloquants.
3. Correction du trigger d'audit de statut vers les colonnes réelles d'audit_trail.

La publication a été transactionnelle, avec enregistrement de cette seule
migration. Le `db push --dry-run` a confirmé la divergence historique déjà connue :
aucun repair/reset ou envoi des autres migrations en attente n'a été effectué.
Aucun compte n'a été modifié par la publication du correctif.

## Canal de suppression

La suppression forcée autorisée a utilisé le canal d'administration Supabase déjà
authentifié, et non une session applicative simulée. Le script ne forge aucun JWT,
ne désactive aucune contrainte, aucun trigger, RLS ou contrôle MFA de l'application.
Il est limité à l'UUID et l'e-mail ci-dessus, exige le rôle Admin exact, refuse
toute activité métier ou document possédé, verrouille la cible et annule la
transaction si une postcondition échoue. Il refuse donc de supprimer un compte
recréé avec la même adresse mais un autre UUID.

Les flux Auth sans FK utilisateur (`refresh_tokens`, `flow_state`) ont été retirés
explicitement dans la transaction. Les autres dépendances Auth/access suivent
leurs contraintes en cascade. Les audits mentionnent le canal de maintenance et
le véritable utilisateur de session PostgreSQL, sans usurper l'identité d'un Owner.

## Preuves et tests

- 15 tests SQL ciblés, 40 contrats SQL existants et 10 tests du catalogue réussis.
- Tests de suppression effectués dans une base locale isolée, fixtures annulées.
- Répétition distante du correctif et de la suppression avec ROLLBACK.
- `output/account-deletion-fix-apply.json` : publication du correctif.
- `output/account-deletion-apply.json` : reçu de suppression COMMIT.
- `output/account-deletion-postflight.json` : contrôle indépendant après COMMIT.
- Aucun déploiement frontend, commit ou push effectué pour cette opération.

Le correctif plus large des habilitations Admin préparé lors de la tâche précédente
n'est pas publié par cette intervention. Recréer le compte ne publie pas ce correctif.
