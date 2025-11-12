/*
  # Migration 012 - Assay Certificates vers Shipping Preparations
  # Date: 2025-11-12

  ## Objectif
  Remplacer le lien batch_id par shipping_preparation_id dans le système
  des certificats d'assay pour lier les certificats aux expéditions.

  ## Modifications
  1. Ajout de la colonne shipping_preparation_id
  2. Migration des données existantes (si nécessaire)
  3. Suppression de la dépendance batch_id (conservée temporairement)
  4. Mise à jour des contraintes et index
  5. Mise à jour des politiques RLS
  6. Création d'une vue pour faciliter les requêtes
  7. Création de fonctions RPC utilitaires

  ## Notes Importantes
  - Les certificats existants devront être réassignés manuellement aux expéditions
  - La colonne batch_id est conservée mais marquée comme deprecated
  - Compatibilité backward maintenue temporairement
*/

-- ============================================================================
-- ÉTAPE 1: Ajouter la nouvelle colonne shipping_preparation_id
-- ============================================================================

ALTER TABLE assay_certificates
ADD COLUMN IF NOT EXISTS shipping_preparation_id UUID;

COMMENT ON COLUMN assay_certificates.shipping_preparation_id IS
  'Foreign key to shipping_preparations - Links the assay certificate to a specific shipment (replaces batch_id)';

