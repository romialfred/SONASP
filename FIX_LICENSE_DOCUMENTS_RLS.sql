/*
  Fix License Request Documents RLS Policies

  Problem: Documents upload may also be blocked by restrictive policies

  Solution: Update RLS policies to allow authenticated users to upload documents
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view documents from their license requests" ON license_request_documents;
DROP POLICY IF EXISTS "Users can upload documents to their license requests" ON license_request_documents;

-- Create new permissive policies

-- 1. Allow ALL authenticated users to view documents
CREATE POLICY "Authenticated users can view license request documents"
  ON license_request_documents FOR SELECT
  TO authenticated
  USING (true);

-- 2. Allow ALL authenticated users to upload documents
CREATE POLICY "Authenticated users can upload documents"
  ON license_request_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
  );

-- 3. Allow users to update documents they uploaded
CREATE POLICY "Users can update their own documents"
  ON license_request_documents FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- 4. Allow users to delete documents they uploaded
CREATE POLICY "Users can delete their own documents"
  ON license_request_documents FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Verify policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'license_request_documents'
ORDER BY policyname;
