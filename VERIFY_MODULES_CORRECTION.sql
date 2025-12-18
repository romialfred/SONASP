/*
  ==========================================
  SCRIPT DE VÉRIFICATION - CORRECTION MODULES
  ==========================================

  Exécutez ce script APRÈS avoir appliqué
  FIX_MODULES_EXACT_SIDEBAR.sql pour vérifier
  que tout est correct.
  ==========================================
*/

-- ==========================================
-- TEST 1: Vérifier le nombre total de modules
-- ==========================================
-- Doit afficher: total_modules = 33, active_modules = 33
SELECT
  COUNT(*) as total_modules,
  COUNT(CASE WHEN is_active THEN 1 END) as active_modules,
  COUNT(CASE WHEN NOT is_active THEN 1 END) as inactive_modules
FROM modules;

-- ==========================================
-- TEST 2: Vérifier le nombre de catégories
-- ==========================================
-- Doit afficher: 11 catégories
SELECT
  COUNT(DISTINCT category) as total_categories,
  STRING_AGG(DISTINCT category, ', ' ORDER BY category) as category_list
FROM modules;

-- ==========================================
-- TEST 3: Compter les modules par catégorie
-- ==========================================
-- Doit correspondre à la structure documentée
SELECT
  category,
  COUNT(*) as module_count,
  STRING_AGG(display_name, ', ' ORDER BY sort_order) as modules
FROM modules
WHERE is_active = true
GROUP BY category
ORDER BY MIN(sort_order);

-- ==========================================
-- TEST 4: Vérifier la structure détaillée
-- ==========================================
SELECT
  CASE category
    WHEN 'overview' THEN '1. Dashboard'
    WHEN 'production' THEN '2. Production Management'
    WHEN 'shipping' THEN '3. Shipping Management'
    WHEN 'refining' THEN '4. Refining'
    WHEN 'refinery_inventory' THEN '5. Refinery Inventory'
    WHEN 'documents' THEN '6. Document Management'
    WHEN 'marketplace' THEN '7. Marketplace'
    WHEN 'sales' THEN '8. Sales'
    WHEN 'stakeholders' THEN '9. Stakeholders'
    WHEN 'insights' THEN '10. Insights & Reports'
    WHEN 'administration' THEN '11. Administration'
    ELSE category
  END as group_name,
  sort_order,
  name as module_name,
  display_name,
  description
FROM modules
ORDER BY sort_order;

-- ==========================================
-- TEST 5: Vérifier les noms de modules spécifiques
-- ==========================================
-- Ces modules DOIVENT exister
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'dashboard') THEN '✓'
    ELSE '✗ MISSING'
  END as has_dashboard,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'daily_production') THEN '✓'
    ELSE '✗ MISSING'
  END as has_daily_production,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'shipping_preparation') THEN '✓'
    ELSE '✗ MISSING'
  END as has_shipping_preparation,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'refining_process') THEN '✓'
    ELSE '✗ MISSING'
  END as has_refining_process,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'gold_inventory') THEN '✓'
    ELSE '✗ MISSING'
  END as has_gold_inventory,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'assay_certificates') THEN '✓'
    ELSE '✗ MISSING'
  END as has_assay_certificates,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'trade_space') THEN '✓'
    ELSE '✗ MISSING'
  END as has_trade_space,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'sales') THEN '✓'
    ELSE '✗ MISSING'
  END as has_sales,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'customers') THEN '✓'
    ELSE '✗ MISSING'
  END as has_customers,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'analytics') THEN '✓'
    ELSE '✗ MISSING'
  END as has_analytics,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE name = 'users') THEN '✓'
    ELSE '✗ MISSING'
  END as has_users;

-- ==========================================
-- TEST 6: Vérifier qu'il n'y a pas de doublons
-- ==========================================
-- Doit afficher 0 lignes
SELECT
  name,
  COUNT(*) as duplicate_count
FROM modules
GROUP BY name
HAVING COUNT(*) > 1;

