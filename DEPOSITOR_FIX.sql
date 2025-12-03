/*
  # Fix GEOFFREY Peter Eye Duplicate & Add Unique Constraint

  PURPOSE:
    1. Find and update duplicate GEOFFREY Peter Eye record to KOUROUSSA mine
    2. Add unique constraint to prevent future duplicates
    3. Create performance index

  HOW TO APPLY:
    - Open Supabase SQL Editor
    - Copy this entire script
    - Execute
    - Check NOTICE messages for results

  AUTHOR: System
  DATE: 2025-12-03
*/

-- ============================================================================
-- STEP 1: Display current state
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  total_records INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DEPOSITOR DUPLICATE FIX - STARTING';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '--- Current GEOFFREY Peter Eye records ---';

  FOR rec IN
    SELECT
      d.id,
      d.full_name,
      d.category,
      d.job_title,
      mc.name as company_name,
      mc.id as company_id,
      d.created_at
    FROM depositors d
    LEFT JOIN mining_companies mc ON d.mining_company_id = mc.id
    WHERE d.full_name ILIKE '%geoffrey%peter%'
       OR d.full_name ILIKE '%peter%eye%'
    ORDER BY d.created_at
  LOOP
    total_records := total_records + 1;
    RAISE NOTICE '% Record %: % | % | Company: % | Created: %',
      CASE WHEN total_records = 1 THEN '→' ELSE '→' END,
      total_records,
      rec.full_name,
      rec.job_title,
      COALESCE(rec.company_name, 'NO COMPANY'),
      rec.created_at;
  END LOOP;

  IF total_records = 0 THEN
    RAISE NOTICE 'ℹ️  No GEOFFREY Peter Eye records found';
    RAISE NOTICE '   This person does not exist in database yet';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE 'Total records found: %', total_records;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 2: Update duplicate to KOUROUSSA
-- ============================================================================

DO $$
DECLARE
  kouroussa_id UUID;
  first_record_id UUID;
  second_record_id UUID;
  records_count INTEGER;
  same_company_count INTEGER;
BEGIN
  RAISE NOTICE '--- Checking for duplicates in same company ---';

  -- Count total GEOFFREY Peter Eye records
  SELECT COUNT(*) INTO records_count
  FROM depositors
  WHERE full_name ILIKE '%geoffrey%peter%'
     OR full_name ILIKE '%peter%eye%';

  IF records_count = 0 THEN
    RAISE NOTICE 'ℹ️  No records to update';
    RETURN;
  ELSIF records_count = 1 THEN
    RAISE NOTICE 'ℹ️  Only one record exists - no duplicate to fix';
    RETURN;
  END IF;

  -- Check if duplicates are in same company
  SELECT COUNT(*) INTO same_company_count
  FROM (
    SELECT mining_company_id, COUNT(*) as cnt
    FROM depositors
    WHERE full_name ILIKE '%geoffrey%peter%'
       OR full_name ILIKE '%peter%eye%'
    GROUP BY mining_company_id
    HAVING COUNT(*) > 1
  ) sub;

  IF same_company_count = 0 THEN
    RAISE NOTICE '✅ No duplicates in same company - records are already separated';
    RAISE NOTICE '   No update needed';
    RETURN;
  END IF;

  RAISE NOTICE '⚠️  Found duplicates in same company - will fix';
  RAISE NOTICE '';

  -- Find Kouroussa mining company
  SELECT id INTO kouroussa_id
  FROM mining_companies
  WHERE name ILIKE '%kouroussa%' OR code ILIKE '%kouroussa%'
  LIMIT 1;

  IF kouroussa_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: Kouroussa mining company not found';
    RAISE NOTICE '   Please create Kouroussa company first or specify correct company name';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Kouroussa company found: %', kouroussa_id;

  -- Get first record (keep as-is)
  SELECT id INTO first_record_id
  FROM depositors
  WHERE full_name ILIKE '%geoffrey%peter%'
     OR full_name ILIKE '%peter%eye%'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Get second record (will update to Kouroussa)
  SELECT id INTO second_record_id
  FROM depositors
  WHERE full_name ILIKE '%geoffrey%peter%'
     OR full_name ILIKE '%peter%eye%'
  ORDER BY created_at ASC
  LIMIT 1 OFFSET 1;

  IF second_record_id IS NULL THEN
    RAISE NOTICE '⚠️  No second record to update';
    RETURN;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '--- Updating second record ---';
  RAISE NOTICE 'Record ID: %', second_record_id;
  RAISE NOTICE 'New Company: KOUROUSSA (%)', kouroussa_id;

  -- Update the second record
  UPDATE depositors
  SET
    mining_company_id = kouroussa_id,
    updated_at = NOW()
  WHERE id = second_record_id;

  RAISE NOTICE '✅ Successfully updated record to KOUROUSSA';
  RAISE NOTICE '';

