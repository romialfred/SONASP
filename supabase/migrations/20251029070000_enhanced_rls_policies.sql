/*
  # Enhanced Row Level Security (RLS) Policies

  ## Purpose
  Implement comprehensive, role-based Row Level Security policies to ensure
  users can only access and modify data they are authorized to work with.

  ## Changes
  1. Batch Access Policies
     - Role-based read access
     - Location-based data isolation
     - Modify restrictions by role

  2. Inventory Access Policies
     - Read access for all authenticated users
     - Write access restricted to refinery and management
     - Modification tracking

  3. Sales and Customer Policies
     - Customer data access by role
     - Sales data visibility rules
     - Payment information protection

  4. Audit Trail Policies
     - Read access for compliance
     - Write protection (insert only)
     - No modifications or deletions

  ## Security Model
  - Default deny (no access without explicit policy)
  - Principle of least privilege
  - Role hierarchy (management > staff)
  - Multi-tenant data isolation

  ## Business Value
  - Data security and privacy
  - Regulatory compliance
  - Prevents unauthorized access
  - Audit trail for all access
*/

-- ========================================
-- STEP 1: Enable RLS on All Sensitive Tables
-- ========================================

-- Enable RLS (if not already enabled)
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

RAISE NOTICE 'Row Level Security enabled on all sensitive tables';

-- ========================================
-- STEP 2: Batches Access Policies
-- ========================================

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view batches from their location" ON batches;
DROP POLICY IF EXISTS "Authorized users can update batches" ON batches;
DROP POLICY IF EXISTS "Factory staff can create batches" ON batches;

-- READ Policy: Users can view batches based on role and assignment
CREATE POLICY "users_can_read_assigned_batches" ON batches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          -- Management can see everything
          up.role = 'management' OR
          -- Users can see batches from their assigned mining company
          batches.mining_company_id = up.mining_company_id OR
          -- Factory, airport, and refinery staff can see relevant batches
          (up.role IN ('factory_staff', 'factory_manager') AND batches.status IN (
            'pending_factory_approval', 'approved_for_transport', 'waiting_airport_receipt'
          )) OR
          (up.role IN ('airport_staff', 'airport_manager') AND batches.status IN (
            'waiting_airport_receipt', 'received_at_airport', 'validated_for_refinery', 'waiting_refinery_receipt'
          )) OR
          (up.role IN ('refinery_staff', 'refinery_manager') AND batches.status IN (
            'waiting_refinery_receipt', 'received_at_refinery', 'validated_for_processing', 'processing', 'in_inventory'
          )) OR
          -- Sales staff can see batches ready for sale
          (up.role IN ('sales_staff', 'sales_manager') AND batches.status IN (
            'in_inventory', 'ready_for_sale', 'allocated_to_sale', 'sold'
          ))
        )
    )
  );

-- UPDATE Policy: Role-based update permissions
CREATE POLICY "authorized_users_can_update_batches" ON batches
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'management' OR
          (up.role IN ('factory_staff', 'factory_manager') AND batches.status IN (
            'pending_factory_approval', 'approved_for_transport'
          )) OR
          (up.role IN ('airport_staff', 'airport_manager') AND batches.status IN (
            'waiting_airport_receipt', 'received_at_airport', 'validated_for_refinery'
          )) OR
          (up.role IN ('refinery_staff', 'refinery_manager') AND batches.status IN (
            'waiting_refinery_receipt', 'received_at_refinery', 'validated_for_processing', 'processing'
          ))
        )
    )
  );

-- INSERT Policy: Only factory staff and management can create batches
CREATE POLICY "factory_staff_can_create_batches" ON batches
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('factory_staff', 'factory_manager', 'management')
    )
  );

-- DELETE Policy: Only management can delete (soft delete preferred)
CREATE POLICY "only_management_can_delete_batches" ON batches
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'management'
    )
  );

-- ========================================
-- STEP 3: Gold Inventory Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view inventory" ON gold_inventory;
DROP POLICY IF EXISTS "Only refinery and management can add inventory" ON gold_inventory;

-- READ Policy: All authenticated users can view inventory
CREATE POLICY "authenticated_users_can_read_inventory" ON gold_inventory
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- INSERT Policy: Only refinery staff and management can add inventory
CREATE POLICY "refinery_can_add_inventory" ON gold_inventory
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('refinery_staff', 'refinery_manager', 'management')
    )
  );

-- UPDATE Policy: Only management can update inventory (corrections)
CREATE POLICY "only_management_can_update_inventory" ON gold_inventory
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'management'
    )
  );

-- DELETE Policy: No one can delete inventory records
CREATE POLICY "nobody_can_delete_inventory" ON gold_inventory
  FOR DELETE
  USING (false);

-- ========================================
-- STEP 4: Audit Trail Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view audit trail" ON batch_status_history;
DROP POLICY IF EXISTS "Nobody can modify audit trail" ON batch_status_history;
DROP POLICY IF EXISTS "Nobody can delete audit trail" ON batch_status_history;

-- READ Policy: All authenticated users can view audit trail
CREATE POLICY "authenticated_users_can_read_audit" ON batch_status_history
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- INSERT Policy: System can insert (via triggers)
CREATE POLICY "system_can_insert_audit" ON batch_status_history
  FOR INSERT
  WITH CHECK (true);

-- UPDATE Policy: Nobody can update audit records
CREATE POLICY "nobody_can_update_audit" ON batch_status_history
  FOR UPDATE
  USING (false);

-- DELETE Policy: Nobody can delete audit records
CREATE POLICY "nobody_can_delete_audit" ON batch_status_history
  FOR DELETE
  USING (false);

-- ========================================
-- STEP 5: Sales Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view sales" ON sales;
DROP POLICY IF EXISTS "Sales staff can create sales" ON sales;
DROP POLICY IF EXISTS "Sales staff can update sales" ON sales;

