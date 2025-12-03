/*
  Truncate Depositors Table

  This script will DELETE ALL depositor records from the database.

  WARNING: This action cannot be undone!

  Use this to start fresh with a clean depositors table.
*/

-- ============================================================================
-- STEP 1: Display current state
-- ============================================================================

DO $$
DECLARE
  total_count INTEGER;
  active_count INTEGER;
  inactive_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRUNCATE DEPOSITORS - STARTING';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Count records
  SELECT COUNT(*) INTO total_count FROM depositors;
  SELECT COUNT(*) INTO active_count FROM depositors WHERE is_active = true;
  SELECT COUNT(*) INTO inactive_count FROM depositors WHERE is_active = false;

  RAISE NOTICE 'Current state:';
  RAISE NOTICE '  Total depositors: %', total_count;
  RAISE NOTICE '  Active: %', active_count;
  RAISE NOTICE '  Inactive: %', inactive_count;
  RAISE NOTICE '';

  IF total_count = 0 THEN
    RAISE NOTICE 'Table is already empty - nothing to truncate';
    RAISE NOTICE '';
    RETURN;
  END IF;

END $$;

-- ============================================================================
-- STEP 2: Delete all depositor records
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '--- Deleting all depositor records ---';
  RAISE NOTICE '';

  -- Delete all records
  DELETE FROM depositors;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE '✅ Deleted % depositor record(s)', deleted_count;
  RAISE NOTICE '';

END $$;

-- ============================================================================
-- STEP 3: Reset sequence (if exists)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '--- Resetting sequences ---';

  -- Reset the ID sequence if it exists
  BEGIN
    -- This will restart the sequence from 1
    -- Note: depositors uses UUID, so this step may not apply
    RAISE NOTICE '   Depositors table uses UUID - no sequence to reset';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '   No sequence found or error: %', SQLERRM;
  END;

  RAISE NOTICE '';

END $$;

-- ============================================================================
-- STEP 4: Verify truncation
-- ============================================================================

DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO remaining_count FROM depositors;

  RAISE NOTICE 'Remaining depositor records: %', remaining_count;
  RAISE NOTICE '';

  IF remaining_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: Depositors table is now empty';
    RAISE NOTICE '✅ Table is ready for fresh data';
  ELSE
    RAISE NOTICE '❌ WARNING: % record(s) still remain', remaining_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRUNCATE COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Show constraint status
  RAISE NOTICE 'NOTE: Unique constraint remains active';
  RAISE NOTICE '      No duplicates can be created';
  RAISE NOTICE '';

END $$;
