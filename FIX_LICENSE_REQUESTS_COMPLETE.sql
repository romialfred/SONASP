/*
  ============================================================================
  COMPLETE FIX FOR LICENSE REQUESTS - 500 ERROR
  ============================================================================

  ROOT CAUSE ANALYSIS:
  --------------------
  1. RLS policy on license_requests table checks user_profiles.role
  2. RLS policy on user_profiles only allows: USING (id = auth.uid())
  3. When license_requests policy tries to query user_profiles, it FAILS
  4. This causes 500 Internal Server Error from Supabase
  5. Additionally, title column is missing from license_requests table

  SOLUTION:
  ---------
  1. Create SECURITY DEFINER function to check user role (bypasses RLS)
  2. Update all license-related RLS policies to use this function
  3. Add missing title column to license_requests table
  4. Ensure policies are simple and performant

  HOW TO APPLY:
  -------------
  1. Open Supabase Dashboard
  2. Go to SQL Editor
  3. Copy and paste THIS ENTIRE FILE
  4. Click "Run" button
  5. Refresh browser to see your data

  ============================================================================
*/

-- ============================================================================
-- PART 1: CREATE SECURITY DEFINER FUNCTION FOR ROLE CHECKING
-- ============================================================================

-- This function bypasses RLS and can check any user's role
CREATE OR REPLACE FUNCTION public.check_user_role(role_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND role = role_to_check
    AND is_active = true
  );
END;
$$;

-- Function to check if user has ANY of the specified roles
CREATE OR REPLACE FUNCTION public.check_user_has_role(roles_to_check text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND role = ANY(roles_to_check)
    AND is_active = true
  );
END;
$$;

RAISE NOTICE 'SUCCESS: Security definer functions created';

-- ============================================================================
-- PART 2: DROP EXISTING LICENSE_REQUESTS POLICIES
-- ============================================================================

DO $$
BEGIN
  -- Drop old policies if they exist
  DROP POLICY IF EXISTS "Users can view license requests" ON license_requests;
  DROP POLICY IF EXISTS "Factory and management can create license requests" ON license_requests;
  DROP POLICY IF EXISTS "Users can update their draft license requests" ON license_requests;
  DROP POLICY IF EXISTS "Management can review license requests" ON license_requests;

  RAISE NOTICE 'SUCCESS: Old policies dropped';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'INFO: Some policies may not have existed';
END $$;

-- ============================================================================
-- PART 3: CREATE NEW OPTIMIZED RLS POLICIES
-- ============================================================================

-- Policy for SELECT: Factory and Management can view all requests
CREATE POLICY "Factory and management can view license requests"
  ON license_requests
  FOR SELECT
  TO authenticated
  USING (
    public.check_user_has_role(ARRAY['factory', 'management'])
  );

-- Policy for INSERT: Factory and Management can create requests
CREATE POLICY "Factory and management can create license requests"
  ON license_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_user_has_role(ARRAY['factory', 'management'])
  );

-- Policy for UPDATE: Can update draft requests
CREATE POLICY "Users can update draft license requests"
  ON license_requests
  FOR UPDATE
  TO authenticated
  USING (
    status = 'DRAFT'
    AND public.check_user_has_role(ARRAY['factory', 'management'])
  )
  WITH CHECK (
    status IN ('DRAFT', 'SUBMITTED')
    AND public.check_user_has_role(ARRAY['factory', 'management'])
  );

-- Policy for Management to review (change to IN_REVIEW, APPROVED, REJECTED)
CREATE POLICY "Management can review license requests"
  ON license_requests
  FOR UPDATE
  TO authenticated
  USING (
    status IN ('SUBMITTED', 'IN_REVIEW')
    AND public.check_user_role('management')
  )
  WITH CHECK (
    status IN ('IN_REVIEW', 'APPROVED', 'REJECTED')
    AND public.check_user_role('management')
  );

RAISE NOTICE 'SUCCESS: New RLS policies created for license_requests';

-- ============================================================================
-- PART 4: UPDATE LICENSE_REQUEST_DOCUMENTS POLICIES
-- ============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view documents from their license requests" ON license_request_documents;
  DROP POLICY IF EXISTS "Users can upload documents to their license requests" ON license_request_documents;
  DROP POLICY IF EXISTS "Users can delete documents from draft requests" ON license_request_documents;

  RAISE NOTICE 'INFO: Dropped old license_request_documents policies';
END $$;

-- Simplified policies for documents
CREATE POLICY "Factory and management can view license documents"
  ON license_request_documents
  FOR SELECT
  TO authenticated
  USING (
    public.check_user_has_role(ARRAY['factory', 'management'])
  );

CREATE POLICY "Factory and management can upload documents"
  ON license_request_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_user_has_role(ARRAY['factory', 'management'])
    AND EXISTS (
      SELECT 1 FROM license_requests
      WHERE id = license_request_id
      AND status = 'DRAFT'
    )
  );

