/*
  # Add Reception Tracking Columns to Batches Table

  ## Overview
  This migration adds comprehensive tracking columns for batch reception at airport and refinery locations.
  These columns enable full traceability of weight measurements, variances, and validation steps.

  ## New Columns Added

  ### Airport Reception Tracking
  - `airport_received_weight_grams` (numeric) - Actual weight received at airport in grams
  - `airport_received_weight_ounces` (numeric) - Actual weight received at airport in ounces
  - `airport_received_at` (timestamptz) - Timestamp when batch was received at airport
  - `airport_received_by` (uuid) - User who confirmed airport reception
  - `airport_variance_percentage` (numeric) - Calculated variance percentage at airport
  - `airport_reconciliation_comments` (text) - Comments for significant variances at airport

  ### Refinery Reception Tracking
  - `refinery_received_weight_grams` (numeric) - Actual weight received at refinery in grams
  - `refinery_received_weight_ounces` (numeric) - Actual weight received at refinery in ounces
  - `refinery_received_at` (timestamptz) - Timestamp when batch was received at refinery
  - `refinery_received_by` (uuid) - User who confirmed refinery reception
  - `refinery_variance_percentage` (numeric) - Calculated variance percentage at refinery
  - `refinery_reconciliation_comments` (text) - Comments for significant variances at refinery
  - `refinery_validated_at` (timestamptz) - Timestamp when refinery reception was validated
  - `refinery_validated_by` (uuid) - User who validated refinery reception

  ### Processing Tracking
  - `processing_started_at` (timestamptz) - Timestamp when processing began
  - `processing_started_by` (uuid) - User who started processing

  ## Business Logic
  - All weight columns allow decimals for precision
  - Variance columns can be positive or negative
  - Reconciliation comments are optional (only required for significant variances)
  - User references link to auth.users for audit trail
  - Timestamps use timestamptz for timezone awareness

  ## Security
  - No RLS changes needed (inherits from batches table policies)
  - User references validated through foreign keys

  ## Notes
  - These columns support the complete reception workflow
  - Enable variance detection and reconciliation processes
  - Provide full audit trail for compliance
*/

-- Add Airport Reception Tracking Columns
ALTER TABLE batches
ADD COLUMN IF NOT EXISTS airport_received_weight_grams numeric,
ADD COLUMN IF NOT EXISTS airport_received_weight_ounces numeric,
ADD COLUMN IF NOT EXISTS airport_received_at timestamptz,
ADD COLUMN IF NOT EXISTS airport_received_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS airport_variance_percentage numeric,
ADD COLUMN IF NOT EXISTS airport_reconciliation_comments text;

-- Add Refinery Reception Tracking Columns
ALTER TABLE batches
ADD COLUMN IF NOT EXISTS refinery_received_weight_grams numeric,
ADD COLUMN IF NOT EXISTS refinery_received_weight_ounces numeric,
ADD COLUMN IF NOT EXISTS refinery_received_at timestamptz,
ADD COLUMN IF NOT EXISTS refinery_received_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS refinery_variance_percentage numeric,
ADD COLUMN IF NOT EXISTS refinery_reconciliation_comments text,
ADD COLUMN IF NOT EXISTS refinery_validated_at timestamptz,
ADD COLUMN IF NOT EXISTS refinery_validated_by uuid REFERENCES auth.users(id);

-- Add Processing Tracking Columns
ALTER TABLE batches
ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
ADD COLUMN IF NOT EXISTS processing_started_by uuid REFERENCES auth.users(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_batches_airport_received_at ON batches(airport_received_at);
CREATE INDEX IF NOT EXISTS idx_batches_refinery_received_at ON batches(refinery_received_at);
CREATE INDEX IF NOT EXISTS idx_batches_processing_started_at ON batches(processing_started_at);
CREATE INDEX IF NOT EXISTS idx_batches_airport_received_by ON batches(airport_received_by);
CREATE INDEX IF NOT EXISTS idx_batches_refinery_received_by ON batches(refinery_received_by);

-- Add comments for documentation
COMMENT ON COLUMN batches.airport_received_weight_grams IS 'Actual weight received at airport in grams';
COMMENT ON COLUMN batches.airport_received_at IS 'Timestamp when batch was received at airport';
COMMENT ON COLUMN batches.airport_variance_percentage IS 'Percentage variance between expected and actual weight at airport';
COMMENT ON COLUMN batches.refinery_received_weight_grams IS 'Actual weight received at refinery in grams';
COMMENT ON COLUMN batches.refinery_received_at IS 'Timestamp when batch was received at refinery';
COMMENT ON COLUMN batches.refinery_variance_percentage IS 'Percentage variance between expected and actual weight at refinery';
COMMENT ON COLUMN batches.refinery_validated_at IS 'Timestamp when refinery reception was validated and moved to processing';
COMMENT ON COLUMN batches.processing_started_at IS 'Timestamp when refinery processing began';
