/*
  NETTOYAGE COMPLET - Suppression de tous les objets lies a BATCH

  CONTEXTE:
  Le systeme "batch" etait l'ancien systeme de tracking avant "daily_production".
  Il a ete remplace mais des vestiges restent dans la base de donnees.

  CE SCRIPT SUPPRIME:
  - Tables liees a batch
  - Colonnes batch_number, batch_id
  - Triggers lies a batch
  - Fonctions liees a batch
  - Vues liees a batch
  - Contraintes liees a batch
  - Index lies a batch
  - ENUMs lies a batch

  ATTENTION: Script DESTRUCTIF - Backup requis avant execution
*/

-- =====================================================
-- ETAPE 0: ANALYSE PRELIMINAIRE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'ANALYSE DES OBJETS LIES A BATCH';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';
END $$;

-- Lister toutes les tables avec colonnes batch_*
SELECT
  'TABLE: ' || table_name || ' - COLONNE: ' || column_name AS objet_trouve,
  data_type AS type,
  'DROP' AS action
FROM information_schema.columns
WHERE (column_name LIKE '%batch%')
  AND table_schema = 'public'
ORDER BY table_name, column_name;

-- Lister toutes les tables nommees *batch*
SELECT
  'TABLE: ' || table_name AS objet_trouve,
  'Contient ' || (
    SELECT COUNT(*)
    FROM information_schema.columns c
    WHERE c.table_name = t.table_name
    AND c.table_schema = 'public'
  ) || ' colonnes' AS details,
  'DROP TABLE' AS action
FROM information_schema.tables t
WHERE table_name LIKE '%batch%'
  AND table_schema = 'public'
ORDER BY table_name;

-- Lister triggers lies a batch
SELECT
  'TRIGGER: ' || t.tgname || ' sur ' || c.relname AS objet_trouve,
  pg_get_triggerdef(t.oid) AS definition,
  'DROP TRIGGER' AS action
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE t.tgname LIKE '%batch%'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Lister fonctions liees a batch
SELECT
  'FONCTION: ' || proname AS objet_trouve,
  pg_get_function_arguments(oid) AS arguments,
  'DROP FUNCTION' AS action
FROM pg_proc
WHERE proname LIKE '%batch%'
ORDER BY proname;

-- Lister vues liees a batch
SELECT
  'VUE: ' || table_name AS objet_trouve,
  'Vue sur ' || (
    SELECT string_agg(column_name, ', ')
    FROM information_schema.columns c
    WHERE c.table_name = v.table_name
    AND c.table_schema = 'public'
  ) AS details,
  'DROP VIEW' AS action
FROM information_schema.views v
WHERE table_name LIKE '%batch%'
  AND table_schema = 'public'
ORDER BY table_name;

-- Lister ENUMs lies a batch
SELECT
  'ENUM: ' || typname AS objet_trouve,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valeurs,
  'DROP TYPE' AS action
FROM pg_type t
LEFT JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname LIKE '%batch%'
GROUP BY typname
ORDER BY typname;

-- =====================================================
-- ETAPE 1: SUPPRIMER LES TRIGGERS
-- =====================================================

DO $$
DECLARE
  v_trigger_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'ETAPE 1: Suppression Triggers lies a batch';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';

  FOR v_trigger_record IN (
    SELECT
      t.tgname AS trigger_name,
      c.relname AS table_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname LIKE '%batch%'
      AND NOT t.tgisinternal
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE',
      v_trigger_record.trigger_name,
      v_trigger_record.table_name
    );
    RAISE NOTICE 'OK: Trigger % sur % supprime', v_trigger_record.trigger_name, v_trigger_record.table_name;
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE 'INFO: Aucun trigger lie a batch trouve';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 2: SUPPRIMER LES FONCTIONS
-- =====================================================

DO $$
DECLARE
  v_function_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'ETAPE 2: Suppression Fonctions liees a batch';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';

  FOR v_function_record IN (
    SELECT
      proname AS function_name,
      pg_get_function_identity_arguments(oid) AS args
    FROM pg_proc
    WHERE proname LIKE '%batch%'
  ) LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I(%s) CASCADE',
      v_function_record.function_name,
      v_function_record.args
    );
    RAISE NOTICE 'OK: Fonction %(%s) supprimee', v_function_record.function_name, v_function_record.args;
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE 'INFO: Aucune fonction liee a batch trouvee';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 3: SUPPRIMER LES VUES
-- =====================================================

DO $$
DECLARE
  v_view_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'ETAPE 3: Suppression Vues liees a batch';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';

  FOR v_view_record IN (
    SELECT table_name
    FROM information_schema.views
    WHERE table_name LIKE '%batch%'
      AND table_schema = 'public'
  ) LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', v_view_record.table_name);
    RAISE NOTICE 'OK: Vue % supprimee', v_view_record.table_name;
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE 'INFO: Aucune vue liee a batch trouvee';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 4: SUPPRIMER LES COLONNES batch_* DES TABLES EXISTANTES
-- =====================================================

