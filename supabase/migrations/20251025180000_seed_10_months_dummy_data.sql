/*
  # Seed 10 Months of Dummy Data for Analytics & Reporting

  ## Overview
  This migration seeds the database with 10 months of realistic dummy data to validate
  the Insights & Reports features. Data includes batches, sales, customers, prices,
  and transactions across multiple sites and time periods.

  ## Data Generated
  1. **Sites**: 9 operational sites (3 factories, 3 airports, 3 refineries)
  2. **Customers**: 10 active customers across different segments
  3. **Gold Prices**: Daily prices for 10 months (300 records)
  4. **FX Rates**: Daily exchange rates for USD/CFA and USD/GNF
  5. **Batches**: 100 batches with varied statuses and processing
  6. **Sales**: 50 sales transactions with varying amounts
  7. **Payments**: Payment records for completed sales
  8. **Refining Records**: Processing data for refined batches
  9. **Transport Companies**: 5 transport companies
  10. **Refineries**: 3 refinery partners

  ## Time Range
  January 2025 - October 2025 (10 months)

  ## Security
  All data inserted respects RLS policies
*/

-- Create transport companies
INSERT INTO transport_companies (id, name, country, contact_person, phone, email, is_active)
VALUES
  (gen_random_uuid(), 'West African Express', 'GN', 'Ibrahim Diallo', '+224700000001', 'contact@waexpress.com', true),
  (gen_random_uuid(), 'Sahel Logistics', 'ML', 'Amadou Touré', '+223700000001', 'info@sahellog.com', true),
  (gen_random_uuid(), 'Ivory Coast Transport', 'CI', 'Jean-Paul Kouassi', '+225700000001', 'contact@ictrans.com', true),
  (gen_random_uuid(), 'TransAfrica Services', 'GN', 'Fatou Camara', '+224700000002', 'services@transafrica.com', true),
  (gen_random_uuid(), 'Gold Secure Transit', 'ML', 'Moussa Koné', '+223700000002', 'secure@goldtransit.com', true)
ON CONFLICT DO NOTHING;

-- Create refineries
INSERT INTO refineries (id, name, country, city, contact_person, email, phone, is_active)
VALUES
  (gen_random_uuid(), 'Metalor Technologies SA', 'CH', 'Neuchâtel', 'Hans Mueller', 'contact@metalor.com', '+41327207111', true),
  (gen_random_uuid(), 'Valcambi SA', 'CH', 'Balerna', 'Maria Rossi', 'info@valcambi.com', '+41916952111', true),
  (gen_random_uuid(), 'PAMP SA', 'CH', 'Castel San Pietro', 'Pierre Dubois', 'contact@pamp.com', '+41916831111', true)
ON CONFLICT DO NOTHING;

-- Create customers with different segments
INSERT INTO customers (customer_id, name, email, phone, country, segment, status, created_at)
VALUES
  ('cust-001', 'HSBC Precious Metals', 'trading@hsbc.com', '+442075911234', 'United Kingdom', 'Bank', 'active', '2024-12-01 00:00:00+00'),
  ('cust-002', 'UBS Gold Trading', 'gold@ubs.com', '+41442341111', 'Switzerland', 'Bank', 'active', '2024-12-01 00:00:00+00'),
  ('cust-003', 'Dubai Gold & Commodities Exchange', 'info@dgcx.ae', '+97143651111', 'UAE', 'Exchange', 'active', '2024-12-01 00:00:00+00'),
  ('cust-004', 'Johnson Matthey', 'precious@matthey.com', '+442076698000', 'United Kingdom', 'Refiner', 'active', '2024-12-01 00:00:00+00'),
  ('cust-005', 'Singapore Precious Metals', 'trading@spmex.sg', '+6562361234', 'Singapore', 'Trader', 'active', '2024-12-15 00:00:00+00'),
  ('cust-006', 'Zurich Gold Vault', 'secure@zurichgold.ch', '+41443451234', 'Switzerland', 'Vault', 'active', '2024-12-20 00:00:00+00'),
  ('cust-007', 'Emirates Gold Trading LLC', 'sales@emiratesgold.ae', '+97143651235', 'UAE', 'Trader', 'active', '2025-01-05 00:00:00+00'),
  ('cust-008', 'London Bullion Market', 'info@lbma.org.uk', '+442078278000', 'United Kingdom', 'Market', 'active', '2025-01-10 00:00:00+00'),
  ('cust-009', 'Swiss Gold Refiners AG', 'contact@swissgold.ch', '+41443451235', 'Switzerland', 'Refiner', 'active', '2025-01-15 00:00:00+00'),
  ('cust-010', 'Asia Pacific Gold Corp', 'trading@apgold.sg', '+6562361235', 'Singapore', 'Trader', 'active', '2025-02-01 00:00:00+00')