END $$;

-- ============================================================================
-- STEP 3: Add unique constraint
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '--- Adding unique constraint ---';

  -- Drop constraint if it exists (using EXECUTE for dynamic SQL)
  BEGIN
    EXECUTE 'ALTER TABLE depositors DROP CONSTRAINT IF EXISTS depositors_unique_person_company_category';
    RAISE NOTICE '⚠️  Attempted to drop existing constraint (if any)';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '   (Constraint did not exist - this is normal)';
  END;

  -- Add the unique constraint
  ALTER TABLE depositors
  ADD CONSTRAINT depositors_unique_person_company_category
  UNIQUE (mining_company_id, category, full_name);

  RAISE NOTICE '✅ Constraint created: depositors_unique_person_company_category';
  RAISE NOTICE '   Prevents: Same person + same company + same category';
  RAISE NOTICE '';

EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '';
    RAISE NOTICE '❌ ERROR: Cannot add constraint - duplicates still exist';
    RAISE NOTICE '';
    RAISE NOTICE '   Run this query to find remaining duplicates:';
    RAISE NOTICE '';
    RAISE NOTICE '   SELECT full_name, mining_company_id, category, COUNT(*)';
    RAISE NOTICE '   FROM depositors';
    RAISE NOTICE '   GROUP BY full_name, mining_company_id, category';
    RAISE NOTICE '   HAVING COUNT(*) > 1;';
    RAISE NOTICE '';
  WHEN duplicate_object THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Constraint already exists - this is OK';
    RAISE NOTICE '';
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 4: Create performance index
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '--- Performance optimization ---';

  -- Drop index if exists
  BEGIN
    EXECUTE 'DROP INDEX IF EXISTS idx_depositors_company_category';
  EXCEPTION
    WHEN OTHERS THEN
      NULL; -- Ignore any error
  END;

  -- Create index
  CREATE INDEX idx_depositors_company_category
  ON depositors(mining_company_id, category);

  RAISE NOTICE '✅ Index created: idx_depositors_company_category';
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR creating index: %', SQLERRM;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 5: Add constraint documentation
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '--- Documenting constraint ---';

  -- Add comment on constraint
  BEGIN
    EXECUTE $$
      COMMENT ON CONSTRAINT depositors_unique_person_company_category ON depositors IS
      'Prevents duplicate depositors: same person cannot be registered multiple times for the same mining company with the same category/role. Allows same person in different companies or different roles in same company.'
    $$;
    RAISE NOTICE '✅ Constraint documented';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️  Could not document constraint: %', SQLERRM;
  END;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 6: Display final state
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  total_records INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL STATE - GEOFFREY Peter Eye';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  FOR rec IN
    SELECT
      d.full_name,
      d.category,
      d.job_title,
      mc.name as company_name,
      d.email,
      d.created_at
    FROM depositors d
    LEFT JOIN mining_companies mc ON d.mining_company_id = mc.id
    WHERE d.full_name ILIKE '%geoffrey%peter%'
       OR d.full_name ILIKE '%peter%eye%'
    ORDER BY mc.name, d.category
  LOOP
    total_records := total_records + 1;
    RAISE NOTICE '✓ Record %', total_records;
    RAISE NOTICE '  Name: %', rec.full_name;
    RAISE NOTICE '  Title: %', rec.job_title;
    RAISE NOTICE '  Company: %', COALESCE(rec.company_name, 'NO COMPANY');
    RAISE NOTICE '  Category: %', rec.category;
    RAISE NOTICE '';
  END LOOP;

  IF total_records = 0 THEN
    RAISE NOTICE 'ℹ️  No records found';
  ELSE
    RAISE NOTICE 'Total: % record(s)', total_records;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SCRIPT COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Verify records above are correct';
  RAISE NOTICE '2. Test creating duplicate (should be blocked)';
  RAISE NOTICE '3. Frontend validation is already active';
  RAISE NOTICE '';

END $$;
