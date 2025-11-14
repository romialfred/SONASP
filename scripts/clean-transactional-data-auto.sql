/*
  # Script de Nettoyage Automatique des Données Transactionnelles

  VERSION AUTOMATIQUE - Exécute et commit automatiquement

  ⚠️  ATTENTION: Ce script COMMIT automatiquement les suppressions!
  ⚠️  Utilisez la version standard pour plus de contrôle.

  Pour annuler, utilisez plutôt: clean-transactional-data.sql
*/

-- Transaction complète
BEGIN;

-- Désactiver temporairement les triggers de protection
DO $$
BEGIN
  -- Désactiver les triggers sur virtual_payments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'virtual_payments') THEN
    ALTER TABLE virtual_payments DISABLE TRIGGER ALL;
    RAISE NOTICE '⚠️  Triggers désactivés sur virtual_payments';
  END IF;

  -- Désactiver les triggers sur payments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments DISABLE TRIGGER ALL;
    RAISE NOTICE '⚠️  Triggers désactivés sur payments';
  END IF;

  -- Désactiver les triggers sur autres tables si nécessaire
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    ALTER TABLE sales DISABLE TRIGGER ALL;
    RAISE NOTICE '⚠️  Triggers désactivés sur sales';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    ALTER TABLE inventory DISABLE TRIGGER ALL;
    RAISE NOTICE '⚠️  Triggers désactivés sur inventory';
  END IF;

  RAISE NOTICE '';
END $$;

-- Suppression dans l'ordre des dépendances avec vérifications
DO $$
BEGIN
  -- 1. Paiements (plus haut niveau)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'virtual_payments') THEN
    DELETE FROM virtual_payments;
    RAISE NOTICE '✅ Paiements virtuels supprimés';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    DELETE FROM payments;
    RAISE NOTICE '✅ Paiements supprimés';
  END IF;

  -- 2. Ventes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pre_sales') THEN
    DELETE FROM pre_sales;
    RAISE NOTICE '✅ Pré-ventes supprimées';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    DELETE FROM sales;
    RAISE NOTICE '✅ Ventes supprimées';
  END IF;

  -- 3. Inventaire
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_movements') THEN
    DELETE FROM inventory_movements;
    RAISE NOTICE '✅ Mouvements d''inventaire supprimés';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    DELETE FROM inventory;
    RAISE NOTICE '✅ Inventaire supprimé';
  END IF;

  -- 4. Fret et douanes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'freight_customs') THEN
    DELETE FROM freight_customs;
    RAISE NOTICE '✅ Fret et douanes supprimés';
  END IF;

  -- 5. Documents d'expédition
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_documents') THEN
    DELETE FROM shipping_documents;
    RAISE NOTICE '✅ Documents d''expédition supprimés';
  END IF;

  -- 6. Expéditions (AVANT licenses car FK vers licenses)
  DELETE FROM shipping_preparations;
  RAISE NOTICE '✅ Expéditions supprimées';

  -- 7. Certificats d'essai (APRÈS shipping)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assay_certificates') THEN
    DELETE FROM assay_certificates;
    RAISE NOTICE '✅ Certificats d''essai supprimés';
  END IF;

  -- 8. Licences d'exportation (APRÈS shipping)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'export_license_quotas') THEN
    DELETE FROM export_license_quotas;
    RAISE NOTICE '✅ Quotas de licences d''exportation supprimés';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'export_licenses') THEN
    DELETE FROM export_licenses;
    RAISE NOTICE '✅ Licences d''exportation supprimées';
  END IF;

  -- 9. Historique des statuts
  DELETE FROM unified_status_history;
  RAISE NOTICE '✅ Historique des statuts supprimé';

  -- 10. Documents de production
  DELETE FROM production_documents;
  RAISE NOTICE '✅ Documents de production supprimés';

  -- 11. Productions journalières
  DELETE FROM daily_production;
  RAISE NOTICE '✅ Productions journalières supprimées';

  -- 12. Batches (si existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batches') THEN
    DELETE FROM batches;
    RAISE NOTICE '✅ Batches supprimés';
  END IF;

  -- Message final
  RAISE NOTICE '';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Nettoyage automatique terminé avec succès';
  RAISE NOTICE '✅ Toutes les données transactionnelles ont été supprimées';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- Réactiver les triggers
DO $$
BEGIN
  -- Réactiver les triggers sur virtual_payments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'virtual_payments') THEN
    ALTER TABLE virtual_payments ENABLE TRIGGER ALL;
    RAISE NOTICE '🔄 Triggers réactivés sur virtual_payments';
  END IF;

  -- Réactiver les triggers sur payments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments ENABLE TRIGGER ALL;
    RAISE NOTICE '🔄 Triggers réactivés sur payments';
  END IF;

  -- Réactiver les triggers sur sales
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    ALTER TABLE sales ENABLE TRIGGER ALL;
    RAISE NOTICE '🔄 Triggers réactivés sur sales';
  END IF;

  -- Réactiver les triggers sur inventory
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    ALTER TABLE inventory ENABLE TRIGGER ALL;
    RAISE NOTICE '🔄 Triggers réactivés sur inventory';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Tous les triggers ont été réactivés';
  RAISE NOTICE '';
END $$;

-- COMMIT automatique
COMMIT;
