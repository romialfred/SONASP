/*
  # Add User Management RLS Policies
  
  1. Changes
    - Add policy for management users to read all user profiles
    - This allows the User Management page to display all users
    - Only users with 'management' role can view all profiles
  
  2. Security
    - Regular users can still only see their own profile
    - Management role required to view all users
*/

-- Create policy for management role to view all user profiles
CREATE POLICY "user_profiles_management_select_all"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );
