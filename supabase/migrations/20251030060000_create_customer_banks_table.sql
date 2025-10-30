/*
  # Create Customer Banks Table

  1. New Tables
    - `customer_banks`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to customers)
      - `bank_name` (text) - Name of the bank
      - `country` (text) - Country where bank is located
      - `city` (text) - City where bank is located
      - `account_number` (text) - Bank account number
      - `iban` (text) - International Bank Account Number
      - `swift_code` (text) - SWIFT/BIC code
      - `currency` (text) - Currency of the account (USD, EUR, GNF, XOF, etc.)
      - `is_primary` (boolean) - Whether this is the primary bank account
      - `is_active` (boolean) - Whether this account is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `customer_banks` table
    - Add policies for authenticated users to manage bank accounts
*/

-- Create customer_banks table
CREATE TABLE IF NOT EXISTS customer_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  account_number text,
  iban text,
  swift_code text,
  currency text NOT NULL DEFAULT 'USD',
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_banks_customer_id ON customer_banks(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_banks_is_primary ON customer_banks(customer_id, is_primary) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE customer_banks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Authenticated users can insert customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Authenticated users can update customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Authenticated users can delete customer banks" ON customer_banks;

-- Create RLS policies
CREATE POLICY "Authenticated users can view customer banks"
  ON customer_banks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customer banks"
  ON customer_banks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer banks"
  ON customer_banks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete customer banks"
  ON customer_banks
  FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_customer_banks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_banks_updated_at
  BEFORE UPDATE ON customer_banks
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_banks_updated_at();

-- Create function to ensure only one primary bank per customer
CREATE OR REPLACE FUNCTION ensure_single_primary_bank()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Unset is_primary for all other banks of this customer
    UPDATE customer_banks
    SET is_primary = false
    WHERE customer_id = NEW.customer_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_bank_trigger
  BEFORE INSERT OR UPDATE ON customer_banks
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_bank();
