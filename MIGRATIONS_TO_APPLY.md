# Migrations à Appliquer - Corrections du Module Shipping

## ⚠️ IMPORTANT: Appliquer dans cet ordre exact

### Migration 1: Correction des fonctions de quota (MODIFIÉE - OBLIGATOIRE)
```bash
📁 supabase/migrations/add_license_quota_functions.sql
```

**Raison**: Corrige l'erreur "column 'remaining_quantity_grams' can only be updated to DEFAULT"

**Ce qui a été corrigé**:
- Suppression de la mise à jour manuelle de `remaining_quantity_grams` dans `reserve_license_quota`
- Suppression de la mise à jour manuelle de `remaining_quantity_grams` dans `release_license_quota`
- PostgreSQL calcule automatiquement cette colonne

---

### Migration 2: Ajout de license_id (SI PAS DÉJÀ APPLIQUÉE)
```bash
📁 supabase/migrations/20251112_013_add_license_to_shipping.sql
```

**Raison**: Ajoute la colonne `license_id` à la table `shipping_preparations`

**Vérifier si déjà appliquée**:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
AND column_name = 'license_id';
```

Si la requête retourne une ligne, cette migration est déjà appliquée. Sinon, l'appliquer.

---

## Comment Appliquer les Migrations

### Via le Dashboard Supabase (Recommandé)

1. Ouvrir https://supabase.com/dashboard
2. Sélectionner votre projet
3. Aller dans **SQL Editor** (menu latéral gauche)
4. Cliquer sur **"New Query"**

#### Pour Migration 1:
5. Copier tout le contenu de `supabase/migrations/add_license_quota_functions.sql`
6. Coller dans l'éditeur SQL
7. Cliquer sur **"Run"** (ou appuyer sur `Ctrl+Enter`)
8. Attendre le message "Success. No rows returned"

#### Pour Migration 2 (si nécessaire):
9. Créer une nouvelle query
10. Copier tout le contenu de `supabase/migrations/20251112_013_add_license_to_shipping.sql`
11. Coller dans l'éditeur SQL
12. Cliquer sur **"Run"**
13. Attendre le message "Success. No rows returned"

---

## Vérification Après Application

Exécuter cette requête pour vérifier que tout est correct:

```sql
-- 1. Vérifier que license_id existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
AND column_name = 'license_id';
-- Doit retourner: license_id | uuid

-- 2. Vérifier que les fonctions existent
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('reserve_license_quota', 'check_license_availability', 'release_license_quota');
-- Doit retourner 3 lignes

-- 3. Vérifier que remaining_quantity_grams est une colonne GENERATED
SELECT column_name, is_generated, generation_expression
FROM information_schema.columns
WHERE table_name = 'export_licenses'
AND column_name = 'remaining_quantity_grams';
-- Doit retourner: remaining_quantity_grams | ALWAYS | (authorized_quantity_grams - used_quantity_grams)
```

**Résultat attendu**: Toutes les requêtes retournent les valeurs indiquées

---

## En Cas de Problème

Si une erreur se produit lors de l'application:

1. **Lire le message d'erreur complet**
2. **Copier le message d'erreur**
3. **Vérifier si une migration précédente est manquante**
4. **Contacter le support avec le message d'erreur**

---

## ✅ Une Fois les Migrations Appliquées

Le module shipping fonctionnera correctement:
- ✅ Création d'expéditions sans erreur
- ✅ Réservation de quota de licence fonctionnelle
- ✅ Calcul automatique des quantités restantes
- ✅ Messages d'erreur clairs en cas de quota insuffisant

**Temps estimé**: 2-3 minutes pour les deux migrations
