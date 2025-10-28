/*
  # Seed Comprehensive 12 Months Data

  ## Overview
  This migration seeds the database with 12 months of realistic data for:
  - Gold prices (daily for 12 months)
  - Customers (10 customers)
  - Batches (60 batches with various statuses)
  - Sales (40 sales transactions)

  ## Data Generation
  - Gold prices: Daily prices from Nov 2024 to Oct 2025
  - Batches: Various statuses from created to sold
  - Sales: Distributed across 12 months with realistic pricing
  - Customers: Mix of individual and corporate customers
*/

-- ================================================================
-- 1. SEED GOLD PRICES (Daily for 12 months)
-- ================================================================

DO $$
DECLARE
  v_date date;
  v_base_price numeric := 2400.00;
  v_price numeric;
  v_variation numeric;
  v_counter integer := 0;
BEGIN
  -- Generate daily gold prices for last 12 months
  FOR v_date IN
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '365 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date
  LOOP
    -- Skip weekends (Saturday = 6, Sunday = 0)
    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      v_counter := v_counter + 1;

      -- Create price variation (+/- 5% with trends)
      v_variation := ((random() - 0.5)::numeric * 100) + (v_counter * 0.5); -- Slight upward trend
      v_price := v_base_price + v_variation;

      -- Ensure price is positive
      IF v_price < 2000 THEN
        v_price := 2000 + (random()::numeric * 100);
      END IF;

      INSERT INTO gold_prices_daily (
        price_date,
        london_am_rate,
        london_pm_rate,
        spot_price,
        average_price,
        high_price,
        low_price,
        source,
        currency
      ) VALUES (
        v_date,
        ROUND(v_price, 2),
        ROUND(v_price + ((random() - 0.5)::numeric * 20), 2),
        ROUND(v_price + ((random() - 0.5)::numeric * 10), 2),
        ROUND(v_price + ((random() - 0.5)::numeric * 5), 2),
        ROUND(v_price + (random()::numeric * 30), 2),
        ROUND(v_price - (random()::numeric * 30), 2),
        'seeded',
        'USD'
      )
      ON CONFLICT (price_date) DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE 'Seeded % daily gold prices', v_counter;
END $$;

-- ================================================================
-- 2. SEED CUSTOMERS
-- ================================================================

INSERT INTO customers (
  name,
  email,
  phone,
  country,
  segment,
  is_active,
  credit_limit,
  notes
) VALUES
  ('Emirates Gold Trading LLC', 'contact@emiratesgold.ae', '+971-4-555-0001', 'UAE', 'corporate', true, 10000000, 'Large corporate buyer based in Dubai'),
  ('Swiss Precious Metals AG', 'info@swissmetals.ch', '+41-44-555-0002', 'Switzerland', 'corporate', true, 15000000, 'Premium Swiss refinery and trading company'),
  ('Gold International SA', 'sales@goldintl.com', '+33-1-555-0003', 'France', 'corporate', true, 8000000, 'European trading house'),
  ('Asian Gold Merchants', 'contact@asiangold.hk', '+852-2555-0004', 'Hong Kong', 'corporate', true, 12000000, 'Major Asian gold trader'),
  ('London Bullion Associates', 'trade@londonbullion.uk', '+44-20-555-0005', 'UK', 'corporate', true, 20000000, 'London-based precious metals dealer'),
  ('Manhattan Gold Exchange', 'info@manhattangold.com', '+1-212-555-0006', 'USA', 'retail', true, 5000000, 'New York precious metals dealer'),
  ('Dubai Gold Souk Trading', 'sales@dubaigold.ae', '+971-4-555-0007', 'UAE', 'retail', true, 6000000, 'Dubai gold souk merchant'),
  ('Singapore Bullion Market', 'trade@sgbullion.sg', '+65-6555-0008', 'Singapore', 'corporate', true, 9000000, 'Singapore precious metals exchange'),
  ('Paris Metals Trading', 'contact@parismetals.fr', '+33-1-555-0009', 'France', 'retail', true, 4000000, 'Paris-based gold dealer'),
  ('Global Precious Solutions', 'info@globalprecious.com', '+1-305-555-0010', 'USA', 'corporate', true, 11000000, 'International precious metals broker')
