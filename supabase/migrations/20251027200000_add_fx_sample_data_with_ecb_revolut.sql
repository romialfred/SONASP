/*
  Add FX Sample Data for Analysis Feature

  1. Creates sample customer FX transactions (fx_customer_transactions)
  2. Creates corresponding market rates for ECB and Revolut (fx_rates)
  3. Ensures data spans multiple months for analysis

  Purpose: Enable FX Rate Analysis tab to display data immediately without clicking "Run Analysis"
*/

-- ============================================================================
-- STEP 1: Ensure we have customers
-- ============================================================================
DO $$
DECLARE
  v_customer_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_customer_count FROM customers WHERE is_active = true;

  IF v_customer_count = 0 THEN
    RAISE NOTICE 'No active customers found. Creating sample customers...';

    INSERT INTO customers (name, email, phone, country, is_active, currency_preference, company_type, credit_limit)
    VALUES
      ('Emirates Gold DMCC', 'trading@emiratesgold.ae', '+971-4-123-4567', 'United Arab Emirates', true, 'USD', 'trading_company', 5000000),
      ('Auramet International LLC', 'sales@auramet.com', '+1-212-555-0100', 'United States', true, 'USD', 'trading_company', 10000000),
      ('Swiss Bullion SA', 'info@swissbullion.ch', '+41-22-555-0200', 'Switzerland', true, 'EUR', 'refinery', 8000000)
    ON CONFLICT (email) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create FX Customer Transactions (What customer actually paid)
-- ============================================================================
DO $$
DECLARE
  v_customer_id UUID;
  v_transaction_count INTEGER;
BEGIN
  -- Check if transactions already exist
  SELECT COUNT(*) INTO v_transaction_count FROM fx_customer_transactions;

  IF v_transaction_count > 0 THEN
    RAISE NOTICE 'FX customer transactions already exist (%). Skipping creation.', v_transaction_count;
    RETURN;
  END IF;

  -- Get Emirates Gold customer ID
  SELECT id INTO v_customer_id FROM customers WHERE name ILIKE '%Emirates%' LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE NOTICE 'Customer not found. Cannot create transactions.';
    RETURN;
  END IF;

  RAISE NOTICE 'Creating FX customer transactions for customer: %', v_customer_id;

  -- August 2024 transactions
  INSERT INTO fx_customer_transactions (
    customer_id, transaction_date, transaction_type,
    usd_amount, eur_amount, customer_rate,
    bank_name, reference_number, notes, created_at
  ) VALUES
    (v_customer_id, '2024-08-05', 'payment', 125000.00, 114375.00, 0.9150, 'Emirates NBD', 'PAY-AUG-001', 'Gold sale payment - Batch GN-20240805-001', '2024-08-05 10:30:00'),
    (v_customer_id, '2024-08-15', 'payment', 89500.00, 81715.00, 0.9130, 'Emirates NBD', 'PAY-AUG-002', 'Gold sale payment - Batch GN-20240815-001', '2024-08-15 14:20:00'),
    (v_customer_id, '2024-08-25', 'payment', 156000.00, 142740.00, 0.9150, 'Mashreq Bank', 'PAY-AUG-003', 'Gold sale payment - Batch GN-20240825-001', '2024-08-25 09:15:00');

  -- September 2024 transactions
  INSERT INTO fx_customer_transactions (
    customer_id, transaction_date, transaction_type,
    usd_amount, eur_amount, customer_rate,
    bank_name, reference_number, notes, created_at
  ) VALUES
    (v_customer_id, '2024-09-08', 'payment', 198000.00, 180180.00, 0.9100, 'Emirates NBD', 'PAY-SEP-001', 'Gold sale payment - Batch GN-20240908-001', '2024-09-08 11:45:00'),
    (v_customer_id, '2024-09-18', 'payment', 142500.00, 130387.50, 0.9150, 'Mashreq Bank', 'PAY-SEP-002', 'Gold sale payment - Batch GN-20240918-001', '2024-09-18 15:30:00'),
    (v_customer_id, '2024-09-28', 'payment', 175000.00, 159250.00, 0.9100, 'Emirates NBD', 'PAY-SEP-003', 'Gold sale payment - Batch GN-20240928-001', '2024-09-28 10:00:00');

  -- October 2024 transactions
  INSERT INTO fx_customer_transactions (
    customer_id, transaction_date, transaction_type,
    usd_amount, eur_amount, customer_rate,
    bank_name, reference_number, notes, created_at
  ) VALUES
    (v_customer_id, '2024-10-05', 'payment', 212000.00, 192480.00, 0.9080, 'ADCB', 'PAY-OCT-001', 'Gold sale payment - Batch GN-20241005-001', '2024-10-05 09:30:00'),
    (v_customer_id, '2024-10-15', 'payment', 167000.00, 151970.00, 0.9100, 'Emirates NBD', 'PAY-OCT-002', 'Gold sale payment - Batch GN-20241015-001', '2024-10-15 13:15:00'),
    (v_customer_id, '2024-10-25', 'payment', 189000.00, 172350.00, 0.9120, 'Mashreq Bank', 'PAY-OCT-003', 'Gold sale payment - Batch GN-20241025-001', '2024-10-25 11:00:00');

  RAISE NOTICE 'Created 9 FX customer transactions (3 per month: Aug, Sep, Oct)';
