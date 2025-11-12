/*
  # Système Complet de Préparation des Expéditions (Shipping)

  ## Vue d'ensemble
  Ce fichier crée l'infrastructure complète pour le système de gestion des expéditions d'or,
  incluant la préparation des expéditions, les éléments de production, les signataires,
  les lingots et les documents associés.

  ## 1. Tables Créées
    - `shipping_preparations` : Préparations d'expéditions avec numéro de lot, statut, destinations
    - `shipping_production_items` : Éléments de production associés à chaque expédition
    - `shipping_signatories` : Signataires des documents d'expédition
    - `shipping_ingots` : Informations détaillées sur les lingots expédiés
    - `shipping_documents` : Documents de support (packing lists, rapports, certificats)

  ## 2. Sécurité (RLS)
    - RLS activé sur toutes les tables
    - Politiques restrictives : accès uniquement pour utilisateurs authentifiés
    - Permissions lecture/écriture basées sur l'authentification

  ## 3. Fonctionnalités
    - Suivi complet du cycle de vie des expéditions (prepared, shipped)
    - Gestion des numéros de scellés (seal numbers)
    - Association avec les productions quotidiennes (daily_production)
    - Upload et gestion des documents
    - Génération automatique de packing lists

  ## 4. Notes Importantes
    - Utilise les UUID pour tous les IDs
    - Horodatage automatique (created_at, updated_at)
    - Contraintes d'intégrité référentielle
    - Index pour optimiser les performances
*/

-- =====================================================
-- 1. TABLE: shipping_preparations
-- =====================================================
CREATE TABLE IF NOT EXISTS shipping_preparations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_production_id UUID REFERENCES daily_production(id) ON DELETE SET NULL,
  expedition_lot_number TEXT UNIQUE,
  seal_number TEXT,
  packing_list_url TEXT,
  packing_list_document_id UUID,
  shipped_to_company TEXT,
  shipped_to_address TEXT,
  shipped_to_country TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'prepared', 'shipped')),
  prepared_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  notes TEXT,
  total_net_weight_grams DECIMAL(12, 4) DEFAULT 0,
  total_gross_weight_grams DECIMAL(12, 4) DEFAULT 0,
  total_boxes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_status ON shipping_preparations(status);
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_expedition_lot ON shipping_preparations(expedition_lot_number);
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_created_by ON shipping_preparations(created_by);
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_production ON shipping_preparations(daily_production_id);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_shipping_preparations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shipping_preparations_updated_at ON shipping_preparations;
CREATE TRIGGER trigger_shipping_preparations_updated_at
  BEFORE UPDATE ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_preparations_updated_at();

