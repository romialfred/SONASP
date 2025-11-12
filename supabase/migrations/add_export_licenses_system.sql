/*
  # Système de Gestion des Licences d'Exportation

  ## Vue d'ensemble
  Cette migration crée le système complet de gestion des licences d'exportation
  pour l'or, incluant le suivi des quantités exportées.

  ## Nouvelles Tables
  1. `export_licenses` - Licences d'exportation principales
     - Informations de la licence (dates, quantités, prix)
     - Lien avec la compagnie minière
     - Documents associés
     - Suivi des quantités (allouées, utilisées, restantes)

  2. `export_license_documents` - Documents liés aux licences
     - Plusieurs documents PDF par licence
     - Noms et URLs des fichiers

  ## Modifications Tables Existantes
  - Ajout de `license_id` à `shipping_preparations`
  - Trigger pour mise à jour automatique des quantités utilisées

  ## Sécurité
  - RLS activé sur toutes les tables
  - Politiques pour utilisateurs authentifiés
  - Audit trail complet

  ## Important
  - Toutes les opérations sont sécurisées avec IF EXISTS/IF NOT EXISTS
  - Pas de perte de données
  - Compatible avec données existantes
*/

-- =====================================================
-- 1. CRÉATION DE LA TABLE export_licenses
-- =====================================================

CREATE TABLE IF NOT EXISTS export_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Informations de base
  license_number VARCHAR(100) UNIQUE NOT NULL,
  mining_company_id UUID REFERENCES mining_companies(id) ON DELETE RESTRICT NOT NULL,

  -- Dates
  request_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Institution émettrice
  issuing_institution VARCHAR(255) NOT NULL,

  -- Quantités (en grammes)
  authorized_quantity_grams DECIMAL(15, 2) NOT NULL CHECK (authorized_quantity_grams > 0),
  used_quantity_grams DECIMAL(15, 2) DEFAULT 0 CHECK (used_quantity_grams >= 0),
  remaining_quantity_grams DECIMAL(15, 2) GENERATED ALWAYS AS (authorized_quantity_grams - used_quantity_grams) STORED,

  -- Prix moyen de vente
  average_sale_price DECIMAL(15, 2) CHECK (average_sale_price >= 0),

  -- Statut
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'exhausted', 'suspended', 'cancelled')),

  -- Commentaires et notes
  comments TEXT,
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Contraintes
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_used_quantity CHECK (used_quantity_grams <= authorized_quantity_grams)
);

