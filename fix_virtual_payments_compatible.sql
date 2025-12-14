/*
  # Virtual Payments System - Compatible with Existing Structure
  
  This script works with the existing payments table structure that already has:
  - is_virtual boolean column
  - payment_type enum (virtual/actual)
  - virtual payment triggers
  
  It removes NOT NULL constraints and creates the auto-payment trigger.
*/

-- =====================================================
-- STEP 1: Fix NOT NULL constraints
-- =====================================================

-- bank_name and reference_number are NOT NULL but should be nullable for virtual payments
DO $$
BEGIN
  -- Check and remove NOT NULL from bank_name
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' 
    AND column_name = 'bank_name'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE payments ALTER COLUMN bank_name DROP NOT NULL;
    RAISE NOTICE '✓ Removed NOT NULL constraint from payments.bank_name';
  ELSE
    RAISE NOTICE '✓ bank_name is already nullable';
  END IF;

  -- Check and remove NOT NULL from reference_number
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' 
    AND column_name = 'reference_number'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE payments ALTER COLUMN reference_number DROP NOT NULL;
    RAISE NOTICE '✓ Removed NOT NULL constraint from payments.reference_number';
  ELSE
    RAISE NOTICE '✓ reference_number is already nullable';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Table structure updated for virtual payments';
END $$;

-- =====================================================
-- STEP 2: Create helper function to calculate expected date
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_virtual_payment_due_date(
  p_mechanism_type TEXT,
  p_approval_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate expected payment date based on mechanism type
  CASE p_mechanism_type
    WHEN 'spot' THEN
      RETURN p_approval_date;
    WHEN 'forward_7', 'forward_7_days' THEN
      RETURN p_approval_date + INTERVAL '7 days';
    WHEN 'forward_14', 'forward_14_days' THEN
      RETURN p_approval_date + INTERVAL '14 days';
    ELSE
      -- Default: 2 business days
      RETURN p_approval_date + INTERVAL '2 days';
  END CASE;
END;
$$;

RAISE NOTICE '✓ Function calculate_virtual_payment_due_date() created';

-- =====================================================
-- STEP 3: Create trigger function for virtual payment creation
-- =====================================================

CREATE OR REPLACE FUNCTION create_virtual_payment_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expected_date DATE;
  v_virtual_due_date DATE;
  v_invoice_number TEXT;
  v_payment_exists BOOLEAN;
BEGIN
  -- Only proceed if status changed to customer_approved
  IF NEW.status = 'customer_approved' AND
     (OLD IS NULL OR OLD.status != 'customer_approved') THEN

    -- Check if payment already exists for this sale
    SELECT EXISTS(
      SELECT 1 FROM payments WHERE sale_id = NEW.id
    ) INTO v_payment_exists;

    -- Only create if payment doesn't exist
    IF NOT v_payment_exists THEN
      -- Calculate dates based on mechanism type
      v_expected_date := calculate_virtual_payment_due_date(NEW.mechanism_type, CURRENT_DATE);
      v_virtual_due_date := v_expected_date + INTERVAL '30 days';

      -- Generate invoice number
      v_invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));

      -- Create VIRTUAL payment record with existing table structure
      INSERT INTO payments (
        -- Required fields
        sale_id,
        customer_id,
        expected_date,
        amount,
        currency,
        status,
        -- Virtual payment specific fields
        is_virtual,
        payment_type,
        mechanism_type,
        auto_credited_at,
        virtual_due_date,
        invoice_number,
        -- Nullable fields (will be filled when actual payment is received)
        bank_name,
        reference_number,
        payment_method,
        actual_date,
        account_number,
        transaction_id,
        proof_url,
        payment_proof_url,
        -- Audit fields
        created_by,
        created_at
      ) VALUES (
        -- Required fields
        NEW.id,                              -- sale_id
        NEW.customer_id,                     -- customer_id
        v_expected_date,                     -- expected_date
        NEW.final_proceeds,                  -- amount
        COALESCE(NEW.currency, 'USD'),       -- currency
        'pending',                           -- status
        -- Virtual payment specific fields
        true,                                -- is_virtual = true
        'virtual',                           -- payment_type = 'virtual'
        NEW.mechanism_type,                  -- mechanism_type from sale
        NOW(),                               -- auto_credited_at
        v_virtual_due_date,                  -- virtual_due_date
        v_invoice_number,                    -- invoice_number
        -- Nullable fields - will be filled later
        NULL,                                -- bank_name (to be filled)
        NULL,                                -- reference_number (to be filled)
        NULL,                                -- payment_method (to be filled)
        NULL,                                -- actual_date (to be filled)
        NULL,                                -- account_number
        NULL,                                -- transaction_id
        NULL,                                -- proof_url
        NULL,                                -- payment_proof_url
        -- Audit fields
        NEW.created_by,                      -- created_by
        NOW()                                -- created_at
      );

      RAISE NOTICE '✓ Virtual payment created for sale % (Invoice: %)', NEW.sale_number, v_invoice_number;
    ELSE
      RAISE NOTICE 'ℹ Payment already exists for sale %', NEW.sale_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

RAISE NOTICE '✓ Function create_virtual_payment_on_approval() created';

-- =====================================================
-- STEP 4: Create trigger on sales table
-- =====================================================

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_virtual_payment_on_approval ON sales;

