/*
  # Fix Transport Companies RLS Policies (Version Simple)
  
  1. Security
    - Enable RLS on transport_companies table
    - Add policy for authenticated users to read all companies
    - Add simple policies for insert/update/delete
  
  Note: Cette version ne dépend pas de la table 'profiles'
*/

-- Enable RLS
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view all transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Authenticated users can view transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can manage transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can insert transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can update transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can delete transport companies" ON transport_companies;

-- Policy: All authenticated users can read transport companies
CREATE POLICY "Authenticated users can view transport companies"
  ON transport_companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert transport companies
CREATE POLICY "Authenticated users can insert transport companies"
  ON transport_companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update transport companies
CREATE POLICY "Authenticated users can update transport companies"
  ON transport_companies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete transport companies
CREATE POLICY "Authenticated users can delete transport companies"
  ON transport_companies
  FOR DELETE
  TO authenticated
  USING (true);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'transport_companies'
ORDER BY policyname;

-- Test: Check if data is visible
SELECT id, name, email, is_active 
FROM transport_companies;
