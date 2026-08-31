# Déploiement et retour arrière — accès institutionnels

## Prérequis

1. Sauvegarder la base et vérifier qu’aucune migration en attente antérieure n’a échoué.
2. Examiner les modules actifs : chaque module doit pouvoir être associé à un `access_domain` stable.
3. Déployer d’abord en recette avec des comptes de test distincts pour chaque rôle et chaque responsabilité sensible.
4. Ne pas déployer la fonction Edge `create-user` avant la migration de schéma correspondante.

## Ordre de déploiement

1. Appliquer `supabase/migrations/20260827230000_refonte_acces_institutionnels.sql`.
2. Examiner `snp_access_migration_review` et traiter les anciens comptes ambigus.
3. Appliquer `supabase/migrations/20260827231000_durcir_separation_fonctions_workflows.sql`.
4. Déployer `supabase/functions/create-user` et son module partagé.
5. Déployer le frontend.
6. Exécuter `supabase/tests/access_control_matrix_test.sql`, puis les scénarios fonctionnels par rôle.

La première migration s’arrête volontairement si un module actif reste dans le domaine `unknown`. Il faut alors compléter le mapping avant de relancer ; il ne faut pas contourner ce contrôle.

## Vérifications post-déploiement

- La création propose exactement les huit rôles cibles.
- Le lien d’activation est individuel et à usage unique ; aucun mot de passe provisoire n’est remis à l’administrateur.
- L’authentification MFA est exigée avant une opération sensible.
- Les menus DGMG et DGI n’exposent que leurs espaces dédiés.
- Une URL directe non autorisée est bloquée.
- Les requêtes hors organisation sont refusées par les politiques RLS.
- Les couples préparer/approuver et exécuter/rapprocher sont refusés.
- Un approbateur ne peut pas approuver son propre objet.
- Une modification de rôle révoque les sessions existantes et journalise l’opération.

## Retour arrière

Exécuter d’abord `supabase/rollback/20260827231000_durcir_separation_fonctions_workflows.sql`, puis `supabase/rollback/20260827230000_refonte_acces_institutionnels.sql`. Ils retirent les gardes ajoutées par la refonte et restaurent les contraintes historiques compatibles. Avant de les exécuter :

1. interrompre les créations/modifications de comptes ;
2. exporter les tables d’audit, responsabilités et rattachements ;
3. vérifier qu’aucun compte ne dépend exclusivement de `dgmg`, `dgi`, `comptoir` ou `collector` ;
4. restaurer conjointement la version précédente de la fonction Edge et du frontend ;
5. valider la reconnexion des comptes et la politique RLS historique.

Un retour arrière après usage métier des nouveaux rôles doit être piloté comme une migration de données, pas comme une simple suppression de schéma.
