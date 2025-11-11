/*
  Script de Nettoyage des Éléments Résiduels du Système de Licences

  Ce script supprime les éléments qui n'ont pas été supprimés par le premier script:
  - Table: license_kpi_thresholds
  - Fonctions restantes liées aux licences
  - ENUMs liés aux KPI de licences
  - Politiques RLS sur license_kpi_thresholds
  - Colonnes avec license_id dans d'autres tables

  Exécution: Copiez et collez ce script dans Supabase SQL Editor
*/

-- ============================================================================
-- ÉTAPE 1: SUPPRIMER LES FONCTIONS RESTANTES
-- ============================================================================

DROP FUNCTION IF EXISTS approve_license_request(uuid, text);
DROP FUNCTION IF EXISTS auto_update_license_status();
DROP FUNCTION IF EXISTS generate_license_number();
DROP FUNCTION IF EXISTS generate_license_request_number();
DROP FUNCTION IF EXISTS log_license_event(uuid, text, jsonb);
DROP FUNCTION IF EXISTS release_license_quota(uuid, numeric);
DROP FUNCTION IF EXISTS reserve_license_quota(uuid, numeric);
DROP FUNCTION IF EXISTS update_license_statuses_by_date();
DROP FUNCTION IF EXISTS update_license_timestamp();

-- ============================================================================
-- ÉTAPE 2: SUPPRIMER LES POLITIQUES RLS SUR license_kpi_thresholds
-- ============================================================================

DROP POLICY IF EXISTS "Management can manage KPI thresholds" ON license_kpi_thresholds;
DROP POLICY IF EXISTS "Users can view KPI thresholds" ON license_kpi_thresholds;
DROP POLICY IF EXISTS "Authenticated users can view KPI thresholds" ON license_kpi_thresholds;
DROP POLICY IF EXISTS "Management can create KPI thresholds" ON license_kpi_thresholds;
DROP POLICY IF EXISTS "Management can update KPI thresholds" ON license_kpi_thresholds;
DROP POLICY IF EXISTS "Management can delete KPI thresholds" ON license_kpi_thresholds;

-- ============================================================================
-- ÉTAPE 3: SUPPRIMER LA TABLE license_kpi_thresholds
-- ============================================================================

DROP TABLE IF EXISTS license_kpi_thresholds CASCADE;

-- ============================================================================
-- ÉTAPE 4: SUPPRIMER LES COLONNES license_id DES AUTRES TABLES
-- ============================================================================

-- Supprimer license_id de batches (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'license_id'
  ) THEN
    ALTER TABLE batches DROP COLUMN license_id CASCADE;
    RAISE NOTICE 'Colonne license_id supprimée de batches';
  END IF;
END $$;

-- Supprimer license_number de freight_companies (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_companies' AND column_name = 'license_number'
  ) THEN
    ALTER TABLE freight_companies DROP COLUMN license_number CASCADE;
    RAISE NOTICE 'Colonne license_number supprimée de freight_companies';
  END IF;
END $$;

-- Supprimer license_type de license_kpi_thresholds (si la table existe encore)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_kpi_thresholds' AND column_name = 'license_type'
  ) THEN
    ALTER TABLE license_kpi_thresholds DROP COLUMN license_type CASCADE;
    RAISE NOTICE 'Colonne license_type supprimée de license_kpi_thresholds';
  END IF;
END $$;

-- Supprimer license_plate de transportation_details (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transportation_details' AND column_name = 'license_plate'
  ) THEN
    ALTER TABLE transportation_details DROP COLUMN license_plate CASCADE;
    RAISE NOTICE 'Colonne license_plate supprimée de transportation_details';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 5: SUPPRIMER LES TYPES ENUM RÉSIDUELS
-- ============================================================================

DROP TYPE IF EXISTS _license_kpi_thresholds CASCADE;
DROP TYPE IF EXISTS license_kpi_thresholds CASCADE;

-- ============================================================================
-- ÉTAPE 6: VÉRIFICATION FINALE
-- ============================================================================

DO $$
DECLARE
  v_table_count INTEGER;
  v_function_count INTEGER;
  v_enum_count INTEGER;
  v_column_count INTEGER;
BEGIN
  -- Compter les tables restantes
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_name LIKE '%license%'
    AND table_schema = 'public';

  -- Compter les fonctions restantes
  SELECT COUNT(*) INTO v_function_count
  FROM information_schema.routines
  WHERE routine_name LIKE '%license%'
    AND routine_schema = 'public';

  -- Compter les ENUMs restants
  SELECT COUNT(*) INTO v_enum_count
  FROM pg_type
  WHERE typname LIKE '%license%';

  -- Compter les colonnes restantes avec license
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE (column_name LIKE '%license%' OR column_name = 'license_id')
    AND table_schema = 'public';

  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ NETTOYAGE COMPLÉMENTAIRE TERMINÉ';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Tables contenant "license": %', v_table_count;
  RAISE NOTICE 'Fonctions contenant "license": %', v_function_count;
  RAISE NOTICE 'ENUMs contenant "license": %', v_enum_count;
  RAISE NOTICE 'Colonnes contenant "license": %', v_column_count;
  RAISE NOTICE '';

  IF v_table_count = 0 AND v_function_count = 0 AND v_enum_count = 0 AND v_column_count = 0 THEN
    RAISE NOTICE '🎉 Tous les éléments du système de licences ont été supprimés!';
  ELSE
    RAISE NOTICE '⚠️  Il reste encore des éléments à nettoyer manuellement';
    RAISE NOTICE '   Exécutez à nouveau VERIFY_LICENSE_CLEANUP.sql pour voir les détails';
  END IF;
END $$;
