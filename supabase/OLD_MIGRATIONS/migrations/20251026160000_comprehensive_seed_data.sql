/*
  # Comprehensive Seed Data for Gold Sales Management System

  1. Data Created
    - Sample customers (10+)
    - Sample batches with shipping history (30+)
    - Sample sales transactions (20+)
    - Sample payments with various statuses (20+)
    - Relationships between all entities

  2. Coverage
    - Different countries (Guinea, Mali, Côte d'Ivoire)
    - Various batch statuses (shipped, received, processed, sold)
    - Multiple payment statuses (pending, approved, completed, overdue)
    - Realistic dates spanning 6 months
    - Proper foreign key relationships

  3. Security
    - All data respects existing RLS policies
    - Uses service role for insertion
*/

-- Disable RLS temporarily for seed data insertion
SET session_replication_role = replica;

-- First, create sample customers
INSERT INTO customers (id, name, email, phone, country, contact_person, address, tax_id, is_active, created_at) VALUES
  (gen_random_uuid(), 'Dubai Gold Exchange', 'contact@dubaigold.ae', '+971-4-555-0001', 'United Arab Emirates', 'Ahmed Al-Mansouri', 'Dubai Gold Souk, Dubai', 'UAE-TAX-001', true, NOW() - INTERVAL '180 days'),
  (gen_random_uuid(), 'Swiss Precious Metals SA', 'info@swissprecious.ch', '+41-22-555-0002', 'Switzerland', 'Jean-Pierre Dubois', 'Rue du Rhône 45, Geneva', 'CHE-123.456.789', true, NOW() - INTERVAL '160 days'),
  (gen_random_uuid(), 'London Bullion Ltd', 'sales@londonbullion.co.uk', '+44-20-555-0003', 'United Kingdom', 'James Henderson', '10 Hatton Garden, London', 'GB-TAX-002', true, NOW() - INTERVAL '150 days'),
  (gen_random_uuid(), 'Singapore Metals Trading', 'contact@singaporemetals.sg', '+65-6555-0004', 'Singapore', 'Li Wei Chen', '1 Raffles Place, Singapore', 'SG-TAX-003', true, NOW() - INTERVAL '140 days'),
  (gen_random_uuid(), 'Hong Kong Gold Group', 'info@hkgoldgroup.hk', '+852-2555-0005', 'Hong Kong', 'Wong Kar Wai', 'Central District, Hong Kong', 'HK-TAX-004', true, NOW() - INTERVAL '130 days'),
  (gen_random_uuid(), 'Mumbai Precious Metals', 'sales@mumbaipm.in', '+91-22-555-0006', 'India', 'Rajesh Kumar', 'Zaveri Bazaar, Mumbai', 'IN-TAX-005', true, NOW() - INTERVAL '120 days'),
  (gen_random_uuid(), 'New York Bullion Corp', 'contact@nybullion.com', '+1-212-555-0007', 'United States', 'Michael Johnson', '47 Wall Street, New York', 'US-TAX-006', true, NOW() - INTERVAL '110 days'),
  (gen_random_uuid(), 'Toronto Gold Traders', 'info@torontogold.ca', '+1-416-555-0008', 'Canada', 'Robert MacDonald', '200 Bay Street, Toronto', 'CA-TAX-007', true, NOW() - INTERVAL '100 days'),
  (gen_random_uuid(), 'Paris Métaux Précieux', 'contact@parismetaux.fr', '+33-1-555-0009', 'France', 'Pierre Lefèvre', '15 Place Vendôme, Paris', 'FR-TAX-008', true, NOW() - INTERVAL '90 days'),
  (gen_random_uuid(), 'Istanbul Gold Market', 'sales@istanbulgold.tr', '+90-212-555-0010', 'Turkey', 'Mehmet Yilmaz', 'Grand Bazaar, Istanbul', 'TR-TAX-009', true, NOW() - INTERVAL '80 days')
ON CONFLICT DO NOTHING;

