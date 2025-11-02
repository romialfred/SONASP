-- ================================================================
-- SET YOUR USER AS MANAGEMENT
-- ================================================================
-- IMPORTANT: This script must be run while you are LOGGED IN
-- to your application so that auth.uid() returns your user ID
-- ================================================================

-- Check if you're authenticated
DO $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated! You must be logged in to run this script.';
  END IF;

  RAISE NOTICE 'Authenticated as user: %', auth.uid();
END $$;

-- Check if your profile exists
DO $$
DECLARE
  profile_exists boolean;
  current_role text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid()
  ) INTO profile_exists;

  IF profile_exists THEN
    SELECT role INTO current_role FROM user_profiles WHERE id = auth.uid();
    RAISE NOTICE 'Profile exists. Current role: %', current_role;

    -- Update to management if not already
    IF current_role != 'management' THEN
      UPDATE user_profiles
      SET role = 'management', is_active = true
      WHERE id = auth.uid();

      RAISE NOTICE '✓ Updated role to management';
    ELSE
      RAISE NOTICE '✓ Already management';
    END IF;
  ELSE
    RAISE NOTICE '⚠ Profile does not exist!';
    RAISE NOTICE 'Creating profile now...';

    -- Create profile
    INSERT INTO user_profiles (
      id,
      email,
      full_name,
      role,
      is_active,
      two_factor_enabled
    )
    SELECT
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = auth.uid()), 'Admin User'),
      'management',
      true,
      false;

    RAISE NOTICE '✓ Profile created with management role';
  END IF;
END $$;

-- Verify final result
SELECT
  'VERIFICATION:' as status,
  id,
  email,
  full_name,
  role,
  is_active,
  two_factor_enabled
FROM user_profiles
WHERE id = auth.uid();
