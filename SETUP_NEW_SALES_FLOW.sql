/*
  ============================================
  SETUP NEW GOLD SALES FLOW
  ============================================

  This configures the new sales flow structure:

  Flow 1 - KGM:
  - Kourousa Guinea Mining (KGM) → Mansa Management Middle East (MMME) 100%
  - MMME → Auranet 93%
  - MMME → Aurion 5%
  - MMME → CIG 2%

  Flow 2 - SMK:
  - Société des Mines Komana (SMK) → Hummingbird Resources (HBR) 100%
  - HBR → Auramet 100%

  ============================================
*/

-- ====================================
-- STEP 1: Create new customers
-- ====================================

-- Insert Mansa Management Middle East (MMME)
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
  'Mansa Management Middle East',
  'contact@mansa-me.com',
  '+971 4 XXX XXXX',
  'United Arab Emirates',
  'Dubai',
  'TBD',
  'UAE-MMME-001',
  'Net 30 days',
  5000000,
  'active'
) ON CONFLICT DO NOTHING;

-- Insert Hummingbird Resources (HBR)
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
  'Hummingbird Resources',
  'contact@hummingbirdresources.com',
  '+44 20 XXXX XXXX',
  'United Kingdom',
  'London',
  'TBD',
  'UK-HBR-001',
  'Net 30 days',
  5000000,
  'active'
) ON CONFLICT DO NOTHING;

-- Insert Auranet
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
  'Auranet International',
  'contact@auranet.com',
  '+1 XXX XXX XXXX',
  'United States',
  'New York',
  'TBD',
  'US-AURANET-001',
  'Net 30 days',
  10000000,
  'active'
) ON CONFLICT DO NOTHING;

-- Insert Aurion
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
  'Aurion Trading',
  'contact@aurion-trading.com',
  '+41 XX XXX XX XX',
  'Switzerland',
  'Geneva',
  'TBD',
  'CH-AURION-001',
  'Net 30 days',
  2000000,
  'active'
) ON CONFLICT DO NOTHING;

-- Insert CIG (Coris Investment Group)
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
  'Coris Investment Group',
  'contact@corisinvestment.com',
  '+226 XX XX XX XX',
  'Burkina Faso',
  'Ouagadougou',
  'TBD',
  'BF-CIG-001',
  'Net 30 days',
  1000000,
  'active'
) ON CONFLICT DO NOTHING;

-- ====================================
-- STEP 2: Get IDs for configuration
-- ====================================

DO $$
DECLARE
  v_kgm_id uuid;
  v_smk_id uuid;
  v_mmme_id uuid;
  v_hbr_id uuid;
  v_auranet_id uuid;
  v_aurion_id uuid;
  v_cig_id uuid;
  v_auramet_id uuid;
  v_admin_id uuid;
BEGIN
  -- Get mining company IDs
  SELECT id INTO v_kgm_id FROM mining_companies WHERE abbreviation = 'KGM' LIMIT 1;
  SELECT id INTO v_smk_id FROM mining_companies WHERE abbreviation = 'SMK' LIMIT 1;

  -- Get customer IDs
  SELECT id INTO v_mmme_id FROM customers WHERE name = 'Mansa Management Middle East' LIMIT 1;
  SELECT id INTO v_hbr_id FROM customers WHERE name = 'Hummingbird Resources' LIMIT 1;
  SELECT id INTO v_auranet_id FROM customers WHERE name = 'Auranet International' LIMIT 1;
  SELECT id INTO v_aurion_id FROM customers WHERE name = 'Aurion Trading' LIMIT 1;
  SELECT id INTO v_cig_id FROM customers WHERE name = 'Coris Investment Group' LIMIT 1;
  SELECT id INTO v_auramet_id FROM customers WHERE name LIKE 'Auramet%' LIMIT 1;

  -- Get admin user ID
  SELECT id INTO v_admin_id FROM user_profiles ORDER BY created_at LIMIT 1;

  -- ====================================
  -- STEP 3: Setup Flow 1 - KGM
  -- ====================================

  -- Remove old KGM settings
  DELETE FROM gold_sales_settings WHERE mining_company_id = v_kgm_id;

  -- KGM → MMME 100%
  IF v_kgm_id IS NOT NULL AND v_mmme_id IS NOT NULL THEN
    INSERT INTO gold_sales_settings (
      mining_company_id,
      customer_id,
      max_stock_percentage,
      sale_method,
      refining_fees_paid_by_customer,
      transport_fees_paid_by_customer,
      is_active,
      effective_date,
      created_by,
      updated_by,
      notes
    ) VALUES (
      v_kgm_id,
      v_mmme_id,
      100,
      'standard',
      true,
      true,
      true,
      CURRENT_DATE,
      v_admin_id,
      v_admin_id,
      'KGM sells 100% to MMME'
    );

    RAISE NOTICE 'Created: KGM → MMME (100%)';
  END IF;

  -- ====================================
  -- STEP 4: Setup MMME as seller
  -- ====================================
  -- Note: MMME will need to be added as a mining_company or we need a different table
  -- For now, we'll document this as a limitation

  RAISE NOTICE 'Note: MMME distribution to Auranet (93%), Aurion (5%), CIG (2%) needs custom implementation';

  -- ====================================
  -- STEP 5: Setup Flow 2 - SMK
  -- ====================================

  -- Remove old SMK to Auramet direct setting
  DELETE FROM gold_sales_settings WHERE mining_company_id = v_smk_id AND customer_id = v_auramet_id;

  -- SMK → HBR 100%
  IF v_smk_id IS NOT NULL AND v_hbr_id IS NOT NULL THEN
    INSERT INTO gold_sales_settings (
      mining_company_id,
      customer_id,
      max_stock_percentage,
      sale_method,
      refining_fees_paid_by_customer,
      transport_fees_paid_by_customer,
      is_active,
      effective_date,
      created_by,
      updated_by,
      notes
    ) VALUES (
      v_smk_id,
      v_hbr_id,
      100,
      'standard',
      false,
      false,
      true,
      CURRENT_DATE,
      v_admin_id,
      v_admin_id,
      'SMK sells 100% to HBR'
    );

    RAISE NOTICE 'Created: SMK → HBR (100%)';
  END IF;

  RAISE NOTICE 'Note: HBR to Auramet (100%) needs custom implementation';

  -- ====================================
  -- VERIFICATION
  -- ====================================

  RAISE NOTICE '=== Setup Complete ===';
  RAISE NOTICE 'Please verify the gold_sales_settings table';

END $$;

-- Show results
SELECT
  mc.abbreviation as mine,
  c.name as customer,
  gss.max_stock_percentage as percentage,
  gss.is_active,
  gss.notes
FROM gold_sales_settings gss
JOIN mining_companies mc ON mc.id = gss.mining_company_id
JOIN customers c ON c.id = gss.customer_id
WHERE gss.is_active = true
ORDER BY mc.abbreviation, gss.max_stock_percentage DESC;
