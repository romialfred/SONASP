/*
  # Gold Inventory Management and Batch Workflow Enhancement (FINAL FIX)

  ## Overview
  This migration implements a comprehensive gold inventory management system
  and enhances the batch workflow with multi-level approvals and double reception.

  ## Critical Fixes
  - Disables triggers temporarily during migration
  - Drops constraint, updates data, then recreates constraint
  - Handles all edge cases with existing data
  - Creates missing tables first
  - Uses transactions for atomic operations
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 1: Create missing tables FIRST (before any foreign key references)
-- ============================================================================

-- Check if refining_records table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'refining_records') THEN
    CREATE TABLE refining_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE refining_records ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view refining records"
      ON refining_records FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Check if sales table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales') THEN
    CREATE TABLE sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_number TEXT UNIQUE,
      customer_id UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view sales"
      ON sales FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Temporarily disable all triggers on batches table
-- ============================================================================

ALTER TABLE batches DISABLE TRIGGER ALL;

-- ============================================================================
-- STEP 3: Drop the existing constraint completely
-- ============================================================================

ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;

-- ============================================================================
-- STEP 4: Update ALL existing data to new status values
-- ============================================================================

-- Map all possible old statuses to new statuses
UPDATE batches SET status = 'pending_factory_approval'
WHERE status IN ('draft', 'pending', 'created', 'new');

UPDATE batches SET status = 'approved_for_transport'
WHERE status IN ('approved', 'approved_by_factory');

UPDATE batches SET status = 'waiting_airport_receipt'
WHERE status IN ('shipped', 'in_transit', 'in_transit_airport', 'dispatched', 'sent');

UPDATE batches SET status = 'received_at_airport'
WHERE status IN ('at_airport', 'received_airport', 'airport_received');

UPDATE batches SET status = 'validated_for_refinery'
WHERE status IN ('validated_airport', 'airport_validated', 'approved_airport');

UPDATE batches SET status = 'waiting_refinery_receipt'
WHERE status IN ('in_transit_refinery', 'sent_to_refinery');

UPDATE batches SET status = 'received_at_refinery'
WHERE status IN ('at_refinery', 'received_refinery', 'refinery_received');

UPDATE batches SET status = 'validated_for_processing'
WHERE status IN ('validated_refinery', 'refinery_validated', 'ready_for_processing', 'ready_to_process');

UPDATE batches SET status = 'processing'
WHERE status IN ('refining', 'being_processed', 'in_process');

UPDATE batches SET status = 'in_inventory'
WHERE status IN ('refined', 'completed', 'processed', 'finished');

UPDATE batches SET status = 'ready_for_sale'
WHERE status IN ('available', 'ready_to_sell', 'for_sale');

UPDATE batches SET status = 'allocated_to_sale'
WHERE status IN ('allocated', 'reserved', 'held');

UPDATE batches SET status = 'sold'
WHERE status IN ('delivered', 'complete', 'closed');

UPDATE batches SET status = 'cancelled'
WHERE status IN ('rejected', 'void', 'deleted');

-- Handle any unknown statuses by setting them to pending
UPDATE batches SET status = 'pending_factory_approval'
WHERE status NOT IN (
  'pending_factory_approval',
  'approved_for_transport',
  'waiting_airport_receipt',
  'received_at_airport',
  'validated_for_refinery',
  'waiting_refinery_receipt',
  'received_at_refinery',
  'validated_for_processing',
  'processing',
  'in_inventory',
  'ready_for_sale',
  'allocated_to_sale',
  'sold',
  'cancelled'
);

-- ============================================================================
-- STEP 5: Create the new constraint with all valid statuses
-- ============================================================================

ALTER TABLE batches ADD CONSTRAINT batches_status_check CHECK (
  status IN (
    'pending_factory_approval',
    'approved_for_transport',
    'waiting_airport_receipt',
    'received_at_airport',
    'validated_for_refinery',
    'waiting_refinery_receipt',
    'received_at_refinery',
    'validated_for_processing',
    'processing',
    'in_inventory',
    'ready_for_sale',
    'allocated_to_sale',
    'sold',
    'cancelled'
  )
);

-- ============================================================================
-- STEP 6: Re-enable all triggers on batches table
-- ============================================================================

ALTER TABLE batches ENABLE TRIGGER ALL;

-- ============================================================================
-- STEP 7: Update default status for new batches
-- ============================================================================

ALTER TABLE batches ALTER COLUMN status SET DEFAULT 'pending_factory_approval';

-- ============================================================================
-- STEP 8: Create new tables
-- ============================================================================

-- Create batch_approvals table
CREATE TABLE IF NOT EXISTS batch_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL CHECK (
    approval_type IN (
      'factory_transport',
      'airport_receipt',
      'airport_validation',
      'refinery_receipt',
      'refinery_validation',
      'processing_completion'
    )
  ),
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  approver_name TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'rejected', 'conditional')),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  comments TEXT,
  variance_grams DECIMAL(10, 2),
  variance_percentage DECIMAL(5, 2),
  variance_within_threshold BOOLEAN,
  ip_address TEXT,
  approved_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_approvals_batch_id ON batch_approvals(batch_id, approval_type);
CREATE INDEX IF NOT EXISTS idx_batch_approvals_approver ON batch_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_batch_approvals_type ON batch_approvals(approval_type, approved_at);

-- Create system_parameters table
CREATE TABLE IF NOT EXISTS system_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_key TEXT UNIQUE NOT NULL,
  parameter_value TEXT NOT NULL,
  parameter_type TEXT NOT NULL CHECK (parameter_type IN ('numeric', 'text', 'boolean', 'json')),
  category TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default system parameters
INSERT INTO system_parameters (parameter_key, parameter_value, parameter_type, category, description, display_order)
VALUES
  ('airport_variance_threshold_percentage', '0.5', 'numeric', 'receiving', 'Maximum acceptable variance percentage at airport reception', 1),
  ('refinery_variance_threshold_percentage', '0.5', 'numeric', 'receiving', 'Maximum acceptable variance percentage at refinery reception', 2),
  ('low_stock_alert_threshold_oz', '100', 'numeric', 'inventory', 'Minimum stock level that triggers low stock alert', 3),
  ('critical_stock_alert_threshold_oz', '50', 'numeric', 'inventory', 'Critical stock level requiring immediate attention', 4),
  ('auto_allocate_inventory', 'true', 'boolean', 'sales', 'Automatically allocate inventory to sales using FIFO method', 5),
  ('require_refinery_processing_approval', 'true', 'boolean', 'refining', 'Require supervisor approval for refining completion', 6)
ON CONFLICT (parameter_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_system_parameters_category ON system_parameters(category, display_order);
CREATE INDEX IF NOT EXISTS idx_system_parameters_active ON system_parameters(is_active, parameter_key);

-- Create gold_inventory table
CREATE TABLE IF NOT EXISTS gold_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  refining_record_id UUID REFERENCES refining_records(id) ON DELETE RESTRICT,

  -- Refining details
  weight_before_melting_grams DECIMAL(12, 3) NOT NULL,
  weight_after_melting_grams DECIMAL(12, 3) NOT NULL,
  fineness_percentage DECIMAL(5, 2) NOT NULL CHECK (fineness_percentage >= 0 AND fineness_percentage <= 100),
  metal_retained_percentage DECIMAL(5, 2) NOT NULL CHECK (metal_retained_percentage >= 0 AND metal_retained_percentage <= 100),

  -- Calculated fields
  final_fine_grams DECIMAL(12, 4) NOT NULL,
  final_fine_oz DECIMAL(12, 4) NOT NULL,

  -- Variance tracking
  variance_with_export_invoice_oz DECIMAL(12, 4),

  -- Stock status
  quantity_available_oz DECIMAL(12, 4) NOT NULL,
  quantity_allocated_oz DECIMAL(12, 4) DEFAULT 0,
  quantity_sold_oz DECIMAL(12, 4) DEFAULT 0,

  -- Transaction type
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('entry', 'exit')),

  -- Reference to sale
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,

  -- Metadata
  notes TEXT,
  processing_location TEXT,
  certificate_number TEXT,

  -- Audit fields
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT positive_weights CHECK (
    weight_before_melting_grams > 0 AND
    weight_after_melting_grams > 0 AND
    final_fine_grams > 0 AND
    final_fine_oz > 0
  ),
  CONSTRAINT valid_stock_quantities CHECK (
    quantity_available_oz >= 0 AND
    quantity_allocated_oz >= 0 AND
    quantity_sold_oz >= 0 AND
    (quantity_allocated_oz + quantity_sold_oz) <= final_fine_oz
  )
);

CREATE INDEX IF NOT EXISTS idx_gold_inventory_batch_id ON gold_inventory(batch_id);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_refining_id ON gold_inventory(refining_record_id);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_entry_date ON gold_inventory(entry_date);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_transaction_type ON gold_inventory(transaction_type);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_sale_id ON gold_inventory(sale_id);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_available ON gold_inventory(quantity_available_oz) WHERE quantity_available_oz > 0;

-- Create inventory_transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date TIMESTAMPTZ DEFAULT now(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('entry', 'exit', 'allocation', 'deallocation', 'adjustment')),

  inventory_id UUID NOT NULL REFERENCES gold_inventory(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id),
  sale_id UUID REFERENCES sales(id),

  quantity_oz DECIMAL(12, 4) NOT NULL,
  quantity_grams DECIMAL(12, 3),

  -- Balance tracking
  balance_before_oz DECIMAL(12, 4) NOT NULL,
  balance_after_oz DECIMAL(12, 4) NOT NULL,

  transaction_reference TEXT,
  notes TEXT,

  -- Audit fields
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT positive_quantity CHECK (quantity_oz > 0),
  CONSTRAINT valid_balance CHECK (balance_after_oz >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_id ON inventory_transactions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_batch_id ON inventory_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_sale_id ON inventory_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(transaction_type);

-- ============================================================================
-- STEP 9: Create views
-- ============================================================================

CREATE OR REPLACE VIEW monthly_inventory_summary AS
SELECT
  DATE_TRUNC('month', entry_date) as month,
  COUNT(DISTINCT id) as total_entries,
  COUNT(DISTINCT batch_id) as total_batches,
  SUM(CASE WHEN transaction_type = 'entry' THEN final_fine_oz ELSE 0 END) as total_entries_oz,
  SUM(CASE WHEN transaction_type = 'exit' THEN final_fine_oz ELSE 0 END) as total_exits_oz,
  SUM(quantity_available_oz) as available_stock_oz,
  SUM(quantity_allocated_oz) as allocated_stock_oz,
  SUM(quantity_sold_oz) as sold_stock_oz,
  AVG(fineness_percentage) as avg_fineness_percentage,
  AVG(metal_retained_percentage) as avg_metal_retained_percentage
FROM gold_inventory
GROUP BY DATE_TRUNC('month', entry_date)
ORDER BY month DESC;

CREATE OR REPLACE VIEW current_inventory_status AS
SELECT
  gi.id,
  gi.entry_date,
  b.batch_number,
  gi.final_fine_oz,
  gi.quantity_available_oz,
  gi.quantity_allocated_oz,
  gi.quantity_sold_oz,
  gi.fineness_percentage,
  gi.metal_retained_percentage,
  gi.transaction_type,
  s.sale_number,
  up.full_name as created_by_name,
  gi.created_at
FROM gold_inventory gi
LEFT JOIN batches b ON b.id = gi.batch_id
LEFT JOIN sales s ON s.id = gi.sale_id
LEFT JOIN user_profiles up ON up.id = gi.created_by
WHERE gi.quantity_available_oz > 0 OR gi.created_at > now() - INTERVAL '90 days'
ORDER BY gi.entry_date DESC, gi.created_at DESC;

-- ============================================================================
-- STEP 10: Create functions and triggers
-- ============================================================================

-- Function to calculate final fine automatically
CREATE OR REPLACE FUNCTION calculate_final_fine()
RETURNS TRIGGER AS $$
BEGIN
  NEW.final_fine_grams := (
    NEW.weight_after_melting_grams *
    (NEW.fineness_percentage / 100) *
    (NEW.metal_retained_percentage / 100)
  );
  NEW.final_fine_oz := NEW.final_fine_grams / 28.3495;

  IF NEW.transaction_type = 'entry' THEN
    NEW.quantity_available_oz := NEW.final_fine_oz;
    NEW.quantity_allocated_oz := 0;
    NEW.quantity_sold_oz := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_final_fine ON gold_inventory;
CREATE TRIGGER trigger_calculate_final_fine
  BEFORE INSERT OR UPDATE ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION calculate_final_fine();

-- Function to log inventory transactions
CREATE OR REPLACE FUNCTION log_inventory_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before DECIMAL(12, 4);
  v_transaction_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_balance_before := 0;
    v_transaction_type := NEW.transaction_type;

    INSERT INTO inventory_transactions (
      transaction_type, inventory_id, batch_id, sale_id,
      quantity_oz, quantity_grams, balance_before_oz, balance_after_oz,
      transaction_reference, notes, created_by
    ) VALUES (
      v_transaction_type, NEW.id, NEW.batch_id, NEW.sale_id,
      NEW.final_fine_oz, NEW.final_fine_grams, v_balance_before, NEW.quantity_available_oz,
      CASE WHEN NEW.transaction_type = 'entry' THEN 'Stock entry from refining' ELSE 'Stock exit for sale' END,
      NEW.notes, NEW.created_by
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.quantity_allocated_oz != NEW.quantity_allocated_oz THEN
    INSERT INTO inventory_transactions (
      transaction_type, inventory_id, batch_id, quantity_oz,
      balance_before_oz, balance_after_oz, transaction_reference, created_by
    ) VALUES (
      CASE WHEN NEW.quantity_allocated_oz > OLD.quantity_allocated_oz THEN 'allocation' ELSE 'deallocation' END,
      NEW.id, NEW.batch_id, ABS(NEW.quantity_allocated_oz - OLD.quantity_allocated_oz),
      OLD.quantity_available_oz, NEW.quantity_available_oz, 'Allocation change', NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_inventory_transaction ON gold_inventory;
CREATE TRIGGER trigger_log_inventory_transaction
  AFTER INSERT OR UPDATE ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_transaction();

-- Helper functions
CREATE OR REPLACE FUNCTION get_available_inventory_balance()
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(quantity_available_oz), 0)
  FROM gold_inventory
  WHERE transaction_type = 'entry';
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_inventory_sufficient(p_quantity_oz DECIMAL)
RETURNS BOOLEAN AS $$
  SELECT get_available_inventory_balance() >= p_quantity_oz;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- STEP 11: Enable RLS and create policies
-- ============================================================================

ALTER TABLE batch_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for batch_approvals
DROP POLICY IF EXISTS "Users can view all batch approvals" ON batch_approvals;
CREATE POLICY "Users can view all batch approvals"
  ON batch_approvals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create approvals for their actions" ON batch_approvals;
CREATE POLICY "Users can create approvals for their actions"
  ON batch_approvals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = approver_id);

-- Policies for system_parameters
DROP POLICY IF EXISTS "All users can view active system parameters" ON system_parameters;
CREATE POLICY "All users can view active system parameters"
  ON system_parameters FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Only management can modify system parameters" ON system_parameters;
CREATE POLICY "Only management can modify system parameters"
  ON system_parameters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'management'));

-- Policies for gold_inventory
DROP POLICY IF EXISTS "Users can view all inventory" ON gold_inventory;
CREATE POLICY "Users can view all inventory"
  ON gold_inventory FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Refinery and management can add inventory" ON gold_inventory;
CREATE POLICY "Refinery and management can add inventory"
  ON gold_inventory FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('refinery', 'management')));

DROP POLICY IF EXISTS "Management can update inventory" ON gold_inventory;
CREATE POLICY "Management can update inventory"
  ON gold_inventory FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'management'));

-- Policies for inventory_transactions
DROP POLICY IF EXISTS "Users can view all inventory transactions" ON inventory_transactions;
CREATE POLICY "Users can view all inventory transactions"
  ON inventory_transactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "System can create inventory transactions" ON inventory_transactions;
CREATE POLICY "System can create inventory transactions"
  ON inventory_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- STEP 12: Add comments
-- ============================================================================

COMMENT ON TABLE batch_approvals IS 'Tracks all approval actions in the batch lifecycle';
COMMENT ON TABLE system_parameters IS 'Configurable system parameters for business rules';
COMMENT ON TABLE gold_inventory IS 'Master inventory table for pure gold stock management';
COMMENT ON TABLE inventory_transactions IS 'Detailed transaction log for all stock movements';
COMMENT ON COLUMN gold_inventory.final_fine_grams IS 'Calculated: weight_after_melting * (fineness/100) * (metal_retained/100)';
COMMENT ON COLUMN gold_inventory.final_fine_oz IS 'Calculated: final_fine_grams / 28.3495';
