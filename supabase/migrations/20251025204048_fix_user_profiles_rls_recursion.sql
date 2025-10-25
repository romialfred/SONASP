/*
  # Fix User Profiles RLS Infinite Recursion
  
  1. Problem
    - The management policy causes infinite recursion because it queries user_profiles
      while evaluating RLS policy for user_profiles
    
  2. Solution
    - Drop the recursive policy
    - Use auth.jwt() to check user role from JWT metadata instead
    - This avoids querying the table during policy evaluation
  
  3. Security
    - Role is stored in JWT after login
    - No table query needed for policy evaluation
    - Prevents infinite recursion
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "user_profiles_management_select_all" ON user_profiles;

-- Create new non-recursive policy using JWT metadata
CREATE POLICY "user_profiles_management_select_all"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is management role (from JWT metadata)
    (auth.jwt() ->> 'role')::text = 'management'
    OR
    -- Or if viewing own profile
    id = auth.uid()
  );