ON CONFLICT (email) DO NOTHING;

-- ================================================================
-- 3. SEED BATCHES (60 batches with various statuses)
-- ================================================================

DO $$
DECLARE
  v_customer_ids uuid[];
  v_batch_counter integer := 0;
  v_month_offset integer;
  v_batch_date date;
  v_weight_grams numeric;
  v_weight_ounces numeric;
  v_status text;
  v_country_code text;
  v_batch_number text;
  v_statuses text[] := ARRAY['created', 'shipped', 'airport_received', 'refinery_received', 'refined', 'ready_for_sale', 'sold'];
  v_status_weights integer[] := ARRAY[5, 10, 15, 20, 25, 15, 10]; -- Distribution weights
BEGIN
  -- Get customer IDs
  SELECT ARRAY_AGG(id) INTO v_customer_ids FROM customers LIMIT 10;

  -- Generate batches for last 12 months
  FOR v_month_offset IN 0..11 LOOP
    FOR i IN 1..5 LOOP -- 5 batches per month = 60 total
      v_batch_counter := v_batch_counter + 1;

      -- Random date within the month
      v_batch_date := CURRENT_DATE - (v_month_offset * INTERVAL '1 month') - ((random()::numeric * 25)::int * INTERVAL '1 day');

      -- Random weight between 30kg and 150kg
      v_weight_grams := 30000 + (random()::numeric * 120000);
      v_weight_ounces := v_weight_grams / 31.1035;

      -- Select status based on age (older batches more likely to be completed)
      IF v_month_offset > 6 THEN
        v_status := v_statuses[5 + floor(random()::numeric * 3)::int]; -- refined, ready_for_sale, or sold
      ELSIF v_month_offset > 3 THEN
        v_status := v_statuses[3 + floor(random()::numeric * 3)::int]; -- refinery_received to ready_for_sale
      ELSE
        v_status := v_statuses[1 + floor(random()::numeric * 5)::int]; -- Any status
      END IF;

      -- Random country code
      v_country_code := (ARRAY['GN', 'ML', 'LB'])[1 + floor(random()::numeric * 3)::int];

      -- Generate batch number: CC-YYYY-MM-XXX
      v_batch_number := v_country_code || '-' ||
                        TO_CHAR(v_batch_date, 'YYYY-MM') || '-' ||
                        LPAD((i)::text, 3, '0');

      INSERT INTO batches (
        batch_number,
        shipping_date,
        weight_grams,
        weight_ounces,
        metal_type,
        status,
        origin_site_id,
        current_site_id,
        created_at,
        updated_at
      ) VALUES (
        v_batch_number,
        v_batch_date,
        ROUND(v_weight_grams, 2),
        ROUND(v_weight_ounces, 2),
        'gold',
        v_status,
        (SELECT id FROM user_profiles LIMIT 1), -- Placeholder site
        (SELECT id FROM user_profiles LIMIT 1), -- Placeholder site
        v_batch_date,
        v_batch_date + ((random()::numeric * 10)::int * INTERVAL '1 day')
      )
      ON CONFLICT (batch_number) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seeded % batches', v_batch_counter;
END $$;

-- ================================================================
-- 4. SEED SALES (40 sales distributed over 12 months)
-- ================================================================

DO $$
DECLARE
  v_customer_ids uuid[];
  v_batch_ids uuid[];
  v_sale_counter integer := 0;
  v_month_offset integer;
  v_sale_date date;
  v_customer_id uuid;
  v_batch_id uuid;
  v_quantity_oz numeric;
  v_gold_price numeric;
  v_sale_price numeric;
  v_gross_proceeds numeric;
  v_royalty numeric;
  v_net_proceeds numeric;
  v_sale_number text;
