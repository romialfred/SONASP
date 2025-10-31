/*
  # Add Comprehensive Test Data - Customers and FX Rates

  1. Purpose
    - Add real customer data for testing
    - Add customer FX transaction data for analysis
    - Ensure all customers appear in FX Analysis dropdown
    - Provide 3+ months of transaction history

  2. Data Added
    - 6 active customers with complete profiles
    - 18 customer FX transactions spanning Aug-Oct 2024
    - Realistic amounts and rates
    - Mix of good and bad rates for analysis

  3. Coverage
    - Multiple customers from different countries
    - Various transaction sizes
    - Different rate scenarios (better/worse than market)
*/

-- First, ensure we have the customers table with all required columns
-- Insert or update customers with complete information
INSERT INTO customers (name, email, phone, company, country, address, contact_person, payment_terms, credit_limit, status, is_active) VALUES
  (
    'Auramet Trading LLC',
    'trading@auramet.com',
    '+1-212-555-0100',
    'Auramet International Inc.',
    'United States',
    '175 West Jackson Blvd, Suite 1000, Chicago, IL 60604',
    'John Mitchell',
    'Net 30 days',
    5000000,
    'active',
    true
  ),
  (
    'Emirates Gold DMCC',
    'operations@emiratesgold.ae',
    '+971-4-555-0200',
    'Emirates Gold DMCC',
    'United Arab Emirates',
    'Almas Tower, Jumeirah Lakes Towers, Dubai',
    'Ahmed Al Mansouri',
    'Net 15 days',
    3000000,
    'active',
    true
  ),
  (
    'Swiss Gold Traders SA',
    'contact@swissgold.ch',
    '+41-22-555-0300',
    'Swiss Gold Traders SA',
    'Switzerland',
    'Rue du Rhône 62, 1204 Geneva',
    'Pierre Dubois',
    'Net 45 days',
    4000000,
    'active',
    true
  ),
  (
    'African Precious Metals',
    'info@africanpm.ci',
    '+225-27-555-0400',
    'APM Group CI',
    'Côte d''Ivoire',
    'Boulevard Latrille, Abidjan',
    'Kofi Mensah',
    'Net 30 days',
    2000000,
    'active',
    true
  ),
  (
    'London Bullion Ltd',
    'trading@londonbullion.co.uk',
    '+44-20-555-0500',
    'London Bullion Limited',
    'United Kingdom',
    '1 Canada Square, Canary Wharf, London E14 5AB',
    'James Thompson',
    'Net 30 days',
    6000000,
    'active',
    true
  ),
  (
    'Hong Kong Metals Exchange',
    'sales@hkmetals.hk',
    '+852-2555-0600',
    'HK Metals Exchange Co. Ltd',
    'Hong Kong',
    'Central Plaza, 18 Harbour Road, Wan Chai',
    'Li Wei Chen',
    'Net 15 days',
    3500000,
    'active',
    true
  )
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  company = EXCLUDED.company,
  country = EXCLUDED.country,
  address = EXCLUDED.address,
  contact_person = EXCLUDED.contact_person,
  payment_terms = EXCLUDED.payment_terms,
  credit_limit = EXCLUDED.credit_limit,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

-- Now add comprehensive FX transaction data for these customers
DO $$
DECLARE
  v_auramet_id uuid;
  v_emirates_id uuid;
  v_swiss_id uuid;
  v_african_id uuid;
  v_london_id uuid;
  v_hongkong_id uuid;
  v_ecb_source_id uuid;
  v_revolut_source_id uuid;
  v_date date;
  v_ecb_rate numeric;
  v_revolut_rate numeric;
  v_customer_rate numeric;
  v_amount numeric;