-- Index pour optimisation
CREATE INDEX IF NOT EXISTS idx_export_licenses_mining_company ON export_licenses(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_export_licenses_status ON export_licenses(status);
CREATE INDEX IF NOT EXISTS idx_export_licenses_dates ON export_licenses(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_export_licenses_license_number ON export_licenses(license_number);

-- Commentaires
COMMENT ON TABLE export_licenses IS 'Licences d''exportation d''or avec suivi des quantités autorisées et utilisées';
COMMENT ON COLUMN export_licenses.authorized_quantity_grams IS 'Quantité totale autorisée par la licence (en grammes)';
COMMENT ON COLUMN export_licenses.used_quantity_grams IS 'Quantité déjà exportée sous cette licence (en grammes)';
COMMENT ON COLUMN export_licenses.remaining_quantity_grams IS 'Quantité restante disponible (calculée automatiquement)';

-- =====================================================
-- 2. CRÉATION DE LA TABLE export_license_documents
-- =====================================================

CREATE TABLE IF NOT EXISTS export_license_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES export_licenses(id) ON DELETE CASCADE NOT NULL,

  -- Informations du document
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(100), -- 'license_copy', 'authorization', 'certificate', etc.
  file_url TEXT,
  file_path TEXT,
  file_size_kb INTEGER,

  -- Métadonnées
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),

  -- Notes
  description TEXT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_license_documents_license ON export_license_documents(license_id);

-- Commentaires
COMMENT ON TABLE export_license_documents IS 'Documents PDF associés aux licences d''exportation';

-- =====================================================
-- 3. AJOUT DE license_id À shipping_preparations
-- =====================================================

-- Ajouter la colonne si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'license_id'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN license_id UUID REFERENCES export_licenses(id) ON DELETE RESTRICT;

    RAISE NOTICE 'Colonne license_id ajoutée à shipping_preparations';
  ELSE
    RAISE NOTICE 'Colonne license_id existe déjà';
  END IF;
END $$;

-- Index pour optimisation
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_license ON shipping_preparations(license_id);

-- =====================================================
-- 4. FONCTION DE MISE À JOUR DES QUANTITÉS
-- =====================================================

-- Fonction pour calculer et mettre à jour les quantités utilisées
CREATE OR REPLACE FUNCTION update_license_used_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_total_weight DECIMAL(15, 2);
BEGIN
  -- Calculer le total des poids nets de toutes les préparations pour cette licence
  SELECT COALESCE(SUM(total_net_weight_grams), 0)
  INTO v_total_weight
  FROM shipping_preparations
  WHERE license_id = COALESCE(NEW.license_id, OLD.license_id)
    AND status IN ('prepared', 'shipped');

  -- Mettre à jour la quantité utilisée dans la licence
  UPDATE export_licenses
  SET
    used_quantity_grams = v_total_weight,
    updated_at = now(),
    -- Mettre à jour le statut si la licence est épuisée
    status = CASE
      WHEN v_total_weight >= authorized_quantity_grams THEN 'exhausted'
      WHEN CURRENT_DATE > end_date THEN 'expired'
      ELSE status
    END
  WHERE id = COALESCE(NEW.license_id, OLD.license_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_insert ON shipping_preparations;
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_update ON shipping_preparations;
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_delete ON shipping_preparations;

-- Trigger sur INSERT de shipping_preparations
CREATE TRIGGER trg_update_license_quantity_on_insert
AFTER INSERT ON shipping_preparations
FOR EACH ROW
WHEN (NEW.license_id IS NOT NULL)
EXECUTE FUNCTION update_license_used_quantity();

-- Trigger sur UPDATE de shipping_preparations
CREATE TRIGGER trg_update_license_quantity_on_update
AFTER UPDATE OF license_id, total_net_weight_grams, status ON shipping_preparations
FOR EACH ROW
WHEN (NEW.license_id IS NOT NULL OR OLD.license_id IS NOT NULL)
EXECUTE FUNCTION update_license_used_quantity();

-- Trigger sur DELETE de shipping_preparations
CREATE TRIGGER trg_update_license_quantity_on_delete
AFTER DELETE ON shipping_preparations
FOR EACH ROW
WHEN (OLD.license_id IS NOT NULL)
EXECUTE FUNCTION update_license_used_quantity();

-- =====================================================
-- 5. FONCTION POUR VÉRIFIER LA DISPONIBILITÉ
-- =====================================================

CREATE OR REPLACE FUNCTION check_license_availability(
  p_license_id UUID,
  p_required_quantity DECIMAL(15, 2)
)
RETURNS TABLE (
  is_available BOOLEAN,
  remaining_quantity DECIMAL(15, 2),
  message TEXT
) AS $$
DECLARE
  v_license RECORD;
BEGIN
  -- Récupérer les informations de la licence
  SELECT
    status,
    authorized_quantity_grams,
    used_quantity_grams,
    remaining_quantity_grams,
    end_date
  INTO v_license
  FROM export_licenses
  WHERE id = p_license_id;

  -- Vérifier si la licence existe
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::DECIMAL(15, 2), 'Licence non trouvée';
    RETURN;
  END IF;

  -- Vérifier si la licence est active
  IF v_license.status != 'active' THEN
    RETURN QUERY SELECT FALSE, v_license.remaining_quantity_grams, 'Licence non active (statut: ' || v_license.status || ')';
    RETURN;
  END IF;

  -- Vérifier si la licence n'est pas expirée
  IF v_license.end_date < CURRENT_DATE THEN
    RETURN QUERY SELECT FALSE, v_license.remaining_quantity_grams, 'Licence expirée le ' || v_license.end_date::TEXT;
    RETURN;
  END IF;

  -- Vérifier si la quantité est suffisante
  IF v_license.remaining_quantity_grams < p_required_quantity THEN
    RETURN QUERY SELECT
      FALSE,
      v_license.remaining_quantity_grams,
      'Quantité insuffisante. Disponible: ' || v_license.remaining_quantity_grams::TEXT || 'g, Requis: ' || p_required_quantity::TEXT || 'g';
    RETURN;
  END IF;

  -- Tout est OK
  RETURN QUERY SELECT TRUE, v_license.remaining_quantity_grams, 'Licence valide et quantité disponible';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. FONCTION DE MISE À JOUR AUTOMATIQUE updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour export_licenses
DROP TRIGGER IF EXISTS trg_export_licenses_updated_at ON export_licenses;
CREATE TRIGGER trg_export_licenses_updated_at
BEFORE UPDATE ON export_licenses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Activer RLS sur export_licenses
ALTER TABLE export_licenses ENABLE ROW LEVEL SECURITY;

-- Politique pour SELECT (tous les utilisateurs authentifiés)
DROP POLICY IF EXISTS "Users can view export licenses" ON export_licenses;
CREATE POLICY "Users can view export licenses"
  ON export_licenses
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique pour INSERT (utilisateurs authentifiés)
DROP POLICY IF EXISTS "Users can create export licenses" ON export_licenses;
CREATE POLICY "Users can create export licenses"
  ON export_licenses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique pour UPDATE (utilisateurs authentifiés)
DROP POLICY IF EXISTS "Users can update export licenses" ON export_licenses;
CREATE POLICY "Users can update export licenses"
  ON export_licenses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique pour DELETE (utilisateurs authentifiés)
DROP POLICY IF EXISTS "Users can delete export licenses" ON export_licenses;
CREATE POLICY "Users can delete export licenses"
  ON export_licenses
  FOR DELETE
  TO authenticated
  USING (true);

-- Activer RLS sur export_license_documents
ALTER TABLE export_license_documents ENABLE ROW LEVEL SECURITY;

-- Politiques pour export_license_documents
DROP POLICY IF EXISTS "Users can view license documents" ON export_license_documents;
CREATE POLICY "Users can view license documents"
  ON export_license_documents
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create license documents" ON export_license_documents;
CREATE POLICY "Users can create license documents"
  ON export_license_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update license documents" ON export_license_documents;
CREATE POLICY "Users can update license documents"
  ON export_license_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete license documents" ON export_license_documents;
CREATE POLICY "Users can delete license documents"
  ON export_license_documents
  FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 8. VUE POUR RAPPORTS ET STATISTIQUES
-- =====================================================

CREATE OR REPLACE VIEW v_export_licenses_summary AS
SELECT
  el.id,
  el.license_number,
  mc.name AS mining_company_name,
  mc.code AS mining_company_code,
  el.request_date,
  el.start_date,
  el.end_date,
  el.issuing_institution,
  el.authorized_quantity_grams,
  el.used_quantity_grams,
  el.remaining_quantity_grams,
  el.average_sale_price,
  el.status,
  -- Calculs
  ROUND((el.used_quantity_grams / NULLIF(el.authorized_quantity_grams, 0) * 100), 2) AS usage_percentage,
  CASE
    WHEN el.status = 'exhausted' THEN 'Épuisée'
    WHEN el.end_date < CURRENT_DATE THEN 'Expirée'
    WHEN el.remaining_quantity_grams <= (el.authorized_quantity_grams * 0.1) THEN 'Presque épuisée'
    WHEN el.status = 'active' THEN 'Active'
    ELSE INITCAP(el.status)
  END AS status_label,
  -- Nombre d'exportations
  (SELECT COUNT(*) FROM shipping_preparations WHERE license_id = el.id) AS total_shipments,
  -- Dates
  el.created_at,
  el.updated_at
FROM export_licenses el
INNER JOIN mining_companies mc ON el.mining_company_id = mc.id
ORDER BY el.created_at DESC;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Migration du système de licences d''exportation terminée avec succès';
  RAISE NOTICE '📋 Tables créées: export_licenses, export_license_documents';
  RAISE NOTICE '🔄 Triggers créés pour mise à jour automatique des quantités';
  RAISE NOTICE '🔒 RLS activé sur toutes les tables';
  RAISE NOTICE '📊 Vue de rapport créée: v_export_licenses_summary';
END $$;
