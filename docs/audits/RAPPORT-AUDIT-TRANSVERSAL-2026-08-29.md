# Rapport d’audit transversal SONASP — 29 août 2026

## Conclusion

L’audit transversal et la contre-analyse ont couvert l’authentification, les rôles, les permissions, le catalogue des modules, les routes, les workflows métier, les stocks, la réserve nationale, les documents sensibles, les services Supabase et les principaux écrans historiques.

À l’issue des corrections, aucune anomalie bloquante n’est détectée par les contrôles automatisés exécutés. La compilation TypeScript stricte, la couverture des types de base, le lint, le build de production et l’intégralité des tests applicatifs sont validés.

## Corrections structurantes

### Autorisations et isolation des portails

- Catalogue canonique unique des modules et rattachement explicite des routes.
- Contrôle conjoint du rôle, de la permission et de l’activation du module.
- Accès Owner complet aux vingt modules canoniques et aux sous-modules d’administration.
- Accès Administrateur limité et cohérent avec la matrice de permissions.
- Protection des accès directs par URL, en complément du filtrage de la barre latérale.
- Durcissement des RPC de permissions et retrait des exécutions anonymes privilégiées.

### Sessions et mises à jour PWA

- Suppression du rechargement global lors du retour sur un onglet.
- Déduplication des événements d’authentification qui concernent le même utilisateur.
- Mise à jour PWA présentée explicitement à l’utilisateur, sans rechargement imposé.
- Conservation de la génération du service worker et du mécanisme de mise à jour.

### Workflows et cohérence des données

- Transitions serveur autoritaires pour les ventes artisanales, la conciliation, les stocks et la réserve nationale.
- Contrôles de séparation des tâches et interdiction de l’auto-approbation.
- Garde atomique empêchant une double consommation des stocks par export et réserve.
- Exclusion des achats non finalisés des stocks disponibles.
- Correction de la conversion de l’once troy à `31,1034768 g`.
- Alignement des statuts d’expédition affichés sur l’énumération réellement présente en base.
- Normalisation explicite des champs historiques nullables, sans désactivation du compilateur.

### Documents sensibles

- Téléversement des documents de réserve via une passerelle de service dédiée.
- Validation du chemin, du nom, du type MIME, de la taille, du rôle, de la permission et de la propriété du brouillon.
- Suppression des droits directs d’écriture et de suppression sur le stockage de réserve.
- Lecture privée contrôlée et traçable.

### Qualité des services et des écrans

- Contrats Supabase `Insert`, `Update`, RPC et vues réalignés sur les types générés.
- Suppression des références à plusieurs colonnes inexistantes.
- Validation des objets JSON et des statuts avant utilisation.
- Normalisation partagée des artisans et des données de paiement.
- Correction des pages clients, production, fret, raffinage, expédition, contrats, documents, parties prenantes et administration.

## Invariants vérifiés sur la base distante

- Tables publiques sans RLS : **0**.
- Fonctions `SECURITY DEFINER` sans `search_path` sûr : **0**.
- Fonctions privilégiées exécutables par `anon` : **0**.
- Modules actifs inconnus du catalogue : **0**.
- Sous-modules Administration actifs et visibles : Utilisateurs, Modules, Rôles & Permissions, Messagerie, Paramètres système et Journal d’audit.
- Owner principal : accès aux **20 modules canoniques** et droits complets sur les **44 entrées de permission** contrôlées.
- Administrateur `otingueri@gmail.com` : consultation des **44 modules** et gestion des **6 modules d’administration** selon la politique définie.
- Écriture directe des documents de réserve : interdite ; passerelle `service_role` obligatoire.

## Migrations et fonctions déployées

- `20260829103000_durcir_iam_modules_et_mfa.sql`
- `20260829104000_durcir_workflows_stock_et_sources.sql`
- Fonction Edge `create-user`
- Fonction Edge `sensitive-upload`

Les tests pgTAP suivants sont validés :

- `access_control_matrix_test.sql`
- `workflow_integrity_regression_test.sql`
- `reserve_allocations_workflow_test.sql`

## Contre-analyse et preuves de non-régression

| Contrôle | Résultat |
|---|---:|
| Couverture des types Supabase | Succès |
| TypeScript strict (`tsc --noEmit`) | Succès, 0 erreur |
| ESLint global | Succès, 0 erreur |
| Vitest global | **224/224 fichiers**, **1 689/1 689 tests** |
| Build Vite de production | Succès, **3 195 modules** |
| Génération PWA | Succès, `sw.js` et Workbox générés |
| Audit npm des dépendances de production | 0 vulnérabilité |
| Vérification Deno des fonctions Edge | Succès |
| `git diff --check` | Succès |

## Risques opérationnels à surveiller

Les contrôles réalisés prouvent la cohérence de l’état audité, mais ne remplacent pas les mesures d’exploitation continues. Il reste recommandé de maintenir :

- des sauvegardes restaurables et testées de la base et du stockage privé ;
- une surveillance des erreurs Edge, des refus RLS et des transitions rejetées ;
- une revue périodique des permissions Owner/Administrateur et des comptes inactifs ;
- une validation des migrations et des tests pgTAP dans la CI avant chaque déploiement ;
- une rotation régulière des secrets et des clés de service.
