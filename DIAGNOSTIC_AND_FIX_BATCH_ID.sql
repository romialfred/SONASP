/*
  # DIAGNOSTIC AND FIX: batch_id Column Issue in Inventory Tables

  ## Problem
  Error when adding inventory entry: column "batch_id" of relation "inventory_transactions" does not exist

  ## Root Cause Analysis
  The application has evolved from using batches to using freight_shipments for inventory tracking.
  However, there may be triggers or functions that still reference the old 'batch_id' column.

  ## This Script Will:
  1. Check for batch_id column existence in inventory tables
  2. Find all triggers that reference batch_id
  3. Find all functions that reference batch_id
  4. Provide SQL commands to remove batch_id references

  ## Instructions
  Execute this script in Supabase SQL Editor to diagnose and fix the issue.
*/

-- ============================================================================
-- SECTION 1: CHECK COLUMN EXISTENCE
-- ============================================================================

DO $$
DECLARE
  gold_inv_has_batch boolean;
  trans_has_batch boolean;
BEGIN
  RAISE NOTICE '======================================================================';
  RAISE NOTICE '1. CHECKING FOR batch_id COLUMNS';
  RAISE NOTICE '======================================================================';

  -- Check gold_inventory
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'gold_inventory'
      AND column_name = 'batch_id'
  ) INTO gold_inv_has_batch;

  IF gold_inv_has_batch THEN
    RAISE NOTICE '⚠️  gold_inventory HAS batch_id column - NEEDS REMOVAL';
  ELSE
    RAISE NOTICE '✅ gold_inventory does NOT have batch_id column - OK';
  END IF;

  -- Check inventory_transactions
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
      AND column_name = 'batch_id'
  ) INTO trans_has_batch;

  IF trans_has_batch THEN
    RAISE NOTICE '⚠️  inventory_transactions HAS batch_id column - NEEDS REMOVAL';
  ELSE
    RAISE NOTICE '✅ inventory_transactions does NOT have batch_id column - OK';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 2: FIND TRIGGERS REFERENCING batch_id
-- ============================================================================

DO $$
DECLARE
  trigger_rec record;
  trigger_count integer := 0;
BEGIN
  RAISE NOTICE '======================================================================';
  RAISE NOTICE '2. FINDING TRIGGERS ON INVENTORY TABLES';
  RAISE NOTICE '======================================================================';

  FOR trigger_rec IN
    SELECT
      t.tgname AS trigger_name,
      c.relname AS table_name,
      p.proname AS function_name,
      pg_get_functiondef(p.oid) AS function_def
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname IN ('gold_inventory', 'inventory_transactions')
      AND NOT t.tgisinternal
  LOOP
    trigger_count := trigger_count + 1;
    RAISE NOTICE '';
    RAISE NOTICE '📌 Trigger: % on table %', trigger_rec.trigger_name, trigger_rec.table_name;
    RAISE NOTICE '   Function: %', trigger_rec.function_name;

    -- Check if function definition contains batch_id
    IF trigger_rec.function_def LIKE '%batch_id%' THEN
      RAISE NOTICE '   🔥 PROBLEM: Function contains "batch_id" reference!';
      RAISE NOTICE '   Definition preview:';
      RAISE NOTICE '%', substring(trigger_rec.function_def FROM 1 FOR 500);
    ELSE
      RAISE NOTICE '   ✅ Function does NOT reference batch_id';
    END IF;
  END LOOP;

  IF trigger_count = 0 THEN
    RAISE NOTICE '✅ No triggers found on inventory tables';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 3: FIND FUNCTIONS REFERENCING batch_id
-- ============================================================================

DO $$
DECLARE
  func_rec record;
  func_count integer := 0;
