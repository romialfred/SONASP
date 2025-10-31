/*
  # Ensure FX Rate Analysis Table Exists

  1. Purpose
    - Create or verify fx_rate_analysis table
    - Store comparative analysis of FX rates from multiple sources
    - Track gain/loss vs best available rates

  2. Table Structure
    - Links to payments table
    - Stores rates from multiple sources (customer, Revolut, ECB, BCEAO)
    - Calculates best rate and financial impact
    - Tracks currency pairs and analysis date

  3. Security
    - RLS enabled
    - Authenticated users can view
    - Only management can insert/update
*/

-- Create fx_rate_analysis table if it doesn't exist
CREATE TABLE IF NOT EXISTS fx_rate_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

  -- Virtual payment information for reference
  virtual_payment_amount numeric(18, 2),
  virtual_payment_currency text,

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

  -- Financial impact calculation
  amount_with_customer_rate numeric(18, 2) NOT NULL,
  amount_with_best_rate numeric(18, 2) NOT NULL,
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
    (bceao_rate IS NULL OR bceao_rate > 0) AND
    (other_rate IS NULL OR other_rate > 0)
  ),
  CONSTRAINT valid_currency_pair CHECK (currency_pair ~ '^[A-Z]{3}/[A-Z]{3}$'),
  CONSTRAINT valid_amounts CHECK (
    (virtual_payment_amount IS NULL OR virtual_payment_amount > 0) AND
    amount_with_customer_rate > 0 AND
    amount_with_best_rate > 0
  )
);

-- Drop existing constraints that might block column additions
DO $$
BEGIN
  ALTER TABLE fx_rate_analysis DROP CONSTRAINT IF EXISTS valid_amounts;
  ALTER TABLE fx_rate_analysis DROP CONSTRAINT IF EXISTS positive_rates;
  RAISE NOTICE 'Dropped existing constraints to allow column additions';
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Add ALL missing columns if table already exists
DO $$
DECLARE
  v_column_count integer;
BEGIN
  -- Check if table exists and count columns
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_name = 'fx_rate_analysis';

  RAISE NOTICE 'fx_rate_analysis table has % columns', v_column_count;

  -- Add each column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'virtual_payment_amount') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN virtual_payment_amount numeric(18, 2);
    RAISE NOTICE 'Added column: virtual_payment_amount';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'virtual_payment_currency') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN virtual_payment_currency text;
    RAISE NOTICE 'Added column: virtual_payment_currency';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'amount_with_customer_rate') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN amount_with_customer_rate numeric(18, 2) NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added column: amount_with_customer_rate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'amount_with_best_rate') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN amount_with_best_rate numeric(18, 2) NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added column: amount_with_best_rate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'gain_loss_amount') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN gain_loss_amount numeric(18, 2) NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added column: gain_loss_amount';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'gain_loss_percentage') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN gain_loss_percentage numeric(8, 4) NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added column: gain_loss_percentage';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'best_rate') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN best_rate numeric(18, 6) NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added column: best_rate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'best_rate_source') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN best_rate_source text NOT NULL DEFAULT 'Unknown';
    RAISE NOTICE 'Added column: best_rate_source';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'worst_rate') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN worst_rate numeric(18, 6);
    RAISE NOTICE 'Added column: worst_rate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'worst_rate_source') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN worst_rate_source text;
    RAISE NOTICE 'Added column: worst_rate_source';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fx_rate_analysis' AND column_name = 'market_spread') THEN
    ALTER TABLE fx_rate_analysis ADD COLUMN market_spread numeric(8, 4);
    RAISE NOTICE 'Added column: market_spread';
  END IF;

  RAISE NOTICE 'All missing columns added to fx_rate_analysis';
END $$;

