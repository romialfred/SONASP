/*
  # Add Silver Tracking to Daily Production

  1. New Columns
    - `estimated_gold_pct` (numeric) - Estimated Gold percentage (renamed from estimated_fineness_pct)
    - `estimated_silver_pct` (numeric) - Estimated Silver percentage
    - `silver_content_grams` (numeric) - Calculated Silver content in grams (Bullion × Silver %)

  2. Changes
    - Keep `estimated_fineness_pct` for backward compatibility
    - Add new silver tracking columns
    - Update calculations to include silver content

  3. Important Notes
    - estimated_gold_pct + estimated_silver_pct should typically <= 100%
    - silver_content_grams is calculated automatically from bullion_grams × estimated_silver_pct / 100
    - These fields allow tracking both gold and silver content in production
    - Backward compatible - existing data still works

  4. Security
    - Existing RLS policies apply to new columns
    - No additional policies needed
*/

-- ========================================
-- 1. ADD NEW COLUMNS TO daily_production
-- ========================================

DO $$
BEGIN
  -- Add estimated_gold_pct (same as fineness but more explicit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'estimated_gold_pct'
  ) THEN
    ALTER TABLE daily_production
    ADD COLUMN estimated_gold_pct NUMERIC(5,2) DEFAULT 0;

    COMMENT ON COLUMN daily_production.estimated_gold_pct IS
    'Estimated Gold percentage in the bullion (0-100%)';

    RAISE NOTICE '✅ Added estimated_gold_pct column';
  ELSE
    RAISE NOTICE '⏭️  estimated_gold_pct column already exists';
  END IF;

  -- Add estimated_silver_pct
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'estimated_silver_pct'
  ) THEN
    ALTER TABLE daily_production
    ADD COLUMN estimated_silver_pct NUMERIC(5,2) DEFAULT 0;

    COMMENT ON COLUMN daily_production.estimated_silver_pct IS
    'Estimated Silver percentage in the bullion (0-100%)';

    RAISE NOTICE '✅ Added estimated_silver_pct column';
  ELSE
    RAISE NOTICE '⏭️  estimated_silver_pct column already exists';
  END IF;

  -- Add silver_content_grams
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'silver_content_grams'
  ) THEN
    ALTER TABLE daily_production
    ADD COLUMN silver_content_grams NUMERIC(12,2) GENERATED ALWAYS AS (
      CASE
        WHEN bullion_grams IS NOT NULL AND estimated_silver_pct IS NOT NULL
        THEN bullion_grams * estimated_silver_pct / 100
        ELSE 0
      END
    ) STORED;

    COMMENT ON COLUMN daily_production.silver_content_grams IS
    'Calculated Silver content in grams (Bullion × Silver %)';

    RAISE NOTICE '✅ Added silver_content_grams column (calculated)';
  ELSE
    RAISE NOTICE '⏭️  silver_content_grams column already exists';
  END IF;
END $$;

-- ========================================
-- 2. MIGRATE EXISTING DATA
-- ========================================

-- Copy estimated_fineness_pct to estimated_gold_pct for existing records
DO $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE daily_production
  SET estimated_gold_pct = estimated_fineness_pct
  WHERE estimated_gold_pct = 0 OR estimated_gold_pct IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RAISE NOTICE '✅ Migrated % existing records (fineness → gold_pct)', updated_count;
END $$;

-- ========================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- ========================================

-- Index for silver content queries
CREATE INDEX IF NOT EXISTS idx_daily_production_silver
  ON daily_production(estimated_silver_pct)
  WHERE estimated_silver_pct > 0;

CREATE INDEX IF NOT EXISTS idx_daily_production_gold
  ON daily_production(estimated_gold_pct)
  WHERE estimated_gold_pct > 0;

RAISE NOTICE '✅ Added indexes for silver and gold percentages';

-- ========================================
-- 4. ADD CONSTRAINTS (OPTIONAL BUT RECOMMENDED)
-- ========================================

DO $$
BEGIN
  -- Ensure gold percentage is between 0 and 100
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_estimated_gold_pct_range'
  ) THEN
    ALTER TABLE daily_production
    ADD CONSTRAINT check_estimated_gold_pct_range
    CHECK (estimated_gold_pct >= 0 AND estimated_gold_pct <= 100);

    RAISE NOTICE '✅ Added check constraint for gold percentage range';
  END IF;

  -- Ensure silver percentage is between 0 and 100
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_estimated_silver_pct_range'
  ) THEN
    ALTER TABLE daily_production
    ADD CONSTRAINT check_estimated_silver_pct_range
    CHECK (estimated_silver_pct >= 0 AND estimated_silver_pct <= 100);

    RAISE NOTICE '✅ Added check constraint for silver percentage range';
  END IF;