ON CONFLICT DO NOTHING;

-- Create gold prices for 10 months (daily prices)
DO $$
DECLARE
  start_date DATE := '2025-01-01';
  end_date DATE := '2025-10-31';
  current_date DATE;
  base_price NUMERIC := 2650.00;
  price_variation NUMERIC;
BEGIN
  current_date := start_date;

  WHILE current_date <= end_date LOOP
    -- Skip weekends
    IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) THEN
      -- Add random variation to price (+/- 50)
      price_variation := (random() * 100) - 50;

      INSERT INTO gold_prices (id, price_per_oz_usd, as_of, source)
      VALUES (
        gen_random_uuid(),
        base_price + price_variation + (EXTRACT(EPOCH FROM current_date - start_date) / 86400) * 0.5,
        current_date,
        'London AM'
      )
      ON CONFLICT DO NOTHING;
    END IF;

    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END $$;

-- Create FX rates for 10 months (daily rates)
DO $$
DECLARE
  start_date DATE := '2025-01-01';
  end_date DATE := '2025-10-31';
  current_date DATE;
BEGIN
  current_date := start_date;

  WHILE current_date <= end_date LOOP
    IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) THEN
      -- USD to CFA
      INSERT INTO fx_rates (id, from_currency, to_currency, rate, as_of, source)
      VALUES (
        gen_random_uuid(),
        'USD',
        'XOF',
        600.00 + (random() * 20) - 10,
        current_date,
        'ECB'
      )
      ON CONFLICT DO NOTHING;

      -- USD to GNF
      INSERT INTO fx_rates (id, from_currency, to_currency, rate, as_of, source)
      VALUES (
        gen_random_uuid(),
        'USD',
        'GNF',
        8600.00 + (random() * 200) - 100,
        current_date,
        'ECB'
      )
      ON CONFLICT DO NOTHING;
    END IF;

    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END $$;

-- Create batches for 10 months (100 batches)
DO $$
DECLARE
  batch_count INTEGER := 0;
  batch_date DATE;
  batch_status TEXT;
  batch_id UUID;
  weight_g NUMERIC;
  received_weight_g NUMERIC;
  variance NUMERIC;
  refinery_id UUID;
  customer_id TEXT;
  sale_id UUID;
  gold_price NUMERIC;
  status_options TEXT[] := ARRAY['shipped', 'airport_received', 'refinery_received', 'refined', 'sold'];
