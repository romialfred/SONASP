/*
  # Create Pre-Sales Module

  1. Purpose
    - Create pre-sales system for selling validated batches before they arrive at factory
    - Track customer accounts receivable
    - Automatic matching when inventory arrives
    - Follow same workflow as regular sales
    - Intelligent deduction management

  2. New Tables
    - `pre_sales` - Main pre-sales records
    - `pre_sales_inventory_matches` - Track automatic inventory matching
    - `customer_accounts_receivable` - Track amounts owed to customers

  3. Key Features
    - Pre-sell validated batches (status: validated_for_transport)
    - Automatic conversion to regular sale when inventory arrives
    - Customer account tracking (we owe them)
    - Same approval workflow as sales
    - Deduction tracking and reconciliation

  4. Security
    - Enable RLS on all tables
    - Policies for authenticated users
    - Audit trail integration
*/

-- ============================================================================
-- TABLE: pre_sales
-- ============================================================================

CREATE TABLE IF NOT EXISTS pre_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pre-Sale Information
  pre_sale_number text UNIQUE NOT NULL,
  batch_id uuid NOT NULL REFERENCES batches(id),
  customer_id uuid NOT NULL REFERENCES customers(id),

  -- Sale Details (same structure as sales)
  quantity_oz numeric(12, 4) NOT NULL CHECK (quantity_oz > 0),
  london_am_rate numeric(12, 2) NOT NULL CHECK (london_am_rate > 0),

  -- Calculations
  gross_proceeds numeric(15, 2) NOT NULL,
  freight_cost numeric(12, 2) DEFAULT 0,
  other_costs numeric(12, 2) DEFAULT 0,
  net_proceeds numeric(15, 2) NOT NULL,
  royalty_rate numeric(5, 4) DEFAULT 0.03,
  royalty_amount numeric(15, 2) NOT NULL,
  final_proceeds numeric(15, 2) NOT NULL,

  -- Status Management (same workflow as sales)
  status text NOT NULL DEFAULT 'pending_management_approval' CHECK (status IN (
    'pending_management_approval',
    'management_approved',
    'management_rejected',
    'pending_for_customer_approval',
    'customer_approved',
    'customer_rejected',
    'waiting_for_payment',
    'payment_received',
    'inventory_arrived',  -- Special status for pre-sales
    'converted_to_sale',  -- Special status when converted
    'completed',
    'cancelled'
  )),

  -- Pre-Sale Specific Fields
  expected_arrival_date date,
  actual_arrival_date date,
  is_converted boolean DEFAULT false,
  converted_sale_id uuid REFERENCES sales(id),
  converted_at timestamptz,

  -- Seller tracking (same as sales)
  seller_id uuid,
  seller_type text CHECK (seller_type IN ('mining_company', 'mansa')),
  is_internal_sale boolean DEFAULT false,

  -- Approval tracking (same as sales)
  management_approved_at timestamptz,
  management_approved_by uuid REFERENCES auth.users(id),
  customer_approved_at timestamptz,
  customer_approved_by uuid REFERENCES auth.users(id),

  -- Payment tracking
  payment_type text CHECK (payment_type IN ('bank_transfer', 'cash', 'check', 'virtual')),
  payment_date date,
  customer_bank_id uuid REFERENCES customer_banks(id),
  fx_rate numeric(12, 6),

  -- Additional Information
  sale_date date DEFAULT CURRENT_DATE,
  notes text,

  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT pre_sales_valid_dates CHECK (actual_arrival_date IS NULL OR actual_arrival_date >= expected_arrival_date - INTERVAL '30 days')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pre_sales_batch_id ON pre_sales(batch_id);
CREATE INDEX IF NOT EXISTS idx_pre_sales_customer_id ON pre_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_pre_sales_status ON pre_sales(status);
CREATE INDEX IF NOT EXISTS idx_pre_sales_is_converted ON pre_sales(is_converted);
CREATE INDEX IF NOT EXISTS idx_pre_sales_converted_sale_id ON pre_sales(converted_sale_id) WHERE converted_sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pre_sales_sale_date ON pre_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_pre_sales_expected_arrival ON pre_sales(expected_arrival_date) WHERE is_converted = false;

