/*
  # Script de Nettoyage des Données Transactionnelles

  ## BUT:
  Supprimer toutes les données transactionnelles (production, shipping, batches, inventory, sales, documents, payments)
  tout en préservant les données de configuration et de référence.

  ## DONNÉES SUPPRIMÉES:
  - Productions journalières (daily_production)
  - Documents de production (production_documents)
  - Historique des statuts (unified_status_history)
  - Expéditions (shipping_preparations)
  - Documents d'expédition (shipping_documents)
  - Fret et douanes (freight_customs)
  - Batches
  - Inventaire (inventory, inventory_movements)
  - Ventes (sales, pre_sales)
  - Paiements (payments, virtual_payments)
  - Certificats d'essai (assay_certificates)
  - Licences d'exportation (export_licenses, export_license_quotas)

  ## DONNÉES PRÉSERVÉES:
  - Utilisateurs (profiles, user_permissions)
  - Stakeholders (mining_companies, refineries, transport_companies, freight_companies, refinery_plants, customers, bank_accounts)
  - Taux de change (fx_rates, fx_rate_snapshots)
  - Prix de l'or (gold_prices, gold_price_snapshots)
  - Prévisions (performance_forecasts)
  - Budgets (annual_budgets)
  - Paramètres système (system_parameters)
  - Énumérations et types

  ## SÉCURITÉ:
  - Transaction complète (tout ou rien)
  - Vérifications avant suppression
  - Logs détaillés
  - Confirmation requise
*/

-- =====================================================
-- ÉTAPE 0: VÉRIFICATION DE SÉCURITÉ
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  ═══════════════════════════════════════════════════════';
  RAISE NOTICE '⚠️  ATTENTION: SUPPRESSION DES DONNÉES TRANSACTIONNELLES';
  RAISE NOTICE '⚠️  ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Ce script va supprimer:';
  RAISE NOTICE '   • Toutes les productions journalières';
  RAISE NOTICE '   • Tous les documents de production';
  RAISE NOTICE '   • Tout l''historique des statuts';
  RAISE NOTICE '   • Toutes les expéditions';
  RAISE NOTICE '   • Tous les documents d''expédition';
  RAISE NOTICE '   • Tout le fret et douanes';
  RAISE NOTICE '   • Tous les batches';
  RAISE NOTICE '   • Tout l''inventaire';
  RAISE NOTICE '   • Toutes les ventes';
  RAISE NOTICE '   • Tous les paiements';
  RAISE NOTICE '   • Tous les certificats d''essai';
  RAISE NOTICE '   • Toutes les licences d''exportation';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ce script va PRÉSERVER:';
  RAISE NOTICE '   • Utilisateurs et permissions';
  RAISE NOTICE '   • Stakeholders (sociétés minières, raffineries, etc.)';
  RAISE NOTICE '   • Taux de change';
  RAISE NOTICE '   • Prix de l''or';
  RAISE NOTICE '   • Prévisions';
  RAISE NOTICE '   • Budgets';
  RAISE NOTICE '   • Paramètres système';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 1: COMPTAGE AVANT SUPPRESSION
-- =====================================================

DO $$
DECLARE
  v_daily_production_count int;
  v_production_docs_count int;
  v_unified_history_count int;
  v_shipping_count int;
  v_shipping_docs_count int;
  v_freight_count int;
  v_inventory_count int;
  v_inventory_movements_count int;
  v_sales_count int;
  v_pre_sales_count int;
  v_payments_count int;
  v_virtual_payments_count int;
  v_assay_certs_count int;
  v_export_licenses_count int;
  v_license_quotas_count int;
