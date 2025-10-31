/*
  # Create FX Rate Analysis Table

  1. New Table
    - `fx_rate_analysis` - Stores FX rate comparison data for each payment

  2. Features
    - Captures rates from multiple sources (customer, Revolut, ECB, BCEAO)
    - Calculates best rate and gain/loss analysis
    - Links to payment records
    - Historical tracking for reporting

  3. Security
    - RLS enabled
    - Authenticated users can view all
    - Only management can insert analysis records
*/

-- Create fx_rate_analysis table
CREATE TABLE IF NOT EXISTS fx_rate_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

  -- Rate sources
  customer_rate numeric(18, 6) NOT NULL,
  revolut_rate numeric(18, 6),
  ecb_rate numeric(18, 6),
  bceao_rate numeric(18, 6),
  other_rate numeric(18, 6),
  other_rate_source text,

  -- Best rate analysis
  best_rate numeric(18, 6) NOT NULL,
  best_rate_source text NOT NULL,
  worst_rate numeric(18, 6),
  worst_rate_source text,

  -- Financial impact
  amount_paid numeric(18, 2) NOT NULL,
  payment_currency text NOT NULL,
  base_currency text NOT NULL DEFAULT 'USD',
  gain_loss_amount numeric(18, 2) NOT NULL,
  gain_loss_percentage numeric(8, 4) NOT NULL,

  -- Additional context
  currency_pair text NOT NULL,
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  market_spread numeric(8, 4),
  notes text,

  -- Audit fields
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT positive_rates CHECK (
    customer_rate > 0 AND
    best_rate > 0 AND
    (revolut_rate IS NULL OR revolut_rate > 0) AND
    (ecb_rate IS NULL OR ecb_rate > 0) AND
    (bceao_rate IS NULL OR bceao_rate > 0)
  ),
  CONSTRAINT valid_currency_pair CHECK (currency_pair ~ '^[A-Z]{3}/[A-Z]{3}$')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fx_analysis_payment ON fx_rate_analysis(payment_id);
