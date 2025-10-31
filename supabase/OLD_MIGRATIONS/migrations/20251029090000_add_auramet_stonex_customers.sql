/*
  # Add Auramet and StoneX customers

  1. New Data
    - Add Auramet International as customer
    - Add StoneX Group Inc. as customer

  2. Customer Details
    - Auramet: Leading precious metals refiner and supplier based in USA
    - StoneX: Global financial services network specializing in commodities
*/

-- Insert Auramet International
INSERT INTO customers (
  name,
  email,
  phone,
  country,
  address,
  contact_person,
  tax_id,
  payment_terms,
  credit_limit,
  status
) VALUES (
  'Auramet International',
  'trading@auramet.com',
  '+1 (212) 809-2700',
  'United States',
  '175 Varick Street, 8th Floor, New York, NY 10014',
  'Trading Department',
  'US-TAX-AURAMET-2024',
  'Net 30 days',
  5000000,
  'active'
) ON CONFLICT (email) DO NOTHING;

-- Insert StoneX Group Inc.
INSERT INTO customers (
  name,
  email,
  phone,
  country,
  address,
  contact_person,
  tax_id,
  payment_terms,
  credit_limit,
  status
) VALUES (
  'StoneX Group Inc.',
  'metals@stonex.com',
  '+1 (212) 485-3500',
  'United States',
  'Brookfield Place, 230 Park Ave, New York, NY 10169',
  'Metals Trading Desk',
  'US-TAX-STONEX-2024',
  'Net 15 days',
  10000000,
  'active'
) ON CONFLICT (email) DO NOTHING;

-- Verify the customers were created
DO $$
DECLARE
  customer_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO customer_count
  FROM customers
  WHERE name IN ('Auramet International', 'StoneX Group Inc.');

  IF customer_count = 2 THEN
    RAISE NOTICE 'Successfully created % customers', customer_count;
  ELSE
    RAISE WARNING 'Expected 2 customers, but found %', customer_count;
  END IF;
END $$;
