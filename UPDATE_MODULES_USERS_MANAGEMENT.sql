/*
  Mise à jour des modules - Renommer Users en Users Management
  et ajouter des modules par catégorie
*/

-- 1. Mettre à jour le module Users existant vers Users Management
UPDATE modules
SET
  display_name = 'Users Management',
  description = 'Manage user accounts, roles, and permissions'
WHERE name LIKE '%user%' OR display_name LIKE '%User%';

-- 2. S'assurer que tous les modules ont une catégorie
UPDATE modules
SET category = 'system'
WHERE name IN ('users_manage', 'users', 'user_management', 'parameters', 'system_settings', 'audit_trail', 'workflow', 'status_manager')
AND (category IS NULL OR category = '');

UPDATE modules
SET category = 'batches'
WHERE name IN ('batches', 'batches_view', 'batches_create', 'shipping', 'shipping_preparations', 'refining', 'receiving')
AND (category IS NULL OR category = '');

UPDATE modules
SET category = 'sales'
WHERE name IN ('sales', 'sales_view', 'sales_create', 'customers', 'customers_view', 'customers_manage', 'payments', 'payments_view', 'payments_create', 'payments_approve', 'payments_documents', 'gold_prices', 'fx_rates')
AND (category IS NULL OR category = '');

UPDATE modules
SET category = 'operations'
WHERE name IN ('inventory', 'production', 'export_licenses', 'freight', 'transport_companies', 'refineries')
AND (category IS NULL OR category = '');

UPDATE modules
SET category = 'analytics'
WHERE name IN ('analytics', 'analytics_dashboard', 'reports', 'reports_financial', 'reports_operational')
AND (category IS NULL OR category = '');

UPDATE modules
SET category = 'overview'
WHERE name IN ('dashboard', 'overview')
AND (category IS NULL OR category = '');

-- 3. Créer les modules principaux s'ils n'existent pas (avec catégories)

-- Overview
INSERT INTO modules (id, name, display_name, description, category, is_active)
VALUES (
  gen_random_uuid(),
  'dashboard',
  'Dashboard',
  'View main dashboard and overview',
  'overview',
  true
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Batches Management
INSERT INTO modules (id, name, display_name, description, category, is_active)
VALUES
  (gen_random_uuid(), 'batches', 'Batches', 'Batch management and tracking', 'batches', true),
  (gen_random_uuid(), 'shipping', 'Shipping', 'Manage shipping and transportation', 'batches', true),
  (gen_random_uuid(), 'refining', 'Refining', 'Process refining operations', 'batches', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Sales Management
INSERT INTO modules (id, name, display_name, description, category, is_active)
VALUES
  (gen_random_uuid(), 'customers', 'Customers', 'Customer relationship management', 'sales', true),
  (gen_random_uuid(), 'sales', 'Sales', 'Sales transactions and management', 'sales', true),
  (gen_random_uuid(), 'payments', 'Payments', 'Payment processing and tracking', 'sales', true),
  (gen_random_uuid(), 'gold_prices', 'Gold Prices', 'View gold price feeds', 'sales', true),
  (gen_random_uuid(), 'fx_rates', 'FX Rates', 'Exchange rate management', 'sales', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Operations
INSERT INTO modules (id, name, display_name, description, category, is_active)
VALUES
  (gen_random_uuid(), 'inventory', 'Inventory', 'Inventory management and tracking', 'operations', true),
  (gen_random_uuid(), 'production', 'Production', 'Production monitoring and control', 'operations', true),
  (gen_random_uuid(), 'export_licenses', 'Export Licenses', 'Export license management', 'operations', true),
  (gen_random_uuid(), 'freight', 'Freight & Customs', 'Freight shipment and customs', 'operations', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Analytics & Reports
INSERT INTO modules (id, name, display_name, description, category, is_active)
VALUES
  (gen_random_uuid(), 'analytics', 'Analytics', 'Analytics dashboard and insights', 'analytics', true),
  (gen_random_uuid(), 'reports', 'Reports', 'Generate and view reports', 'analytics', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- System Administration
INSERT INTO modules (id, name, display_name, description, category, is_active)
VALUES
  (gen_random_uuid(), 'users_management', 'Users Management', 'Manage user accounts, roles, and permissions', 'system', true),
  (gen_random_uuid(), 'parameters', 'Parameters', 'System parameters and configuration', 'system', true),
  (gen_random_uuid(), 'workflow', 'Workflow', 'Workflow and status management', 'system', true),
  (gen_random_uuid(), 'audit_trail', 'Audit Trail', 'View system audit logs', 'system', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- 4. Vérifier le résultat
SELECT
  category,
  COUNT(*) as module_count,
  string_agg(display_name, ', ' ORDER BY display_name) as modules
FROM modules
WHERE is_active = true
GROUP BY category
ORDER BY
  CASE category
    WHEN 'overview' THEN 1
    WHEN 'batches' THEN 2
    WHEN 'sales' THEN 3
    WHEN 'operations' THEN 4
    WHEN 'analytics' THEN 5
    WHEN 'system' THEN 6
    ELSE 7
  END;
