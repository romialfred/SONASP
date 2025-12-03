/*
  # Fix GEOFFREY Peter Eye Duplicate & Add Constraint

  1. Purpose
    - Update duplicate GEOFFREY Peter Eye record to KOUROUSSA mine
    - Add unique constraint to prevent future duplicates

  2. Changes
    - Identify and update the second GEOFFREY Peter Eye record
    - Add unique constraint on (mining_company_id, category, full_name)

  3. How to Apply
    - Open Supabase SQL Editor
    - Copy and paste this entire script
    - Execute
    - Check the NOTICE messages for results
*/

-- Step 1: Find GEOFFREY Peter Eye duplicates and display them
DO $$
DECLARE
  rec RECORD;
  kouroussa_id UUID;
  duplicate_id UUID;
  first_company_name TEXT;
BEGIN
  RAISE NOTICE '=== Starting Depositor Duplicate Fix ===';
  RAISE NOTICE '';

  -- Find Kouroussa mining company ID
  SELECT id INTO kouroussa_id
  FROM mining_companies
  WHERE name ILIKE '%kouroussa%' OR code ILIKE '%kouroussa%'
  LIMIT 1;

  IF kouroussa_id IS NULL THEN
    RAISE NOTICE '⚠️  Warning: Kouroussa mining company not found.';
    RAISE NOTICE '    Please create Kouroussa company first or check the company name.';
  ELSE
    RAISE NOTICE '✅ Kouroussa mining company found';
    RAISE NOTICE '   ID: %', kouroussa_id;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '--- Looking for GEOFFREY Peter Eye records ---';

  -- Find all GEOFFREY Peter Eye records
  FOR rec IN
    SELECT d.id, d.full_name, d.category, d.job_title, mc.name as company_name, d.created_at
    FROM depositors d
    LEFT JOIN mining_companies mc ON d.mining_company_id = mc.id
    WHERE d.full_name ILIKE '%geoffrey%peter%' OR d.full_name ILIKE '%peter%eye%'
    ORDER BY d.created_at
  LOOP
    RAISE NOTICE '📋 Record: % | % | Company: % | Created: %',
      rec.full_name, rec.job_title, rec.company_name, rec.created_at;
  END LOOP;

  -- Count duplicates in same company
  SELECT COUNT(*), mc.name INTO duplicate_id, first_company_name
  FROM depositors d
  LEFT JOIN mining_companies mc ON d.mining_company_id = mc.id
  WHERE (d.full_name ILIKE '%geoffrey%peter%' OR d.full_name ILIKE '%peter%eye%')
  GROUP BY mc.name
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Duplicate found in company: %', first_company_name;
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✅ No duplicates in same company';
  END IF;

  -- Get the second (duplicate) record to update
  SELECT id INTO duplicate_id
  FROM depositors
  WHERE full_name ILIKE '%geoffrey%peter%' OR full_name ILIKE '%peter%eye%'
  ORDER BY created_at DESC
  LIMIT 1 OFFSET 1;

  IF duplicate_id IS NOT NULL AND kouroussa_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '--- Updating duplicate record ---';

    -- Update the duplicate to Kouroussa
    UPDATE depositors
    SET mining_company_id = kouroussa_id,
        updated_at = NOW()
    WHERE id = duplicate_id;

    RAISE NOTICE '✅ Updated duplicate record to KOUROUSSA mine';
    RAISE NOTICE '   Record ID: %', duplicate_id;
  ELSIF duplicate_id IS NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE 'ℹ️  No duplicate found to update (only one record exists)';
  END IF;

  RAISE NOTICE '';
END $$;

-- Step 2: Add unique constraint to prevent future duplicates
DO $$
BEGIN
  RAISE NOTICE '--- Adding unique constraint ---';

  -- Drop constraint if it already exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'depositors_unique_person_company_category'
  ) THEN
    ALTER TABLE depositors DROP CONSTRAINT depositors_unique_person_company_category;
    RAISE NOTICE '⚠️  Dropped existing constraint (will recreate)';
  END IF;

  -- Add the constraint
  ALTER TABLE depositors
  ADD CONSTRAINT depositors_unique_person_company_category
  UNIQUE (mining_company_id, category, full_name);

  RAISE NOTICE '✅ Constraint added: depositors_unique_person_company_category';
  RAISE NOTICE '   Columns: (mining_company_id, category, full_name)';

EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '❌ Error: Cannot add constraint due to existing duplicates';
    RAISE NOTICE '   Please remove all duplicates first, then run this script again';
END $$;

-- Step 3: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_depositors_company_category
ON depositors(mining_company_id, category);

DO $$ BEGIN
  RAISE NOTICE '✅ Performance index created: idx_depositors_company_category';
END $$;

-- Step 4: Add comment to constraint
COMMENT ON CONSTRAINT depositors_unique_person_company_category ON depositors IS
'Ensures a person cannot be registered multiple times for the same mining company with the same category/role. This allows the same person to work for multiple companies or have different roles in the same company.';

DO $$ BEGIN
  RAISE NOTICE '✅ Constraint documentation added';
  RAISE NOTICE '';
END $$;

-- Step 5: Display final result
DO $$
DECLARE
  rec RECORD;
  record_count INT := 0;
BEGIN
  RAISE NOTICE '=== Final Depositor List for GEOFFREY Peter Eye ===';
  RAISE NOTICE '';

  FOR rec IN
    SELECT d.full_name, d.category, d.job_title, mc.name as company_name, d.email
    FROM depositors d
    LEFT JOIN mining_companies mc ON d.mining_company_id = mc.id
    WHERE d.full_name ILIKE '%geoffrey%peter%' OR d.full_name ILIKE '%peter%eye%'
    ORDER BY mc.name, d.category
  LOOP
    record_count := record_count + 1;
    RAISE NOTICE '% ✓ % | % | Company: %',
      record_count, rec.full_name, rec.job_title, rec.company_name;
  END LOOP;

  IF record_count = 0 THEN
    RAISE NOTICE 'ℹ️  No records found for GEOFFREY Peter Eye';
    RAISE NOTICE '   This is normal if the person does not exist in the database yet';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== Summary ===';
  RAISE NOTICE 'Total records: %', record_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Script completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Steps:';
  RAISE NOTICE '   1. Verify the results above';
  RAISE NOTICE '   2. Try creating a duplicate depositor (should fail)';
  RAISE NOTICE '   3. The frontend will now prevent duplicates automatically';
  RAISE NOTICE '';

END $$;
