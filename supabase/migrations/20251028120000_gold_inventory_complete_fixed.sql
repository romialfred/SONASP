/*
  # Gold Inventory Management - Version Complète et Corrigée

  ## Ce que fait cette migration
  1. Nettoie toutes les anciennes policies problématiques
  2. Crée les tables manquantes (batch_approvals, system_parameters, gold_inventory, inventory_transactions)
  3. Configure les triggers et fonctions
  4. Crée les policies RLS SANS référence à approver_id
*/

-- ============================================================================
-- ÉTAPE 1: NETTOYAGE DES ANCIENNES POLICIES
-- ============================================================================

-- Supprimer toutes les policies sur batch_approvals si la table existe
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'batch_approvals') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'batch_approvals')
    LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON batch_approvals';
    END LOOP;
    ALTER TABLE batch_approvals DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Supprimer toutes les policies sur system_parameters si la table existe
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_parameters') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'system_parameters')
    LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON system_parameters';
    END LOOP;
    ALTER TABLE system_parameters DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Supprimer toutes les policies sur gold_inventory si la table existe
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gold_inventory') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'gold_inventory')
    LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON gold_inventory';
    END LOOP;
    ALTER TABLE gold_inventory DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Supprimer toutes les policies sur inventory_transactions si la table existe
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_transactions') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'inventory_transactions')
    LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON inventory_transactions';
    END LOOP;
    ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 2: VÉRIFIER QUE LA TABLE SALES EXISTE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales') THEN
    CREATE TABLE sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_number TEXT UNIQUE,
      customer_id UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "sales_select_policy" ON sales FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 3: CRÉER LA TABLE batch_approvals
-- ============================================================================

CREATE TABLE IF NOT EXISTS batch_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL CHECK (
    approval_type IN (
      'factory_transport', 'airport_receipt', 'airport_validation',
      'refinery_receipt', 'refinery_validation', 'processing_completion'
    )
  ),
  approver_id UUID NOT NULL,
  approver_name TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'rejected', 'conditional')),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  comments TEXT,
  variance_grams DECIMAL(10, 2),
  variance_percentage DECIMAL(5, 2),
  variance_within_threshold BOOLEAN,
  ip_address TEXT,
  approved_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_approvals_batch_id ON batch_approvals(batch_id, approval_type);
CREATE INDEX IF NOT EXISTS idx_batch_approvals_approver ON batch_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_batch_approvals_type ON batch_approvals(approval_type, approved_at);

-- ============================================================================
-- ÉTAPE 4: CRÉER LA TABLE system_parameters
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_key TEXT UNIQUE NOT NULL,
  parameter_value TEXT NOT NULL,
  parameter_type TEXT NOT NULL CHECK (parameter_type IN ('numeric', 'text', 'boolean', 'json')),
  category TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insérer les paramètres par défaut
INSERT INTO system_parameters (parameter_key, parameter_value, parameter_type, category, description, display_order)
VALUES
  ('airport_variance_threshold_percentage', '0.5', 'numeric', 'receiving', 'Maximum acceptable variance at airport', 1),
  ('refinery_variance_threshold_percentage', '0.5', 'numeric', 'receiving', 'Maximum acceptable variance at refinery', 2),
  ('low_stock_alert_threshold_oz', '100', 'numeric', 'inventory', 'Low stock alert threshold', 3),
  ('critical_stock_alert_threshold_oz', '50', 'numeric', 'inventory', 'Critical stock alert threshold', 4),
  ('auto_allocate_inventory', 'true', 'boolean', 'sales', 'Auto allocate inventory using FIFO', 5),
  ('require_refinery_processing_approval', 'true', 'boolean', 'refining', 'Require supervisor approval', 6)
