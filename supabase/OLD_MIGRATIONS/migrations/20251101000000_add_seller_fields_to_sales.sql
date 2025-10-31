/*
  # Add Seller Fields to Sales Table

  1. New Columns
    - `seller_id` (uuid) - References mining_companies or internal Mansa identifier
    - `seller_type` (text) - Type of seller: 'mining_company' or 'mansa_ressources'
    - `is_internal_sale` (boolean) - TRUE when mining company sells to Mansa, FALSE for external

  2. Changes
    - Add seller tracking columns to sales table
    - Create indexes for performance
    - Set default values for existing records

  3. Security
    - No RLS changes, uses existing policies
*/

-- Add seller_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'seller_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN seller_id uuid;
    COMMENT ON COLUMN sales.seller_id IS 'ID of the seller (mining company or Mansa Ressources)';
  END IF;
END $$;

-- Add seller_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'seller_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN seller_type text CHECK (seller_type IN ('mining_company', 'mansa_ressources'));
    COMMENT ON COLUMN sales.seller_type IS 'Type of seller: mining_company or mansa_ressources';
  END IF;
END $$;

-- Add is_internal_sale column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'is_internal_sale'
  ) THEN
    ALTER TABLE sales ADD COLUMN is_internal_sale boolean DEFAULT false;
    COMMENT ON COLUMN sales.is_internal_sale IS 'TRUE when mining company sells to Mansa (internal), FALSE for external sales';
  END IF;
END $$;

-- Set default values for existing records (assume all are Mansa external sales)
UPDATE sales
SET
  seller_type = 'mansa_ressources',
  is_internal_sale = false
WHERE seller_type IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller_type ON sales(seller_type);
CREATE INDEX IF NOT EXISTS idx_sales_is_internal ON sales(is_internal_sale);
CREATE INDEX IF NOT EXISTS idx_sales_seller_composite ON sales(seller_id, seller_type, is_internal_sale);

-- Add comment for documentation
COMMENT ON TABLE sales IS 'Sales transactions tracking seller (mining company or Mansa) to customer relationships';
