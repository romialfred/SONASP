-- Script de test pour vérifier le système d'approbation client

-- 1. Vérifier que la migration a bien été appliquée
SELECT 'Migration Check' as test_name;

-- Colonnes virtuelles dans payments
SELECT
  'payments virtual columns' as check_type,
  COUNT(*) as columns_found
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('is_virtual', 'payment_type', 'mechanism_type', 'virtual_due_date', 'auto_credited_at');

-- Status waiting_for_payment dans sales
SELECT
  'sales status constraint' as check_type,
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'sales_status_check';

-- Fonctions RPC
SELECT
  'RPC functions' as check_type,
  routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('create_virtual_payment', 'calculate_payment_due_date');

-- 2. Test de création de paiement virtuel via RPC
SELECT 'Testing RPC create_virtual_payment' as test_name;

-- Trouver une vente existante pour test
DO $$
DECLARE
  test_sale_id UUID;
  test_customer_id UUID;
  test_payment_id UUID;
BEGIN
  -- Récupérer une vente de test
  SELECT id, customer_id INTO test_sale_id, test_customer_id
  FROM sales
  WHERE status = 'approved'
  LIMIT 1;

  IF test_sale_id IS NOT NULL THEN
    -- Tester la fonction RPC
    test_payment_id := create_virtual_payment(
      test_sale_id,
      test_customer_id,
      1000.00,
      'USD',
      'spot',
      NOW()
    );

    RAISE NOTICE 'RPC Test SUCCESS - Payment ID: %', test_payment_id;

    -- Vérifier que le paiement a été créé
    IF EXISTS (SELECT 1 FROM payments WHERE id = test_payment_id) THEN
      RAISE NOTICE 'Payment exists in database: YES';
    ELSE
      RAISE NOTICE 'Payment exists in database: NO';
    END IF;

    -- Nettoyer le test
    DELETE FROM payments WHERE id = test_payment_id;
    RAISE NOTICE 'Test payment cleaned up';
  ELSE
    RAISE NOTICE 'No approved sale found for testing';
  END IF;
END $$;

-- 3. Vérifier les ventes en attente d'approbation client
SELECT
  'Sales awaiting customer approval' as check_type,
  s.id,
  s.sale_number,
  s.status,
  s.mechanism_type,
  c.name as customer_name,
  c.email as customer_email
FROM sales s
LEFT JOIN customers c ON s.customer_id = c.id
WHERE s.status IN ('approved', 'customer_pending')
ORDER BY s.created_at DESC
LIMIT 5;

-- 4. Vérifier les paiements virtuels existants
SELECT
  'Existing virtual payments' as check_type,
  p.id,
  p.reference_number,
  p.sale_id,
  p.is_virtual,
  p.payment_type,
  p.mechanism_type,
  p.virtual_due_date,
  p.status,
  s.sale_number
FROM payments p
LEFT JOIN sales s ON p.sale_id = s.id
WHERE p.reference_number LIKE 'VP-%'
ORDER BY p.created_at DESC
LIMIT 10;

-- 5. Test manuel d'approbation
-- Décommenter et remplacer les IDs pour tester
/*
DO $$
DECLARE
  v_sale_id UUID := 'METTRE_ID_VENTE_ICI';
  v_customer_id UUID := 'METTRE_ID_CUSTOMER_ICI';
  v_payment_id UUID;
BEGIN
  -- Créer paiement virtuel
  v_payment_id := create_virtual_payment(
    v_sale_id,
    v_customer_id,
    1234567.89,
    'USD',
    'spot',
    NOW()
  );

  -- Mettre à jour le status de la vente
  UPDATE sales
  SET
    status = 'waiting_for_payment',
    updated_at = NOW()
  WHERE id = v_sale_id;

  RAISE NOTICE 'Manual test completed. Payment ID: %, Check sale status now.', v_payment_id;
END $$;
*/

-- 6. Diagnostic des problèmes potentiels
SELECT 'Diagnostic - RLS Policies on payments' as check_type;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'payments'
ORDER BY policyname;

SELECT 'Diagnostic - RLS Policies on sales' as check_type;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'sales'
ORDER BY policyname;