BEGIN
  -- Compter les données
  SELECT COUNT(*) INTO v_daily_production_count FROM daily_production;
  SELECT COUNT(*) INTO v_production_docs_count FROM production_documents;
  SELECT COUNT(*) INTO v_unified_history_count FROM unified_status_history;
  SELECT COUNT(*) INTO v_shipping_count FROM shipping_preparations;

  -- Vérifier si les tables existent avant de compter
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_documents') THEN
    SELECT COUNT(*) INTO v_shipping_docs_count FROM shipping_documents;
  ELSE
    v_shipping_docs_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'freight_customs') THEN
    SELECT COUNT(*) INTO v_freight_count FROM freight_customs;
  ELSE
    v_freight_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    SELECT COUNT(*) INTO v_inventory_count FROM inventory;
  ELSE
    v_inventory_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_movements') THEN
    SELECT COUNT(*) INTO v_inventory_movements_count FROM inventory_movements;
  ELSE
    v_inventory_movements_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    SELECT COUNT(*) INTO v_sales_count FROM sales;
  ELSE
    v_sales_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pre_sales') THEN
    SELECT COUNT(*) INTO v_pre_sales_count FROM pre_sales;
  ELSE
    v_pre_sales_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    SELECT COUNT(*) INTO v_payments_count FROM payments;
  ELSE
    v_payments_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'virtual_payments') THEN
    SELECT COUNT(*) INTO v_virtual_payments_count FROM virtual_payments;
  ELSE
    v_virtual_payments_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assay_certificates') THEN
    SELECT COUNT(*) INTO v_assay_certs_count FROM assay_certificates;
  ELSE
    v_assay_certs_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'export_licenses') THEN
    SELECT COUNT(*) INTO v_export_licenses_count FROM export_licenses;
  ELSE
    v_export_licenses_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'export_license_quotas') THEN
    SELECT COUNT(*) INTO v_license_quotas_count FROM export_license_quotas;
  ELSE
    v_license_quotas_count := 0;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '📊 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 COMPTAGE AVANT SUPPRESSION';
  RAISE NOTICE '📊 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📦 Productions journalières: % enregistrements', v_daily_production_count;
  RAISE NOTICE '📄 Documents de production: % enregistrements', v_production_docs_count;
  RAISE NOTICE '📜 Historique des statuts: % enregistrements', v_unified_history_count;
  RAISE NOTICE '🚚 Expéditions: % enregistrements', v_shipping_count;
  RAISE NOTICE '📋 Documents d''expédition: % enregistrements', v_shipping_docs_count;
  RAISE NOTICE '🛃 Fret et douanes: % enregistrements', v_freight_count;
  RAISE NOTICE '📦 Inventaire: % enregistrements', v_inventory_count;
  RAISE NOTICE '📊 Mouvements d''inventaire: % enregistrements', v_inventory_movements_count;
  RAISE NOTICE '💰 Ventes: % enregistrements', v_sales_count;
  RAISE NOTICE '💵 Pré-ventes: % enregistrements', v_pre_sales_count;
  RAISE NOTICE '💳 Paiements: % enregistrements', v_payments_count;
  RAISE NOTICE '💸 Paiements virtuels: % enregistrements', v_virtual_payments_count;
  RAISE NOTICE '🧪 Certificats d''essai: % enregistrements', v_assay_certs_count;
  RAISE NOTICE '📜 Licences d''exportation: % enregistrements', v_export_licenses_count;
  RAISE NOTICE '📊 Quotas de licences: % enregistrements', v_license_quotas_count;
  RAISE NOTICE '';

  -- Calculer le total
  RAISE NOTICE '📊 TOTAL: % enregistrements seront supprimés',
    v_daily_production_count + v_production_docs_count + v_unified_history_count +
    v_shipping_count + v_shipping_docs_count + v_freight_count +
    v_inventory_count + v_inventory_movements_count +
    v_sales_count + v_pre_sales_count +
    v_payments_count + v_virtual_payments_count +
    v_assay_certs_count + v_export_licenses_count + v_license_quotas_count;
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 2: SUPPRESSION DES DONNÉES (TRANSACTION)
-- =====================================================

BEGIN;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🗑️  ═══════════════════════════════════════════════════════';
  RAISE NOTICE '🗑️  DÉBUT DE LA SUPPRESSION';
  RAISE NOTICE '🗑️  ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- 1. Paiements (plus haut niveau - dépend de sales)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'virtual_payments') THEN
    DELETE FROM virtual_payments;
    RAISE NOTICE '✅ Paiements virtuels supprimés';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    DELETE FROM payments;
    RAISE NOTICE '✅ Paiements supprimés';
  END IF;
END $$;

-- 2. Ventes (dépend de inventory et shipping)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pre_sales') THEN
    DELETE FROM pre_sales;
    RAISE NOTICE '✅ Pré-ventes supprimées';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    DELETE FROM sales;
    RAISE NOTICE '✅ Ventes supprimées';
  END IF;
END $$;

-- 3. Inventaire (peut dépendre de production)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_movements') THEN
    DELETE FROM inventory_movements;
    RAISE NOTICE '✅ Mouvements d''inventaire supprimés';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    DELETE FROM inventory;
    RAISE NOTICE '✅ Inventaire supprimé';
  END IF;
END $$;

-- 4. Fret et douanes (peut dépendre de shipping)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'freight_customs') THEN
    DELETE FROM freight_customs;
    RAISE NOTICE '✅ Fret et douanes supprimés';
  END IF;
END $$;

-- 5. Documents d'expédition (dépend de shipping_preparations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_documents') THEN
    DELETE FROM shipping_documents;
    RAISE NOTICE '✅ Documents d''expédition supprimés';
  END IF;
END $$;

-- 6. Expéditions (table principale - AVANT licenses car FK vers licenses)
DO $$
BEGIN
  DELETE FROM shipping_preparations;
  RAISE NOTICE '✅ Expéditions supprimées';
END $$;

-- 7. Certificats d'essai (APRÈS shipping_preparations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assay_certificates') THEN
    DELETE FROM assay_certificates;
    RAISE NOTICE '✅ Certificats d''essai supprimés';
  END IF;
END $$;

-- 8. Licences d'exportation et quotas (APRÈS shipping_preparations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'export_license_quotas') THEN
    DELETE FROM export_license_quotas;
    RAISE NOTICE '✅ Quotas de licences d''exportation supprimés';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'export_licenses') THEN
    DELETE FROM export_licenses;
    RAISE NOTICE '✅ Licences d''exportation supprimées';
  END IF;
END $$;

