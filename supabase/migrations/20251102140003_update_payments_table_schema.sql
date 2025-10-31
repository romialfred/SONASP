/*
  # Update Payments Table Schema

  1. Purpose
    - Add columns for bank account tracking
    - Add payment type (virtual vs real)
    - Add currency fields for multi-currency support
    - Link to FX analysis

  2. New Columns
    - payment_type (text) - 'virtual' or 'real'
    - customer_bank_id (uuid) - Reference to customer_banks
    - seller_bank_id (uuid) - Reference to stakeholder_bank_accounts
    - payment_currency (text) - Currency used for payment
    - receiving_currency (text) - Currency received
    - received_amount (numeric) - Actual amount received
    - fx_analysis_id (uuid) - Link to FX rate analysis
    - is_virtual (boolean) - For backward compatibility

  3. Security
    - Uses existing RLS policies
    - No modifications to security needed
*/

-- Add payment_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_type text CHECK (payment_type IN ('virtual', 'real'));
    COMMENT ON COLUMN payments.payment_type IS 'Type of payment: virtual (auto-generated) or real (actual payment received)';
  END IF;
END $$;

-- Add is_virtual for backward compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'is_virtual'
  ) THEN
    ALTER TABLE payments ADD COLUMN is_virtual boolean DEFAULT false;
    COMMENT ON COLUMN payments.is_virtual IS 'Legacy field: true if payment is virtual/placeholder';
  END IF;
END $$;

-- Add customer_bank_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'customer_bank_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN customer_bank_id uuid REFERENCES customer_banks(id);
    COMMENT ON COLUMN payments.customer_bank_id IS 'Reference to customer bank account used for payment';
  END IF;
END $$;

-- Add seller_bank_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'seller_bank_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN seller_bank_id uuid REFERENCES stakeholder_bank_accounts(id);
    COMMENT ON COLUMN payments.seller_bank_id IS 'Reference to seller/mining company bank account receiving payment';
  END IF;
END $$;

-- Add payment_currency column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_currency'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_currency text;
    COMMENT ON COLUMN payments.payment_currency IS 'Currency used by customer for payment (USD, EUR, CHF, XOF, GNF)';
  END IF;
END $$;

-- Add receiving_currency column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'receiving_currency'
  ) THEN
    ALTER TABLE payments ADD COLUMN receiving_currency text;
    COMMENT ON COLUMN payments.receiving_currency IS 'Currency received by seller (USD, EUR, CHF, XOF, GNF)';
  END IF;
END $$;

-- Add received_amount column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'received_amount'
  ) THEN
    ALTER TABLE payments ADD COLUMN received_amount numeric(18, 2);
    COMMENT ON COLUMN payments.received_amount IS 'Actual amount received in receiving_currency';
  END IF;
END $$;

-- Add fx_analysis_id column (will be linked after fx_rate_analysis table is created)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'fx_analysis_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN fx_analysis_id uuid;
    COMMENT ON COLUMN payments.fx_analysis_id IS 'Reference to FX rate analysis record for this payment';
  END IF;
END $$;

-- Synchronize payment_type with existing is_virtual column if needed
UPDATE payments
SET payment_type = CASE
  WHEN is_virtual = true THEN 'virtual'
  ELSE 'real'
END
WHERE payment_type IS NULL AND is_virtual IS NOT NULL;

-- Set default payment_type for any remaining NULL values
UPDATE payments
SET payment_type = 'real'
WHERE payment_type IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_customer_bank ON payments(customer_bank_id);
CREATE INDEX IF NOT EXISTS idx_payments_seller_bank ON payments(seller_bank_id);
CREATE INDEX IF NOT EXISTS idx_payments_fx_analysis ON payments(fx_analysis_id);
CREATE INDEX IF NOT EXISTS idx_payments_type_status ON payments(payment_type, status);
CREATE INDEX IF NOT EXISTS idx_payments_virtual ON payments(is_virtual) WHERE is_virtual = true;

-- Create a view for payment details with bank information
CREATE OR REPLACE VIEW payments_with_bank_details AS
SELECT
  p.id as payment_id,
  p.sale_id,
  p.amount,
  p.currency,
  p.payment_type,
  p.is_virtual,
  p.status as payment_status,
  p.expected_date,
  p.actual_date,
  p.fx_rate,
  p.reference_number,
  p.payment_currency,
  p.receiving_currency,
  p.received_amount,
  p.created_at as payment_created_at,

  -- Customer bank information
  cb.id as customer_bank_id,
  cb.bank_name as customer_bank_name,
  cb.country as customer_bank_country,
  cb.currency as customer_bank_currency,
  cb.swift_code as customer_swift,
  cb.account_number as customer_account,

  -- Seller bank information
  sb.id as seller_bank_id,
  sb.bank_name as seller_bank_name,
  sb.bank_country as seller_bank_country,
  sb.account_currency as seller_bank_currency,
  sb.swift_code as seller_swift,
  sb.account_number as seller_account,

  -- Sale information
  s.sale_number,
  s.customer_id,
  s.status as sale_status,
  s.quantity_oz,
  s.gross_proceeds,
  s.net_proceeds,
  s.final_proceeds,

  -- Customer information
  c.name as customer_name,
  c.email as customer_email,
  c.country as customer_country

FROM payments p
LEFT JOIN customer_banks cb ON p.customer_bank_id = cb.id
LEFT JOIN stakeholder_bank_accounts sb ON p.seller_bank_id = sb.id
LEFT JOIN sales s ON p.sale_id = s.id
LEFT JOIN customers c ON s.customer_id = c.id;

-- Grant access to view
GRANT SELECT ON payments_with_bank_details TO authenticated;

-- Create function to sync payment_type with is_virtual
CREATE OR REPLACE FUNCTION sync_payment_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Keep payment_type and is_virtual in sync
  IF NEW.payment_type = 'virtual' THEN
    NEW.is_virtual = true;
  ELSIF NEW.payment_type = 'real' THEN
    NEW.is_virtual = false;
  END IF;

  -- If is_virtual is set, update payment_type
  IF NEW.is_virtual = true AND NEW.payment_type IS NULL THEN
    NEW.payment_type = 'virtual';
  ELSIF NEW.is_virtual = false AND NEW.payment_type IS NULL THEN
    NEW.payment_type = 'real';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep fields in sync
DROP TRIGGER IF EXISTS trigger_sync_payment_type ON payments;
CREATE TRIGGER trigger_sync_payment_type
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_payment_type();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Payments table schema updated successfully';
  RAISE NOTICE 'Added payment_type, bank references, and currency fields';
  RAISE NOTICE 'Created view payments_with_bank_details for easy querying';
END $$;
