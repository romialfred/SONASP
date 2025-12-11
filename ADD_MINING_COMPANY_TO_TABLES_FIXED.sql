/*
  # Add mining_company_id to freight_shipments and gold_inventory

  1. Purpose
    - Add mining_company_id to freight_shipments table
    - Add mining_company_id to gold_inventory table
    - Migrate existing data based on daily_production records
    - Update triggers to maintain mining_company_id automatically

  2. Changes
    - Add mining_company_id column to freight_shipments
    - Add mining_company_id column to gold_inventory
    - Backfill data from daily_production
    - Create/update triggers

  3. Security
    - Foreign key constraints for data integrity
*/

-- =====================================================
-- 1. ADD mining_company_id TO freight_shipments
-- =====================================================

-- Add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE freight_shipments
    ADD COLUMN mining_company_id UUID REFERENCES mining_companies(id);

    RAISE NOTICE '✅ Added mining_company_id to freight_shipments';
  ELSE
    RAISE NOTICE '⚠️  mining_company_id already exists in freight_shipments';
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_freight_shipments_mining_company
  ON freight_shipments(mining_company_id);

-- =====================================================
-- 2. MIGRATE DATA FOR freight_shipments
-- =====================================================

-- Update freight_shipments with mining_company_id from linked daily_production
DO $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  -- Get mining_company_id from the first production in each shipment
  WITH shipment_mining_companies AS (
    SELECT DISTINCT ON (fsp.freight_shipment_id)
      fsp.freight_shipment_id,
      dp.mining_company_id
    FROM freight_shipment_productions fsp
    INNER JOIN daily_production dp ON dp.id = fsp.production_id
    WHERE dp.mining_company_id IS NOT NULL
    ORDER BY fsp.freight_shipment_id, fsp.added_at ASC
  )
  UPDATE freight_shipments fs
  SET mining_company_id = smc.mining_company_id
  FROM shipment_mining_companies smc
  WHERE fs.id = smc.freight_shipment_id
    AND fs.mining_company_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE '✅ Updated % freight_shipments with mining_company_id', v_updated;
END $$;

-- =====================================================
-- 3. ADD mining_company_id TO gold_inventory
-- =====================================================

-- Check if gold_inventory table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'gold_inventory'
  ) THEN
    -- Add column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'gold_inventory'
      AND column_name = 'mining_company_id'
    ) THEN
      ALTER TABLE gold_inventory
      ADD COLUMN mining_company_id UUID REFERENCES mining_companies(id);

      RAISE NOTICE '✅ Added mining_company_id to gold_inventory';
    ELSE
      RAISE NOTICE '⚠️  mining_company_id already exists in gold_inventory';
    END IF;

    -- Create index
    CREATE INDEX IF NOT EXISTS idx_gold_inventory_mining_company
      ON gold_inventory(mining_company_id);

    -- Update gold_inventory with mining_company_id from freight_shipments
    UPDATE gold_inventory gi
    SET mining_company_id = fs.mining_company_id
    FROM freight_shipments fs
    WHERE gi.freight_shipment_id = fs.id
      AND gi.mining_company_id IS NULL
      AND fs.mining_company_id IS NOT NULL;

    RAISE NOTICE '✅ Updated gold_inventory with mining_company_id from freight_shipments';
  ELSE
    RAISE NOTICE 'ℹ️  Table gold_inventory does not exist yet - skipping';
  END IF;
END $$;

-- =====================================================
-- 4. CREATE TRIGGER FOR AUTOMATIC mining_company_id
-- =====================================================

-- Function to auto-set mining_company_id on freight_shipments
CREATE OR REPLACE FUNCTION set_freight_shipment_mining_company()
RETURNS TRIGGER AS $func$
DECLARE
  v_mining_company_id UUID;
BEGIN
  -- If mining_company_id not set, try to get it from the first production
  IF NEW.mining_company_id IS NULL THEN
    SELECT dp.mining_company_id
    INTO v_mining_company_id
    FROM freight_shipment_productions fsp
    INNER JOIN daily_production dp ON dp.id = fsp.production_id
    WHERE fsp.freight_shipment_id = NEW.id
    AND dp.mining_company_id IS NOT NULL
    LIMIT 1;

    IF v_mining_company_id IS NOT NULL THEN
      NEW.mining_company_id := v_mining_company_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Trigger on freight_shipments insert/update
DROP TRIGGER IF EXISTS trigger_set_freight_shipment_mining_company ON freight_shipments;
CREATE TRIGGER trigger_set_freight_shipment_mining_company
  BEFORE INSERT OR UPDATE ON freight_shipments
  FOR EACH ROW
  EXECUTE FUNCTION set_freight_shipment_mining_company();

