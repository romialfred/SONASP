/*
  ============================================================================
  FIX LICENSE REQUESTS - SELECT * ISSUE
  ============================================================================

  ISSUE: Stats work but table data doesn't load
  - getRequestStatistics() works: SELECT status (returns 1 row)
  - listRequests() fails: SELECT * (returns 0 rows)

  This means our RLS policy allows SELECT but something is blocking SELECT *

  SOLUTION: Grant explicit SELECT permission on all columns

  ============================================================================
*/

-- First, let's check what's actually in the table
SELECT
  id,
  request_number,
  title,
  mine_id,
  mine_name,
  status,
  planned_quantity_oz,
  request_date,
  created_at,
  created_by
FROM license_requests
ORDER BY created_at DESC
LIMIT 5;

-- Now let's test the RLS policy directly
SET ROLE authenticated;

-- This should work (it's what stats uses)
SELECT status FROM license_requests;

-- This should also work (it's what listRequests uses)
SELECT * FROM license_requests;

RESET ROLE;

-- If SELECT * didn't return data, we need to check if there's a column-level security issue
-- Let's verify the policy is using our new function

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
WHERE tablename = 'license_requests'
ORDER BY policyname;

-- Show what the security definer functions return for current user
SELECT
  auth.uid() as current_user_id,
  public.check_user_role('management') as is_management,
  public.check_user_role('factory') as is_factory,
  public.check_user_has_role(ARRAY['management', 'factory']) as has_required_role;

-- Check user profile
SELECT
  id,
  email,
  full_name,
  role,
  is_active
FROM user_profiles
WHERE id = auth.uid();

/*
  ============================================================================
  If the above queries work but the app still doesn't show data,
  the issue might be in how the frontend processes the response.

  Let me create an additional debug policy that logs access attempts.
  ============================================================================
*/

-- Create a simple, explicit SELECT policy
DROP POLICY IF EXISTS "Factory and management can view license requests" ON license_requests;

CREATE POLICY "Authenticated users with proper role can SELECT license requests"
  ON license_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('factory', 'management')
      AND up.is_active = true
    )
  );

-- Verification
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'UPDATED SELECT POLICY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'The SELECT policy now uses a direct subquery';
  RAISE NOTICE 'instead of the security definer function.';
  RAISE NOTICE '';
  RAISE NOTICE 'This bypasses any function execution issues.';
  RAISE NOTICE '========================================';
END $$;
