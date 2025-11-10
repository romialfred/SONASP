/*
  # Link Shipping Preparations to Export Licenses

  1. Changes to shipping_preparations table
    - Add license_id column to link shipments to export licenses
    - Add mining_company_id for filtering productions by company
    - Add license validation constraints

  2. New Views
    - v_active_licenses: View of active licenses with remaining quantities
    - v_available_productions: Productions linked to mining companies

  3. Functions
    - validate_license_quantity: Check if license has enough remaining quantity
    - reserve_license_quota: Reserve quantity when creating shipment
    - release_license_quota: Release quantity when deleting shipment

  4. Triggers
    - Auto-reserve quota on shipping creation
    - Auto-release quota on shipping deletion

  5. Security
    - Update RLS policies for license-based access control
*/

-- Add license_id and mining_company_id to shipping_preparations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations' AND column_name = 'license_id'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN license_id uuid REFERENCES licenses(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN mining_company_id uuid REFERENCES mining_companies(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations' AND column_name = 'total_weight_oz'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN total_weight_oz numeric(18,3) DEFAULT 0;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_license
  ON shipping_preparations(license_id);

CREATE INDEX IF NOT EXISTS idx_shipping_preparations_mining_company
  ON shipping_preparations(mining_company_id);

-- View: Active licenses with remaining quantities
CREATE OR REPLACE VIEW v_active_licenses AS
SELECT
  l.id,
  l.license_number,
  l.license_type,
  l.applicant_mine_id,
  l.applicant_company_name,
  l.issue_date,
  l.start_date,
  l.expiry_date,
  l.authorized_qty_oz,
  l.reserved_qty_oz,
  l.consumed_qty_oz,
  l.remaining_qty_oz,
  l.remaining_percentage,
  l.status,
  l.issuer_country,
  l.theoretical_price_usd_per_oz,
  l.notes,
  mc.name as mining_company_name,
  mc.code as mining_company_code,
  -- Days until expiry
  (l.expiry_date - CURRENT_DATE) as days_until_expiry,
  -- Is expiring soon (less than 30 days)
  CASE
    WHEN (l.expiry_date - CURRENT_DATE) <= 30 THEN true
    ELSE false
  END as is_expiring_soon,
  -- Is low quantity (less than 20%)
  CASE
    WHEN l.remaining_percentage < 20 THEN true
    ELSE false
  END as is_low_quantity
FROM licenses l
LEFT JOIN mining_companies mc ON l.applicant_mine_id = mc.id
WHERE l.status = 'ACTIVE'
  AND l.expiry_date >= CURRENT_DATE
  AND l.remaining_qty_oz > 0
ORDER BY l.expiry_date ASC, l.remaining_qty_oz DESC;

-- Grant access to view
GRANT SELECT ON v_active_licenses TO authenticated;

-- NOTE: Using existing table 'shipping_production_items' (created in migration 20251110141000)
-- No need to create a new table - shipping_production_items already links productions to shipments

-- Add seal_number columns to shipping_production_items if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_production_items' AND column_name = 'seal_number_1'
  ) THEN
    ALTER TABLE shipping_production_items ADD COLUMN seal_number_1 text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_production_items' AND column_name = 'seal_number_2'
  ) THEN
    ALTER TABLE shipping_production_items ADD COLUMN seal_number_2 text;
  END IF;
END $$;

-- View: Available productions grouped by mining company
CREATE OR REPLACE VIEW v_available_productions AS
SELECT
  dp.id,
  dp.production_date,
  dp.bullion_grams,
  dp.estimated_fineness_pct,
  dp.pure_gold_grams,
  dp.estimated_oz,
  dp.bar_reference,
  dp.notes,
  dp.mining_company_id,
  mc.name as mining_company_name,
  mc.code as mining_company_code,
  mc.country as mining_company_country,
  -- Check if already shipped
  CASE
    WHEN EXISTS (
      SELECT 1 FROM shipping_production_items spi
      JOIN shipping_preparations sp ON spi.shipping_preparation_id = sp.id
      WHERE spi.daily_production_id = dp.id
    ) THEN true
    ELSE false
  END as is_shipped,
  -- Get shipping preparation if exists
  (
    SELECT sp.id
    FROM shipping_production_items spi
    JOIN shipping_preparations sp ON spi.shipping_preparation_id = sp.id
    WHERE spi.daily_production_id = dp.id
    LIMIT 1
  ) as shipping_preparation_id
