/*
  # Fix Expedition Lot Numbers - Manual Script

  IMPORTANT: Execute this script in Supabase SQL Editor

  This script will:
  1. Ensure all mining companies have 3-letter abbreviations
  2. Regenerate all expedition lot numbers in correct format
  3. Initialize expedition counters

  Format: HUM-{ABBREVIATION}-{COUNTER}/YEAR
  Example: HUM-SMK-0380/2025
*/

-- =============================================================================
-- STEP 1: Update Mining Company Abbreviations
-- =============================================================================

-- Update known companies with correct abbreviations
UPDATE mining_companies
SET abbreviation = 'KGM'
WHERE (LOWER(name) LIKE '%kouroussa%' OR code = 'KGM')
  AND (abbreviation IS NULL OR abbreviation = '' OR abbreviation != 'KGM');

UPDATE mining_companies
SET abbreviation = 'SMK'
WHERE (LOWER(name) LIKE '%komana%' OR code = 'SMK')
  AND (abbreviation IS NULL OR abbreviation = '' OR abbreviation != 'SMK');

UPDATE mining_companies
SET abbreviation = 'DGB'
WHERE (LOWER(name) LIKE '%dugbe%' OR code = 'DGB' OR code = 'Dugbe')
  AND (abbreviation IS NULL OR abbreviation = '' OR abbreviation != 'DGB');

UPDATE mining_companies
SET abbreviation = 'YFL'
WHERE (LOWER(name) LIKE '%yanfolila%' OR code = 'YFL')
  AND (abbreviation IS NULL OR abbreviation = '' OR abbreviation != 'YFL');

-- For any remaining companies without abbreviation, use first 3 letters of code
UPDATE mining_companies
SET abbreviation = UPPER(SUBSTRING(code FROM 1 FOR 3))
WHERE (abbreviation IS NULL OR abbreviation = '')
  AND code IS NOT NULL
  AND LENGTH(code) >= 3;

-- Verify abbreviations
SELECT
  id,
  name,
  code,
  abbreviation,
  is_active
FROM mining_companies
ORDER BY name;

-- =============================================================================
-- STEP 2: Clear and Rebuild Expedition Lot Counters
-- =============================================================================

-- Clear existing counters
TRUNCATE TABLE expedition_lot_counters CASCADE;

-- Rebuild counters based on existing shipping_preparations
INSERT INTO expedition_lot_counters (mining_company_id, year, counter)
SELECT
  sp.mining_company_id,
  EXTRACT(YEAR FROM sp.created_at)::INTEGER as year,
  COUNT(*) as counter
FROM shipping_preparations sp
WHERE sp.mining_company_id IS NOT NULL
GROUP BY sp.mining_company_id, EXTRACT(YEAR FROM sp.created_at)::INTEGER
ON CONFLICT (mining_company_id, year) DO UPDATE
SET counter = EXCLUDED.counter,
    updated_at = now();

-- Verify counters
SELECT
  mc.name as company,
  mc.abbreviation,
  elc.year,
  elc.counter,
  elc.updated_at
FROM expedition_lot_counters elc
JOIN mining_companies mc ON mc.id = elc.mining_company_id
ORDER BY elc.year DESC, mc.name;

-- =============================================================================
-- STEP 3: Regenerate ALL Expedition Lot Numbers
-- =============================================================================

-- Create temporary function to regenerate numbers
CREATE OR REPLACE FUNCTION regenerate_expedition_lot_numbers()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_prep RECORD;
  v_abbreviation TEXT;
  v_year INTEGER;
  v_counter INTEGER := 0;
  v_last_company_id UUID;
  v_last_year INTEGER;
  v_new_lot_number TEXT;
  v_count INTEGER := 0;
