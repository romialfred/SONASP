# Rapport de refonte — utilisateurs, rôles et accès

## Architecture

L’écran historique a été transformé en wizard en deux étapes : identité/rôle/périmètre, puis habilitations. La même matrice typée alimente le formulaire, les menus et les contrôles de routes. Les décisions sensibles restent recalculées dans PostgreSQL et dans la fonction Edge.

## RBAC / ABAC

Le RBAC porte les huit rôles cibles. L’ABAC ajoute la responsabilité, l’organisation primaire, le rattachement collecteur, l’état du compte, la session active et le niveau MFA. L’accès effectif est une intersection et les domaines inconnus échouent en mode fermé.

## Portails

Deux espaces distincts ont été ajoutés pour DGMG et DGI, avec indicateurs chargés depuis la base et navigation spécialisée. Les espaces Mine, Comptoir, Collecteur et Client continuent d’utiliser leurs portails dédiés. L’ancien écran autonome d’édition des permissions redirige vers l’étape Habilitations du wizard unifié.

## Rôles

La création est limitée à Administrateur, Direction SONASP, DGMG, Société minière, Comptoir d’achat, DGI, Agent Collecteur et Client. `Owner` demeure un compte technique non créable et n’accorde plus de wildcard métier. Les rôles historiques sont recensés pour revue et ne sont jamais convertis silencieusement.

## Responsabilités

Les responsabilités sont persistées séparément des permissions CRUD. Elles sont filtrées par rôle, certaines sont obligatoires, et les incompatibilités sont refusées immédiatement dans l’interface puis à nouveau par la base.

## Sécurité

- Création et modification réservées à `accounts.manage`, avec MFA et hiérarchie stricte.
- Validation serveur du rôle, du rattachement, des responsabilités et de chaque case d’habilitation.
- Mutation atomique du profil, de l’organisation, du collecteur, des responsabilités et des permissions.
- Révocation des sessions après reconfiguration et journal d’audit avant/après.
- Suppression du fallback frontend permissif et du wildcard `Owner`.
- Séparation demandeur/décideur sur les approbations renforcées.

## Migration

Le mapping des modules repose désormais sur `modules.access_domain`, jamais sur un libellé traduisible. Les comptes `customer` déjà identifiés comme comptoir ou collecteur sont migrés automatiquement ; les cas ambigus sont déposés dans `snp_access_migration_review`. Le déploiement et le retour arrière sont décrits dans `DEPLOIEMENT-ACCES-INSTITUTIONNELS-2026-08-27.md`.

## Tests

- Tests unitaires de la matrice rôle-responsabilité-module-action et des conflits SoD.
- Tests des routes, de la navigation, de la hiérarchie, des capacités et de la fonction Edge.
- Tests du wizard et des deux portails institutionnels.
- Test pgTAP du schéma et des invariants SQL.
- Compilation de production réussie.
- Accès direct anonyme au wizard vérifié : redirection vers `/login`.

## Régressions

Les 100 tests ciblés de la refonte sont verts et les fichiers modifiés par cette mission ne présentent aucune erreur TypeScript. Un run global a exécuté 1 640 tests : sept attentes de navigation `Owner` ont ensuite été réalignées et validées ; l’autre échec observé reste l’attente du bouton `Exporter` dans `ConciliationsPage.test.tsx`, fichier déjà modifié avant cette mission. Le contrôle TypeScript global du dépôt continue par ailleurs de signaler 238 lignes d’erreurs historiques hors de ce périmètre ; elles ne sont pas masquées par cette refonte.

## Points restant à valider dans l’environnement cible

- Appliquer les migrations sur une base de recette et exécuter le test pgTAP, car la base locale courante ne contient pas encore ces migrations.
- Réaliser la comparaison visuelle authentifiée du wizard à la résolution de référence avec un compte administrateur MFA de recette.
- Exécuter les scénarios RLS multi-organisations sur des données de recette représentatives.
