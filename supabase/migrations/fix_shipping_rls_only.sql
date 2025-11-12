/*
  # Correction des Politiques RLS pour le Système de Shipping

  ## Vue d'ensemble
  Cette migration corrige uniquement les politiques RLS (Row Level Security)
  pour les tables shipping existantes. Elle NE RECRÉE PAS les tables.

  ## Problème Résolu
  - Politiques RLS manquantes ou incorrectes sur les tables shipping
  - Erreurs de permissions lors de l'enregistrement des préparations

  ## Sécurité
  - Utilise DROP POLICY IF EXISTS pour éviter les erreurs
  - Politiques permettent l'accès aux utilisateurs authentifiés
  - Pas de modification de structure de tables

  ## Tables Affectées
  - shipping_preparations
  - shipping_production_items
  - shipping_signatories
  - shipping_ingots
  - shipping_documents
*/

-- =====================================================
-- 1. ACTIVER RLS (si pas déjà activé)
-- =====================================================

ALTER TABLE shipping_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_ingots ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_documents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. POLICIES: shipping_preparations
-- =====================================================

DROP POLICY IF EXISTS "Users can view shipping preparations" ON shipping_preparations;
CREATE POLICY "Users can view shipping preparations"
  ON shipping_preparations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create shipping preparations" ON shipping_preparations;
CREATE POLICY "Users can create shipping preparations"
  ON shipping_preparations FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update shipping preparations" ON shipping_preparations;
CREATE POLICY "Users can update shipping preparations"
  ON shipping_preparations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete shipping preparations" ON shipping_preparations;
CREATE POLICY "Users can delete shipping preparations"
  ON shipping_preparations FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 3. POLICIES: shipping_production_items
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
-- 4. POLICIES: shipping_signatories
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
-- 5. POLICIES: shipping_ingots
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
-- 6. POLICIES: shipping_documents
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
-- 7. FONCTION pour calculer les totaux (si non existante)
-- =====================================================

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

-- =====================================================
-- 8. TRIGGER pour mise à jour automatique des totaux
-- =====================================================

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
-- FIN - Migration RLS uniquement
-- =====================================================