BEGIN
  -- Get customer and batch IDs
  SELECT ARRAY_AGG(id) INTO v_customer_ids FROM customers;
  SELECT ARRAY_AGG(id) INTO v_batch_ids FROM batches WHERE status IN ('refined', 'ready_for_sale', 'sold');

  -- Generate sales for last 12 months (3-4 per month)
  FOR v_month_offset IN 0..11 LOOP
    FOR i IN 1..(3 + floor(random()::numeric * 2)::int) LOOP
      v_sale_counter := v_sale_counter + 1;

      -- Random date within the month
      v_sale_date := CURRENT_DATE - (v_month_offset * INTERVAL '1 month') - ((random()::numeric * 25)::int * INTERVAL '1 day');

      -- Random customer
      v_customer_id := v_customer_ids[1 + floor(random()::numeric * array_length(v_customer_ids, 1))::int];

      -- Random batch (if available)
      IF array_length(v_batch_ids, 1) > 0 THEN
        v_batch_id := v_batch_ids[1 + floor(random()::numeric * array_length(v_batch_ids, 1))::int];
      ELSE
        v_batch_id := NULL;
      END IF;

      -- Random quantity between 50 and 500 oz
      v_quantity_oz := 50 + (random()::numeric * 450);

      -- Get gold price for that date
      SELECT london_am_rate INTO v_gold_price
      FROM gold_prices_daily
      WHERE price_date <= v_sale_date
      ORDER BY price_date DESC
      LIMIT 1;

      -- If no price found, use base price
      IF v_gold_price IS NULL THEN
        v_gold_price := 2400 + ((random()::numeric - 0.5) * 200);
      END IF;

      -- Add premium (0-3%)
      v_sale_price := v_gold_price * (1 + (random()::numeric * 0.03));

      -- Calculate proceeds
      v_gross_proceeds := v_quantity_oz * v_sale_price;
      v_royalty := v_gross_proceeds * 0.03; -- 3% royalty
      v_net_proceeds := v_gross_proceeds - v_royalty;

      -- Generate sale number
      v_sale_number := 'SALE-' || TO_CHAR(v_sale_date, 'YYYYMM') || '-' || LPAD(i::text, 3, '0');

      INSERT INTO sales (
        sale_number,
        customer_id,
        batch_id,
        quantity_oz,
        london_am_rate,
        sale_price_per_oz,
        gross_proceeds,
        royalty_amount,
        net_proceeds,
        final_proceeds,
        status,
        sale_date,
        created_at,
        updated_at
      ) VALUES (
        v_sale_number,
        v_customer_id,
        v_batch_id,
        ROUND(v_quantity_oz, 2),
        ROUND(v_gold_price, 2),
        ROUND(v_sale_price, 2),
        ROUND(v_gross_proceeds, 2),
        ROUND(v_royalty, 2),
        ROUND(v_net_proceeds, 2),
        ROUND(v_net_proceeds, 2),
        (ARRAY['approved', 'completed', 'paid'])[1 + floor(random()::numeric * 3)::int],
        v_sale_date,
        v_sale_date,
        v_sale_date + ((random()::numeric * 5)::int * INTERVAL '1 day')
      )
      ON CONFLICT (sale_number) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seeded % sales', v_sale_counter;
END $$;

-- ================================================================
-- 5. UPDATE BATCH STATUSES BASED ON SALES
-- ================================================================

UPDATE batches
SET status = 'sold'
WHERE id IN (
  SELECT DISTINCT batch_id
  FROM sales
  WHERE batch_id IS NOT NULL
  AND status = 'paid'
);

-- ================================================================
-- 6. VERIFY SEEDED DATA
-- ================================================================

DO $$
DECLARE
  v_gold_prices_count integer;
  v_customers_count integer;
  v_batches_count integer;
  v_sales_count integer;
BEGIN
  SELECT COUNT(*) INTO v_gold_prices_count FROM gold_prices_daily;
  SELECT COUNT(*) INTO v_customers_count FROM customers;
  SELECT COUNT(*) INTO v_batches_count FROM batches;
  SELECT COUNT(*) INTO v_sales_count FROM sales;

  RAISE NOTICE '================================';
  RAISE NOTICE 'SEED DATA SUMMARY';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Gold Prices (Daily): %', v_gold_prices_count;
  RAISE NOTICE 'Customers: %', v_customers_count;
  RAISE NOTICE 'Batches: %', v_batches_count;
  RAISE NOTICE 'Sales: %', v_sales_count;
  RAISE NOTICE '================================';
END $$;
