/*
  # Add Reception Tracking Columns to Batches Table

  1. Purpose
    - Add comprehensive tracking columns for batch reception at airport and refinery
    - Enable full traceability of weight measurements and variances
    - Support reconciliation workflows

  2. New Columns
    - Airport reception tracking (weight, variance, timestamps, users)
    - Refinery reception tracking (weight, variance, timestamps, users)
    - Processing tracking (start times, users)

  3. Security
    - Uses existing RLS policies from batches table
    - Foreign key references to auth.users for audit trail
*/

-- Add Airport Reception Tracking Columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'airport_received_weight_grams') THEN
    ALTER TABLE batches ADD COLUMN airport_received_weight_grams numeric;
    COMMENT ON COLUMN batches.airport_received_weight_grams IS 'Actual weight received at airport in grams';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'airport_received_weight_ounces') THEN
    ALTER TABLE batches ADD COLUMN airport_received_weight_ounces numeric;
    COMMENT ON COLUMN batches.airport_received_weight_ounces IS 'Actual weight received at airport in ounces';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'airport_received_at') THEN
    ALTER TABLE batches ADD COLUMN airport_received_at timestamptz;
    COMMENT ON COLUMN batches.airport_received_at IS 'Timestamp when batch was received at airport';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'airport_received_by') THEN
    ALTER TABLE batches ADD COLUMN airport_received_by uuid REFERENCES auth.users(id);
    COMMENT ON COLUMN batches.airport_received_by IS 'User who confirmed airport reception';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'airport_variance_percentage') THEN
    ALTER TABLE batches ADD COLUMN airport_variance_percentage numeric;
    COMMENT ON COLUMN batches.airport_variance_percentage IS 'Percentage variance between expected and actual weight at airport';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'airport_reconciliation_comments') THEN
    ALTER TABLE batches ADD COLUMN airport_reconciliation_comments text;
    COMMENT ON COLUMN batches.airport_reconciliation_comments IS 'Comments for significant variances at airport';
  END IF;

  RAISE NOTICE 'Airport reception tracking columns added to batches table';
END $$;

-- Add Refinery Reception Tracking Columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'refinery_received_weight_grams') THEN
    ALTER TABLE batches ADD COLUMN refinery_received_weight_grams numeric;
    COMMENT ON COLUMN batches.refinery_received_weight_grams IS 'Actual weight received at refinery in grams';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'refinery_received_weight_ounces') THEN
    ALTER TABLE batches ADD COLUMN refinery_received_weight_ounces numeric;
    COMMENT ON COLUMN batches.refinery_received_weight_ounces IS 'Actual weight received at refinery in ounces';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'refinery_received_at') THEN
    ALTER TABLE batches ADD COLUMN refinery_received_at timestamptz;
    COMMENT ON COLUMN batches.refinery_received_at IS 'Timestamp when batch was received at refinery';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'refinery_received_by') THEN
    ALTER TABLE batches ADD COLUMN refinery_received_by uuid REFERENCES auth.users(id);
    COMMENT ON COLUMN batches.refinery_received_by IS 'User who confirmed refinery reception';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'refinery_variance_percentage') THEN
    ALTER TABLE batches ADD COLUMN refinery_variance_percentage numeric;
    COMMENT ON COLUMN batches.refinery_variance_percentage IS 'Percentage variance between expected and actual weight at refinery';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'refinery_reconciliation_comments') THEN
    ALTER TABLE batches ADD COLUMN refinery_reconciliation_comments text;
    COMMENT ON COLUMN batches.refinery_reconciliation_comments IS 'Comments for significant variances at refinery';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'refinery_validated_at') THEN
    ALTER TABLE batches ADD COLUMN refinery_validated_at timestamptz;
    COMMENT ON COLUMN batches.refinery_validated_at IS 'Timestamp when refinery reception was validated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'refinery_validated_by') THEN
    ALTER TABLE batches ADD COLUMN refinery_validated_by uuid REFERENCES auth.users(id);
    COMMENT ON COLUMN batches.refinery_validated_by IS 'User who validated refinery reception';
  END IF;

  RAISE NOTICE 'Refinery reception tracking columns added to batches table';
END $$;

-- Add Processing Tracking Columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'processing_started_at') THEN
    ALTER TABLE batches ADD COLUMN processing_started_at timestamptz;
    COMMENT ON COLUMN batches.processing_started_at IS 'Timestamp when processing began';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'processing_started_by') THEN
    ALTER TABLE batches ADD COLUMN processing_started_by uuid REFERENCES auth.users(id);
    COMMENT ON COLUMN batches.processing_started_by IS 'User who started processing';
  END IF;

  RAISE NOTICE 'Processing tracking columns added to batches table';
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_batches_airport_received_at ON batches(airport_received_at);
CREATE INDEX IF NOT EXISTS idx_batches_refinery_received_at ON batches(refinery_received_at);
CREATE INDEX IF NOT EXISTS idx_batches_processing_started_at ON batches(processing_started_at);
CREATE INDEX IF NOT EXISTS idx_batches_airport_received_by ON batches(airport_received_by);
CREATE INDEX IF NOT EXISTS idx_batches_refinery_received_by ON batches(refinery_received_by);
CREATE INDEX IF NOT EXISTS idx_batches_refinery_validated_at ON batches(refinery_validated_at);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Reception tracking migration completed successfully';
END $$;