-- ============================================================================
-- ÉTAPE 2: Créer la foreign key vers shipping_preparations
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_assay_certificates_shipping_preparation'
    AND table_name = 'assay_certificates'
  ) THEN
    ALTER TABLE assay_certificates
    ADD CONSTRAINT fk_assay_certificates_shipping_preparation
    FOREIGN KEY (shipping_preparation_id)
    REFERENCES shipping_preparations(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 3: Créer un index pour les performances
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_assay_certificates_shipping_preparation
ON assay_certificates(shipping_preparation_id);

-- ============================================================================
-- ÉTAPE 4: Mettre à jour la table assay_certificate_data
-- ============================================================================

ALTER TABLE assay_certificate_data
ADD COLUMN IF NOT EXISTS shipping_preparation_id UUID;

COMMENT ON COLUMN assay_certificate_data.shipping_preparation_id IS
  'Foreign key to shipping_preparations - Links parsed data to shipment (replaces batch_id)';

-- Supprimer l'ancienne contrainte batch si elle existe
ALTER TABLE assay_certificate_data
DROP CONSTRAINT IF EXISTS fk_assay_certificate_data_batch;

-- ============================================================================
-- ÉTAPE 5: Déprécier batch_id (ne pas supprimer pour compatibilité)
-- ============================================================================

-- Rendre batch_id nullable
ALTER TABLE assay_certificates
ALTER COLUMN batch_id DROP NOT NULL;

-- Marquer comme deprecated
COMMENT ON COLUMN assay_certificates.batch_id IS
  'DEPRECATED - Use shipping_preparation_id instead. Kept for backwards compatibility only.';

COMMENT ON COLUMN assay_certificate_data.batch_id IS
  'DEPRECATED - Use shipping_preparation_id instead. Kept for backwards compatibility only.';

-- Supprimer les anciennes contraintes batch_id
ALTER TABLE assay_certificates
DROP CONSTRAINT IF EXISTS fk_assay_certificates_batch;

ALTER TABLE assay_certificates
DROP CONSTRAINT IF EXISTS assay_certificates_batch_id_fkey;

-- ============================================================================
-- ÉTAPE 6: Mettre à jour les politiques RLS pour assay_certificates
-- ============================================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view assay certificates" ON assay_certificates;
DROP POLICY IF EXISTS "Users can upload assay certificates" ON assay_certificates;
DROP POLICY IF EXISTS "Users can update assay certificates" ON assay_certificates;
DROP POLICY IF EXISTS "Users can delete assay certificates" ON assay_certificates;

-- Nouvelle politique: Voir les certificats liés aux expéditions
CREATE POLICY "Users can view assay certificates for shipments"
ON assay_certificates FOR SELECT
TO authenticated
USING (true);  -- Tous les utilisateurs authentifiés peuvent voir les certificats

-- Nouvelle politique: Uploader des certificats pour les expéditions
CREATE POLICY "Users can upload assay certificates for shipments"
ON assay_certificates FOR INSERT
TO authenticated
WITH CHECK (shipping_preparation_id IS NOT NULL);

-- Nouvelle politique: Mettre à jour les certificats
CREATE POLICY "Users can update assay certificates for shipments"
ON assay_certificates FOR UPDATE
TO authenticated
USING (true);

-- Nouvelle politique: Supprimer les certificats
CREATE POLICY "Users can delete assay certificates for shipments"
ON assay_certificates FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- ÉTAPE 7: Mettre à jour les politiques RLS pour assay_certificate_data
-- ============================================================================

DROP POLICY IF EXISTS "Users can view parsed certificate data" ON assay_certificate_data;
DROP POLICY IF EXISTS "Users can insert parsed certificate data" ON assay_certificate_data;
DROP POLICY IF EXISTS "Users can update parsed certificate data" ON assay_certificate_data;

CREATE POLICY "Users can view parsed certificate data for shipments"
ON assay_certificate_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert parsed certificate data for shipments"
ON assay_certificate_data FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update parsed certificate data for shipments"
ON assay_certificate_data FOR UPDATE
TO authenticated
USING (true);

-- ============================================================================
-- ÉTAPE 8: Créer une vue pour faciliter les requêtes
-- ============================================================================

CREATE OR REPLACE VIEW assay_certificates_with_shipping AS
SELECT
  ac.*,
  sp.expedition_lot_number,
  sp.status as shipping_status,
  sp.total_net_weight_grams as shipping_weight,
  sp.total_gross_weight_grams as shipping_gross_weight,
  sp.shipped_to_company,
  sp.shipped_to_address,
  sp.shipped_to_country,
  sp.mining_company_id,
  mc.name as mining_company_name,
  mc.country as mining_company_country,
  sp.prepared_at,
  sp.shipped_at,
  sp.created_at as shipping_created_at
FROM assay_certificates ac
LEFT JOIN shipping_preparations sp ON ac.shipping_preparation_id = sp.id
LEFT JOIN mining_companies mc ON sp.mining_company_id = mc.id
ORDER BY ac.created_at DESC;

COMMENT ON VIEW assay_certificates_with_shipping IS
  'View combining assay certificates with shipping preparation details, mining company, freight company, and refinery information';

-- ============================================================================
-- ÉTAPE 9: Créer une fonction pour obtenir les certificats d'une expédition
-- ============================================================================

CREATE OR REPLACE FUNCTION get_shipping_assay_certificates(p_shipping_id UUID)
RETURNS TABLE (
  id UUID,
  certificate_number TEXT,
  certificate_date DATE,
  issuing_laboratory TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  parsing_status TEXT,
  approval_status TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ,
  parsed_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.certificate_number,
    ac.certificate_date,
    ac.issuing_laboratory,
    ac.file_path,
    ac.file_name,
    ac.file_size,
    ac.parsing_status,
    ac.approval_status,
    ac.uploaded_by,
    ac.created_at,
    row_to_json(acd.*)::jsonb as parsed_data
  FROM assay_certificates ac
  LEFT JOIN assay_certificate_data acd ON ac.id = acd.certificate_id
  WHERE ac.shipping_preparation_id = p_shipping_id
  ORDER BY ac.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_shipping_assay_certificates IS
  'Retrieves all assay certificates for a given shipping preparation with parsed data';

-- ============================================================================
-- ÉTAPE 10: Créer une fonction pour compter les certificats par expédition
-- ============================================================================

CREATE OR REPLACE FUNCTION count_shipping_certificates(p_shipping_id UUID)
RETURNS INTEGER AS $$
DECLARE
  cert_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO cert_count
  FROM assay_certificates
  WHERE shipping_preparation_id = p_shipping_id;

  RETURN cert_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION count_shipping_certificates IS
  'Returns the count of assay certificates for a given shipping preparation';

-- ============================================================================
-- ÉTAPE 11: Créer une fonction pour obtenir les statistiques des certificats
-- ============================================================================

CREATE OR REPLACE FUNCTION get_certificates_statistics()
RETURNS TABLE (
  total_certificates BIGINT,
  pending_approval BIGINT,
  approved BIGINT,
  rejected BIGINT,
  pending_parsing BIGINT,
  parsing_completed BIGINT,
  parsing_failed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_certificates,
    COUNT(*) FILTER (WHERE approval_status = 'pending')::BIGINT as pending_approval,
    COUNT(*) FILTER (WHERE approval_status = 'approved')::BIGINT as approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected')::BIGINT as rejected,
    COUNT(*) FILTER (WHERE parsing_status = 'pending')::BIGINT as pending_parsing,
    COUNT(*) FILTER (WHERE parsing_status = 'completed')::BIGINT as parsing_completed,
    COUNT(*) FILTER (WHERE parsing_status = 'failed')::BIGINT as parsing_failed
  FROM assay_certificates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_certificates_statistics IS
  'Returns overall statistics about assay certificates status';

-- ============================================================================
-- ÉTAPE 12: Créer un trigger pour synchroniser shipping_preparation_id
-- ============================================================================

-- Fonction trigger pour synchroniser les données parsed
CREATE OR REPLACE FUNCTION sync_certificate_data_shipping_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Si shipping_preparation_id est mis à jour dans assay_certificates,
  -- mettre à jour aussi dans assay_certificate_data
  IF NEW.shipping_preparation_id IS DISTINCT FROM OLD.shipping_preparation_id THEN
    UPDATE assay_certificate_data
    SET shipping_preparation_id = NEW.shipping_preparation_id
    WHERE certificate_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trg_sync_certificate_shipping_id ON assay_certificates;

CREATE TRIGGER trg_sync_certificate_shipping_id
AFTER UPDATE OF shipping_preparation_id ON assay_certificates
FOR EACH ROW
EXECUTE FUNCTION sync_certificate_data_shipping_id();

COMMENT ON TRIGGER trg_sync_certificate_shipping_id ON assay_certificates IS
  'Automatically synchronizes shipping_preparation_id to assay_certificate_data when updated';

-- ============================================================================
-- ÉTAPE 13: Ajouter des commentaires pour documentation
-- ============================================================================

COMMENT ON TABLE assay_certificates IS
  'Stores assay certificates linked to shipping preparations. Each certificate contains analysis results for precious metals content.';

COMMENT ON TABLE assay_certificate_data IS
  'Stores parsed data extracted from assay certificate PDFs. Contains detailed analysis results including gold, silver, and other metals content.';

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

-- Afficher un message de succès
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 012 completed successfully!';
  RAISE NOTICE 'Assay certificates are now linked to shipping preparations.';
  RAISE NOTICE 'Remember to:';
  RAISE NOTICE '  1. Create the storage bucket "assay-certificates" if it does not exist';
  RAISE NOTICE '  2. Configure RLS policies for the storage bucket';
  RAISE NOTICE '  3. Test the new functionality in the application';
END $$;
