/*
  # Fix Shipping Preparation System - Drop and Recreate Policies

  1. Changes
    - Drop existing policies if they exist
    - Recreate all policies cleanly
    - Ensure no conflicts

  2. Security
    - Maintain RLS protection
    - Recreate all access policies
*/

-- Drop existing policies if they exist
DO $$
BEGIN
  -- Drop policies for shipping_preparations
  DROP POLICY IF EXISTS "Users can view shipping preparations" ON shipping_preparations;
  DROP POLICY IF EXISTS "Users can create shipping preparations" ON shipping_preparations;
  DROP POLICY IF EXISTS "Users can update shipping preparations" ON shipping_preparations;
  DROP POLICY IF EXISTS "Users can delete shipping preparations" ON shipping_preparations;

  -- Drop policies for shipping_signatories
  DROP POLICY IF EXISTS "Users can view signatories" ON shipping_signatories;
  DROP POLICY IF EXISTS "Users can create signatories" ON shipping_signatories;
  DROP POLICY IF EXISTS "Users can update signatories" ON shipping_signatories;
  DROP POLICY IF EXISTS "Users can delete signatories" ON shipping_signatories;

  -- Drop policies for shipping_ingots
  DROP POLICY IF EXISTS "Users can view ingots" ON shipping_ingots;
  DROP POLICY IF EXISTS "Users can create ingots" ON shipping_ingots;
  DROP POLICY IF EXISTS "Users can update ingots" ON shipping_ingots;
  DROP POLICY IF EXISTS "Users can delete ingots" ON shipping_ingots;
END $$;

-- Recreate policies for shipping_preparations
CREATE POLICY "Users can view shipping preparations"
  ON shipping_preparations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create shipping preparations"
  ON shipping_preparations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update shipping preparations"
  ON shipping_preparations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete shipping preparations"
  ON shipping_preparations FOR DELETE
  TO authenticated
  USING (true);

-- Recreate policies for shipping_signatories
CREATE POLICY "Users can view signatories"
  ON shipping_signatories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create signatories"
  ON shipping_signatories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update signatories"
  ON shipping_signatories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete signatories"
  ON shipping_signatories FOR DELETE
  TO authenticated
  USING (true);

-- Recreate policies for shipping_ingots
CREATE POLICY "Users can view ingots"
  ON shipping_ingots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create ingots"
  ON shipping_ingots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update ingots"
  ON shipping_ingots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete ingots"
  ON shipping_ingots FOR DELETE
  TO authenticated
  USING (true);
