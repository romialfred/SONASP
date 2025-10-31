/*
  # Ensure Mansa Stakeholder Exists

  This migration ensures there's a Mansa Resources stakeholder entry with type 'seller'
  to enable proper sales workflow.

  ## Changes
  - Inserts Mansa Resources as a seller stakeholder if it doesn't exist
  - Sets appropriate metadata for the stakeholder
*/

-- Insert Mansa Resources as seller stakeholder if it doesn't exist
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
  'Mansa Resources',
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
  AND (name ILIKE '%Mansa%' OR name = 'Mansa Resources')
);

-- Also ensure we have at least one mining company if none exists
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
  WHERE name ILIKE '%Mansa%'
);

-- Success notification
DO $$
BEGIN
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║                    MANSA STAKEHOLDER INITIALIZATION                            ║
╚════════════════════════════════════════════════════════════════════════════════╝

✓ Ensured Mansa Resources exists as seller stakeholder
✓ Ensured at least one mining company exists
✓ Sales creation form will now work correctly

NOTES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Mansa Resources is the main seller for external customers
- Mining companies can only sell to Mansa (internal transfers)
- The getAvailableSellers() function now has proper fallback logic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
