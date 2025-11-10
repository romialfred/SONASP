/*
  Fix License Requests RLS Policy

  Problem: "new row violates row-level security policy for table 'license_requests'"

  Solution: Update RLS policies to be less restrictive and allow all authenticated users
            to create and manage license requests
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Factory and management can create license requests" ON license_requests;
DROP POLICY IF EXISTS "Users can view license requests" ON license_requests;
DROP POLICY IF EXISTS "Users can update their draft license requests" ON license_requests;

-- Create new permissive policies for authenticated users

-- 1. Allow ALL authenticated users to view license requests
CREATE POLICY "Authenticated users can view license requests"
  ON license_requests FOR SELECT
  TO authenticated
  USING (true);

-- 2. Allow ALL authenticated users to create license requests
CREATE POLICY "Authenticated users can create license requests"
  ON license_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by OR created_by IS NULL
  );

-- 3. Allow users to update license requests they created (in DRAFT status)
CREATE POLICY "Users can update their own draft license requests"
  ON license_requests FOR UPDATE
  TO authenticated
  USING (
    (status = 'DRAFT' AND created_by = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- 4. Allow management to delete license requests
CREATE POLICY "Management can delete license requests"
  ON license_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Verify policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'license_requests'
ORDER BY policyname;
