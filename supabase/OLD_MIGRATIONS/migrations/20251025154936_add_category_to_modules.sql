/*
  # Add Category to Modules

  1. Changes
    - Add `category` column to modules table for organizing permissions by functional area
    - Update existing modules with appropriate categories

  2. Categories
    - batches: Batch Management operations
    - sales: Sales and customer management
    - operations: Operational tasks (shipping, refining, receiving)
    - analytics: Reports and analytics
    - system: System administration
*/

-- Add category column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules' AND column_name = 'category'
  ) THEN
    ALTER TABLE modules ADD COLUMN category TEXT DEFAULT 'system';
  END IF;
END $$;

-- Update categories for existing modules
UPDATE modules SET category = 'batches' WHERE name IN ('batches', 'batches_view', 'batches_create');
UPDATE modules SET category = 'sales' WHERE name IN ('sales', 'sales_view', 'sales_create', 'customers', 'customers_view', 'customers_manage', 'payments');
UPDATE modules SET category = 'operations' WHERE name IN ('shipping', 'receiving', 'refining', 'quality_control');
UPDATE modules SET category = 'analytics' WHERE name IN ('analytics', 'analytics_dashboard', 'reports', 'dashboard');
UPDATE modules SET category = 'system' WHERE name IN ('users', 'users_manage', 'settings', 'system_settings', 'audit', 'audit_trail');

-- Add comment
COMMENT ON COLUMN modules.category IS 'Functional category for organizing modules in permission UI';
