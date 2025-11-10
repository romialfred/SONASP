# Guide d'Exécution des Migrations - Shipping Preparation

## Problème Rencontré

Erreur: `policy "Users can view shipping preparations" for table "shipping_preparations" already exists`

Cette erreur se produit car les tables et policies ont été partiellement créées lors d'une migration précédente.

## Solution: 3 Options

### OPTION 1: Fix Rapide (Recommandé)
Exécutez uniquement la migration de fix des policies:

```sql
-- Fichier: supabase/migrations/20251110140000_fix_shipping_preparation_policies.sql
```

Cette migration:
- ✅ Drop toutes les policies existantes
- ✅ Recrée proprement toutes les policies
- ✅ Aucune perte de données

**Comment exécuter:**
1. Ouvrir Supabase Dashboard
2. Aller dans SQL Editor
3. Copier le contenu de `20251110140000_fix_shipping_preparation_policies.sql`
4. Exécuter
5. ✅ Problème résolu!

---

### OPTION 2: Réinitialisation Complète (Si besoin de redémarrer)

**⚠️ ATTENTION: Cette option supprime toutes les données!**

Exécutez les migrations dans cet ordre:

#### Étape 1: Nettoyage
```sql
-- Fichier: supabase/migrations/20251110135800_cleanup_shipping_preparation.sql
```
Supprime: Tables, Policies, Triggers, Functions

#### Étape 2: Recréation Tables
```sql
-- Fichier: supabase/migrations/20251110135900_create_shipping_tables_only.sql
```
Crée: Tables, Indexes, Triggers (sans policies)

#### Étape 3: Création Policies
```sql
-- Fichier: supabase/migrations/20251110140000_fix_shipping_preparation_policies.sql
```
Crée: Toutes les policies proprement

---

### OPTION 3: Vérification Manuelle

Si vous voulez vérifier l'état actuel avant d'agir:

```sql
-- Vérifier les tables existantes
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'shipping_%';

-- Vérifier les policies existantes
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'shipping_%';

-- Vérifier RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'shipping_%';
```

Ensuite, choisissez Option 1 ou Option 2 selon les résultats.

---

## Structure des Tables Créées

### shipping_preparations
- `id` (uuid, PK)
- `daily_production_id` (uuid, FK → daily_production)
- `expedition_lot_number` (text)
- `seal_number` (text)
- `packing_list_url` (text)
- `shipped_to_company` (text) - Freight Company ID
- `shipped_to_address` (text) - Refinery ID
- `shipped_to_country` (text)
- `status` (pending | prepared | shipped)
- `prepared_at`, `shipped_at` (timestamptz)
- `notes` (text)
- `created_at`, `updated_at` (timestamptz)
- `created_by` (uuid, FK → auth.users)

### shipping_signatories
- `id` (uuid, PK)
- `shipping_preparation_id` (uuid, FK)
- `position` (text, NOT NULL)
- `name` (text, NOT NULL)
- `signature_data` (text)
- `signed_at` (timestamptz)
- `order_index` (integer)
- `created_at` (timestamptz)

### shipping_ingots
- `id` (uuid, PK)
- `shipping_preparation_id` (uuid, FK)
- `ingot_box_number` (text, NOT NULL)
- `net_weight_grams` (numeric(12,2))
- `gross_weight_grams` (numeric(12,2))
- `seal_number_1` (text)
- `seal_number_2` (text)
- `created_at` (timestamptz)

---

## Ordre d'Exécution Recommandé

### Si c'est la première fois:
1. ✅ Exécuter `20251110135900_create_shipping_tables_only.sql`
2. ✅ Exécuter `20251110140000_fix_shipping_preparation_policies.sql`

### Si vous avez l'erreur de policy existante:
1. ✅ Exécuter `20251110140000_fix_shipping_preparation_policies.sql` uniquement

### Si vous voulez tout réinitialiser:
1. ⚠️ Exécuter `20251110135800_cleanup_shipping_preparation.sql`
2. ✅ Exécuter `20251110135900_create_shipping_tables_only.sql`
3. ✅ Exécuter `20251110140000_fix_shipping_preparation_policies.sql`

---

## Vérification Post-Migration

Après exécution, vérifiez que tout fonctionne:

```sql
-- Vérifier que les tables existent
SELECT COUNT(*) FROM shipping_preparations; -- Devrait retourner 0
SELECT COUNT(*) FROM shipping_signatories; -- Devrait retourner 0
SELECT COUNT(*) FROM shipping_ingots; -- Devrait retourner 0

-- Vérifier RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('shipping_preparations', 'shipping_signatories', 'shipping_ingots');
-- Toutes devraient avoir rowsecurity = true

-- Vérifier policies
SELECT COUNT(*) 
FROM pg_policies 
WHERE tablename LIKE 'shipping_%';
-- Devrait retourner 12 (4 policies x 3 tables)
```

---

## Résolution de Problèmes

### Erreur: "table does not exist"
→ Exécuter d'abord `20251110135900_create_shipping_tables_only.sql`

### Erreur: "policy already exists"
→ Exécuter `20251110140000_fix_shipping_preparation_policies.sql`

### Erreur: "foreign key constraint violation"
→ Vérifier que `daily_production` table existe et a des données

### Erreur: "permission denied"
→ Vérifier que vous êtes connecté en tant qu'admin Supabase

---

## Support

Si vous rencontrez d'autres erreurs:
1. Vérifier les logs Supabase
2. Vérifier que toutes les tables de dépendance existent:
   - `daily_production`
   - `auth.users`
3. Contactez le support avec le message d'erreur exact

---

**Date de création:** 2025-11-10  
**Version:** 1.0  
**Status:** ✅ Testé et validé
