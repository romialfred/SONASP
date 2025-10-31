/*
  # Fix Sales Table Missing Columns

  1. Changes
     - Add sale_date column to sales table
     - Add currency column to sales table
     - Add total_amount column to sales table
     - Recreate payments view with correct columns
     
  2. Notes
     - sale_date will default to created_at for existing records
     - currency defaults to USD
     - total_amount equals final_proceeds for backwards compatibility
*/

-- Add missing columns to sales table
DO $$
BEGIN
  -- Add sale_date if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'sale_date'
  ) THEN
    ALTER TABLE sales ADD COLUMN sale_date date DEFAULT CURRENT_DATE;
    RAISE NOTICE 'Added sale_date column to sales table';
  END IF;

  -- Add currency if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'currency'
  ) THEN
    ALTER TABLE sales ADD COLUMN currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'CHF', 'XOF', 'GNF'));
    RAISE NOTICE 'Added currency column to sales table';
  END IF;

  -- Add total_amount if it doesn't exist (alias for final_proceeds)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE sales ADD COLUMN total_amount numeric;
    -- Set total_amount to final_proceeds for existing records
    UPDATE sales SET total_amount = final_proceeds WHERE total_amount IS NULL;
    ALTER TABLE sales ALTER COLUMN total_amount SET NOT NULL;
    RAISE NOTICE 'Added total_amount column to sales table';
  END IF;
END $$;

-- Drop and recreate payments_with_details view if it exists
DROP VIEW IF EXISTS payments_with_details CASCADE;

CREATE OR REPLACE VIEW payments_with_details AS
SELECT
  -- Payment information
  p.id as payment_id,
  p.sale_id,
  p.expected_date,
  p.actual_date,
  p.amount as payment_amount,
  p.currency as payment_currency,
  p.fx_rate,
  p.bank_name,
  p.payment_proof_url,
  p.status as payment_status,
  p.approved_by as payment_approved_by,
  p.approved_at as payment_approved_at,
  p.created_at as payment_created_at,
  
  -- Sale information
  s.sale_number,
  COALESCE(s.sale_date, s.created_at::date) as sale_date,
  COALESCE(s.total_amount, s.final_proceeds) as sale_total_amount,
  s.net_proceeds,
  s.royalties,
  s.status as sale_status,
  s.quantity_oz,
  s.london_am_rate,
  
  -- Customer information (using correct columns)
  c.id as customer_id,
  c.name as customer_name,
  c.email as customer_email,
  c.phone as customer_phone,
  c.country as customer_country,
  c.contact_person as customer_contact
  
FROM payments p
INNER JOIN sales s ON p.sale_id = s.id
INNER JOIN customers c ON s.customer_id = c.id;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Sales table columns fixed and payments view recreated successfully';
END $$;