BEGIN
  -- Get customer IDs
  SELECT id INTO v_auramet_id FROM customers WHERE email = 'trading@auramet.com';
  SELECT id INTO v_emirates_id FROM customers WHERE email = 'operations@emiratesgold.ae';
  SELECT id INTO v_swiss_id FROM customers WHERE email = 'contact@swissgold.ch';
  SELECT id INTO v_african_id FROM customers WHERE email = 'info@africanpm.ci';
  SELECT id INTO v_london_id FROM customers WHERE email = 'trading@londonbullion.co.uk';
  SELECT id INTO v_hongkong_id FROM customers WHERE email = 'sales@hkmetals.hk';

  -- Get source IDs (if FX system is configured)
  SELECT id INTO v_ecb_source_id FROM fx_rate_sources WHERE code = 'ECB';
  SELECT id INTO v_revolut_source_id FROM fx_rate_sources WHERE code = 'REVOLUT';

  -- Check if FX rates exist
  IF v_ecb_source_id IS NULL THEN
    RAISE NOTICE 'FX rate sources not found. Customer FX data will use default rates.';
    RAISE NOTICE 'To use actual FX rates, run migration 20251027140000 first.';
  END IF;

  -- Delete existing customer FX rates to avoid duplicates
  DELETE FROM customer_fx_rates WHERE transaction_date >= '2024-08-01';

  -- ============= AUGUST 2024 TRANSACTIONS =============

  -- Aug 6: Auramet (worse than market)
  v_date := '2024-08-06';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id, v_date, 'EUR/USD', 0.8517, 1647428.90, v_ecb_rate,
    ((0.8517 - v_ecb_rate) / v_ecb_rate * 100),
    'AUR-2024-08-001', 'payment',
    'USD 1,647,428.90 paid, EUR 1,403,103.00 received at rate 0.8517'
  );

  -- Aug 8: Emirates (good rate)
  v_date := '2024-08-08';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0002;
  v_amount := 2250000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_emirates_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'EMI-2024-08-001', 'payment', 'Silver shipment payment'
  );

  -- Aug 12: Swiss (excellent rate)
  v_date := '2024-08-12';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate + 0.0005;
  v_amount := 1890000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_swiss_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'SUI-2024-08-001', 'payment', 'Gold refining payment'
  );

  -- Aug 15: London (slightly worse)
  v_date := '2024-08-15';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0025;
  v_amount := 3100000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_london_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'LON-2024-08-001', 'payment', 'Monthly settlement'
  );

  -- Aug 20: Hong Kong (moderate rate)
  v_date := '2024-08-20';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0012;
  v_amount := 1750000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_hongkong_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'HKM-2024-08-001', 'payment', 'Gold bars purchase'
  );

  -- Aug 27: African PM (competitive rate)
  v_date := '2024-08-27';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0006;
  v_amount := 980000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_african_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'APM-2024-08-001', 'payment', 'Regional trade payment'
  );

  -- ============= SEPTEMBER 2024 TRANSACTIONS =============

  -- Sept 3: Auramet (very bad rate - loss scenario)
  v_date := '2024-09-03';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0068;
  v_amount := 3120000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'AUR-2024-09-001', 'payment', 'Large gold shipment - poor FX rate'
  );

  -- Sept 6: Swiss (excellent rate again)
  v_date := '2024-09-06';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate + 0.0008;
  v_amount := 2890000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_swiss_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'SUI-2024-09-001', 'payment', 'Premium rate negotiated'
  );

  -- Sept 10: Emirates (good rate)
  v_date := '2024-09-10';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0003;
  v_amount := 2100000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_emirates_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'EMI-2024-09-001', 'payment', 'Gold shipment payment'
  );

  -- Sept 13: London (bad rate)
  v_date := '2024-09-13';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0042;
  v_amount := 4200000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_london_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'LON-2024-09-001', 'payment', 'Large volume - unfavorable rate'
  );

  -- Sept 17: Hong Kong (moderate)
  v_date := '2024-09-17';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0015;
  v_amount := 2450000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_hongkong_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'HKM-2024-09-001', 'payment', 'Standard transaction'
  );

  -- Sept 24: African PM (good rate)
  v_date := '2024-09-24';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate + 0.0004;
  v_amount := 1350000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_african_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'APM-2024-09-001', 'payment', 'Favorable rate secured'
  );

  -- ============= OCTOBER 2024 TRANSACTIONS =============

  -- Oct 2: Swiss (best rate of the month)
  v_date := '2024-10-02';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate + 0.0010;
  v_amount := 3500000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_swiss_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'SUI-2024-10-001', 'payment', 'Exceptional rate - long-term partner'
  );

  -- Oct 6: Auramet (as per original example)
  v_date := '2024-10-06';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id, v_date, 'EUR/USD', 0.8517, 1647428.90, v_ecb_rate,
    ((0.8517 - v_ecb_rate) / v_ecb_rate * 100),
    'AUR-2024-10-001', 'payment',
    'USD 1,647,428.90 paid, EUR 1,403,103.00 received at rate 0.8517'
  );

  -- Oct 10: Emirates (average rate)
  v_date := '2024-10-10';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0008;
  v_amount := 1980000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_emirates_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'EMI-2024-10-001', 'payment', 'October settlement'
  );

  -- Oct 14: London (poor rate - warning scenario)
  v_date := '2024-10-14';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0055;
  v_amount := 5200000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_london_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'LON-2024-10-001', 'payment', 'Large transaction - significant loss on FX'
  );

  -- Oct 18: Hong Kong (good rate)
  v_date := '2024-10-18';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0004;
  v_amount := 2800000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_hongkong_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'HKM-2024-10-001', 'payment', 'Competitive rate achieved'
  );

  -- Oct 20: Auramet (better rate)
  v_date := '2024-10-20';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_auramet_id, v_date, 'EUR/USD', 0.8568, 2077722.90, v_ecb_rate,
    ((0.8568 - v_ecb_rate) / v_ecb_rate * 100),
    'AUR-2024-10-002', 'payment',
    'USD 2,077,722.90 paid, EUR 1,780,244.11 received at rate 0.8568'
  );

  -- Oct 23: African PM (excellent rate)
  v_date := '2024-10-23';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate + 0.0007;
  v_amount := 1620000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_african_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'APM-2024-10-001', 'payment', 'Strong negotiation result'
  );

  -- Oct 28: Emirates (final transaction)
  v_date := '2024-10-28';
  SELECT rate INTO v_ecb_rate FROM fx_rates_daily WHERE rate_date = v_date AND currency_pair = 'EUR/USD' AND source_id = v_ecb_source_id LIMIT 1;
  v_ecb_rate := COALESCE(v_ecb_rate, 0.9200);
  v_customer_rate := v_ecb_rate - 0.0011;
  v_amount := 2340000.00;

  INSERT INTO customer_fx_rates (customer_id, transaction_date, currency_pair, rate_paid, amount, market_rate, spread_percentage, reference_number, transaction_type, notes)
  VALUES (
    v_emirates_id, v_date, 'EUR/USD', v_customer_rate, v_amount, v_ecb_rate,
    ((v_customer_rate - v_ecb_rate) / v_ecb_rate * 100),
    'EMI-2024-10-002', 'payment', 'Month-end settlement'
  );

  RAISE NOTICE 'Added 6 customers with 18 FX transactions spanning Aug-Oct 2024';
END $$;
