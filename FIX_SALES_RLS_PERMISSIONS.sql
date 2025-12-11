/*
  # Fix Sales Table RLS Permissions

  This script ensures that the sales table has proper RLS policies
  to allow authenticated users to create sales.

  Run this in Supabase SQL Editor if you still get 400 errors after
  clearing cache and restarting the dev server.
*/

-- 1. Enable RLS on sales table (if not already enabled)
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts (optional, only if recreating)
DROP POLICY IF EXISTS "Users can insert sales" ON sales;
DROP POLICY IF EXISTS "Users can view sales" ON sales;
DROP POLICY IF EXISTS "Users can update sales" ON sales;
DROP POLICY IF EXISTS "Users can delete sales" ON sales;

-- 3. Create comprehensive RLS policies for sales

-- Policy for SELECT: Users can view all sales
CREATE POLICY "Users can view sales"
ON sales
FOR SELECT
TO authenticated
USING (true);

-- Policy for INSERT: Authenticated users can create sales
CREATE POLICY "Users can insert sales"
ON sales
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  AND
  -- User must be the creator
  created_by = auth.uid()
);

-- Policy for UPDATE: Users can update sales they created
CREATE POLICY "Users can update sales"
ON sales
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Policy for DELETE: Users can delete sales they created (if needed)
CREATE POLICY "Users can delete sales"
ON sales
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- 4. Verify the policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'sales';

-- 5. Verify RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'sales';

-- Expected output:
-- rowsecurity should be 't' (true)
-- You should see 4 policies: SELECT, INSERT, UPDATE, DELETE