CREATE POLICY "Users can delete documents from draft requests"
  ON license_request_documents
  FOR DELETE
  TO authenticated
  USING (
    public.check_user_has_role(ARRAY['factory', 'management'])
    AND EXISTS (
      SELECT 1 FROM license_requests
      WHERE id = license_request_id
      AND status = 'DRAFT'
    )
  );

RAISE NOTICE 'SUCCESS: New RLS policies created for license_request_documents';

-- ============================================================================
-- PART 5: ADD MISSING TITLE COLUMN
-- ============================================================================

DO $$
BEGIN
  -- Check if title column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'title'
  ) THEN
    RAISE NOTICE 'INFO: Adding title column to license_requests...';

    -- Add title column with temporary default
    ALTER TABLE license_requests
    ADD COLUMN title text NOT NULL DEFAULT 'Export License Request';

    -- Update existing records with meaningful titles
    UPDATE license_requests
    SET title = 'Export License Request for ' || mine_name
    WHERE title = 'Export License Request';

    -- Remove default (new records must provide title)
    ALTER TABLE license_requests
    ALTER COLUMN title DROP DEFAULT;

    RAISE NOTICE 'SUCCESS: Title column added and existing data updated';
  ELSE
    RAISE NOTICE 'INFO: Title column already exists';
  END IF;
END $$;

-- ============================================================================
-- PART 6: UPDATE LICENSES TABLE POLICIES (for consistency)
-- ============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view licenses" ON licenses;
  DROP POLICY IF EXISTS "Management can create licenses" ON licenses;
  DROP POLICY IF EXISTS "Management can update licenses" ON licenses;

  RAISE NOTICE 'INFO: Dropped old licenses policies';
END $$;

CREATE POLICY "Factory and management can view licenses"
  ON licenses
  FOR SELECT
  TO authenticated
  USING (
    public.check_user_has_role(ARRAY['factory', 'management'])
  );

CREATE POLICY "Management can create licenses"
  ON licenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_user_role('management')
  );

CREATE POLICY "Management can update licenses"
  ON licenses
  FOR UPDATE
  TO authenticated
  USING (
    public.check_user_role('management')
  );

RAISE NOTICE 'SUCCESS: New RLS policies created for licenses';

-- ============================================================================
-- PART 7: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_license_requests_status
  ON license_requests(status);

CREATE INDEX IF NOT EXISTS idx_license_requests_mine_id
  ON license_requests(mine_id);

CREATE INDEX IF NOT EXISTS idx_license_requests_created_by
  ON license_requests(created_by);

CREATE INDEX IF NOT EXISTS idx_license_requests_request_date
  ON license_requests(request_date DESC);

CREATE INDEX IF NOT EXISTS idx_license_request_documents_request_id
  ON license_request_documents(license_request_id);

RAISE NOTICE 'SUCCESS: Performance indexes created';

-- ============================================================================
-- PART 8: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  request_count integer;
  col_exists boolean;
  policy_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION RESULTS';
  RAISE NOTICE '========================================';

  -- Check functions exist
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_user_role'
  ) THEN
    RAISE NOTICE 'SUCCESS: check_user_role() function exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_user_has_role'
  ) THEN
    RAISE NOTICE 'SUCCESS: check_user_has_role() function exists';
  END IF;

  -- Check title column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'title'
  ) INTO col_exists;

  IF col_exists THEN
    RAISE NOTICE 'SUCCESS: title column exists in license_requests';
  ELSE
    RAISE NOTICE 'ERROR: title column missing!';
  END IF;

  -- Count policies on license_requests
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'license_requests';

  RAISE NOTICE 'INFO: % RLS policies on license_requests table', policy_count;

  -- Count records
  SELECT COUNT(*) INTO request_count FROM license_requests;
  RAISE NOTICE 'INFO: Total license requests in database: %', request_count;

  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 9: DISPLAY DATA
-- ============================================================================

-- Show all license requests
SELECT
  id,
  request_number,
  title,
  mine_name,
  status,
  planned_quantity_oz,
  request_date,
  created_at
FROM license_requests
ORDER BY created_at DESC;

-- Show summary by status
SELECT
  status,
  COUNT(*) as count,
  SUM(planned_quantity_oz) as total_oz
FROM license_requests
GROUP BY status
ORDER BY status;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '       MIGRATION COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Refresh your browser (Ctrl+Shift+R)';
  RAISE NOTICE '2. Go to License Requests page';
  RAISE NOTICE '3. Your data should now load correctly!';
  RAISE NOTICE '';
  RAISE NOTICE 'If you still see errors:';
  RAISE NOTICE '- Check browser console for details';
  RAISE NOTICE '- Verify your user role in user_profiles table';
  RAISE NOTICE '- Clear browser cache completely';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
