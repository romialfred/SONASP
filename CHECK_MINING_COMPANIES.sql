/*
  ═══════════════════════════════════════════════════════════════════════════
  🔍 DIAGNOSTIC: Check Mining Companies Table
  ═══════════════════════════════════════════════════════════════════════════

  This script checks:
  1. If mining_companies table exists
  2. Current data and status values
  3. RLS policies
  4. Adds sample companies if none exist
*/

-- Step 1: Check if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'mining_companies'
  ) THEN
    RAISE NOTICE '✓ Table mining_companies EXISTS';
  ELSE
    RAISE NOTICE '✗ Table mining_companies DOES NOT EXIST!';
  END IF;
END $$;

-- Step 2: Check table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'mining_companies'
ORDER BY ordinal_position;

-- Step 3: Count total records
SELECT
  COUNT(*) as total_companies,
  COUNT(*) FILTER (WHERE status = 'active') as active_companies,
  COUNT(*) FILTER (WHERE status = 'inactive') as inactive_companies,
  COUNT(*) FILTER (WHERE status IS NULL) as companies_without_status
FROM mining_companies;

-- Step 4: Show all mining companies
SELECT
  id,
  name,
  status,
  country,
  created_at
FROM mining_companies
ORDER BY name;

-- Step 5: Check RLS policies
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
WHERE tablename = 'mining_companies';

-- Step 6: Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'mining_companies';

-- Step 7: Insert sample companies if none exist
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM mining_companies;

  IF v_count = 0 THEN
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '📝 No mining companies found. Inserting samples...';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';

    INSERT INTO mining_companies (name, status, country, contact_email, contact_phone)
    VALUES
      ('Mansa Resources SARL', 'active', 'Guinea', 'contact@mansaresources.gn', '+224-XXX-XXXX'),
      ('SAG Mining Company', 'active', 'Guinea', 'info@sagmining.gn', '+224-XXX-XXXX'),
      ('Gold Fields Guinea', 'active', 'Guinea', 'contact@goldfields.gn', '+224-XXX-XXXX'),
      ('African Gold Group', 'active', 'Cote d''Ivoire', 'info@africangold.ci', '+225-XXX-XXXX'),
      ('West African Minerals', 'active', 'Mali', 'contact@waminerals.ml', '+223-XXX-XXXX')
    ON CONFLICT (name) DO NOTHING;

    RAISE NOTICE '✓ Inserted 5 sample mining companies';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '✓ Found % existing mining companies', v_count;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
  END IF;
END $$;

-- Step 8: Final verification - show active companies
DO $$
DECLARE
  v_active_count INT;
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM mining_companies
  WHERE status = 'active';

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 FINAL STATUS:';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Active companies: %', v_active_count;
  RAISE NOTICE '';

  IF v_active_count = 0 THEN
    RAISE NOTICE '⚠️  WARNING: No active mining companies!';
    RAISE NOTICE '   The dropdown will be empty.';
    RAISE NOTICE '';
    RAISE NOTICE '💡 SOLUTION:';
    RAISE NOTICE '   Set status to ''active'' for existing companies:';
    RAISE NOTICE '';
    RAISE NOTICE '   UPDATE mining_companies SET status = ''active'';';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ Dropdown should show % companies', v_active_count;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- Step 9: Show what the query returns (same as form query)
RAISE NOTICE '';
RAISE NOTICE '🔍 Query used by form:';
RAISE NOTICE '   SELECT id, name FROM mining_companies';
RAISE NOTICE '   WHERE status = ''active''';
RAISE NOTICE '   ORDER BY name';
RAISE NOTICE '';
RAISE NOTICE 'Results:';

SELECT
  id,
  name,
  status
FROM mining_companies
WHERE status = 'active'
ORDER BY name;
