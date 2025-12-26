# 🚨 SOLUTION URGENTE - Problème de Connexion

## Diagnostic
❌ **Vous ne pouvez pas vous connecter car la table `profiles` n'existe pas dans votre base de données.**

Actuellement, votre base de données contient UNIQUEMENT:
- Les 5 tables du module Artisan Minier (récemment ajouté)
- **AUCUNE** table système principale

## Solution en 3 étapes

### ÉTAPE 1: Appliquer la migration initiale

1. Ouvrir le dashboard Supabase: https://ngqipcqoutsedhtvrjbj.supabase.co
2. Aller dans **SQL Editor**
3. Créer une nouvelle query
4. **Copier TOUT le contenu** du fichier: `00_MIGRATION_INITIALE_COMPLETE.sql`
5. Coller dans le SQL Editor
6. Cliquer sur **RUN**

Cette migration va créer **16 tables essentielles** dont:
- ✅ `profiles` (profils utilisateurs)
- ✅ `mining_companies` (compagnies minières)
- ✅ `daily_production` (production)
- ✅ `sales` (ventes)
- ✅ `payments` (paiements)
- ✅ `customers` (clients)
- ✅ `shipping_preparations` (expéditions)
- ✅ Et 9 autres tables...

### ÉTAPE 2: Créer votre profil utilisateur

Une fois la migration terminée, exécuter ce SQL:

```sql
-- Créer votre profil
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

### ÉTAPE 3: Vérifier que tout fonctionne

Exécuter cette requête pour vérifier:

```sql
-- Vérifier les tables créées
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Vous devriez voir au moins 21 tables

-- Vérifier votre profil
SELECT * FROM profiles WHERE email = 'romuald.tiegnan@gmail.com';
```

## Configuration Supabase Auth

### Désactiver la confirmation email (développement)

1. Aller dans: **Settings** > **Authentication** > **Providers**
2. Cliquer sur **Email**
3. **Désactiver** l'option: "Confirm email"
4. Sauvegarder

### Réinitialiser votre mot de passe (si nécessaire)

1. Dans **Authentication** > **Users**
2. Trouver votre utilisateur: romuald.tiegnan@gmail.com
3. Cliquer sur les 3 points (...)
4. Sélectionner "Send password reset email"
5. Vérifier votre email
6. Définir un nouveau mot de passe

## Pourquoi ce problème?

La base de données a été créée **incompletement**. Seul le module Artisan Minier a été déployé, mais pas le système principal Gold Shipper.

Le fichier `26122025_01_artisan_minier_migration.sql` a bien été appliqué, mais il manquait toutes les migrations de base.

## Après avoir appliqué la solution

Une fois la migration appliquée et votre profil créé:

1. ✅ Vous pourrez vous connecter à: romuald.tiegnan@gmail.com
2. ✅ Vous aurez accès au système Gold Shipper
3. ✅ Vous pourrez utiliser le module Artisan Minier
4. ✅ Tous les modules seront fonctionnels

## Besoin d'aide?

Si vous rencontrez des erreurs pendant l'exécution de la migration:

1. Copier le message d'erreur complet
2. Vérifier que vous êtes bien connecté à: https://ngqipcqoutsedhtvrjbj.supabase.co
3. Vérifier que vous utilisez le SQL Editor (pas la console)
4. Essayer d'exécuter la migration par sections si elle échoue en entier

## Ordre des migrations après celle-ci

Une fois cette migration appliquée, vous pourrez exécuter les autres migrations dans cet ordre (si nécessaire):

1. ✅ `00_MIGRATION_INITIALE_COMPLETE.sql` (FAIT)
2. ✅ `26122025_01_artisan_minier_migration.sql` (DÉJÀ FAIT)
3. Les migrations `20251112_xxx` à `20251211_xxx` (optionnel pour fonctionnalités avancées)

**Note:** Les migrations numérotées ajoutent des fonctionnalités avancées mais ne sont PAS nécessaires pour la connexion de base.
