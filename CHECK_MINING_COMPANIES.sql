-- ============================================================================
-- CHECK MINING COMPANIES - Verify Data for User Assignment
-- ============================================================================
--
-- PURPOSE: Check if mining companies exist for user site assignment
--
-- This script will:
-- 1. Count total mining companies
-- 2. List all active mining companies
-- 3. Show which companies are assigned to users
-- 4. Provide recommendations if no companies exist
--
-- ============================================================================

DO $$
DECLARE
  total_companies INTEGER;
  active_companies INTEGER;
  users_with_sites INTEGER;
  rec RECORD;
BEGIN
  -- Count companies
  SELECT COUNT(*) INTO total_companies FROM mining_companies;
  SELECT COUNT(*) INTO active_companies FROM mining_companies WHERE is_active = true;

  -- Count users with site assignments
  SELECT COUNT(*) INTO users_with_sites
  FROM user_profiles
  WHERE site_ids IS NOT NULL AND array_length(site_ids, 1) > 0;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'MINING COMPANIES STATUS';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total mining companies: %', total_companies;
  RAISE NOTICE 'Active mining companies: %', active_companies;
  RAISE NOTICE 'Users with site assignments: %', users_with_sites;
  RAISE NOTICE '';

  IF active_companies = 0 THEN
    RAISE NOTICE '⚠ WARNING: No active mining companies found!';
    RAISE NOTICE '';
    RAISE NOTICE 'The user assignment dropdown will be empty.';
    RAISE NOTICE 'You need to create mining companies first.';
    RAISE NOTICE '';
    RAISE NOTICE 'To create mining companies, you can:';
    RAISE NOTICE '1. Use the Mining Companies page in the app';
    RAISE NOTICE '2. Or run this SQL:';
    RAISE NOTICE '';
    RAISE NOTICE 'INSERT INTO mining_companies (name, code, country, is_active)';
    RAISE NOTICE 'VALUES';
    RAISE NOTICE '  (''Société Minière de Dinguiraye'', ''SMD'', ''Guinea'', true),';
    RAISE NOTICE '  (''African Gold Group'', ''AGG'', ''Mali'', true),';
    RAISE NOTICE '  (''Golden Mining Corporation'', ''GMC'', ''Côte d''''Ivoire'', true);';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✓ Active mining companies found!';
    RAISE NOTICE '';
    RAISE NOTICE 'LIST OF ACTIVE COMPANIES:';
    RAISE NOTICE '─────────────────────────────────────────────────────────────────────────';

    FOR rec IN
      SELECT name, code, country, created_at
      FROM mining_companies
      WHERE is_active = true
      ORDER BY name
    LOOP
      RAISE NOTICE '  • % (%) - %', rec.name, rec.code, rec.country;
    END LOOP;

    RAISE NOTICE '';

    IF users_with_sites > 0 THEN
      RAISE NOTICE 'USERS WITH SITE ASSIGNMENTS:';
      RAISE NOTICE '─────────────────────────────────────────────────────────────────────────';

      FOR rec IN
        SELECT
          up.full_name,
          up.email,
          up.role,
          array_length(up.site_ids, 1) as company_count
        FROM user_profiles up
        WHERE up.site_ids IS NOT NULL
          AND array_length(up.site_ids, 1) > 0
        ORDER BY up.full_name
      LOOP
        RAISE NOTICE '  • % (%) - % assigned to % compan%',
          rec.full_name,
          rec.email,
          rec.role,
          rec.company_count,
          CASE WHEN rec.company_count = 1 THEN 'y' ELSE 'ies' END;
      END LOOP;
    ELSE
      RAISE NOTICE 'ℹ No users have been assigned to mining companies yet.';
    END IF;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

END $$;

-- ============================================================================
-- DETAILED COMPANY INFORMATION
-- ============================================================================

SELECT
  mc.name as "Company Name",
  mc.code as "Code",
  mc.country as "Country",
  mc.is_active as "Active",
  mc.created_at as "Created At",
  (
    SELECT COUNT(*)
    FROM user_profiles up
    WHERE mc.id = ANY(up.site_ids)
  ) as "Users Assigned"
FROM mining_companies mc
ORDER BY mc.name;