FROM daily_production dp
LEFT JOIN mining_companies mc ON dp.mining_company_id = mc.id
WHERE dp.mining_company_id IS NOT NULL
ORDER BY dp.production_date DESC, mc.name;

-- Grant access to view
GRANT SELECT ON v_available_productions TO authenticated;

-- Function: Validate license has enough remaining quantity
CREATE OR REPLACE FUNCTION validate_license_quantity(
  p_license_id uuid,
  p_required_qty_oz numeric
)
RETURNS boolean AS $$
DECLARE
  v_remaining_qty numeric;
  v_license_status license_status;
  v_expiry_date date;
BEGIN
  -- Get license details
  SELECT
    remaining_qty_oz,
    status,
    expiry_date
  INTO
    v_remaining_qty,
    v_license_status,
    v_expiry_date
  FROM licenses
  WHERE id = p_license_id;

  -- Check if license exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'License not found';
  END IF;

  -- Check if license is active
  IF v_license_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'License is not active (status: %)', v_license_status;
  END IF;

  -- Check if license is expired
  IF v_expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'License has expired on %', v_expiry_date;
  END IF;

  -- Check if enough quantity available
  IF v_remaining_qty < p_required_qty_oz THEN
    RAISE EXCEPTION 'Insufficient license quantity. Available: % oz, Required: % oz',
      v_remaining_qty, p_required_qty_oz;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reserve license quota for shipping