ON CONFLICT (parameter_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_system_parameters_category ON system_parameters(category, display_order);
CREATE INDEX IF NOT EXISTS idx_system_parameters_active ON system_parameters(is_active, parameter_key);

-- ============================================================================
-- ÉTAPE 5: CRÉER LA TABLE gold_inventory
-- ============================================================================

CREATE TABLE IF NOT EXISTS gold_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  refining_record_id UUID REFERENCES refining_records(id) ON DELETE RESTRICT,

  weight_before_melting_grams DECIMAL(12, 3) NOT NULL,
  weight_after_melting_grams DECIMAL(12, 3) NOT NULL,
  fineness_percentage DECIMAL(5, 2) NOT NULL CHECK (fineness_percentage >= 0 AND fineness_percentage <= 100),
  metal_retained_percentage DECIMAL(5, 2) NOT NULL CHECK (metal_retained_percentage >= 0 AND metal_retained_percentage <= 100),

  final_fine_grams DECIMAL(12, 4) NOT NULL,
  final_fine_oz DECIMAL(12, 4) NOT NULL,
  variance_with_export_invoice_oz DECIMAL(12, 4),

  quantity_available_oz DECIMAL(12, 4) NOT NULL,
  quantity_allocated_oz DECIMAL(12, 4) DEFAULT 0,
  quantity_sold_oz DECIMAL(12, 4) DEFAULT 0,

  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('entry', 'exit')),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,

  notes TEXT,
  processing_location TEXT,
  certificate_number TEXT,

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT positive_weights CHECK (
    weight_before_melting_grams > 0 AND weight_after_melting_grams > 0 AND
    final_fine_grams > 0 AND final_fine_oz > 0
  ),
  CONSTRAINT valid_stock_quantities CHECK (
    quantity_available_oz >= 0 AND quantity_allocated_oz >= 0 AND quantity_sold_oz >= 0 AND
    (quantity_allocated_oz + quantity_sold_oz) <= final_fine_oz
  )
);

CREATE INDEX IF NOT EXISTS idx_gold_inventory_batch_id ON gold_inventory(batch_id);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_refining_id ON gold_inventory(refining_record_id);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_entry_date ON gold_inventory(entry_date);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_transaction_type ON gold_inventory(transaction_type);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_sale_id ON gold_inventory(sale_id);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_available ON gold_inventory(quantity_available_oz) WHERE quantity_available_oz > 0;

-- ============================================================================
-- ÉTAPE 6: CRÉER LA TABLE inventory_transactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date TIMESTAMPTZ DEFAULT now(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('entry', 'exit', 'allocation', 'deallocation', 'adjustment')),

  inventory_id UUID NOT NULL REFERENCES gold_inventory(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id),
  sale_id UUID REFERENCES sales(id),

  quantity_oz DECIMAL(12, 4) NOT NULL,
  quantity_grams DECIMAL(12, 3),

  balance_before_oz DECIMAL(12, 4) NOT NULL,
  balance_after_oz DECIMAL(12, 4) NOT NULL,

  transaction_reference TEXT,
  notes TEXT,

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT positive_quantity CHECK (quantity_oz > 0),
  CONSTRAINT valid_balance CHECK (balance_after_oz >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_id ON inventory_transactions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_batch_id ON inventory_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_sale_id ON inventory_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(transaction_type);

-- ============================================================================
-- ÉTAPE 7: CRÉER LES FONCTIONS ET TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_final_fine()
RETURNS TRIGGER AS $$
BEGIN
  NEW.final_fine_grams := (NEW.weight_after_melting_grams * (NEW.fineness_percentage / 100) * (NEW.metal_retained_percentage / 100));
  NEW.final_fine_oz := NEW.final_fine_grams / 28.3495;

  IF NEW.transaction_type = 'entry' THEN
    NEW.quantity_available_oz := NEW.final_fine_oz;
    NEW.quantity_allocated_oz := 0;
    NEW.quantity_sold_oz := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_final_fine ON gold_inventory;
CREATE TRIGGER trigger_calculate_final_fine
  BEFORE INSERT OR UPDATE ON gold_inventory
  FOR EACH ROW EXECUTE FUNCTION calculate_final_fine();

CREATE OR REPLACE FUNCTION log_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO inventory_transactions (
      transaction_type, inventory_id, batch_id, sale_id,
      quantity_oz, quantity_grams, balance_before_oz, balance_after_oz,
      transaction_reference, notes, created_by
    ) VALUES (
      NEW.transaction_type, NEW.id, NEW.batch_id, NEW.sale_id,
      NEW.final_fine_oz, NEW.final_fine_grams, 0, NEW.quantity_available_oz,
      CASE WHEN NEW.transaction_type = 'entry' THEN 'Stock entry from refining' ELSE 'Stock exit for sale' END,
      NEW.notes, NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_inventory_transaction ON gold_inventory;
CREATE TRIGGER trigger_log_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW EXECUTE FUNCTION log_inventory_transaction();

-- ============================================================================
-- ÉTAPE 8: ACTIVER RLS ET CRÉER LES POLICIES (SANS approver_id)
-- ============================================================================

-- Activer RLS
ALTER TABLE batch_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Policies pour batch_approvals
CREATE POLICY "batch_approvals_select_policy"
  ON batch_approvals FOR SELECT TO authenticated USING (true);

CREATE POLICY "batch_approvals_insert_policy"
  ON batch_approvals FOR INSERT TO authenticated WITH CHECK (true);

-- Policies pour system_parameters
CREATE POLICY "system_parameters_select_policy"
  ON system_parameters FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "system_parameters_management_policy"
  ON system_parameters FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Policies pour gold_inventory
CREATE POLICY "gold_inventory_select_policy"
  ON gold_inventory FOR SELECT TO authenticated USING (true);

CREATE POLICY "gold_inventory_insert_policy"
  ON gold_inventory FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('refinery', 'management')
    )
  );

