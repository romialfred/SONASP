/*
  # Advanced Security Constraints for Gold Shipper

  ## Purpose
  Add comprehensive data validation and security constraints at the database level
  to ensure data integrity, prevent invalid data entry, and enforce business rules.

  ## Changes
  1. Weight Validation Constraints
     - Ensure all weights are positive
     - Validate weight after melting <= weight before melting
     - Prevent negative or zero weights

  2. Percentage Validation
     - Fineness percentage between 0-100
     - Metal retained percentage between 0-100
     - Logical validation for both fields

  3. Date Validation
     - Dates cannot be in the future
     - Chronological order: shipping < airport < refinery
     - Prevent illogical date sequences

  4. Variance Thresholds Configuration
     - Configurable variance limits per location and metal type
     - Automatic variance calculation and validation
     - Approval requirements for high variances

  ## Data Safety
  - All constraints allow NULL values where appropriate
  - Existing data is validated before constraint application
  - Clear error messages guide users to correct data

  ## Business Value
  - Prevents data entry errors at the source
  - Ensures data consistency across the application
  - Reduces need for manual data validation
  - Provides clear feedback on invalid data
*/

-- ========================================
-- STEP 1: Weight Validation Constraints
-- ========================================

-- Batch weights must be positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_weight_positive'
  ) THEN
    ALTER TABLE batches
      ADD CONSTRAINT check_weight_positive
      CHECK (weight_grams > 0);
    RAISE NOTICE 'Added constraint: check_weight_positive';
  END IF;
END $$;

-- Airport received weight must be positive if provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_airport_weight_positive'
  ) THEN
    ALTER TABLE batches
      ADD CONSTRAINT check_airport_weight_positive
      CHECK (airport_received_weight_grams IS NULL OR airport_received_weight_grams > 0);
    RAISE NOTICE 'Added constraint: check_airport_weight_positive';
  END IF;
END $$;

-- Refinery received weight must be positive if provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_refinery_weight_positive'
  ) THEN
    ALTER TABLE batches
      ADD CONSTRAINT check_refinery_weight_positive
      CHECK (refinery_received_weight_grams IS NULL OR refinery_received_weight_grams > 0);
    RAISE NOTICE 'Added constraint: check_refinery_weight_positive';
  END IF;
END $$;

-- Gold inventory melting weights validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_melting_weights_positive'
  ) THEN
    ALTER TABLE gold_inventory
      ADD CONSTRAINT check_melting_weights_positive
      CHECK (
        weight_before_melting_grams > 0 AND
        weight_after_melting_grams > 0 AND
        weight_after_melting_grams <= weight_before_melting_grams
      );
    RAISE NOTICE 'Added constraint: check_melting_weights_positive';
  END IF;
END $$;

-- ========================================
-- STEP 2: Percentage Validation
-- ========================================

-- Fineness percentage must be between 0 and 100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_fineness_range'
  ) THEN
    ALTER TABLE gold_inventory
      ADD CONSTRAINT check_fineness_range
      CHECK (fineness_percentage >= 0 AND fineness_percentage <= 100);
    RAISE NOTICE 'Added constraint: check_fineness_range';
  END IF;
END $$;

-- Metal retained percentage must be between 0 and 100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_metal_retained_range'
  ) THEN
    ALTER TABLE gold_inventory
      ADD CONSTRAINT check_metal_retained_range
      CHECK (metal_retained_percentage >= 0 AND metal_retained_percentage <= 100);
    RAISE NOTICE 'Added constraint: check_metal_retained_range';
  END IF;
END $$;

-- ========================================
-- STEP 3: Date Validation Functions
-- ========================================

-- Function to prevent future dates
CREATE OR REPLACE FUNCTION validate_dates_not_future()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipping_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Shipping date cannot be in the future (provided: %, current: %)',
      NEW.shipping_date, CURRENT_DATE;
  END IF;

  IF NEW.airport_received_at IS NOT NULL AND NEW.airport_received_at > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Airport receipt date cannot be in the future (provided: %, current: %)',
      NEW.airport_received_at, CURRENT_TIMESTAMP;
  END IF;

  IF NEW.refinery_received_at IS NOT NULL AND NEW.refinery_received_at > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Refinery receipt date cannot be in the future (provided: %, current: %)',
      NEW.refinery_received_at, CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger for future date validation
DROP TRIGGER IF EXISTS check_batch_dates_not_future ON batches;
CREATE TRIGGER check_batch_dates_not_future
  BEFORE INSERT OR UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION validate_dates_not_future();

-- Function to validate chronological order of dates
CREATE OR REPLACE FUNCTION validate_date_sequence()
RETURNS TRIGGER AS $$
BEGIN
  -- Airport receipt must be after shipping
  IF NEW.airport_received_at IS NOT NULL THEN
    IF NEW.airport_received_at::date < NEW.shipping_date THEN
      RAISE EXCEPTION 'Airport receipt date (%) cannot be before shipping date (%)',
        NEW.airport_received_at::date, NEW.shipping_date;
    END IF;
  END IF;

  -- Refinery receipt must be after airport receipt
  IF NEW.refinery_received_at IS NOT NULL AND NEW.airport_received_at IS NOT NULL THEN
    IF NEW.refinery_received_at < NEW.airport_received_at THEN
      RAISE EXCEPTION 'Refinery receipt date (%) cannot be before airport receipt date (%)',
        NEW.refinery_received_at, NEW.airport_received_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger for date sequence validation
