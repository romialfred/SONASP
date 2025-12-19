/*
  # Create Inventory Transactions System

  1. New Tables
    - inventory_transactions: Track all inventory movements (entries, exits, transfers)

  2. Purpose
    - Track stock movements for mines, customers, and refineries
    - Provide complete audit trail for inventory
    - Support the business rule: mines sell to Mansa Resources (automatic stock transfer)
    - Enable balance calculations for any entity

  3. Security
    - Enable RLS
    - Policies for authenticated users based on roles
*/

-- =====================================================
-- 1. CREATE INVENTORY_TRANSACTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Transaction details
  transaction_type text NOT NULL CHECK (transaction_type IN ('entry', 'exit', 'adjustment', 'sale', 'purchase', 'production', 'refining', 'transfer')),
  transaction_date timestamptz NOT NULL DEFAULT now(),

  -- Entity (owner of the inventory)
  entity_type text NOT NULL CHECK (entity_type IN ('mining_company', 'customer', 'refinery')),
  entity_id uuid NOT NULL,

  -- Quantities (negative for exits, positive for entries)
  quantity_oz numeric(12, 4) NOT NULL,
  quantity_grams numeric(12, 4) NOT NULL,

  -- Reference to source transaction (optional)
  reference_type text CHECK (reference_type IN ('sale', 'purchase', 'production', 'refining', 'shipment', 'adjustment')),
  reference_id uuid,

  -- Additional information
  notes text,

  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_quantities CHECK (
    (quantity_oz > 0 AND quantity_grams > 0 AND transaction_type IN ('entry', 'purchase', 'production')) OR
    (quantity_oz < 0 AND quantity_grams < 0 AND transaction_type IN ('exit', 'sale', 'refining')) OR
    (transaction_type IN ('adjustment', 'transfer'))
  )
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_entity
  ON inventory_transactions(entity_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date
  ON inventory_transactions(transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type
  ON inventory_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference
  ON inventory_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created
  ON inventory_transactions(created_at DESC);

-- =====================================================
-- 3. CREATE UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_inventory_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_inventory_transactions_updated_at_trigger ON inventory_transactions;

CREATE TRIGGER update_inventory_transactions_updated_at_trigger
  BEFORE UPDATE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_transactions_updated_at();

-- =====================================================
-- 4. CREATE BALANCE CALCULATION VIEW
-- =====================================================

CREATE OR REPLACE VIEW inventory_balances AS
SELECT
  entity_type,
  entity_id,
  SUM(quantity_oz) as balance_oz,
  SUM(quantity_grams) as balance_grams,
  COUNT(*) as transaction_count,
  MAX(transaction_date) as last_transaction_date
FROM inventory_transactions
GROUP BY entity_type, entity_id;

-- =====================================================
-- 5. CREATE HELPER FUNCTION FOR BALANCE
-- =====================================================

CREATE OR REPLACE FUNCTION get_entity_inventory_balance(
  p_entity_id uuid,
  p_entity_type text
)
RETURNS TABLE (
  balance_oz numeric,
  balance_grams numeric,
  transaction_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(quantity_oz), 0) as balance_oz,
    COALESCE(SUM(quantity_grams), 0) as balance_grams,
    COUNT(*) as transaction_count
  FROM inventory_transactions
  WHERE entity_id = p_entity_id
    AND entity_type = p_entity_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. CREATE RLS POLICIES
-- =====================================================

-- Policy: Allow authenticated users to view all transactions
DROP POLICY IF EXISTS "Users can view all inventory transactions" ON inventory_transactions;
CREATE POLICY "Users can view all inventory transactions"
  ON inventory_transactions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to insert transactions
DROP POLICY IF EXISTS "Users can create inventory transactions" ON inventory_transactions;
CREATE POLICY "Users can create inventory transactions"
  ON inventory_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only admin or creator can update transactions
DROP POLICY IF EXISTS "Users can update own inventory transactions" ON inventory_transactions;
CREATE POLICY "Users can update own inventory transactions"
  ON inventory_transactions
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  ));

-- Policy: Only admin can delete transactions
DROP POLICY IF EXISTS "Admins can delete inventory transactions" ON inventory_transactions;
CREATE POLICY "Admins can delete inventory transactions"
  ON inventory_transactions
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  ));

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT ON inventory_transactions TO authenticated;
GRANT UPDATE, DELETE ON inventory_transactions TO authenticated;

-- Grant access to the view
GRANT SELECT ON inventory_balances TO authenticated;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION get_entity_inventory_balance TO authenticated;

-- =====================================================
-- 9. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE inventory_transactions IS 'Track all inventory movements for mines, customers, and refineries';
COMMENT ON COLUMN inventory_transactions.transaction_type IS 'Type of transaction: entry, exit, adjustment, sale, purchase, production, refining, transfer';
COMMENT ON COLUMN inventory_transactions.entity_type IS 'Type of entity owning the inventory: mining_company, customer, refinery';
COMMENT ON COLUMN inventory_transactions.entity_id IS 'UUID of the entity (mining_company, customer, or refinery)';
COMMENT ON COLUMN inventory_transactions.quantity_oz IS 'Quantity in troy ounces (negative for exits, positive for entries)';
COMMENT ON COLUMN inventory_transactions.quantity_grams IS 'Quantity in grams (negative for exits, positive for entries)';
COMMENT ON COLUMN inventory_transactions.reference_type IS 'Type of source transaction: sale, purchase, production, refining, shipment, adjustment';
COMMENT ON COLUMN inventory_transactions.reference_id IS 'UUID of the source transaction';

-- =====================================================
-- 10. VERIFICATION QUERIES (FOR TESTING)
-- =====================================================

-- Verify table was created
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'inventory_transactions'
-- ORDER BY ordinal_position;

-- Test the balance function
-- SELECT * FROM get_entity_inventory_balance(
--   'uuid-of-entity'::uuid,
--   'mining_company'
-- );

-- View all balances
-- SELECT * FROM inventory_balances;
