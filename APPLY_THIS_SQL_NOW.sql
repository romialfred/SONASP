-- ============================================================================
-- FIX LICENSE REQUESTS - ADD MISSING TITLE COLUMN
-- ============================================================================
--
-- PROBLEM:
--   License Requests page shows "400 error"
--   Table data fails to load but statistics work
--   The title column is missing from license_requests table
--
-- SOLUTION:
--   Add title column to license_requests table
--   Update existing records with default title
--
-- HOW TO APPLY:
--   1. Open Supabase Dashboard
--   2. Go to SQL Editor
--   3. Copy and paste THIS ENTIRE FILE
--   4. Click "Run" button
--   5. Refresh browser to see your data
-- ============================================================================

-- Step 1: Check if title column exists
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CHECKING LICENSE_REQUESTS SCHEMA...';
  RAISE NOTICE '========================================';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'title'
  ) THEN
    RAISE NOTICE 'SUCCESS: title column ALREADY EXISTS';
  ELSE
    RAISE NOTICE 'WARNING: title column MISSING (will add now)';
  END IF;
END $$;

-- Step 2: Add title column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'title'
  ) THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ADDING title COLUMN...';
    RAISE NOTICE '========================================';

    -- Add title column with temporary default
    ALTER TABLE license_requests
    ADD COLUMN title text NOT NULL DEFAULT 'Export License Request';

    RAISE NOTICE 'SUCCESS: title column added successfully';

    -- Update existing records to have meaningful titles
    UPDATE license_requests
    SET title = 'Export License Request for ' || mine_name
    WHERE title = 'Export License Request';

    RAISE NOTICE 'SUCCESS: Updated existing records with meaningful titles';

    -- Remove default (new records must provide title)
    ALTER TABLE license_requests
    ALTER COLUMN title DROP DEFAULT;

    RAISE NOTICE 'SUCCESS: Removed default constraint';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';
  ELSE
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INFO: title column already exists';
    RAISE NOTICE '      No changes needed';
    RAISE NOTICE '========================================';
  END IF;
END $$;

-- Step 3: Verify the change
DO $$
DECLARE
  col_exists boolean;
  record_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION';
  RAISE NOTICE '========================================';

  -- Check column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'title'
  ) INTO col_exists;

  IF col_exists THEN
    RAISE NOTICE 'SUCCESS: title column exists: YES';
  ELSE
    RAISE NOTICE 'ERROR: title column exists: NO';
  END IF;

  -- Count records
  SELECT COUNT(*) INTO record_count FROM license_requests;
  RAISE NOTICE 'INFO: Total license requests: %', record_count;

  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- Step 4: Show current data
SELECT
  id,
  request_number,
  title,
  mine_name,
  status,
  planned_quantity_oz,
  created_at
FROM license_requests
ORDER BY created_at DESC;
