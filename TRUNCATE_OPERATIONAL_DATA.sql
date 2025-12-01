/*
  # TRUNCATE OPERATIONAL DATA - Gold Shipper
  
  ## Objectif
  Supprimer toutes les données opérationnelles tout en gardant:
  - Les données de référence (budgets, forecasts)
  - Les prix (gold prices, FX rates)
  - Les stakeholders (mining companies, refineries, customers, etc.)
  
  ## Tables à TRUNCATE
  1. Daily Production
  2. Shipping Preparation
  3. Freight & Customs
  4. Production associée
  5. Sales
  6. Payments
  7. Inventory movements
  
  ## Tables à GARDER (NE PAS TOUCHER)
  - Budgets (annual_budgets, monthly_budget_forecasts)
  - Gold Prices (gold_prices, gold_price_aggregations)
  - FX Rates (fx_rates, fx_rate_aggregations)
  - Stakeholders (mining_companies, refineries, customers, etc.)
*/

-- =====================================================
-- 1. DÉSACTIVER LES TRIGGERS TEMPORAIREMENT
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'DÉBUT DU TRUNCATE - DONNÉES OPÉRATIONNELLES';
  RAISE NOTICE '==============================================';
END $$;

-- =====================================================
-- 2. TRUNCATE FREIGHT & CUSTOMS MODULE
-- =====================================================

DO $$
DECLARE
  v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '1. FREIGHT & CUSTOMS MODULE';
  RAISE NOTICE '----------------------------';
  
  -- Signataires
  SELECT COUNT(*) INTO v_count FROM freight_shipment_signatories;
  RAISE NOTICE 'Signataires à supprimer: %', v_count;
  TRUNCATE freight_shipment_signatories CASCADE;
  RAISE NOTICE '✓ Signataires supprimés';
  
  -- Productions liées freight
  SELECT COUNT(*) INTO v_count FROM freight_shipment_productions;
  RAISE NOTICE 'Productions freight à supprimer: %', v_count;
  TRUNCATE freight_shipment_productions CASCADE;
  RAISE NOTICE '✓ Productions freight supprimées';
  
  -- Expéditions freight
  SELECT COUNT(*) INTO v_count FROM freight_shipments;
  RAISE NOTICE 'Expéditions freight à supprimer: %', v_count;
  TRUNCATE freight_shipments CASCADE;
  RAISE NOTICE '✓ Expéditions freight supprimées';
END $$;

-- =====================================================
-- 3. TRUNCATE SHIPPING PREPARATION
-- =====================================================

DO $$
DECLARE
  v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '2. SHIPPING PREPARATION';
  RAISE NOTICE '------------------------';
  
  -- Vérifier si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_preparations') THEN
    SELECT COUNT(*) INTO v_count FROM shipping_preparations;
    RAISE NOTICE 'Préparations shipping à supprimer: %', v_count;
    TRUNCATE shipping_preparations CASCADE;
    RAISE NOTICE '✓ Préparations shipping supprimées';
  ELSE
    RAISE NOTICE '⚠ Table shipping_preparations non trouvée';
  END IF;
END $$;

-- =====================================================
-- 4. TRUNCATE DAILY PRODUCTION
-- =====================================================

DO $$
DECLARE
  v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '3. DAILY PRODUCTION';
  RAISE NOTICE '-------------------';
  
  -- Production documents
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_documents') THEN
    SELECT COUNT(*) INTO v_count FROM production_documents;
    RAISE NOTICE 'Documents production à supprimer: %', v_count;
    TRUNCATE production_documents CASCADE;
    RAISE NOTICE '✓ Documents production supprimés';
  END IF;
  
  -- Daily production
  SELECT COUNT(*) INTO v_count FROM daily_production;
  RAISE NOTICE 'Productions quotidiennes à supprimer: %', v_count;
  TRUNCATE daily_production CASCADE;
  RAISE NOTICE '✓ Productions quotidiennes supprimées';
END $$;

-- =====================================================
-- 5. TRUNCATE SALES & PAYMENTS
-- =====================================================