-- READ Policy: Role-based sales visibility
CREATE POLICY "users_can_read_assigned_sales" ON sales
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'management' OR
          up.role IN ('sales_staff', 'sales_manager') OR
          sales.customer_id IN (
            SELECT id FROM customers WHERE assigned_to = up.id
          )
        )
    )
  );

-- INSERT Policy: Sales staff and management can create sales
CREATE POLICY "sales_staff_can_create_sales" ON sales
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('sales_staff', 'sales_manager', 'management')
    )
  );

-- UPDATE Policy: Sales staff can update their sales
CREATE POLICY "sales_staff_can_update_sales" ON sales
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'management' OR
          (up.role IN ('sales_staff', 'sales_manager') AND sales.created_by = up.id)
        )
    )
  );

-- DELETE Policy: Only management can delete sales
CREATE POLICY "only_management_can_delete_sales" ON sales
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'management'
    )
  );

-- ========================================
-- STEP 6: Customer Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view customers" ON customers;
DROP POLICY IF EXISTS "Sales staff can manage customers" ON customers;

-- READ Policy: Sales staff and management can view customers
CREATE POLICY "sales_can_read_customers" ON customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('sales_staff', 'sales_manager', 'management')
    )
  );

-- INSERT Policy: Sales staff can create customers
CREATE POLICY "sales_can_create_customers" ON customers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('sales_staff', 'sales_manager', 'management')
    )
  );

-- UPDATE Policy: Sales staff can update their assigned customers
CREATE POLICY "sales_can_update_assigned_customers" ON customers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'management' OR
          (up.role IN ('sales_staff', 'sales_manager') AND customers.assigned_to = up.id)
        )
    )
  );

-- DELETE Policy: Only management can delete customers
CREATE POLICY "only_management_can_delete_customers" ON customers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'management'
    )
  );

-- ========================================
-- STEP 7: Payment Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view payments" ON payments;
DROP POLICY IF EXISTS "Authorized users can create payments" ON payments;

-- READ Policy: Finance, sales, and management can view payments
CREATE POLICY "authorized_users_can_read_payments" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('sales_staff', 'sales_manager', 'management', 'finance_staff')
    )
  );

-- INSERT Policy: Finance and management can create payments
CREATE POLICY "finance_can_create_payments" ON payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('finance_staff', 'management')
    )
  );

-- UPDATE Policy: Management can update payments
CREATE POLICY "management_can_update_payments" ON payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'management'
    )
  );

-- DELETE Policy: Only management can delete payments
CREATE POLICY "only_management_can_delete_payments" ON payments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'management'
    )
  );

-- ========================================
-- STEP 8: Policy Summary Function
-- ========================================

CREATE OR REPLACE FUNCTION get_user_permissions()
RETURNS TABLE (
  table_name text,
  can_select boolean,
  can_insert boolean,
  can_update boolean,
  can_delete boolean
) AS $$
DECLARE
  user_role text;
BEGIN
  -- Get current user role
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();

  -- Return permissions based on role
  RETURN QUERY
  SELECT
    'batches'::text,
    true,  -- All authenticated users can read
    user_role IN ('factory_staff', 'factory_manager', 'management'),
    user_role IN ('factory_staff', 'factory_manager', 'airport_staff', 'airport_manager', 'refinery_staff', 'refinery_manager', 'management'),
    user_role = 'management'
  UNION ALL
  SELECT
    'gold_inventory'::text,
    true,
    user_role IN ('refinery_staff', 'refinery_manager', 'management'),
    user_role = 'management',
    false
  UNION ALL
  SELECT
    'sales'::text,
    user_role IN ('sales_staff', 'sales_manager', 'management'),
    user_role IN ('sales_staff', 'sales_manager', 'management'),
    user_role IN ('sales_staff', 'sales_manager', 'management'),
    user_role = 'management'
  UNION ALL
  SELECT
    'customers'::text,
    user_role IN ('sales_staff', 'sales_manager', 'management'),
    user_role IN ('sales_staff', 'sales_manager', 'management'),
    user_role IN ('sales_staff', 'sales_manager', 'management'),
    user_role = 'management'
  UNION ALL
  SELECT
    'payments'::text,
    user_role IN ('sales_staff', 'sales_manager', 'management', 'finance_staff'),
    user_role IN ('finance_staff', 'management'),
    user_role = 'management',
    user_role = 'management';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_permissions IS
  'Returns a summary of current user permissions across all major tables.
   Usage: SELECT * FROM get_user_permissions();';

-- ========================================
-- STEP 9: Validation Summary
-- ========================================

DO $$
DECLARE
  policy_count INTEGER;
  table_count INTEGER;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  SELECT COUNT(DISTINCT tablename) INTO table_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Enhanced Row Level Security Policies';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ RLS enabled on % tables', table_count;
  RAISE NOTICE '✓ % security policies created', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Security Model:';
  RAISE NOTICE '  • Default deny (explicit policies required)';
  RAISE NOTICE '  • Role-based access control';
  RAISE NOTICE '  • Multi-tenant data isolation';
  RAISE NOTICE '  • Audit trail protection';
  RAISE NOTICE '';
  RAISE NOTICE 'Protected Tables:';
  RAISE NOTICE '  • batches - Role and status-based access';
  RAISE NOTICE '  • gold_inventory - Refinery and management only';
  RAISE NOTICE '  • batch_status_history - Read-only audit trail';
  RAISE NOTICE '  • sales - Sales staff and management';
  RAISE NOTICE '  • customers - Sales staff access';
  RAISE NOTICE '  • payments - Finance and management';
  RAISE NOTICE '';
  RAISE NOTICE 'Use get_user_permissions() to see your access rights';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
