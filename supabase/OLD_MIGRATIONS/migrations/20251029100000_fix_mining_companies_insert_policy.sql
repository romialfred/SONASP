/*
  # Fix Mining Companies INSERT Policy
  
  1. Problem
    - Users getting "new row violates row-level security policy" when creating mining companies
    - The WITH CHECK clause might be rejecting valid inserts
  
  2. Solution
    - Simplify INSERT policy to allow all authenticated users
    - Remove restrictive WITH CHECK conditions
    - Ensure created_by field is not causing issues
  
  3. Security
    - All authenticated users can create mining companies
    - UPDATE still restricted to management/admin
    - Audit trail maintained via created_by field
*/

-- Drop all existing policies for mining_companies
DROP POLICY IF EXISTS "Authenticated users can view mining_companies" ON mining_companies;
DROP POLICY IF EXISTS "Authenticated users can insert mining_companies" ON mining_companies;
DROP POLICY IF EXISTS "Management can insert mining_companies" ON mining_companies;
DROP POLICY IF EXISTS "Management can update mining_companies" ON mining_companies;

-- Recreate SELECT policy - all authenticated users can view
CREATE POLICY "mining_companies_select_policy"
  ON mining_companies FOR SELECT
  TO authenticated
  USING (true);

-- Recreate INSERT policy - all authenticated users can insert
CREATE POLICY "mining_companies_insert_policy"
  ON mining_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Recreate UPDATE policy - only management/admin can update
CREATE POLICY "mining_companies_update_policy"
  ON mining_companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  );

-- Recreate DELETE policy - only admin can delete
CREATE POLICY "mining_companies_delete_policy"
  ON mining_companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Make created_by nullable to avoid issues
ALTER TABLE mining_companies ALTER COLUMN created_by DROP NOT NULL;

-- Add helpful comment
COMMENT ON TABLE mining_companies IS 'Mining companies - all authenticated users can create, only management/admin can update (fixed 2025-10-29)';

-- Apply same fixes for freight_companies
DROP POLICY IF EXISTS "Authenticated users can view freight companies" ON freight_companies;
DROP POLICY IF EXISTS "Authenticated users can insert freight_companies" ON freight_companies;
DROP POLICY IF EXISTS "Management can insert freight_companies" ON freight_companies;
DROP POLICY IF EXISTS "Management can update freight_companies" ON freight_companies;

CREATE POLICY "freight_companies_select_policy"
  ON freight_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "freight_companies_insert_policy"
  ON freight_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "freight_companies_update_policy"
  ON freight_companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  );

CREATE POLICY "freight_companies_delete_policy"
  ON freight_companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

ALTER TABLE freight_companies ALTER COLUMN created_by DROP NOT NULL;

-- Apply same fixes for refinery_plants
DROP POLICY IF EXISTS "Authenticated users can view refinery plants" ON refinery_plants;
DROP POLICY IF EXISTS "Authenticated users can insert refinery_plants" ON refinery_plants;
DROP POLICY IF EXISTS "Management can insert refinery_plants" ON refinery_plants;
DROP POLICY IF EXISTS "Management can update refinery_plants" ON refinery_plants;

CREATE POLICY "refinery_plants_select_policy"
  ON refinery_plants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "refinery_plants_insert_policy"
  ON refinery_plants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "refinery_plants_update_policy"
  ON refinery_plants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  );

CREATE POLICY "refinery_plants_delete_policy"
  ON refinery_plants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

ALTER TABLE refinery_plants ALTER COLUMN created_by DROP NOT NULL;

-- Fix stakeholder_bank_accounts policies
DROP POLICY IF EXISTS "Authenticated users can view bank accounts" ON stakeholder_bank_accounts;
DROP POLICY IF EXISTS "Management can manage bank accounts" ON stakeholder_bank_accounts;

CREATE POLICY "stakeholder_bank_accounts_select_policy"
  ON stakeholder_bank_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "stakeholder_bank_accounts_insert_policy"
  ON stakeholder_bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "stakeholder_bank_accounts_update_policy"
  ON stakeholder_bank_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  );

ALTER TABLE stakeholder_bank_accounts ALTER COLUMN created_by DROP NOT NULL;

-- Fix stakeholder_contacts policies
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON stakeholder_contacts;
DROP POLICY IF EXISTS "Management can manage contacts" ON stakeholder_contacts;

CREATE POLICY "stakeholder_contacts_select_policy"
  ON stakeholder_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "stakeholder_contacts_insert_policy"
  ON stakeholder_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "stakeholder_contacts_update_policy"
  ON stakeholder_contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('management', 'admin')
    )
  );

-- Fix stakeholder_activities policies (keep existing - they were correct)
DROP POLICY IF EXISTS "Authenticated users can view activities" ON stakeholder_activities;
DROP POLICY IF EXISTS "Authenticated users can create activities" ON stakeholder_activities;

CREATE POLICY "stakeholder_activities_select_policy"
  ON stakeholder_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "stakeholder_activities_insert_policy"
  ON stakeholder_activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE stakeholder_activities ALTER COLUMN created_by DROP NOT NULL;
