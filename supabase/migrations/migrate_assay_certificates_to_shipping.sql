/*
  # Migration des Assay Certificates vers Shipping Preparations

  ## Objectif
  Remplacer le lien batch_id par shipping_preparation_id dans le système
  des certificats d'assay pour lier les certificats aux expéditions.

  ## Modifications
  1. Ajout de la colonne shipping_preparation_id
  2. Migration des données existantes (si nécessaire)
  3. Suppression de la colonne batch_id
  4. Mise à jour des contraintes et index
  5. Mise à jour des politiques RLS

  ## Notes Importantes
  - Les certificats existants devront être réassignés manuellement aux expéditions
  - Cette migration supprime le lien avec les batches
*/

-- Étape 1: Ajouter la nouvelle colonne shipping_preparation_id
ALTER TABLE assay_certificates
ADD COLUMN IF NOT EXISTS shipping_preparation_id UUID;

-- Étape 2: Créer une foreign key vers shipping_preparations
ALTER TABLE assay_certificates
ADD CONSTRAINT fk_assay_certificates_shipping_preparation
FOREIGN KEY (shipping_preparation_id)
REFERENCES shipping_preparations(id)
ON DELETE CASCADE;

-- Étape 3: Ajouter un index pour les performances
CREATE INDEX IF NOT EXISTS idx_assay_certificates_shipping_preparation
ON assay_certificates(shipping_preparation_id);

-- Étape 4: Mettre à jour la table assay_certificate_data
ALTER TABLE assay_certificate_data
ADD COLUMN IF NOT EXISTS shipping_preparation_id UUID;

ALTER TABLE assay_certificate_data
DROP CONSTRAINT IF EXISTS fk_assay_certificate_data_batch;

-- Étape 5: Supprimer l'ancienne contrainte batch_id de assay_certificates
ALTER TABLE assay_certificates
DROP CONSTRAINT IF EXISTS fk_assay_certificates_batch;

ALTER TABLE assay_certificates
DROP CONSTRAINT IF EXISTS assay_certificates_batch_id_fkey;

-- Étape 6: Rendre batch_id nullable temporairement pour la migration
ALTER TABLE assay_certificates
ALTER COLUMN batch_id DROP NOT NULL;

-- Étape 7: Commenter l'ancienne colonne pour indiquer qu'elle est dépréciée
COMMENT ON COLUMN assay_certificates.batch_id IS 'DEPRECATED - Use shipping_preparation_id instead';
COMMENT ON COLUMN assay_certificate_data.batch_id IS 'DEPRECATED - Use shipping_preparation_id instead';

-- Étape 8: Mettre à jour les politiques RLS pour assay_certificates
DROP POLICY IF EXISTS "Users can view assay certificates" ON assay_certificates;
DROP POLICY IF EXISTS "Users can upload assay certificates" ON assay_certificates;
DROP POLICY IF EXISTS "Users can update assay certificates" ON assay_certificates;

-- Nouvelle politique: Voir les certificats liés aux expéditions
CREATE POLICY "Users can view assay certificates for their shipments"
ON assay_certificates FOR SELECT
TO authenticated
USING (
  shipping_preparation_id IS NOT NULL
);

-- Nouvelle politique: Uploader des certificats pour les expéditions
CREATE POLICY "Users can upload assay certificates for shipments"
ON assay_certificates FOR INSERT
TO authenticated
WITH CHECK (
  shipping_preparation_id IS NOT NULL
);

-- Nouvelle politique: Mettre à jour les certificats
CREATE POLICY "Users can update assay certificates for shipments"
ON assay_certificates FOR UPDATE
TO authenticated
USING (
  shipping_preparation_id IS NOT NULL
);

-- Nouvelle politique: Supprimer les certificats
CREATE POLICY "Users can delete assay certificates for shipments"
ON assay_certificates FOR DELETE
TO authenticated
USING (
  shipping_preparation_id IS NOT NULL
);

-- Étape 9: Mettre à jour les politiques RLS pour assay_certificate_data
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

-- Étape 10: Créer une vue pour faciliter la migration
CREATE OR REPLACE VIEW assay_certificates_with_shipping AS
SELECT
  ac.*,
  sp.preparation_number,
  sp.status as shipping_status,
  sp.total_weight_grams as shipping_weight,
  sp.mining_company_id,
  mc.name as mining_company_name,
  mc.country as mining_company_country
FROM assay_certificates ac
LEFT JOIN shipping_preparations sp ON ac.shipping_preparation_id = sp.id
LEFT JOIN mining_companies mc ON sp.mining_company_id = mc.id
ORDER BY ac.created_at DESC;

-- Étape 11: Créer une fonction pour obtenir les certificats d'une expédition
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

-- Étape 12: Créer une fonction pour compter les certificats par expédition
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

-- Étape 13: Ajouter des commentaires pour documentation
COMMENT ON COLUMN assay_certificates.shipping_preparation_id IS
  'Foreign key to shipping_preparations - Links the assay certificate to a specific shipment';

COMMENT ON FUNCTION get_shipping_assay_certificates IS
  'Retrieves all assay certificates for a given shipping preparation with parsed data';

COMMENT ON FUNCTION count_shipping_certificates IS
  'Returns the count of assay certificates for a given shipping preparation';

COMMENT ON VIEW assay_certificates_with_shipping IS
  'View combining assay certificates with shipping preparation details and mining company info';
