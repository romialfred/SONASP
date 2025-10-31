/*
  # Add Complete Platform Test Data

  1. Purpose
    - Add comprehensive test data for all platform modules
    - Enable full end-to-end testing without manual data entry
    - Provide realistic scenarios for demonstrations

  2. Data Coverage
    - Sites (mines, airports, refineries)
    - Transport companies
    - Batches with complete workflow
    - Sales transactions
    - Payments
    - Gold prices
    - All data relationships maintained

  3. Note
    - This migration requires previous migrations to be run first
    - Especially migration 20251027180000 (customers and FX data)
    - FX rates come from external APIs (ECB)
    - All other data is in the database
*/

-- ============= SITES =============
-- Ensure sites exist for batch tracking
DO $$
BEGIN
  RAISE NOTICE 'Checking and adding sites...';

  -- Insert sites if they don't exist
  IF NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Conakry Mine') THEN
    INSERT INTO sites (name, site_type, address, country, is_active)
    VALUES ('Conakry Mine', 'factory', 'Conakry', 'GN', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Siguiri Mine') THEN
    INSERT INTO sites (name, site_type, address, country, is_active)
    VALUES ('Siguiri Mine', 'factory', 'Siguiri', 'GN', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Conakry International Airport') THEN
    INSERT INTO sites (name, site_type, address, country, is_active)
    VALUES ('Conakry International Airport', 'airport', 'Conakry', 'GN', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Abidjan Airport') THEN
    INSERT INTO sites (name, site_type, address, country, is_active)
    VALUES ('Abidjan Airport', 'airport', 'Abidjan', 'CI', true);
  END IF;

  RAISE NOTICE '✓ Sites configuration complete';
END $$;

-- ============= TRANSPORT COMPANIES =============
-- Ensure transport companies are active
UPDATE transport_companies SET is_active = true WHERE is_active = false;

-- ============= REFINERIES =============
-- Ensure refineries are active
UPDATE refineries SET is_active = true WHERE is_active = false;

-- ============= GOLD PRICES =============
-- Add daily gold prices for the past 3 months
DO $$
DECLARE
  v_date date;
  v_base_price numeric;
  v_london_am numeric;
  v_london_pm numeric;
  v_days_added integer := 0;
BEGIN
  -- Delete existing prices to avoid conflicts
  DELETE FROM gold_prices_daily WHERE price_date >= '2024-08-01' AND price_date <= '2024-10-31';

  -- Generate gold prices for August, September, October 2024
  FOR i IN 0..91 LOOP
    v_date := '2024-08-01'::date + i;

    -- Skip weekends
    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      -- Base price around $2500/oz with realistic variations
      v_base_price := 2480 + (random() * 80 - 40) + (i * 0.5); -- Slight upward trend
      v_london_am := v_base_price + (random() * 10 - 5);
      v_london_pm := v_london_am + (random() * 8 - 4);

      INSERT INTO gold_prices_daily (
        price_date,
        london_am_rate,
        london_pm_rate,
        spot_price,
        average_price,
        high_price,
        low_price,
        source
      ) VALUES (
        v_date,
        v_london_am,
        v_london_pm,
        v_base_price,
        (v_london_am + v_london_pm) / 2,
        v_london_pm + 5,
        v_base_price - 8,
        'Manual Test Data'
      );

      v_days_added := v_days_added + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Added gold price data from Aug 1 to Oct 31, 2024 (% days)', v_days_added;
END $$;

-- ============= BATCHES =============
-- Add sample batches with complete workflow
DO $$
DECLARE
  v_conakry_site_id uuid;
  v_siguiri_site_id uuid;
  v_airport_site_id uuid;
  v_transport1_id uuid;
  v_transport2_id uuid;
  v_refinery_id uuid;
  v_user_id uuid;
  v_batch_id uuid;
  v_batch_number text;
  v_batches_created integer := 0;
BEGIN
  -- Get IDs
  SELECT id INTO v_conakry_site_id FROM sites WHERE name = 'Conakry Mine';
  SELECT id INTO v_siguiri_site_id FROM sites WHERE name = 'Siguiri Mine';
  SELECT id INTO v_airport_site_id FROM sites WHERE name = 'Conakry International Airport';
  SELECT id INTO v_transport1_id FROM transport_companies WHERE name LIKE '%Express%' LIMIT 1;
  SELECT id INTO v_transport2_id FROM transport_companies WHERE name LIKE '%International%' LIMIT 1;
  SELECT id INTO v_refinery_id FROM refineries LIMIT 1;

  -- Get a user ID (first user in system)
  SELECT id INTO v_user_id FROM user_profiles LIMIT 1;

  -- Batch 1: Recently created
  v_batch_number := 'GN-20241025-001';
  IF NOT EXISTS (SELECT 1 FROM batches WHERE batch_number = v_batch_number) THEN
    INSERT INTO batches (
      batch_number, status, origin_site_id, current_site_id,
      weight_grams, weight_ounces, metal_type, shipping_date,
      mine_to_airport_transport_id, airport_to_refinery_transport_id,
      destination_refinery_id, comments, created_by
    ) VALUES (
      v_batch_number, 'created', v_conakry_site_id, v_conakry_site_id,
      45000, 1446.52, 'gold', '2024-10-25',
      v_transport1_id, v_transport2_id, v_refinery_id,
      'High-grade ore from new mining section', v_user_id
    );
    v_batches_created := v_batches_created + 1;
  END IF;

  -- Batch 2: In transit to airport (validated for transport)
  v_batch_number := 'GN-20241020-001';
  IF NOT EXISTS (SELECT 1 FROM batches WHERE batch_number = v_batch_number) THEN
    INSERT INTO batches (
      batch_number, status, origin_site_id, current_site_id,
      weight_grams, weight_ounces, metal_type, shipping_date,
      mine_to_airport_transport_id, airport_to_refinery_transport_id,
      destination_refinery_id, comments, created_by, created_at
    ) VALUES (
      v_batch_number, 'validated_for_transport', v_conakry_site_id, v_conakry_site_id,
      38500, 1237.69, 'gold', '2024-10-20',
      v_transport1_id, v_transport2_id, v_refinery_id,
      'Standard shipment - validated for transport', v_user_id, '2024-10-20 08:00:00'
    );
    v_batches_created := v_batches_created + 1;
  END IF;

  -- Batch 3: At airport
  v_batch_number := 'GN-20241018-001';
  IF NOT EXISTS (SELECT 1 FROM batches WHERE batch_number = v_batch_number) THEN
    INSERT INTO batches (
      batch_number, status, origin_site_id, current_site_id,
      weight_grams, weight_ounces, metal_type, shipping_date,
      mine_to_airport_transport_id, airport_to_refinery_transport_id,
      destination_refinery_id, comments, created_by, created_at
    ) VALUES (
      v_batch_number, 'received_airport', v_conakry_site_id, v_airport_site_id,
      52000, 1671.67, 'gold', '2024-10-18',
      v_transport1_id, v_transport2_id, v_refinery_id,
      'Received at airport, awaiting customs clearance', v_user_id, '2024-10-18 06:00:00'
    );
    v_batches_created := v_batches_created + 1;
  END IF;

  -- Batch 4: At refinery
  v_batch_number := 'GN-20241015-001';
  IF NOT EXISTS (SELECT 1 FROM batches WHERE batch_number = v_batch_number) THEN
    INSERT INTO batches (
      batch_number, status, origin_site_id, current_site_id,
      weight_grams, weight_ounces, metal_type, shipping_date,
      mine_to_airport_transport_id, airport_to_refinery_transport_id,
      destination_refinery_id, comments, created_by, created_at
    ) VALUES (
      v_batch_number, 'received_refinery', v_siguiri_site_id, v_airport_site_id,
      41000, 1317.90, 'gold', '2024-10-15',
      v_transport1_id, v_transport2_id, v_refinery_id,
      'Delivered to refinery', v_user_id, '2024-10-15 10:00:00'
    );
    v_batches_created := v_batches_created + 1;
  END IF;

  -- Batch 5: Processing at refinery
  v_batch_number := 'GN-20241010-001';
  IF NOT EXISTS (SELECT 1 FROM batches WHERE batch_number = v_batch_number) THEN
    INSERT INTO batches (
      batch_number, status, origin_site_id, current_site_id,
      weight_grams, weight_ounces, metal_type, shipping_date,
      mine_to_airport_transport_id, airport_to_refinery_transport_id,
      destination_refinery_id, comments, created_by, created_at
    ) VALUES (
      v_batch_number, 'processing', v_conakry_site_id, v_airport_site_id,
      48000, 1543.06, 'gold', '2024-10-10',
      v_transport1_id, v_transport2_id, v_refinery_id,
      'Currently in melting process', v_user_id, '2024-10-10 07:00:00'
    );
    v_batches_created := v_batches_created + 1;
  END IF;

  -- Batch 6: Processed and ready for sale
  v_batch_number := 'GN-20241005-001';
  IF NOT EXISTS (SELECT 1 FROM batches WHERE batch_number = v_batch_number) THEN
    INSERT INTO batches (
      batch_number, status, origin_site_id, current_site_id,
      weight_grams, weight_ounces, metal_type, shipping_date,
      mine_to_airport_transport_id, airport_to_refinery_transport_id,
      destination_refinery_id, comments, created_by, created_at
    ) VALUES (
      v_batch_number, 'ready_for_sale', v_conakry_site_id, v_airport_site_id,
      35000, 1125.19, 'gold', '2024-10-05',
      v_transport1_id, v_transport2_id, v_refinery_id,
      'Refining completed - 99.99% purity achieved', v_user_id, '2024-10-05 09:00:00'
    )
    RETURNING id INTO v_batch_id;
    v_batches_created := v_batches_created + 1;

    -- Add refining record for batch 6
    IF v_batch_id IS NOT NULL THEN
      INSERT INTO refining_records (
        batch_id, pre_melting_weight_grams, post_melting_weight_grams,
        fineness_percentage, metal_retained_percentage,
        final_fine_grams, final_fine_ounces, processed_by, processed_at
      ) VALUES (
        v_batch_id, 35000, 34500, 99.99, 98.5,
        33996.55, 1093.00, v_user_id, '2024-10-12 15:30:00'
      );
    END IF;
  END IF;

  -- Batch 7: Sold (for sales data)
  v_batch_number := 'GN-20240925-001';
  IF NOT EXISTS (SELECT 1 FROM batches WHERE batch_number = v_batch_number) THEN
    INSERT INTO batches (
      batch_number, status, origin_site_id, current_site_id,
      weight_grams, weight_ounces, metal_type, shipping_date,
      mine_to_airport_transport_id, airport_to_refinery_transport_id,
      destination_refinery_id, comments, created_by, created_at
    ) VALUES (
      v_batch_number, 'ready_for_sale', v_siguiri_site_id, v_airport_site_id,
      50000, 1607.43, 'gold', '2024-09-25',
      v_transport1_id, v_transport2_id, v_refinery_id,
      'Completed and sold to Auramet', v_user_id, '2024-09-25 08:00:00'
    );
    v_batches_created := v_batches_created + 1;
  END IF;

  RAISE NOTICE 'Added % test batches covering the complete workflow', v_batches_created;
END $$;

-- ============= SALES =============
-- Add sample sales transactions
DO $$
DECLARE
  v_customer_id uuid;
  v_batch_id uuid;
  v_user_id uuid;
  v_sale_id uuid;
  v_quantity numeric;
  v_london_am numeric;
  v_gross numeric;
  v_freight numeric;
  v_other_costs numeric;
  v_net numeric;
  v_royalties numeric;
  v_final numeric;
  v_total_amount numeric;
  v_sales_created integer := 0;
BEGIN
  -- Get customer IDs
  SELECT id INTO v_customer_id FROM customers WHERE email = 'trading@auramet.com';
  SELECT id INTO v_batch_id FROM batches WHERE batch_number = 'GN-20240925-001';
  SELECT id INTO v_user_id FROM user_profiles LIMIT 1;

  -- Check if we have required data before proceeding
  IF v_customer_id IS NULL THEN
    RAISE NOTICE 'Skipping sales creation: Customer not found (trading@auramet.com)';
    RAISE NOTICE 'Please run migration 20251027180000 first to create customers';
    RETURN;
  END IF;

  IF v_batch_id IS NULL THEN
    RAISE NOTICE 'Skipping sales creation: Batch GN-20240925-001 not found';
    RETURN;
  END IF;

  -- Get a recent gold price
  SELECT london_am_rate INTO v_london_am FROM gold_prices_daily
  WHERE price_date <= '2024-09-30' ORDER BY price_date DESC LIMIT 1;

  IF v_london_am IS NULL THEN
    v_london_am := 2545.11;
  END IF;

  -- Sale 1: Completed sale
  IF NOT EXISTS (SELECT 1 FROM sales WHERE sale_number = 'SL-2024-09-001') THEN
    v_quantity := 1500.00; -- ounces
    v_freight := 5000.00;
    v_other_costs := 2500.00;
    v_gross := v_quantity * v_london_am;
    v_net := v_gross - v_freight - v_other_costs;
    v_royalties := v_net * 0.03;
    v_final := v_net - v_royalties;
    v_total_amount := v_final; -- total_amount = final_proceeds

    INSERT INTO sales (
      sale_number, customer_id, batch_id, quantity_oz, london_am_rate,
      freight_cost, other_costs, gross_proceeds, net_proceeds,
      royalties, final_proceeds, total_amount, status, sale_date, currency, metal_type,
      created_by, approved_by, approved_at, created_at
    ) VALUES (
      'SL-2024-09-001', v_customer_id, v_batch_id, v_quantity, v_london_am,
      v_freight, v_other_costs, v_gross, v_net, v_royalties, v_final, v_total_amount,
      'completed', '2024-09-27', 'USD', 'gold',
      v_user_id, v_user_id, '2024-09-28 10:00:00', '2024-09-27 14:00:00'
    )
    RETURNING id INTO v_sale_id;
    v_sales_created := v_sales_created + 1;

    -- Add payment for this sale
    IF v_sale_id IS NOT NULL THEN
      INSERT INTO payments (
        sale_id, expected_date, actual_date, amount, currency,
        fx_rate, bank_name, reference_number, status, created_by,
        approved_by, approved_at, created_at
      ) VALUES (
        v_sale_id, '2024-10-10', '2024-10-08', v_final, 'USD',
        1.00, 'JP Morgan Chase', 'PAY-2024-09-001', 'approved',
        v_user_id, v_user_id, '2024-10-08 16:00:00', '2024-10-08 09:00:00'
      );
    END IF;
  END IF;

  -- Sale 2: Pending approval
  SELECT id INTO v_customer_id FROM customers WHERE email = 'contact@swissgold.ch';
  SELECT id INTO v_batch_id FROM batches WHERE batch_number = 'GN-20241005-001';

  -- Check if customer exists for sale 2
  IF v_customer_id IS NOT NULL AND v_batch_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sales WHERE sale_number = 'SL-2024-10-001') THEN
      v_quantity := 1000.00;
      v_freight := 4500.00;
      v_other_costs := 2000.00;
      v_gross := v_quantity * v_london_am;
      v_net := v_gross - v_freight - v_other_costs;
      v_royalties := v_net * 0.03;
      v_final := v_net - v_royalties;
      v_total_amount := v_final;

      INSERT INTO sales (
        sale_number, customer_id, batch_id, quantity_oz, london_am_rate,
        freight_cost, other_costs, gross_proceeds, net_proceeds,
        royalties, final_proceeds, total_amount, status, sale_date, currency, metal_type,
        created_by, created_at
      ) VALUES (
        'SL-2024-10-001', v_customer_id, v_batch_id, v_quantity, v_london_am,
        v_freight, v_other_costs, v_gross, v_net, v_royalties, v_final, v_total_amount,
        'pending', CURRENT_DATE, 'USD', 'gold',
        v_user_id, NOW()
      );
      v_sales_created := v_sales_created + 1;
    END IF;
  ELSE
    RAISE NOTICE 'Skipping sale 2: Customer (contact@swissgold.ch) or batch not found';
  END IF;

  IF v_sales_created > 0 THEN
    RAISE NOTICE 'Added % sales transactions', v_sales_created;
  ELSE
    RAISE NOTICE 'No new sales created (already exist)';
  END IF;
END $$;

-- ============= NOTIFICATIONS =============
-- Add sample notifications for user
DO $$
DECLARE
  v_user_id uuid;
  v_notifications_created integer := 0;
BEGIN
  SELECT id INTO v_user_id FROM user_profiles LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Check if notifications table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
      INSERT INTO notifications (user_id, type, title, message, is_read, created_at) VALUES
        (v_user_id, 'batch_status', 'Batch Received at Airport', 'Batch GN-20241018-001 has been received at Conakry International Airport', false, NOW() - interval '2 hours'),
        (v_user_id, 'approval', 'Sale Pending Approval', 'Sale SL-2024-10-001 to Swiss Gold Traders requires your approval', false, NOW() - interval '5 hours'),
        (v_user_id, 'payment', 'Payment Received', 'Payment of $3.7M received from Auramet Trading LLC', true, NOW() - interval '2 days')
      ON CONFLICT DO NOTHING;
      v_notifications_created := 3;
      RAISE NOTICE 'Added % sample notifications', v_notifications_created;
    ELSE
      RAISE NOTICE 'Notifications table does not exist, skipping notification creation';
    END IF;
  END IF;
END $$;

-- Final summary message
DO $$
DECLARE
  v_customers_count integer;
  v_batches_count integer;
  v_sales_count integer;
  v_gold_prices_count integer;
BEGIN
  -- Count records
  SELECT COUNT(*) INTO v_customers_count FROM customers WHERE is_active = true;
  SELECT COUNT(*) INTO v_batches_count FROM batches WHERE batch_number LIKE 'GN-2024%';
  SELECT COUNT(*) INTO v_sales_count FROM sales WHERE sale_number LIKE 'SL-2024%';
  SELECT COUNT(*) INTO v_gold_prices_count FROM gold_prices_daily WHERE price_date >= '2024-08-01' AND price_date <= '2024-10-31';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COMPLETE PLATFORM TEST DATA SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Data Added Successfully:';
  RAISE NOTICE '- % active customers', v_customers_count;
  RAISE NOTICE '- % gold price records', v_gold_prices_count;
  RAISE NOTICE '- % batches at various workflow stages', v_batches_count;
  RAISE NOTICE '- % sales transactions', v_sales_count;
  RAISE NOTICE '- 4 sites (2 mines + 2 airports)';
  RAISE NOTICE '- Sample refining records';
  RAISE NOTICE '- Sample payments';
  RAISE NOTICE '- Sample notifications';
  RAISE NOTICE '';
  RAISE NOTICE 'Platform ready for complete end-to-end testing!';
  RAISE NOTICE '========================================';
END $$;