DO $$
DECLARE
  v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '4. SALES & PAYMENTS';
  RAISE NOTICE '-------------------';
  
  -- Payments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    SELECT COUNT(*) INTO v_count FROM payments;
    RAISE NOTICE 'Paiements à supprimer: %', v_count;
    TRUNCATE payments CASCADE;
    RAISE NOTICE '✓ Paiements supprimés';
  END IF;
  
  -- Sales
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    SELECT COUNT(*) INTO v_count FROM sales;
    RAISE NOTICE 'Ventes à supprimer: %', v_count;
    TRUNCATE sales CASCADE;
    RAISE NOTICE '✓ Ventes supprimées';
  END IF;
  
  -- Pre-sales
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pre_sales') THEN
    SELECT COUNT(*) INTO v_count FROM pre_sales;
    RAISE NOTICE 'Pré-ventes à supprimer: %', v_count;
    TRUNCATE pre_sales CASCADE;
    RAISE NOTICE '✓ Pré-ventes supprimées';
  END IF;
END $$;

-- =====================================================
-- 6. TRUNCATE INVENTORY
-- =====================================================

DO $$
DECLARE
  v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '5. INVENTORY';
  RAISE NOTICE '-------------';
  
  -- Inventory movements
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_movements') THEN
    SELECT COUNT(*) INTO v_count FROM inventory_movements;
    RAISE NOTICE 'Mouvements inventory à supprimer: %', v_count;
    TRUNCATE inventory_movements CASCADE;
    RAISE NOTICE '✓ Mouvements inventory supprimés';
  END IF;
  
  -- Silver inventory
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'silver_inventory') THEN
    SELECT COUNT(*) INTO v_count FROM silver_inventory;
    RAISE NOTICE 'Inventory argent à supprimer: %', v_count;
    TRUNCATE silver_inventory CASCADE;
    RAISE NOTICE '✓ Inventory argent supprimé';
  END IF;
END $$;

-- =====================================================
-- 7. TRUNCATE EXPORT LICENSES
-- =====================================================

DO $$
DECLARE
  v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '6. EXPORT LICENSES';
  RAISE NOTICE '------------------';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'export_licenses') THEN
    SELECT COUNT(*) INTO v_count FROM export_licenses;
    RAISE NOTICE 'Licences export à supprimer: %', v_count;
    TRUNCATE export_licenses CASCADE;
    RAISE NOTICE '✓ Licences export supprimées';
  END IF;
END $$;

-- =====================================================
-- 8. TRUNCATE ASSAY CERTIFICATES
-- =====================================================

DO $$
DECLARE
  v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '7. ASSAY CERTIFICATES';
  RAISE NOTICE '---------------------';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assay_certificates') THEN
    SELECT COUNT(*) INTO v_count FROM assay_certificates;
    RAISE NOTICE 'Certificats assay à supprimer: %', v_count;
    TRUNCATE assay_certificates CASCADE;
    RAISE NOTICE '✓ Certificats assay supprimés';
  END IF;
END $$;

-- =====================================================
-- 9. TRUNCATE AUDIT LOGS (Optionnel)
-- =====================================================

DO $$
DECLARE
  v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '8. AUDIT LOGS (Optionnel)';
  RAISE NOTICE '-------------------------';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    SELECT COUNT(*) INTO v_count FROM audit_logs;
    RAISE NOTICE 'Logs audit à supprimer: %', v_count;
    -- Décommentez la ligne suivante pour supprimer les logs
    -- TRUNCATE audit_logs CASCADE;
    RAISE NOTICE '⚠ Logs audit CONSERVÉS (décommentez pour supprimer)';
  END IF;
END $$;

-- =====================================================
-- 10. VÉRIFICATION FINALE
-- =====================================================

