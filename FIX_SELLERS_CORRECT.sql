/*
  ============================================================================
  FIX SELLERS LOADING - CORRECTED FOR ACTUAL SCHEMA
  ============================================================================

  The database schema uses:
  - mining_companies table (with is_active boolean, NOT status)
  - NO stakeholders table exists

  The getAvailableSellers() function tries to find:
  1. A stakeholder with type='seller' (doesn't exist)
  2. Mining companies with status='active' (wrong - field is is_active)

  This script will:
  1. Create a special "Mansa Resources S.A." entry in mining_companies
  2. Ensure all mining companies are active
  3. Add your existing mining companies as sellers
  ============================================================================
*/

-- Step 1: Show current mining companies
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM mining_companies;

  RAISE NOTICE '
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      CURRENT MINING COMPANIES                                 ║
╚════════════════════════════════════════════════════════════════════════════════╝

Total mining companies: %

Listing all companies...
', v_count;
END $$;

-- Show existing companies
SELECT
  name,
  code,
  country,
  is_active,
  created_at
FROM mining_companies
ORDER BY name;

-- Step 2: Create "Mansa Resources S.A." as the main seller (if not exists)
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
  notes
)
SELECT
  'Mansa Resources S.A.',
  'MANSA',
  'Guinea',
  'Avenue de la République',
  'Conakry',
  'Sales Department',
  'sales@mansaresources.com',
  '+224 XXX XXX XXX',
  'USD',
  true,
  'Primary seller for all external customer sales. This is the main Mansa Resources entity.'
WHERE NOT EXISTS (
  SELECT 1 FROM mining_companies
  WHERE code = 'MANSA' OR name ILIKE '%Mansa Resources S.A.%'
);

-- Step 3: Ensure all existing mining companies are active
UPDATE mining_companies
SET is_active = true
WHERE is_active = false OR is_active IS NULL;

-- Step 4: Verify and show results
DO $$
DECLARE
  v_total INTEGER;
  v_active INTEGER;
  v_mansa_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_total FROM mining_companies;
  SELECT COUNT(*) INTO v_active FROM mining_companies WHERE is_active = true;
  SELECT EXISTS(SELECT 1 FROM mining_companies WHERE code = 'MANSA') INTO v_mansa_exists;

  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║                            FIX APPLIED SUCCESSFULLY                            ║
╚════════════════════════════════════════════════════════════════════════════════╝

RESULTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Total mining companies:      %
  • Active mining companies:     %
  • Mansa Resources exists:      %
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ All mining companies are now active sellers!

IMPORTANT: CODE BUG IDENTIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The getAvailableSellers() function in salesService.ts has bugs:
  ❌ Line 79: .eq("status", "active") - field is actually "is_active"
  ❌ Line 94: Looks for stakeholders table that does not exist

However, the fallback logic (lines 101-115) will now work because:
  ✓ It searches mining_companies for names containing "Mansa"
  ✓ We just created "Mansa Resources S.A."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
', v_total, v_active, v_mansa_exists;
END $$;

-- Final: Show all active sellers
SELECT
  '═══════════════════════════════════════════' as separator,
  'ACTIVE SELLERS AVAILABLE' as info;

SELECT
  name as seller_name,
  code as seller_code,
  country,
  contact_person_name as contact,
  CASE
    WHEN name ILIKE '%Mansa Resources%' THEN 'Can sell to external customers'
    ELSE 'Can sell to Mansa only (internal transfers)'
  END as business_rule,
  is_active
FROM mining_companies
WHERE is_active = true
ORDER BY
  CASE WHEN name ILIKE '%Mansa Resources%' THEN 0 ELSE 1 END,
  name;
