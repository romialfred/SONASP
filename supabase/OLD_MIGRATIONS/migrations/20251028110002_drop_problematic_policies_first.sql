/*
  # Drop Problematic Policies First

  This migration drops all existing problematic policies before recreating them.
  This ensures we start with a clean slate.
*/

-- Drop all existing policies on batch_approvals if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'batch_approvals') THEN
    DROP POLICY IF EXISTS "Users can view all batch approvals" ON batch_approvals;
    DROP POLICY IF EXISTS "Users can create approvals for their actions" ON batch_approvals;
    DROP POLICY IF EXISTS "Users can create approvals" ON batch_approvals;
  END IF;
END $$;

-- Drop all existing policies on system_parameters if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_parameters') THEN
    DROP POLICY IF EXISTS "All users can view active system parameters" ON system_parameters;
    DROP POLICY IF EXISTS "Only management can modify system parameters" ON system_parameters;
  END IF;
END $$;

-- Drop all existing policies on gold_inventory if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gold_inventory') THEN
    DROP POLICY IF EXISTS "Users can view all inventory" ON gold_inventory;
    DROP POLICY IF EXISTS "Refinery and management can add inventory" ON gold_inventory;
    DROP POLICY IF EXISTS "Management can update inventory" ON gold_inventory;
  END IF;
END $$;

-- Drop all existing policies on inventory_transactions if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_transactions') THEN
    DROP POLICY IF EXISTS "Users can view all inventory transactions" ON inventory_transactions;
    DROP POLICY IF EXISTS "System can create inventory transactions" ON inventory_transactions;
  END IF;
END $$;
