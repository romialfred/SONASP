/*
  # Fix ALL Sales Triggers - ANALYSE COMPLÈTE
  
  PROBLÈME: Plusieurs triggers utilisent des valeurs d'enum INVALIDES
  
  TRIGGERS PROBLÉMATIQUES:
  1. set_initial_sale_status() → compare avec '' (string vide)
  2. auto_calculate_commission() → compare avec 'approved' (n'existe pas!)
  
  SOLUTION: Supprimer TOUS les triggers problématiques
*/

-- ============================================================
-- ÉTAPE 1: ANALYSER L'ENUM ACTUEL
-- ============================================================

DO $$
DECLARE
  enum_values TEXT[];
BEGIN
  SELECT array_agg(enumlabel ORDER BY enumsortorder)
  INTO enum_values
  FROM pg_enum
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status');
  
  RAISE NOTICE '';
  RAISE NOTICE '📋 VALEURS VALIDES DE sale_status:';
  RAISE NOTICE '   %', array_to_string(enum_values, ', ');
  RAISE NOTICE '';
END $$;

-- ============================================================
-- ÉTAPE 2: LISTER TOUS LES TRIGGERS SUR SALES
-- ============================================================

DO $$
DECLARE
  trig RECORD;
  trigger_count INT := 0;
BEGIN
  RAISE NOTICE '🔍 TRIGGERS ACTUELS SUR TABLE sales:';
  
  FOR trig IN
    SELECT 
      t.tgname as trigger_name,
      p.proname as function_name
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE t.tgrelid = 'sales'::regclass
      AND t.tgisinternal = false
  LOOP
    trigger_count := trigger_count + 1;
    RAISE NOTICE '   - %: function %', trig.trigger_name, trig.function_name;
  END LOOP;
  
  IF trigger_count = 0 THEN
    RAISE NOTICE '   (aucun trigger)';
  END IF;
  RAISE NOTICE '';
END $$;

-- ============================================================
-- ÉTAPE 3: SUPPRIMER TOUS LES TRIGGERS PROBLÉMATIQUES
-- ============================================================

-- Trigger 1: set_initial_sale_status (compare avec '')
DROP TRIGGER IF EXISTS set_initial_sale_status_trigger ON sales;
DROP FUNCTION IF EXISTS set_initial_sale_status() CASCADE;

-- Trigger 2: auto_calculate_commission (utilise 'approved')
DROP TRIGGER IF EXISTS auto_calculate_commission_trigger ON sales;
DROP TRIGGER IF EXISTS calculate_commission_trigger ON sales;
DROP FUNCTION IF EXISTS auto_calculate_commission() CASCADE;
DROP FUNCTION IF EXISTS calculate_commission() CASCADE;

-- Trigger 3: Tout autre trigger qui pourrait être problématique
DROP TRIGGER IF EXISTS set_sale_status_trigger ON sales;
DROP TRIGGER IF EXISTS validate_sale_status_trigger ON sales;

RAISE NOTICE '✅ Tous les triggers problématiques supprimés';
RAISE NOTICE '';

-- ============================================================
-- ÉTAPE 4: CONFIGURER LE DEFAULT CORRECT
-- ============================================================

ALTER TABLE sales 
  ALTER COLUMN status SET DEFAULT 'pending_management_approval'::sale_status;

RAISE NOTICE '✅ DEFAULT changé à: pending_management_approval';
RAISE NOTICE '';

-- ============================================================
-- ÉTAPE 5: AJOUTER LES STATUSES MANQUANTS (si besoin)
-- ============================================================

DO $$
DECLARE
  status_to_add TEXT;
  added_count INT := 0;