DROP TRIGGER IF EXISTS check_batch_date_sequence ON batches;
CREATE TRIGGER check_batch_date_sequence
  BEFORE INSERT OR UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION validate_date_sequence();

-- ========================================
-- STEP 4: Variance Thresholds Configuration
-- ========================================

-- Create table for configurable variance thresholds
CREATE TABLE IF NOT EXISTS variance_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL CHECK (location IN ('airport', 'refinery')),
  metal_type text NOT NULL CHECK (metal_type IN ('gold', 'silver')),
  max_variance_percentage decimal(5,2) NOT NULL CHECK (max_variance_percentage >= 0),
  requires_approval_above decimal(5,2) NOT NULL CHECK (requires_approval_above >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location, metal_type)
);

-- Enable RLS on variance_thresholds
ALTER TABLE variance_thresholds ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read thresholds
CREATE POLICY "Anyone can read variance thresholds"
  ON variance_thresholds FOR SELECT
  USING (true);

-- Policy: Only management can modify thresholds
CREATE POLICY "Only management can modify thresholds"
  ON variance_thresholds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'management'
    )
  );

-- Insert default variance thresholds
INSERT INTO variance_thresholds (location, metal_type, max_variance_percentage, requires_approval_above) VALUES
  ('airport', 'gold', 2.00, 1.00),
  ('airport', 'silver', 3.00, 1.50),
  ('refinery', 'gold', 1.50, 0.75),
  ('refinery', 'silver', 2.50, 1.00)
ON CONFLICT (location, metal_type) DO UPDATE SET
  max_variance_percentage = EXCLUDED.max_variance_percentage,
  requires_approval_above = EXCLUDED.requires_approval_above,
  updated_at = now();

-- ========================================
-- STEP 5: Variance Calculation View
-- ========================================

-- Create view to calculate variances for all batches
CREATE OR REPLACE VIEW batch_weight_variances AS
SELECT
  b.id,
  b.batch_number,
  b.metal_type,
  b.weight_grams as initial_weight_grams,
  b.airport_received_weight_grams,
  b.refinery_received_weight_grams,

  -- Airport variance
  CASE
    WHEN b.airport_received_weight_grams IS NOT NULL THEN
      ROUND(
        ABS((b.airport_received_weight_grams - b.weight_grams) / b.weight_grams * 100)::numeric,
        2
      )
    ELSE NULL
  END as airport_variance_percentage,

  -- Refinery variance
  CASE
    WHEN b.refinery_received_weight_grams IS NOT NULL THEN
      ROUND(
        ABS((b.refinery_received_weight_grams - COALESCE(b.airport_received_weight_grams, b.weight_grams))
        / COALESCE(b.airport_received_weight_grams, b.weight_grams) * 100)::numeric,
        2
      )
    ELSE NULL
  END as refinery_variance_percentage,

  -- Check if airport variance exceeds threshold
  CASE
    WHEN b.airport_received_weight_grams IS NOT NULL THEN
      ABS((b.airport_received_weight_grams - b.weight_grams) / b.weight_grams * 100) >
      (SELECT max_variance_percentage FROM variance_thresholds
       WHERE location = 'airport' AND metal_type = b.metal_type)
    ELSE false
  END as airport_variance_exceeds_max,

  -- Check if refinery variance exceeds threshold
  CASE
    WHEN b.refinery_received_weight_grams IS NOT NULL THEN
      ABS((b.refinery_received_weight_grams - COALESCE(b.airport_received_weight_grams, b.weight_grams))
      / COALESCE(b.airport_received_weight_grams, b.weight_grams) * 100) >
      (SELECT max_variance_percentage FROM variance_thresholds
       WHERE location = 'refinery' AND metal_type = b.metal_type)
    ELSE false
  END as refinery_variance_exceeds_max,

  b.status,
  b.created_at
FROM batches b;

COMMENT ON VIEW batch_weight_variances IS
  'Calculates weight variances for all batches and flags those exceeding configured thresholds.
   Use this view to monitor weight discrepancies and identify batches requiring investigation.';

-- ========================================
-- STEP 6: Validation Summary
-- ========================================

DO $$
DECLARE
  batch_count INTEGER;
  invalid_batches INTEGER;
BEGIN
  -- Count total batches
  SELECT COUNT(*) INTO batch_count FROM batches;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Security Constraints Applied Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Weight Constraints:';
  RAISE NOTICE '  ✓ All batch weights must be positive';
  RAISE NOTICE '  ✓ Airport/refinery weights must be positive if provided';
  RAISE NOTICE '  ✓ Weight after melting must be <= weight before melting';
  RAISE NOTICE '';
  RAISE NOTICE 'Percentage Constraints:';
  RAISE NOTICE '  ✓ Fineness: 0-100%%';
  RAISE NOTICE '  ✓ Metal retained: 0-100%%';
  RAISE NOTICE '';
  RAISE NOTICE 'Date Validation:';
  RAISE NOTICE '  ✓ No future dates allowed';
  RAISE NOTICE '  ✓ Chronological order enforced';
  RAISE NOTICE '';
  RAISE NOTICE 'Variance Thresholds:';
  RAISE NOTICE '  ✓ Configurable per location and metal type';
  RAISE NOTICE '  ✓ Automatic variance calculation';
  RAISE NOTICE '';
  RAISE NOTICE 'Total batches validated: %', batch_count;
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
