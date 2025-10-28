/*
  # Remove origin_site_id from batches table

  1. Changes
    - Remove origin_site_id column from batches table
    - Origin is now determined by mining_company_id

  2. Rationale
    - The origin site is redundant since it's already defined by the mining company
    - Mining company provides the country information needed for batch numbering
    - Simplifies data model and removes duplicate information
*/

-- Remove the origin_site_id column from batches table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'origin_site_id'
  ) THEN
    ALTER TABLE batches DROP COLUMN origin_site_id;
  END IF;
END $$;

-- Also remove current_site_id if it exists (was set to origin_site_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'current_site_id'
  ) THEN
    ALTER TABLE batches DROP COLUMN current_site_id;
  END IF;
END $$;

-- Ensure mining_company_id exists and is properly constrained
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