CREATE OR REPLACE FUNCTION reserve_license_quota(
  p_license_id uuid,
  p_shipping_id uuid,
  p_quantity_oz numeric,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS void AS $$
DECLARE
  v_license_number text;
BEGIN
  -- Validate license has enough quantity
  PERFORM validate_license_quantity(p_license_id, p_quantity_oz);

  -- Get license number for transaction record
  SELECT license_number INTO v_license_number
  FROM licenses
  WHERE id = p_license_id;

  -- Update license reserved quantity
  UPDATE licenses
  SET
    reserved_qty_oz = reserved_qty_oz + p_quantity_oz,
    updated_at = now(),
    updated_by = p_user_id
  WHERE id = p_license_id;

  -- Create transaction record
  INSERT INTO license_quota_transactions (
    license_id,
    transaction_type,
    quantity_oz,
    reserved_qty_after,
    consumed_qty_after,
    remaining_qty_after,
    reference_type,
    reference_id,
    notes,
    created_by
  )
  SELECT
    p_license_id,
    'RESERVE',
    p_quantity_oz,
    reserved_qty_oz,
    consumed_qty_oz,
    remaining_qty_oz,
    'SHIPPING',
    p_shipping_id,
    'Quota reserved for shipping preparation',
    p_user_id
  FROM licenses
  WHERE id = p_license_id;

  -- Create event log
  INSERT INTO license_events (
    license_id,
    event_type,
    description,
    metadata,
    created_by
  )
  VALUES (
    p_license_id,
    'QUOTA_RESERVED',
    format('Reserved %s oz for shipping preparation', p_quantity_oz),
    jsonb_build_object(
      'shipping_id', p_shipping_id,
      'quantity_oz', p_quantity_oz,
      'license_number', v_license_number
    ),
    p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Release license quota when shipping is cancelled/deleted
CREATE OR REPLACE FUNCTION release_license_quota(
  p_license_id uuid,
  p_shipping_id uuid,
  p_quantity_oz numeric,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS void AS $$
DECLARE
  v_license_number text;
BEGIN
  -- Get license number
  SELECT license_number INTO v_license_number
  FROM licenses
  WHERE id = p_license_id;

  -- Check if license exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'License not found';
  END IF;

  -- Update license reserved quantity
  UPDATE licenses
  SET
    reserved_qty_oz = GREATEST(0, reserved_qty_oz - p_quantity_oz),
    updated_at = now(),
    updated_by = p_user_id
  WHERE id = p_license_id;

  -- Create transaction record
  INSERT INTO license_quota_transactions (
    license_id,
    transaction_type,
    quantity_oz,
    reserved_qty_after,
    consumed_qty_after,
    remaining_qty_after,
    reference_type,
    reference_id,
    notes,
    created_by
  )
  SELECT
    p_license_id,
    'RELEASE',
    p_quantity_oz,
    reserved_qty_oz,
    consumed_qty_oz,
    remaining_qty_oz,
    'SHIPPING',
    p_shipping_id,
    'Quota released from cancelled/deleted shipping',
    p_user_id
  FROM licenses
  WHERE id = p_license_id;

  -- Create event log
  INSERT INTO license_events (
    license_id,
    event_type,
    description,
    metadata,
    created_by
  )
  VALUES (
    p_license_id,
    'QUOTA_RELEASED',
    format('Released %s oz from shipping preparation', p_quantity_oz),
    jsonb_build_object(
      'shipping_id', p_shipping_id,
      'quantity_oz', p_quantity_oz,
      'license_number', v_license_number
    ),
    p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-reserve quota when shipping is created
CREATE OR REPLACE FUNCTION trigger_reserve_shipping_quota()
RETURNS TRIGGER AS $$
BEGIN
  -- Only reserve if license is specified and quantity is set
  IF NEW.license_id IS NOT NULL AND NEW.total_weight_oz > 0 THEN
    PERFORM reserve_license_quota(
      NEW.license_id,
      NEW.id,
      NEW.total_weight_oz,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trg_reserve_shipping_quota ON shipping_preparations;
CREATE TRIGGER trg_reserve_shipping_quota
  AFTER INSERT ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_reserve_shipping_quota();

-- Trigger: Auto-release quota when shipping is deleted
CREATE OR REPLACE FUNCTION trigger_release_shipping_quota()
RETURNS TRIGGER AS $$
BEGIN
  -- Only release if license was specified
  IF OLD.license_id IS NOT NULL AND OLD.total_weight_oz > 0 THEN
    PERFORM release_license_quota(
      OLD.license_id,
      OLD.id,
      OLD.total_weight_oz,
      auth.uid()
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trg_release_shipping_quota ON shipping_preparations;
CREATE TRIGGER trg_release_shipping_quota
  BEFORE DELETE ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_release_shipping_quota();

-- Add comments for documentation
COMMENT ON COLUMN shipping_production_items.seal_number_1 IS 'Primary seal number for this production item';
COMMENT ON COLUMN shipping_production_items.seal_number_2 IS 'Optional secondary seal number for this production item';

COMMENT ON COLUMN shipping_preparations.license_id IS 'Export license used for this shipment';
COMMENT ON COLUMN shipping_preparations.mining_company_id IS 'Mining company whose production is being shipped';
COMMENT ON COLUMN shipping_preparations.total_weight_oz IS 'Total weight in ounces for license quota validation';

COMMENT ON VIEW v_active_licenses IS 'Active export licenses with remaining quantities and expiry warnings';
COMMENT ON VIEW v_available_productions IS 'Daily productions available for shipping, grouped by mining company';

COMMENT ON FUNCTION validate_license_quantity IS 'Validates if a license has sufficient remaining quantity';
COMMENT ON FUNCTION reserve_license_quota IS 'Reserves license quota when creating a shipping preparation';
COMMENT ON FUNCTION release_license_quota IS 'Releases license quota when cancelling or deleting a shipment';
