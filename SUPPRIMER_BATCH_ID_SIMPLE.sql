-- ============================================================================
-- SUPPRESSION SIMPLE DE batch_id - Version Ultra-Simple
-- ============================================================================
-- Ce script supprime simplement la colonne batch_id si elle existe
-- Sans vérifications complexes, sans tests
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  Suppression de batch_id - Version Simple                   ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- 1. Supprimer toutes les contraintes qui référencent batch_id
  RAISE NOTICE '⏳ Suppression des contraintes...';

  DECLARE
    r RECORD;
  BEGIN
    FOR r IN (
      SELECT tc.constraint_name, tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE ccu.column_name = 'batch_id'
        AND tc.table_schema = 'public'
    ) LOOP
      BEGIN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I CASCADE',
          r.table_name, r.constraint_name);
        RAISE NOTICE '  ✓ Contrainte supprimée: %.%', r.table_name, r.constraint_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ⚠ Ignoré: %', SQLERRM;
      END;
    END LOOP;
  END;

  -- 2. Supprimer tous les index qui référencent batch_id
  RAISE NOTICE '';
  RAISE NOTICE '⏳ Suppression des index...';

  DECLARE
    r RECORD;
  BEGIN
    FOR r IN (
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexdef LIKE '%batch_id%'
    ) LOOP
      BEGIN
        EXECUTE format('DROP INDEX IF EXISTS %I CASCADE', r.indexname);
        RAISE NOTICE '  ✓ Index supprimé: %', r.indexname;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ⚠ Ignoré: %', SQLERRM;
      END;
    END LOOP;
  END;

  -- 3. Supprimer la colonne batch_id de toutes les tables
  RAISE NOTICE '';
  RAISE NOTICE '⏳ Suppression de la colonne batch_id...';

  DECLARE
    r RECORD;
  BEGIN
    FOR r IN (
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'batch_id'
    ) LOOP
      BEGIN
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS batch_id CASCADE', r.table_name);
        RAISE NOTICE '  ✓ Colonne supprimée de: %', r.table_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ⚠ Erreur sur %: %', r.table_name, SQLERRM;
      END;
    END LOOP;
  END;

  -- 4. Vérification finale
  RAISE NOTICE '';
  RAISE NOTICE '⏳ Vérification...';

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'batch_id'
  ) THEN
    RAISE NOTICE '';
    RAISE NOTICE '  ❌ ÉCHEC: batch_id existe encore!';
    RAISE EXCEPTION 'batch_id still exists after deletion attempt';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '  ✅ SUCCESS: batch_id supprimé partout!';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║            ✅ SUPPRESSION TERMINÉE                           ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';

END $$;
