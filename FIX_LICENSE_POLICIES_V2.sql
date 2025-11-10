-- ============================================
-- FIX LICENSE REQUESTS RLS POLICIES (VERSION 2)
-- ============================================
-- This version drops ALL existing policies first
-- ============================================

-- Step 1: Drop ALL existing policies on license_requests (no IF EXISTS check)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'license_requests'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON license_requests';
    END LOOP;
END $$;

-- Step 2: Drop ALL existing policies on license_request_documents
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'license_request_documents'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON license_request_documents';
    END LOOP;
END $$;

-- Step 3: Create new PERMISSIVE policies for license_requests

-- Allow ALL authenticated users to VIEW all license requests
CREATE POLICY "Authenticated users can view all license requests"
  ON license_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow ALL authenticated users to CREATE license requests
CREATE POLICY "Authenticated users can create license requests"
  ON license_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow ALL authenticated users to UPDATE license requests
CREATE POLICY "Authenticated users can update license requests"
  ON license_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow management to DELETE license requests
CREATE POLICY "Management can delete license requests"
  ON license_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Step 4: Create new policies for license_request_documents

CREATE POLICY "Authenticated users can view all license documents"
  ON license_request_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload license documents"
  ON license_request_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update license documents"
  ON license_request_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete license documents"
  ON license_request_documents
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify policies are correct:
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('license_requests', 'license_request_documents')
ORDER BY tablename, policyname;
-- ============================================
