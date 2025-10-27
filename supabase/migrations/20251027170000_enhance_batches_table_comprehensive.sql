/*
  # Enhance Batches Table - Complete Schema Update

  1. Purpose
    - Add missing columns for complete batch tracking
    - Support metal types, transport companies, refineries
    - Enable document attachments
    - Ensure all form fields have corresponding database columns

  2. New Columns Added
    - metal_type: Type of precious metal (gold, silver, zinc, diamond, other)
    - mine_to_airport_transport_id: First leg transport company
    - airport_to_refinery_transport_id: Second leg transport company
    - destination_refinery_id: Target refinery for processing
    - documents: JSONB array of uploaded documents
    - updated_by: User who last updated the record

  3. Safety
    - Uses IF NOT EXISTS for all ALTER TABLE operations
    - No data loss - only additions
    - Backward compatible
*/

-- Add metal_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'metal_type'
  ) THEN
    ALTER TABLE batches ADD COLUMN metal_type text DEFAULT 'gold' CHECK (metal_type IN ('gold', 'silver', 'zinc', 'diamond', 'other'));
    RAISE NOTICE 'Added metal_type column to batches table';
  END IF;
END $$;

-- Add mine_to_airport_transport_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'mine_to_airport_transport_id'
  ) THEN
    ALTER TABLE batches ADD COLUMN mine_to_airport_transport_id uuid REFERENCES transport_companies(id);
    RAISE NOTICE 'Added mine_to_airport_transport_id column to batches table';
  END IF;
END $$;

-- Add airport_to_refinery_transport_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'airport_to_refinery_transport_id'
  ) THEN
    ALTER TABLE batches ADD COLUMN airport_to_refinery_transport_id uuid REFERENCES transport_companies(id);
    RAISE NOTICE 'Added airport_to_refinery_transport_id column to batches table';
  END IF;
END $$;

-- Add destination_refinery_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'destination_refinery_id'
  ) THEN
    ALTER TABLE batches ADD COLUMN destination_refinery_id uuid REFERENCES refineries(id);
    RAISE NOTICE 'Added destination_refinery_id column to batches table';
  END IF;
END $$;

-- Add documents column (JSONB for storing document metadata)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'documents'
  ) THEN
    ALTER TABLE batches ADD COLUMN documents jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added documents column to batches table';
  END IF;
END $$;

-- Add updated_by column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE batches ADD COLUMN updated_by uuid REFERENCES user_profiles(id);
    RAISE NOTICE 'Added updated_by column to batches table';
  END IF;
END $$;

-- Create indexes for foreign keys (performance)
CREATE INDEX IF NOT EXISTS idx_batches_mine_to_airport_transport
  ON batches(mine_to_airport_transport_id);

CREATE INDEX IF NOT EXISTS idx_batches_airport_to_refinery_transport
  ON batches(airport_to_refinery_transport_id);

CREATE INDEX IF NOT EXISTS idx_batches_destination_refinery
  ON batches(destination_refinery_id);

CREATE INDEX IF NOT EXISTS idx_batches_metal_type
  ON batches(metal_type);

-- Create a view for enhanced batch details with all relationships
CREATE OR REPLACE VIEW batch_details_enhanced AS
SELECT
  b.id,
  b.batch_number,
  b.status,
  b.origin_site_id,
  b.current_site_id,
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

  -- Origin site details
  os.name as origin_site_name,
  os.location as origin_site_location,
  os.country as origin_site_country,

  -- Current site details
  cs.name as current_site_name,
  cs.location as current_site_location,

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
  r.location as refinery_location,
  r.country as refinery_country,
  r.contact_person as refinery_contact,
  r.phone as refinery_phone,

  -- Creator details
  up_creator.full_name as created_by_name,
  up_creator.email as created_by_email,

  -- Updater details
  up_updater.full_name as updated_by_name,
  up_updater.email as updated_by_email

FROM batches b
LEFT JOIN sites os ON b.origin_site_id = os.id
LEFT JOIN sites cs ON b.current_site_id = cs.id
LEFT JOIN transport_companies mt ON b.mine_to_airport_transport_id = mt.id
LEFT JOIN transport_companies at ON b.airport_to_refinery_transport_id = at.id
LEFT JOIN refineries r ON b.destination_refinery_id = r.id
LEFT JOIN user_profiles up_creator ON b.created_by = up_creator.id
LEFT JOIN user_profiles up_updater ON b.updated_by = up_updater.id;

-- Grant access to the view
GRANT SELECT ON batch_details_enhanced TO authenticated;

RAISE NOTICE 'Batches table enhanced successfully with all required columns';