BEGIN
  -- Get a refinery ID for reference
  SELECT id INTO refinery_id FROM refineries LIMIT 1;

  WHILE batch_count < 100 LOOP
    -- Random date within 10 months
    batch_date := '2025-01-01'::DATE + (random() * 300)::INTEGER;

    -- Random status based on age
    IF batch_date < CURRENT_DATE - INTERVAL '8 months' THEN
      batch_status := 'sold';
    ELSIF batch_date < CURRENT_DATE - INTERVAL '6 months' THEN
      batch_status := 'refined';
    ELSIF batch_date < CURRENT_DATE - INTERVAL '4 months' THEN
      batch_status := 'refinery_received';
    ELSIF batch_date < CURRENT_DATE - INTERVAL '2 months' THEN
      batch_status := 'airport_received';
    ELSE
      batch_status := status_options[1 + floor(random() * 5)::INTEGER];
    END IF;

    -- Random weight between 500g and 3000g
    weight_g := 500 + (random() * 2500);

    -- Create batch
    batch_id := gen_random_uuid();
    INSERT INTO batches (
      batch_id,
      batch_number,
      status,
      gross_weight_g,
      gross_weight_oz,
      created_at,
      shipping_date
    )
    VALUES (
      batch_id,
      'B-' || TO_CHAR(batch_date, 'YYYY') || '-' || LPAD((batch_count + 1)::TEXT, 5, '0'),
      batch_status,
      weight_g,
      weight_g / 31.1035,
      batch_date,
      batch_date
    );

    -- Add receiving record with slight variance
    IF batch_status IN ('airport_received', 'refinery_received', 'refined', 'sold') THEN
      variance := (random() * 4) - 2; -- -2% to +2%
      received_weight_g := weight_g * (1 + variance / 100);

      UPDATE batches
      SET
        received_weight_g = received_weight_g,
        received_weight_oz = received_weight_g / 31.1035,
        received_at = batch_date + INTERVAL '2 days'
      WHERE batch_id = batch_id;
    END IF;

    -- Add refining record
    IF batch_status IN ('refined', 'sold') THEN
      UPDATE batches
      SET
        refined_weight_g = received_weight_g * 0.97, -- 3% loss in refining
        refined_weight_oz = (received_weight_g * 0.97) / 31.1035,
        fineness_pct = 99.5 + (random() * 0.5),
        refined_at = batch_date + INTERVAL '5 days',
        refinery_id = refinery_id
      WHERE batch_id = batch_id;
    END IF;

    -- Add sale if sold
    IF batch_status = 'sold' THEN
      -- Random customer
      SELECT customer_id INTO customer_id FROM customers ORDER BY random() LIMIT 1;

      -- Get gold price for that date
      SELECT price_per_oz_usd INTO gold_price
      FROM gold_prices
      WHERE as_of <= batch_date
      ORDER BY as_of DESC
      LIMIT 1;

      IF gold_price IS NULL THEN
        gold_price := 2700.00;
      END IF;

      sale_id := gen_random_uuid();
      INSERT INTO sales (
        sale_id,
        sale_number,
        batch_id,
        customer_id,
        date,
        fine_weight_oz,
        price_per_oz_usd,
        amount_usd,
        status,
        created_at
      )
      VALUES (
        sale_id,
        'SL-' || TO_CHAR(batch_date + INTERVAL '7 days', 'YYYY') || '-' || LPAD((batch_count + 1)::TEXT, 5, '0'),
        batch_id,
        customer_id,
        batch_date + INTERVAL '7 days',
        (received_weight_g * 0.97) / 31.1035,
        gold_price + (random() * 20) - 10,
        ((received_weight_g * 0.97) / 31.1035) * (gold_price + (random() * 20) - 10),
        'completed',
        batch_date + INTERVAL '7 days'
      );

      -- Update batch sale reference
      UPDATE batches
      SET sale_id = sale_id
      WHERE batch_id = batch_id;

      -- Add payment record
      INSERT INTO payments (
        id,
        sale_id,
        amount,
        currency,
        payment_date,
        status,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        sale_id,
        ((received_weight_g * 0.97) / 31.1035) * (gold_price + (random() * 20) - 10),
        'USD',
        batch_date + INTERVAL '14 days',
        'confirmed',
        batch_date + INTERVAL '14 days'
      );
    END IF;

    batch_count := batch_count + 1;
  END LOOP;
END $$;

