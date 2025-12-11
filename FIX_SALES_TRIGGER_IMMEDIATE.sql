/*
  # Fix Sales Status Trigger - URGENT
  
  PROBLÈME: Un trigger set_initial_sale_status() compare status avec ''
           ce qui est invalide pour un enum
           
  SOLUTION: Supprimer le trigger problématique et recréer correctement
*/

-- 1. Supprimer le trigger et la fonction problématique
DROP TRIGGER IF EXISTS set_initial_sale_status_trigger ON sales;
DROP FUNCTION IF EXISTS set_initial_sale_status() CASCADE;

RAISE NOTICE '✅ Trigger problématique supprimé';

-- 2. Changer le DEFAULT de la colonne status
ALTER TABLE sales 
  ALTER COLUMN status SET DEFAULT 'pending_management_approval'::sale_status;

RAISE NOTICE '✅ DEFAULT changé à pending_management_approval';

-- 3. Ajouter 'for_sale' à l'enum pour compatibilité (si pas déjà présent)
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

-- 4. Vérifier la configuration
SELECT 
  'Configuration vérifiée:' as info,
  column_default as default_value
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'status';

-- 5. Tester l'insertion
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

    -- Test sans status (utilise DEFAULT)
    INSERT INTO sales (
      sale_number, sale_date, customer_id, seller_id, seller_type,
      quantity_oz, london_am_rate, freight_cost, other_costs,
      gross_proceeds, net_proceeds, royalties, final_proceeds,
      total_amount, currency
    ) VALUES (
      'FIX-TEST-002', CURRENT_DATE, v_customer_id, v_mining_id, 'mining_company',
      100, 2700, 0, 0, 270000, 270000, 8100, 261900,
      261900, 'USD'
    ) RETURNING id INTO v_test_id;

    RAISE NOTICE '✅ Test 2: Insertion SANS status (DEFAULT) RÉUSSIE';
    DELETE FROM sales WHERE id = v_test_id;
    
    RAISE NOTICE '✅✅✅ TOUS LES TESTS PASSÉS - FIX COMPLET!';
  ELSE
    RAISE NOTICE '⚠️  Pas de données de test';
  END IF;
END $$;

-- Afficher les triggers restants sur sales
SELECT 
  'Triggers sur sales:' as info,
  tgname as trigger_name
FROM pg_trigger t
WHERE tgrelid = 'sales'::regclass
  AND tgisinternal = false;
