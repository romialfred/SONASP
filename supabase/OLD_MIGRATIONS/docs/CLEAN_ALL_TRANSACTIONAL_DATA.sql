-- Script pour nettoyer TOUTES les données transactionnelles
-- Ce script supprime uniquement les données, pas les structures de tables
-- À utiliser pour nettoyer les données de test/demo

-- ============================================================================
-- IMPORTANT: Ce script supprime TOUTES les données transactionnelles
-- Les tables de configuration (sites, customers, etc.) sont préservées
-- ============================================================================

BEGIN;

-- Afficher le message de début
DO $$ BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'DÉBUT DU NETTOYAGE DES DONNÉES TRANSACTIONNELLES';
  RAISE NOTICE '=============================================================';
END $$;

-- 1. SALES ET PAIEMENTS
DO $$ 
DECLARE
  v_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- NETTOYAGE DES VENTES ET PAIEMENTS ---';
  
  -- Supprimer les paiements
  DELETE FROM payments;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % paiements', v_count;
  
  -- Supprimer les ventes
  DELETE FROM sales;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % ventes', v_count;
END $$;

-- 2. INVENTAIRE
DO $$ 
DECLARE
  v_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- NETTOYAGE DE L''INVENTAIRE ---';
  
  -- Supprimer l'inventaire argent
  DELETE FROM silver_inventory;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % entrées d''inventaire argent', v_count;
  
  -- Supprimer l'inventaire or
  DELETE FROM gold_inventory;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % entrées d''inventaire or', v_count;
END $$;

-- 3. BATCHES ET PROCESSUS DE RAFFINAGE
DO $$ 
DECLARE
  v_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- NETTOYAGE DES BATCHES ET RAFFINAGE ---';
  
  -- Supprimer les détails de raffinage
  DELETE FROM refining_details WHERE batch_id IN (SELECT id FROM batches);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % détails de raffinage', v_count;
  
  -- Supprimer les détails de réception
  DELETE FROM receiving_details WHERE batch_id IN (SELECT id FROM batches);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % détails de réception', v_count;
  
  -- Supprimer les documents de batch
  DELETE FROM batch_documents WHERE batch_id IN (SELECT id FROM batches);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % documents de batch', v_count;
  
  -- Supprimer les batches
  DELETE FROM batches;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % batches', v_count;
END $$;

-- 4. WORKFLOW ET APPROBATIONS
DO $$ 
DECLARE
  v_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- NETTOYAGE DES WORKFLOWS ET APPROBATIONS ---';
  
  -- Supprimer les approbations
  DELETE FROM approvals;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % approbations', v_count;
  
  -- Supprimer les instances de workflow
  DELETE FROM workflow_instances;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % instances de workflow', v_count;
END $$;

-- 5. PRIX ET TAUX DE CHANGE
DO $$ 
DECLARE
  v_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- NETTOYAGE DES PRIX ET TAUX ---';
  
  -- Supprimer les taux FX
  DELETE FROM fx_rates;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % taux FX', v_count;
  
  -- Supprimer les prix de l'or
  DELETE FROM gold_prices;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % prix de l''or', v_count;
END $$;

-- 6. NOTIFICATIONS
DO $$ 
DECLARE
  v_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- NETTOYAGE DES NOTIFICATIONS ---';
  
  DELETE FROM notifications;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % notifications', v_count;
END $$;

-- 7. AUDIT LOGS (OPTIONNEL - décommenter pour supprimer)
-- DO $$ 
-- DECLARE
--   v_count integer;
-- BEGIN
--   RAISE NOTICE '';
--   RAISE NOTICE '--- NETTOYAGE DES LOGS D''AUDIT ---';
--   
--   DELETE FROM audit_logs;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE 'Supprimé % logs d''audit', v_count;
-- END $$;

-- Afficher le résumé
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'NETTOYAGE TERMINÉ AVEC SUCCÈS';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables nettoyées:';
  RAISE NOTICE '  ✓ Payments';
  RAISE NOTICE '  ✓ Sales';
  RAISE NOTICE '  ✓ Silver Inventory';
  RAISE NOTICE '  ✓ Gold Inventory';
  RAISE NOTICE '  ✓ Refining Details';
  RAISE NOTICE '  ✓ Receiving Details';
  RAISE NOTICE '  ✓ Batch Documents';
  RAISE NOTICE '  ✓ Batches';
  RAISE NOTICE '  ✓ Approvals';
  RAISE NOTICE '  ✓ Workflow Instances';
  RAISE NOTICE '  ✓ FX Rates';
  RAISE NOTICE '  ✓ Gold Prices';
  RAISE NOTICE '  ✓ Notifications';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables préservées (configuration):';
  RAISE NOTICE '  ✓ Sites';
  RAISE NOTICE '  ✓ Customers';
  RAISE NOTICE '  ✓ Mining Companies';
  RAISE NOTICE '  ✓ Transport Companies';
  RAISE NOTICE '  ✓ Refineries';
  RAISE NOTICE '  ✓ User Profiles';
  RAISE NOTICE '  ✓ User Permissions';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;

-- Vérifier les comptes
DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- VÉRIFICATION DES COMPTES ---';
  RAISE NOTICE 'Sales restantes: %', (SELECT COUNT(*) FROM sales);
  RAISE NOTICE 'Batches restants: %', (SELECT COUNT(*) FROM batches);
  RAISE NOTICE 'Inventory restant: %', (SELECT COUNT(*) FROM gold_inventory);
  RAISE NOTICE 'Payments restants: %', (SELECT COUNT(*) FROM payments);
  RAISE NOTICE '';
END $$;

COMMIT;
