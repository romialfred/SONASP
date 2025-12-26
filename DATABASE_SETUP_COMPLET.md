# Configuration Base de Données - URGENT

## Problème Identifié
La base de données ne contient QUE les tables du module Artisan Minier. Il manque toutes les tables principales :
- ❌ Pas de table `profiles` (gestion des utilisateurs)
- ❌ Pas de table `production`
- ❌ Pas de table `sales`
- ❌ Pas de table `shipping`
- ❌ Pas de table `customers`
- ❌ Pas de table `mining_companies`
- ❌ Pas de table `refineries`

**Résultat:** Impossible de se connecter car le système de profils utilisateur n'existe pas.

## Tables actuellement présentes
✅ snp_artisans_miniers
✅ snp_cartes_professionnelles
✅ snp_artisan_documents
✅ snp_artisan_activities
✅ snp_carte_statistics

## Solution : Appliquer les migrations dans l'ordre

### 1. Migration Principale (À EXÉCUTER EN PREMIER)
Cette migration doit créer TOUTES les tables de base du système Gold Shipper.

**Fichier à créer:** `00_initial_schema.sql`

Cette migration doit contenir:
1. Table `profiles` (profils utilisateurs)
2. Table `mining_companies` (compagnies minières)
3. Table `sites` (sites d'exploitation)
4. Table `production` (production quotidienne)
5. Table `depositors` (déposants)
6. Table `inventory` (inventaire or/argent)
7. Table `shipping_preparations` (préparation expéditions)
8. Table `customers` (clients)
9. Table `sales` (ventes)
10. Table `payments` (paiements)
11. Table `refineries` (raffineries)
12. Table `transport_companies` (compagnies de transport)
13. Table `gold_prices` (prix de l'or)
14. Table `fx_rates` (taux de change)
15. Table `modules` (modules système)
16. Table `user_permissions` (permissions)

### 2. Configuration Supabase Auth

Dans le dashboard Supabase, configurer:
```sql
-- Activer l'authentification par email/mot de passe
-- URL: https://ngqipcqoutsedhtvrjbj.supabase.co

-- Settings > Authentication > Providers
-- Activer: Email
-- Désactiver: Email confirmation (pour le développement)
```

### 3. Créer le premier utilisateur Admin

Une fois les tables créées, exécuter:
```sql
-- Créer un profil pour l'utilisateur existant
INSERT INTO profiles (
  id,
  email,
  full_name,
  role,
  can_approve_sales,
  can_manage_users,
  can_view_analytics,
  can_export_data
)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'romuald.tiegnan@gmail.com'),
  'romuald.tiegnan@gmail.com',
  'Romuald TIEGNAN',
  'Management',
  true,
  true,
  true,
  true
);
```

### 4. Ordre d'exécution des migrations

Après la migration initiale, appliquer dans l'ordre:

1. `add_production_status_tracking.sql`
2. `add_production_documents.sql`
3. `add_shipping_system.sql`
4. `add_export_licenses_system.sql`
5. `add_license_quota_functions.sql`
6. Les migrations datées (20251112_xxx, 20251113_xxx, etc.)
7. `26122025_01_artisan_minier_migration.sql` (DÉJÀ FAIT)

## Action Immédiate Requise

**VOUS DEVEZ:**
1. Contacter l'équipe Supabase ou l'administrateur de la base de données
2. Demander l'application du schéma complet Gold Shipper
3. OU restaurer une sauvegarde complète de la base de données
4. OU appliquer manuellement le fichier SQL initial dans le SQL Editor de Supabase

## Fichiers SQL à chercher

Les fichiers suivants peuvent contenir le schéma complet:
- `scripts/verify-database-structure.sql` (documentation)
- Rechercher un fichier `schema.sql` ou `init.sql` dans les archives du projet
- Contacter le développeur original pour le fichier de migration initial

## Note Importante

Le projet Gold Shipper nécessite environ **30-40 tables** pour fonctionner correctement. Actuellement, seulement **5 tables** sont présentes (module Artisan Minier uniquement).

Sans les tables de base, **aucune connexion n'est possible** car le système de profils utilisateur n'existe pas.
