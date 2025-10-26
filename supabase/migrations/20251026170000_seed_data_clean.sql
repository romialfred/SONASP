/*
  # Clean Seed Data for Gold Sales Management System

  1. Data Created
    - 3 international customers (Dubai, Switzerland, London)
    - 20 gold batches with shipping history
    - 16 sales transactions
    - 13 payments with various statuses

  2. Process
    - Truncate all tables first to start fresh
    - Insert customers
    - Insert batches with proper escaping
    - Create sales linking to batches
    - Create payments linking to sales

  3. Security
    - Temporarily disables RLS for seeding
    - Re-enables RLS after completion
*/

-- Disable RLS temporarily for seed data insertion
SET session_replication_role = replica;

-- Truncate all tables in correct order (respecting foreign keys)
-- Only truncate tables that exist
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE sales_line_items CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE batches CASCADE;
TRUNCATE TABLE customers CASCADE;

-- Insert 3 international customers
INSERT INTO customers (id, name, email, phone, country, contact_person, address, tax_id, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dubai Gold Exchange', 'contact@dubaigold.ae', '+971-4-555-0001', 'United Arab Emirates', 'Ahmed Al-Mansouri', 'Dubai Gold Souk, Dubai', 'UAE-TAX-001', NOW() - INTERVAL '180 days'),
  ('22222222-2222-2222-2222-222222222222', 'Swiss Precious Metals SA', 'info@swissprecious.ch', '+41-22-555-0002', 'Switzerland', 'Jean-Pierre Dubois', 'Rue du Rhône 45, Geneva', 'CHE-123.456.789', NOW() - INTERVAL '150 days'),
  ('33333333-3333-3333-3333-333333333333', 'London Bullion Ltd', 'sales@londonbullion.co.uk', '+44-20-555-0003', 'United Kingdom', 'James Henderson', '10 Hatton Garden, London', 'GB-TAX-002', NOW() - INTERVAL '120 days')
ON CONFLICT (id) DO NOTHING;

-- Insert 20 batches with proper escaping for Côte d'Ivoire
INSERT INTO batches (
  id, batch_number, status, weight_grams, weight_oz, metal_type, purity_percentage,
  origin_country, origin_site, destination, shipped_date, received_at_airport_date,
  received_at_refinery_date, pre_melting_weight_grams, post_melting_weight_grams,
  fineness_percentage, metal_retained_percentage, final_fine_weight_grams, final_fine_weight_oz,
  created_at, comments
) VALUES
  -- Batches 1-5
  (gen_random_uuid(), 'BT-2024-101', 'sold', 5000, 160.75, 'gold', 95.5, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '95 days', NOW() - INTERVAL '93 days', NOW() - INTERVAL '91 days', 5000, 4950, 99.9, 99.0, 4750.5, 152.73, NOW() - INTERVAL '95 days', 'High quality batch'),
  (gen_random_uuid(), 'BT-2024-102', 'sold', 3500, 112.53, 'gold', 96.2, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '90 days', NOW() - INTERVAL '88 days', NOW() - INTERVAL '86 days', 3500, 3465, 99.9, 98.8, 3423.8, 110.10, NOW() - INTERVAL '90 days', 'Premium grade'),
  (gen_random_uuid(), 'BT-2024-103', 'sold', 4200, 135.04, 'gold', 94.8, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '85 days', NOW() - INTERVAL '83 days', NOW() - INTERVAL '81 days', 4200, 4158, 99.8, 99.0, 4116.5, 132.36, NOW() - INTERVAL '85 days', 'Standard batch'),
  (gen_random_uuid(), 'BT-2024-104', 'sold', 2800, 90.02, 'gold', 97.1, 'Cote d''Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '80 days', NOW() - INTERVAL '78 days', NOW() - INTERVAL '76 days', 2800, 2772, 99.9, 99.1, 2747.4, 88.33, NOW() - INTERVAL '80 days', 'Excellent quality'),
  (gen_random_uuid(), 'BT-2024-105', 'sold', 6000, 192.90, 'gold', 93.5, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '75 days', NOW() - INTERVAL '73 days', NOW() - INTERVAL '71 days', 6000, 5940, 99.7, 98.9, 5875.0, 188.86, NOW() - INTERVAL '75 days', 'Large shipment'),

  -- Batches 6-10
  (gen_random_uuid(), 'BT-2024-106', 'sold', 3800, 122.18, 'gold', 95.8, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '70 days', NOW() - INTERVAL '68 days', NOW() - INTERVAL '66 days', 3800, 3762, 99.8, 99.0, 3724.4, 119.71, NOW() - INTERVAL '70 days', 'Good purity'),
  (gen_random_uuid(), 'BT-2024-107', 'sold', 4500, 144.68, 'gold', 96.5, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '65 days', NOW() - INTERVAL '63 days', NOW() - INTERVAL '61 days', 4500, 4455, 99.9, 99.1, 4414.0, 141.90, NOW() - INTERVAL '65 days', 'Premium batch'),
  (gen_random_uuid(), 'BT-2024-108', 'sold', 3200, 102.88, 'gold', 94.2, 'Cote d''Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '60 days', NOW() - INTERVAL '58 days', NOW() - INTERVAL '56 days', 3200, 3168, 99.8, 98.9, 3133.2, 100.71, NOW() - INTERVAL '60 days', 'Standard grade'),
  (gen_random_uuid(), 'BT-2024-109', 'sold', 5500, 176.82, 'gold', 97.3, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '55 days', NOW() - INTERVAL '53 days', NOW() - INTERVAL '51 days', 5500, 5445, 99.9, 99.2, 5401.4, 173.67, NOW() - INTERVAL '55 days', 'High grade'),
  (gen_random_uuid(), 'BT-2024-110', 'sold', 4800, 154.32, 'gold', 95.1, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '50 days', NOW() - INTERVAL '48 days', NOW() - INTERVAL '46 days', 4800, 4752, 99.8, 99.0, 4704.5, 151.23, NOW() - INTERVAL '50 days', 'Quality batch'),

  -- Batches 11-15
  (gen_random_uuid(), 'BT-2024-111', 'sold', 3600, 115.75, 'gold', 96.8, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '45 days', NOW() - INTERVAL '43 days', NOW() - INTERVAL '41 days', 3600, 3564, 99.9, 99.1, 3532.0, 113.56, NOW() - INTERVAL '45 days', 'Excellent batch'),
  (gen_random_uuid(), 'BT-2024-112', 'sold', 2900, 93.24, 'gold', 94.5, 'Cote d''Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '40 days', NOW() - INTERVAL '38 days', NOW() - INTERVAL '36 days', 2900, 2871, 99.7, 98.9, 2839.4, 91.28, NOW() - INTERVAL '40 days', 'Good quality'),
  (gen_random_uuid(), 'BT-2024-113', 'sold', 5200, 167.18, 'gold', 97.5, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '35 days', NOW() - INTERVAL '33 days', NOW() - INTERVAL '31 days', 5200, 5148, 99.9, 99.2, 5107.0, 164.19, NOW() - INTERVAL '35 days', 'Premium quality'),
  (gen_random_uuid(), 'BT-2024-114', 'sold', 4100, 131.82, 'gold', 95.3, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '26 days', 4100, 4059, 99.8, 99.0, 4018.4, 129.20, NOW() - INTERVAL '30 days', 'Standard batch'),
  (gen_random_uuid(), 'BT-2024-115', 'sold', 3300, 106.10, 'gold', 96.1, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '25 days', NOW() - INTERVAL '23 days', NOW() - INTERVAL '21 days', 3300, 3267, 99.9, 99.1, 3237.7, 104.06, NOW() - INTERVAL '25 days', 'Good grade'),

  -- Batches 16-20
  (gen_random_uuid(), 'BT-2024-116', 'sold', 4600, 147.90, 'gold', 94.7, 'Cote d''Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '16 days', 4600, 4554, 99.8, 98.9, 4503.9, 144.78, NOW() - INTERVAL '20 days', 'Quality shipment'),
  (gen_random_uuid(), 'BT-2024-117', 'sold', 5800, 186.47, 'gold', 97.8, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '15 days', NOW() - INTERVAL '13 days', NOW() - INTERVAL '11 days', 5800, 5742, 99.9, 99.2, 5696.0, 183.16, NOW() - INTERVAL '15 days', 'Excellent quality'),
  (gen_random_uuid(), 'BT-2024-118', 'sold', 3900, 125.40, 'gold', 95.6, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', 3900, 3861, 99.8, 99.0, 3822.4, 122.86, NOW() - INTERVAL '12 days', 'High quality'),
  (gen_random_uuid(), 'BT-2024-119', 'sold', 4300, 138.25, 'gold', 96.4, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '8 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days', 4300, 4257, 99.9, 99.1, 4219.6, 135.62, NOW() - INTERVAL '8 days', 'Premium batch'),
  (gen_random_uuid(), 'BT-2024-120', 'sold', 3100, 99.66, 'gold', 94.9, 'Cote d''Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', 3100, 3069, 99.7, 98.9, 3035.2, 97.57, NOW() - INTERVAL '5 days', 'Standard quality')
ON CONFLICT DO NOTHING;

-- Create 16 sales and 13 payments
DO $$
DECLARE
  customer_ids UUID[] := ARRAY[
    '11111111-1111-1111-1111-111111111111'::UUID,
    '22222222-2222-2222-2222-222222222222'::UUID,
    '33333333-3333-3333-3333-333333333333'::UUID
  ];
  batch_record RECORD;
  sale_id UUID;
  customer_id UUID;
  london_am_rate NUMERIC;
  total_amount NUMERIC;
  net_proceeds NUMERIC;
  sale_counter INTEGER := 1;
  payment_counter INTEGER := 1;
  payment_statuses TEXT[] := ARRAY['completed', 'approved', 'verified', 'under_review', 'pending'];
  payment_methods TEXT[] := ARRAY['wire_transfer', 'swift', 'bank_transfer'];
BEGIN
  -- Create sales for first 16 batches only
  FOR batch_record IN
    SELECT * FROM batches ORDER BY created_at LIMIT 16
  LOOP
    -- Rotate through customers
    customer_id := customer_ids[((sale_counter - 1) % 3) + 1];

    -- Generate London AM rate between 2020-2080
    london_am_rate := 2020 + (random() * 60);

    -- Calculate amounts
    total_amount := batch_record.final_fine_weight_oz * london_am_rate;
    net_proceeds := total_amount * 0.97;

    -- Create sale
    sale_id := gen_random_uuid();

    INSERT INTO sales (
      id,
      sale_number,
      customer_id,
      sale_date,
      london_am_rate,
      total_amount,
      freight_cost,
      other_costs,
      gross_proceeds,
      net_smelted_royalty_percentage,
      net_smelted_royalty_amount,
      net_proceeds,
      currency,
      status,
      created_at,
      notes
    ) VALUES (
      sale_id,
      'SL-2024-' || LPAD(sale_counter::TEXT, 3, '0'),
      customer_id,
      (batch_record.created_at + INTERVAL '5 days')::DATE,
      london_am_rate,
      total_amount,
      500.00,
      250.00,
      total_amount - 750.00,
      3.0,
      total_amount * 0.03,
      net_proceeds,
      'USD',
      'approved',
      batch_record.created_at + INTERVAL '5 days',
      'Sale for batch ' || batch_record.batch_number
    );

    -- Create sale line item
    INSERT INTO sales_line_items (
      sale_id,
      batch_id,
      metal_type,
      quantity_grams,
      quantity_oz,
      unit_price,
      fineness_percentage,
      fine_weight_oz,
      line_total
    ) VALUES (
      sale_id,
      batch_record.id,
      'gold',
      batch_record.final_fine_weight_grams,
      batch_record.final_fine_weight_oz,
      london_am_rate,
      batch_record.fineness_percentage,
      batch_record.final_fine_weight_oz,
      total_amount
    );

    -- Create payment for first 13 sales only
    IF sale_counter <= 13 THEN
      INSERT INTO payments (
        id,
        sale_id,
        customer_id,
        invoice_number,
        expected_date,
        actual_date,
        due_date,
        amount,
        currency,
        fx_rate,
        bank_name,
        account_number,
        reference_number,
        transaction_id,
        payment_method,
        proof_url,
        notes,
        status,
        created_at
      ) VALUES (
        gen_random_uuid(),
        sale_id,
        customer_id,
        'INV-2024-' || LPAD(payment_counter::TEXT, 4, '0'),
        (batch_record.created_at + INTERVAL '12 days')::DATE,
        CASE
          WHEN payment_counter % 3 = 0 THEN (batch_record.created_at + INTERVAL '15 days')::DATE
          WHEN payment_counter % 3 = 1 THEN (batch_record.created_at + INTERVAL '13 days')::DATE
          ELSE NULL
        END,
        (batch_record.created_at + INTERVAL '21 days')::DATE,
        net_proceeds,
        'USD',
        1.0,
        CASE (payment_counter % 3)
          WHEN 0 THEN 'Bank of America'
          WHEN 1 THEN 'HSBC International'
          ELSE 'Citibank'
        END,
        'ACC-' || LPAD((100000 + payment_counter)::TEXT, 10, '0'),
        'REF-2024-' || LPAD((100000 + payment_counter)::TEXT, 6, '0'),
        CASE WHEN payment_counter % 3 != 2 THEN 'TXN-' || LPAD((200000 + payment_counter)::TEXT, 10, '0') ELSE NULL END,
        payment_methods[((payment_counter - 1) % 3) + 1],
        CASE WHEN payment_counter % 3 != 2 THEN 'https://example.com/proof-' || payment_counter ELSE NULL END,
        'Payment for sale SL-2024-' || LPAD(sale_counter::TEXT, 3, '0'),
        payment_statuses[((payment_counter - 1) % 5) + 1],
        batch_record.created_at + INTERVAL '12 days'
      );

      payment_counter := payment_counter + 1;
    END IF;

    sale_counter := sale_counter + 1;
  END LOOP;

  RAISE NOTICE 'Created % sales and % payments', sale_counter - 1, payment_counter - 1;
END $$;

-- Re-enable RLS
SET session_replication_role = DEFAULT;

-- Verify counts
DO $$
DECLARE
  customer_count INTEGER;
  batch_count INTEGER;
  sales_count INTEGER;
  payment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO customer_count FROM customers;
  SELECT COUNT(*) INTO batch_count FROM batches;
  SELECT COUNT(*) INTO sales_count FROM sales;
  SELECT COUNT(*) INTO payment_count FROM payments;

  RAISE NOTICE 'Data Summary:';
  RAISE NOTICE '- Customers: %', customer_count;
  RAISE NOTICE '- Batches: %', batch_count;
  RAISE NOTICE '- Sales: %', sales_count;
  RAISE NOTICE '- Payments: %', payment_count;
END $$;
