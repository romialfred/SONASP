/*
  IMPORTANT: Execute this SQL in Supabase SQL Editor

  This script adds the required customers for the Sales business rules:
  - Mansa Resources S.A. (internal company)
  - Auramet Trading LLC (external customer)
  - StoneX Financial Inc. (external customer)

  Business Rules:
  1. Mining Company → sells to → Mansa Resources ONLY
  2. Mansa Resources → sells to → Auramet or StoneX ONLY
*/

-- Insert Mansa Resources S.A. (internal company)
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
  'Mansa Resources S.A.',
  'sales@mansaresources.com',
  '+224 123 456 789',
  'Guinea',
  'Conakry, Guinea',
  'Finance Department',
  'GN-TAX-001',
  'Net 30 days',
  0,
  'active'
) ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  country = EXCLUDED.country,
  address = EXCLUDED.address,
  contact_person = EXCLUDED.contact_person,
  tax_id = EXCLUDED.tax_id,
  payment_terms = EXCLUDED.payment_terms,
  status = EXCLUDED.status,
  updated_at = now();

-- Insert Auramet Trading LLC (external customer)
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
  'Auramet Trading LLC',
  'trading@auramet.com',
  '+1 (212) 980-9085',
  'United States',
  '1 State Street Plaza, New York, NY 10004, USA',
  'Precious Metals Trading Desk',
  'US-EIN-12-3456789',
  'Wire Transfer - Immediate',
  50000000,
  'active'
) ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  country = EXCLUDED.country,
  address = EXCLUDED.address,
  contact_person = EXCLUDED.contact_person,
  tax_id = EXCLUDED.tax_id,
  payment_terms = EXCLUDED.payment_terms,
  credit_limit = EXCLUDED.credit_limit,
  status = EXCLUDED.status,
  updated_at = now();

-- Insert StoneX Financial Inc. (external customer)
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
  'StoneX Financial Inc.',
  'metals@stonex.com',
  '+1 (312) 580-6000',
  'United States',
  '155 Pfingsten Road, Deerfield, IL 60015, USA',
  'Physical Metals Trading',
  'US-EIN-98-7654321',
  'Wire Transfer - Immediate',
  50000000,
  'active'
) ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  country = EXCLUDED.country,
  address = EXCLUDED.address,
  contact_person = EXCLUDED.contact_person,
  tax_id = EXCLUDED.tax_id,
  payment_terms = EXCLUDED.payment_terms,
  credit_limit = EXCLUDED.credit_limit,
  status = EXCLUDED.status,
  updated_at = now();

-- Verify customers were created
DO $$
DECLARE
  customer_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO customer_count
  FROM customers
  WHERE name IN ('Mansa Resources S.A.', 'Auramet Trading LLC', 'StoneX Financial Inc.');

  RAISE NOTICE '✅ Successfully created/updated % customer(s)', customer_count;

  IF customer_count = 3 THEN
    RAISE NOTICE '🎉 All required customers are present!';
  ELSE
    RAISE WARNING '⚠️  Expected 3 customers, but found %', customer_count;
  END IF;
END $$;

-- Display the customers
SELECT
  name,
  email,
  country,
  status,
  payment_terms,
  credit_limit
FROM customers
WHERE name IN ('Mansa Resources S.A.', 'Auramet Trading LLC', 'StoneX Financial Inc.')
ORDER BY name;
