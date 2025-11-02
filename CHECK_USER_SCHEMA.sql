-- Check user_profiles table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Check if user_invitations table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'user_invitations'
) as user_invitations_exists;

-- Check modules table
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'modules'
) as modules_exists;

-- Check user_permissions table
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'user_permissions'
) as user_permissions_exists;