-- Re-add constraints after all columns exist
DO $$
BEGIN
  -- Drop old constraints first if they exist
  ALTER TABLE fx_rate_analysis DROP CONSTRAINT IF EXISTS valid_amounts;
  ALTER TABLE fx_rate_analysis DROP CONSTRAINT IF EXISTS positive_rates;

  -- Add constraints back
  ALTER TABLE fx_rate_analysis ADD CONSTRAINT positive_rates CHECK (
    customer_rate > 0 AND
    best_rate > 0 AND
    (revolut_rate IS NULL OR revolut_rate > 0) AND
    (ecb_rate IS NULL OR ecb_rate > 0) AND
    (bceao_rate IS NULL OR bceao_rate > 0) AND
    (other_rate IS NULL OR other_rate > 0)
  );

  ALTER TABLE fx_rate_analysis ADD CONSTRAINT valid_amounts CHECK (
    (virtual_payment_amount IS NULL OR virtual_payment_amount > 0) AND
    amount_with_customer_rate > 0 AND
    amount_with_best_rate > 0
  );

  RAISE NOTICE 'Constraints re-added to fx_rate_analysis';
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Error adding constraints: %', SQLERRM;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fx_analysis_payment ON fx_rate_analysis(payment_id);
CREATE INDEX IF NOT EXISTS idx_fx_analysis_date ON fx_rate_analysis(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_fx_analysis_currency_pair ON fx_rate_analysis(currency_pair);
CREATE INDEX IF NOT EXISTS idx_fx_analysis_created ON fx_rate_analysis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fx_analysis_best_source ON fx_rate_analysis(best_rate_source);
CREATE INDEX IF NOT EXISTS idx_fx_analysis_date_pair ON fx_rate_analysis(analysis_date DESC, currency_pair);

-- Add foreign key constraint from payments to fx_rate_analysis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_fx_analysis_id_fkey'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_fx_analysis_id_fkey
      FOREIGN KEY (fx_analysis_id) REFERENCES fx_rate_analysis(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE fx_rate_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "All authenticated users can view FX analysis" ON fx_rate_analysis;
  DROP POLICY IF EXISTS "Management can insert FX analysis" ON fx_rate_analysis;
  DROP POLICY IF EXISTS "Management can update FX analysis" ON fx_rate_analysis;

  -- Create policies
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
END $$;

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
CREATE OR REPLACE FUNCTION determine_best_fx_rate(
  p_customer_rate numeric,
  p_revolut_rate numeric DEFAULT NULL,
  p_ecb_rate numeric DEFAULT NULL,
  p_bceao_rate numeric DEFAULT NULL,
  p_other_rate numeric DEFAULT NULL
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

  -- Find best (highest) rate for conversion to base currency
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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_fx_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_fx_analysis_updated_at ON fx_rate_analysis;
CREATE TRIGGER update_fx_analysis_updated_at
  BEFORE UPDATE ON fx_rate_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_fx_analysis_updated_at();

-- Create comprehensive view for FX analysis with payment and sale details
CREATE OR REPLACE VIEW fx_analysis_with_details AS
SELECT
  fxa.id as analysis_id,
  fxa.payment_id,
  fxa.virtual_payment_amount,
  fxa.virtual_payment_currency,
  fxa.customer_rate,
  fxa.revolut_rate,
  fxa.ecb_rate,
  fxa.bceao_rate,
  fxa.other_rate,
  fxa.other_rate_source,
  fxa.best_rate,
  fxa.best_rate_source,
  fxa.worst_rate,
  fxa.worst_rate_source,
  fxa.amount_with_customer_rate,
  fxa.amount_with_best_rate,
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
  p.payment_type,

  -- Sale information
  s.sale_number,
  s.customer_id,
  s.quantity_oz,
  s.status as sale_status,
  s.gross_proceeds,
  s.net_proceeds,
  s.final_proceeds,

  -- Customer information
  c.name as customer_name,
  c.country as customer_country,
  c.email as customer_email,

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
COMMENT ON TABLE fx_rate_analysis IS 'FX rate comparison and analysis for payment transactions showing gain/loss vs market rates from multiple sources';
COMMENT ON COLUMN fx_rate_analysis.customer_rate IS 'Exchange rate used by the customer for payment';
COMMENT ON COLUMN fx_rate_analysis.best_rate IS 'Best (highest) rate among all sources at time of payment';
COMMENT ON COLUMN fx_rate_analysis.gain_loss_amount IS 'Financial gain or loss vs best available rate (positive = loss/opportunity cost, negative = gain)';
COMMENT ON COLUMN fx_rate_analysis.virtual_payment_amount IS 'Amount of the virtual payment created as reference';
COMMENT ON FUNCTION calculate_fx_gain_loss IS 'Calculates financial impact of FX rate difference between customer rate and best available rate';
COMMENT ON FUNCTION determine_best_fx_rate IS 'Determines best and worst rates from multiple sources (Revolut, ECB, BCEAO, customer)';
COMMENT ON VIEW fx_analysis_with_details IS 'Complete FX analysis with related payment, sale, and customer information';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'FX rate analysis table ensured successfully';
  RAISE NOTICE 'Helper functions created for rate comparison and calculations';
  RAISE NOTICE 'Comprehensive view created for reporting';
END $$;
