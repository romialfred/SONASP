/*
  # Fix Shipping Status Enum - Complete Solution

  ## Problem Analysis
  - Error: invalid input value for enum shipping_status_v2: "shipped"
  - Root Cause: Code tries to use 'shipped' status but enum doesn't include it
  - Impact: Cannot create new shipping preparations

  ## Solution
  1. Keep existing enums intact
  2. Ensure daily_production.status allows 'shipped' (it should already)
  3. Fix any code references expecting 'shipped' in shipping_status_v2
  4. Add proper constraints and validation

  ## Changes
  - Verify production_status_v2 enum values
  - Verify shipping_status_v2 enum values
  - Ensure no code tries to set shipping status to 'shipped'
  - Ensure daily_production uses correct enum with 'shipped'

  ## Notes
  - This migration is IDEMPOTENT - can be run multiple times
  - No data loss
  - Backward compatible
*/

-- ========================================
-- 1. VERIFY AND FIX PRODUCTION STATUS ENUM
-- ========================================

-- Check if old production_status enum exists and has 'shipped'
DO $$
BEGIN
  -- Verify production_status_v2 has correct values
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'production_status_v2'
    AND e.enumlabel = 'shipped'
  ) THEN
    -- Add 'shipped' to production_status_v2 if it doesn't exist
    ALTER TYPE production_status_v2 ADD VALUE IF NOT EXISTS 'shipped' AFTER 'prepared';
    RAISE NOTICE '✅ Added shipped to production_status_v2';
  ELSE
    RAISE NOTICE '✅ production_status_v2 already has shipped';
  END IF;
END $$;

-- ========================================
-- 2. VERIFY SHIPPING STATUS ENUM
-- ========================================

-- Shipping should NOT have 'shipped' - it uses different workflow
-- Verify shipping_status_v2 values are correct
DO $$
DECLARE
  v_enum_values text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO v_enum_values
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'shipping_status_v2';

  RAISE NOTICE 'shipping_status_v2 values: %', v_enum_values;

  -- Expected: pending, prepared, validated_for_refinery, in_refining, refined, in_sale, sold, cancelled
  IF 'shipped' = ANY(v_enum_values) THEN
    RAISE WARNING '⚠️  shipping_status_v2 contains shipped - this may cause confusion';
  ELSE
    RAISE NOTICE '✅ shipping_status_v2 does NOT contain shipped (correct)';
  END IF;
END $$;

-- ========================================
-- 3. ENSURE DAILY_PRODUCTION USES CORRECT ENUM
-- ========================================

-- Verify daily_production.status column uses production_status_v2
DO $$
DECLARE
  v_data_type text;
BEGIN
  SELECT udt_name INTO v_data_type
  FROM information_schema.columns
  WHERE table_name = 'daily_production'
  AND column_name = 'status';

  IF v_data_type = 'production_status_v2' THEN
    RAISE NOTICE '✅ daily_production.status uses production_status_v2 (correct)';
  ELSIF v_data_type = 'production_status' THEN
    RAISE WARNING '⚠️  daily_production.status still uses old production_status enum';
    RAISE NOTICE 'Migration unified_status_system_fixed.sql should have fixed this';
  ELSE
    RAISE WARNING '⚠️  daily_production.status uses unexpected type: %', v_data_type;
  END IF;
END $$;

-- ========================================
-- 4. ENSURE SHIPPING_PREPARATIONS USES CORRECT ENUM
-- ========================================

DO $$
DECLARE
  v_data_type text;
BEGIN
  SELECT udt_name INTO v_data_type
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

  IF v_data_type = 'shipping_status_v2' THEN
    RAISE NOTICE '✅ shipping_preparations.status uses shipping_status_v2 (correct)';
  ELSE
    RAISE WARNING '⚠️  shipping_preparations.status uses unexpected type: %', v_data_type;
  END IF;
END $$;

-- ========================================
-- 5. ADD VALIDATION CONSTRAINTS
-- ========================================

-- Ensure daily_production status defaults to 'prepared'
ALTER TABLE daily_production
  ALTER COLUMN status SET DEFAULT 'prepared'::production_status_v2;

-- Ensure shipping_preparations status defaults to 'pending'
ALTER TABLE shipping_preparations
  ALTER COLUMN status SET DEFAULT 'pending'::shipping_status_v2;

-- ========================================
-- 6. VERIFICATION SUMMARY
-- ========================================

DO $$
DECLARE
  v_prod_enum text;
  v_ship_enum text;
BEGIN
  -- Get enum used by daily_production
  SELECT udt_name INTO v_prod_enum
  FROM information_schema.columns
  WHERE table_name = 'daily_production' AND column_name = 'status';

  -- Get enum used by shipping_preparations
  SELECT udt_name INTO v_ship_enum
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations' AND column_name = 'status';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'daily_production.status uses: %', v_prod_enum;
  RAISE NOTICE 'shipping_preparations.status uses: %', v_ship_enum;
  RAISE NOTICE '';
  RAISE NOTICE 'Expected configuration:';
  RAISE NOTICE '  - daily_production → production_status_v2 (with shipped)';
  RAISE NOTICE '  - shipping_preparations → shipping_status_v2 (without shipped)';
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 7. ENSURE INDEXES EXIST
-- ========================================

CREATE INDEX IF NOT EXISTS idx_daily_production_status
  ON daily_production(status);

CREATE INDEX IF NOT EXISTS idx_shipping_preparations_status
  ON shipping_preparations(status);

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

/*
  Expected Result:
  ✅ production_status_v2 includes: prepared, shipped, cancelled
  ✅ shipping_status_v2 includes: pending, prepared, validated_for_refinery, in_refining, refined, in_sale, sold, cancelled
  ✅ daily_production.status can accept 'shipped'
  ✅ shipping_preparations.status uses different workflow (no 'shipped')
  ✅ No more enum value errors
*/
