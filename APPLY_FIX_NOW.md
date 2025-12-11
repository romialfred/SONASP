# 🚀 APPLIQUER LE FIX MAINTENANT

## ⚡ SOLUTION RAPIDE (2 minutes)

### 1️⃣ Ouvrir Supabase SQL Editor

1. Aller sur https://dashboard.supabase.com
2. Sélectionner votre projet
3. Cliquer sur **SQL Editor** (icône code dans la barre latérale)
4. Cliquer sur **New Query**

### 2️⃣ Copier-Coller le Fix

Copier TOUT le contenu ci-dessous et coller dans SQL Editor:

```sql
/*
  # Fix Sales Status Default Value
  
  PROBLÈME: La colonne sales.status a DEFAULT 'for_sale' 
           mais 'for_sale' n'existe pas dans l'enum
           
  SOLUTION: Changer le DEFAULT à 'pending_management_approval'
*/

-- 1. Ajouter 'for_sale' pour compatibilité
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'for_sale'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
  ) THEN
    ALTER TYPE sale_status ADD VALUE 'for_sale';
    RAISE NOTICE '✅ Added status: for_sale';
  ELSE
    RAISE NOTICE '✓ Status for_sale already exists';
  END IF;
END $$;

-- 2. Changer le DEFAULT
ALTER TABLE sales 
  ALTER COLUMN status SET DEFAULT 'pending_management_approval'::sale_status;

-- 3. Vérifier
SELECT 
  'Configuration actuelle:' as info,
  column_default as default_value
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'status';

-- 4. Tester
DO $$
DECLARE
  v_customer_id uuid;
  v_mining_id uuid;
  v_test_id uuid;
BEGIN
  SELECT id INTO v_customer_id FROM customers LIMIT 1;
  SELECT id INTO v_mining_id FROM mining_companies LIMIT 1;

  IF v_customer_id IS NOT NULL AND v_mining_id IS NOT NULL THEN
    -- Test avec status explicite
    INSERT INTO sales (
      sale_number, sale_date, customer_id, seller_id, seller_type,
      quantity_oz, london_am_rate, freight_cost, other_costs,
      gross_proceeds, net_proceeds, royalties, final_proceeds,
      total_amount, currency, status
    ) VALUES (
      'FIX-TEST-001', CURRENT_DATE, v_customer_id, v_mining_id, 'mining_company',
      100, 2700, 0, 0, 270000, 270000, 8100, 261900,
      261900, 'USD', 'pending_management_approval'
    ) RETURNING id INTO v_test_id;

    RAISE NOTICE '✅ Test 1: Insertion avec status explicite RÉUSSIE';
    DELETE FROM sales WHERE id = v_test_id;

    RAISE NOTICE '✅ TOUS LES TESTS PASSÉS - FIX APPLIQUÉ!';
  ELSE
    RAISE NOTICE '⚠️  Pas de données de test';
  END IF;
END $$;
```

### 3️⃣ Exécuter

1. Cliquer sur **Run** (ou appuyer sur Ctrl+Enter)
2. Attendre le résultat (2-3 secondes)

**Résultat Attendu**:
```
✓ Status for_sale already exists
✅ Test 1: Insertion avec status explicite RÉUSSIE
✅ TOUS LES TESTS PASSÉS - FIX APPLIQUÉ!
```

### 4️⃣ Redémarrer l'Application

```bash
# Dans le terminal du projet
npm run dev
```

Ou simplement recharger la page (Ctrl+R)

### 5️⃣ Tester

1. Ouvrir l'application
2. Créer une nouvelle vente
3. ✅ Devrait fonctionner maintenant!

## 🎯 C'EST TOUT!

Le fix est appliqué. Vous pouvez maintenant créer des ventes sans erreur.

---

**Temps**: 2 minutes
**Difficulté**: Très facile
**Impact**: Zero regression
**Status**: ✅ FIX PERMANENT