-- =====================================================
-- 5. FUNCTION TO SET mining_company_id WHEN ADDING PRODUCTION
-- =====================================================

-- Function to update freight_shipment mining_company_id when production is added
CREATE OR REPLACE FUNCTION update_shipment_mining_company_from_production()
RETURNS TRIGGER AS $func$
DECLARE
  v_mining_company_id UUID;
  v_current_mining_company UUID;
BEGIN
  -- Get mining_company_id from the production being added
  SELECT dp.mining_company_id
  INTO v_mining_company_id
  FROM daily_production dp
  WHERE dp.id = NEW.production_id;

  -- Get current mining_company_id from freight_shipment
  SELECT mining_company_id
  INTO v_current_mining_company
  FROM freight_shipments
  WHERE id = NEW.freight_shipment_id;

  -- If shipment doesn't have mining_company_id yet, set it
  IF v_current_mining_company IS NULL AND v_mining_company_id IS NOT NULL THEN
    UPDATE freight_shipments
    SET mining_company_id = v_mining_company_id,
        updated_at = now()
    WHERE id = NEW.freight_shipment_id;
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Trigger on freight_shipment_productions
DROP TRIGGER IF EXISTS trigger_update_shipment_mining_company ON freight_shipment_productions;
CREATE TRIGGER trigger_update_shipment_mining_company
  AFTER INSERT ON freight_shipment_productions
  FOR EACH ROW
  EXECUTE FUNCTION update_shipment_mining_company_from_production();

-- =====================================================
-- 6. FUNCTION TO SET mining_company_id ON gold_inventory
-- =====================================================

-- Function to auto-set mining_company_id on gold_inventory
CREATE OR REPLACE FUNCTION set_gold_inventory_mining_company()
RETURNS TRIGGER AS $func$
DECLARE
  v_mining_company_id UUID;
BEGIN
  -- If mining_company_id not set, get it from freight_shipment
  IF NEW.mining_company_id IS NULL AND NEW.freight_shipment_id IS NOT NULL THEN
    SELECT mining_company_id
    INTO v_mining_company_id
    FROM freight_shipments
    WHERE id = NEW.freight_shipment_id;

    IF v_mining_company_id IS NOT NULL THEN
      NEW.mining_company_id := v_mining_company_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Create trigger only if gold_inventory exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'gold_inventory'
  ) THEN
    -- Trigger on gold_inventory
    DROP TRIGGER IF EXISTS trigger_set_gold_inventory_mining_company ON gold_inventory;
    CREATE TRIGGER trigger_set_gold_inventory_mining_company
      BEFORE INSERT OR UPDATE ON gold_inventory
      FOR EACH ROW
      EXECUTE FUNCTION set_gold_inventory_mining_company();

    RAISE NOTICE '✅ Created trigger for gold_inventory';
  ELSE
    RAISE NOTICE 'ℹ️  Table gold_inventory does not exist yet - trigger will be created when table is created';
  END IF;
END $$;

-- =====================================================
-- 7. VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_freight_total INTEGER;
  v_freight_with_mc INTEGER;
  v_inventory_total INTEGER := 0;
  v_inventory_with_mc INTEGER := 0;
BEGIN
  -- Check freight_shipments
  SELECT COUNT(*) INTO v_freight_total FROM freight_shipments;
  SELECT COUNT(*) INTO v_freight_with_mc FROM freight_shipments WHERE mining_company_id IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION DES DONNÉES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📦 FREIGHT_SHIPMENTS:';
  RAISE NOTICE '  Total: %', v_freight_total;
  RAISE NOTICE '  Avec mining_company_id: %', v_freight_with_mc;
  RAISE NOTICE '  Sans mining_company_id: %', (v_freight_total - v_freight_with_mc);

  -- Check gold_inventory if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'gold_inventory'
  ) THEN
    SELECT COUNT(*) INTO v_inventory_total FROM gold_inventory;
    SELECT COUNT(*) INTO v_inventory_with_mc FROM gold_inventory WHERE mining_company_id IS NOT NULL;

    RAISE NOTICE '';
    RAISE NOTICE '💰 GOLD_INVENTORY:';
    RAISE NOTICE '  Total: %', v_inventory_total;
    RAISE NOTICE '  Avec mining_company_id: %', v_inventory_with_mc;
    RAISE NOTICE '  Sans mining_company_id: %', (v_inventory_total - v_inventory_with_mc);
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE 'ℹ️  Table gold_inventory n''existe pas encore';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION TERMINÉE!';
  RAISE NOTICE '========================================';
END $$;
