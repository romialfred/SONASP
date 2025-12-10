/*
  # Add Refining Process Statuses

  1. Changes
    - Add new statuses to freight_shipment_status enum:
      - 'processing' - En cours de raffinage
      - 'processed' - Raffiné, en attente de mise en stock
      - 'in_stock' - Mis en stock/inventaire

  2. Security
    - No changes to RLS policies needed
*/

-- Add new statuses to the enum
DO $$ BEGIN
  -- Add 'processing' status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'processing'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
  ) THEN
    ALTER TYPE freight_shipment_status ADD VALUE 'processing';
  END IF;

  -- Add 'processed' status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'processed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
  ) THEN
    ALTER TYPE freight_shipment_status ADD VALUE 'processed';
  END IF;

  -- Add 'in_stock' status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'in_stock'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
  ) THEN
    ALTER TYPE freight_shipment_status ADD VALUE 'in_stock';
  END IF;
END $$;

-- Add new workflow tracking columns if they don't exist
DO $$ BEGIN
  -- Processing started tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processing_started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'processing_started_by'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processing_started_by UUID REFERENCES auth.users(id);
  END IF;

  -- Processing completed tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'processed_at'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'processed_by'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processed_by UUID REFERENCES auth.users(id);
  END IF;

  -- Stock transfer tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'stocked_at'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN stocked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'stocked_by'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN stocked_by UUID REFERENCES auth.users(id);
  END IF;

  -- Refining notes for each stage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'refining_notes'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN refining_notes TEXT;
  END IF;
END $$;

-- Update comments
COMMENT ON COLUMN freight_shipments.status IS 'Workflow status: pending, approved, shipped_to_refinery, received_at_refinery, processing, processed, in_stock';