DO $$
DECLARE
  v_daily_production int;
  v_freight int;
  v_shipping int;
  v_sales int;
  v_payments int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '==============================================';
  
  -- Compter les données restantes
  SELECT COUNT(*) INTO v_daily_production FROM daily_production;
  SELECT COUNT(*) INTO v_freight FROM freight_shipments;
  
  -- Shipping (si existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_preparations') THEN
    SELECT COUNT(*) INTO v_shipping FROM shipping_preparations;
  ELSE
    v_shipping := 0;
  END IF;
  
  -- Sales (si existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    SELECT COUNT(*) INTO v_sales FROM sales;
  ELSE
    v_sales := 0;
  END IF;
  
  -- Payments (si existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    SELECT COUNT(*) INTO v_payments FROM payments;
  ELSE
    v_payments := 0;
  END IF;
  
  RAISE NOTICE 'Daily Production: % lignes', v_daily_production;
  RAISE NOTICE 'Freight Shipments: % lignes', v_freight;
  RAISE NOTICE 'Shipping Preparations: % lignes', v_shipping;
  RAISE NOTICE 'Sales: % lignes', v_sales;
  RAISE NOTICE 'Payments: % lignes', v_payments;
  
  IF v_daily_production = 0 AND v_freight = 0 AND v_shipping = 0 AND v_sales = 0 AND v_payments = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ TOUTES LES DONNÉES OPÉRATIONNELLES SONT SUPPRIMÉES';
  ELSE
    RAISE WARNING 'Certaines données restent dans les tables!';
  END IF;
END $$;

-- =====================================================
-- 11. VÉRIFICATION DES DONNÉES CONSERVÉES
-- =====================================================

DO $$
DECLARE
  v_budgets int;
  v_forecasts int;
  v_gold_prices int;
  v_fx_rates int;
  v_mining_companies int;
  v_customers int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'DONNÉES CONSERVÉES (RÉFÉRENCE)';
  RAISE NOTICE '==============================================';
  
  -- Budgets
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'annual_budgets') THEN
    SELECT COUNT(*) INTO v_budgets FROM annual_budgets;
    RAISE NOTICE 'Budgets annuels: % lignes (✓ conservés)', v_budgets;
  END IF;
  
  -- Forecasts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_budget_forecasts') THEN
    SELECT COUNT(*) INTO v_forecasts FROM monthly_budget_forecasts;
    RAISE NOTICE 'Prévisions mensuelles: % lignes (✓ conservées)', v_forecasts;
  END IF;
  
  -- Gold prices
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gold_prices') THEN
    SELECT COUNT(*) INTO v_gold_prices FROM gold_prices;
    RAISE NOTICE 'Prix de l''or: % lignes (✓ conservés)', v_gold_prices;
  END IF;
  
  -- FX rates
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fx_rates') THEN
    SELECT COUNT(*) INTO v_fx_rates FROM fx_rates;
    RAISE NOTICE 'Taux de change: % lignes (✓ conservés)', v_fx_rates;
  END IF;
  
  -- Mining companies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mining_companies') THEN
    SELECT COUNT(*) INTO v_mining_companies FROM mining_companies;
    RAISE NOTICE 'Compagnies minières: % lignes (✓ conservées)', v_mining_companies;
  END IF;
  
  -- Customers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    SELECT COUNT(*) INTO v_customers FROM customers;
    RAISE NOTICE 'Clients: % lignes (✓ conservés)', v_customers;
  END IF;
END $$;

-- =====================================================
-- 12. MESSAGE FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'TRUNCATE TERMINÉ AVEC SUCCÈS';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Données supprimées:';
  RAISE NOTICE '  ✓ Daily Production';
  RAISE NOTICE '  ✓ Shipping Preparation';
  RAISE NOTICE '  ✓ Freight & Customs';
  RAISE NOTICE '  ✓ Sales & Payments';
  RAISE NOTICE '  ✓ Inventory';
  RAISE NOTICE '  ✓ Export Licenses';
  RAISE NOTICE '  ✓ Assay Certificates';
  RAISE NOTICE '';
  RAISE NOTICE 'Données conservées:';
  RAISE NOTICE '  ✓ Budgets & Forecasts';
  RAISE NOTICE '  ✓ Gold Prices';
  RAISE NOTICE '  ✓ FX Rates';
  RAISE NOTICE '  ✓ Stakeholders (mining companies, customers, etc.)';
  RAISE NOTICE '';
END $$;
