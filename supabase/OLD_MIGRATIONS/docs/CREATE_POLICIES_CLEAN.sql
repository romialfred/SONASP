/*
  ÉTAPE 2 : CRÉATION DES POLICIES PROPRES

  Exécutez ce fichier APRÈS avoir exécuté CLEAN_POLICIES_FIRST.sql
*/

-- Réactiver RLS
ALTER TABLE batch_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Policies pour batch_approvals
-- ============================================================================

CREATE POLICY "batch_approvals_select_policy"
  ON batch_approvals
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "batch_approvals_insert_policy"
  ON batch_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- Policies pour system_parameters
-- ============================================================================

CREATE POLICY "system_parameters_select_policy"
  ON system_parameters
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "system_parameters_management_policy"
  ON system_parameters
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- ============================================================================
-- Policies pour gold_inventory
-- ============================================================================

CREATE POLICY "gold_inventory_select_policy"
  ON gold_inventory
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "gold_inventory_insert_policy"
  ON gold_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('refinery', 'management')
    )
  );

CREATE POLICY "gold_inventory_update_policy"
  ON gold_inventory
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- ============================================================================
-- Policies pour inventory_transactions
-- ============================================================================

CREATE POLICY "inventory_transactions_select_policy"
  ON inventory_transactions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "inventory_transactions_insert_policy"
  ON inventory_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Toutes les policies ont été créées avec succès';
END $$;
