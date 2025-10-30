-- Script pour simuler une approbation client et débugger le problème

-- ÉTAPE 1: Trouver ou créer une vente de test
DO $$
DECLARE
  v_sale_id UUID;
  v_customer_id UUID;
  v_sale_number TEXT;
  v_final_proceeds NUMERIC;
  v_mechanism_type TEXT;
  v_payment_id UUID;
  v_old_status TEXT;
BEGIN
  -- Chercher une vente en status 'approved'
  SELECT
    id,
    customer_id,
    sale_number,
    final_proceeds,
    mechanism_type,
    status
  INTO
    v_sale_id,
    v_customer_id,
    v_sale_number,
    v_final_proceeds,
    v_mechanism_type,
    v_old_status
  FROM sales
  WHERE status = 'approved'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sale_id IS NULL THEN
    RAISE NOTICE '❌ No sale found with status=approved. Please create a sale first.';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Found sale: % (ID: %)', v_sale_number, v_sale_id;
  RAISE NOTICE '   Customer ID: %', v_customer_id;
  RAISE NOTICE '   Amount: %', v_final_proceeds;
  RAISE NOTICE '   Mechanism: %', COALESCE(v_mechanism_type, 'spot');
  RAISE NOTICE '   Current Status: %', v_old_status;
  RAISE NOTICE '';

  -- ÉTAPE 2: Tester la création du paiement virtuel via RPC
  RAISE NOTICE '🔧 STEP 1: Creating virtual payment via RPC...';

  BEGIN
    v_payment_id := create_virtual_payment(
      v_sale_id,
      v_customer_id,
      v_final_proceeds,
      'USD',
      COALESCE(v_mechanism_type, 'spot'),
      NOW()
    );

    RAISE NOTICE '✅ Virtual payment created successfully!';
    RAISE NOTICE '   Payment ID: %', v_payment_id;

    -- Vérifier le paiement créé
    DECLARE
      v_ref_number TEXT;
      v_due_date DATE;
    BEGIN
      SELECT reference_number, virtual_due_date
      INTO v_ref_number, v_due_date
      FROM payments
      WHERE id = v_payment_id;

      RAISE NOTICE '   Reference: %', v_ref_number;
      RAISE NOTICE '   Due Date: %', v_due_date;
    END;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ RPC create_virtual_payment FAILED: %', SQLERRM;
    RAISE NOTICE '   Trying direct INSERT fallback...';

    -- Fallback: INSERT direct
    DECLARE
      v_due_date DATE;
      v_ref TEXT;
    BEGIN
      v_due_date := CURRENT_DATE + INTERVAL '2 days';
      v_ref := 'VP-TEST-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);

      INSERT INTO payments (
        sale_id,
        customer_id,
        expected_date,
        amount,
        currency,
        is_virtual,
        payment_type,
        mechanism_type,
        auto_credited_at,
        virtual_due_date,
        status,
        bank_name,
        reference_number,
        notes
      ) VALUES (
        v_sale_id,
        v_customer_id,
        v_due_date,
        v_final_proceeds,
        'USD',
        true,
        'virtual',
        COALESCE(v_mechanism_type, 'spot'),
        NOW(),
        v_due_date,
        'pending',
        'Virtual Payment - Pending Confirmation',
        v_ref,
        'Test virtual payment via direct INSERT'
      )
      RETURNING id INTO v_payment_id;

      RAISE NOTICE '✅ Fallback INSERT succeeded!';
      RAISE NOTICE '   Payment ID: %', v_payment_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ Fallback INSERT also FAILED: %', SQLERRM;
      RETURN;
    END;
  END;

  RAISE NOTICE '';

  -- ÉTAPE 3: Tester le changement de status
  RAISE NOTICE '🔧 STEP 2: Updating sale status...';

  -- Essayer waiting_for_payment
  BEGIN
    UPDATE sales
    SET
      status = 'waiting_for_payment',
      updated_at = NOW()
    WHERE id = v_sale_id;

    IF FOUND THEN
      RAISE NOTICE '✅ Status updated to: waiting_for_payment';
    ELSE
      RAISE NOTICE '❌ Update did not affect any rows';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Status update to waiting_for_payment FAILED: %', SQLERRM;
    RAISE NOTICE '   Trying customer_approved fallback...';

    -- Fallback: customer_approved
    BEGIN
      UPDATE sales
      SET
        status = 'customer_approved',
        updated_at = NOW()
      WHERE id = v_sale_id;

      IF FOUND THEN
        RAISE NOTICE '✅ Status updated to: customer_approved (fallback)';
      ELSE
        RAISE NOTICE '❌ Fallback update also failed';
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ Fallback status update also FAILED: %', SQLERRM;
    END;
  END;

  RAISE NOTICE '';

  -- ÉTAPE 4: Vérifier le résultat
  RAISE NOTICE '🔍 VERIFICATION:';

  DECLARE
    v_new_status TEXT;
    v_payment_exists BOOLEAN;
  BEGIN
    SELECT status INTO v_new_status
    FROM sales
    WHERE id = v_sale_id;

    SELECT EXISTS (
      SELECT 1 FROM payments WHERE id = v_payment_id
    ) INTO v_payment_exists;

    RAISE NOTICE '   Sale Status: % → %', v_old_status, v_new_status;
    RAISE NOTICE '   Payment Exists: %', v_payment_exists;

    IF v_new_status = 'waiting_for_payment' OR v_new_status = 'customer_approved' THEN
      RAISE NOTICE '';
      RAISE NOTICE '✅✅✅ TEST PASSED! ✅✅✅';
      RAISE NOTICE 'Customer approval workflow is working correctly!';
    ELSE
      RAISE NOTICE '';
      RAISE NOTICE '❌❌❌ TEST FAILED! ❌❌❌';
      RAISE NOTICE 'Status did not change as expected';
    END IF;
  END;

  RAISE NOTICE '';
  RAISE NOTICE '📊 FINAL STATE:';
  RAISE NOTICE '   Sale ID: %', v_sale_id;
  RAISE NOTICE '   Sale Number: %', v_sale_number;
  RAISE NOTICE '   Payment ID: %', v_payment_id;
  RAISE NOTICE '';
  RAISE NOTICE 'To view the payment:';
  RAISE NOTICE '   SELECT * FROM payments WHERE id = ''%'';', v_payment_id;
  RAISE NOTICE 'To view the sale:';
  RAISE NOTICE '   SELECT * FROM sales WHERE id = ''%'';', v_sale_id;

END $$;

-- Afficher les résultats
SELECT
  'RESULT: Sale Status' as info,
  s.sale_number,
  s.status,
  s.updated_at
FROM sales s
WHERE status IN ('waiting_for_payment', 'customer_approved')
ORDER BY s.updated_at DESC
LIMIT 1;

SELECT
  'RESULT: Virtual Payment' as info,
  p.reference_number,
  p.is_virtual,
  p.payment_type,
  p.mechanism_type,
  p.virtual_due_date,
  p.status,
  p.created_at
FROM payments p
WHERE p.reference_number LIKE 'VP-%'
ORDER BY p.created_at DESC
LIMIT 1;
