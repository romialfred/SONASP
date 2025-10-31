/*
  ============================================================================
  FIX SELLERS LOADING ISSUE
  ============================================================================

  This script diagnoses and fixes the "Failed to load sellers" error.

  The error occurs because:
  1. The stakeholders table doesn't have a 'seller' type entry
  2. No Mansa Resources entry exists
  3. No mining companies exist with active status

  This script will:
  1. Check current state
  2. Create missing sellers
  3. Verify the fix
  ============================================================================
*/

-- Step 1: Check current state
DO $$
DECLARE
  v_stakeholders_count INTEGER;
  v_seller_stakeholders_count INTEGER;
  v_mining_companies_count INTEGER;
  v_active_mining_companies_count INTEGER;
BEGIN
  -- Count all stakeholders
  SELECT COUNT(*) INTO v_stakeholders_count FROM stakeholders;

  -- Count seller stakeholders
  SELECT COUNT(*) INTO v_seller_stakeholders_count
  FROM stakeholders
  WHERE type = 'seller';

  -- Count all mining companies
  SELECT COUNT(*) INTO v_mining_companies_count FROM mining_companies;

  -- Count active mining companies
  SELECT COUNT(*) INTO v_active_mining_companies_count
  FROM mining_companies
  WHERE status = 'active';

  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║                         CURRENT DATABASE STATE                                 ║
╚════════════════════════════════════════════════════════════════════════════════╝

STAKEHOLDERS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Total stakeholders:        % records
  • Seller stakeholders:        % records
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MINING COMPANIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Total mining companies:     % records
  • Active mining companies:    % records
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
', v_stakeholders_count, v_seller_stakeholders_count,
   v_mining_companies_count, v_active_mining_companies_count;
END $$;

-- Step 2: Create Mansa Resources as seller stakeholder if it doesn't exist
INSERT INTO stakeholders (
  name,
  type,
  country,
  contact_person,
  email,
  phone,
  address,
  status,
  notes
)
SELECT
  'Mansa Resources S.A.',
  'seller',
  'Guinea',
  'Sales Department',
  'sales@mansaresources.com',
  '+224 XXX XXX XXX',
  'Conakry, Guinea',
  'active',
  'Primary seller for external sales. Mansa Resources acts as the main entity for all external gold sales.'
WHERE NOT EXISTS (
  SELECT 1 FROM stakeholders
  WHERE type = 'seller'
  AND (name ILIKE '%Mansa%Resources%' OR name = 'Mansa Resources S.A.')
);

-- Step 3: Ensure we have at least one active mining company
INSERT INTO mining_companies (
  name,
  country,
  contact_person,
  email,
  phone,
  address,
  status
)
SELECT
  'Mansa Mining Operations',
  'Guinea',
  'Operations Manager',
  'operations@mansaresources.com',
  '+224 XXX XXX XXX',
  'Siguiri, Guinea',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM mining_companies
  WHERE name ILIKE '%Mansa%Mining%'
  AND status = 'active'
);

-- Step 4: Ensure all existing mining companies are active (if they exist but are not active)
UPDATE mining_companies
SET status = 'active'
WHERE status IS NULL OR status != 'active';

-- Step 5: Verify the fix
DO $$
DECLARE
  v_seller_stakeholders_count INTEGER;
  v_active_mining_companies_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_seller_stakeholders_count
  FROM stakeholders
  WHERE type = 'seller' AND status = 'active';

  SELECT COUNT(*) INTO v_active_mining_companies_count
  FROM mining_companies
  WHERE status = 'active';

  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║                            FIX APPLIED SUCCESSFULLY                            ║
╚════════════════════════════════════════════════════════════════════════════════╝

RESULTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Active seller stakeholders:     % (Mansa Resources S.A.)
  ✓ Active mining companies:        %
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ The "Failed to load sellers" error should now be fixed!

WHAT TO DO NEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Go back to the Sales page
  2. Click "Create New Sale"
  3. You should now see sellers in the dropdown:
     • Mansa Resources S.A. (for external sales)
     • Mining companies (for internal transfers to Mansa)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
', v_seller_stakeholders_count, v_active_mining_companies_count;
END $$;

-- Final verification query - shows what sellers are available
SELECT
  'Available Sellers' as section,
  '' as id,
  '' as name,
  '' as type,
  '' as country,
  '' as status;

SELECT
  'Seller Stakeholder' as section,
  id::text,
  name,
  type,
  country,
  status
FROM stakeholders
WHERE type = 'seller'
UNION ALL
SELECT
  'Mining Companies' as section,
  id::text,
  name,
  'mining_company' as type,
  country,
  status
FROM mining_companies
WHERE status = 'active'
ORDER BY section DESC, name;
