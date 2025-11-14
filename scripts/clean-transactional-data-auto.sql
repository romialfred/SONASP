/*
  # Script de Nettoyage Automatique des Données Transactionnelles

  VERSION FINALE - Basée sur Analyse FK RÉELLE de la Base

  ⚠️  ATTENTION: Ce script COMMIT automatiquement les suppressions!

  ORDRE OPTIMAL: 38 tables transactionnelles supprimées
  Basé sur: auto-fix-delete-order.sql (exécuté le 2025-11-14)

  Tables Configuration CONSERVÉES:
  - customers, mining_companies, sites, refineries
  - transport_companies, freight_companies
  - users, profiles, fx_rates, gold_prices
*/

-- Transaction complète
BEGIN;

-- =====================================================
-- ÉTAPE 1: DÉSACTIVER LES TRIGGERS UTILISATEUR
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  ═══════════════════════════════════════════════════════';
  RAISE NOTICE '⚠️  DÉSACTIVATION DES TRIGGERS UTILISATEUR';
  RAISE NOTICE '⚠️  ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Désactiver triggers sur les tables critiques
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments DISABLE TRIGGER USER;
    RAISE NOTICE '⚠️  Triggers désactivés: payments';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    ALTER TABLE sales DISABLE TRIGGER USER;
    RAISE NOTICE '⚠️  Triggers désactivés: sales';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_preparations') THEN
    ALTER TABLE shipping_preparations DISABLE TRIGGER USER;
    RAISE NOTICE '⚠️  Triggers désactivés: shipping_preparations';
  END IF;

  -- Désactiver triggers d'audit (Bug #6)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_status_history') THEN
    ALTER TABLE batch_status_history DISABLE TRIGGER USER;
    RAISE NOTICE '⚠️  Triggers désactivés: batch_status_history';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_status_history') THEN
    ALTER TABLE production_status_history DISABLE TRIGGER USER;
    RAISE NOTICE '⚠️  Triggers désactivés: production_status_history';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_status_history') THEN
    ALTER TABLE shipping_status_history DISABLE TRIGGER USER;
    RAISE NOTICE '⚠️  Triggers désactivés: shipping_status_history';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_status_history') THEN
    ALTER TABLE unified_status_history DISABLE TRIGGER USER;
    RAISE NOTICE '⚠️  Triggers désactivés: unified_status_history';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_audit_trail') THEN
    ALTER TABLE sales_audit_trail DISABLE TRIGGER USER;
    RAISE NOTICE '⚠️  Triggers désactivés: sales_audit_trail';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 2: SUPPRESSION DANS L'ORDRE OPTIMAL
