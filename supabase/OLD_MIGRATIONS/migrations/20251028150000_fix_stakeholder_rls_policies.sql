/*
  # Fix Stakeholder RLS Policies

  1. Changes
    - Allow Factory users to INSERT mining_companies
    - Keep SELECT open to all authenticated users
    - Keep UPDATE restricted to management/admin

  2. Rationale
    - Factory users need to create mining companies when registering new batches
    - Management/admin still control updates for data integrity
    - All authenticated users can view for dropdown selection
*/

-- Drop existing INSERT policy for mining_companies
DROP POLICY IF EXISTS "Management can insert mining_companies" ON mining_companies;

-- Recreate INSERT policy to allow all authenticated users
CREATE POLICY "Authenticated users can insert mining_companies"
  ON mining_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure SELECT policy exists for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view mining_companies" ON mining_companies;

CREATE POLICY "Authenticated users can view mining_companies"
  ON mining_companies FOR SELECT
  TO authenticated
  USING (true);

-- Keep UPDATE restricted to management/admin
DROP POLICY IF EXISTS "Management can update mining_companies" ON mining_companies;

CREATE POLICY "Management can update mining_companies"
  ON mining_companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

-- Apply similar changes for freight_companies
DROP POLICY IF EXISTS "Management can insert freight_companies" ON freight_companies;

CREATE POLICY "Authenticated users can insert freight_companies"
  ON freight_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Apply similar changes for refinery_plants
DROP POLICY IF EXISTS "Management can insert refinery_plants" ON refinery_plants;

CREATE POLICY "Authenticated users can insert refinery_plants"
  ON refinery_plants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE mining_companies IS 'Mining companies table with RLS allowing authenticated users to create entries (updated 2025-10-28)';
