-- ═══════════════════════════════════════════════════════════════════
--  FIX STORAGE POLICIES - COPY AND RUN IN SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Verify buckets exist
SELECT 'Checking buckets...' as status;
SELECT id, name, public FROM storage.buckets
WHERE id IN ('documents', 'reports', 'payment-proofs');

-- Step 2: Make buckets public
UPDATE storage.buckets
SET public = true
WHERE id IN ('documents', 'reports', 'payment-proofs');

SELECT 'Buckets updated to public' as status;

-- Step 3: Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop old policies to start fresh
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
DROP POLICY IF EXISTS "Users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read public buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to public buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can view reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own payment proofs" ON storage.objects;

SELECT 'Old policies dropped' as status;

-- Step 5: Create new simple, permissive policies
CREATE POLICY "Anyone can read public buckets"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('documents', 'reports', 'payment-proofs'));

CREATE POLICY "Authenticated users can upload to public buckets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('documents', 'reports', 'payment-proofs'));

CREATE POLICY "Authenticated users can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id IN ('documents', 'reports', 'payment-proofs'));

CREATE POLICY "Users can update files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('documents', 'reports', 'payment-proofs'))
  WITH CHECK (bucket_id IN ('documents', 'reports', 'payment-proofs'));

CREATE POLICY "Users can delete files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('documents', 'reports', 'payment-proofs'));

SELECT 'New policies created' as status;

-- Step 6: Verify policies were created
SELECT 'Verifying policies...' as status;
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Step 7: Final count - should show 5 policies
SELECT 'Final check...' as status;
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';

SELECT '✅ Storage policies configured successfully!' as result;
