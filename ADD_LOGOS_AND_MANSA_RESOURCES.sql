/*
  # Add Logos Support and Mansa Resources Customer

  1. Schema Changes
    - Add logo_url column to customers table
    - Add logo_url column to mining_companies table

  2. Data Setup
    - Insert/Update Mansa Resources as default customer
    - Update mining companies with logo paths

  3. Purpose
    - Enable professional invoices with company logos
    - Set up Mansa Resources as the aggregator customer
    - Support the business rule: all mines sell to Mansa Resources
*/

-- =====================================================
-- 1. ADD LOGO COLUMNS TO TABLES
-- =====================================================

-- Add logo_url to customers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE customers ADD COLUMN logo_url text;
    COMMENT ON COLUMN customers.logo_url IS 'URL or path to customer logo for invoices and documents';
  END IF;
END $$;

-- Add logo_url to mining_companies table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mining_companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE mining_companies ADD COLUMN logo_url text;
    COMMENT ON COLUMN mining_companies.logo_url IS 'URL or path to mining company logo for invoices and documents';
  END IF;
END $$;

-- =====================================================
-- 2. INSERT/UPDATE MANSA RESOURCES CUSTOMER
-- =====================================================

INSERT INTO customers (
  name,
  email,
  phone,
  country,
  address,
  city,
  postal_code,
  contact_person,
  tax_id,
  payment_terms,
  is_active,
  logo_url,
  created_at,
  updated_at
)
VALUES (
  'Mansa Resources S.A.',
  'contact@mansaresources.com',
  '+224 123 456 789',
  'Guinea',
  'Conakry Business District, Kaloum',
  'Conakry',
  'BP 1234',
  'Operations Manager',
  'GN-TAX-2024-MR001',
  'Net 30',
  true,
  '/horizontal_-_colorx10.png',
  now(),
  now()
)
ON CONFLICT (email)
DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  country = EXCLUDED.country,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  postal_code = EXCLUDED.postal_code,
  contact_person = EXCLUDED.contact_person,
  tax_id = EXCLUDED.tax_id,
  payment_terms = EXCLUDED.payment_terms,
  is_active = EXCLUDED.is_active,
  logo_url = EXCLUDED.logo_url,
  updated_at = now();

-- =====================================================
-- 3. UPDATE MINING COMPANIES WITH LOGO PATHS
-- =====================================================

-- Update mining companies logos (placeholder paths - replace with actual logo files)
UPDATE mining_companies
SET logo_url = CASE abbreviation
  WHEN 'KGM' THEN '/logos/kouroussa-logo.png'
  WHEN 'DGB' THEN '/logos/dugbe-logo.png'
  WHEN 'SMK' THEN '/logos/smk-logo.png'
  ELSE logo_url
END
WHERE abbreviation IN ('KGM', 'DGB', 'SMK');

-- =====================================================
-- 4. VERIFICATION QUERIES (OPTIONAL - FOR TESTING)
-- =====================================================

-- Verify Mansa Resources was created/updated
-- SELECT * FROM customers WHERE email = 'contact@mansaresources.com';

-- Verify mining companies have logo URLs
-- SELECT id, name, abbreviation, logo_url FROM mining_companies WHERE abbreviation IN ('KGM', 'DGB', 'SMK');

-- Check all customers with logos
-- SELECT id, name, email, logo_url FROM customers WHERE logo_url IS NOT NULL;
