-- =====================================================
-- DIAGNOSTIC: Vérifier les données d'une expédition
-- =====================================================
-- Pour l'expédition: 43bfabcf-c1ab-4f02-ba2f-37aa15278adf
-- =====================================================

-- 1. Vérifier que les colonnes existent
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
  AND column_name IN ('refinery_id', 'freight_company_id', 'export_license_id', 'shipped_to_company', 'shipped_to_address')
ORDER BY column_name;

-- 2. Vérifier les données de l'expédition spécifique
SELECT 
  id,
  expedition_lot_number,
  mining_company_id,
  refinery_id,
  freight_company_id,
  export_license_id,
  shipped_to_company,
  shipped_to_address,
  created_at
FROM shipping_preparations
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';

-- 3. Vérifier toutes les expéditions (aperçu)
SELECT 
  id,
  expedition_lot_number,
  refinery_id,
  freight_company_id,
  export_license_id,
  shipped_to_company,
  shipped_to_address
FROM shipping_preparations
ORDER BY created_at DESC
LIMIT 5;

-- 4. Vérifier si les données peuvent être récupérées depuis shipped_to_company/address
SELECT 
  id,
  expedition_lot_number,
  shipped_to_company AS old_freight_uuid,
  shipped_to_address AS old_refinery_uuid,
  -- Vérifier si ce sont des UUIDs valides
  CASE 
    WHEN shipped_to_company ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN 'VALID UUID'
    ELSE 'NOT UUID'
  END AS freight_format,
  CASE 
    WHEN shipped_to_address ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN 'VALID UUID'
    ELSE 'NOT UUID'
  END AS refinery_format
FROM shipping_preparations
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';

-- 5. Si ce sont des UUIDs, vérifier s'ils existent dans les tables référencées
DO $$
DECLARE
  v_freight_id UUID;
  v_refinery_id UUID;
  v_freight_name TEXT;
  v_refinery_name TEXT;
BEGIN
  -- Récupérer les valeurs
  SELECT shipped_to_company::uuid, shipped_to_address::uuid
  INTO v_freight_id, v_refinery_id
  FROM shipping_preparations
  WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf'
    AND shipped_to_company ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND shipped_to_address ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  
  IF v_freight_id IS NOT NULL THEN
    SELECT name INTO v_freight_name FROM freight_companies WHERE id = v_freight_id;
    RAISE NOTICE 'Compagnie de Fret trouvée: % (UUID: %)', v_freight_name, v_freight_id;
  ELSE
    RAISE NOTICE 'Aucune compagnie de fret trouvée ou format invalide';
  END IF;
  
  IF v_refinery_id IS NOT NULL THEN
    SELECT name INTO v_refinery_name FROM refinery_plants WHERE id = v_refinery_id;
    RAISE NOTICE 'Raffinerie trouvée: % (UUID: %)', v_refinery_name, v_refinery_id;
  ELSE
    RAISE NOTICE 'Aucune raffinerie trouvée ou format invalide';
  END IF;
END $$;
