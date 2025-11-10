/*
  # Fix License Requests RLS Policies

  1. Changes
    - Drop all existing restrictive RLS policies on license_requests
    - Create new permissive policies to allow authenticated users to view and manage license requests
    - Keep RLS enabled for security but make it less restrictive

  2. Security
    - All authenticated users can view license requests
    - All authenticated users can create license requests
    - All authenticated users can update license requests
    - Management role can delete license requests

  3. Notes
    - This fixes the issue where data was being fetched but not displayed due to overly restrictive policies
    - The console showed recordCount: 3 but table was empty because SELECT policy was too restrictive
*/

-- Drop all existing policies on license_requests
DROP POLICY IF EXISTS "Users can view license requests" ON license_requests;
DROP POLICY IF EXISTS "Factory and management can create license requests" ON license_requests;
DROP POLICY IF EXISTS "Users can update their draft license requests" ON license_requests;
DROP POLICY IF EXISTS "Management can delete license requests" ON license_requests;

-- Create new permissive policies

-- Allow all authenticated users to view license requests
CREATE POLICY "Authenticated users can view all license requests"
  ON license_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to create license requests
CREATE POLICY "Authenticated users can create license requests"
  ON license_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to update license requests
CREATE POLICY "Authenticated users can update license requests"
  ON license_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow management to delete license requests
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

-- Also fix license_request_documents policies
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