DO $$
DECLARE
  v_column_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'ETAPE 4: Suppression Colonnes batch_* des tables';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';

  FOR v_column_record IN (
    SELECT
      table_name,
      column_name
    FROM information_schema.columns
    WHERE column_name LIKE '%batch%'
      AND table_schema = 'public'
      AND table_name NOT LIKE '%batch%' -- On garde les tables batch pour l'etape 5
  ) LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS %I CASCADE',
        v_column_record.table_name,
        v_column_record.column_name
      );
      RAISE NOTICE 'OK: Colonne %.% supprimee', v_column_record.table_name, v_column_record.column_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ATTENTION: Erreur suppression %.%: %',
        v_column_record.table_name,
        v_column_record.column_name,
        SQLERRM;
    END;
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE 'INFO: Aucune colonne batch_* trouvee dans les tables';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 5: SUPPRIMER LES TABLES *batch*
-- =====================================================

DO $$
DECLARE
  v_table_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'ETAPE 5: Suppression Tables *batch*';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';

  FOR v_table_record IN (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name LIKE '%batch%'
      AND table_schema = 'public'
  ) LOOP
    BEGIN
      EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', v_table_record.table_name);
      RAISE NOTICE 'OK: Table % supprimee', v_table_record.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ATTENTION: Erreur suppression table %: %',
        v_table_record.table_name,
        SQLERRM;
    END;
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE 'INFO: Aucune table *batch* trouvee';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 6: SUPPRIMER LES ENUMS *batch*
-- =====================================================

DO $$
DECLARE
  v_enum_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'ETAPE 6: Suppression ENUMs *batch*';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';

  FOR v_enum_record IN (
    SELECT typname
    FROM pg_type
    WHERE typname LIKE '%batch%'
  ) LOOP
    BEGIN
      EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', v_enum_record.typname);
      RAISE NOTICE 'OK: ENUM % supprime', v_enum_record.typname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ATTENTION: Erreur suppression ENUM %: %',
        v_enum_record.typname,
        SQLERRM;
    END;
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE 'INFO: Aucun ENUM *batch* trouve';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 7: VERIFICATION FINALE
-- =====================================================

DO $$
DECLARE
  v_tables_count INTEGER;
  v_columns_count INTEGER;
  v_triggers_count INTEGER;
  v_functions_count INTEGER;
  v_views_count INTEGER;
  v_enums_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'ETAPE 7: Verification Finale';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';

  -- Compter ce qui reste
  SELECT COUNT(*) INTO v_tables_count
  FROM information_schema.tables
  WHERE table_name LIKE '%batch%'
    AND table_schema = 'public';

  SELECT COUNT(*) INTO v_columns_count
  FROM information_schema.columns
  WHERE column_name LIKE '%batch%'
    AND table_schema = 'public';

  SELECT COUNT(*) INTO v_triggers_count
  FROM pg_trigger t
  WHERE t.tgname LIKE '%batch%'
    AND NOT t.tgisinternal;

  SELECT COUNT(*) INTO v_functions_count
  FROM pg_proc
  WHERE proname LIKE '%batch%';

  SELECT COUNT(*) INTO v_views_count
  FROM information_schema.views
  WHERE table_name LIKE '%batch%'
    AND table_schema = 'public';

  SELECT COUNT(*) INTO v_enums_count
  FROM pg_type
  WHERE typname LIKE '%batch%';

  -- Afficher resultats
  RAISE NOTICE 'Tables *batch* restantes: %', v_tables_count;
  RAISE NOTICE 'Colonnes *batch* restantes: %', v_columns_count;
  RAISE NOTICE 'Triggers *batch* restants: %', v_triggers_count;
  RAISE NOTICE 'Fonctions *batch* restantes: %', v_functions_count;
  RAISE NOTICE 'Vues *batch* restantes: %', v_views_count;
  RAISE NOTICE 'ENUMs *batch* restants: %', v_enums_count;
  RAISE NOTICE '';

  IF (v_tables_count + v_columns_count + v_triggers_count + v_functions_count + v_views_count + v_enums_count) = 0 THEN
    RAISE NOTICE '===================================================';
    RAISE NOTICE 'SUCCES: Tous les objets batch ont ete supprimes!';
    RAISE NOTICE '===================================================';
  ELSE
    RAISE NOTICE '===================================================';
    RAISE NOTICE 'ATTENTION: Des objets batch restent dans la base';
    RAISE NOTICE 'Verifier manuellement et supprimer si necessaire';
    RAISE NOTICE '===================================================';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON DATABASE current_database() IS
'Nettoyage batch effectue. Tous les objets lies au systeme batch obsolete ont ete supprimes.
Le systeme actuel utilise daily_production avec production_number comme identifiant.';
