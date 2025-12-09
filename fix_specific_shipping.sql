-- =====================================================
-- CORRECTION MANUELLE: Expédition 43bfabcf-c1ab-4f02-ba2f-37aa15278adf
-- =====================================================

-- Étape 1: Vérifier et migrer cette expédition spécifique
DO $$
DECLARE
  v_shipping_id UUID := '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
  v_old_freight TEXT;
  v_old_refinery TEXT;
  v_freight_uuid UUID;
  v_refinery_uuid UUID;
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Récupérer les anciennes valeurs
  SELECT shipped_to_company, shipped_to_address
  INTO v_old_freight, v_old_refinery
  FROM shipping_preparations
  WHERE id = v_shipping_id;
  
  RAISE NOTICE '=== DIAGNOSTIC EXPÉDITION ===';
  RAISE NOTICE 'ID: %', v_shipping_id;
  RAISE NOTICE 'shipped_to_company (ancien): %', v_old_freight;
  RAISE NOTICE 'shipped_to_address (ancien): %', v_old_refinery;
  
  -- Tenter de convertir et migrer freight_company
  IF v_old_freight IS NOT NULL AND v_old_freight ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_freight_uuid := v_old_freight::uuid;
    
    IF EXISTS (SELECT 1 FROM freight_companies WHERE id = v_freight_uuid) THEN
      UPDATE shipping_preparations
      SET freight_company_id = v_freight_uuid
      WHERE id = v_shipping_id;
      
      RAISE NOTICE '✅ Compagnie de fret migrée: %', v_freight_uuid;
      v_updated := TRUE;
    ELSE
      RAISE NOTICE '⚠️  UUID de compagnie de fret invalide (n existe pas)';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  shipped_to_company n est pas un UUID valide';
  END IF;
  
  -- Tenter de convertir et migrer refinery
  IF v_old_refinery IS NOT NULL AND v_old_refinery ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_refinery_uuid := v_old_refinery::uuid;
    
    IF EXISTS (SELECT 1 FROM refinery_plants WHERE id = v_refinery_uuid) THEN
      UPDATE shipping_preparations
      SET refinery_id = v_refinery_uuid
      WHERE id = v_shipping_id;
      
      RAISE NOTICE '✅ Raffinerie migrée: %', v_refinery_uuid;
      v_updated := TRUE;
    ELSE
      RAISE NOTICE '⚠️  UUID de raffinerie invalide (n existe pas)';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  shipped_to_address n est pas un UUID valide';
  END IF;
  
  -- Afficher le résultat final
  IF v_updated THEN
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ EXPÉDITION MISE À JOUR';
    RAISE NOTICE '====================================';
  ELSE
    RAISE NOTICE '====================================';
    RAISE NOTICE '❌ AUCUNE MISE À JOUR EFFECTUÉE';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Les valeurs shipped_to_company et shipped_to_address';
    RAISE NOTICE 'ne contiennent pas d UUIDs valides.';
    RAISE NOTICE 'Vous devez modifier manuellement cette expédition.';
  END IF;
  
  -- Afficher l'état final
  DECLARE
    v_final_freight UUID;
    v_final_refinery UUID;
    v_freight_name TEXT;
    v_refinery_name TEXT;
  BEGIN
    SELECT freight_company_id, refinery_id
    INTO v_final_freight, v_final_refinery
    FROM shipping_preparations
    WHERE id = v_shipping_id;
    
    IF v_final_freight IS NOT NULL THEN
      SELECT name INTO v_freight_name FROM freight_companies WHERE id = v_final_freight;
      RAISE NOTICE 'Compagnie de Fret: %', v_freight_name;
    ELSE
      RAISE NOTICE 'Compagnie de Fret: NON DÉFINIE';
    END IF;
    
    IF v_final_refinery IS NOT NULL THEN
      SELECT name INTO v_refinery_name FROM refinery_plants WHERE id = v_final_refinery;
      RAISE NOTICE 'Raffinerie: %', v_refinery_name;
    ELSE
      RAISE NOTICE 'Raffinerie: NON DÉFINIE';
    END IF;
  END;
END $$;

-- Étape 2: Vérifier toutes les expéditions sans refinery_id ou freight_company_id
SELECT 
  COUNT(*) as total_sans_refinery
FROM shipping_preparations
WHERE refinery_id IS NULL;

SELECT 
  COUNT(*) as total_sans_freight
FROM shipping_preparations
WHERE freight_company_id IS NULL;

-- Étape 3: Lister les expéditions qui ont besoin de correction manuelle
SELECT 
  id,
  expedition_lot_number,
  shipped_to_company,
  shipped_to_address,
  created_at
FROM shipping_preparations
WHERE (refinery_id IS NULL OR freight_company_id IS NULL)
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
