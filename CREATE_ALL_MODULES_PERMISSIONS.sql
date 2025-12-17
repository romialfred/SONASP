/*
  ==========================================
  POPULATE ALL APPLICATION MODULES
  ==========================================

  Run this SQL in Supabase SQL Editor to populate
  the modules table with all 43 application modules

  This fixes the issue where permissions tab only
  shows old modules (Batches, Sales, Refining)
  ==========================================
*/

-- Create modules table if not exists
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_permissions table if not exists
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE NOT NULL,
  can_read boolean DEFAULT false,
  can_write boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  field_permissions jsonb DEFAULT '{}'::jsonb,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view modules" ON modules;
DROP POLICY IF EXISTS "Users can view their own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can view all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can insert permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can update permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can delete permissions" ON user_permissions;

-- RLS Policies for modules (read-only for authenticated users)
CREATE POLICY "Authenticated users can view modules"
  ON modules
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_permissions
CREATE POLICY "Users can view their own permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Management can view all permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can insert permissions"
  ON user_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can update permissions"
  ON user_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can delete permissions"
  ON user_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Clear existing modules (optional - uncomment if you want to start fresh)
-- DELETE FROM modules;

-- ==========================================
-- INSERT ALL 43 APPLICATION MODULES
-- ==========================================

INSERT INTO modules (name, display_name, description, category, sort_order) VALUES

-- ========== BATCHES MANAGEMENT (Category: batches) ==========
('dashboard', 'Tableau de Bord', 'Tableaux de bord et vues d''ensemble', 'batches', 1),
('production_daily', 'Production Quotidienne', 'Enregistrement de la production quotidienne', 'batches', 2),
('production_view', 'Consultation Production', 'Voir les données de production', 'batches', 3),
('production_in_safe', 'Production en Coffre', 'Gestion de l''or en coffre', 'batches', 4),
('shipping_preparation', 'Préparation Expédition', 'Créer et gérer les préparations d''expédition', 'batches', 10),
('shipping_view', 'Consultation Expéditions', 'Voir les expéditions', 'batches', 11),
('documents_assay', 'Certificats d''Essai', 'Gestion des certificats d''essai', 'batches', 30),
('documents_export_licenses', 'Licences d''Export', 'Gestion des licences d''exportation', 'batches', 31),

-- ========== OPERATIONS (Category: operations) ==========
('freight_shipments', 'Expéditions de Fret', 'Gestion des expéditions de fret internationales', 'operations', 20),
('freight_customs', 'Douanes & Documents', 'Factures et documents douaniers', 'operations', 21),
('inventory_gold', 'Inventaire Or', 'Gestion du stock d''or', 'operations', 40),
('inventory_silver', 'Inventaire Argent', 'Gestion du stock d''argent', 'operations', 41),
('receiving', 'Réception', 'Confirmation de réception des lots', 'operations', 50),
('refining_process', 'Processus de Raffinage', 'Gestion du processus de raffinage', 'operations', 51),
('refining_freight', 'Fret Raffinage', 'Expéditions vers raffineries', 'operations', 52),

-- ========== SALES MANAGEMENT (Category: sales) ==========
('sales_view', 'Consultation Ventes', 'Voir les ventes d''or', 'sales', 60),
('sales_create', 'Création Vente', 'Créer nouvelle vente', 'sales', 61),
('sales_trade_space', 'Espace Trading', 'Espace de trading et ventes en direct', 'sales', 62),
('presales', 'Pré-Ventes', 'Gestion des pré-ventes et estimations', 'sales', 63),
('customers_view', 'Consultation Clients', 'Voir la liste des clients', 'sales', 70),
('customers_manage', 'Gestion Clients', 'Créer et modifier des clients', 'sales', 71),
('payments_view', 'Consultation Paiements', 'Voir les paiements', 'sales', 80),
('payments_create', 'Enregistrer Paiement', 'Enregistrer nouveau paiement', 'sales', 81),
('payments_approve', 'Approuver Paiements', 'Approuver les paiements clients', 'sales', 82),
('payments_virtual', 'Paiements Virtuels', 'Gérer les paiements virtuels', 'sales', 83),

-- ========== INSIGHTS & REPORTS (Category: analytics) ==========
('analytics_dashboard', 'Tableau Analytique', 'Analyses et intelligence d''affaires', 'analytics', 90),
('analytics_intelligence', 'Intelligence Center', 'Centre d''intelligence avancée', 'analytics', 91),
('reports_generate', 'Génération Rapports', 'Générer et gérer les rapports', 'analytics', 92),
('performance_budgets', 'Gestion Budgets', 'Gestion des budgets annuels', 'analytics', 100),
('performance_forecasts', 'Prévisions', 'Gestion des prévisions', 'analytics', 101),
('prices_gold', 'Prix de l''Or', 'Gestion des prix de l''or (LBMA)', 'analytics', 110),
('prices_fx_rates', 'Taux de Change', 'Gestion des taux FX (USD/CFA/GNF)', 'analytics', 111),

-- ========== ADMINISTRATION (Category: system) ==========
('stakeholders_mining', 'Sociétés Minières', 'Gestion des sociétés minières', 'system', 120),
('stakeholders_depositors', 'Déposants', 'Gestion des déposants', 'system', 121),
('stakeholders_freight', 'Compagnies de Fret', 'Gestion des compagnies de transport', 'system', 122),
('stakeholders_refineries', 'Raffineries', 'Gestion des raffineries', 'system', 123),
('stakeholders_transport', 'Transport Terrestre', 'Compagnies de transport terrestre', 'system', 124),
('users_manage', 'Gestion Utilisateurs', 'Créer et gérer les utilisateurs', 'system', 130),
('users_permissions', 'Permissions Utilisateurs', 'Configurer les permissions', 'system', 131),
('settings_system', 'Paramètres Système', 'Configuration système', 'system', 132),
('settings_gold_sales', 'Paramètres Ventes', 'Configuration des paramètres de vente', 'system', 133),
('settings_status_manager', 'Gestionnaire Statuts', 'Gérer les statuts et workflows', 'system', 134),
('audit_trail', 'Journal d''Audit', 'Consultation des logs d''audit', 'system', 140),
('approvals_dashboard', 'Tableau Approbations', 'Gestion des workflows d''approbation', 'system', 141)

ON CONFLICT (name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_modules_category ON modules(category);
CREATE INDEX IF NOT EXISTS idx_modules_active ON modules(is_active);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module ON user_permissions(module_id);

-- Create or replace update triggers
CREATE OR REPLACE FUNCTION update_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS modules_updated_at ON modules;
CREATE TRIGGER modules_updated_at
  BEFORE UPDATE ON modules
  FOR EACH ROW
  EXECUTE FUNCTION update_modules_updated_at();

CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_permissions_updated_at ON user_permissions;
CREATE TRIGGER user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions_updated_at();

-- ==========================================
-- VERIFICATION QUERY
-- ==========================================
-- Run this to verify all modules were inserted

SELECT
  category,
  COUNT(*) as module_count,
  STRING_AGG(display_name, ', ' ORDER BY sort_order) as modules
FROM modules
WHERE is_active = true
GROUP BY category
ORDER BY category;

-- Count total modules
SELECT COUNT(*) as total_modules FROM modules WHERE is_active = true;
