/*
  # Add FX Rate Analysis - Customer Transaction Data

  1. Purpose
    - Add comprehensive customer FX transaction data for analysis
    - Track customer rates vs ECB and Revolut rates
    - Enable comparative analysis and recommendations
    - Populate 3 months of realistic transaction data

  2. Data Added
    - Customer payment transactions with FX rates used
    - Corresponding ECB and Revolut rates for each date
    - Multiple customers and currencies
    - Realistic amounts and spreads

  3. Analysis Features
    - Compare customer rates with ECB spot rates
    - Compare customer rates with Revolut rates
    - Calculate opportunity cost/benefit
    - Generate automatic commentary
    - Provide dynamic recommendations
*/

-- First, ensure we have customers to work with
INSERT INTO customers (name, email, phone, company, country, is_active) VALUES
  ('Auramet Trading LLC', 'trading@auramet.com', '+1-212-555-0100', 'Auramet International', 'US', true),
  ('Emirates Gold DMCC', 'operations@emiratesgold.ae', '+971-4-555-0200', 'Emirates Gold', 'AE', true),
  ('Swiss Gold Traders SA', 'contact@swissgold.ch', '+41-22-555-0300', 'Swiss Gold Traders', 'CH', true),
  ('African Precious Metals', 'info@africanpm.ci', '+225-27-555-0400', 'APM Group', 'CI', true)
ON CONFLICT (email) DO NOTHING;

-- Insert 3 months of FX rates for ECB and Revolut (August, September, October 2024)
DO $$
DECLARE
  v_ecb_source_id uuid;
  v_revolut_source_id uuid;
  v_date date;
  v_base_eur_usd numeric;
  v_base_usd_xof numeric;
  v_base_usd_gnf numeric;
BEGIN
  -- Get source IDs
  SELECT id INTO v_ecb_source_id FROM fx_rate_sources WHERE code = 'ECB';
  SELECT id INTO v_revolut_source_id FROM fx_rate_sources WHERE code = 'REVOLUT';

  -- August 2024 (31 days)
  FOR i IN 1..31 LOOP
    v_date := '2024-08-01'::date + (i - 1);
    v_base_eur_usd := 1.0850 + (random() * 0.015 - 0.0075);
    v_base_usd_xof := 605 + (random() * 8 - 4);
    v_base_usd_gnf := 8600 + (random() * 80 - 40);

    -- Skip weekends
    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      -- ECB EUR/USD
      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'EUR/USD', v_ecb_source_id, v_base_eur_usd, v_base_eur_usd - 0.0002, v_base_eur_usd + 0.0002, 0.0004)
      ON CONFLICT DO NOTHING;

      -- Revolut EUR/USD (slightly different)
      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'EUR/USD', v_revolut_source_id, v_base_eur_usd - 0.0008, v_base_eur_usd - 0.0010, v_base_eur_usd - 0.0006, 0.0004)
      ON CONFLICT DO NOTHING;

      -- USD/XOF rates
      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/XOF', v_ecb_source_id, v_base_usd_xof, v_base_usd_xof - 2, v_base_usd_xof + 2, 4)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/XOF', v_revolut_source_id, v_base_usd_xof + 3, v_base_usd_xof + 1, v_base_usd_xof + 5, 4)
      ON CONFLICT DO NOTHING;

      -- USD/GNF rates
      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/GNF', v_ecb_source_id, v_base_usd_gnf, v_base_usd_gnf - 20, v_base_usd_gnf + 20, 40)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/GNF', v_revolut_source_id, v_base_usd_gnf + 50, v_base_usd_gnf + 30, v_base_usd_gnf + 70, 40)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- September 2024 (30 days)
  FOR i IN 1..30 LOOP
    v_date := '2024-09-01'::date + (i - 1);
    v_base_eur_usd := 1.0920 + (random() * 0.018 - 0.009);
    v_base_usd_xof := 608 + (random() * 10 - 5);
    v_base_usd_gnf := 8650 + (random() * 100 - 50);

    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'EUR/USD', v_ecb_source_id, v_base_eur_usd, v_base_eur_usd - 0.0002, v_base_eur_usd + 0.0002, 0.0004)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'EUR/USD', v_revolut_source_id, v_base_eur_usd - 0.0009, v_base_eur_usd - 0.0011, v_base_eur_usd - 0.0007, 0.0004)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/XOF', v_ecb_source_id, v_base_usd_xof, v_base_usd_xof - 2, v_base_usd_xof + 2, 4)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/XOF', v_revolut_source_id, v_base_usd_xof + 3, v_base_usd_xof + 1, v_base_usd_xof + 5, 4)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/GNF', v_ecb_source_id, v_base_usd_gnf, v_base_usd_gnf - 20, v_base_usd_gnf + 20, 40)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/GNF', v_revolut_source_id, v_base_usd_gnf + 50, v_base_usd_gnf + 30, v_base_usd_gnf + 70, 40)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- October 2024 (31 days)
  FOR i IN 1..31 LOOP
    v_date := '2024-10-01'::date + (i - 1);
    v_base_eur_usd := 1.0880 + (random() * 0.020 - 0.010);
    v_base_usd_xof := 603 + (random() * 12 - 6);
    v_base_usd_gnf := 8580 + (random() * 120 - 60);

    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'EUR/USD', v_ecb_source_id, v_base_eur_usd, v_base_eur_usd - 0.0002, v_base_eur_usd + 0.0002, 0.0004)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'EUR/USD', v_revolut_source_id, v_base_eur_usd - 0.0010, v_base_eur_usd - 0.0012, v_base_eur_usd - 0.0008, 0.0004)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/XOF', v_ecb_source_id, v_base_usd_xof, v_base_usd_xof - 2, v_base_usd_xof + 2, 4)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/XOF', v_revolut_source_id, v_base_usd_xof + 3, v_base_usd_xof + 1, v_base_usd_xof + 5, 4)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/GNF', v_ecb_source_id, v_base_usd_gnf, v_base_usd_gnf - 20, v_base_usd_gnf + 20, 40)
      ON CONFLICT DO NOTHING;

      INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, spread)
      VALUES (v_date, 'USD/GNF', v_revolut_source_id, v_base_usd_gnf + 50, v_base_usd_gnf + 30, v_base_usd_gnf + 70, 40)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE '3 months of FX rates added for ECB and Revolut';
