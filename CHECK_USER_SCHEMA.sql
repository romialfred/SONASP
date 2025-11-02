-- ================================================================
-- CHECK USER SCHEMA AND FIND YOUR USER ID
-- ================================================================
-- This script will show all users in auth.users and user_profiles
-- so you can manually set the correct user as management
-- ================================================================

-- Show all users from auth.users (authentication table)
SELECT
  '=== AUTH USERS ===' as info,
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- Show all users from user_profiles (application table)
SELECT
  '=== USER PROFILES ===' as info,
  id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM user_profiles
ORDER BY created_at DESC;

-- Show columns in user_profiles table
SELECT
  '=== USER_PROFILES COLUMNS ===' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Show modules count
SELECT
  '=== MODULES COUNT ===' as info,
  COUNT(*) as total
FROM modules;
