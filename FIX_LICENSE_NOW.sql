/*
  ============================================================================
  SIMPLE LICENSE FIX - NO RAISE STATEMENTS
  ============================================================================
  This version works in Supabase SQL Editor (no RAISE NOTICE)
  ============================================================================
*/

-- Step 1: Ensure security definer functions exist
CREATE OR REPLACE FUNCTION public.check_user_role(required_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND role = required_role
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.check_user_has_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND role = ANY(required_roles)
      AND is_active = true
  );
$$;

-- Step 2: Ensure title column exists and has default
ALTER TABLE license_requests
  ALTER COLUMN title SET DEFAULT 'Export License Request';

-- Step 3: Fix existing NULL titles
UPDATE license_requests
SET title = 'Export License Request for ' || COALESCE(mine_name, 'Unknown Mine')
WHERE title IS NULL OR title = '';

-- Step 4: Drop old policies (if they exist)
DROP POLICY IF EXISTS "Factory and management can view license requests" ON license_requests;
DROP POLICY IF EXISTS "Factory can create license requests" ON license_requests;
DROP POLICY IF EXISTS "Factory can update draft requests" ON license_requests;
DROP POLICY IF EXISTS "Management can review requests" ON license_requests;
DROP POLICY IF EXISTS "Authenticated users can view license requests" ON license_requests;
DROP POLICY IF EXISTS "Authenticated users can insert license requests" ON license_requests;
DROP POLICY IF EXISTS "Authenticated users can update own draft requests" ON license_requests;
DROP POLICY IF EXISTS "Management can update all requests" ON license_requests;

-- Step 5: Create new simplified policies
CREATE POLICY "Authenticated users can view license requests"
  ON license_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('factory', 'management')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Authenticated users can insert license requests"
  ON license_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('factory', 'management')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Authenticated users can update own draft requests"
  ON license_requests
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND status = 'DRAFT'
  )
  WITH CHECK (
    created_by = auth.uid()
    AND status = 'DRAFT'
  );

CREATE POLICY "Management can update all requests"
  ON license_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'management'
        AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'management'
        AND user_profiles.is_active = true
    )
  );

-- Step 6: Verify data
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as with_title
FROM license_requests;

-- Step 7: Show the data
SELECT
  id,
  request_number,
  title,
  mine_name,
  status,
  planned_quantity_oz,
  request_date
FROM license_requests
ORDER BY created_at DESC;
