/*
  Script de Nettoyage des Doublons Depositors

  Ce script:
  1. Identifie les doublons (même nom + même compagnie + même catégorie)
  2. Garde le premier enregistrement créé
  3. Désactive (soft delete) les doublons
  4. Ajoute la contrainte unique pour empêcher futurs doublons
*/

-- ============================================================================
-- STEP 1: Afficher les doublons actuels
-- ============================================================================

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DEPOSITOR DUPLICATES CLEANUP';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT
      mining_company_id,
      category,
      LOWER(TRIM(full_name)) as normalized_name,
      COUNT(*) as cnt
    FROM depositors
    WHERE is_active = true
    GROUP BY mining_company_id, category, LOWER(TRIM(full_name))
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE 'Found % group(s) of duplicates', duplicate_count;
  RAISE NOTICE '';

  IF duplicate_count = 0 THEN
    RAISE NOTICE 'No duplicates found - database is clean!';
    RAISE NOTICE '';
    RETURN;
  END IF;

  -- Afficher les doublons
  FOR rec IN (
    SELECT
      d.full_name,
      mc.name as company_name,
      d.category,
      COUNT(*) as count
    FROM depositors d
    LEFT JOIN mining_companies mc ON d.mining_company_id = mc.id
    WHERE d.is_active = true
    GROUP BY d.mining_company_id, d.category, LOWER(TRIM(d.full_name)), d.full_name, mc.name
    HAVING COUNT(*) > 1
    ORDER BY d.full_name
  ) LOOP
    RAISE NOTICE '→ % | % | % | % record(s)',
      rec.full_name,
      rec.company_name,
      rec.category,
      rec.count;
  END LOOP;

  RAISE NOTICE '';

END $$;

-- ============================================================================
-- STEP 2: Désactiver les doublons (garder le premier créé)
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER := 0;
  rec RECORD;
BEGIN
  RAISE NOTICE '--- Cleaning up duplicates ---';
  RAISE NOTICE '';

  -- Pour chaque groupe de doublons
  FOR rec IN (
    SELECT
      mining_company_id,
      category,
      LOWER(TRIM(full_name)) as normalized_name
    FROM depositors
    WHERE is_active = true
    GROUP BY mining_company_id, category, LOWER(TRIM(full_name))
    HAVING COUNT(*) > 1
  ) LOOP
    -- Désactiver tous sauf le premier (plus ancien)
    WITH to_keep AS (
      SELECT id
      FROM depositors
      WHERE mining_company_id = rec.mining_company_id
        AND category = rec.category
        AND LOWER(TRIM(full_name)) = rec.normalized_name
        AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1
    )
    UPDATE depositors
    SET
      is_active = false,
      updated_at = NOW()
    WHERE mining_company_id = rec.mining_company_id
      AND category = rec.category
      AND LOWER(TRIM(full_name)) = rec.normalized_name
      AND is_active = true
      AND id NOT IN (SELECT id FROM to_keep);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
      RAISE NOTICE '✅ Removed % duplicate(s) for: %',
        deleted_count,
        rec.normalized_name;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Cleanup completed';
  RAISE NOTICE '';

END $$;

-- ============================================================================
-- STEP 3: Ajouter la contrainte unique
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '--- Adding unique constraint ---';

  -- Drop if exists
  BEGIN
    EXECUTE 'ALTER TABLE depositors DROP CONSTRAINT IF EXISTS depositors_unique_person_company_category';
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  -- Add constraint
  ALTER TABLE depositors
  ADD CONSTRAINT depositors_unique_person_company_category
  UNIQUE (mining_company_id, category, full_name);

  RAISE NOTICE '✅ Constraint created: depositors_unique_person_company_category';
  RAISE NOTICE '   Prevents: Same person + same company + same category';
  RAISE NOTICE '';

EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '';
    RAISE NOTICE '❌ ERROR: Cannot add constraint - duplicates still exist';
    RAISE NOTICE '   This should not happen. Please run STEP 1 again to check.';
    RAISE NOTICE '';
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
END $$;

-- ============================================================================
-- STEP 4: Vérification finale
-- ============================================================================

DO $$
DECLARE
  active_count INTEGER;
  inactive_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL STATUS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO active_count
  FROM depositors
  WHERE is_active = true;

  SELECT COUNT(*) INTO inactive_count
  FROM depositors
  WHERE is_active = false;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT
      mining_company_id,
      category,
      LOWER(TRIM(full_name)) as normalized_name,
      COUNT(*) as cnt
    FROM depositors
    WHERE is_active = true
    GROUP BY mining_company_id, category, LOWER(TRIM(full_name))
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE 'Active depositors: %', active_count;
  RAISE NOTICE 'Inactive depositors: %', inactive_count;
  RAISE NOTICE 'Remaining duplicates: %', duplicate_count;
  RAISE NOTICE '';

  IF duplicate_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: Database is clean!';
    RAISE NOTICE '✅ Constraint is active';
    RAISE NOTICE '✅ No more duplicates possible';
  ELSE
    RAISE NOTICE '❌ WARNING: Duplicates still exist';
    RAISE NOTICE '   Please investigate manually';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SCRIPT COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

END $$;
