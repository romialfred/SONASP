/*
  # Fix Customers Table - Add Missing Columns

  1. Purpose
    - Add is_active column (referenced by app code)
    - Add company column (used in batch analysis)
    - Update status column to work with is_active

  2. Changes
    - Add is_active boolean column
    - Add company text column
    - Update existing records to set is_active based on status
    - Keep both columns for backwards compatibility

  3. Migration Safety
    - Uses IF NOT EXISTS checks
    - Updates existing data safely
    - No data loss
*/

-- Add is_active column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE customers ADD COLUMN is_active boolean DEFAULT true;
    RAISE NOTICE 'Added is_active column to customers table';
  END IF;
END $$;

-- Add company column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'company'
  ) THEN
    ALTER TABLE customers ADD COLUMN company text;
    RAISE NOTICE 'Added company column to customers table';
  END IF;
END $$;

-- Update is_active based on status for existing records
UPDATE customers
SET is_active = (status = 'active')
WHERE is_active IS NULL;

-- Set company to name if not set
UPDATE customers
SET company = name
WHERE company IS NULL;

-- Create index on is_active for performance
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

RAISE NOTICE 'Customers table schema updated successfully';
