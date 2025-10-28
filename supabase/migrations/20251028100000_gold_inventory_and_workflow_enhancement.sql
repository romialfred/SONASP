/*
  # Gold Inventory Management and Batch Workflow Enhancement

  ## Overview
  This migration implements a comprehensive gold inventory management system
  and enhances the batch workflow with multi-level approvals and double reception.

  ## Key Features
  1. Enhanced batch workflow with factory approval before transport
  2. Separate reception processes at Airport and Refinery
  3. Professional gold inventory management system
  4. Stock tracking with entries (additions) and exits (sales)
  5. Monthly consolidation and reconciliation
  6. Complete audit trail for all approvals and stock movements

  ## New Tables

  ### 1. batch_approvals
  Tracks all approval actions throughout the batch lifecycle
  - Factory approval before transport
  - Airport validation after receipt
  - Refinery validation after receipt
  - Processing completion approval

  ### 2. gold_inventory
  Master inventory table for pure gold stock management
  - Tracks all refined gold entering inventory
  - Links to original batches and refining records
  - Maintains stock balance with transaction type (entry/exit)
  - Monthly aggregations for reporting

  ### 3. inventory_transactions
  Detailed transaction log for all stock movements
  - Entry transactions (from refining)
  - Exit transactions (from sales)
  - FIFO allocation tracking
  - Complete audit trail

  ### 4. system_parameters
  Configuration table for business rules
  - Variance thresholds for airport and refinery
  - Stock alert levels
  - Commission rates
  - Other configurable settings

  ## Enhanced Batch Statuses
  New workflow statuses:
  - pending_factory_approval: Initial state after creation
  - approved_for_transport: Factory approved, ready to ship
  - waiting_airport_receipt: In transit to airport
  - received_at_airport: Received at airport, awaiting validation
  - validated_for_refinery: Airport validated, ready for refinery
  - waiting_refinery_receipt: In transit to refinery
  - received_at_refinery: Received at refinery, awaiting validation
  - validated_for_processing: Refinery validated, ready to process
  - processing: Being refined
  - in_inventory: Added to gold inventory
  - ready_for_sale: Available for sale
  - allocated_to_sale: Reserved for a sale
  - sold: Sold and removed from inventory

  ## Security
  - RLS enabled on all tables
  - Role-based access controls
  - Approval workflow validation
  - Stock balance integrity checks
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing status constraint and recreate with new statuses
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;

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

-- Update default status for new batches
ALTER TABLE batches ALTER COLUMN status SET DEFAULT 'pending_factory_approval';

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

CREATE INDEX idx_batch_approvals_batch_id ON batch_approvals(batch_id, approval_type);
CREATE INDEX idx_batch_approvals_approver ON batch_approvals(approver_id);
CREATE INDEX idx_batch_approvals_type ON batch_approvals(approval_type, approved_at);

-- Create system_parameters table for configurable settings
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

CREATE INDEX idx_system_parameters_category ON system_parameters(category, display_order);
CREATE INDEX idx_system_parameters_active ON system_parameters(is_active, parameter_key);

-- Create gold_inventory table (master inventory)
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

  -- Calculated fields (computed automatically)
  final_fine_grams DECIMAL(12, 4) NOT NULL,
  final_fine_oz DECIMAL(12, 4) NOT NULL,

  -- Variance tracking
  variance_with_export_invoice_oz DECIMAL(12, 4),

  -- Stock status
  quantity_available_oz DECIMAL(12, 4) NOT NULL,
  quantity_allocated_oz DECIMAL(12, 4) DEFAULT 0,
  quantity_sold_oz DECIMAL(12, 4) DEFAULT 0,

  -- Transaction type (entry = adding to stock, exit = removing from stock)
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('entry', 'exit')),

  -- Reference to sale if this is an exit transaction
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

CREATE INDEX idx_gold_inventory_batch_id ON gold_inventory(batch_id);
CREATE INDEX idx_gold_inventory_refining_id ON gold_inventory(refining_record_id);
CREATE INDEX idx_gold_inventory_entry_date ON gold_inventory(entry_date);
CREATE INDEX idx_gold_inventory_transaction_type ON gold_inventory(transaction_type);
CREATE INDEX idx_gold_inventory_sale_id ON gold_inventory(sale_id);
CREATE INDEX idx_gold_inventory_available ON gold_inventory(quantity_available_oz) WHERE quantity_available_oz > 0;

-- Create inventory_transactions table for detailed transaction log
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

CREATE INDEX idx_inventory_transactions_inventory_id ON inventory_transactions(inventory_id);
CREATE INDEX idx_inventory_transactions_batch_id ON inventory_transactions(batch_id);
CREATE INDEX idx_inventory_transactions_sale_id ON inventory_transactions(sale_id);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(transaction_date);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);

-- Create monthly_inventory_summary view for reporting
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

-- Create current_inventory_status view
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

-- Function to calculate final fine automatically
CREATE OR REPLACE FUNCTION calculate_final_fine()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate final fine in grams
  NEW.final_fine_grams := (
    NEW.weight_after_melting_grams *
    (NEW.fineness_percentage / 100) *
    (NEW.metal_retained_percentage / 100)
  );

  -- Convert to ounces (1 oz = 28.3495 grams)
  NEW.final_fine_oz := NEW.final_fine_grams / 28.3495;

  -- For entry transactions, set available quantity equal to final fine
  IF NEW.transaction_type = 'entry' THEN
    NEW.quantity_available_oz := NEW.final_fine_oz;
    NEW.quantity_allocated_oz := 0;
    NEW.quantity_sold_oz := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_final_fine
  BEFORE INSERT OR UPDATE ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION calculate_final_fine();

-- Function to log inventory transactions automatically
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
      transaction_type,
      inventory_id,
      batch_id,
      sale_id,
      quantity_oz,
      quantity_grams,
      balance_before_oz,
      balance_after_oz,
      transaction_reference,
      notes,
      created_by
    ) VALUES (
      v_transaction_type,
      NEW.id,
      NEW.batch_id,
      NEW.sale_id,
      NEW.final_fine_oz,
      NEW.final_fine_grams,
      v_balance_before,
      NEW.quantity_available_oz,
      CASE
        WHEN NEW.transaction_type = 'entry' THEN 'Stock entry from refining'
        ELSE 'Stock exit for sale'
      END,
      NEW.notes,
      NEW.created_by
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log changes in allocated or sold quantities
    IF OLD.quantity_allocated_oz != NEW.quantity_allocated_oz THEN
      INSERT INTO inventory_transactions (
        transaction_type,
        inventory_id,
        batch_id,
        quantity_oz,
        balance_before_oz,
        balance_after_oz,
        transaction_reference,
        created_by
      ) VALUES (
        CASE
          WHEN NEW.quantity_allocated_oz > OLD.quantity_allocated_oz THEN 'allocation'
          ELSE 'deallocation'
        END,
        NEW.id,
        NEW.batch_id,
        ABS(NEW.quantity_allocated_oz - OLD.quantity_allocated_oz),
        OLD.quantity_available_oz,
        NEW.quantity_available_oz,
        'Allocation change',
        NEW.created_by
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_inventory_transaction
  AFTER INSERT OR UPDATE ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_transaction();

-- Function to get available inventory balance
CREATE OR REPLACE FUNCTION get_available_inventory_balance()
RETURNS DECIMAL AS $$
DECLARE
  v_total_available DECIMAL(12, 4);
BEGIN
  SELECT COALESCE(SUM(quantity_available_oz), 0)
  INTO v_total_available
  FROM gold_inventory
  WHERE transaction_type = 'entry';

  RETURN v_total_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if sufficient inventory is available
CREATE OR REPLACE FUNCTION check_inventory_sufficient(
  p_quantity_oz DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_available DECIMAL(12, 4);
BEGIN
  v_available := get_available_inventory_balance();
  RETURN v_available >= p_quantity_oz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to allocate inventory to a sale (FIFO method)
CREATE OR REPLACE FUNCTION allocate_inventory_to_sale(
  p_sale_id UUID,
  p_quantity_oz DECIMAL,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_remaining DECIMAL(12, 4) := p_quantity_oz;
  v_inventory RECORD;
  v_to_allocate DECIMAL(12, 4);
BEGIN
  -- Check if sufficient inventory available
  IF NOT check_inventory_sufficient(p_quantity_oz) THEN
    RAISE EXCEPTION 'Insufficient inventory available. Required: % oz, Available: % oz',
      p_quantity_oz, get_available_inventory_balance();
  END IF;

  -- Allocate from oldest entries first (FIFO)
  FOR v_inventory IN
    SELECT id, quantity_available_oz, final_fine_oz
    FROM gold_inventory
    WHERE transaction_type = 'entry'
      AND quantity_available_oz > 0
    ORDER BY entry_date ASC, created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_to_allocate := LEAST(v_remaining, v_inventory.quantity_available_oz);

    -- Update inventory record
    UPDATE gold_inventory
    SET
      quantity_available_oz = quantity_available_oz - v_to_allocate,
      quantity_allocated_oz = quantity_allocated_oz + v_to_allocate,
      updated_at = now()
    WHERE id = v_inventory.id;

    -- Create allocation record in sales_allocations if table exists
    BEGIN
      INSERT INTO sales_allocations (
        sale_id,
        allocated_quantity_oz,
        allocated_fine_oz,
        allocation_status,
        allocated_by
      ) VALUES (
        p_sale_id,
        v_to_allocate,
        v_to_allocate,
        'reserved',
        p_user_id
      );
    EXCEPTION WHEN undefined_table THEN
      -- Table doesn't exist yet, skip
      NULL;
    END;

    v_remaining := v_remaining - v_to_allocate;
  END LOOP;

  RETURN v_remaining <= 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release allocated inventory (e.g., when sale is cancelled)
CREATE OR REPLACE FUNCTION release_inventory_allocation(
  p_sale_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Return allocated quantities to available
  UPDATE gold_inventory gi
  SET
    quantity_available_oz = quantity_available_oz + COALESCE(sa.allocated_quantity_oz, 0),
    quantity_allocated_oz = quantity_allocated_oz - COALESCE(sa.allocated_quantity_oz, 0),
    updated_at = now()
  FROM sales_allocations sa
  WHERE sa.sale_id = p_sale_id
    AND gi.id IN (
      SELECT DISTINCT gi2.id
      FROM gold_inventory gi2
      WHERE EXISTS (
        SELECT 1 FROM sales_allocations sa2
        WHERE sa2.sale_id = p_sale_id
      )
    );

  -- Update allocation status
  UPDATE sales_allocations
  SET
    allocation_status = 'released',
    released_at = now()
  WHERE sale_id = p_sale_id
    AND allocation_status IN ('reserved', 'confirmed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete sale and move from allocated to sold
CREATE OR REPLACE FUNCTION complete_inventory_sale(
  p_sale_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Move allocated quantities to sold
  UPDATE gold_inventory gi
  SET
    quantity_allocated_oz = 0,
    quantity_sold_oz = quantity_sold_oz + COALESCE(sa.allocated_quantity_oz, 0),
    updated_at = now()
  FROM sales_allocations sa
  WHERE sa.sale_id = p_sale_id
    AND allocation_status = 'confirmed';

  -- Update allocation status
  UPDATE sales_allocations
  SET allocation_status = 'delivered'
  WHERE sale_id = p_sale_id
    AND allocation_status = 'confirmed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on new tables
ALTER TABLE batch_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for batch_approvals
CREATE POLICY "Users can view all batch approvals"
  ON batch_approvals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create approvals for their actions"
  ON batch_approvals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = approver_id);

-- RLS Policies for system_parameters
CREATE POLICY "All users can view active system parameters"
  ON system_parameters FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Only management can modify system parameters"
  ON system_parameters FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policies for gold_inventory
CREATE POLICY "Users can view all inventory"
  ON gold_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Refinery and management can add inventory"
  ON gold_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('refinery', 'management')
    )
  );

CREATE POLICY "Management can update inventory"
  ON gold_inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policies for inventory_transactions
CREATE POLICY "Users can view all inventory transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can create inventory transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add helpful comments to tables
COMMENT ON TABLE batch_approvals IS 'Tracks all approval actions in the batch lifecycle';
COMMENT ON TABLE system_parameters IS 'Configurable system parameters for business rules';
COMMENT ON TABLE gold_inventory IS 'Master inventory table for pure gold stock management';
COMMENT ON TABLE inventory_transactions IS 'Detailed transaction log for all stock movements';

COMMENT ON COLUMN gold_inventory.final_fine_grams IS 'Calculated: weight_after_melting * (fineness/100) * (metal_retained/100)';
COMMENT ON COLUMN gold_inventory.final_fine_oz IS 'Calculated: final_fine_grams / 28.3495';
COMMENT ON COLUMN gold_inventory.quantity_available_oz IS 'Current available quantity for sale';
COMMENT ON COLUMN gold_inventory.quantity_allocated_oz IS 'Quantity reserved for pending sales';
COMMENT ON COLUMN gold_inventory.quantity_sold_oz IS 'Quantity sold and removed from inventory';
