/*
  # Seed 10 Months of Data for Reports (Jan-Oct 2025)

  Complete data seeding for report validation with correct schema

  ## Data
  - 10 Customers
  - 100 Batches (Jan-Oct 2025)
  - 40-50 Sales transactions
*/

-- Cleanup
DELETE FROM sales WHERE sale_number LIKE 'SL-2025-%';
DELETE FROM batches WHERE batch_number LIKE 'B-2025-%';
DELETE FROM customers WHERE email LIKE '%@demo.goldshipper.com';
DELETE FROM transport_companies WHERE name LIKE 'Demo %';
DELETE FROM refineries WHERE name LIKE 'Demo %';

-- Customers
INSERT INTO customers (id, name, email, phone, country, status, created_at) VALUES
  (gen_random_uuid(), 'HSBC Precious Metals', 'hsbc@demo.goldshipper.com', '+442075911234', 'United Kingdom', 'active', '2024-12-01'),
  (gen_random_uuid(), 'UBS Gold Trading', 'ubs@demo.goldshipper.com', '+41442341111', 'Switzerland', 'active', '2024-12-01'),
  (gen_random_uuid(), 'Dubai Gold Exchange', 'dubai@demo.goldshipper.com', '+97143651111', 'UAE', 'active', '2024-12-01'),
  (gen_random_uuid(), 'Johnson Matthey', 'jm@demo.goldshipper.com', '+442076698000', 'United Kingdom', 'active', '2024-12-01'),
  (gen_random_uuid(), 'Singapore Precious Metals', 'singapore@demo.goldshipper.com', '+6562361234', 'Singapore', 'active', '2024-12-15'),
  (gen_random_uuid(), 'Zurich Gold Vault', 'zurich@demo.goldshipper.com', '+41443451234', 'Switzerland', 'active', '2024-12-20'),
  (gen_random_uuid(), 'Emirates Gold Trading', 'emirates@demo.goldshipper.com', '+97143651235', 'UAE', 'active', '2025-01-05'),
  (gen_random_uuid(), 'London Bullion Market', 'london@demo.goldshipper.com', '+442078278000', 'United Kingdom', 'active', '2025-01-10'),
  (gen_random_uuid(), 'Swiss Gold Refiners', 'swiss@demo.goldshipper.com', '+41443451235', 'Switzerland', 'active', '2025-01-15'),
  (gen_random_uuid(), 'Asia Pacific Gold', 'apac@demo.goldshipper.com', '+6562361235', 'Singapore', 'active', '2025-02-01')
ON CONFLICT DO NOTHING;

-- Generate Batches and Sales
DO $$
DECLARE
  batch_counter INTEGER := 0;
  batch_date DATE;
  batch_status TEXT;
  batch_uuid UUID;
  batch_weight_g NUMERIC;
  batch_weight_oz NUMERIC;
  customers UUID[];
  month_offset INTEGER;
  sales_created INTEGER := 0;
BEGIN
  SELECT ARRAY_AGG(id) INTO customers FROM customers WHERE email LIKE '%@demo.goldshipper.com';

  FOR month_offset IN 0..9 LOOP
    FOR i IN 1..10 LOOP
      batch_counter := batch_counter + 1;
      batch_date := ('2025-01-01'::DATE + (month_offset * INTERVAL '1 month') + ((RANDOM() * 28)::INTEGER * INTERVAL '1 day'));
      
      -- Use correct status values
      IF month_offset <= 2 THEN
        batch_status := CASE WHEN RANDOM() < 0.8 THEN 'sold' ELSE 'processed' END;
      ELSIF month_offset <= 5 THEN
        batch_status := CASE WHEN RANDOM() < 0.5 THEN 'sold' WHEN RANDOM() < 0.75 THEN 'processed' ELSE 'received_refinery' END;
      ELSIF month_offset <= 7 THEN
        batch_status := CASE WHEN RANDOM() < 0.3 THEN 'sold' WHEN RANDOM() < 0.6 THEN 'processed' ELSE 'received_airport' END;
      ELSE
        batch_status := CASE WHEN RANDOM() < 0.2 THEN 'processed' WHEN RANDOM() < 0.5 THEN 'received_airport' ELSE 'shipped_refinery' END;
      END IF;

      batch_weight_g := 500 + (RANDOM() * 2500);
      batch_weight_oz := batch_weight_g / 31.1035;
      batch_uuid := gen_random_uuid();

      INSERT INTO batches (id, batch_number, status, weight_grams, weight_ounces, shipping_date, supplier, carrier, created_at, updated_at)
      VALUES (
        batch_uuid, 'B-2025-' || LPAD(batch_counter::TEXT, 5, '0'), batch_status,
        ROUND(batch_weight_g::NUMERIC, 2), ROUND(batch_weight_oz::NUMERIC, 2), batch_date,
        (ARRAY['Siguiri Mining Co.', 'Kankan Gold Ltd.', 'Dinguiraye Resources', 'Mandiana Gold Corp.', 'Kouroussa Mining'])[1 + (RANDOM() * 4)::INTEGER],
        (ARRAY['Securitas Transport', 'Brinks International', 'DHL Secure', 'G4S Logistics'])[1 + (RANDOM() * 3)::INTEGER],
        batch_date, batch_date
      );

      IF batch_status = 'sold' THEN
        sales_created := sales_created + 1;
        INSERT INTO sales (
          id, sale_number, customer_id, batch_id, quantity_oz, london_am_rate, freight_cost, other_costs,
          gross_proceeds, net_proceeds, royalties, final_proceeds, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), 'SL-2025-' || LPAD(sales_created::TEXT, 5, '0'),
          customers[1 + (RANDOM() * (ARRAY_LENGTH(customers, 1) - 1))::INTEGER], batch_uuid,
          ROUND((batch_weight_oz * 0.97)::NUMERIC, 2),
          ROUND((2650 + ((batch_date - '2025-01-01'::DATE) * 0.5) + ((RANDOM() * 40) - 20))::NUMERIC, 2),
          150.00, 50.00,
          ROUND(((batch_weight_oz * 0.97) * (2650 + ((batch_date - '2025-01-01'::DATE) * 0.5)))::NUMERIC, 2),
          ROUND((((batch_weight_oz * 0.97) * (2650 + ((batch_date - '2025-01-01'::DATE) * 0.5))) - 200)::NUMERIC, 2),
          ROUND((((batch_weight_oz * 0.97) * (2650 + ((batch_date - '2025-01-01'::DATE) * 0.5))) * 0.03)::NUMERIC, 2),
          ROUND((((batch_weight_oz * 0.97) * (2650 + ((batch_date - '2025-01-01'::DATE) * 0.5))) - 200 - (((batch_weight_oz * 0.97) * (2650 + ((batch_date - '2025-01-01'::DATE) * 0.5))) * 0.03))::NUMERIC, 2),
          'completed', batch_date + INTERVAL '7 days', batch_date + INTERVAL '7 days'
        );
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE '✓ Seeded % batches and % sales (Jan-Oct 2025)', batch_counter, sales_created;
END $$;
