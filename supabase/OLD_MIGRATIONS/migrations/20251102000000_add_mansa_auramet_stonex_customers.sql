/*
  # Add Mansa Resources, Auramet, and StoneX as Customers

  1. New Customers
    - Mansa Resources S.A. (for internal sales from mining companies)
    - Auramet Trading LLC (external customer)
    - StoneX Financial Inc. (external customer)

  2. Purpose
    - Enable business rule: Mining Company → sells to → Mansa Resources
    - Enable business rule: Mansa Resources → sells to → Auramet or StoneX

  3. Security
    - All customers are set to 'active' status
    - Email addresses are unique and valid
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
