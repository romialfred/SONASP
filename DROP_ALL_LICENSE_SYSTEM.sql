/*
  Script de Suppression Complète du Système de Licences

  Ce script supprime toutes les tables, vues, fonctions, triggers, colonnes,
  et politiques RLS liées au système de gestion des licences.

  ATTENTION: Cette opération est IRRÉVERSIBLE!

  Exécution: Copiez et collez ce script dans Supabase SQL Editor
*/

-- ============================================================================
-- ÉTAPE 1: SUPPRIMER LES TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_reserve_license_quota ON shipping_preparations;
DROP TRIGGER IF EXISTS trigger_release_license_quota ON shipping_preparations;
DROP TRIGGER IF EXISTS update_license_remaining_qty_trigger ON shipping_preparations;
DROP TRIGGER IF EXISTS trg_license_request_status_change ON license_requests;

-- ============================================================================
-- ÉTAPE 2: SUPPRIMER LES FONCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS validate_license_quantity(uuid, numeric);
DROP FUNCTION IF EXISTS reserve_license_quota(uuid, numeric);
DROP FUNCTION IF EXISTS release_license_quota(uuid, numeric);
DROP FUNCTION IF EXISTS update_license_remaining_qty();
DROP FUNCTION IF EXISTS handle_license_request_status_change();
DROP FUNCTION IF EXISTS get_available_license_quantity(uuid);

-- ============================================================================
-- ÉTAPE 3: SUPPRIMER LES VUES
-- ============================================================================

DROP VIEW IF EXISTS v_license_requests_detailed CASCADE;
DROP VIEW IF EXISTS v_licenses_with_shipments CASCADE;
DROP VIEW IF EXISTS v_license_quota_usage CASCADE;
DROP VIEW IF EXISTS v_active_licenses CASCADE;
DROP VIEW IF EXISTS v_license_statistics CASCADE;

-- ============================================================================
-- ÉTAPE 4: SUPPRIMER LES POLITIQUES RLS
-- ============================================================================

-- Politiques sur license_requests
DROP POLICY IF EXISTS "Users can view license requests" ON license_requests;
DROP POLICY IF EXISTS "Users can create license requests" ON license_requests;
DROP POLICY IF EXISTS "Users can update own license requests" ON license_requests;
DROP POLICY IF EXISTS "Managers can approve license requests" ON license_requests;
DROP POLICY IF EXISTS "Users can delete own pending license requests" ON license_requests;

-- Politiques sur license_request_documents
DROP POLICY IF EXISTS "Users can view license request documents" ON license_request_documents;
DROP POLICY IF EXISTS "Users can upload license request documents" ON license_request_documents;
DROP POLICY IF EXISTS "Users can delete own license request documents" ON license_request_documents;

-- Politiques sur licenses
DROP POLICY IF EXISTS "Users can view licenses" ON licenses;
DROP POLICY IF EXISTS "Managers can create licenses" ON licenses;
DROP POLICY IF EXISTS "Managers can update licenses" ON licenses;
DROP POLICY IF EXISTS "Managers can delete licenses" ON licenses;

-- Politiques sur license_events
DROP POLICY IF EXISTS "Users can view license events" ON license_events;
DROP POLICY IF EXISTS "System can insert license events" ON license_events;

-- Politiques sur license_quota_transactions
DROP POLICY IF EXISTS "Users can view license quota transactions" ON license_quota_transactions;
DROP POLICY IF EXISTS "System can insert license quota transactions" ON license_quota_transactions;

-- ============================================================================
-- ÉTAPE 5: SUPPRIMER LES COLONNES license_id ET total_weight_oz
-- ============================================================================

-- Supprimer la colonne license_id de shipping_preparations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations' AND column_name = 'license_id'
  ) THEN
    ALTER TABLE shipping_preparations DROP COLUMN license_id;
    RAISE NOTICE 'Colonne license_id supprimée de shipping_preparations';
  END IF;
END $$;

-- Supprimer la colonne total_weight_oz de shipping_preparations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations' AND column_name = 'total_weight_oz'
  ) THEN
    ALTER TABLE shipping_preparations DROP COLUMN total_weight_oz;
    RAISE NOTICE 'Colonne total_weight_oz supprimée de shipping_preparations';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 6: SUPPRIMER LES TABLES (CASCADE pour supprimer les dépendances)
-- ============================================================================

DROP TABLE IF EXISTS license_quota_transactions CASCADE;
DROP TABLE IF EXISTS license_events CASCADE;
DROP TABLE IF EXISTS license_request_documents CASCADE;
DROP TABLE IF EXISTS license_requests CASCADE;
DROP TABLE IF EXISTS licenses CASCADE;

-- ============================================================================
-- ÉTAPE 7: SUPPRIMER LES TYPES ENUM
-- ============================================================================

DROP TYPE IF EXISTS license_request_status CASCADE;
DROP TYPE IF EXISTS license_status CASCADE;
DROP TYPE IF EXISTS license_type CASCADE;
DROP TYPE IF EXISTS license_quota_transaction_type CASCADE;
DROP TYPE IF EXISTS license_event_type CASCADE;

-- ============================================================================
-- ÉTAPE 8: SUPPRIMER LES POLITIQUES RLS DU BUCKET STORAGE
-- ============================================================================

-- Note: Le bucket 'license-documents' doit être supprimé manuellement
-- depuis Supabase Dashboard → Storage

-- Supprimer les politiques de storage sur le bucket license-documents
-- Note: Ces politiques doivent être supprimées via le Dashboard Supabase
-- Storage → license-documents → Policies → Delete each policy
-- ou via l'API Supabase Management si disponible

-- ============================================================================
-- ÉTAPE 9: NETTOYAGE DES PERMISSIONS (si applicable)
-- ============================================================================

-- Supprimer les permissions liées aux licences dans la table user_permissions
-- (si cette table existe et contient des permissions de licences)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_permissions'
  ) THEN
    -- Vérifier si la colonne 'permission' existe
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_permissions' AND column_name = 'permission'
    ) THEN
      DELETE FROM user_permissions WHERE permission LIKE '%license%';
      RAISE NOTICE 'Permissions de licences supprimées';
    ELSE
      RAISE NOTICE 'Table user_permissions existe mais sans colonne permission - aucune action';
    END IF;
  ELSE
    RAISE NOTICE 'Table user_permissions n''existe pas - aucune action';
  END IF;
END $$;

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Suppression complète du système de licences terminée!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  ACTION MANUELLE REQUISE:';
  RAISE NOTICE '   Supprimez le bucket "license-documents" depuis:';
  RAISE NOTICE '   Supabase Dashboard → Storage → license-documents → Delete';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Exécutez maintenant le script VERIFY_LICENSE_CLEANUP.sql pour vérifier';
END $$;
