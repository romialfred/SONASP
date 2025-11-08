/*
  QUICK START: Apply License System

  Copy this entire file and paste into Supabase SQL Editor.
  This will check if migrations need to be applied and show you the status.

  IMPORTANT: This is just a verification script.
  You must apply the actual migration files from supabase/migrations/
*/

-- Check if license system tables exist
DO $$
BEGIN
  RAISE NOTICE '=== LICENSE SYSTEM STATUS CHECK ===';
  RAISE NOTICE '';

  -- Check licenses table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'licenses') THEN
    RAISE NOTICE '✓ licenses table EXISTS';
    EXECUTE 'SELECT COUNT(*) FROM licenses' INTO @count;
    RAISE NOTICE '  → Contains % licenses', @count;
  ELSE
    RAISE NOTICE '✗ licenses table MISSING';
    RAISE NOTICE '  → Apply migration: 20251108000000_create_export_license_system.sql';
  END IF;

  -- Check license_requests table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'license_requests') THEN
    RAISE NOTICE '✓ license_requests table EXISTS';
  ELSE
    RAISE NOTICE '✗ license_requests table MISSING';
  END IF;

  -- Check license_quota_transactions table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'license_quota_transactions') THEN
    RAISE NOTICE '✓ license_quota_transactions table EXISTS';
  ELSE
    RAISE NOTICE '✗ license_quota_transactions table MISSING';
  END IF;

  -- Check if sample data exists
  IF EXISTS (SELECT 1 FROM licenses WHERE license_number LIKE 'LIC-2024-%') THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓ Sample data EXISTS';
    EXECUTE 'SELECT COUNT(*) FROM licenses WHERE license_number LIKE ''LIC-2024-%''' INTO @count;
    RAISE NOTICE '  → Found % sample licenses', @count;
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✗ Sample data MISSING';
    RAISE NOTICE '  → Apply migration: 20251108100000_seed_license_sample_data.sql';
  END IF;

  -- Check if license_id column exists on batches
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'license_id'
  ) THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓ batches.license_id column EXISTS';
    EXECUTE 'SELECT COUNT(*) FROM batches WHERE license_id IS NOT NULL' INTO @count;
    RAISE NOTICE '  → % batches linked to licenses', @count;
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✗ batches.license_id column MISSING';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== NEXT STEPS ===';
  RAISE NOTICE '';
  RAISE NOTICE 'If any items above show ✗ MISSING:';
  RAISE NOTICE '1. Open Supabase SQL Editor';
  RAISE NOTICE '2. Copy contents of migration file';
  RAISE NOTICE '3. Paste and execute';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration files location:';
  RAISE NOTICE '  supabase/migrations/20251108000000_create_export_license_system.sql';
  RAISE NOTICE '  supabase/migrations/20251108100000_seed_license_sample_data.sql';
  RAISE NOTICE '';
END $$;

-- Show sample license summary if data exists
SELECT
  license_number,
  status,
  issue_date,
  expiry_date,
  ROUND(authorized_quantity_oz::numeric, 2) as authorized_oz,
  ROUND(used_quantity_oz::numeric, 2) as used_oz,
  ROUND(remaining_qty_oz::numeric, 2) as remaining_oz,
  ROUND(remaining_percentage::numeric, 1) as remaining_pct,
  days_to_expiry,
  CASE
    WHEN status = 'EXPIRED' THEN '🔴 RED'
    WHEN days_to_expiry < 10 OR remaining_percentage < 10 THEN '🔴 RED'
    WHEN days_to_expiry < 30 OR remaining_percentage < 25 THEN '🟡 YELLOW'
    WHEN status = 'ACTIVE' THEN '🟢 GREEN'
    ELSE '⚫ GRAY'
  END as traffic_light
FROM licenses
WHERE license_number LIKE 'LIC-2024-%'
ORDER BY created_at
LIMIT 20;
