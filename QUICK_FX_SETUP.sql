-- ============================================================================
-- QUICK FX ANALYSIS SETUP
-- Copy and paste this ENTIRE file into Supabase SQL Editor and run it
-- ============================================================================

-- This combines the two migration files into one for easy setup
-- It will create all FX tables and add 3 months of sample data

-- First, check if tables already exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_fx_rates') THEN
    RAISE NOTICE '⚠️  FX tables already exist. Skipping creation.';
    RAISE NOTICE 'If you want to recreate, drop the tables first:';
    RAISE NOTICE '  DROP TABLE IF EXISTS customer_fx_rates CASCADE;';
    RAISE NOTICE '  DROP TABLE IF EXISTS fx_rates_monthly_aggregated CASCADE;';
    RAISE NOTICE '  DROP TABLE IF EXISTS fx_rates_daily CASCADE;';
    RAISE NOTICE '  DROP TABLE IF EXISTS fx_rate_sources CASCADE;';
  ELSE
    RAISE NOTICE '📊 Creating FX tables and adding sample data...';
  END IF;
END $$;

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

-- Enable RLS
ALTER TABLE fx_rate_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates_monthly_aggregated ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_fx_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "All authenticated users can view FX rate sources"
  ON fx_rate_sources FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "All authenticated users can view daily FX rates"
  ON fx_rates_daily FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "All authenticated users can view monthly FX rates"
  ON fx_rates_monthly_aggregated FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "All authenticated users can view customer FX rates"
  ON customer_fx_rates FOR SELECT TO authenticated USING (true);

-- Insert FX rate sources
INSERT INTO fx_rate_sources (name, code, api_url, description, is_active) VALUES
  ('European Central Bank', 'ECB', 'https://api.exchangerate.host/latest', 'Official ECB exchange rates', true),
  ('Revolut', 'REVOLUT', NULL, 'Revolut exchange rates', true),
  ('Market Rate', 'MARKET', NULL, 'General market rates', true),
  ('Bank of Guinea', 'BCG', NULL, 'Central Bank of Guinea official rates', true)
ON CONFLICT (code) DO NOTHING;

-- Insert sample customers
INSERT INTO customers (name, email, phone, company, country, is_active) VALUES
  ('Auramet Trading LLC', 'trading@auramet.com', '+1-212-555-0100', 'Auramet International', 'US', true),
  ('Emirates Gold DMCC', 'operations@emiratesgold.ae', '+971-4-555-0200', 'Emirates Gold', 'AE', true),
  ('Swiss Gold Traders SA', 'contact@swissgold.ch', '+41-22-555-0300', 'Swiss Gold Traders', 'CH', true),
  ('African Precious Metals', 'info@africanpm.ci', '+225-27-555-0400', 'APM Group', 'CI', true)
ON CONFLICT (email) DO NOTHING;

-- Insert 3 months of daily rates
DO $$
DECLARE
  v_ecb_source_id uuid;
  v_revolut_source_id uuid;
  v_date date;
  v_base_rate numeric;
BEGIN
  SELECT id INTO v_ecb_source_id FROM fx_rate_sources WHERE code = 'ECB';
  SELECT id INTO v_revolut_source_id FROM fx_rate_sources WHERE code = 'REVOLUT';

  -- August 2024
  FOR i IN 1..31 LOOP
    v_date := '2024-08-01'::date + (i - 1);
    v_base_rate := 1.0850 + (random() * 0.015 - 0.0075);
    
    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES 
        (v_date, 'EUR/USD', v_ecb_source_id, v_base_rate, v_base_rate - 0.0002, v_base_rate + 0.0002, 0.0004),
        (v_date, 'EUR/USD', v_revolut_source_id, v_base_rate - 0.0008, v_base_rate - 0.0010, v_base_rate - 0.0006, 0.0004)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- September 2024
  FOR i IN 1..30 LOOP
    v_date := '2024-09-01'::date + (i - 1);
    v_base_rate := 1.0920 + (random() * 0.018 - 0.009);
    
    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES 
        (v_date, 'EUR/USD', v_ecb_source_id, v_base_rate, v_base_rate - 0.0002, v_base_rate + 0.0002, 0.0004),
        (v_date, 'EUR/USD', v_revolut_source_id, v_base_rate - 0.0009, v_base_rate - 0.0011, v_base_rate - 0.0007, 0.0004)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- October 2024
  FOR i IN 1..31 LOOP
    v_date := '2024-10-01'::date + (i - 1);
    v_base_rate := 1.0880 + (random() * 0.020 - 0.010);
    
    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES 
        (v_date, 'EUR/USD', v_ecb_source_id, v_base_rate, v_base_rate - 0.0002, v_base_rate + 0.0002, 0.0004),
        (v_date, 'EUR/USD', v_revolut_source_id, v_base_rate - 0.0010, v_base_rate - 0.0012, v_base_rate - 0.0008, 0.0004)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Added ~180 daily FX rates (Aug-Oct 2024)';
END $$;

-- Insert customer transactions
DO $$
DECLARE
  v_auramet_id uuid;
  v_emirates_id uuid;
  v_ecb_source_id uuid;
  v_ecb_rate numeric;
BEGIN
  SELECT id INTO v_auramet_id FROM customers WHERE email = 'trading@auramet.com';
  SELECT id INTO v_emirates_id FROM customers WHERE email = 'operations@emiratesgold.ae';
  SELECT id INTO v_ecb_source_id FROM fx_rate_sources WHERE code = 'ECB';

  -- Oct 6: Auramet payment
  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id, '2024-10-06', 'EUR/USD', 0.8517, 1647428.90, 0.8562,
    ((0.8517 - 0.8562) / 0.8562 * 100), 'AUR-2024-10-001', 'payment',
    'USD 1,647,428.90 paid, EUR 1,403,103.00 received at rate 0.8517'
  );

  -- Oct 20: Auramet payment
  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id, '2024-10-20', 'EUR/USD', 0.8568, 2077722.90, 0.8579,
    ((0.8568 - 0.8579) / 0.8579 * 100), 'AUR-2024-10-002', 'payment',
    'USD 2,077,722.90 paid, EUR 1,780,244.11 received at rate 0.8568'
  );

  -- Aug 15: Emirates payment
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-08-15' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_emirates_id, '2024-08-15', 'EUR/USD', v_ecb_rate - 0.0002, 2250000.00, v_ecb_rate,
    (((v_ecb_rate - 0.0002) - v_ecb_rate) / v_ecb_rate * 100), 'EMI-2024-08-001', 'payment',
    'Silver shipment payment'
  );

  RAISE NOTICE '✅ Added 3+ customer FX transactions';
END $$;

-- Final verification
DO $$
DECLARE
  v_rate_count integer;
  v_tx_count integer;
BEGIN
  SELECT COUNT(*) INTO v_rate_count FROM fx_rates_daily;
  SELECT COUNT(*) INTO v_tx_count FROM customer_fx_rates;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FX ANALYSIS SETUP COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Daily FX rates: %', v_rate_count;
  RAISE NOTICE 'Customer transactions: %', v_tx_count;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Navigate to /prices/fx-rates and click "FX Rate Analysis" tab';
  RAISE NOTICE '   Data will load automatically!';
  RAISE NOTICE '========================================';
END $$;
