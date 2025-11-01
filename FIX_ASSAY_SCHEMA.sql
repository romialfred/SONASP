/*
  # Fix Assay Certificates Schema - Add Missing Columns
  
  This migration adds columns that the application expects in the assay_certificates table.
  These columns will store quick-access summary data from parsed certificates.
  
  IMPORTANT: Run this ONLY if you've already run the base migration
  (20251104000000_create_assay_certificates_system.sql)
*/

-- Add missing columns to assay_certificates for quick access to parsed data
DO $$ 
BEGIN
  -- Add sample_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'sample_id'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN sample_id text;
  END IF;

  -- Add sample_weight_grams if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'sample_weight_grams'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN sample_weight_grams numeric(12, 3);
  END IF;

  -- Add gold_content_ppm if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'gold_content_ppm'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN gold_content_ppm numeric(12, 3);
  END IF;

  -- Add gold_content_gpt if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'gold_content_gpt'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN gold_content_gpt numeric(12, 3);
  END IF;

  -- Add gold_content_percent if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'gold_content_percent'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN gold_content_percent numeric(5, 2);
  END IF;

  -- Add silver_content_ppm if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'silver_content_ppm'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN silver_content_ppm numeric(12, 3);
  END IF;

  -- Add silver_content_gpt if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'silver_content_gpt'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN silver_content_gpt numeric(12, 3);
  END IF;

  -- Add silver_content_percent if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'silver_content_percent'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN silver_content_percent numeric(5, 2);
  END IF;

  -- Add platinum_content_ppm if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'platinum_content_ppm'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN platinum_content_ppm numeric(12, 3);
  END IF;

  -- Add palladium_content_ppm if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'palladium_content_ppm'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN palladium_content_ppm numeric(12, 3);
  END IF;

  -- Add fineness if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'fineness'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN fineness numeric(6, 3);
  END IF;

  -- Add purity_percent if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assay_certificates' AND column_name = 'purity_percent'
  ) THEN
    ALTER TABLE assay_certificates ADD COLUMN purity_percent numeric(5, 2);
  END IF;
END $$;

-- Add comments for new columns
COMMENT ON COLUMN assay_certificates.sample_id IS 'Quick-access copy of sample ID from parsed data';
COMMENT ON COLUMN assay_certificates.sample_weight_grams IS 'Quick-access copy of sample weight from parsed data';
COMMENT ON COLUMN assay_certificates.gold_content_ppm IS 'Quick-access gold content in PPM from parsed data';
COMMENT ON COLUMN assay_certificates.gold_content_gpt IS 'Quick-access gold content in GPT from parsed data';
COMMENT ON COLUMN assay_certificates.gold_content_percent IS 'Quick-access gold percentage from parsed data';
COMMENT ON COLUMN assay_certificates.silver_content_ppm IS 'Quick-access silver content in PPM from parsed data';
COMMENT ON COLUMN assay_certificates.silver_content_gpt IS 'Quick-access silver content in GPT from parsed data';
COMMENT ON COLUMN assay_certificates.silver_content_percent IS 'Quick-access silver percentage from parsed data';
COMMENT ON COLUMN assay_certificates.platinum_content_ppm IS 'Quick-access platinum content from parsed data';
COMMENT ON COLUMN assay_certificates.palladium_content_ppm IS 'Quick-access palladium content from parsed data';
COMMENT ON COLUMN assay_certificates.fineness IS 'Quick-access fineness value from parsed data';
COMMENT ON COLUMN assay_certificates.purity_percent IS 'Quick-access purity percentage from parsed data';

-- Create index for searching by sample_id
CREATE INDEX IF NOT EXISTS idx_assay_certificates_sample_id ON assay_certificates(sample_id);

-- Verification query
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'assay_certificates' 
    AND table_schema = 'public';
  
  RAISE NOTICE 'assay_certificates table now has % columns', col_count;
END $$;