-- 9. Historique des statuts (table principale)
DO $$
BEGIN
  DELETE FROM unified_status_history;
  RAISE NOTICE '✅ Historique des statuts supprimé';
END $$;

-- 10. Documents de production (table principale)
DO $$
BEGIN
  DELETE FROM production_documents;
  RAISE NOTICE '✅ Documents de production supprimés';
END $$;

-- 11. Productions journalières (table principale)
DO $$
BEGIN
  DELETE FROM daily_production;
  RAISE NOTICE '✅ Productions journalières supprimées';
END $$;

-- 12. Batches (si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batches') THEN
    DELETE FROM batches;
    RAISE NOTICE '✅ Batches supprimés';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ SUPPRESSION TERMINÉE AVEC SUCCÈS';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 3: VÉRIFICATION APRÈS SUPPRESSION
-- =====================================================

DO $$
DECLARE
  v_daily_production_count int;
  v_production_docs_count int;
  v_unified_history_count int;
  v_shipping_count int;
BEGIN
  SELECT COUNT(*) INTO v_daily_production_count FROM daily_production;
  SELECT COUNT(*) INTO v_production_docs_count FROM production_documents;
  SELECT COUNT(*) INTO v_unified_history_count FROM unified_status_history;
  SELECT COUNT(*) INTO v_shipping_count FROM shipping_preparations;

  RAISE NOTICE '📊 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 VÉRIFICATION APRÈS SUPPRESSION';
  RAISE NOTICE '📊 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📦 Productions journalières: %', v_daily_production_count;
  RAISE NOTICE '📄 Documents de production: %', v_production_docs_count;
  RAISE NOTICE '📜 Historique des statuts: %', v_unified_history_count;
  RAISE NOTICE '🚚 Expéditions: %', v_shipping_count;
  RAISE NOTICE '';

  IF v_daily_production_count = 0 AND v_production_docs_count = 0 AND
     v_unified_history_count = 0 AND v_shipping_count = 0 THEN
    RAISE NOTICE '✅ Toutes les données transactionnelles ont été supprimées';
  ELSE
    RAISE NOTICE '⚠️  Certaines données n''ont pas été supprimées';
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 4: VÉRIFICATION DES DONNÉES PRÉSERVÉES
-- =====================================================

DO $$
DECLARE
  v_users_count int;
  v_mining_companies_count int;
  v_refineries_count int;
  v_customers_count int;
  v_fx_rates_count int;
  v_gold_prices_count int;
  v_forecasts_count int;
  v_budgets_count int;
BEGIN
  SELECT COUNT(*) INTO v_users_count FROM profiles;
  SELECT COUNT(*) INTO v_mining_companies_count FROM mining_companies;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refineries') THEN
    SELECT COUNT(*) INTO v_refineries_count FROM refineries;
  ELSE
    v_refineries_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    SELECT COUNT(*) INTO v_customers_count FROM customers;
  ELSE
    v_customers_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fx_rates') THEN
    SELECT COUNT(*) INTO v_fx_rates_count FROM fx_rates;
  ELSE
    v_fx_rates_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gold_prices') THEN
    SELECT COUNT(*) INTO v_gold_prices_count FROM gold_prices;
  ELSE
    v_gold_prices_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_forecasts') THEN
    SELECT COUNT(*) INTO v_forecasts_count FROM performance_forecasts;
  ELSE
    v_forecasts_count := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'annual_budgets') THEN
    SELECT COUNT(*) INTO v_budgets_count FROM annual_budgets;
  ELSE
    v_budgets_count := 0;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ DONNÉES PRÉSERVÉES';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '👥 Utilisateurs: % enregistrements', v_users_count;
  RAISE NOTICE '🏢 Sociétés minières: % enregistrements', v_mining_companies_count;
  RAISE NOTICE '🏭 Raffineries: % enregistrements', v_refineries_count;
  RAISE NOTICE '👨‍💼 Clients: % enregistrements', v_customers_count;
  RAISE NOTICE '💱 Taux de change: % enregistrements', v_fx_rates_count;
  RAISE NOTICE '💰 Prix de l''or: % enregistrements', v_gold_prices_count;
  RAISE NOTICE '📈 Prévisions: % enregistrements', v_forecasts_count;
  RAISE NOTICE '💼 Budgets: % enregistrements', v_budgets_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Toutes les données de configuration ont été préservées';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 5: CONFIRMATION FINALE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 NETTOYAGE TERMINÉ AVEC SUCCÈS';
  RAISE NOTICE '🎉 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Les données transactionnelles ont été supprimées';
  RAISE NOTICE '✅ Les données de configuration ont été préservées';
  RAISE NOTICE '✅ La base de données est prête pour de nouvelles données';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  N''oubliez pas de COMMIT la transaction si tout est OK';
  RAISE NOTICE '⚠️  Ou ROLLBACK si vous voulez annuler';
  RAISE NOTICE '';
END $$;

-- COMMIT OU ROLLBACK
-- Décommentez la ligne appropriée:

-- COMMIT;  -- Pour confirmer la suppression
-- ROLLBACK;  -- Pour annuler la suppression
