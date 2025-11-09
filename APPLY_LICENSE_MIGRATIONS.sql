/*
  ═══════════════════════════════════════════════════════════════════════════
  🔧 FIX LICENSE REQUEST FORM - Apply Title Column
  ═══════════════════════════════════════════════════════════════════════════

  This script:
  1. Adds 'title' column to license_requests table
  2. Verifies the column was added successfully
  3. Shows table structure
*/

-- Step 1: Add title column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'title'
  ) THEN
    ALTER TABLE license_requests
    ADD COLUMN title text NOT NULL DEFAULT 'Untitled License Request';

    -- Remove default after adding column (new records must provide title)
    ALTER TABLE license_requests
    ALTER COLUMN title DROP DEFAULT;

    RAISE NOTICE '✓ Added title column to license_requests table';
  ELSE
    RAISE NOTICE '  Title column already exists in license_requests table';
  END IF;
END $$;

-- Step 2: Verify column was added
DO $$
DECLARE
  v_has_title BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'title'
  ) INTO v_has_title;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 VERIFICATION';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  IF v_has_title THEN
    RAISE NOTICE '✅ Title column EXISTS in license_requests';
  ELSE
    RAISE NOTICE '❌ Title column MISSING in license_requests';
  END IF;

  RAISE NOTICE '';
END $$;

-- Step 3: Show complete table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'license_requests'
ORDER BY ordinal_position;

-- Step 4: Show existing requests (if any)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM license_requests;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📈 EXISTING DATA';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total license requests: %', v_count;

  IF v_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ No existing requests - no data migration needed';
  ELSE
    RAISE NOTICE '  Existing requests now have default title';
    RAISE NOTICE '  You may want to update them with proper titles';
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