BEGIN
  RAISE NOTICE '======================================================================';
  RAISE NOTICE '3. FINDING FUNCTIONS WITH batch_id REFERENCES';
  RAISE NOTICE '======================================================================';

  FOR func_rec IN
    SELECT
      p.proname AS function_name,
      pg_get_functiondef(p.oid) AS function_def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND pg_get_functiondef(p.oid) LIKE '%batch_id%'
      AND (
        p.proname LIKE '%inventory%'
        OR p.proname LIKE '%batch%'
        OR p.proname LIKE '%stock%'
        OR pg_get_functiondef(p.oid) LIKE '%gold_inventory%'
        OR pg_get_functiondef(p.oid) LIKE '%inventory_transactions%'
      )
  LOOP
    func_count := func_count + 1;
    RAISE NOTICE '';
    RAISE NOTICE '🔥 Function: % - CONTAINS batch_id reference', func_rec.function_name;
    RAISE NOTICE '   Full definition:';
    RAISE NOTICE '%', func_rec.function_def;
    RAISE NOTICE '';
    RAISE NOTICE '   ⚠️  THIS FUNCTION NEEDS TO BE FIXED OR DROPPED';
    RAISE NOTICE '';
  END LOOP;

  IF func_count = 0 THEN
    RAISE NOTICE '✅ No functions found with batch_id references';
  ELSE
    RAISE NOTICE '⚠️  Found % function(s) that need to be fixed', func_count;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 4: CHECK FOR FOREIGN KEY CONSTRAINTS
-- ============================================================================

DO $$
DECLARE
  constraint_rec record;
  constraint_count integer := 0;
BEGIN
  RAISE NOTICE '======================================================================';
  RAISE NOTICE '4. CHECKING FOR batch_id FOREIGN KEY CONSTRAINTS';
  RAISE NOTICE '======================================================================';

  FOR constraint_rec IN
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('gold_inventory', 'inventory_transactions')
      AND kcu.column_name LIKE '%batch%'
  LOOP
    constraint_count := constraint_count + 1;
    RAISE NOTICE '🔥 Found batch-related FK constraint:';
    RAISE NOTICE '   Table: %', constraint_rec.table_name;
    RAISE NOTICE '   Constraint: %', constraint_rec.constraint_name;
    RAISE NOTICE '   Column: % -> %.%',
      constraint_rec.column_name,
      constraint_rec.foreign_table_name,
      constraint_rec.foreign_column_name;
  END LOOP;

  IF constraint_count = 0 THEN
    RAISE NOTICE '✅ No batch-related foreign key constraints found';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 5: SUMMARY AND RECOMMENDATIONS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '======================================================================';
  RAISE NOTICE '5. SUMMARY AND NEXT STEPS';
  RAISE NOTICE '======================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Based on the diagnostic above:';
  RAISE NOTICE '';
  RAISE NOTICE '1. If any columns need removal, run:';
  RAISE NOTICE '   ALTER TABLE gold_inventory DROP COLUMN IF EXISTS batch_id CASCADE;';
  RAISE NOTICE '   ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS batch_id CASCADE;';
  RAISE NOTICE '';
  RAISE NOTICE '2. If any triggers reference batch_id, drop and recreate them without batch_id';
  RAISE NOTICE '';
  RAISE NOTICE '3. If any functions reference batch_id, update or drop them';
  RAISE NOTICE '';
  RAISE NOTICE '4. Test inventory entry creation after fixes';
  RAISE NOTICE '';
  RAISE NOTICE '======================================================================';
END $$;

-- ============================================================================
-- OPTIONAL FIX COMMANDS (Uncomment if needed after reviewing diagnostic)
-- ============================================================================

/*
-- Remove batch_id columns if they exist
-- ALTER TABLE gold_inventory DROP COLUMN IF EXISTS batch_id CASCADE;
-- ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS batch_id CASCADE;

-- If you find specific triggers that need to be dropped, add commands here:
-- DROP TRIGGER IF EXISTS trigger_name ON table_name;

-- If you find specific functions that need to be dropped, add commands here:
-- DROP FUNCTION IF EXISTS function_name CASCADE;
*/

RAISE NOTICE '✅ Diagnostic complete! Review the output above to identify issues.';
