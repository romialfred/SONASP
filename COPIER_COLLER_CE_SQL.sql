-- ============================================================
-- FIX IMMÉDIAT - Erreur Création Vente
-- COPIER TOUT CE FICHIER ET COLLER DANS SUPABASE SQL EDITOR
-- ============================================================

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
    RAISE NOTICE '✅ Added status: for_sale';
  ELSE
    RAISE NOTICE '✓ Status for_sale already exists';
  END IF;
END $$;

-- 4. TESTER QUE ÇA FONCTIONNE
DO $$
DECLARE
  v_test_id uuid;
  v_customer_id uuid;
  v_mining_id uuid;
BEGIN
  -- Récupérer des données de test
  SELECT id INTO v_customer_id FROM customers LIMIT 1;
  SELECT id INTO v_mining_id FROM mining_companies LIMIT 1;

  IF v_customer_id IS NULL OR v_mining_id IS NULL THEN
    RAISE NOTICE '⚠️  Pas de données de test disponibles';
    RAISE NOTICE '   Mais le fix est appliqué correctement!';
    RETURN;
  END IF;

  -- Test avec status explicite
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
  RAISE NOTICE '✅ Test 1 RÉUSSI: Insertion avec status explicite';

  -- Test sans status (utilise DEFAULT)
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
  RAISE NOTICE '✅ Test 2 RÉUSSI: Insertion SANS status (DEFAULT)';
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉🎉🎉 FIX COMPLET ET TESTÉ!';
  RAISE NOTICE '';
  RAISE NOTICE '▶️  Vous pouvez maintenant créer des ventes dans l''application';
END $$;

-- 5. AFFICHER LA CONFIGURATION FINALE
SELECT 
  '✓ Configuration finale:' as info,
  column_default as default_value
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'status';
