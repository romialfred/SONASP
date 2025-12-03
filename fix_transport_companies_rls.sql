/*
  # Fix Transport Companies RLS Policies
  
  1. Security
    - Enable RLS on transport_companies table
    - Add policy for authenticated users to read all companies
    - Add policies for insert/update/delete based on roles
*/

-- Enable RLS
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view all transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Authenticated users can view transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can manage transport companies" ON transport_companies;

-- Policy: All authenticated users can read transport companies
CREATE POLICY "Authenticated users can view transport companies"
  ON transport_companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins and managers can insert transport companies
CREATE POLICY "Admins can insert transport companies"
  ON transport_companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Policy: Only admins and managers can update transport companies
CREATE POLICY "Admins can update transport companies"
  ON transport_companies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Policy: Only admins can delete transport companies
CREATE POLICY "Admins can delete transport companies"
  ON transport_companies
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'transport_companies'
ORDER BY policyname;