-- ==========================================
-- TEST 7: Vérifier les anciennes catégories (ne doivent PAS exister)
-- ==========================================
-- Ces catégories ne doivent PAS exister (anciennes structures)
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE category = 'batches') THEN '✗ OLD CATEGORY EXISTS: batches'
    ELSE '✓ No old batches category'
  END as check_old_batches,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE category = 'operations') THEN '✗ OLD CATEGORY EXISTS: operations'
    ELSE '✓ No old operations category'
  END as check_old_operations,
  CASE
    WHEN EXISTS (SELECT 1 FROM modules WHERE category = 'system') THEN '✗ OLD CATEGORY EXISTS: system'
    ELSE '✓ No old system category'
  END as check_old_system;

-- ==========================================
-- TEST 8: Vérifier les modules par groupe attendu
-- ==========================================

-- Overview (1 module)
SELECT 'Overview' as test_group, COUNT(*) as count, 1 as expected
FROM modules WHERE category = 'overview'
UNION ALL
-- Production (4 modules)
SELECT 'Production', COUNT(*), 4
FROM modules WHERE category = 'production'
UNION ALL
-- Shipping (2 modules)
SELECT 'Shipping', COUNT(*), 2
FROM modules WHERE category = 'shipping'
UNION ALL
-- Refining (1 module)
SELECT 'Refining', COUNT(*), 1
FROM modules WHERE category = 'refining'
UNION ALL
-- Refinery Inventory (2 modules)
SELECT 'Refinery Inventory', COUNT(*), 2
FROM modules WHERE category = 'refinery_inventory'
UNION ALL
-- Documents (1 module)
SELECT 'Documents', COUNT(*), 1
FROM modules WHERE category = 'documents'
UNION ALL
-- Marketplace (3 modules)
SELECT 'Marketplace', COUNT(*), 3
FROM modules WHERE category = 'marketplace'
UNION ALL
-- Sales (3 modules)
SELECT 'Sales', COUNT(*), 3
FROM modules WHERE category = 'sales'
UNION ALL
-- Stakeholders (5 modules)
SELECT 'Stakeholders', COUNT(*), 5
FROM modules WHERE category = 'stakeholders'
UNION ALL
-- Insights (2 modules)
SELECT 'Insights', COUNT(*), 2
FROM modules WHERE category = 'insights'
UNION ALL
-- Administration (6 modules)
SELECT 'Administration', COUNT(*), 6
FROM modules WHERE category = 'administration';

-- ==========================================
-- TEST 9: Vérifier la table user_permissions
-- ==========================================
SELECT
  COUNT(*) as total_permissions,
  COUNT(DISTINCT user_id) as users_with_permissions,
  COUNT(DISTINCT module_id) as modules_with_permissions
FROM user_permissions;

-- ==========================================
-- TEST 10: Résultat final du test
-- ==========================================
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM modules) = 33
     AND (SELECT COUNT(DISTINCT category) FROM modules) = 11
     AND NOT EXISTS (SELECT 1 FROM modules WHERE category IN ('batches', 'operations', 'system'))
     AND NOT EXISTS (
       SELECT name, COUNT(*) as cnt
       FROM modules
       GROUP BY name
       HAVING COUNT(*) > 1
     )
    THEN '✅ TOUS LES TESTS PASSÉS - CORRECTION RÉUSSIE !'
    ELSE '❌ PROBLÈME DÉTECTÉ - VÉRIFIER LES TESTS CI-DESSUS'
  END as test_result;

-- ==========================================
-- LISTE DES 33 MODULES ATTENDUS
-- ==========================================
/*
CHECKLIST DES 33 MODULES:

Overview (1):
  ✓ dashboard

Production (4):
  ✓ daily_production
  ✓ production_in_safe
  ✓ export_licenses
  ✓ budget_forecasts

Shipping (2):
  ✓ shipping_preparation
  ✓ invoice_consignment

Refining (1):
  ✓ refining_process

Refinery Inventory (2):
  ✓ gold_inventory
  ✓ silver_inventory

Documents (1):
  ✓ assay_certificates

Marketplace (3):
  ✓ trade_space
  ✓ gold_prices
  ✓ fx_rates

Sales (3):
  ✓ presales
  ✓ sales
  ✓ payments

Stakeholders (5):
  ✓ mining_companies
  ✓ freight_companies
  ✓ refinery_plants
  ✓ depositors
  ✓ customers

Insights (2):
  ✓ analytics
  ✓ reports

Administration (6):
  ✓ users
  ✓ settings
  ✓ gold_sales_settings
  ✓ status_manager
  ✓ workflow
  ✓ audit
*/