-- =====================================================
-- 2. TABLE: shipping_production_items
-- =====================================================
CREATE TABLE IF NOT EXISTS shipping_production_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id UUID NOT NULL REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  daily_production_id UUID NOT NULL REFERENCES daily_production(id) ON DELETE CASCADE,
  ingot_box_number TEXT NOT NULL,
  net_weight_grams DECIMAL(12, 4) NOT NULL,
  gross_weight_grams DECIMAL(12, 4) NOT NULL,
  fineness_pct DECIMAL(5, 2) NOT NULL,
  pure_gold_grams DECIMAL(12, 4) NOT NULL,
  seal_number_1 TEXT,
  seal_number_2 TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(shipping_preparation_id, daily_production_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_shipping_production_items_prep ON shipping_production_items(shipping_preparation_id);
CREATE INDEX IF NOT EXISTS idx_shipping_production_items_production ON shipping_production_items(daily_production_id);
CREATE INDEX IF NOT EXISTS idx_shipping_production_items_order ON shipping_production_items(shipping_preparation_id, order_index);

-- =====================================================
-- 3. TABLE: shipping_signatories
-- =====================================================
CREATE TABLE IF NOT EXISTS shipping_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id UUID NOT NULL REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  name TEXT NOT NULL,
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_shipping_signatories_prep ON shipping_signatories(shipping_preparation_id);
CREATE INDEX IF NOT EXISTS idx_shipping_signatories_order ON shipping_signatories(shipping_preparation_id, order_index);

-- =====================================================
-- 4. TABLE: shipping_ingots
-- =====================================================
CREATE TABLE IF NOT EXISTS shipping_ingots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id UUID NOT NULL REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  ingot_box_number TEXT NOT NULL,
  net_weight_grams DECIMAL(12, 4) NOT NULL,
  gross_weight_grams DECIMAL(12, 4) NOT NULL,
  seal_number_1 TEXT,
  seal_number_2 TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_shipping_ingots_prep ON shipping_ingots(shipping_preparation_id);

-- =====================================================
-- 5. TABLE: shipping_documents
-- =====================================================
CREATE TABLE IF NOT EXISTS shipping_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id UUID NOT NULL REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_shipping_documents_prep ON shipping_documents(shipping_preparation_id);
CREATE INDEX IF NOT EXISTS idx_shipping_documents_uploaded_by ON shipping_documents(uploaded_by);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE shipping_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_ingots ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_documents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. POLICIES: shipping_preparations
-- =====================================================

-- SELECT: Tous les utilisateurs authentifiés peuvent voir les préparations
DROP POLICY IF EXISTS "Users can view shipping preparations" ON shipping_preparations;
CREATE POLICY "Users can view shipping preparations"
  ON shipping_preparations FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Tous les utilisateurs authentifiés peuvent créer des préparations
DROP POLICY IF EXISTS "Users can create shipping preparations" ON shipping_preparations;
CREATE POLICY "Users can create shipping preparations"
  ON shipping_preparations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Tous les utilisateurs authentifiés peuvent mettre à jour
DROP POLICY IF EXISTS "Users can update shipping preparations" ON shipping_preparations;
CREATE POLICY "Users can update shipping preparations"
  ON shipping_preparations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Tous les utilisateurs authentifiés peuvent supprimer
DROP POLICY IF EXISTS "Users can delete shipping preparations" ON shipping_preparations;
CREATE POLICY "Users can delete shipping preparations"
  ON shipping_preparations FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 8. POLICIES: shipping_production_items
-- =====================================================

DROP POLICY IF EXISTS "Users can view production items" ON shipping_production_items;
CREATE POLICY "Users can view production items"
  ON shipping_production_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create production items" ON shipping_production_items;
CREATE POLICY "Users can create production items"
  ON shipping_production_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update production items" ON shipping_production_items;
CREATE POLICY "Users can update production items"
  ON shipping_production_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete production items" ON shipping_production_items;
CREATE POLICY "Users can delete production items"
  ON shipping_production_items FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 9. POLICIES: shipping_signatories
-- =====================================================

DROP POLICY IF EXISTS "Users can view signatories" ON shipping_signatories;
CREATE POLICY "Users can view signatories"
  ON shipping_signatories FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create signatories" ON shipping_signatories;
CREATE POLICY "Users can create signatories"
  ON shipping_signatories FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update signatories" ON shipping_signatories;
CREATE POLICY "Users can update signatories"
  ON shipping_signatories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete signatories" ON shipping_signatories;
CREATE POLICY "Users can delete signatories"
  ON shipping_signatories FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 10. POLICIES: shipping_ingots
-- =====================================================

DROP POLICY IF EXISTS "Users can view ingots" ON shipping_ingots;
CREATE POLICY "Users can view ingots"
  ON shipping_ingots FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create ingots" ON shipping_ingots;
CREATE POLICY "Users can create ingots"
  ON shipping_ingots FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update ingots" ON shipping_ingots;
CREATE POLICY "Users can update ingots"
  ON shipping_ingots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete ingots" ON shipping_ingots;
CREATE POLICY "Users can delete ingots"
  ON shipping_ingots FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 11. POLICIES: shipping_documents
-- =====================================================

DROP POLICY IF EXISTS "Users can view documents" ON shipping_documents;
CREATE POLICY "Users can view documents"
  ON shipping_documents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create documents" ON shipping_documents;
CREATE POLICY "Users can create documents"
  ON shipping_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update documents" ON shipping_documents;
CREATE POLICY "Users can update documents"
  ON shipping_documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete documents" ON shipping_documents;
CREATE POLICY "Users can delete documents"
  ON shipping_documents FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 12. FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour calculer les totaux de préparation
CREATE OR REPLACE FUNCTION calculate_shipping_preparation_totals(prep_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE shipping_preparations
  SET
    total_net_weight_grams = (
      SELECT COALESCE(SUM(net_weight_grams), 0)
      FROM shipping_production_items
      WHERE shipping_preparation_id = prep_id
    ),
    total_gross_weight_grams = (
      SELECT COALESCE(SUM(gross_weight_grams), 0)
      FROM shipping_production_items
      WHERE shipping_preparation_id = prep_id
    ),
    total_boxes = (
      SELECT COUNT(*)
      FROM shipping_production_items
      WHERE shipping_preparation_id = prep_id
    )
  WHERE id = prep_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour mettre à jour automatiquement les totaux
CREATE OR REPLACE FUNCTION trigger_update_shipping_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM calculate_shipping_preparation_totals(NEW.shipping_preparation_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM calculate_shipping_preparation_totals(OLD.shipping_preparation_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shipping_production_items_totals ON shipping_production_items;
CREATE TRIGGER trigger_shipping_production_items_totals
  AFTER INSERT OR UPDATE OR DELETE ON shipping_production_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_shipping_totals();

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
