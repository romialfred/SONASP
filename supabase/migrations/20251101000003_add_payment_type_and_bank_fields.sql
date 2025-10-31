/*
  # Add Payment Type and Bank Fields to Payments Table

  1. New Columns
    - `payment_type` (text) - 'virtual' or 'real'
    - `customer_bank_id` (uuid) - Reference to customer_banks table
    - `seller_bank_id` (uuid) - Reference to stakeholder_bank_accounts table
    - `fx_analysis_id` (uuid) - Reference to fx_rate_analysis table (will be created next)

  2. Changes
    - Align payment_type with existing is_virtual column
    - Add bank account tracking for both parties
    - Prepare for FX rate analysis linking

  3. Security
    - Uses existing RLS policies
    - No additional security changes needed
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
    COMMENT ON COLUMN payments.seller_bank_id IS 'Reference to seller bank account receiving payment';
  END IF;
END $$;

-- Add fx_analysis_id column (will reference fx_rate_analysis table created in next migration)
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

-- Synchronize payment_type with existing is_virtual column
UPDATE payments
SET payment_type = CASE
  WHEN is_virtual = true THEN 'virtual'
  ELSE 'real'
END
WHERE payment_type IS NULL;

-- For any NULL values after update, default to 'real'
UPDATE payments SET payment_type = 'real' WHERE payment_type IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_customer_bank ON payments(customer_bank_id);
CREATE INDEX IF NOT EXISTS idx_payments_seller_bank ON payments(seller_bank_id);
CREATE INDEX IF NOT EXISTS idx_payments_fx_analysis ON payments(fx_analysis_id);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_payments_type_status ON payments(payment_type, status);

-- Add helpful view for payment details with bank information
CREATE OR REPLACE VIEW payments_with_banks AS
SELECT
  p.id as payment_id,
  p.sale_id,
  p.amount,
  p.currency,
  p.payment_type,
  p.status as payment_status,
  p.expected_date,
  p.actual_date,
  p.fx_rate,
  p.reference_number,
  p.created_at as payment_created_at,

  -- Customer bank information
  cb.id as customer_bank_id,
  cb.bank_name as customer_bank_name,
  cb.country as customer_bank_country,
  cb.currency as customer_bank_currency,
  cb.swift_code as customer_swift,

  -- Seller bank information
  sb.id as seller_bank_id,
  sb.bank_name as seller_bank_name,
  sb.bank_country as seller_bank_country,
  sb.account_currency as seller_bank_currency,
  sb.swift_code as seller_swift,

  -- Sale information
  s.sale_number,
  s.customer_id,
  s.seller_id,
  s.seller_type,
  s.status as sale_status,

  -- Customer information
  c.name as customer_name,
  c.email as customer_email

FROM payments p
LEFT JOIN customer_banks cb ON p.customer_bank_id = cb.id
LEFT JOIN stakeholder_bank_accounts sb ON p.seller_bank_id = sb.id
INNER JOIN sales s ON p.sale_id = s.id
INNER JOIN customers c ON s.customer_id = c.id;

-- Grant access to view
GRANT SELECT ON payments_with_banks TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Payment type and bank fields added successfully to payments table';
END $$;