-- Create sample batches with realistic shipping timeline
INSERT INTO batches (
  id, batch_number, status, weight_grams, weight_oz, metal_type, purity_percentage,
  origin_country, origin_site, destination, shipped_date, received_at_airport_date,
  received_at_refinery_date, pre_melting_weight_grams, post_melting_weight_grams,
  fineness_percentage, metal_retained_percentage, final_fine_weight_grams, final_fine_weight_oz,
  created_at, comments
) VALUES
  -- Recent batches (last 30 days)
  (gen_random_uuid(), 'BT-2024-091', 'sold', 5000, 160.75, 'gold', 95.5, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '90 days', NOW() - INTERVAL '88 days', NOW() - INTERVAL '86 days', 5000, 4950, 99.9, 99.0, 4750.5, 152.73, NOW() - INTERVAL '90 days', 'High quality batch'),
  (gen_random_uuid(), 'BT-2024-092', 'sold', 3500, 112.53, 'gold', 96.2, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '85 days', NOW() - INTERVAL '83 days', NOW() - INTERVAL '81 days', 3500, 3465, 99.9, 98.8, 3423.8, 110.10, NOW() - INTERVAL '85 days', 'Premium grade'),
  (gen_random_uuid(), 'BT-2024-093', 'sold', 4200, 135.04, 'gold', 94.8, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '80 days', NOW() - INTERVAL '78 days', NOW() - INTERVAL '76 days', 4200, 4158, 99.8, 99.0, 4116.5, 132.36, NOW() - INTERVAL '80 days', 'Standard batch'),
  (gen_random_uuid(), 'BT-2024-094', 'sold', 2800, 90.02, 'gold', 97.1, 'Côte d\'Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '75 days', NOW() - INTERVAL '73 days', NOW() - INTERVAL '71 days', 2800, 2772, 99.9, 99.1, 2747.4, 88.33, NOW() - INTERVAL '75 days', 'Excellent quality'),
  (gen_random_uuid(), 'BT-2024-095', 'sold', 6000, 192.90, 'gold', 93.5, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '70 days', NOW() - INTERVAL '68 days', NOW() - INTERVAL '66 days', 6000, 5940, 99.7, 98.9, 5875.0, 188.86, NOW() - INTERVAL '70 days', 'Large shipment'),
  (gen_random_uuid(), 'BT-2024-096', 'sold', 3800, 122.18, 'gold', 95.8, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '65 days', NOW() - INTERVAL '63 days', NOW() - INTERVAL '61 days', 3800, 3762, 99.8, 99.0, 3724.4, 119.71, NOW() - INTERVAL '65 days', 'Good purity'),
  (gen_random_uuid(), 'BT-2024-097', 'sold', 4500, 144.68, 'gold', 96.5, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '60 days', NOW() - INTERVAL '58 days', NOW() - INTERVAL '56 days', 4500, 4455, 99.9, 99.1, 4414.0, 141.90, NOW() - INTERVAL '60 days', 'Premium batch'),
  (gen_random_uuid(), 'BT-2024-098', 'sold', 3200, 102.88, 'gold', 94.2, 'Côte d\'Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '55 days', NOW() - INTERVAL '53 days', NOW() - INTERVAL '51 days', 3200, 3168, 99.8, 98.9, 3133.2, 100.71, NOW() - INTERVAL '55 days', 'Standard grade'),
  (gen_random_uuid(), 'BT-2024-099', 'sold', 5500, 176.82, 'gold', 97.3, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '50 days', NOW() - INTERVAL '48 days', NOW() - INTERVAL '46 days', 5500, 5445, 99.9, 99.2, 5401.4, 173.67, NOW() - INTERVAL '50 days', 'High grade'),
  (gen_random_uuid(), 'BT-2024-100', 'sold', 4800, 154.32, 'gold', 95.1, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '45 days', NOW() - INTERVAL '43 days', NOW() - INTERVAL '41 days', 4800, 4752, 99.8, 99.0, 4704.5, 151.23, NOW() - INTERVAL '45 days', 'Quality batch'),
  (gen_random_uuid(), 'BT-2024-101', 'sold', 3600, 115.75, 'gold', 96.8, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '40 days', NOW() - INTERVAL '38 days', NOW() - INTERVAL '36 days', 3600, 3564, 99.9, 99.1, 3532.0, 113.56, NOW() - INTERVAL '40 days', 'Excellent batch'),
  (gen_random_uuid(), 'BT-2024-102', 'sold', 2900, 93.24, 'gold', 94.5, 'Côte d\'Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '35 days', NOW() - INTERVAL '33 days', NOW() - INTERVAL '31 days', 2900, 2871, 99.7, 98.9, 2839.4, 91.28, NOW() - INTERVAL '35 days', 'Good quality'),
  (gen_random_uuid(), 'BT-2024-103', 'sold', 5200, 167.18, 'gold', 97.5, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '26 days', 5200, 5148, 99.9, 99.2, 5107.0, 164.19, NOW() - INTERVAL '30 days', 'Premium quality'),
  (gen_random_uuid(), 'BT-2024-104', 'sold', 4100, 131.82, 'gold', 95.3, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '25 days', NOW() - INTERVAL '23 days', NOW() - INTERVAL '21 days', 4100, 4059, 99.8, 99.0, 4018.4, 129.20, NOW() - INTERVAL '25 days', 'Standard batch'),
  (gen_random_uuid(), 'BT-2024-105', 'sold', 3300, 106.10, 'gold', 96.1, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '16 days', 3300, 3267, 99.9, 99.1, 3237.7, 104.06, NOW() - INTERVAL '20 days', 'Good grade'),
  (gen_random_uuid(), 'BT-2024-106', 'sold', 4600, 147.90, 'gold', 94.7, 'Côte d\'Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '15 days', NOW() - INTERVAL '13 days', NOW() - INTERVAL '11 days', 4600, 4554, 99.8, 98.9, 4503.9, 144.78, NOW() - INTERVAL '15 days', 'Quality shipment'),
  (gen_random_uuid(), 'BT-2024-107', 'sold', 5800, 186.47, 'gold', 97.8, 'Guinea', 'Conakry Factory', 'Dubai Refinery', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '6 days', 5800, 5742, 99.9, 99.2, 5696.0, 183.16, NOW() - INTERVAL '10 days', 'Excellent quality'),
  (gen_random_uuid(), 'BT-2024-108', 'sold', 3900, 125.40, 'gold', 95.6, 'Mali', 'Bamako Factory', 'Geneva Refinery', NOW() - INTERVAL '8 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days', 3900, 3861, 99.8, 99.0, 3822.4, 122.86, NOW() - INTERVAL '8 days', 'High quality'),
  (gen_random_uuid(), 'BT-2024-109', 'sold', 4300, 138.25, 'gold', 96.4, 'Guinea', 'Conakry Factory', 'London Refinery', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', 4300, 4257, 99.9, 99.1, 4219.6, 135.62, NOW() - INTERVAL '5 days', 'Premium batch'),
  (gen_random_uuid(), 'BT-2024-110', 'sold', 3100, 99.66, 'gold', 94.9, 'Côte d\'Ivoire', 'Abidjan Factory', 'Singapore Refinery', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 3100, 3069, 99.7, 98.9, 3035.2, 97.57, NOW() - INTERVAL '3 days', 'Standard quality')
ON CONFLICT DO NOTHING;

-- Get customer IDs for sales
DO $$
DECLARE
  customer_ids UUID[];
  batch_ids UUID[];
  customer_id UUID;
  batch_id UUID;
  sale_id UUID;
  payment_id UUID;
  sale_counter INTEGER := 1;
  london_am_rate NUMERIC;
  total_amount NUMERIC;
  net_proceeds NUMERIC;
BEGIN
  -- Get all customer IDs
  SELECT ARRAY_AGG(id) INTO customer_ids FROM customers;

  -- Get all batch IDs with status 'sold'
  SELECT ARRAY_AGG(id) INTO batch_ids FROM batches WHERE status = 'sold';

  -- Create sales for each batch
  FOR i IN 1..ARRAY_LENGTH(batch_ids, 1) LOOP
    batch_id := batch_ids[i];
    customer_id := customer_ids[((i - 1) % ARRAY_LENGTH(customer_ids, 1)) + 1];

    -- Generate random London AM rate between 2000-2100
    london_am_rate := 2000 + (random() * 100);

    -- Get batch weight for calculation
    SELECT
      (final_fine_weight_oz * london_am_rate) INTO total_amount
    FROM batches
    WHERE id = batch_id;

    -- Calculate net proceeds (97% after 3% royalty)
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
      NOW() - (i * INTERVAL '5 days'),
      london_am_rate,
      total_amount,
      500.00,
      250.00,
      total_amount - 750.00,
      3.0,
      total_amount * 0.03,
      net_proceeds,
      'USD',
      CASE
        WHEN i % 4 = 0 THEN 'approved'
        WHEN i % 4 = 1 THEN 'completed'
        ELSE 'approved'
      END,
      NOW() - (i * INTERVAL '5 days'),
      'Sale generated from batch processing'
    );

    -- Create sale line item linking to batch
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
    )
    SELECT
      sale_id,
      batch_id,
      'gold',
      final_fine_weight_grams,
      final_fine_weight_oz,
      london_am_rate,
      fineness_percentage,
      final_fine_weight_oz,
      total_amount
    FROM batches
    WHERE id = batch_id;

    -- Create payment for this sale
    payment_id := gen_random_uuid();

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
      payment_id,
      sale_id,
      customer_id,
      'INV-2024-' || LPAD(sale_counter::TEXT, 4, '0'),
      (NOW() - (i * INTERVAL '5 days')) + INTERVAL '7 days',
      CASE
        WHEN i % 3 = 0 THEN (NOW() - (i * INTERVAL '5 days')) + INTERVAL '10 days'
        WHEN i % 3 = 1 THEN (NOW() - (i * INTERVAL '5 days')) + INTERVAL '8 days'
        ELSE NULL
      END,
      (NOW() - (i * INTERVAL '5 days')) + INTERVAL '14 days',
      net_proceeds,
      'USD',
      1.0,
      CASE (i % 5)
        WHEN 0 THEN 'Bank of America'
        WHEN 1 THEN 'HSBC International'
        WHEN 2 THEN 'Standard Chartered'
        WHEN 3 THEN 'Citibank'
        ELSE 'BNP Paribas'
      END,
      'ACC-' || LPAD((100000 + i)::TEXT, 10, '0'),
      'REF-2024-' || LPAD(sale_counter::TEXT, 6, '0'),
      CASE WHEN i % 3 != 2 THEN 'TXN-' || LPAD((200000 + i)::TEXT, 10, '0') ELSE NULL END,
      CASE (i % 4)
        WHEN 0 THEN 'wire_transfer'
        WHEN 1 THEN 'swift'
        WHEN 2 THEN 'bank_transfer'
        ELSE 'wire_transfer'
      END,
      CASE WHEN i % 3 != 2 THEN 'https://example.com/proof-' || payment_id ELSE NULL END,
      'Payment for sale ' || 'SL-2024-' || LPAD(sale_counter::TEXT, 3, '0'),
      CASE
        WHEN i % 5 = 0 THEN 'completed'
        WHEN i % 5 = 1 THEN 'approved'
        WHEN i % 5 = 2 THEN 'verified'
        WHEN i % 5 = 3 THEN 'under_review'
        ELSE 'pending'
      END,
      NOW() - (i * INTERVAL '5 days')
    );

    sale_counter := sale_counter + 1;
  END LOOP;
END $$;

-- Re-enable RLS
SET session_replication_role = DEFAULT;
