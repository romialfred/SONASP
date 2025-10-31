/*
  # Seed Mansa Ressources - SAFE VERSION (Works with existing data)

  1. Purpose
    - Create Mansa Ressources S.A as both mining company AND customer (if not exists)
    - Uses existing Auramet and StoneX customers (already in database from migration 20251029090000)
    - Creates bank accounts for entities (if not exists)

  2. Data Strategy
    - Checks for existing Mansa Ressources before inserting
    - Uses ON CONFLICT to avoid duplicates
    - Links to existing Auramet and StoneX by email lookup
    - Safe to run multiple times

  3. Note
    - Does NOT use fixed UUIDs - uses database-generated UUIDs
    - Works with real data already in the system
*/

-- Insert Mansa Ressources as a mining company (if not exists)
INSERT INTO mining_companies (
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

-- Insert Mansa Ressources as a customer (for internal sales) (if not exists)
INSERT INTO customers (
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

-- Verify Auramet and StoneX exist (they should from migration 20251029090000)
DO $$
DECLARE
  v_auramet_exists BOOLEAN;
  v_stonex_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM customers WHERE LOWER(email) = 'trading@auramet.com') INTO v_auramet_exists;
  SELECT EXISTS(SELECT 1 FROM customers WHERE LOWER(email) = 'metals@stonex.com') INTO v_stonex_exists;

  IF v_auramet_exists THEN
    RAISE NOTICE '✓ Auramet International already exists in customers table';
  ELSE
    RAISE WARNING '✗ Auramet International NOT FOUND - may need to run migration 20251029090000 first';
  END IF;

  IF v_stonex_exists THEN
    RAISE NOTICE '✓ StoneX Group Inc. already exists in customers table';
  ELSE
    RAISE WARNING '✗ StoneX Group Inc. NOT FOUND - may need to run migration 20251029090000 first';
  END IF;
END $$;

-- Create bank account for Mansa Ressources in stakeholder_bank_accounts (if not exists)
DO $$
DECLARE
  v_mansa_mining_id UUID;
BEGIN
  -- Get Mansa Ressources mining company ID
  SELECT id INTO v_mansa_mining_id
  FROM mining_companies
  WHERE code = 'MANSA-SA';

  IF v_mansa_mining_id IS NOT NULL THEN
    -- Insert bank account if it doesn't exist
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
      v_mansa_mining_id,
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

    RAISE NOTICE '✓ Created bank account for Mansa Ressources (mining company)';
  ELSE
    RAISE WARNING '✗ Could not find Mansa Ressources mining company - bank account not created';
  END IF;
END $$;

-- Create bank account for Mansa Ressources as customer (if not exists)
DO $$
DECLARE
  v_mansa_customer_id UUID;
BEGIN
  -- Get Mansa Ressources customer ID
  SELECT id INTO v_mansa_customer_id
  FROM customers
  WHERE LOWER(email) = 'sales@mansaressources.com';

  IF v_mansa_customer_id IS NOT NULL THEN
    -- Insert bank account if it doesn't exist
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
      v_mansa_customer_id,
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

    RAISE NOTICE '✓ Created bank account for Mansa Ressources (customer)';
  ELSE
    RAISE WARNING '✗ Could not find Mansa Ressources customer - bank account not created';
  END IF;
END $$;

-- Create bank accounts for Auramet (if they don't exist)
DO $$
DECLARE
  v_auramet_id UUID;
BEGIN
  SELECT id INTO v_auramet_id
  FROM customers
  WHERE LOWER(email) = 'trading@auramet.com';

  IF v_auramet_id IS NOT NULL THEN
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
      v_auramet_id,
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

    RAISE NOTICE '✓ Created/verified bank account for Auramet';
  END IF;
END $$;

-- Create bank account for StoneX (if it doesn't exist)
DO $$
DECLARE
  v_stonex_id UUID;
BEGIN
  SELECT id INTO v_stonex_id
  FROM customers
  WHERE LOWER(email) = 'metals@stonex.com';

  IF v_stonex_id IS NOT NULL THEN
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
      v_stonex_id,
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

    RAISE NOTICE '✓ Created/verified bank account for StoneX';
  END IF;
END $$;

-- Create helpful view for easy reference (uses real IDs from database)
CREATE OR REPLACE VIEW mansa_ressources_reference AS
SELECT
  'mining_company' as entity_type,
  mc.id,
  mc.name,
  mc.code,
  mc.id as mining_company_id,
  NULL::uuid as customer_id
FROM mining_companies mc
WHERE mc.code = 'MANSA-SA'
UNION ALL
SELECT
  'customer' as entity_type,
  c.id,
  c.name,
  NULL as code,
  (SELECT id FROM mining_companies WHERE code = 'MANSA-SA') as mining_company_id,
  c.id as customer_id
FROM customers c
WHERE LOWER(c.email) = 'sales@mansaressources.com';

-- Grant access to view
GRANT SELECT ON mansa_ressources_reference TO authenticated;

-- Add helpful comment
COMMENT ON VIEW mansa_ressources_reference IS 'Quick reference for Mansa Ressources IDs (uses real database IDs)';

-- Final verification and summary
DO $$
DECLARE
  v_mansa_mining_count INTEGER;
  v_mansa_customer_count INTEGER;
  v_auramet_count INTEGER;
  v_stonex_count INTEGER;
  v_mansa_mining_id UUID;
  v_mansa_customer_id UUID;
  v_auramet_id UUID;
  v_stonex_id UUID;
BEGIN
  -- Count and get IDs
  SELECT COUNT(*), MAX(id) INTO v_mansa_mining_count, v_mansa_mining_id
  FROM mining_companies WHERE code = 'MANSA-SA';

  SELECT COUNT(*), MAX(id) INTO v_mansa_customer_count, v_mansa_customer_id
  FROM customers WHERE LOWER(email) = 'sales@mansaressources.com';

  SELECT COUNT(*), MAX(id) INTO v_auramet_count, v_auramet_id
  FROM customers WHERE LOWER(email) = 'trading@auramet.com';

  SELECT COUNT(*), MAX(id) INTO v_stonex_count, v_stonex_id
  FROM customers WHERE LOWER(email) = 'metals@stonex.com';

  -- Report results
  RAISE NOTICE '=== SEED DATA VERIFICATION ===';

  IF v_mansa_mining_count > 0 THEN
    RAISE NOTICE '✓ Mansa Ressources (Mining Company): %', v_mansa_mining_id;
  ELSE
    RAISE WARNING '✗ Mansa Ressources NOT found in mining_companies';
  END IF;

  IF v_mansa_customer_count > 0 THEN
    RAISE NOTICE '✓ Mansa Ressources (Customer): %', v_mansa_customer_id;
  ELSE
    RAISE WARNING '✗ Mansa Ressources NOT found in customers';
  END IF;

  IF v_auramet_count > 0 THEN
    RAISE NOTICE '✓ Auramet International: %', v_auramet_id;
  ELSE
    RAISE WARNING '✗ Auramet NOT found in customers';
  END IF;

  IF v_stonex_count > 0 THEN
    RAISE NOTICE '✓ StoneX Group Inc.: %', v_stonex_id;
  ELSE
    RAISE WARNING '✗ StoneX NOT found in customers';
  END IF;

  RAISE NOTICE '=== END VERIFICATION ===';
END $$;
