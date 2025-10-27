/*
  # Create Comprehensive FX Rates System

  1. Purpose
    - Track daily FX rates from multiple sources
    - Support multiple currency pairs (EUR/USD, USD/XOF, USD/GNF, EUR/GNF, XOF/GNF)
    - Track customer-specific rates paid
    - Monthly aggregated rates for reporting

  2. New Tables
    - `fx_rate_sources` - Rate data sources (ECB, Revolut, etc.)
    - `fx_rates_daily` - Daily exchange rates by source
    - `fx_rates_monthly_aggregated` - Monthly average rates
    - `customer_fx_rates` - Customer-specific rates paid

  3. Currency Pairs Supported
    - EUR/USD - Euro to US Dollar
    - USD/XOF - US Dollar to West African CFA Franc
    - USD/GNF - US Dollar to Guinean Franc
    - EUR/GNF - Euro to Guinean Franc
    - XOF/GNF - West African CFA to Guinean Franc

  4. Security
    - RLS enabled on all tables
    - Authenticated users can view rates
    - Only management can create/update rates
*/

-- Create FX rate sources table
CREATE TABLE IF NOT EXISTS fx_rate_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  api_url text,
  is_active boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create daily FX rates table
CREATE TABLE IF NOT EXISTS fx_rates_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date NOT NULL,
  currency_pair text NOT NULL CHECK (currency_pair IN ('EUR/USD', 'USD/XOF', 'USD/GNF', 'EUR/GNF', 'XOF/GNF')),
  source_id uuid REFERENCES fx_rate_sources(id) ON DELETE CASCADE,
  rate numeric(18, 6) NOT NULL,
  bid_rate numeric(18, 6),
  ask_rate numeric(18, 6),
  spread numeric(18, 6),
  volume numeric(18, 2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rate_date, currency_pair, source_id)
);

-- Create monthly aggregated FX rates table
CREATE TABLE IF NOT EXISTS fx_rates_monthly_aggregated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  currency_pair text NOT NULL CHECK (currency_pair IN ('EUR/USD', 'USD/XOF', 'USD/GNF', 'EUR/GNF', 'XOF/GNF')),
  source_id uuid REFERENCES fx_rate_sources(id) ON DELETE CASCADE,
  avg_rate numeric(18, 6) NOT NULL,
  min_rate numeric(18, 6) NOT NULL,
  max_rate numeric(18, 6) NOT NULL,
  opening_rate numeric(18, 6),
  closing_rate numeric(18, 6),
  total_volume numeric(18, 2),
  data_points integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year, month, currency_pair, source_id)
);

