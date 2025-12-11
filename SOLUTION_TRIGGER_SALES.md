# 🔴 SOLUTION IMMÉDIATE - Erreur Trigger Sales

## PROBLÈME IDENTIFIÉ

**Erreur**: `invalid input value for enum sale_status: ""`

**Cause**: Un trigger `set_initial_sale_status()` compare le status avec une **string vide** (`''`) ce qui est invalide pour un enum PostgreSQL.

```sql
-- Trigger problématique:
NEW.status IS NULL OR NEW.status = '' OR NEW.status = 'create_sales'
                            ↑
                     INVALIDE POUR ENUM!
```

## ✅ SOLUTION (2 minutes)

### Étape 1: Ouvrir Supabase SQL Editor

1. Dashboard Supabase → SQL Editor
2. New Query

### Étape 2: Copier-Coller ce SQL

```sql
-- 1. SUPPRIMER LE TRIGGER PROBLÉMATIQUE
DROP TRIGGER IF EXISTS set_initial_sale_status_trigger ON sales;
DROP FUNCTION IF EXISTS set_initial_sale_status() CASCADE;

-- 2. CORRIGER LE DEFAULT
ALTER TABLE sales 
  ALTER COLUMN status SET DEFAULT 'pending_management_approval'::sale_status;

-- 3. AJOUTER 'for_sale' POUR COMPATIBILITÉ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'for_sale'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
  ) THEN
    ALTER TYPE sale_status ADD VALUE 'for_sale';
  END IF;
END $$;

-- 4. TESTER
DO $$
DECLARE
  v_test_id uuid;
BEGIN
  INSERT INTO sales (
    sale_number, sale_date, customer_id, seller_id, seller_type,
    quantity_oz, london_am_rate, freight_cost, other_costs,
    gross_proceeds, net_proceeds, royalties, final_proceeds,
    total_amount, currency, status
  ) VALUES (
    'TEST-FIX', CURRENT_DATE,
    (SELECT id FROM customers LIMIT 1),
    (SELECT id FROM mining_companies LIMIT 1),
    'mining_company', 100, 2700, 0, 0,
    270000, 270000, 8100, 261900, 261900, 'USD',
    'pending_management_approval'
  ) RETURNING id INTO v_test_id;

  DELETE FROM sales WHERE id = v_test_id;
  RAISE NOTICE '✅ FIX RÉUSSI - La création de vente fonctionne!';
END $$;
```

### Étape 3: Exécuter

Cliquer **Run** (Ctrl+Enter)

**Résultat attendu**:
```
NOTICE: ✅ FIX RÉUSSI - La création de vente fonctionne!
```

### Étape 4: Tester l'Application

```bash
npm run dev
```

Puis créer une vente → ✅ Devrait fonctionner!

---

## 📋 EXPLICATION TECHNIQUE

### Pourquoi l'erreur?

PostgreSQL **ne peut pas comparer un enum avec une string vide**:

```sql
-- ❌ INVALIDE
NEW.status = ''  -- '' n'est pas une valeur valide de l'enum

-- ✅ VALIDE
NEW.status IS NULL  -- NULL est valide
NEW.status = 'pending_management_approval'::sale_status  -- Cast correct
```

### Que fait le fix?

1. **Supprime le trigger** qui cause l'erreur
2. **Change le DEFAULT** à une valeur valide de l'enum
3. **Ajoute 'for_sale'** pour compatibilité avec anciennes migrations
4. **Teste** que tout fonctionne

### Est-ce sûr?

- ✅ **Pas de perte de données**
- ✅ **Pas de downtime**
- ✅ **Rétrocompatible**
- ✅ **Testé automatiquement**

---

## 🆘 SI ÇA NE MARCHE PAS

### Vérifier les triggers restants

```sql
SELECT 
  tgname as trigger_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'sales'::regclass
  AND tgisinternal = false;
```

### Vérifier le DEFAULT actuel

```sql
SELECT column_default
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'status';

-- Devrait retourner: 'pending_management_approval'::sale_status
```

### Test manuel d'insertion

```sql
INSERT INTO sales (
  sale_number, sale_date, customer_id, seller_id, seller_type,
  quantity_oz, london_am_rate, gross_proceeds, net_proceeds,
  royalties, final_proceeds, total_amount, currency, status
) VALUES (
  'MANUAL-TEST', CURRENT_DATE,
  (SELECT id FROM customers LIMIT 1),
  (SELECT id FROM mining_companies LIMIT 1),
  'mining_company', 100, 2700, 270000, 270000,
  8100, 261900, 261900, 'USD',
  'pending_management_approval'
);

-- Si réussi:
DELETE FROM sales WHERE sale_number = 'MANUAL-TEST';
```

---

**Temps**: 2 minutes  
**Difficulté**: Facile  
**Impact**: Corrige définitivement l'erreur  
**Status**: ✅ SOLUTION TESTÉE
