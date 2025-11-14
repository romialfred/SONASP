/*
  # Script de Nettoyage Automatique des Données Transactionnelles

  VERSION AUTOMATIQUE - Exécute et commit automatiquement

  ⚠️  ATTENTION: Ce script COMMIT automatiquement les suppressions!
  ⚠️  Utilisez la version standard pour plus de contrôle.

  Pour annuler, utilisez plutôt: clean-transactional-data.sql
*/

-- Transaction complète
BEGIN;

-- Suppression dans l'ordre des dépendances
-- 1. Licences d'exportation
DELETE FROM export_license_quotas WHERE true;
DELETE FROM export_licenses WHERE true;

-- 2. Certificats d'essai
DELETE FROM assay_certificates WHERE true;

-- 3. Paiements
DELETE FROM virtual_payments WHERE true;
DELETE FROM payments WHERE true;

-- 4. Ventes
DELETE FROM pre_sales WHERE true;
DELETE FROM sales WHERE true;

-- 5. Inventaire
DELETE FROM inventory_movements WHERE true;
DELETE FROM inventory WHERE true;

-- 6. Fret et douanes
DELETE FROM freight_customs WHERE true;

-- 7. Expéditions
DELETE FROM shipping_documents WHERE true;
DELETE FROM shipping_preparations WHERE true;

-- 8. Productions
DELETE FROM unified_status_history WHERE true;
DELETE FROM production_documents WHERE true;
DELETE FROM daily_production WHERE true;

-- 9. Batches (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batches') THEN
    DELETE FROM batches;
  END IF;
END $$;

-- Afficher le résultat
DO $$
BEGIN
  RAISE NOTICE '✅ Nettoyage automatique terminé avec succès';
  RAISE NOTICE '✅ Toutes les données transactionnelles ont été supprimées';
END $$;

-- COMMIT automatique
COMMIT;
