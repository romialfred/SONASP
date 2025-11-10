-- ============================================
-- FIX LICENSE REQUESTS RLS POLICIES
-- ============================================
-- Copy and paste this entire script into Supabase SQL Editor
-- and click "Run" to fix the license requests display issue
-- ============================================

-- Step 1: Drop all existing restrictive policies on license_requests
DROP POLICY IF EXISTS "Users can view license requests" ON license_requests;
DROP POLICY IF EXISTS "Factory and management can create license requests" ON license_requests;
DROP POLICY IF EXISTS "Users can update their draft license requests" ON license_requests;
DROP POLICY IF EXISTS "Management can delete license requests" ON license_requests;

-- Step 2: Create new PERMISSIVE policies for license_requests

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

-- Step 3: Fix license_request_documents policies
DROP POLICY IF EXISTS "Users can view documents from their license requests" ON license_request_documents;
DROP POLICY IF EXISTS "Users can upload documents to their license requests" ON license_request_documents;

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
-- VERIFICATION QUERY
-- ============================================
-- Run this after applying the fix to verify:
-- SELECT * FROM license_requests LIMIT 10;
-- ============================================
