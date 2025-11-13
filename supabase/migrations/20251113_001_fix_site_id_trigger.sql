/*
  # Fix Site ID Trigger - Use User's Actual Site

  1. Problem Fixed
    - The trigger was forcing site_id to 'guinea' for all users
    - Should use the user's actual site_id from their profile

  2. Solution
    - Modify the trigger to fetch user's site_id from profiles table
    - Only use 'guinea' as final fallback if profile has no site

  3. Security
    - Maintains RLS protection
    - Authenticated users only
*/

-- ========================================
-- 1. DROP OLD TRIGGER AND FUNCTION
-- ========================================

DROP TRIGGER IF EXISTS set_created_by_on_daily_production ON daily_production;
DROP FUNCTION IF EXISTS set_created_by_on_insert() CASCADE;

-- ========================================
-- 2. CREATE IMPROVED TRIGGER FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION set_daily_production_defaults()
RETURNS TRIGGER AS $$
DECLARE
  user_site_id text;
BEGIN
  -- Auto-fill created_by if not set
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;

  -- Handle site_id intelligently
  IF NEW.site_id IS NULL OR NEW.site_id = '' THEN
    -- Try to get user's site_id from profiles table
    SELECT site_ids[1] INTO user_site_id
    FROM profiles
    WHERE id = auth.uid()
    AND site_ids IS NOT NULL
    AND array_length(site_ids, 1) > 0
    LIMIT 1;

    -- Use user's site if found, otherwise default to 'guinea'
    NEW.site_id = COALESCE(user_site_id, 'guinea');

    RAISE NOTICE '🔧 Auto-filled site_id: % for user: %', NEW.site_id, auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 3. CREATE IMPROVED TRIGGER
-- ========================================

-- Drop trigger if it exists to avoid conflict
DROP TRIGGER IF EXISTS set_daily_production_defaults_trigger ON daily_production;

-- Now create the trigger
CREATE TRIGGER set_daily_production_defaults_trigger
  BEFORE INSERT ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION set_daily_production_defaults();

-- ========================================
-- 4. ADD COMMENT FOR DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION set_daily_production_defaults() IS
'Auto-fills created_by and site_id for new daily_production records.
Site_id is fetched from the user''s profile, falling back to guinea only if no profile site is found.';

-- ========================================
-- 5. VERIFICATION
-- ========================================

DO $$
DECLARE
  trigger_exists boolean;
  function_exists boolean;
BEGIN
  -- Check if trigger exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_daily_production_defaults_trigger'
    AND tgrelid = 'daily_production'::regclass
  ) INTO trigger_exists;

  -- Check if function exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_daily_production_defaults'
  ) INTO function_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'SITE_ID TRIGGER FIX VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Function exists: %', CASE WHEN function_exists THEN '✅ Yes' ELSE '❌ No' END;
  RAISE NOTICE 'Trigger exists: %', CASE WHEN trigger_exists THEN '✅ Yes' ELSE '❌ No' END;
  RAISE NOTICE '';

  IF trigger_exists AND function_exists THEN
    RAISE NOTICE '✅ Site ID trigger successfully updated!';
    RAISE NOTICE '';
    RAISE NOTICE 'Behavior:';
    RAISE NOTICE '  1. If site_id is provided → Use provided value';
    RAISE NOTICE '  2. If site_id is NULL → Try to fetch from user profile';
    RAISE NOTICE '  3. If no profile site → Default to guinea';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING '⚠️ Trigger or function not properly created!';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 6. TEST QUERY (Optional - for verification)
-- ========================================

/*
-- You can run this to test if the trigger works correctly:

-- First, check a user's site_id from profiles
SELECT id, email, site_ids
FROM profiles
WHERE id = auth.uid();

-- Then insert a production without site_id and see if it's auto-filled
INSERT INTO daily_production (
  production_date,
  bullion_grams,
  estimated_fineness_pct,
  mining_company_id
) VALUES (
  CURRENT_DATE,
  1000.00,
  95.0,
  (SELECT id FROM mining_companies LIMIT 1)
) RETURNING id, site_id, created_by;

-- The returned site_id should match your profile's site_ids[1]
*/
