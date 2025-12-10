/*
  # Module de Paramétrage des Ventes d'Or

  ## Objectif
  Créer un système de configuration des ventes par couple Mine-Client permettant de :
  - Définir les clients autorisés pour chaque mine
  - Limiter le pourcentage maximum de stock par transaction
  - Configurer la méthode de vente
  - Gérer la répartition des frais (raffinage, transport)

  ## Tables Créées
  1. `gold_sales_settings` - Configuration des ventes Mine-Client

  ## Sécurité
  - RLS activé sur toutes les tables
  - Politiques pour lecture/écriture selon les rôles
*/

-- ============================================================================
-- ÉTAPE 1: Créer la table gold_sales_settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS gold_sales_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  mining_company_id UUID NOT NULL REFERENCES mining_companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Configuration de vente
  max_stock_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00 CHECK (max_stock_percentage > 0 AND max_stock_percentage <= 100),
  sale_method TEXT NOT NULL DEFAULT 'standard' CHECK (sale_method IN ('standard', 'consignment', 'forward_sale', 'spot_sale')),

  -- Répartition des frais
  refining_fees_paid_by_customer BOOLEAN NOT NULL DEFAULT false,
  transport_fees_paid_by_customer BOOLEAN NOT NULL DEFAULT false,

  -- Métadonnées
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Contrainte d'unicité : une seule configuration par couple Mine-Client
  CONSTRAINT unique_mining_company_customer UNIQUE (mining_company_id, customer_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_mining_company
  ON gold_sales_settings(mining_company_id);

CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_customer
  ON gold_sales_settings(customer_id);

CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_active
  ON gold_sales_settings(is_active) WHERE is_active = true;

-- Commentaires
COMMENT ON TABLE gold_sales_settings IS
  'Configuration des paramètres de vente par couple Mine-Client';

COMMENT ON COLUMN gold_sales_settings.max_stock_percentage IS
  'Pourcentage maximum du stock disponible pouvant être vendu en une transaction (1-100)';

COMMENT ON COLUMN gold_sales_settings.sale_method IS
  'Méthode de vente: standard, consignment, forward_sale, spot_sale';

COMMENT ON COLUMN gold_sales_settings.refining_fees_paid_by_customer IS
  'true = frais de raffinage à la charge du client, false = à la charge du vendeur';

COMMENT ON COLUMN gold_sales_settings.transport_fees_paid_by_customer IS
  'true = frais de transport à la charge du client, false = à la charge du vendeur';

-- ============================================================================
-- ÉTAPE 2: Trigger pour updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_gold_sales_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_gold_sales_settings_updated_at
  ON gold_sales_settings;

CREATE TRIGGER trigger_update_gold_sales_settings_updated_at
  BEFORE UPDATE ON gold_sales_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_gold_sales_settings_updated_at();

-- ============================================================================
-- ÉTAPE 3: Row Level Security (RLS)
-- ============================================================================

ALTER TABLE gold_sales_settings ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : tous les utilisateurs authentifiés
DROP POLICY IF EXISTS "Allow authenticated users to read gold sales settings"
  ON gold_sales_settings;

CREATE POLICY "Allow authenticated users to read gold sales settings"
  ON gold_sales_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique d'insertion : Management et Admin seulement
DROP POLICY IF EXISTS "Allow management to insert gold sales settings"
  ON gold_sales_settings;

CREATE POLICY "Allow management to insert gold sales settings"
  ON gold_sales_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('management', 'admin')
    )
  );

-- Politique de mise à jour : Management et Admin seulement
DROP POLICY IF EXISTS "Allow management to update gold sales settings"
  ON gold_sales_settings;

CREATE POLICY "Allow management to update gold sales settings"
  ON gold_sales_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('management', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('management', 'admin')
    )
  );

-- Politique de suppression : Admin seulement
DROP POLICY IF EXISTS "Allow admin to delete gold sales settings"
  ON gold_sales_settings;

CREATE POLICY "Allow admin to delete gold sales settings"
  ON gold_sales_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- ÉTAPE 4: Fonctions utilitaires
-- ============================================================================