-- Create customer FX rates table
CREATE TABLE IF NOT EXISTS customer_fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  currency_pair text NOT NULL CHECK (currency_pair IN ('EUR/USD', 'USD/XOF', 'USD/GNF', 'EUR/GNF', 'XOF/GNF')),
  rate_paid numeric(18, 6) NOT NULL,
  amount numeric(18, 2) NOT NULL,
  transaction_type text CHECK (transaction_type IN ('payment', 'sale', 'transfer')),
  reference_number text,
  market_rate numeric(18, 6),
  spread_percentage numeric(5, 3),
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fx_rates_daily_date ON fx_rates_daily(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_fx_rates_daily_pair ON fx_rates_daily(currency_pair);
CREATE INDEX IF NOT EXISTS idx_fx_rates_daily_source ON fx_rates_daily(source_id);
CREATE INDEX IF NOT EXISTS idx_fx_rates_daily_date_pair ON fx_rates_daily(rate_date, currency_pair);

CREATE INDEX IF NOT EXISTS idx_fx_rates_monthly_year_month ON fx_rates_monthly_aggregated(year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_fx_rates_monthly_pair ON fx_rates_monthly_aggregated(currency_pair);
CREATE INDEX IF NOT EXISTS idx_fx_rates_monthly_source ON fx_rates_monthly_aggregated(source_id);

CREATE INDEX IF NOT EXISTS idx_customer_fx_rates_customer ON customer_fx_rates(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_fx_rates_date ON customer_fx_rates(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_fx_rates_pair ON customer_fx_rates(currency_pair);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_fx_rate_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fx_rate_sources_updated_at
  BEFORE UPDATE ON fx_rate_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_fx_rate_sources_updated_at();

CREATE OR REPLACE FUNCTION update_fx_rates_daily_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fx_rates_daily_updated_at
  BEFORE UPDATE ON fx_rates_daily
  FOR EACH ROW
  EXECUTE FUNCTION update_fx_rates_daily_updated_at();

CREATE OR REPLACE FUNCTION update_fx_rates_monthly_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fx_rates_monthly_updated_at
  BEFORE UPDATE ON fx_rates_monthly_aggregated
  FOR EACH ROW
  EXECUTE FUNCTION update_fx_rates_monthly_updated_at();

CREATE OR REPLACE FUNCTION update_customer_fx_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customer_fx_rates_updated_at
  BEFORE UPDATE ON customer_fx_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_fx_rates_updated_at();

-- Enable RLS on all tables
ALTER TABLE fx_rate_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates_monthly_aggregated ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_fx_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fx_rate_sources
CREATE POLICY "All authenticated users can view FX rate sources"
  ON fx_rate_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can manage FX rate sources"
  ON fx_rate_sources FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for fx_rates_daily
CREATE POLICY "All authenticated users can view daily FX rates"
  ON fx_rates_daily FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can manage daily FX rates"
  ON fx_rates_daily FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for fx_rates_monthly_aggregated
CREATE POLICY "All authenticated users can view monthly FX rates"
  ON fx_rates_monthly_aggregated FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can manage monthly FX rates"
  ON fx_rates_monthly_aggregated FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for customer_fx_rates
CREATE POLICY "All authenticated users can view customer FX rates"
  ON customer_fx_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can manage customer FX rates"
  ON customer_fx_rates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
      AND user_profiles.is_active = true
    )
  );

-- Insert FX rate sources
INSERT INTO fx_rate_sources (name, code, api_url, description, is_active) VALUES
  ('European Central Bank', 'ECB', 'https://api.exchangerate.host/latest', 'Official ECB exchange rates', true),
  ('Revolut', 'REVOLUT', NULL, 'Revolut exchange rates', true),
  ('Market Rate', 'MARKET', NULL, 'General market rates', true),
  ('Bank of Guinea', 'BCG', NULL, 'Central Bank of Guinea official rates', true)
ON CONFLICT (code) DO NOTHING;

-- Function to calculate monthly aggregates from daily rates
CREATE OR REPLACE FUNCTION calculate_monthly_fx_aggregates(
  p_year integer,
  p_month integer
)
RETURNS void AS $$
DECLARE
  v_source_id uuid;
  v_currency_pair text;
BEGIN
  -- Loop through each source and currency pair
  FOR v_source_id, v_currency_pair IN
    SELECT DISTINCT source_id, currency_pair
    FROM fx_rates_daily
    WHERE EXTRACT(YEAR FROM rate_date) = p_year
    AND EXTRACT(MONTH FROM rate_date) = p_month
  LOOP
    -- Insert or update monthly aggregate
    INSERT INTO fx_rates_monthly_aggregated (
      year,
      month,
      currency_pair,
      source_id,
      avg_rate,
      min_rate,
      max_rate,
      opening_rate,
      closing_rate,
      total_volume,
      data_points
    )
    SELECT
      p_year,
      p_month,
      currency_pair,
      source_id,
      AVG(rate),
      MIN(rate),
      MAX(rate),
      (SELECT rate FROM fx_rates_daily
       WHERE source_id = v_source_id
       AND currency_pair = v_currency_pair
       AND EXTRACT(YEAR FROM rate_date) = p_year
       AND EXTRACT(MONTH FROM rate_date) = p_month
       ORDER BY rate_date ASC LIMIT 1),
      (SELECT rate FROM fx_rates_daily
       WHERE source_id = v_source_id
       AND currency_pair = v_currency_pair
       AND EXTRACT(YEAR FROM rate_date) = p_year
       AND EXTRACT(MONTH FROM rate_date) = p_month
       ORDER BY rate_date DESC LIMIT 1),
      SUM(COALESCE(volume, 0)),
      COUNT(*)
    FROM fx_rates_daily
    WHERE source_id = v_source_id
    AND currency_pair = v_currency_pair
    AND EXTRACT(YEAR FROM rate_date) = p_year
    AND EXTRACT(MONTH FROM rate_date) = p_month
    GROUP BY currency_pair, source_id
    ON CONFLICT (year, month, currency_pair, source_id) DO UPDATE SET
      avg_rate = EXCLUDED.avg_rate,
      min_rate = EXCLUDED.min_rate,
      max_rate = EXCLUDED.max_rate,
      opening_rate = EXCLUDED.opening_rate,
      closing_rate = EXCLUDED.closing_rate,
      total_volume = EXCLUDED.total_volume,
      data_points = EXCLUDED.data_points,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Insert sample daily FX rates for the last 30 days
DO $$
DECLARE
  v_ecb_source_id uuid;
  v_revolut_source_id uuid;
  v_date date;
  v_day_offset integer;
BEGIN
  -- Get source IDs
  SELECT id INTO v_ecb_source_id FROM fx_rate_sources WHERE code = 'ECB';
  SELECT id INTO v_revolut_source_id FROM fx_rate_sources WHERE code = 'REVOLUT';

  -- Insert rates for last 30 days
  FOR v_day_offset IN 0..29 LOOP
    v_date := CURRENT_DATE - v_day_offset;

    -- EUR/USD rates
    INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread) VALUES
      (v_date, 'EUR/USD', v_ecb_source_id, 1.09 + (random() * 0.02 - 0.01), 1.089, 1.091, 0.002),
      (v_date, 'EUR/USD', v_revolut_source_id, 1.088 + (random() * 0.02 - 0.01), 1.087, 1.089, 0.002)
    ON CONFLICT DO NOTHING;

    -- USD/XOF rates (West African CFA)
    INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread) VALUES
      (v_date, 'USD/XOF', v_ecb_source_id, 605 + (random() * 10 - 5), 603, 607, 4),
      (v_date, 'USD/XOF', v_revolut_source_id, 608 + (random() * 10 - 5), 606, 610, 4)
    ON CONFLICT DO NOTHING;

    -- USD/GNF rates (Guinean Franc)
    INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread) VALUES
      (v_date, 'USD/GNF', v_ecb_source_id, 8600 + (random() * 100 - 50), 8580, 8620, 40),
      (v_date, 'USD/GNF', v_revolut_source_id, 8650 + (random() * 100 - 50), 8630, 8670, 40)
    ON CONFLICT DO NOTHING;

    -- EUR/GNF rates
    INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread) VALUES
      (v_date, 'EUR/GNF', v_ecb_source_id, 9374 + (random() * 150 - 75), 9350, 9400, 50),
      (v_date, 'EUR/GNF', v_revolut_source_id, 9420 + (random() * 150 - 75), 9395, 9445, 50)
    ON CONFLICT DO NOTHING;

    -- XOF/GNF rates
    INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread) VALUES
      (v_date, 'XOF/GNF', v_ecb_source_id, 14.21 + (random() * 0.5 - 0.25), 14.15, 14.27, 0.12),
      (v_date, 'XOF/GNF', v_revolut_source_id, 14.25 + (random() * 0.5 - 0.25), 14.19, 14.31, 0.12)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Inserted daily FX rates for last 30 days';

  -- Calculate monthly aggregates for current and previous month
  PERFORM calculate_monthly_fx_aggregates(
    EXTRACT(YEAR FROM CURRENT_DATE)::integer,
    EXTRACT(MONTH FROM CURRENT_DATE)::integer
  );

  PERFORM calculate_monthly_fx_aggregates(
    EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')::integer,
    EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')::integer
  );

  RAISE NOTICE 'Calculated monthly aggregates';
END $$;