BEGIN
  v_last_company_id := NULL;
  v_last_year := NULL;

  -- Process all shipping_preparations in chronological order per company/year
  FOR v_prep IN
    SELECT
      sp.id,
      sp.mining_company_id,
      sp.expedition_lot_number as old_number,
      EXTRACT(YEAR FROM sp.created_at)::INTEGER as year,
      mc.abbreviation,
      sp.created_at
    FROM shipping_preparations sp
    LEFT JOIN mining_companies mc ON mc.id = sp.mining_company_id
    WHERE sp.mining_company_id IS NOT NULL
    ORDER BY sp.mining_company_id, EXTRACT(YEAR FROM sp.created_at)::INTEGER, sp.created_at ASC
  LOOP
    v_year := v_prep.year;
    v_abbreviation := v_prep.abbreviation;

    -- Reset counter when company or year changes
    IF v_last_company_id IS NULL OR
       v_last_company_id != v_prep.mining_company_id OR
       v_last_year != v_year THEN
      v_counter := 0;
      v_last_company_id := v_prep.mining_company_id;
      v_last_year := v_year;
    END IF;

    -- Increment counter
    v_counter := v_counter + 1;

    -- Generate new expedition lot number
    IF v_abbreviation IS NOT NULL AND v_abbreviation != '' THEN
      v_new_lot_number := 'HUM-' || v_abbreviation || '-' || LPAD(v_counter::TEXT, 4, '0') || '/' || v_year::TEXT;
    ELSE
      v_new_lot_number := 'HUM-XXX-' || LPAD(v_counter::TEXT, 4, '0') || '/' || v_year::TEXT;
    END IF;

    -- Update the expedition lot number
    UPDATE shipping_preparations
    SET expedition_lot_number = v_new_lot_number
    WHERE id = v_prep.id;

    v_count := v_count + 1;

    RAISE NOTICE 'Updated: % -> % (created: %)',
      v_prep.old_number,
      v_new_lot_number,
      v_prep.created_at::DATE;
  END LOOP;

  RAISE NOTICE '=== COMPLETED: % expedition lot numbers updated ===', v_count;
END;
$$;

-- Execute the regeneration
SELECT regenerate_expedition_lot_numbers();

-- Drop the temporary function
DROP FUNCTION IF EXISTS regenerate_expedition_lot_numbers();

-- =============================================================================
-- STEP 4: Verify Results
-- =============================================================================

-- Check expedition lot numbers
SELECT
  sp.expedition_lot_number,
  mc.name as company,
  mc.abbreviation,
  EXTRACT(YEAR FROM sp.created_at)::INTEGER as year,
  sp.created_at::DATE as date,
  CASE
    WHEN sp.expedition_lot_number LIKE 'HUM-%-____/____' AND sp.expedition_lot_number NOT LIKE '%XXX%' THEN '✅ Correct'
    WHEN sp.expedition_lot_number LIKE '%XXX%' THEN '❌ Has XXX'
    ELSE '⚠️ Invalid Format'
  END as status
FROM shipping_preparations sp
LEFT JOIN mining_companies mc ON mc.id = sp.mining_company_id
ORDER BY sp.created_at DESC
LIMIT 50;

-- Count status
SELECT
  CASE
    WHEN expedition_lot_number LIKE 'HUM-%-____/____' AND expedition_lot_number NOT LIKE '%XXX%' THEN '✅ Correct'
    WHEN expedition_lot_number LIKE '%XXX%' THEN '❌ Has XXX'
    ELSE '⚠️ Invalid Format'
  END as status,
  COUNT(*) as count
FROM shipping_preparations
GROUP BY status;

-- Show any companies still missing abbreviations
SELECT
  name,
  code,
  abbreviation,
  is_active
FROM mining_companies
WHERE is_active = true
  AND (abbreviation IS NULL OR abbreviation = '' OR LENGTH(abbreviation) != 3);

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Expedition Lot Numbers Fix Completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'All expedition lot numbers have been regenerated.';
  RAISE NOTICE 'Format: HUM-{ABBREVIATION}-{COUNTER}/YEAR';
  RAISE NOTICE 'Example: HUM-SMK-0380/2025';
  RAISE NOTICE '';
  RAISE NOTICE 'Please verify the results above.';
END $$;
