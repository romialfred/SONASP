/*
  ═══════════════════════════════════════════════════════════════════════════
  🔍 SIMPLE DIAGNOSTIC: Check & Fix Mining Companies
  ═══════════════════════════════════════════════════════════════════════════
*/

-- Step 1: Show current status
DO $$
DECLARE
  v_total INT;
  v_active INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active')
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

    INSERT INTO mining_companies (name, status, country, contact_email, contact_phone)
    VALUES
      ('Mansa Resources SARL', 'active', 'Guinea', 'contact@mansaresources.gn', '+224-XXX-XXXX'),
      ('SAG Mining Company', 'active', 'Guinea', 'info@sagmining.gn', '+224-XXX-XXXX'),
      ('Gold Fields Guinea', 'active', 'Guinea', 'contact@goldfields.gn', '+224-XXX-XXXX'),
      ('African Gold Group', 'active', 'Cote d''Ivoire', 'info@africangold.ci', '+225-XXX-XXXX'),
      ('West African Minerals', 'active', 'Mali', 'contact@waminerals.ml', '+223-XXX-XXXX')
    ON CONFLICT (name) DO NOTHING;

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
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM mining_companies
  WHERE status = 'active';

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 FINAL STATUS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Active companies: %', v_active_count;
  RAISE NOTICE '';

  IF v_active_count = 0 THEN
    RAISE NOTICE '⚠️  WARNING: No active companies!';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Run this to activate all companies:';
    RAISE NOTICE '   UPDATE mining_companies SET status = ''active'';';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ Success! Dropdown should show % companies', v_active_count;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- Step 4: Show the active companies
SELECT
  id,
  name,
  status,
  country
FROM mining_companies
WHERE status = 'active'
ORDER BY name;
