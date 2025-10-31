/*
  # Add Airport Receiving Fields to Batches

  ## Overview
  This migration adds fields required for the airport receiving workflow, including:
  - Weight confirmation and variance tracking
  - Receipt date
  - Freight company assignment for airport-to-refinery transport
  - Freight document storage
  - New status: 'validated_for_transport'

  ## Changes to Existing Tables

  ### 1. `batches` table
  New columns added:
  - `received_weight_grams` (numeric) - Actual weight received at airport
  - `received_weight_ounces` (numeric) - Converted ounces
  - `received_date` (date) - Date received at airport
  - `transport_company_id` (uuid) - Reference to transport company for freight
  - `freight_document_url` (text) - URL to uploaded freight document

  ### 2. Status constraint update
  Add new status 'validated_for_transport' to batch status flow

  ## Security
  - No RLS changes needed (inherits existing policies)
  - Transport company foreign key constraint added
*/

-- Add new status to batches status constraint
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;

  -- Add updated constraint with new status
  ALTER TABLE batches ADD CONSTRAINT batches_status_check CHECK (
    status IN (
      'created',
      'validated_for_transport',
      'received_airport',
      'shipped_refinery',
      'received_refinery',
      'processing',
      'processed',
      'approved',
      'ready_for_sale',
      'sold',
      'paid',
      'rejected'
    )
  );
END $$;

-- Add new columns to batches table
DO $$
BEGIN
  -- Received weight in grams
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'received_weight_grams'
  ) THEN
    ALTER TABLE batches ADD COLUMN received_weight_grams numeric(10, 2);
  END IF;

  -- Received weight in ounces
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'received_weight_ounces'
  ) THEN
    ALTER TABLE batches ADD COLUMN received_weight_ounces numeric(10, 2);
  END IF;

  -- Receipt date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'received_date'
  ) THEN
    ALTER TABLE batches ADD COLUMN received_date date;
  END IF;

  -- Transport company reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'transport_company_id'
  ) THEN
    ALTER TABLE batches ADD COLUMN transport_company_id uuid REFERENCES transport_companies(id);
  END IF;

  -- Freight document URL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'freight_document_url'
  ) THEN
    ALTER TABLE batches ADD COLUMN freight_document_url text;
  END IF;
END $$;

-- Create index on transport company for faster lookups
CREATE INDEX IF NOT EXISTS idx_batches_transport_company
  ON batches(transport_company_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_batches_status
  ON batches(status);

-- Comment on new columns
COMMENT ON COLUMN batches.received_weight_grams IS 'Actual weight received at airport (may differ from shipping weight)';
COMMENT ON COLUMN batches.received_weight_ounces IS 'Received weight converted to ounces';
COMMENT ON COLUMN batches.received_date IS 'Date batch was received at airport';
COMMENT ON COLUMN batches.transport_company_id IS 'Freight company for airport to refinery transport';
COMMENT ON COLUMN batches.freight_document_url IS 'Storage path for freight documentation';