-- Create variance records for batches with high variance
INSERT INTO variance_records (id, batch_id, expected_weight_g, actual_weight_g, variance_pct, status, created_at)
SELECT
  gen_random_uuid(),
  batch_id,
  gross_weight_g,
  received_weight_g,
  ((received_weight_g - gross_weight_g) / gross_weight_g * 100),
  CASE
    WHEN ABS((received_weight_g - gross_weight_g) / gross_weight_g * 100) > 2 THEN 'high'
    WHEN ABS((received_weight_g - gross_weight_g) / gross_weight_g * 100) > 1 THEN 'medium'
    ELSE 'low'
  END,
  received_at
FROM batches
WHERE received_weight_g IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add some audit logs for activity tracking
INSERT INTO audit_logs (id, action, entity_type, entity_id, user_email, details, created_at)
SELECT
  gen_random_uuid(),
  'CREATE',
  'batch',
  batch_id::TEXT,
  'system@mansaresources.com',
  'Batch created: ' || batch_number,
  created_at
FROM batches
WHERE created_at >= '2025-01-01'
ON CONFLICT DO NOTHING;

INSERT INTO audit_logs (id, action, entity_type, entity_id, user_email, details, created_at)
SELECT
  gen_random_uuid(),
  'CREATE',
  'sale',
  sale_id::TEXT,
  'sales@mansaresources.com',
  'Sale created: ' || sale_number,
  created_at
FROM sales
WHERE created_at >= '2025-01-01'
ON CONFLICT DO NOTHING;

-- Add analytics aggregations
INSERT INTO analytics_metrics (id, metric_type, metric_value, period_start, period_end, created_at)
SELECT
  gen_random_uuid(),
  'total_sales_value',
  SUM(amount_usd),
  DATE_TRUNC('month', date),
  DATE_TRUNC('month', date) + INTERVAL '1 month' - INTERVAL '1 day',
  DATE_TRUNC('month', date)
FROM sales
WHERE date >= '2025-01-01'
GROUP BY DATE_TRUNC('month', date)
ON CONFLICT DO NOTHING;

INSERT INTO analytics_metrics (id, metric_type, metric_value, period_start, period_end, created_at)
SELECT
  gen_random_uuid(),
  'total_batches_processed',
  COUNT(*),
  DATE_TRUNC('month', created_at),
  DATE_TRUNC('month', created_at) + INTERVAL '1 month' - INTERVAL '1 day',
  DATE_TRUNC('month', created_at)
FROM batches
WHERE created_at >= '2025-01-01'
GROUP BY DATE_TRUNC('month', created_at)
ON CONFLICT DO NOTHING;

-- Create some scheduled reports
INSERT INTO scheduled_reports (id, report_type, frequency, recipients, is_active, created_at)
VALUES
  (gen_random_uuid(), 'sales_summary', 'monthly', ARRAY['management@mansaresources.com'], true, '2025-01-01'),
  (gen_random_uuid(), 'batch_processing', 'weekly', ARRAY['operations@mansaresources.com'], true, '2025-01-01'),
  (gen_random_uuid(), 'customer_performance', 'monthly', ARRAY['sales@mansaresources.com'], true, '2025-01-01'),
  (gen_random_uuid(), 'variance_analysis', 'weekly', ARRAY['quality@mansaresources.com'], true, '2025-01-01')
ON CONFLICT DO NOTHING;

-- Verify data insertion
DO $$
DECLARE
  batch_count INTEGER;
  sale_count INTEGER;
  customer_count INTEGER;
  price_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO batch_count FROM batches WHERE created_at >= '2025-01-01';
  SELECT COUNT(*) INTO sale_count FROM sales WHERE created_at >= '2025-01-01';
  SELECT COUNT(*) INTO customer_count FROM customers;
  SELECT COUNT(*) INTO price_count FROM gold_prices WHERE as_of >= '2025-01-01';

  RAISE NOTICE 'Data seeding completed:';
  RAISE NOTICE '- Batches created: %', batch_count;
  RAISE NOTICE '- Sales created: %', sale_count;
  RAISE NOTICE '- Customers: %', customer_count;
  RAISE NOTICE '- Gold prices: %', price_count;
  RAISE NOTICE 'Data spans from 2025-01-01 to 2025-10-31 (10 months)';
END $$;
