/*
  # Create Virtual Payments System

  1. Create/Update payments table with proper structure
  2. Create trigger to automatically create payment records when sale is customer_approved
  3. Set up RLS policies for payments table

  ## Requirements:
  - When a sale status changes to 'customer_approved', automatically create a payment record
  - Payment should have status 'waiting_for_payment'
  - Expected date calculated based on mechanism_type:
    * spot: current date
    * forward_7_days: current date + 7 days
    * forward_14_days: current date + 14 days
    * default: current date + 2 days
*/

-- =====================================================
-- STEP 1: Create or update payments table
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number TEXT,
  expected_date DATE NOT NULL,
  actual_date DATE,
  due_date DATE,
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate DECIMAL(10, 6) DEFAULT 1.0,
  bank_name TEXT,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  proof_url TEXT,
  notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_expected_date ON payments(expected_date);

-- =====================================================
-- STEP 2: Enable RLS on payments table
-- =====================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view all payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated users to create payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated users to update payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated users to delete payments" ON payments;

-- Create RLS policies
CREATE POLICY "Allow authenticated users to view all payments"
  ON payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to create payments"
  ON payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update payments"
  ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete payments"
  ON payments FOR DELETE TO authenticated USING (true);

-- =====================================================
-- STEP 3: Create function to calculate expected date
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_payment_expected_date(
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
      RETURN p_approval_date; -- Immediate payment
    WHEN 'forward_7', 'forward_7_days' THEN
      RETURN p_approval_date + INTERVAL '7 days';
    WHEN 'forward_14', 'forward_14_days' THEN
      RETURN p_approval_date + INTERVAL '14 days';
    ELSE
      RETURN p_approval_date + INTERVAL '2 days'; -- Default: 2 business days
  END CASE;
END;
$$;

-- =====================================================
-- STEP 4: Create trigger function for automatic payment creation
-- =====================================================

CREATE OR REPLACE FUNCTION create_virtual_payment_on_customer_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expected_date DATE;
  v_invoice_number TEXT;
  v_payment_exists BOOLEAN;
BEGIN
  -- Only proceed if status changed to customer_approved or waiting_for_payment
  IF NEW.status IN ('customer_approved', 'waiting_for_payment') AND
     (OLD.status IS NULL OR OLD.status NOT IN ('customer_approved', 'waiting_for_payment')) THEN

    -- Check if payment already exists for this sale
    SELECT EXISTS(
      SELECT 1 FROM payments WHERE sale_id = NEW.id
    ) INTO v_payment_exists;

    -- Only create if payment doesn't exist
    IF NOT v_payment_exists THEN
      -- Calculate expected date based on mechanism type
      v_expected_date := calculate_payment_expected_date(NEW.mechanism_type, CURRENT_DATE);

      -- Generate invoice number
      v_invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));

      -- Create virtual payment record
      INSERT INTO payments (
        sale_id,
        customer_id,
        invoice_number,
        expected_date,
        due_date,
        amount,
        currency,
        status,
        created_by,
        created_at
      ) VALUES (
        NEW.id,
        NEW.customer_id,
        v_invoice_number,
        v_expected_date,
        v_expected_date + INTERVAL '30 days', -- Due date: 30 days grace period
        NEW.final_proceeds,
        COALESCE(NEW.currency, 'USD'),
        'pending',
        NEW.created_by,
        NOW()
      );

      RAISE NOTICE 'Virtual payment created for sale %', NEW.sale_number;
    ELSE
      RAISE NOTICE 'Payment already exists for sale %', NEW.sale_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 5: Create trigger on sales table
-- =====================================================

DROP TRIGGER IF EXISTS trigger_create_virtual_payment ON sales;

CREATE TRIGGER trigger_create_virtual_payment
  AFTER INSERT OR UPDATE OF status
  ON sales
  FOR EACH ROW
  EXECUTE FUNCTION create_virtual_payment_on_customer_approval();

-- =====================================================
-- STEP 6: Backfill existing customer_approved sales
-- =====================================================

DO $$
DECLARE
  v_sale RECORD;
  v_expected_date DATE;
  v_invoice_number TEXT;
  v_created_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Backfilling virtual payments for existing customer_approved sales...';

  FOR v_sale IN
    SELECT s.*
    FROM sales s
    LEFT JOIN payments p ON p.sale_id = s.id
    WHERE s.status IN ('customer_approved', 'waiting_for_payment')
      AND p.id IS NULL -- No payment exists yet
  LOOP
    -- Calculate expected date
    v_expected_date := calculate_payment_expected_date(v_sale.mechanism_type, CURRENT_DATE);

    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(v_sale.id::TEXT, 1, 8));

    -- Create payment
    INSERT INTO payments (
      sale_id,
      customer_id,
      invoice_number,
      expected_date,
      due_date,
      amount,
      currency,
      status,
      created_by,
      created_at
    ) VALUES (
      v_sale.id,
      v_sale.customer_id,
      v_invoice_number,
      v_expected_date,
      v_expected_date + INTERVAL '30 days',
      v_sale.final_proceeds,
      COALESCE(v_sale.currency, 'USD'),
      'pending',
      v_sale.created_by,
      NOW()
    );

    v_created_count := v_created_count + 1;
    RAISE NOTICE 'Created payment for sale: %', v_sale.sale_number;
  END LOOP;

  RAISE NOTICE '✅ Backfill complete: % virtual payments created', v_created_count;
END $$;

-- =====================================================
-- STEP 7: Verify setup
-- =====================================================

DO $$
DECLARE
  v_payments_count INTEGER;
  v_sales_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_payments_count FROM payments;
  SELECT COUNT(*) INTO v_sales_count FROM sales WHERE status IN ('customer_approved', 'waiting_for_payment');

  RAISE NOTICE '';
  RAISE NOTICE '=== Virtual Payments System Setup Complete ===';
  RAISE NOTICE 'Total payments in system: %', v_payments_count;
  RAISE NOTICE 'Total sales awaiting payment: %', v_sales_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Trigger: trigger_create_virtual_payment ON sales';
  RAISE NOTICE 'Function: create_virtual_payment_on_customer_approval()';
  RAISE NOTICE 'Helper: calculate_payment_expected_date()';
  RAISE NOTICE '';
  RAISE NOTICE '✅ System ready: New customer-approved sales will automatically create payment records';
END $$;
