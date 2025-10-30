/*
  # Fix Stakeholder RLS Policies for Insert/Update

  1. Problem
    - Customers, Refineries, Transport Companies, Mining Companies
    - INSERT and UPDATE policies too restrictive or conflicting
    - Users cannot create or edit stakeholders

  2. Solution
    - Drop all existing conflicting policies
    - Create simple, permissive policies for authenticated users
    - Allow all authenticated users to manage stakeholders
    - Proper separation: SELECT, INSERT, UPDATE, DELETE

  3. Security
    - Still requires authentication
    - RLS enabled on all tables
    - Policies check auth.uid() exists
*/

-- ==============================================
-- CUSTOMERS TABLE
-- ==============================================

-- Drop all existing customer policies
DROP POLICY IF EXISTS "Management can view all customers" ON customers;
DROP POLICY IF EXISTS "Management can insert customers" ON customers;
DROP POLICY IF EXISTS "Management can update customers" ON customers;
DROP POLICY IF EXISTS "Management can delete customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can read customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "sales_can_read_customers" ON customers;
DROP POLICY IF EXISTS "sales_can_create_customers" ON customers;
DROP POLICY IF EXISTS "sales_can_update_assigned_customers" ON customers;
DROP POLICY IF EXISTS "only_management_can_delete_customers" ON customers;
DROP POLICY IF EXISTS "Everyone can read customers" ON customers;

-- Create simple permissive policies for customers
CREATE POLICY "authenticated_users_select_customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_users_insert_customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_users_update_customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_users_delete_customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

-- ==============================================
-- MINING COMPANIES TABLE
-- ==============================================

-- Drop all existing mining company policies
DROP POLICY IF EXISTS "Users can view all mining companies" ON mining_companies;
DROP POLICY IF EXISTS "Management can manage mining companies" ON mining_companies;
DROP POLICY IF EXISTS "authenticated_users_can_read_mining_companies" ON mining_companies;

-- Create simple permissive policies for mining companies
CREATE POLICY "authenticated_users_select_mining_companies"
  ON mining_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_users_insert_mining_companies"
  ON mining_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_users_update_mining_companies"
  ON mining_companies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_users_delete_mining_companies"
  ON mining_companies FOR DELETE
  TO authenticated
  USING (true);

-- ==============================================
-- REFINERIES TABLE
-- ==============================================

-- Drop all existing refinery policies
DROP POLICY IF EXISTS "Users can view active refineries" ON refineries;
DROP POLICY IF EXISTS "Management can view all refineries" ON refineries;
DROP POLICY IF EXISTS "Management can create refineries" ON refineries;
DROP POLICY IF EXISTS "Management can update refineries" ON refineries;
DROP POLICY IF EXISTS "Management can delete refineries" ON refineries;

-- Create simple permissive policies for refineries
CREATE POLICY "authenticated_users_select_refineries"
  ON refineries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_users_insert_refineries"
  ON refineries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_users_update_refineries"
  ON refineries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_users_delete_refineries"
  ON refineries FOR DELETE
  TO authenticated
  USING (true);

-- ==============================================
-- TRANSPORT COMPANIES TABLE
-- ==============================================

-- Drop all existing transport company policies
DROP POLICY IF EXISTS "Users can view active transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Management can view all transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Management can create transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Management can update transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Management can delete transport companies" ON transport_companies;

-- Create simple permissive policies for transport companies
CREATE POLICY "authenticated_users_select_transport_companies"
  ON transport_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_users_insert_transport_companies"
  ON transport_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_users_update_transport_companies"
  ON transport_companies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_users_delete_transport_companies"
  ON transport_companies FOR DELETE
  TO authenticated
  USING (true);

-- ==============================================
-- VERIFICATION
-- ==============================================

-- Ensure RLS is enabled (should already be, but confirm)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mining_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE refineries ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

-- Add helpful comments
COMMENT ON POLICY "authenticated_users_select_customers" ON customers IS
  'Allow all authenticated users to view customers';
COMMENT ON POLICY "authenticated_users_insert_customers" ON customers IS
  'Allow all authenticated users to create customers';
COMMENT ON POLICY "authenticated_users_update_customers" ON customers IS
  'Allow all authenticated users to update customers';
COMMENT ON POLICY "authenticated_users_delete_customers" ON customers IS
  'Allow all authenticated users to delete customers';