-- Comments
COMMENT ON TABLE pre_sales IS 'Pre-sales of validated batches before inventory arrival';
COMMENT ON COLUMN pre_sales.pre_sale_number IS 'Unique pre-sale number (auto-generated)';
COMMENT ON COLUMN pre_sales.is_converted IS 'TRUE when pre-sale is converted to regular sale';
COMMENT ON COLUMN pre_sales.converted_sale_id IS 'Reference to the regular sale created from this pre-sale';
COMMENT ON COLUMN pre_sales.actual_arrival_date IS 'Date when the related batch inventory actually arrived';

-- ============================================================================
-- TABLE: pre_sales_inventory_matches
-- ============================================================================

CREATE TABLE IF NOT EXISTS pre_sales_inventory_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  pre_sale_id uuid NOT NULL REFERENCES pre_sales(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id),
  sale_id uuid REFERENCES sales(id),

  -- Match details
  matched_at timestamptz DEFAULT now(),
  matched_by uuid REFERENCES auth.users(id),

  -- Quantities
  pre_sale_quantity_oz numeric(12, 4) NOT NULL,
  actual_quantity_oz numeric(12, 4) NOT NULL,
  variance_oz numeric(12, 4) GENERATED ALWAYS AS (actual_quantity_oz - pre_sale_quantity_oz) STORED,
  variance_percentage numeric(8, 4) GENERATED ALWAYS AS (
    CASE
      WHEN pre_sale_quantity_oz > 0 THEN ((actual_quantity_oz - pre_sale_quantity_oz) / pre_sale_quantity_oz * 100)
      ELSE 0
    END
  ) STORED,

  -- Match status
  match_status text DEFAULT 'matched' CHECK (match_status IN ('matched', 'variance_detected', 'reconciled', 'failed')),
  reconciliation_notes text,
  reconciled_at timestamptz,
  reconciled_by uuid REFERENCES auth.users(id),

  -- Metadata
  created_at timestamptz DEFAULT now(),

  CONSTRAINT unique_pre_sale_match UNIQUE(pre_sale_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pre_sales_matches_pre_sale ON pre_sales_inventory_matches(pre_sale_id);
CREATE INDEX IF NOT EXISTS idx_pre_sales_matches_batch ON pre_sales_inventory_matches(batch_id);
CREATE INDEX IF NOT EXISTS idx_pre_sales_matches_sale ON pre_sales_inventory_matches(sale_id);
CREATE INDEX IF NOT EXISTS idx_pre_sales_matches_status ON pre_sales_inventory_matches(match_status);

COMMENT ON TABLE pre_sales_inventory_matches IS 'Tracks automatic matching of pre-sales to arrived inventory';

-- ============================================================================
-- TABLE: customer_accounts_receivable
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id uuid NOT NULL REFERENCES customers(id),
  pre_sale_id uuid REFERENCES pre_sales(id),
  sale_id uuid REFERENCES sales(id),

  -- Account details
  transaction_type text NOT NULL CHECK (transaction_type IN ('pre_sale', 'payment', 'adjustment', 'conversion')),
  amount numeric(15, 2) NOT NULL,
  currency text DEFAULT 'USD',

  -- Balance tracking
  previous_balance numeric(15, 2) DEFAULT 0,
  new_balance numeric(15, 2) NOT NULL,

  -- Transaction details
  transaction_date date DEFAULT CURRENT_DATE,
  description text NOT NULL,
  reference_number text,

  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'cancelled')),
  cleared_at timestamptz,

  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_transaction_amount CHECK (
    (transaction_type = 'payment' AND amount > 0) OR
    (transaction_type IN ('pre_sale', 'adjustment', 'conversion') AND amount != 0)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_ar_customer_id ON customer_accounts_receivable(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ar_pre_sale_id ON customer_accounts_receivable(pre_sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_ar_status ON customer_accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_customer_ar_transaction_date ON customer_accounts_receivable(transaction_date);
CREATE INDEX IF NOT EXISTS idx_customer_ar_customer_status ON customer_accounts_receivable(customer_id, status);

COMMENT ON TABLE customer_accounts_receivable IS 'Tracks amounts we owe to customers from pre-sales';

-- ============================================================================
-- FUNCTIONS: Pre-Sale Number Generation
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_pre_sale_number()
RETURNS text AS $$
DECLARE
  v_year text;
  v_month text;
  v_count integer;
  v_number text;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YY');
  v_month := to_char(CURRENT_DATE, 'MM');

  SELECT COUNT(*) + 1 INTO v_count
  FROM pre_sales
  WHERE pre_sale_number LIKE 'PS-' || v_year || v_month || '%';

  v_number := 'PS-' || v_year || v_month || '-' || LPAD(v_count::text, 4, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_pre_sale_number IS 'Generates unique pre-sale number (PS-YYMM-0001)';

-- ============================================================================
-- FUNCTIONS: Automatic Inventory Matching
-- ============================================================================

CREATE OR REPLACE FUNCTION match_presale_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_pre_sale record;
  v_match_id uuid;
  v_sale_id uuid;
  v_variance_oz numeric;
BEGIN
  -- Only trigger when batch arrives at factory (status changes to received_at_factory or processed)
  IF NEW.status IN ('received_at_factory', 'processed', 'inventory') AND
     (OLD.status IS NULL OR OLD.status NOT IN ('received_at_factory', 'processed', 'inventory')) THEN

    -- Find any pre-sales for this batch that haven't been converted yet
    FOR v_pre_sale IN
      SELECT * FROM pre_sales
      WHERE batch_id = NEW.id
        AND is_converted = false
        AND status IN ('customer_approved', 'waiting_for_payment', 'payment_received')
      ORDER BY created_at
    LOOP
      -- Update pre-sale status to inventory_arrived
      UPDATE pre_sales
      SET
        status = 'inventory_arrived',
        actual_arrival_date = CURRENT_DATE,
        updated_at = now()
      WHERE id = v_pre_sale.id;

      -- Calculate variance
      v_variance_oz := NEW.final_weight_oz - v_pre_sale.quantity_oz;

      -- Create inventory match record
      INSERT INTO pre_sales_inventory_matches (
        pre_sale_id,
        batch_id,
        pre_sale_quantity_oz,
        actual_quantity_oz,
        match_status,
        matched_by
      ) VALUES (
        v_pre_sale.id,
        NEW.id,
        v_pre_sale.quantity_oz,
        NEW.final_weight_oz,
        CASE
          WHEN ABS(v_variance_oz) <= (v_pre_sale.quantity_oz * 0.02) THEN 'matched'
          ELSE 'variance_detected'
        END,
        auth.uid()
      )
      RETURNING id INTO v_match_id;

      -- If variance is acceptable, automatically convert to regular sale
      IF ABS(v_variance_oz) <= (v_pre_sale.quantity_oz * 0.02) THEN
        -- Create regular sale from pre-sale
        INSERT INTO sales (
          sale_number,
          customer_id,
          batch_id,
          quantity_oz,
          london_am_rate,
          gross_proceeds,
          freight_cost,
          other_costs,
          net_proceeds,
          royalty_rate,
          royalty_amount,
          final_proceeds,
          status,
          seller_id,
          seller_type,
          is_internal_sale,
          payment_type,
          payment_date,
          customer_bank_id,
          fx_rate,
          sale_date,
          notes,
          created_by,
          management_approved_at,
          management_approved_by,
          customer_approved_at,
          customer_approved_by
        ) SELECT
          'S-' || substring(pre_sale_number from 4),  -- Convert PS-YYMM-0001 to S-YYMM-0001
          customer_id,
          batch_id,
          NEW.final_weight_oz,  -- Use actual arrived quantity
          london_am_rate,
          (NEW.final_weight_oz * london_am_rate),  -- Recalculate with actual quantity
          freight_cost,
          other_costs,
          (NEW.final_weight_oz * london_am_rate) - freight_cost - other_costs,
          royalty_rate,
          ((NEW.final_weight_oz * london_am_rate) - freight_cost - other_costs) * royalty_rate,
          ((NEW.final_weight_oz * london_am_rate) - freight_cost - other_costs) * (1 - royalty_rate),
          'completed',  -- Automatically mark as completed
          seller_id,
          seller_type,
          is_internal_sale,
          payment_type,
          payment_date,
          customer_bank_id,
          fx_rate,
          sale_date,
          'Auto-generated from pre-sale ' || pre_sale_number || '. ' || COALESCE(notes, ''),
          created_by,
          management_approved_at,
          management_approved_by,
          customer_approved_at,
          customer_approved_by
        FROM pre_sales
        WHERE id = v_pre_sale.id
        RETURNING id INTO v_sale_id;

        -- Update pre-sale with conversion info
        UPDATE pre_sales
        SET
          is_converted = true,
          converted_sale_id = v_sale_id,
          converted_at = now(),
          status = 'converted_to_sale',
          updated_at = now()
        WHERE id = v_pre_sale.id;

        -- Update match record with sale reference
        UPDATE pre_sales_inventory_matches
        SET sale_id = v_sale_id
        WHERE id = v_match_id;

        -- Create account receivable adjustment
        INSERT INTO customer_accounts_receivable (
          customer_id,
          pre_sale_id,
          sale_id,
          transaction_type,
          amount,
          previous_balance,
          new_balance,
          description,
          reference_number,
          status,
          cleared_at,
          created_by
        )
        SELECT
          v_pre_sale.customer_id,
          v_pre_sale.id,
          v_sale_id,
          'conversion',
          0,  -- No amount change, just conversion
          0,
          0,
          'Pre-sale ' || v_pre_sale.pre_sale_number || ' converted to sale upon inventory arrival',
          v_pre_sale.pre_sale_number,
          'cleared',
          now(),
          auth.uid();
      END IF;

      RAISE NOTICE 'Pre-sale % matched to batch %. Variance: % oz', v_pre_sale.pre_sale_number, NEW.batch_number, v_variance_oz;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION match_presale_to_inventory IS 'Automatically matches pre-sales to arrived inventory and converts to regular sales';

-- Create trigger for automatic matching
DROP TRIGGER IF EXISTS trigger_match_presale_to_inventory ON batches;
CREATE TRIGGER trigger_match_presale_to_inventory
  AFTER UPDATE ON batches
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION match_presale_to_inventory();

-- ============================================================================
-- FUNCTIONS: Customer Account Balance
-- ============================================================================

CREATE OR REPLACE FUNCTION get_customer_account_balance(p_customer_id uuid)
RETURNS numeric AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type = 'pre_sale' THEN amount
      WHEN transaction_type = 'payment' THEN -amount
      WHEN transaction_type = 'adjustment' THEN amount
      WHEN transaction_type = 'conversion' THEN 0
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM customer_accounts_receivable
  WHERE customer_id = p_customer_id
    AND status != 'cancelled';

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_customer_account_balance IS 'Calculate current account receivable balance for a customer';

-- ============================================================================
-- FUNCTIONS: Create Account Receivable Entry
-- ============================================================================

CREATE OR REPLACE FUNCTION create_account_receivable_for_presale()
RETURNS TRIGGER AS $$
DECLARE
  v_previous_balance numeric;
  v_new_balance numeric;
BEGIN
  -- Only create AR entry when pre-sale is approved by customer
  IF NEW.status = 'customer_approved' AND OLD.status != 'customer_approved' THEN
    -- Get previous balance
    v_previous_balance := get_customer_account_balance(NEW.customer_id);
    v_new_balance := v_previous_balance + NEW.final_proceeds;

    -- Create account receivable entry
    INSERT INTO customer_accounts_receivable (
      customer_id,
      pre_sale_id,
      transaction_type,
      amount,
      previous_balance,
      new_balance,
      description,
      reference_number,
      status,
      created_by
    ) VALUES (
      NEW.customer_id,
      NEW.id,
      'pre_sale',
      NEW.final_proceeds,
      v_previous_balance,
      v_new_balance,
      'Pre-sale ' || NEW.pre_sale_number || ' - We owe customer',
      NEW.pre_sale_number,
      'pending',
      auth.uid()
    );

    RAISE NOTICE 'Account receivable created for pre-sale %. Amount: $%, New balance: $%',
      NEW.pre_sale_number, NEW.final_proceeds, v_new_balance;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_create_ar_for_presale ON pre_sales;
CREATE TRIGGER trigger_create_ar_for_presale
  AFTER UPDATE ON pre_sales
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION create_account_receivable_for_presale();

-- ============================================================================
-- TRIGGER: Auto-generate pre-sale number
-- ============================================================================

CREATE OR REPLACE FUNCTION set_pre_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pre_sale_number IS NULL OR NEW.pre_sale_number = '' THEN
    NEW.pre_sale_number := generate_pre_sale_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_pre_sale_number ON pre_sales;
CREATE TRIGGER trigger_set_pre_sale_number
  BEFORE INSERT ON pre_sales
  FOR EACH ROW
  EXECUTE FUNCTION set_pre_sale_number();

-- ============================================================================
-- TRIGGER: Update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pre_sales_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  -- Set management approval timestamp
  IF NEW.status = 'management_approved' AND OLD.status != 'management_approved' THEN
    NEW.management_approved_at = now();
    IF NEW.management_approved_by IS NULL THEN
      NEW.management_approved_by = auth.uid();
    END IF;
  END IF;

  -- Set customer approval timestamp
  IF NEW.status = 'customer_approved' AND OLD.status != 'customer_approved' THEN
    NEW.customer_approved_at = now();
    IF NEW.customer_approved_by IS NULL THEN
      NEW.customer_approved_by = auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pre_sales_timestamps ON pre_sales;
CREATE TRIGGER trigger_update_pre_sales_timestamps
  BEFORE UPDATE ON pre_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_pre_sales_timestamps();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE pre_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_sales_inventory_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_accounts_receivable ENABLE ROW LEVEL SECURITY;

-- Pre-Sales Policies
CREATE POLICY "Users can view pre_sales" ON pre_sales
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create pre_sales" ON pre_sales
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update pre_sales" ON pre_sales
  FOR UPDATE TO authenticated
  USING (true);

-- Pre-Sales Inventory Matches Policies
CREATE POLICY "Users can view matches" ON pre_sales_inventory_matches
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create matches" ON pre_sales_inventory_matches
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update matches" ON pre_sales_inventory_matches
  FOR UPDATE TO authenticated
  USING (true);

-- Customer Accounts Receivable Policies
CREATE POLICY "Users can view accounts receivable" ON customer_accounts_receivable
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create accounts receivable" ON customer_accounts_receivable
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update accounts receivable" ON customer_accounts_receivable
  FOR UPDATE TO authenticated
  USING (true);

-- ============================================================================
-- VIEWS: Reporting and Dashboard
-- ============================================================================

CREATE OR REPLACE VIEW pre_sales_summary AS
SELECT
  ps.id,
  ps.pre_sale_number,
  ps.status,
  ps.customer_id,
  c.name as customer_name,
  ps.batch_id,
  b.batch_number,
  b.status as batch_status,
  ps.quantity_oz,
  ps.final_proceeds,
  ps.expected_arrival_date,
  ps.actual_arrival_date,
  ps.is_converted,
  ps.converted_sale_id,
  s.sale_number as converted_sale_number,
  ps.sale_date,
  ps.created_at,
  psim.match_status,
  psim.variance_oz,
  psim.variance_percentage
FROM pre_sales ps
LEFT JOIN customers c ON ps.customer_id = c.id
LEFT JOIN batches b ON ps.batch_id = b.id
LEFT JOIN sales s ON ps.converted_sale_id = s.id
LEFT JOIN pre_sales_inventory_matches psim ON ps.id = psim.pre_sale_id;

COMMENT ON VIEW pre_sales_summary IS 'Complete pre-sales information with related data';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON pre_sales TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pre_sales_inventory_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON customer_accounts_receivable TO authenticated;
GRANT SELECT ON pre_sales_summary TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Pre-Sales Module Created Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - pre_sales';
  RAISE NOTICE '  - pre_sales_inventory_matches';
  RAISE NOTICE '  - customer_accounts_receivable';
  RAISE NOTICE '';
  RAISE NOTICE 'Features enabled:';
  RAISE NOTICE '  ✓ Pre-sell validated batches';
  RAISE NOTICE '  ✓ Automatic inventory matching';
  RAISE NOTICE '  ✓ Customer account tracking';
  RAISE NOTICE '  ✓ Same workflow as regular sales';
  RAISE NOTICE '  ✓ Intelligent deduction management';
  RAISE NOTICE '  ✓ Automatic conversion to sales';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS enabled on all tables';
  RAISE NOTICE '========================================';
END $$;
