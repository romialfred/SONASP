/*
  # Fix Sales Status Default Value
  
  PROBLÈME IDENTIFIÉ:
  - La colonne sales.status a DEFAULT 'for_sale' NOT NULL
  - Mais 'for_sale' n'existe pas dans l'enum sale_status actuel
  - Cela cause l'erreur: "invalid input value for enum sale_status: ''"
  
  SOLUTION:
  - Changer le DEFAULT à 'pending_management_approval'
  - Ajouter 'for_sale' à l'enum pour compatibilité (optionnel)
*/

-- 1. Ajouter 'for_sale' à l'enum pour compatibilité avec anciennes données
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

-- 2. Changer le DEFAULT de la colonne status (avec RAISE dans un bloc DO)
DO $$
BEGIN
  ALTER TABLE sales 
    ALTER COLUMN status SET DEFAULT 'pending_management_approval'::sale_status;

  RAISE NOTICE '✅ Changed sales.status DEFAULT to pending_management_approval';
END $$;

-- 3. Vérifier la configuration
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name = 'status';

-- 4. Tester l'insertion
DO $$
DECLARE
  v_customer_id uuid;
  v_mining_id uuid;
  v_test_id uuid;
BEGIN
  -- Récupérer des IDs de test
  SELECT id INTO v_customer_id FROM customers LIMIT 1;
  SELECT id INTO v_mining_id FROM mining_companies LIMIT 1;

  IF v_customer_id IS NOT NULL AND v_mining_id IS NOT NULL THEN
    -- Test insertion AVEC status explicite
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

    RAISE NOTICE '✅ Test 1: Insertion avec status explicite réussie';
    DELETE FROM sales WHERE id = v_test_id;

    -- Test insertion SANS status (utilise DEFAULT)
    INSERT INTO sales (
      sale_number, sale_date, customer_id, seller_id, seller_type,
      quantity_oz, london_am_rate, freight_cost, other_costs,
      gross_proceeds, net_proceeds, royalties, final_proceeds,
      total_amount, currency
      -- status omis intentionnellement pour tester le DEFAULT
    ) VALUES (
      'FIX-TEST-002', CURRENT_DATE, v_customer_id, v_mining_id, 'mining_company',
      100, 2700, 0, 0, 270000, 270000, 8100, 261900,
      261900, 'USD'
    ) RETURNING id INTO v_test_id;

    RAISE NOTICE '✅ Test 2: Insertion SANS status (DEFAULT) réussie';
    DELETE FROM sales WHERE id = v_test_id;
    
    RAISE NOTICE '✅ TOUS LES TESTS SONT PASSÉS!';
  ELSE
    RAISE NOTICE '⚠️  Pas de données de test (customer ou mining_company manquants)';
  END IF;
END $$;

-- 5. Afficher tous les status disponibles
SELECT 
  'Status disponibles dans sale_status:' as info,
  enumlabel as status,
  enumsortorder as order_num
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
ORDER BY enumsortorder;
