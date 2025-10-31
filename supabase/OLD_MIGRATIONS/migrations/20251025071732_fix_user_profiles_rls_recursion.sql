/*
  # Fix Infinite Recursion in user_profiles RLS Policies

  ## Problem
  The existing RLS policies on user_profiles cause infinite recursion (PostgreSQL error 42P17)
  when checking if a user has the 'management' role. The policies query user_profiles within
  their USING clauses, which triggers the same policy check again, creating an infinite loop.
  
  This blocks the login flow as profile fetches return HTTP 500 errors.

  ## Solution
  1. Drop all recursive policies that query user_profiles within their conditions
  2. Create minimal, non-recursive policies for user self-access
  3. Add service_role policy that bypasses RLS for administrative operations
  4. Management access to all profiles will be handled via application layer using service-role credentials

  ## Changes
  
  ### Dropped Policies (Recursive)
  - "Management can view all profiles"
  - "Management can update all profiles"
  - "Management can insert profiles"
  - All related management policies on user_site_assignments, user_permissions, user_sessions, security_events
  
  ### New Policies (Non-Recursive)
  - Simple SELECT policy: authenticated users can view only their own profile
  - Simple UPDATE policy: authenticated users can update only their own profile
  - Service role policy: service_role can perform all operations (bypasses RLS for admin features)

  ## Security Notes
  - Users can only access their own profile data via RLS
  - Management features use service-role authenticated calls that bypass RLS
  - Application layer validates management role before making service-role calls
  - Complete audit trail maintained for all profile access
*/

-- ============================================================================
-- PART 1: Drop All Recursive Policies on user_profiles
-- ============================================================================

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Management can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Management can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Management can insert profiles" ON user_profiles;

-- ============================================================================
-- PART 2: Create Simple, Non-Recursive Policies for user_profiles
-- ============================================================================

-- Users can SELECT their own profile only
CREATE POLICY "user_profiles_select_own"
ON user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can UPDATE their own profile only
CREATE POLICY "user_profiles_update_own"
ON user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Service role can do everything (for management features via application layer)
CREATE POLICY "user_profiles_service_role_all"
ON user_profiles
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PART 3: Fix Related Tables - Remove Recursive Management Policies
-- ============================================================================

-- Fix user_site_assignments - remove recursive management policies
DROP POLICY IF EXISTS "Management can view all site assignments" ON user_site_assignments;
DROP POLICY IF EXISTS "Management can manage site assignments" ON user_site_assignments;

-- Keep only user's own access and service_role
CREATE POLICY "user_site_assignments_service_role"
ON user_site_assignments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix user_permissions - remove recursive management policies
DROP POLICY IF EXISTS "Management can view all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can manage permissions" ON user_permissions;

-- Keep only user's own access and service_role
CREATE POLICY "user_permissions_service_role"
ON user_permissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix user_sessions - remove recursive management policies
DROP POLICY IF EXISTS "Management can view all sessions" ON user_sessions;

-- Keep only user's own access and service_role
CREATE POLICY "user_sessions_service_role"
ON user_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix security_events - remove recursive management policies
DROP POLICY IF EXISTS "Management can view all security events" ON security_events;

-- Keep only user's own access and service_role
CREATE POLICY "security_events_service_role"
ON security_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PART 4: Ensure Profile Auto-Creation Trigger is Robust
-- ============================================================================

-- Recreate the profile creation function with better error handling
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail user creation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile();

-- ============================================================================
-- PART 5: Grant Necessary Permissions
-- ============================================================================

-- Ensure authenticated users can read/update their own profiles
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_site_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO authenticated;
GRANT SELECT, INSERT ON public.security_events TO authenticated;

-- Service role gets full access (already has it by default, but being explicit)
GRANT ALL ON public.user_profiles TO service_role;
GRANT ALL ON public.user_site_assignments TO service_role;
GRANT ALL ON public.user_permissions TO service_role;
GRANT ALL ON public.user_sessions TO service_role;
GRANT ALL ON public.security_events TO service_role;

-- ============================================================================
-- PART 6: Add Comments for Documentation
-- ============================================================================

COMMENT ON POLICY "user_profiles_select_own" ON user_profiles IS 
'Allows authenticated users to view only their own profile. Non-recursive.';

COMMENT ON POLICY "user_profiles_update_own" ON user_profiles IS 
'Allows authenticated users to update only their own profile. Non-recursive.';

COMMENT ON POLICY "user_profiles_service_role_all" ON user_profiles IS 
'Allows service_role to perform all operations for management features. Bypasses RLS.';
