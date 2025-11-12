/*
  # Fix Policy Names Length (Max 50 chars)

  1. Issue Fixed
    - Policy names exceeding 50 characters limit
    - Shorten all policy names to be under 50 characters

  2. Changes
    - Rename policies with shorter, clear names
    - Maintain same functionality

  3. Tables Affected
    - production_documents
    - All tables with long policy names
*/

-- ========================================
-- 1. PRODUCTION DOCUMENTS POLICIES
-- ========================================

-- Drop existing policies with long names
DROP POLICY IF EXISTS "Users can view production documents" ON production_documents;
DROP POLICY IF EXISTS "Users can upload production documents" ON production_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON production_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON production_documents;

-- Create policies with shorter names (under 50 chars)
CREATE POLICY "View production docs"
  ON production_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Upload production docs"
  ON production_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Update own docs"
  ON production_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Delete own docs"
  ON production_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- ========================================
-- 2. VERIFY POLICY NAMES LENGTH
-- ========================================

DO $$
DECLARE
  policy_record RECORD;
  long_policies INTEGER := 0;
BEGIN
  -- Check for policies with names > 50 characters
  FOR policy_record IN
    SELECT tablename, policyname, length(policyname) as name_length
    FROM pg_policies
    WHERE length(policyname) > 50
    ORDER BY length(policyname) DESC
  LOOP
    long_policies := long_policies + 1;
    RAISE WARNING 'Policy name too long (% chars): %.% - "%"',
                  policy_record.name_length,
                  policy_record.tablename,
                  policy_record.policyname,
                  policy_record.policyname;
  END LOOP;

  IF long_policies = 0 THEN
    RAISE NOTICE '✅ All policy names are within 50 character limit';
  ELSE
    RAISE WARNING '⚠️ Found % policies with names exceeding 50 characters', long_policies;
  END IF;
END $$;

-- ========================================
-- 3. LIST ALL POLICIES FOR VERIFICATION
-- ========================================

SELECT
  schemaname,
  tablename,
  policyname,
  length(policyname) as name_length,
  CASE
    WHEN length(policyname) > 50 THEN '❌ TOO LONG'
    WHEN length(policyname) > 45 THEN '⚠️ CLOSE'
    ELSE '✅ OK'
  END as status
FROM pg_policies
WHERE tablename IN ('production_documents', 'daily_production', 'export_licenses')
ORDER BY length(policyname) DESC, tablename, policyname;
