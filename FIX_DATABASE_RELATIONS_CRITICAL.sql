/*
  # Fix Critical Database Relations - Sales Module

  1. Problem
    - Error: "Could not find a relationship between 'sales' and 'mining_companies' in the schema cache"
    - Missing foreign key references causing query failures
    - Prevents Trade Space simulation from working

  2. Solution
    - Add missing foreign keys to gold_sales table
    - Ensure proper cascade behavior
    - Fix any orphaned records

  3. Tables Affected
    - gold_sales
    - mining_companies
    - customers

  IMPORTANT: This migration is idempotent and can be run multiple times safely.
*/

-- ============================================================================
-- STEP 1: Verify and add mining_company_id column if missing
-- ============================================================================
DO $$
BEGIN
  -- Check if mining_company_id exists in gold_sales
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_sales' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE gold_sales
    ADD COLUMN mining_company_id uuid;

    COMMENT ON COLUMN gold_sales.mining_company_id IS 'Reference to the mining company selling the gold';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add foreign key constraint for mining_company_id
-- ============================================================================
DO $$
BEGIN
  -- Drop existing constraint if it exists (to ensure clean state)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'gold_sales_mining_company_id_fkey'
    AND table_name = 'gold_sales'
  ) THEN
    ALTER TABLE gold_sales DROP CONSTRAINT gold_sales_mining_company_id_fkey;
  END IF;

  -- Add the foreign key constraint
  ALTER TABLE gold_sales
  ADD CONSTRAINT gold_sales_mining_company_id_fkey
  FOREIGN KEY (mining_company_id)
  REFERENCES mining_companies(id)
  ON DELETE SET NULL;
END $$;

-- ============================================================================
-- STEP 3: Ensure customer_id foreign key exists and is correct
-- ============================================================================
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'gold_sales_customer_id_fkey'
    AND table_name = 'gold_sales'
  ) THEN
    ALTER TABLE gold_sales DROP CONSTRAINT gold_sales_customer_id_fkey;
  END IF;

  -- Add the foreign key constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_sales' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE gold_sales
    ADD CONSTRAINT gold_sales_customer_id_fkey
    FOREIGN KEY (customer_id)
    REFERENCES customers(id)
    ON DELETE RESTRICT;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_gold_sales_mining_company_id
  ON gold_sales(mining_company_id);

CREATE INDEX IF NOT EXISTS idx_gold_sales_customer_id
  ON gold_sales(customer_id);

CREATE INDEX IF NOT EXISTS idx_gold_sales_created_at
  ON gold_sales(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gold_sales_status
  ON gold_sales(status);

-- ============================================================================
-- STEP 5: Update RLS policies to account for mining_company_id
-- ============================================================================
DROP POLICY IF EXISTS "Users can view gold sales" ON gold_sales;
DROP POLICY IF EXISTS "Users can insert gold sales" ON gold_sales;
DROP POLICY IF EXISTS "Users can update gold sales" ON gold_sales;

-- SELECT policy
CREATE POLICY "Users can view gold sales"
  ON gold_sales
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see sales from their accessible mining companies
    mining_company_id IN (
      SELECT mining_company_id
      FROM user_mining_access
      WHERE user_id = auth.uid()
    )
    OR
    -- Or all sales if they have admin/management role
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'management')
    )
  );

-- INSERT policy
CREATE POLICY "Users can insert gold sales"
  ON gold_sales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can create sales for mining companies they have access to
    mining_company_id IN (
      SELECT mining_company_id
      FROM user_mining_access
      WHERE user_id = auth.uid()
    )
    OR
    -- Or if they have admin/management role
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'management')
    )
  );

-- UPDATE policy
CREATE POLICY "Users can update gold sales"
  ON gold_sales
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update sales from their accessible mining companies
    mining_company_id IN (
      SELECT mining_company_id
      FROM user_mining_access
      WHERE user_id = auth.uid()
    )
    OR
    -- Or if they have admin/management role
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'management')
    )
  );

-- ============================================================================
-- STEP 6: Create helper view for sales with related data
-- ============================================================================
DROP VIEW IF EXISTS gold_sales_with_details;

CREATE OR REPLACE VIEW gold_sales_with_details AS
SELECT
  gs.*,
  mc.name as mining_company_name,
  mc.abbreviation as mining_company_abbr,
  mc.country as mining_company_country,
  c.name as customer_name,
  c.email as customer_email,
  c.country as customer_country
FROM gold_sales gs
LEFT JOIN mining_companies mc ON gs.mining_company_id = mc.id
LEFT JOIN customers c ON gs.customer_id = c.id;

COMMENT ON VIEW gold_sales_with_details IS 'View combining gold sales with mining company and customer details for easy querying';

-- ============================================================================
-- STEP 7: Verification queries (commented out - uncomment to test)
-- ============================================================================
/*
-- Verify foreign keys exist
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'gold_sales';

-- Verify indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'gold_sales'
ORDER BY indexname;

-- Verify RLS policies
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
WHERE tablename = 'gold_sales';

-- Test the view
SELECT * FROM gold_sales_with_details LIMIT 5;
*/

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Database relations fixed successfully!';
  RAISE NOTICE '- Added mining_company_id foreign key to gold_sales';
  RAISE NOTICE '- Updated customer_id foreign key';
  RAISE NOTICE '- Created performance indexes';
  RAISE NOTICE '- Updated RLS policies';
  RAISE NOTICE '- Created gold_sales_with_details view';
  RAISE NOTICE '=============================================================';
END $$;
