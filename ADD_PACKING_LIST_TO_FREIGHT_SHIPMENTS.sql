/*
  # AJOUT: Packing List dans Freight Shipments

  PROBLEME IDENTIFIE:
  - Le Packing List est généré au niveau shipping_preparations
  - Mais il n'est PAS disponible dans freight_shipments
  - Le Packing List doit être visible durant TOUT le cycle jusqu'au paiement

  SOLUTION:
  - Ajouter la colonne packing_list_pdf_path à freight_shipments
  - Référencer ou copier le Packing List depuis shipping_preparations

  EXECUTION: Copier-coller ce script dans le SQL Editor de Supabase
*/

-- 1. Ajouter la colonne packing_list_pdf_path si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'packing_list_pdf_path'
  ) THEN
    ALTER TABLE freight_shipments
    ADD COLUMN packing_list_pdf_path TEXT;

    COMMENT ON COLUMN freight_shipments.packing_list_pdf_path IS
      'URL publique du Packing List PDF (disponible tout au long du cycle)';
  END IF;
END $$;

-- 2. Ajouter une colonne pour lier à shipping_preparation (optionnel mais utile)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'shipping_preparation_id'
  ) THEN
    ALTER TABLE freight_shipments
    ADD COLUMN shipping_preparation_id UUID REFERENCES shipping_preparations(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_freight_shipments_preparation
      ON freight_shipments(shipping_preparation_id);

    COMMENT ON COLUMN freight_shipments.shipping_preparation_id IS
      'Référence optionnelle à la préparation d''expédition d''origine';
  END IF;
END $$;

-- 3. Ajouter expedition_number si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'expedition_number'
  ) THEN
    ALTER TABLE freight_shipments
    ADD COLUMN expedition_number TEXT;

    COMMENT ON COLUMN freight_shipments.expedition_number IS
      'Numéro d''expédition (ex: HUM-SMK-001/2025)';
  END IF;
END $$;

-- 4. Copier les Packing Lists existants depuis shipping_preparations vers freight_shipments
-- Cette mise à jour se fera via le code application lors de la création des freight_shipments

-- 5. Vérification
SELECT
  'Migration complete' as status,
  'packing_list_pdf_path column added' as message;

SELECT
  'Columns check' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'freight_shipments'
  AND column_name IN ('packing_list_pdf_path', 'shipping_preparation_id', 'expedition_number', 'bullion_summary_pdf_path', 'customs_invoice_pdf_path')
ORDER BY column_name;

-- 6. Mettre à jour les freight_shipments existants avec les Packing Lists
-- NOTE: Cette requête est sûre car elle ne fait que copier les URLs, pas les supprimer
UPDATE freight_shipments fs
SET packing_list_pdf_path = sp.packing_list_url
FROM shipping_preparations sp
WHERE fs.expedition_number IS NOT NULL
  AND sp.expedition_number IS NOT NULL
  AND fs.expedition_number = sp.expedition_number
  AND sp.packing_list_url IS NOT NULL
  AND fs.packing_list_pdf_path IS NULL;

-- Vérification finale
SELECT
  'Update complete' as status,
  COUNT(*) as freight_shipments_with_packing_list
FROM freight_shipments
WHERE packing_list_pdf_path IS NOT NULL;
