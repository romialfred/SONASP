/*
  # Enhance Batch Schema for Documents and Metal Types

  ## Overview
  This migration enhances the batches table to support:
  - Metal type specification (Gold, Silver, Zinc, Diamond, etc.)
  - Document attachments for batch compliance
  - Removes purity_percentage (moved to refining stage)
  - Updates sites with specific locations

  ## Table Modifications

  ### Enhanced `batches` table
  - Add `metal_type` (text) - Type of metal: gold, silver, zinc, diamond, other
  - Add `documents` (jsonb) - Array of document metadata (name, url, type, size, uploaded_at)
  - Remove `purity_percentage` - This is determined during refining, not at shipment

  ### Sites
  - Add new specific mining locations: Kouroussa, Dugbe, Yanfollia

  ## Notes
  - Purity is assessed during the refining process, not at initial batch creation
  - Documents can include shipping manifests, certificates, photos, etc.
  - Metal type is required to properly categorize and track different materials
*/

-- Add metal_type column to batches table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'metal_type') THEN
    ALTER TABLE batches ADD COLUMN metal_type text DEFAULT 'gold' CHECK (metal_type IN ('gold', 'silver', 'zinc', 'diamond', 'other'));
  END IF;
END $$;

-- Add documents column to batches table for storing document metadata
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'documents') THEN
    ALTER TABLE batches ADD COLUMN documents jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Remove purity_percentage column if it exists (purity is determined during refining)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'purity_percentage') THEN
    ALTER TABLE batches DROP COLUMN purity_percentage;
  END IF;
END $$;

-- Update existing batches to have default metal_type if null
UPDATE batches SET metal_type = 'gold' WHERE metal_type IS NULL;

-- Create index for metal_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_batches_metal_type ON batches(metal_type);

-- Insert specific mining sites with proper check
DO $$
BEGIN
  -- Insert Kouroussa - Guinea
  IF NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Kouroussa') THEN
    INSERT INTO sites (name, site_type, country, address, is_active)
    VALUES ('Kouroussa', 'factory', 'GN', 'Kouroussa, Guinea', true);
  END IF;

  -- Insert Dugbe (stored as Guinea for now due to country constraint)
  IF NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Dugbe') THEN
    INSERT INTO sites (name, site_type, country, address, is_active)
    VALUES ('Dugbe', 'factory', 'GN', 'Dugbe, Liberia', true);
  END IF;

  -- Insert Yanfollia - Mali
  IF NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Yanfollia') THEN
    INSERT INTO sites (name, site_type, country, address, is_active)
    VALUES ('Yanfollia', 'factory', 'ML', 'Yanfollia, Mali', true);
  END IF;
END $$;

-- Add comment to documents column
COMMENT ON COLUMN batches.documents IS 'Array of document metadata: [{name, url, type, size, uploaded_at, uploaded_by}]';
COMMENT ON COLUMN batches.metal_type IS 'Type of metal being shipped: gold, silver, zinc, diamond, or other';
