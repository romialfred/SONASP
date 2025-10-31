/*
  # Verify and Fix Batches Table Schema

  1. Purpose
    - Ensure all required columns exist in batches table
    - Fix any NOT NULL constraints that might be too restrictive
    - Add missing columns if needed

  2. Columns Verified
    - batch_number (required)
    - shipping_date (required)
    - weight_grams (required)
    - weight_ounces (auto-calculated)
    - metal_type (required)
    - mining_company_id (required)
    - mine_to_airport_transport_id (required)
    - airport_to_refinery_transport_id (required)
    - destination_refinery_id (required)
    - documents (optional, default [])
    - comments (optional)
    - status (required, default pending_factory_approval)
    - created_by (required)
*/

-- Ensure mining_company_id column exists and is properly configured
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE batches ADD COLUMN mining_company_id uuid REFERENCES mining_companies(id);
    RAISE NOTICE 'Added mining_company_id column to batches table';
  END IF;
END $$;

-- Ensure mine_to_airport_transport_id exists
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

-- Ensure airport_to_refinery_transport_id exists
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

-- Ensure destination_refinery_id exists
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

-- Ensure metal_type exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'metal_type'
  ) THEN
    ALTER TABLE batches ADD COLUMN metal_type text DEFAULT 'gold'
      CHECK (metal_type IN ('gold', 'silver', 'zinc', 'diamond', 'other'));
    RAISE NOTICE 'Added metal_type column to batches table';
  END IF;
END $$;

-- Ensure documents column exists
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

-- Ensure comments column exists and is nullable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'comments'
  ) THEN
    ALTER TABLE batches ADD COLUMN comments text;
    RAISE NOTICE 'Added comments column to batches table';
  END IF;
END $$;

-- Ensure shipping_date exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'shipping_date'
  ) THEN
    ALTER TABLE batches ADD COLUMN shipping_date date NOT NULL DEFAULT CURRENT_DATE;
    RAISE NOTICE 'Added shipping_date column to batches table';
  END IF;
END $$;

-- Remove NOT NULL constraint from comments if it exists
ALTER TABLE batches ALTER COLUMN comments DROP NOT NULL;

-- Remove NOT NULL from documents if needed
ALTER TABLE batches ALTER COLUMN documents DROP NOT NULL;

-- Make sure default status is set correctly
ALTER TABLE batches ALTER COLUMN status SET DEFAULT 'pending_factory_approval';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_batches_mining_company
  ON batches(mining_company_id);

CREATE INDEX IF NOT EXISTS idx_batches_status
  ON batches(status);

CREATE INDEX IF NOT EXISTS idx_batches_shipping_date
  ON batches(shipping_date DESC);

CREATE INDEX IF NOT EXISTS idx_batches_created_by
  ON batches(created_by);

-- Add helpful comment
COMMENT ON TABLE batches IS 'Main batches table storing all precious metal shipments from mines through refineries to sales';