-- Fonction pour obtenir les clients autorisés pour une mine
CREATE OR REPLACE FUNCTION get_authorized_customers_for_mine(p_mining_company_id UUID)
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  max_stock_percentage NUMERIC,
  sale_method TEXT,
  refining_fees_paid_by_customer BOOLEAN,
  transport_fees_paid_by_customer BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    gss.max_stock_percentage,
    gss.sale_method,
    gss.refining_fees_paid_by_customer,
    gss.transport_fees_paid_by_customer
  FROM gold_sales_settings gss
  INNER JOIN customers c ON c.id = gss.customer_id
  WHERE gss.mining_company_id = p_mining_company_id
    AND gss.is_active = true
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si une vente est autorisée
CREATE OR REPLACE FUNCTION check_sale_authorization(
  p_mining_company_id UUID,
  p_customer_id UUID,
  p_quantity_oz NUMERIC,
  p_available_stock_oz NUMERIC
)
RETURNS TABLE (
  is_authorized BOOLEAN,
  reason TEXT,
  max_allowed_oz NUMERIC,
  settings JSONB
) AS $$
DECLARE
  v_settings gold_sales_settings;
  v_max_allowed_oz NUMERIC;
  v_percentage NUMERIC;
BEGIN
  -- Chercher la configuration
  SELECT * INTO v_settings
  FROM gold_sales_settings
  WHERE mining_company_id = p_mining_company_id
    AND customer_id = p_customer_id
    AND is_active = true;

  -- Si pas de configuration, autoriser (comportement par défaut)
  IF v_settings.id IS NULL THEN
    RETURN QUERY SELECT
      true,
      'No configuration found - default behavior'::TEXT,
      p_available_stock_oz,
      NULL::JSONB;
    RETURN;
  END IF;

  -- Calculer la quantité maximale autorisée
  v_max_allowed_oz := (p_available_stock_oz * v_settings.max_stock_percentage) / 100.0;

  -- Calculer le pourcentage demandé
  v_percentage := (p_quantity_oz / p_available_stock_oz) * 100.0;

  -- Vérifier si la quantité est autorisée
  IF p_quantity_oz > v_max_allowed_oz THEN
    RETURN QUERY SELECT
      false,
      format('Quantity exceeds maximum allowed: %.2f%% requested but only %.2f%% allowed',
             v_percentage, v_settings.max_stock_percentage),
      v_max_allowed_oz,
      jsonb_build_object(
        'max_stock_percentage', v_settings.max_stock_percentage,
        'sale_method', v_settings.sale_method,
        'refining_fees_paid_by_customer', v_settings.refining_fees_paid_by_customer,
        'transport_fees_paid_by_customer', v_settings.transport_fees_paid_by_customer
      );
  ELSE
    RETURN QUERY SELECT
      true,
      'Sale authorized'::TEXT,
      v_max_allowed_oz,
      jsonb_build_object(
        'max_stock_percentage', v_settings.max_stock_percentage,
        'sale_method', v_settings.sale_method,
        'refining_fees_paid_by_customer', v_settings.refining_fees_paid_by_customer,
        'transport_fees_paid_by_customer', v_settings.transport_fees_paid_by_customer
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ÉTAPE 5: Vue pour faciliter les requêtes
-- ============================================================================

CREATE OR REPLACE VIEW gold_sales_settings_view AS
SELECT
  gss.id,
  gss.mining_company_id,
  mc.name AS mining_company_name,
  mc.abbreviation AS mining_company_abbr,
  gss.customer_id,
  c.name AS customer_name,
  c.contact_person,
  gss.max_stock_percentage,
  gss.sale_method,
  gss.refining_fees_paid_by_customer,
  gss.transport_fees_paid_by_customer,
  gss.is_active,
  gss.notes,
  gss.created_at,
  gss.updated_at,
  creator.full_name AS created_by_name,
  updater.full_name AS updated_by_name
FROM gold_sales_settings gss
INNER JOIN mining_companies mc ON mc.id = gss.mining_company_id
INNER JOIN customers c ON c.id = gss.customer_id
LEFT JOIN user_profiles creator ON creator.id = gss.created_by
LEFT JOIN user_profiles updater ON updater.id = gss.updated_by;

COMMENT ON VIEW gold_sales_settings_view IS
  'Vue enrichie des paramètres de vente avec les noms des entités liées';