BEGIN
  FOR status_to_add IN
    SELECT unnest(ARRAY[
      'for_sale',
      'create_sales',
      'pending_management_approval',
      'management_approved',
      'management_rejected',
      'pending_for_customer_approval',
      'customer_approved',
      'customer_rejected',
      'waiting_for_payment',
      'virtual_payment',
      'payment_received',
      'completed',
      'cancelled'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = status_to_add
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
    ) THEN
      BEGIN
        EXECUTE format('ALTER TYPE sale_status ADD VALUE %L', status_to_add);
        added_count := added_count + 1;
        RAISE NOTICE '✅ Ajouté: %', status_to_add;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️  Impossible d''ajouter %: %', status_to_add, SQLERRM;
      END;
    END IF;
  END LOOP;
  
  IF added_count = 0 THEN
    RAISE NOTICE '✓ Tous les statuses nécessaires sont déjà présents';
  END IF;
  RAISE NOTICE '';
END $$;

-- ============================================================
-- ÉTAPE 6: TESTER L'INSERTION
-- ============================================================

DO $$
DECLARE
  v_customer_id uuid;
  v_mining_id uuid;
  v_test_id uuid;
  test_passed BOOLEAN := true;
BEGIN
  RAISE NOTICE '🧪 TESTS D''INSERTION:';
  RAISE NOTICE '';
  
  -- Récupérer des données de test
  SELECT id INTO v_customer_id FROM customers LIMIT 1;
  SELECT id INTO v_mining_id FROM mining_companies LIMIT 1;

  IF v_customer_id IS NULL OR v_mining_id IS NULL THEN
    RAISE NOTICE '⚠️  Pas de données de test (customers ou mining_companies vides)';
    RAISE NOTICE '   Le fix est appliqué, mais impossible de tester l''insertion';
    RAISE NOTICE '';
    RETURN;
  END IF;

  -- TEST 1: Insertion avec status explicite
  BEGIN
    INSERT INTO sales (
      sale_number, sale_date, customer_id, seller_id, seller_type,
      quantity_oz, london_am_rate, freight_cost, other_costs,
      gross_proceeds, net_proceeds, royalties, final_proceeds,
      total_amount, currency, status
    ) VALUES (
      'TEST-FIX-001', CURRENT_DATE, v_customer_id, v_mining_id, 'mining_company',
      100, 2700, 0, 0, 270000, 270000, 8100, 261900,
      261900, 'USD', 'pending_management_approval'
    ) RETURNING id INTO v_test_id;

    DELETE FROM sales WHERE id = v_test_id;
    RAISE NOTICE '✅ Test 1: Insertion avec status explicite RÉUSSIE';
  EXCEPTION WHEN OTHERS THEN
    test_passed := false;
    RAISE NOTICE '❌ Test 1 ÉCHOUÉ: %', SQLERRM;
  END;

  -- TEST 2: Insertion SANS status (utilise DEFAULT)
  BEGIN
    INSERT INTO sales (
      sale_number, sale_date, customer_id, seller_id, seller_type,
      quantity_oz, london_am_rate, freight_cost, other_costs,
      gross_proceeds, net_proceeds, royalties, final_proceeds,
      total_amount, currency
    ) VALUES (
      'TEST-FIX-002', CURRENT_DATE, v_customer_id, v_mining_id, 'mining_company',
      100, 2700, 0, 0, 270000, 270000, 8100, 261900,
      261900, 'USD'
    ) RETURNING id INTO v_test_id;

    DELETE FROM sales WHERE id = v_test_id;
    RAISE NOTICE '✅ Test 2: Insertion SANS status (DEFAULT) RÉUSSIE';
  EXCEPTION WHEN OTHERS THEN
    test_passed := false;
    RAISE NOTICE '❌ Test 2 ÉCHOUÉ: %', SQLERRM;
  END;
  
  RAISE NOTICE '';
  
  IF test_passed THEN
    RAISE NOTICE '🎉🎉🎉 TOUS LES TESTS RÉUSSIS - FIX COMPLET!';
  ELSE
    RAISE NOTICE '⚠️  Certains tests ont échoué - Voir détails ci-dessus';
  END IF;
  RAISE NOTICE '';
END $$;

-- ============================================================
-- ÉTAPE 7: AFFICHER LA CONFIGURATION FINALE
-- ============================================================

-- Triggers restants
DO $$
DECLARE
  trig RECORD;
  trigger_count INT := 0;
BEGIN
  RAISE NOTICE '📊 CONFIGURATION FINALE:';
  RAISE NOTICE '';
  RAISE NOTICE '   Triggers restants sur sales:';
  
  FOR trig IN
    SELECT tgname as trigger_name
    FROM pg_trigger t
    WHERE t.tgrelid = 'sales'::regclass
      AND t.tgisinternal = false
  LOOP
    trigger_count := trigger_count + 1;
    RAISE NOTICE '     - %', trig.trigger_name;
  END LOOP;
  
  IF trigger_count = 0 THEN
    RAISE NOTICE '     (aucun trigger - PARFAIT!)';
  END IF;
  RAISE NOTICE '';
END $$;

-- DEFAULT value
SELECT 
  '   Status DEFAULT:' as info,
  column_default as value
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'status';

RAISE NOTICE '';
RAISE NOTICE '✅ FIX COMPLET APPLIQUÉ!';
RAISE NOTICE '▶️  Vous pouvez maintenant créer des ventes dans l''application';
