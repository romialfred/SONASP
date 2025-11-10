/*
  ============================================================================
  DIAGNOSE LICENSE REQUEST DATA
  ============================================================================
  This will show us exactly what's in the database and why the table is empty
  ============================================================================
*/

-- STEP 1: Check if data exists at all
SELECT
  'Total Records' as check_name,
  COUNT(*) as result
FROM license_requests;

-- STEP 2: Check structure of existing records
SELECT
  id,
  request_number,
  CASE
    WHEN title IS NULL THEN '❌ NULL'
    WHEN title = '' THEN '❌ EMPTY STRING'
    ELSE '✅ ' || title
  END as title_status,
  mine_id,
  mine_name,
  status,
  planned_quantity_oz,
  request_date,
  created_at
FROM license_requests
ORDER BY created_at DESC;

-- STEP 3: Check if RLS is blocking
SET ROLE authenticated;

SELECT
  '🔐 With RLS (as authenticated user)' as context,
  COUNT(*) as visible_records
FROM license_requests;

RESET ROLE;

SELECT
  '🔓 Without RLS (as superuser)' as context,
  COUNT(*) as visible_records
FROM license_requests;

-- STEP 4: Check user_profiles for current user
SELECT
  'Current User Profile' as info,
  id,
  email,
  full_name,
  role,
  is_active
FROM user_profiles
WHERE id = auth.uid();

-- STEP 5: Test the security definer functions
SELECT
  'Security Functions Test' as info,
  public.check_user_role('management') as is_management,
  public.check_user_role('factory') as is_factory,
  public.check_user_has_role(ARRAY['management', 'factory']) as has_role;

-- STEP 6: Check RLS policies
SELECT
  tablename,
  policyname,
  cmd as command,
  permissive,
  roles,
  CASE
    WHEN qual IS NOT NULL THEN 'USING clause exists'
    ELSE 'No USING clause'
  END as has_using,
  CASE
    WHEN with_check IS NOT NULL THEN 'WITH CHECK exists'
    ELSE 'No WITH CHECK'
  END as has_with_check
FROM pg_policies
WHERE tablename = 'license_requests'
ORDER BY policyname;

-- STEP 7: Check if title column exists and has default
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'license_requests'
  AND column_name IN ('id', 'request_number', 'title', 'mine_name', 'status')
ORDER BY ordinal_position;

-- STEP 8: If data exists but title is NULL, update it
DO $$
DECLARE
  null_count integer;
  updated_count integer;
BEGIN
  -- Count NULL titles
  SELECT COUNT(*) INTO null_count
  FROM license_requests
  WHERE title IS NULL OR title = '';

  IF null_count > 0 THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FOUND % RECORDS WITH NULL/EMPTY TITLE', null_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Updating records with default titles...';

    -- Update NULL titles
    UPDATE license_requests
    SET title = 'Export License Request for ' || COALESCE(mine_name, 'Unknown Mine')
    WHERE title IS NULL OR title = '';

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RAISE NOTICE '✅ Updated % records with titles', updated_count;
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ All records have titles';
  END IF;
END $$;

-- STEP 9: Final verification - show all data
SELECT
  id,
  request_number,
  title,
  mine_name,
  status,
  planned_quantity_oz,
  priority,
  request_date,
  created_by,
  created_at
FROM license_requests
ORDER BY created_at DESC;

-- STEP 10: Summary
DO $$
DECLARE
  total_count integer;
  with_title integer;
  rls_count integer;
BEGIN
  SELECT COUNT(*) INTO total_count FROM license_requests;
  SELECT COUNT(*) INTO with_title FROM license_requests WHERE title IS NOT NULL AND title != '';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '           DIAGNOSTIC SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total Records: %', total_count;
  RAISE NOTICE 'Records with Title: %', with_title;
  RAISE NOTICE '';

  IF total_count = 0 THEN
    RAISE NOTICE '❌ NO DATA EXISTS IN DATABASE';
    RAISE NOTICE '';
    RAISE NOTICE 'ACTION REQUIRED: Create sample data';
    RAISE NOTICE 'Run the seed data script to create test records';
  ELSIF with_title < total_count THEN
    RAISE NOTICE '⚠️  SOME RECORDS MISSING TITLES';
    RAISE NOTICE '';
    RAISE NOTICE 'ACTION: Run this script again - it auto-fixes titles';
  ELSE
    RAISE NOTICE '✅ ALL DATA LOOKS GOOD';
    RAISE NOTICE '';
    RAISE NOTICE 'If table is still empty in app:';
    RAISE NOTICE '1. Check browser console for JavaScript errors';
    RAISE NOTICE '2. Check Network tab for API response';
    RAISE NOTICE '3. Verify RLS policies are applied (see above)';
    RAISE NOTICE '4. Hard refresh browser (Ctrl+Shift+R)';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
