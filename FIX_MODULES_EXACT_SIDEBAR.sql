/*
  ==========================================
  FIX MODULES - CORRESPONDANCE EXACTE SIDEBAR
  ==========================================

  Ce script met à jour la table modules pour qu'elle
  corresponde EXACTEMENT au menu AccordionSidebar utilisé
  dans l'application.

  Structure basée sur AccordionSidebar.tsx
  ==========================================
*/

-- ==========================================
-- STEP 1: Nettoyer les anciens modules
-- ==========================================

-- Supprimer tous les anciens modules
DELETE FROM modules;

-- ==========================================
-- STEP 2: Insérer les modules EXACTS du sidebar
-- ==========================================

-- ========== DASHBOARD (Standalone) ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('dashboard', 'Dashboard', 'Global dashboard and overview', 'overview', 1);

-- ========== PRODUCTION MANAGEMENT ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('daily_production', 'Daily Production', 'Register daily gold production', 'production', 10),
('production_in_safe', 'Production in Safe', 'Manage gold stored in safe', 'production', 11),
('export_licenses', 'Export Licenses', 'Manage export licenses and quotas', 'production', 12),
('budget_forecasts', 'Budget & Forecasts', 'Manage annual budgets and forecasts', 'production', 13);

-- ========== SHIPPING MANAGEMENT ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('shipping_preparation', 'Shipping Preparation', 'Prepare shipments for export', 'shipping', 20),
('invoice_consignment', 'Invoice & Consignment', 'Manage freight invoices and consignment notes', 'shipping', 21);

-- ========== REFINING ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('refining_process', 'Refining Process', 'Manage gold refining operations', 'refining', 30);

-- ========== REFINERY INVENTORY ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('gold_inventory', 'Gold Inventory', 'Track gold inventory at refineries', 'refinery_inventory', 40),
('silver_inventory', 'Silver Inventory', 'Track silver inventory at refineries', 'refinery_inventory', 41);

-- ========== DOCUMENT MANAGEMENT ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('assay_certificates', 'Assay Certificates', 'Manage assay certificates and quality reports', 'documents', 50);

-- ========== MARKETPLACE ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('trade_space', 'Trade Space', 'Live trading space with market data', 'marketplace', 60),
('gold_prices', 'Gold Prices', 'View and manage LBMA gold prices', 'marketplace', 61),
('fx_rates', 'FX Rates', 'Manage exchange rates (USD/CFA/GNF)', 'marketplace', 62);

-- ========== SALES ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('presales', 'Pre-Sales', 'Manage pre-sales and estimations', 'sales', 70),
('sales', 'Sales', 'Manage gold sales to customers', 'sales', 71),
('payments', 'Payments', 'Record and track customer payments', 'sales', 72);

-- ========== STAKEHOLDERS ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('mining_companies', 'Mining Companies', 'Manage mining company information', 'stakeholders', 80),
('freight_companies', 'Freight Companies', 'Manage freight and transport companies', 'stakeholders', 81),
('refinery_plants', 'Refinery Plants', 'Manage refinery plant information', 'stakeholders', 82),
('depositors', 'Depositors', 'Manage depositor information', 'stakeholders', 83),
('customers', 'Customers', 'Manage customer accounts and profiles', 'stakeholders', 84);

-- ========== INSIGHTS & REPORTS ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('analytics', 'Analytics', 'Business intelligence and analytics dashboard', 'insights', 90),
('reports', 'Reports', 'Generate and schedule reports', 'insights', 91);

-- ========== ADMINISTRATION ==========
INSERT INTO modules (name, display_name, description, category, sort_order) VALUES
('users', 'Users Management', 'Manage user accounts and access', 'administration', 100),
('settings', 'Settings', 'System parameters and configuration', 'administration', 101),
('gold_sales_settings', 'Gold Sales Settings', 'Configure gold sales parameters', 'administration', 102),
('status_manager', 'Status Manager', 'Manage workflow statuses and transitions', 'administration', 103),
('workflow', 'Workflow', 'Manage business workflow configurations', 'administration', 104),
('audit', 'Audit Trail', 'View system audit logs and history', 'administration', 105);

-- ==========================================
-- STEP 3: Vérification de la structure
-- ==========================================

-- Afficher les modules par catégorie
SELECT
  category,
  COUNT(*) as module_count,
  STRING_AGG(display_name, ', ' ORDER BY sort_order) as modules
FROM modules
WHERE is_active = true
GROUP BY category
ORDER BY MIN(sort_order);

-- Total des modules
SELECT
  COUNT(*) as total_modules,
  COUNT(CASE WHEN is_active THEN 1 END) as active_modules
FROM modules;

-- Liste complète ordonnée
SELECT
  category,
  sort_order,
  name,
  display_name,
  description
FROM modules
ORDER BY sort_order;

-- ==========================================
-- MAPPING DES GROUPES
-- ==========================================
/*
SIDEBAR GROUP -> CATEGORY IN DB

1. Dashboard (standalone) -> overview
2. Production Management -> production
3. Shipping Management -> shipping
4. Refining -> refining
5. Refinery Inventory -> refinery_inventory
6. Document Management -> documents
7. Marketplace -> marketplace
8. Sales -> sales
9. Stakeholders -> stakeholders
10. Insights & Reports -> insights
11. Administration -> administration

TOTAL: 11 groupes (catégories) + 33 modules
*/
