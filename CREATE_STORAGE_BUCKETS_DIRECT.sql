/*
  Direct Storage Bucket Creation

  Run this SQL script in Supabase SQL Editor to create storage buckets.
  This is a simplified version that creates buckets using direct SQL.
*/

-- First, check if buckets exist
SELECT * FROM storage.buckets;

-- Create documents bucket if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'documents',
      'documents',
      true,  -- Make it public for easier access
      52428800,  -- 50MB limit
      ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ]
    );
    RAISE NOTICE 'Created documents bucket';
  ELSE
    RAISE NOTICE 'documents bucket already exists';
  END IF;
END $$;

-- Create reports bucket if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'reports') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'reports',
      'reports',
      true,
      52428800,
      ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ]
    );
    RAISE NOTICE 'Created reports bucket';
  ELSE
    RAISE NOTICE 'reports bucket already exists';
  END IF;
END $$;

-- Create payment-proofs bucket if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-proofs') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'payment-proofs',
      'payment-proofs',
      true,
      52428800,
      ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg'
      ]
    );
    RAISE NOTICE 'Created payment-proofs bucket';
  ELSE
    RAISE NOTICE 'payment-proofs bucket already exists';
  END IF;
END $$;

-- Verify buckets were created
SELECT id, name, public, file_size_limit, created_at
FROM storage.buckets
WHERE id IN ('documents', 'reports', 'payment-proofs');

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create simple, permissive policies for all buckets
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('documents', 'reports', 'payment-proofs'));

CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('documents', 'reports', 'payment-proofs'));

CREATE POLICY "Authenticated users can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id IN ('documents', 'reports', 'payment-proofs'));

CREATE POLICY "Users can update their own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('documents', 'reports', 'payment-proofs') AND auth.uid() = owner)
  WITH CHECK (bucket_id IN ('documents', 'reports', 'payment-proofs') AND auth.uid() = owner);

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('documents', 'reports', 'payment-proofs') AND auth.uid() = owner);

-- Final verification
SELECT
  'Storage buckets created successfully!' as message,
  COUNT(*) as bucket_count
FROM storage.buckets
WHERE id IN ('documents', 'reports', 'payment-proofs');