-- Create new trigger
CREATE TRIGGER trigger_create_virtual_payment_on_approval
  AFTER INSERT OR UPDATE OF status
  ON sales
  FOR EACH ROW
  EXECUTE FUNCTION create_virtual_payment_on_approval();

RAISE NOTICE '✓ Trigger created on sales table';

-- =====================================================
-- STEP 5: Backfill existing customer_approved sales
-- =====================================================

DO $$
DECLARE
  v_sale RECORD;
  v_expected_date DATE;
  v_virtual_due_date DATE;
  v_invoice_number TEXT;
  v_created_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Backfilling virtual payments...';
  RAISE NOTICE '==========================================';

  FOR v_sale IN
    SELECT s.*
    FROM sales s
    LEFT JOIN payments p ON p.sale_id = s.id
    WHERE s.status IN ('customer_approved', 'waiting_for_payment')
      AND p.id IS NULL
    ORDER BY s.created_at
  LOOP
    -- Calculate dates
    v_expected_date := calculate_virtual_payment_due_date(v_sale.mechanism_type, CURRENT_DATE);
    v_virtual_due_date := v_expected_date + INTERVAL '30 days';

    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(v_sale.id::TEXT, 1, 8));

    -- Create virtual payment
    BEGIN
      INSERT INTO payments (
        sale_id,
        customer_id,
        expected_date,
        amount,
        currency,
        status,
        is_virtual,
        payment_type,
        mechanism_type,
        auto_credited_at,
        virtual_due_date,
        invoice_number,
        bank_name,
        reference_number,
        payment_method,
        actual_date,
        created_by,
        created_at
      ) VALUES (
        v_sale.id,
        v_sale.customer_id,
        v_expected_date,
        v_sale.final_proceeds,
        COALESCE(v_sale.currency, 'USD'),
        'pending',
        true,
        'virtual',
        v_sale.mechanism_type,
        NOW(),
        v_virtual_due_date,
        v_invoice_number,
        NULL,
        NULL,
        NULL,
        NULL,
        v_sale.created_by,
        NOW()
      );

      v_created_count := v_created_count + 1;
      RAISE NOTICE '  ✓ Created: % - % (% %)', 
        v_invoice_number, 
        v_sale.sale_number,
        v_sale.final_proceeds,
        COALESCE(v_sale.currency, 'USD');

    EXCEPTION WHEN OTHERS THEN
      v_skipped_count := v_skipped_count + 1;
      RAISE NOTICE '  ✗ Skipped: % - Error: %', v_sale.sale_number, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Backfill Summary:';
  RAISE NOTICE '  • Created: % virtual payments', v_created_count;
  RAISE NOTICE '  • Skipped: % (already exist or error)', v_skipped_count;
  RAISE NOTICE '==========================================';
END $$;

-- =====================================================
-- STEP 6: Verify setup
-- =====================================================

DO $$
DECLARE
  v_total_payments INTEGER;
  v_virtual_payments INTEGER;
  v_actual_payments INTEGER;
  v_pending_virtuals INTEGER;
  v_sales_awaiting INTEGER;
  v_trigger_exists BOOLEAN;
BEGIN
  -- Count payments
  SELECT COUNT(*) INTO v_total_payments FROM payments;
  SELECT COUNT(*) INTO v_virtual_payments FROM payments WHERE payment_type = 'virtual';
  SELECT COUNT(*) INTO v_actual_payments FROM payments WHERE payment_type = 'actual';
  SELECT COUNT(*) INTO v_pending_virtuals FROM payments WHERE payment_type = 'virtual' AND status = 'pending';
  SELECT COUNT(*) INTO v_sales_awaiting FROM sales WHERE status IN ('customer_approved', 'waiting_for_payment');

  -- Check trigger exists
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_create_virtual_payment_on_approval'
  ) INTO v_trigger_exists;

  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  Virtual Payments System - Setup Complete             ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Current State:';
  RAISE NOTICE '   ├─ Total payments:        %', v_total_payments;
  RAISE NOTICE '   ├─ Virtual payments:      %', v_virtual_payments;
  RAISE NOTICE '   ├─ Actual payments:       %', v_actual_payments;
  RAISE NOTICE '   ├─ Pending virtuals:      %', v_pending_virtuals;
  RAISE NOTICE '   └─ Sales awaiting payment: %', v_sales_awaiting;
  RAISE NOTICE '';
  RAISE NOTICE '⚙️  System Components:';
  RAISE NOTICE '   ├─ Trigger: trigger_create_virtual_payment_on_approval [%]', 
    CASE WHEN v_trigger_exists THEN 'ACTIVE' ELSE 'MISSING' END;
  RAISE NOTICE '   ├─ Function: create_virtual_payment_on_approval()';
  RAISE NOTICE '   └─ Helper: calculate_virtual_payment_due_date()';
  RAISE NOTICE '';
  RAISE NOTICE '✅ System ready!';
  RAISE NOTICE '   When a sale status changes to "customer_approved",';
  RAISE NOTICE '   a virtual payment will be automatically created.';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Next steps:';
  RAISE NOTICE '   1. Open /payments in your application';
  RAISE NOTICE '   2. You should see % pending virtual payment(s)', v_pending_virtuals;
  RAISE NOTICE '   3. When actual payment is received, convert virtual→actual';
  RAISE NOTICE '';
END $$;