CREATE POLICY "gold_inventory_update_policy"
  ON gold_inventory FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Policies pour inventory_transactions
CREATE POLICY "inventory_transactions_select_policy"
  ON inventory_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_transactions_insert_policy"
  ON inventory_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- ÉTAPE 9: CRÉER LES VUES
-- ============================================================================

CREATE OR REPLACE VIEW monthly_inventory_summary AS
SELECT
  DATE_TRUNC('month', entry_date) as month,
  COUNT(DISTINCT id) as total_entries,
  COUNT(DISTINCT batch_id) as total_batches,
  SUM(CASE WHEN transaction_type = 'entry' THEN final_fine_oz ELSE 0 END) as total_entries_oz,
  SUM(CASE WHEN transaction_type = 'exit' THEN final_fine_oz ELSE 0 END) as total_exits_oz,
  SUM(quantity_available_oz) as available_stock_oz,
  SUM(quantity_allocated_oz) as allocated_stock_oz,
  SUM(quantity_sold_oz) as sold_stock_oz,
  AVG(fineness_percentage) as avg_fineness_percentage,
  AVG(metal_retained_percentage) as avg_metal_retained_percentage
FROM gold_inventory
GROUP BY DATE_TRUNC('month', entry_date)
ORDER BY month DESC;

CREATE OR REPLACE VIEW current_inventory_status AS
SELECT
  gi.id, gi.entry_date, b.batch_number, gi.final_fine_oz,
  gi.quantity_available_oz, gi.quantity_allocated_oz, gi.quantity_sold_oz,
  gi.fineness_percentage, gi.metal_retained_percentage, gi.transaction_type,
  s.sale_number, up.full_name as created_by_name, gi.created_at
FROM gold_inventory gi
LEFT JOIN batches b ON b.id = gi.batch_id
LEFT JOIN sales s ON s.id = gi.sale_id
LEFT JOIN user_profiles up ON up.id = gi.created_by
WHERE gi.quantity_available_oz > 0 OR gi.created_at > now() - INTERVAL '90 days'
ORDER BY gi.entry_date DESC, gi.created_at DESC;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE batch_approvals IS 'Tracks all approval actions in the batch lifecycle';
COMMENT ON TABLE system_parameters IS 'Configurable system parameters for business rules';
COMMENT ON TABLE gold_inventory IS 'Master inventory table for pure gold stock management';
COMMENT ON TABLE inventory_transactions IS 'Detailed transaction log for all stock movements';
