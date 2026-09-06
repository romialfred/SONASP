# Validation du module Artisans miniers — 6 septembre 2026

## Incident et correction

L'appel `snp_save_artisan_dossier` utilise un `search_path` vide. Le déclencheur historique `generate_numero_carte` appelait le helper et la table des artisans sans schéma. La fonction existe sur la base hébergée, mais sa résolution échouait dans ce contexte. La migration `20260906190538` qualifie ces deux références et conserve les droits de l'appelant, les numéros existants et le format de numérotation.

Le test SQL précédent omettait ce déclencheur. Il reproduit désormais l'erreur avant la correction et vérifie les huit variantes de dossier, la numérotation, l'idempotence et la conservation du numéro après modification. Ce test fait désormais partie de `build:release`.

## Preuves disponibles

- 54 contrôles PostgreSQL isolés réussis, dont la reproduction du message exact avant correction.
- Répétition sur la base Supabase hébergée : huit variantes personne physique/morale × quatre rôles, création et modification par la vraie RPC sous rôle `authenticated`, carte initiale non activée, contraintes différées vérifiées.
- La répétition SQL annule toutes ses écritures. Les empreintes des 14 tables suivies restent identiques dans la transaction.
- Les essais SQL ne constituent pas une validation de l'interface.

## Matrice de validation de l'interface

Chaque ligne exige une saisie dans le navigateur, un enregistrement par les services réels, une relecture indépendante dans PostgreSQL, une modification lorsque proposée, puis la suppression des seules données du scénario dans l'environnement de test. Les tests de composants simulés ne suffisent pas à passer une ligne.

| Parcours | Vérifications | État UI + base |
| --- | --- | --- |
| Artisan physique, quatre rôles | Champs, rattachement de l'aide, création, relecture, modification | À exécuter |
| Artisan personne morale, quatre rôles | Société, responsable, branches conditionnelles, modification | À exécuter |
| Pièces et photo | Fichier réel, stockage privé, consultation, suppression | À exécuter |
| Moyens de paiement de l'artisan | Ajout, modification, consultation, suppression | À exécuter |
| Carte professionnelle | Préparation, recto/verso, validation et refus, correction | À exécuter |
| Adhésion | Barème, droits, période, encaissement, contrôle et annulation | À exécuter |
| Activation et suivi | Activation conditionnelle, suspension, renouvellement, expirations | À exécuter |
| Collecteur | Création, multisite, organisme, modification, pièces | À exécuter |
| Délégation de paiement | Octroi, échéance, retrait et contrôle des droits | À exécuter |
| Comptoir | Société, fiscalité, autorisation, responsable, documents et modification | À exécuter |
| Vente de collecte | Saisie, approbation/refus, suivi des notifications internes | À exécuter |
| Vente d'or artisanale | Création, modification, validation, facture | À exécuter |
| Paiement de vente | Saisie, enregistrement, solde, historique | À exécuter |
| Infraction | Création, modification et relecture | À exécuter |
| Désactivation / réactivation | Motif, état et préservation de l'historique | À exécuter |

## Environnement

La session Chrome accessible est déconnectée. La connexion a été demandée à l'utilisateur sans demander de secret. Un environnement local Supabase distinct est en préparation pour les scénarios financiers et leur nettoyage, sans altérer les protections de la production. Aucun parcours UI ci-dessus n'est déclaré validé à ce stade.
