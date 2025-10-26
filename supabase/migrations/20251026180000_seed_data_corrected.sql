/*
  # Clean Seed Data for Gold Sales Management System - Schema Corrected

  1. Data Created
    - 3 international customers (Dubai, Switzerland, London)
    - 20 gold batches with shipping history
    - 16 sales transactions
    - 13 payments with various statuses

  2. Process
    - Truncate all tables first to start fresh
    - Insert customers
    - Insert batches matching actual schema
    - Create sales linking to batches
    - Create payments linking to sales

  3. Security
    - Temporarily disables RLS for seeding
    - Re-enables RLS after completion
*/

-- Disable RLS temporarily for seed data insertion
SET session_replication_role = replica;

-- Truncate all tables in correct order (respecting foreign keys)
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

-- Insert 20 batches with correct column names
-- Schema: batch_number, status, weight_grams, weight_ounces (not weight_oz!), metal_type, shipping_date, destination, comments, created_at
INSERT INTO batches (
  id, batch_number, status, weight_grams, weight_ounces, metal_type, shipping_date,
  destination, comments, created_at
) VALUES
  -- Batches 1-5
  (gen_random_uuid(), 'BT-2024-101', 'sold', 5000, 160.75, 'gold', (NOW() - INTERVAL '95 days')::DATE, 'Dubai Refinery', 'High quality batch', NOW() - INTERVAL '95 days'),
  (gen_random_uuid(), 'BT-2024-102', 'sold', 3500, 112.53, 'gold', (NOW() - INTERVAL '90 days')::DATE, 'Geneva Refinery', 'Premium grade', NOW() - INTERVAL '90 days'),
  (gen_random_uuid(), 'BT-2024-103', 'sold', 4200, 135.04, 'gold', (NOW() - INTERVAL '85 days')::DATE, 'London Refinery', 'Standard batch', NOW() - INTERVAL '85 days'),
  (gen_random_uuid(), 'BT-2024-104', 'sold', 2800, 90.02, 'gold', (NOW() - INTERVAL '80 days')::DATE, 'Singapore Refinery', 'Excellent quality', NOW() - INTERVAL '80 days'),
  (gen_random_uuid(), 'BT-2024-105', 'sold', 6000, 192.90, 'gold', (NOW() - INTERVAL '75 days')::DATE, 'Dubai Refinery', 'Large shipment', NOW() - INTERVAL '75 days'),

  -- Batches 6-10
  (gen_random_uuid(), 'BT-2024-106', 'sold', 3800, 122.18, 'gold', (NOW() - INTERVAL '70 days')::DATE, 'Geneva Refinery', 'Good purity', NOW() - INTERVAL '70 days'),
  (gen_random_uuid(), 'BT-2024-107', 'sold', 4500, 144.68, 'gold', (NOW() - INTERVAL '65 days')::DATE, 'London Refinery', 'Premium batch', NOW() - INTERVAL '65 days'),
  (gen_random_uuid(), 'BT-2024-108', 'sold', 3200, 102.88, 'gold', (NOW() - INTERVAL '60 days')::DATE, 'Singapore Refinery', 'Standard grade', NOW() - INTERVAL '60 days'),
  (gen_random_uuid(), 'BT-2024-109', 'sold', 5500, 176.82, 'gold', (NOW() - INTERVAL '55 days')::DATE, 'Dubai Refinery', 'High grade', NOW() - INTERVAL '55 days'),
  (gen_random_uuid(), 'BT-2024-110', 'sold', 4800, 154.32, 'gold', (NOW() - INTERVAL '50 days')::DATE, 'Geneva Refinery', 'Quality batch', NOW() - INTERVAL '50 days'),

  -- Batches 11-15
  (gen_random_uuid(), 'BT-2024-111', 'sold', 3600, 115.75, 'gold', (NOW() - INTERVAL '45 days')::DATE, 'London Refinery', 'Excellent batch', NOW() - INTERVAL '45 days'),
  (gen_random_uuid(), 'BT-2024-112', 'sold', 2900, 93.24, 'gold', (NOW() - INTERVAL '40 days')::DATE, 'Singapore Refinery', 'Good quality', NOW() - INTERVAL '40 days'),
  (gen_random_uuid(), 'BT-2024-113', 'sold', 5200, 167.18, 'gold', (NOW() - INTERVAL '35 days')::DATE, 'Dubai Refinery', 'Premium quality', NOW() - INTERVAL '35 days'),
  (gen_random_uuid(), 'BT-2024-114', 'sold', 4100, 131.82, 'gold', (NOW() - INTERVAL '30 days')::DATE, 'Geneva Refinery', 'Standard batch', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), 'BT-2024-115', 'sold', 3300, 106.10, 'gold', (NOW() - INTERVAL '25 days')::DATE, 'London Refinery', 'Good grade', NOW() - INTERVAL '25 days'),

  -- Batches 16-20
  (gen_random_uuid(), 'BT-2024-116', 'sold', 4600, 147.90, 'gold', (NOW() - INTERVAL '20 days')::DATE, 'Singapore Refinery', 'Quality shipment', NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), 'BT-2024-117', 'sold', 5800, 186.47, 'gold', (NOW() - INTERVAL '15 days')::DATE, 'Dubai Refinery', 'Excellent quality', NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), 'BT-2024-118', 'sold', 3900, 125.40, 'gold', (NOW() - INTERVAL '12 days')::DATE, 'Geneva Refinery', 'High quality', NOW() - INTERVAL '12 days'),
  (gen_random_uuid(), 'BT-2024-119', 'sold', 4300, 138.25, 'gold', (NOW() - INTERVAL '8 days')::DATE, 'London Refinery', 'Premium batch', NOW() - INTERVAL '8 days'),
  (gen_random_uuid(), 'BT-2024-120', 'sold', 3100, 99.66, 'gold', (NOW() - INTERVAL '5 days')::DATE, 'Singapore Refinery', 'Standard quality', NOW() - INTERVAL '5 days')
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

    -- Calculate amounts (using weight_ounces, not weight_oz)
    total_amount := batch_record.weight_ounces * london_am_rate;
    net_proceeds := total_amount * 0.97;

    -- Create sale
    sale_id := gen_random_uuid();

    INSERT INTO sales (
      id,
      sale_number,
      customer_id,
      sale_date,
      quantity_oz,
      london_am_rate,
      freight_cost,
      other_costs,
      gross_proceeds,
      net_proceeds,
      royalties,
      final_proceeds,
      currency,
      status,
      created_at,
      notes
    ) VALUES (
      sale_id,
      'SL-2024-' || LPAD(sale_counter::TEXT, 3, '0'),
      customer_id,
      (batch_record.created_at + INTERVAL '5 days')::DATE,
      batch_record.weight_ounces,
      london_am_rate,
      500.00,
      250.00,
      total_amount - 750.00,
      net_proceeds,
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
      line_total
    ) VALUES (
      sale_id,
      batch_record.id,
      'gold',
      batch_record.weight_grams,
      batch_record.weight_ounces,
      london_am_rate,
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

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Data Summary:';
  RAISE NOTICE '- Customers: %', customer_count;
  RAISE NOTICE '- Batches: %', batch_count;
  RAISE NOTICE '- Sales: %', sales_count;
  RAISE NOTICE '- Payments: %', payment_count;
  RAISE NOTICE '===========================================';
END $$;