END $$;

-- Insert customer FX transactions (realistic payment scenarios)
DO $$
DECLARE
  v_auramet_id uuid;
  v_emirates_id uuid;
  v_swiss_id uuid;
  v_african_id uuid;
  v_ecb_source_id uuid;
  v_revolut_source_id uuid;
  v_ecb_rate numeric;
  v_revolut_rate numeric;
  v_customer_rate numeric;
BEGIN
  -- Get customer IDs
  SELECT id INTO v_auramet_id FROM customers WHERE email = 'trading@auramet.com';
  SELECT id INTO v_emirates_id FROM customers WHERE email = 'operations@emiratesgold.ae';
  SELECT id INTO v_swiss_id FROM customers WHERE email = 'contact@swissgold.ch';
  SELECT id INTO v_african_id FROM customers WHERE email = 'info@africanpm.ci';

  -- Get source IDs
  SELECT id INTO v_ecb_source_id FROM fx_rate_sources WHERE code = 'ECB';
  SELECT id INTO v_revolut_source_id FROM fx_rate_sources WHERE code = 'REVOLUT';

  -- AUGUST Transactions
  -- Aug 6: Auramet payment (worse than spot)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-08-06' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;
  SELECT rate INTO v_revolut_rate FROM fx_rates_daily
  WHERE rate_date = '2024-08-06' AND currency_pair = 'EUR/USD' AND source_id = v_revolut_source_id;

  v_customer_rate := v_ecb_rate - 0.0045;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id,
    '2024-08-06',
    'EUR/USD',
    v_customer_rate,
    1647428.90,
    v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'AUR-2024-08-001',
    'payment',
    'Gold sale payment - USD to EUR conversion'
  );

  -- Aug 15: Emirates payment (better than Revolut)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-08-15' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;
  SELECT rate INTO v_revolut_rate FROM fx_rates_daily
  WHERE rate_date = '2024-08-15' AND currency_pair = 'EUR/USD' AND source_id = v_revolut_source_id;

  v_customer_rate := v_ecb_rate - 0.0002;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_emirates_id,
    '2024-08-15',
    'EUR/USD',
    v_customer_rate,
    2250000.00,
    v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'EMI-2024-08-001',
    'payment',
    'Silver shipment payment'
  );

  -- Aug 23: Swiss payment (close to spot)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-08-23' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;

  v_customer_rate := v_ecb_rate - 0.0008;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_swiss_id,
    '2024-08-23',
    'EUR/USD',
    v_customer_rate,
    1890000.00,
    v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'SUI-2024-08-001',
    'payment',
    'Gold refining payment'
  );

  -- SEPTEMBER Transactions
  -- Sept 5: Auramet payment (worse than both)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-09-05' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;

  v_customer_rate := v_ecb_rate - 0.0052;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id,
    '2024-09-05',
    'EUR/USD',
    v_customer_rate,
    3120000.00,
    v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'AUR-2024-09-001',
    'payment',
    'Large gold shipment payment'
  );

  -- Sept 12: African Precious Metals (good rate)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-09-12' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;

  v_customer_rate := v_ecb_rate + 0.0005;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_african_id,
    '2024-09-12',
    'EUR/USD',
    v_customer_rate,
    980000.00,
    v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'APM-2024-09-001',
    'payment',
    'Regional trade payment'
  );

  -- Sept 20: Emirates payment (slightly worse than spot)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-09-20' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;

  v_customer_rate := v_ecb_rate - 0.0015;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_emirates_id,
    '2024-09-20',
    'EUR/USD',
    v_customer_rate,
    1750000.00,
    v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'EMI-2024-09-001',
    'payment',
    'Gold bar payment'
  );

  -- OCTOBER Transactions (matching the example data)
  -- Oct 6: Auramet payment (matching example)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-10-06' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;
  SELECT rate INTO v_revolut_rate FROM fx_rates_daily
  WHERE rate_date = '2024-10-06' AND currency_pair = 'EUR/USD' AND source_id = v_revolut_source_id;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id,
    '2024-10-06',
    'EUR/USD',
    0.8517,
    1647428.90,
    0.8562,
    ((0.8517 - 0.8562) / 0.8562 * 100),
    'AUR-2024-10-001',
    'payment',
    'USD 1,647,428.90 paid, EUR 1,403,103.00 received at rate 0.8517'
  );

  -- Oct 20: Auramet payment (matching example - better rate)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-10-20' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id,
    '2024-10-20',
    'EUR/USD',
    0.8568,
    2077722.90,
    0.8579,
    ((0.8568 - 0.8579) / 0.8579 * 100),
    'AUR-2024-10-002',
    'payment',
    'USD 2,077,722.90 paid, EUR 1,780,244.11 received at rate 0.8568'
  );

  -- Oct 10: Swiss payment (good rate)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-10-10' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;

  v_customer_rate := v_ecb_rate - 0.0003;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_swiss_id,
    '2024-10-10',
    'EUR/USD',
    v_customer_rate,
    2500000.00,
    v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'SUI-2024-10-001',
    'payment',
    'Monthly settlement'
  );

  -- Oct 18: African PM (average rate)
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily
  WHERE rate_date = '2024-10-18' AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id;

  v_customer_rate := v_ecb_rate - 0.0025;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_african_id,
    '2024-10-18',
    'EUR/USD',
    v_customer_rate,
    1200000.00,
    v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'APM-2024-10-001',
    'payment',
    'Quarterly payment'
  );

  RAISE NOTICE 'Customer FX transactions added for 3 months';
END $$;

-- Calculate monthly aggregates for the 3 months
SELECT calculate_monthly_fx_aggregates(2024, 8);
SELECT calculate_monthly_fx_aggregates(2024, 9);
SELECT calculate_monthly_fx_aggregates(2024, 10);
