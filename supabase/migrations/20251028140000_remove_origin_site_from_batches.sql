/*
  # Remove origin_site_id from batches table

  1. Changes
    - Drop dependent views first
    - Remove origin_site_id column from batches table
    - Remove current_site_id column from batches table
    - Recreate views using mining_company instead
    - Origin is now determined by mining_company_id

  2. Rationale
    - The origin site is redundant since it's already defined by the mining company
    - Mining company provides the country information needed for batch numbering
    - Simplifies data model and removes duplicate information
*/

-- Step 1: Drop dependent views
DROP VIEW IF EXISTS v_batch_summary CASCADE;
DROP VIEW IF EXISTS batch_details_enhanced CASCADE;

-- Step 2: Remove the origin_site_id column from batches table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'origin_site_id'
  ) THEN
    ALTER TABLE batches DROP COLUMN origin_site_id;
  END IF;
END $$;

-- Step 3: Remove current_site_id if it exists (was set to origin_site_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'current_site_id'
  ) THEN
    ALTER TABLE batches DROP COLUMN current_site_id;
  END IF;
END $$;

-- Step 4: Ensure mining_company_id exists and is properly constrained
DO $$
BEGIN
  -- Add mining_company_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE batches ADD COLUMN mining_company_id uuid;

    -- Add foreign key constraint
    ALTER TABLE batches
    ADD CONSTRAINT batches_mining_company_id_fkey
    FOREIGN KEY (mining_company_id)
    REFERENCES mining_companies(id);
  END IF;
END $$;

-- Step 5: Recreate v_batch_summary view using mining_company instead of origin_site
CREATE OR REPLACE VIEW v_batch_summary AS
SELECT
  b.id,
  b.batch_number,
  b.status,
  b.weight_grams,
  b.weight_ounces,
  b.shipping_date,
  b.created_at,
  mc.name as mining_company_name,
  mc.country as origin_country,
  rr.final_fine_ounces,
  rr.approved_at as refining_approved_at,
  (SELECT COUNT(*) FROM batch_status_history WHERE batch_id = b.id) as status_change_count
FROM batches b
LEFT JOIN mining_companies mc ON b.mining_company_id = mc.id
LEFT JOIN refining_records rr ON b.id = rr.batch_id;

-- Step 6: Recreate batch_details_enhanced view using mining_company
CREATE OR REPLACE VIEW batch_details_enhanced AS
SELECT
  b.id,
  b.batch_number,
  b.status,
  b.mining_company_id,
  b.weight_grams,
  b.weight_ounces,
  b.metal_type,
  b.shipping_date,
  b.comments,
  b.documents,
  b.created_at,
  b.updated_at,
  b.created_by,
  b.updated_by,

  -- Mining company details (replaces origin site)
  mc.name as mining_company_name,
  mc.address as mining_company_location,
  mc.country as origin_country,

  -- Mine to airport transport
  mt.id as mine_transport_id,
  mt.name as mine_transport_name,
  mt.contact_person as mine_transport_contact,
  mt.phone as mine_transport_phone,

  -- Airport to refinery transport
  at.id as airport_transport_id,
  at.name as airport_transport_name,
  at.contact_person as airport_transport_contact,
  at.phone as airport_transport_phone,

  -- Destination refinery
  r.id as refinery_id,
  r.name as refinery_name,
  r.country as refinery_country,
  r.contact_person as refinery_contact,
  r.phone as refinery_phone,

  -- Refining record
  rr.id as refining_record_id,
  rr.pre_melting_weight_grams,
  rr.post_melting_weight_grams,
  rr.fineness_percentage,
  rr.metal_retained_percentage,
  rr.final_fine_grams,
  rr.final_fine_ounces,
  rr.processing_date,
  rr.approved_at as refining_approved_at,
  rr.approved_by as refining_approved_by

FROM batches b
LEFT JOIN mining_companies mc ON b.mining_company_id = mc.id
LEFT JOIN transport_companies mt ON b.mine_to_airport_transport_id = mt.id
LEFT JOIN transport_companies at ON b.airport_to_refinery_transport_id = at.id
LEFT JOIN refineries r ON b.destination_refinery_id = r.id
LEFT JOIN refining_records rr ON b.id = rr.batch_id;

-- Add comments to document the change
COMMENT ON VIEW v_batch_summary IS 'Batch summary view using mining_company as origin instead of origin_site (updated 2025-10-28)';
COMMENT ON VIEW batch_details_enhanced IS 'Enhanced batch details using mining_company as origin instead of origin_site (updated 2025-10-28)';