END $$;

-- ============================================================================
-- STEP 3: Create Market FX Rates (ECB Spot and Revolut)
-- ============================================================================
DO $$
DECLARE
  v_rate_count INTEGER;
BEGIN
  -- Check if rates already exist
  SELECT COUNT(*) INTO v_rate_count FROM fx_rates WHERE rate_date >= '2024-08-01';

  IF v_rate_count > 50 THEN
    RAISE NOTICE 'FX rates already exist (%). Skipping creation.', v_rate_count;
    RETURN;
  END IF;

  RAISE NOTICE 'Creating market FX rates (ECB and Revolut) for August-October 2024...';

  -- August 2024 rates
  INSERT INTO fx_rates (rate_date, currency_pair, rate_source, rate_value, created_at) VALUES
    -- Aug 5
    ('2024-08-05', 'EUR/USD', 'ecb_spot', 0.9185, '2024-08-05 08:00:00'),
    ('2024-08-05', 'EUR/USD', 'revolut', 0.9195, '2024-08-05 08:00:00'),
    -- Aug 15
    ('2024-08-15', 'EUR/USD', 'ecb_spot', 0.9165, '2024-08-15 08:00:00'),
    ('2024-08-15', 'EUR/USD', 'revolut', 0.9175, '2024-08-15 08:00:00'),
    -- Aug 25
    ('2024-08-25', 'EUR/USD', 'ecb_spot', 0.9180, '2024-08-25 08:00:00'),
    ('2024-08-25', 'EUR/USD', 'revolut', 0.9192, '2024-08-25 08:00:00');

  -- September 2024 rates
  INSERT INTO fx_rates (rate_date, currency_pair, rate_source, rate_value, created_at) VALUES
    -- Sep 8
    ('2024-09-08', 'EUR/USD', 'ecb_spot', 0.9142, '2024-09-08 08:00:00'),
    ('2024-09-08', 'EUR/USD', 'revolut', 0.9155, '2024-09-08 08:00:00'),
    -- Sep 18
    ('2024-09-18', 'EUR/USD', 'ecb_spot', 0.9175, '2024-09-18 08:00:00'),
    ('2024-09-18', 'EUR/USD', 'revolut', 0.9188, '2024-09-18 08:00:00'),
    -- Sep 28
    ('2024-09-28', 'EUR/USD', 'ecb_spot', 0.9135, '2024-09-28 08:00:00'),
    ('2024-09-28', 'EUR/USD', 'revolut', 0.9148, '2024-09-28 08:00:00');

  -- October 2024 rates
  INSERT INTO fx_rates (rate_date, currency_pair, rate_source, rate_value, created_at) VALUES
    -- Oct 5
    ('2024-10-05', 'EUR/USD', 'ecb_spot', 0.9120, '2024-10-05 08:00:00'),
    ('2024-10-05', 'EUR/USD', 'revolut', 0.9135, '2024-10-05 08:00:00'),
    -- Oct 15
    ('2024-10-15', 'EUR/USD', 'ecb_spot', 0.9140, '2024-10-15 08:00:00'),
    ('2024-10-15', 'EUR/USD', 'revolut', 0.9152, '2024-10-15 08:00:00'),
    -- Oct 25
    ('2024-10-25', 'EUR/USD', 'ecb_spot', 0.9155, '2024-10-25 08:00:00'),
    ('2024-10-25', 'EUR/USD', 'revolut', 0.9168, '2024-10-25 08:00:00');

  RAISE NOTICE 'Created 18 market FX rates (2 sources × 9 dates)';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  v_customer_tx_count INTEGER;
  v_fx_rates_count INTEGER;
  v_customer_name TEXT;
BEGIN
  SELECT COUNT(*) INTO v_customer_tx_count FROM fx_customer_transactions;
  SELECT COUNT(*) INTO v_fx_rates_count FROM fx_rates WHERE rate_date >= '2024-08-01';

  SELECT c.name INTO v_customer_name
  FROM fx_customer_transactions fct
  JOIN customers c ON c.id = fct.customer_id
  LIMIT 1;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FX SAMPLE DATA VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Customer Transactions: %', v_customer_tx_count;
  RAISE NOTICE 'Market FX Rates: %', v_fx_rates_count;
  RAISE NOTICE 'Sample Customer: %', COALESCE(v_customer_name, 'None');
  RAISE NOTICE '';

  IF v_customer_tx_count >= 9 AND v_fx_rates_count >= 18 THEN
    RAISE NOTICE '✅ FX Analysis data ready!';
    RAISE NOTICE '   • % customer transactions spanning Aug-Oct 2024', v_customer_tx_count;
    RAISE NOTICE '   • % market rates (ECB + Revolut) for comparison', v_fx_rates_count;
    RAISE NOTICE '   • Customer: %', v_customer_name;
    RAISE NOTICE '';
    RAISE NOTICE '📊 The FX Rate Analysis tab will now display data automatically!';
  ELSE
    RAISE NOTICE '⚠️  Insufficient data created';
    RAISE NOTICE '   Expected: 9 transactions, 18 rates';
    RAISE NOTICE '   Got: % transactions, % rates', v_customer_tx_count, v_fx_rates_count;
  END IF;

  RAISE NOTICE '========================================';
END $$;
