/*
  ═══════════════════════════════════════════════════════════════════════════
  🔧 FIX MINING COMPANIES DROPDOWN - CORRECT VERSION
  ═══════════════════════════════════════════════════════════════════════════

  IMPORTANT: The column is "is_active" (boolean), NOT "status" (text)!
*/

-- Step 1: Show current status
DO $$
DECLARE
  v_total INT;
  v_active INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true)
  INTO v_total, v_active
  FROM mining_companies;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 CURRENT STATUS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total companies: %', v_total;
  RAISE NOTICE 'Active companies: %', v_active;
  RAISE NOTICE '';
END $$;

-- Step 2: Insert sample companies if none exist
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM mining_companies;

  IF v_count = 0 THEN
    RAISE NOTICE '📝 Inserting sample mining companies...';
    RAISE NOTICE '';

    INSERT INTO mining_companies (
      name,
      code,
      country,
      is_active,
      contact_person_email,
      contact_person_phone
    )
    VALUES
      ('Mansa Resources SARL', 'MANSA', 'Guinea', true, 'contact@mansaresources.gn', '+224-XXX-XXXX'),
      ('SAG Mining Company', 'SAG', 'Guinea', true, 'info@sagmining.gn', '+224-XXX-XXXX'),
      ('Gold Fields Guinea', 'GFG', 'Guinea', true, 'contact@goldfields.gn', '+224-XXX-XXXX'),
      ('African Gold Group', 'AGG', 'Cote d''Ivoire', true, 'info@africangold.ci', '+225-XXX-XXXX'),
      ('West African Minerals', 'WAM', 'Mali', true, 'contact@waminerals.ml', '+223-XXX-XXXX')
    ON CONFLICT (code) DO NOTHING;

    RAISE NOTICE '✓ Inserted 5 sample mining companies';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✓ Found % existing mining companies', v_count;
    RAISE NOTICE '';
  END IF;
END $$;

-- Step 3: Show final status
DO $$
DECLARE
  v_active_count INT;
  v_inactive_count INT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE is_active = true),
    COUNT(*) FILTER (WHERE is_active = false OR is_active IS NULL)
  INTO v_active_count, v_inactive_count
  FROM mining_companies;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 FINAL STATUS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Active companies: %', v_active_count;
  RAISE NOTICE 'Inactive companies: %', v_inactive_count;
  RAISE NOTICE '';

  IF v_active_count = 0 THEN
    RAISE NOTICE '⚠️  WARNING: No active companies!';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Run this to activate all companies:';
    RAISE NOTICE '   UPDATE mining_companies SET is_active = true;';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ Success! Dropdown should show % companies', v_active_count;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- Step 4: Show the active companies (what the form will display)
SELECT
  id,
  name,
  code,
  country,
  is_active
FROM mining_companies
WHERE is_active = true
ORDER BY name;
