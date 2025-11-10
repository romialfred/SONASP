-- Check current user's role
SELECT 
  up.id,
  up.email,
  up.role,
  up.full_name
FROM user_profiles up
WHERE up.id = auth.uid();