-- =====================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🗑️  ═══════════════════════════════════════════════════════';
  RAISE NOTICE '🗑️  SUPPRESSION DES DONNÉES TRANSACTIONNELLES';
  RAISE NOTICE '🗑️  38 tables dans l''ordre optimal (Enfant → Parent)';
  RAISE NOTICE '🗑️  ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 1: Enfants de SALES (13 tables)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 1: Enfants de SALES';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_payment_schedules') THEN
    DELETE FROM sales_payment_schedules;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sales_payment_schedules: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_notifications_log') THEN
    DELETE FROM sales_notifications_log;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sales_notifications_log: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_line_items') THEN
    DELETE FROM sales_line_items;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sales_line_items: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_documents') THEN
    DELETE FROM sales_documents;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sales_documents: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_commissions') THEN
    DELETE FROM sales_commissions;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sales_commissions: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_audit_trail') THEN
    DELETE FROM sales_audit_trail;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sales_audit_trail: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_approvals') THEN
    DELETE FROM sales_approvals;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sales_approvals: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_allocations') THEN
    DELETE FROM sales_allocations;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sales_allocations: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sale_pricing_details') THEN
    DELETE FROM sale_pricing_details;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sale_pricing_details: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pre_sales_inventory_matches') THEN
    DELETE FROM pre_sales_inventory_matches;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ pre_sales_inventory_matches: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_transactions') THEN
    DELETE FROM inventory_transactions;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ inventory_transactions: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gold_inventory') THEN
    DELETE FROM gold_inventory;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ gold_inventory: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
    DELETE FROM email_logs;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ email_logs: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 2: Mixte SALES + CUSTOMERS (3 tables)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 2: Mixte SALES + CUSTOMERS';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    DELETE FROM payments;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ payments: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pre_sales') THEN
    DELETE FROM pre_sales;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ pre_sales: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_accounts_receivable') THEN
    DELETE FROM customer_accounts_receivable;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ customer_accounts_receivable: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 3: SALES (1 table parent)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 3: SALES (parent)';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    DELETE FROM sales;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ sales: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 4: Enfants CUSTOMERS seuls (3 tables)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 4: Enfants CUSTOMERS';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_fx_rates') THEN
    DELETE FROM customer_fx_rates;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ customer_fx_rates: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_contracts') THEN
    DELETE FROM customer_contracts;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ customer_contracts: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_banks') THEN
    DELETE FROM customer_banks;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ customer_banks: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 5: Enfants SHIPPING_PREPARATIONS (7 tables)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 5: Enfants SHIPPING_PREPARATIONS';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_status_history') THEN
    DELETE FROM shipping_status_history;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ shipping_status_history: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_signatories') THEN
    DELETE FROM shipping_signatories;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ shipping_signatories: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_production_items') THEN
    DELETE FROM shipping_production_items;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ shipping_production_items: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_ingots') THEN
    DELETE FROM shipping_ingots;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ shipping_ingots: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_documents') THEN
    DELETE FROM shipping_documents;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ shipping_documents: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'freight_customs_operations') THEN
    DELETE FROM freight_customs_operations;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ freight_customs_operations: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assay_certificates') THEN
    DELETE FROM assay_certificates;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ assay_certificates: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 6: SHIPPING_PREPARATIONS (1 table parent)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 6: SHIPPING_PREPARATIONS (parent)';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_preparations') THEN
    DELETE FROM shipping_preparations;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ shipping_preparations: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 7: Enfants EXPORT_LICENSES (1 table)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 7: Enfants EXPORT_LICENSES';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'export_license_documents') THEN
    DELETE FROM export_license_documents;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ export_license_documents: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 8: EXPORT_LICENSES (1 table parent)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 8: EXPORT_LICENSES (parent)';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'export_licenses') THEN
    DELETE FROM export_licenses;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ export_licenses: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 9: Enfants DAILY_PRODUCTION (2 tables)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 9: Enfants DAILY_PRODUCTION';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_status_history') THEN
    DELETE FROM production_status_history;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ production_status_history: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_documents') THEN
    DELETE FROM production_documents;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ production_documents: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 10: DAILY_PRODUCTION (1 table parent)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 10: DAILY_PRODUCTION (parent)';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_production') THEN
    DELETE FROM daily_production;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ daily_production: % lignes', v_count;
  END IF;

  RAISE NOTICE '';

  -- ========================================
  -- NIVEAU 11: Enfants MINING_COMPANIES (5 tables)
  -- (OPTIONNEL - Budgets et prévisions)
  -- ========================================
  RAISE NOTICE '📊 NIVEAU 11: Enfants MINING_COMPANIES (optionnel)';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quarterly_forecasts') THEN
    DELETE FROM quarterly_forecasts;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ quarterly_forecasts: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_forecasts') THEN
    DELETE FROM production_forecasts;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ production_forecasts: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_budgets') THEN
    DELETE FROM monthly_budgets;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ monthly_budgets: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'annual_budgets') THEN
    DELETE FROM annual_budgets;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ annual_budgets: % lignes', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batches') THEN
    DELETE FROM batches;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✅ batches: % lignes', v_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ SUPPRESSION TERMINÉE: 38 tables transactionnelles';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 3: RÉACTIVER LES TRIGGERS UTILISATEUR
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔄 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '🔄 RÉACTIVATION DES TRIGGERS UTILISATEUR';
  RAISE NOTICE '🔄 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments ENABLE TRIGGER USER;
    RAISE NOTICE '🔄 Triggers réactivés: payments';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    ALTER TABLE sales ENABLE TRIGGER USER;
    RAISE NOTICE '🔄 Triggers réactivés: sales';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_preparations') THEN
    ALTER TABLE shipping_preparations ENABLE TRIGGER USER;
    RAISE NOTICE '🔄 Triggers réactivés: shipping_preparations';
  END IF;

  -- Réactiver triggers d'audit (Bug #6)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_status_history') THEN
    ALTER TABLE batch_status_history ENABLE TRIGGER USER;
    RAISE NOTICE '🔄 Triggers réactivés: batch_status_history';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_status_history') THEN
    ALTER TABLE production_status_history ENABLE TRIGGER USER;
    RAISE NOTICE '🔄 Triggers réactivés: production_status_history';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_status_history') THEN
    ALTER TABLE shipping_status_history ENABLE TRIGGER USER;
    RAISE NOTICE '🔄 Triggers réactivés: shipping_status_history';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_status_history') THEN
    ALTER TABLE unified_status_history ENABLE TRIGGER USER;
    RAISE NOTICE '🔄 Triggers réactivés: unified_status_history';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_audit_trail') THEN
    ALTER TABLE sales_audit_trail ENABLE TRIGGER USER;
    RAISE NOTICE '🔄 Triggers réactivés: sales_audit_trail';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Tous les triggers utilisateur réactivés';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 4: COMMIT AUTOMATIQUE
-- =====================================================

COMMIT;

-- Message final
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 NETTOYAGE AUTOMATIQUE RÉUSSI';
  RAISE NOTICE '🎉 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 38 tables transactionnelles nettoyées';
  RAISE NOTICE '✅ Configuration préservée (customers, mining_companies, etc.)';
  RAISE NOTICE '✅ Triggers réactivés';
  RAISE NOTICE '✅ Transaction COMMIT effectué';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Base de données prête pour nouvelles données!';
  RAISE NOTICE '';
END $$;