END $$;

-- ========================================
-- 5. CREATE VIEW FOR EASIER QUERYING
-- ========================================

-- Drop existing view if exists
DROP VIEW IF EXISTS daily_production_with_metals;

-- Create view with both gold and silver calculations
CREATE VIEW daily_production_with_metals AS
SELECT
  dp.*,
  -- Gold calculations
  (dp.bullion_grams * dp.estimated_gold_pct / 100) AS gold_content_grams,
  ((dp.bullion_grams * dp.estimated_gold_pct / 100) / 31.1035) AS gold_content_oz,
  -- Silver calculations (already have silver_content_grams as stored column)
  (dp.silver_content_grams / 31.1035) AS silver_content_oz,
  -- Combined metal content
  (dp.bullion_grams * dp.estimated_gold_pct / 100) + dp.silver_content_grams AS total_metal_content_grams,
  -- Percentages
  dp.estimated_gold_pct + dp.estimated_silver_pct AS total_metal_pct
FROM daily_production dp;

COMMENT ON VIEW daily_production_with_metals IS
'View with calculated gold and silver content for easier reporting';

RAISE NOTICE '✅ Created daily_production_with_metals view';

-- ========================================
-- 6. VERIFICATION AND DIAGNOSTICS
-- ========================================

DO $$
DECLARE
  total_records integer;
  records_with_silver integer;
  records_with_gold integer;
  avg_gold_pct numeric;
  avg_silver_pct numeric;
BEGIN
  -- Count records
  SELECT COUNT(*) INTO total_records FROM daily_production;

  SELECT COUNT(*) INTO records_with_silver
  FROM daily_production
  WHERE estimated_silver_pct > 0;

  SELECT COUNT(*) INTO records_with_gold
  FROM daily_production
  WHERE estimated_gold_pct > 0;

  -- Calculate averages
  SELECT AVG(estimated_gold_pct) INTO avg_gold_pct
  FROM daily_production
  WHERE estimated_gold_pct > 0;

  SELECT AVG(estimated_silver_pct) INTO avg_silver_pct
  FROM daily_production
  WHERE estimated_silver_pct > 0;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'SILVER TRACKING MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 DATABASE STATUS:';
  RAISE NOTICE '   Total production records: %', total_records;
  RAISE NOTICE '   Records with gold data: %', records_with_gold;
  RAISE NOTICE '   Records with silver data: %', records_with_silver;
  RAISE NOTICE '';

  IF avg_gold_pct IS NOT NULL THEN
    RAISE NOTICE '📈 AVERAGES:';
    RAISE NOTICE '   Average gold %%: %.2f%%', avg_gold_pct;
    IF avg_silver_pct IS NOT NULL AND avg_silver_pct > 0 THEN
      RAISE NOTICE '   Average silver %%: %.2f%%', avg_silver_pct;
    ELSE
      RAISE NOTICE '   Average silver %%: 0.00%% (no data yet)';
    END IF;
    RAISE NOTICE '';
  END IF;

  RAISE NOTICE '✅✅✅ MIGRATION SUCCESSFUL!';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 NEXT STEPS:';
  RAISE NOTICE '   1. Update frontend forms to include silver percentage';
  RAISE NOTICE '   2. Update production tables to display silver content';
  RAISE NOTICE '   3. Update shipping preparation to include silver data';
  RAISE NOTICE '   4. Test calculations with new productions';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 7. EXAMPLE QUERIES
-- ========================================

/*
-- Query productions with metal breakdown
SELECT
  production_date,
  bullion_grams,
  estimated_gold_pct,
  estimated_silver_pct,
  gold_content_grams,
  silver_content_grams,
  total_metal_content_grams,
  total_metal_pct
FROM daily_production_with_metals
ORDER BY production_date DESC
LIMIT 10;

-- Get total silver content for a date range
SELECT
  SUM(silver_content_grams) as total_silver_grams,
  SUM(silver_content_oz) as total_silver_oz,
  AVG(estimated_silver_pct) as avg_silver_pct
FROM daily_production_with_metals
WHERE production_date BETWEEN '2025-01-01' AND '2025-12-31';

-- Get productions with high silver content
SELECT
  production_date,
  bar_reference,
  bullion_grams,
  silver_content_grams,
  estimated_silver_pct
FROM daily_production_with_metals
WHERE estimated_silver_pct > 5
ORDER BY silver_content_grams DESC;
*/

-- ========================================
-- 8. GRANT PERMISSIONS
-- ========================================

-- Grant access to the new view
GRANT SELECT ON daily_production_with_metals TO authenticated;

RAISE NOTICE '✅ Granted permissions on daily_production_with_metals view';