CREATE INDEX IF NOT EXISTS idx_fx_analysis_date ON fx_rate_analysis(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_fx_analysis_currency_pair ON fx_rate_analysis(currency_pair);
CREATE INDEX IF NOT EXISTS idx_fx_analysis_created ON fx_rate_analysis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fx_analysis_best_source ON fx_rate_analysis(best_rate_source);

-- Create composite index for reporting queries
CREATE INDEX IF NOT EXISTS idx_fx_analysis_date_pair ON fx_rate_analysis(analysis_date DESC, currency_pair);

-- Add foreign key constraint to payments table
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_fx_analysis_id_fkey;

ALTER TABLE payments
  ADD CONSTRAINT payments_fx_analysis_id_fkey
  FOREIGN KEY (fx_analysis_id) REFERENCES fx_rate_analysis(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE fx_rate_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "All authenticated users can view FX analysis"
  ON fx_rate_analysis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can insert FX analysis"
  ON fx_rate_analysis FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

CREATE POLICY "Management can update FX analysis"
  ON fx_rate_analysis FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

-- Create function to calculate FX gain/loss
CREATE OR REPLACE FUNCTION calculate_fx_gain_loss(
  p_amount numeric,
  p_customer_rate numeric,
  p_best_rate numeric
)
RETURNS TABLE (
  gain_loss_amount numeric,
  gain_loss_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (p_amount * p_best_rate) - (p_amount * p_customer_rate) as gain_loss_amount,
    (((p_best_rate - p_customer_rate) / p_customer_rate) * 100) as gain_loss_percentage;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to determine best rate from multiple sources
CREATE OR REPLACE FUNCTION determine_best_rate(
  p_customer_rate numeric,
  p_revolut_rate numeric,
  p_ecb_rate numeric,
  p_bceao_rate numeric,
  p_other_rate numeric
)
RETURNS TABLE (
  best_rate numeric,
  best_source text,
  worst_rate numeric,
  worst_source text
) AS $$
DECLARE
  rates_array numeric[];
  sources_array text[];
  best_idx integer;
  worst_idx integer;
BEGIN
  -- Build arrays of non-null rates and their sources
  rates_array := ARRAY[p_customer_rate];
  sources_array := ARRAY['Customer'];

  IF p_revolut_rate IS NOT NULL THEN
    rates_array := rates_array || p_revolut_rate;
    sources_array := sources_array || 'Revolut';
  END IF;

  IF p_ecb_rate IS NOT NULL THEN
    rates_array := rates_array || p_ecb_rate;
    sources_array := sources_array || 'ECB';
  END IF;

  IF p_bceao_rate IS NOT NULL THEN
    rates_array := rates_array || p_bceao_rate;
    sources_array := sources_array || 'BCEAO';
  END IF;

  IF p_other_rate IS NOT NULL THEN
    rates_array := rates_array || p_other_rate;
    sources_array := sources_array || 'Other';
  END IF;

  -- Find best (highest) rate
  SELECT idx INTO best_idx
  FROM unnest(rates_array) WITH ORDINALITY AS arr(rate, idx)
  ORDER BY rate DESC
  LIMIT 1;

  -- Find worst (lowest) rate
  SELECT idx INTO worst_idx
  FROM unnest(rates_array) WITH ORDINALITY AS arr(rate, idx)
  ORDER BY rate ASC
  LIMIT 1;

  RETURN QUERY
  SELECT
    rates_array[best_idx] as best_rate,
    sources_array[best_idx] as best_source,
    rates_array[worst_idx] as worst_rate,
    sources_array[worst_idx] as worst_source;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_fx_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fx_analysis_updated_at
  BEFORE UPDATE ON fx_rate_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_fx_analysis_updated_at();

-- Create view for FX analysis with payment details
CREATE OR REPLACE VIEW fx_analysis_with_details AS
SELECT
  fxa.id as analysis_id,
  fxa.payment_id,
  fxa.customer_rate,
  fxa.revolut_rate,
  fxa.ecb_rate,
  fxa.bceao_rate,
  fxa.best_rate,
  fxa.best_rate_source,
  fxa.worst_rate,
  fxa.worst_rate_source,
  fxa.amount_paid,
  fxa.payment_currency,
  fxa.base_currency,
  fxa.gain_loss_amount,
  fxa.gain_loss_percentage,
  fxa.currency_pair,
  fxa.analysis_date,
  fxa.market_spread,
  fxa.notes as analysis_notes,
  fxa.created_at as analysis_created_at,

  -- Payment information
  p.sale_id,
  p.amount as payment_amount,
  p.actual_date as payment_date,
  p.reference_number as payment_reference,
  p.status as payment_status,

  -- Sale information
  s.sale_number,
  s.customer_id,
  s.seller_id,
  s.seller_type,
  s.quantity_oz,
  s.status as sale_status,

  -- Customer information
  c.name as customer_name,
  c.country as customer_country,

  -- Creator information
  u.email as created_by_email

FROM fx_rate_analysis fxa
INNER JOIN payments p ON fxa.payment_id = p.id
INNER JOIN sales s ON p.sale_id = s.id
INNER JOIN customers c ON s.customer_id = c.id
LEFT JOIN auth.users u ON fxa.created_by = u.id;

-- Grant access to view
GRANT SELECT ON fx_analysis_with_details TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE fx_rate_analysis IS 'FX rate comparison and analysis for payment transactions showing gain/loss vs market rates';
COMMENT ON COLUMN fx_rate_analysis.customer_rate IS 'Exchange rate used by the customer for payment';
COMMENT ON COLUMN fx_rate_analysis.best_rate IS 'Best (highest) rate among all sources at time of payment';
COMMENT ON COLUMN fx_rate_analysis.gain_loss_amount IS 'Financial gain or loss vs best available rate (positive = loss, negative = gain)';
COMMENT ON FUNCTION calculate_fx_gain_loss IS 'Calculates financial impact of FX rate difference';
COMMENT ON FUNCTION determine_best_rate IS 'Determines best and worst rates from multiple sources';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'FX rate analysis table created with comparison and calculation functions';
END $$;
