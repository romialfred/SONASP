-- ============================================================================
-- VERIFY FX SETUP - Run this to check if everything is working
-- ============================================================================

-- Check if tables exist
DO $$
DECLARE
  v_tables_exist boolean;
BEGIN
  SELECT COUNT(*) = 4 INTO v_tables_exist
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('fx_rate_sources', 'fx_rates_daily', 'fx_rates_monthly_aggregated', 'customer_fx_rates');

  IF v_tables_exist THEN
    RAISE NOTICE '✅ All FX tables exist';
  ELSE
    RAISE NOTICE '❌ FX tables missing - run QUICK_FX_SETUP.sql first';
    RETURN;
  END IF;
END $$;

-- Count records
DO $$
DECLARE
  v_sources_count integer;
  v_daily_rates_count integer;
  v_customer_tx_count integer;
  v_customers_count integer;
BEGIN
  SELECT COUNT(*) INTO v_sources_count FROM fx_rate_sources;
  SELECT COUNT(*) INTO v_daily_rates_count FROM fx_rates_daily WHERE currency_pair = 'EUR/USD';
  SELECT COUNT(*) INTO v_customer_tx_count FROM customer_fx_rates;
  SELECT COUNT(*) INTO v_customers_count FROM customers WHERE email IN (
    'trading@auramet.com', 'operations@emiratesgold.ae', 'contact@swissgold.ch', 'info@africanpm.ci'
  );

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FX SETUP VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FX Rate Sources: % (expected: 4)', v_sources_count;
  RAISE NOTICE 'Daily EUR/USD Rates: % (expected: ~130+)', v_daily_rates_count;
  RAISE NOTICE 'Customer Transactions: % (expected: 3+)', v_customer_tx_count;
  RAISE NOTICE 'Sample Customers: % (expected: 4)', v_customers_count;
  RAISE NOTICE '';

  IF v_sources_count >= 4 AND v_daily_rates_count >= 100 AND v_customer_tx_count >= 3 AND v_customers_count >= 4 THEN
    RAISE NOTICE '✅ SUCCESS! FX Analysis is ready to use';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Next Steps:';
    RAISE NOTICE '   1. Navigate to /prices/fx-rates';
    RAISE NOTICE '   2. Click on "FX Rate Analysis" tab';
    RAISE NOTICE '   3. Data will load automatically!';
  ELSE
    RAISE NOTICE '⚠️  INCOMPLETE: Some data is missing';
    RAISE NOTICE '   Please run QUICK_FX_SETUP.sql again';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- Show sample data
SELECT 
  c.name as customer_name,
  cfr.transaction_date,
  cfr.amount as usd_amount,
  cfr.rate_paid as customer_rate,
  cfr.reference_number
FROM customer_fx_rates cfr
JOIN customers c ON c.id = cfr.customer_id
ORDER BY cfr.transaction_date DESC
LIMIT 5;
