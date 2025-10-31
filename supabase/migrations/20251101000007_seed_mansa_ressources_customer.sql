/*
  # Seed Mansa Ressources as Mining Company and Customer

  1. Purpose
    - Create Mansa Ressources S.A as both mining company AND customer
    - Create Auramet as external customer
    - Create StoneX as external customer
    - Set up bank accounts for all entities

  2. Data Created
    - Mansa Ressources in mining_companies table
    - Mansa Ressources in customers table
    - Auramet in customers table
    - StoneX in customers table
    - Bank accounts for each entity

  3. Note
    - Uses ON CONFLICT to avoid duplicates
    - Safe to run multiple times
*/

-- Insert Mansa Ressources as a mining company
INSERT INTO mining_companies (
  id,
  name,
  code,
  country,
  address,
  city,
  contact_person_name,
  contact_person_email,
  contact_person_phone,
  default_currency,
  is_active,
  notes,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid, -- Fixed UUID for reference
  'Mansa Ressources S.A',
  'MANSA-SA',
  'Guinea',
  'Conakry Business District',
  'Conakry',
  'Management Team',
  'contact@mansaressources.com',
  '+224 123 456 789',
  'USD',
  true,
  'Parent company - both buyer from mining companies and seller to external customers',
  now()
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = true,
  updated_at = now();

-- Insert Mansa Ressources as a customer (for internal sales)
INSERT INTO customers (
  id,
  name,
  email,
  phone,
  country,
  address,
  contact_person,
  payment_terms,
  status,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid, -- Fixed UUID for reference
  'Mansa Ressources S.A',
  'sales@mansaressources.com',
  '+224 123 456 789',
  'Guinea',
  'Conakry Business District, Conakry, Guinea',
  'Sales Department',
  'Net 30 days',
  'active',
  now()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'active',
  updated_at = now();

-- Insert Auramet as external customer
INSERT INTO customers (
  id,
  name,
  email,
  phone,
  country,
  address,
  contact_person,
  payment_terms,
  status,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid, -- Fixed UUID for reference
  'Auramet International',
  'trading@auramet.com',
  '+1 212 555 0100',
  'United States',
  'New York, NY, USA',
  'Trading Desk',
  'Net 15 days',
  'active',
  now()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'active',
  updated_at = now();

-- Insert StoneX as external customer
INSERT INTO customers (
  id,
  name,
  email,
  phone,
  country,
  address,
  contact_person,
  payment_terms,
  status,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000004'::uuid, -- Fixed UUID for reference
  'StoneX Financial',
  'metals@stonex.com',
  '+1 312 555 0200',
  'United States',
  'Chicago, IL, USA',
  'Metals Trading',
  'Net 15 days',
  'active',
  now()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'active',
  updated_at = now();

-- Create bank account for Mansa Ressources (in stakeholder_bank_accounts)
INSERT INTO stakeholder_bank_accounts (
  stakeholder_type,
  stakeholder_id,
  account_name,
  bank_name,
  bank_country,
  account_number,
  account_currency,
  swift_code,
  is_primary,
  is_active,
  created_at
)
VALUES (
  'mining_company',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Mansa Ressources S.A - Operations',
  'Société Générale Guinea',
  'Guinea',
  'GN1234567890123456',
  'USD',
  'SOGEGING',
  true,
  true,
  now()
)
ON CONFLICT DO NOTHING;

-- Create bank account for Auramet (in customer_banks)
INSERT INTO customer_banks (
  customer_id,
  bank_name,
  country,
  city,
  account_number,
  swift_code,
  currency,
  is_primary,
  is_active,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  'JP Morgan Chase',
  'United States',
  'New York',
  'US1234567890',
  'CHASUS33',
  'USD',
  true,
  true,
  now()
)
ON CONFLICT DO NOTHING;

-- Create bank account for StoneX (in customer_banks)
INSERT INTO customer_banks (
  customer_id,
  bank_name,
  country,
  city,
  account_number,
  swift_code,
  currency,
  is_primary,
  is_active,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000004'::uuid,
  'Bank of America',
  'United States',
  'Chicago',
  'US0987654321',
  'BOFAUS3N',
  'USD',
  true,
  true,
  now()
)
ON CONFLICT DO NOTHING;

-- Create additional bank account for Mansa Ressources as customer
INSERT INTO customer_banks (
  customer_id,
  bank_name,
  country,
  city,
  account_number,
  swift_code,
  currency,
  is_primary,
  is_active,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Société Générale Guinea',
  'Guinea',
  'Conakry',
  'GN1234567890123456',
  'SOGEGING',
  'USD',
  true,
  true,
  now()
)
ON CONFLICT DO NOTHING;

-- Create view for easy reference
CREATE OR REPLACE VIEW mansa_ressources_reference AS
SELECT
  'mining_company' as entity_type,
  id,
  name,
  '00000000-0000-0000-0000-000000000001'::uuid as mining_company_id
FROM mining_companies
WHERE code = 'MANSA-SA'
UNION ALL
SELECT
  'customer' as entity_type,
  id,
  name,
  '00000000-0000-0000-0000-000000000001'::uuid as mining_company_id
FROM customers
WHERE email = 'sales@mansaressources.com';

-- Grant access to view
GRANT SELECT ON mansa_ressources_reference TO authenticated;

-- Add helpful comments
COMMENT ON VIEW mansa_ressources_reference IS 'Quick reference for Mansa Ressources IDs in different tables';

-- Success message with key IDs
DO $$
BEGIN
  RAISE NOTICE 'Mansa Ressources seeded successfully';
  RAISE NOTICE 'Mining Company ID: 00000000-0000-0000-0000-000000000001';
  RAISE NOTICE 'Customer ID (Mansa): 00000000-0000-0000-0000-000000000002';
  RAISE NOTICE 'Customer ID (Auramet): 00000000-0000-0000-0000-000000000003';
  RAISE NOTICE 'Customer ID (StoneX): 00000000-0000-0000-0000-000000000004';
END $$;
