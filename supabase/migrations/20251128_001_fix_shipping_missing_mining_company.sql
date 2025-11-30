/*
  # CORRECTION CRITIQUE: Copier mining_company_id dans Shipping
  
  ## Problème Identifié
  Le trigger `auto_create_shipping_on_ready_for_customs()` ne copie PAS
  le `mining_company_id` depuis daily_production vers shipping_preparations.
  
  Résultat: Expéditions affichées SANS compagnie minière (données incomplètes)
  
  ## Solution
  1. Corriger le trigger pour copier mining_company_id
  2. Mettre à jour les shipping_preparations existantes avec mining_company_id manquant
  3. Ajouter seal_number par défaut pour éviter les données incomplètes
  
  ## Tables Impactées
  - auto_create_shipping_on_ready_for_customs() (fonction trigger)
  - shipping_preparations (update existantes)
*/

-- =====================================================
-- 1. CORRIGER LE TRIGGER POUR COPIER mining_company_id
-- =====================================================

CREATE OR REPLACE FUNCTION auto_create_shipping_on_ready_for_customs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shipping_id uuid;
  v_expedition_lot text;
BEGIN
  -- Vérifier que le nouveau status est 'ready_for_customs'
  IF NEW.status = 'ready_for_customs' AND (OLD.status IS NULL OR OLD.status != 'ready_for_customs') THEN

    -- Générer numéro de lot d'expédition
    v_expedition_lot := 'EXP-' || TO_CHAR(NEW.production_date, 'YYYYMMDD') || '-' ||
                        SUBSTRING(NEW.id::text FROM 1 FOR 8);

    -- Créer shipping_preparations avec TOUTES les données essentielles
    INSERT INTO shipping_preparations (
      daily_production_id,
      mining_company_id,        -- ✅ AJOUTÉ: Copier mining_company_id
      expedition_lot_number,
      seal_number,              -- ✅ AJOUTÉ: Numéro de scellé par défaut
      status,
      total_net_weight_grams,
      total_gross_weight_grams,
      total_boxes,              -- ✅ AJOUTÉ: Nombre de boîtes par défaut
      notes,
      created_by
    ) VALUES (
      NEW.id,
      NEW.mining_company_id,    -- ✅ Copie depuis production
      v_expedition_lot,
      COALESCE(NEW.bar_reference, 'PENDING'), -- Utiliser la référence du lingot ou PENDING
      'waiting_for_customs_approval', -- Status initial dans shipping
      NEW.bullion_grams,        -- Poids net
      NEW.bullion_grams * 1.02, -- Poids brut estimé (+2%)
      1,                        -- 1 boîte par défaut (sera mise à jour manuellement)
      'Créé automatiquement depuis Production (ready_for_customs)',
      COALESCE(auth.uid(), NEW.created_by)
    )
    RETURNING id INTO v_shipping_id;

    -- Log dans l'historique unifié
    INSERT INTO unified_status_history (
      entity_type,
      entity_id,
      old_status,
      new_status,
      change_context,
      changed_by,
      action_description,
      notes
    ) VALUES (
      'shipping',
      v_shipping_id,
      NULL,
      'waiting_for_customs_approval',
      'system',
      COALESCE(auth.uid(), NEW.created_by),
      'Shipping créé automatiquement',
      'Production ID: ' || NEW.id || ' | Mining Company: ' || COALESCE(NEW.mining_company_id::text, 'NULL')
    );

    RAISE NOTICE 'Shipping % créé avec mining_company_id: %', v_expedition_lot, NEW.mining_company_id;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- 2. METTRE À JOUR LES SHIPPING EXISTANTES
-- =====================================================

-- Mise à jour des shipping_preparations qui n'ont pas de mining_company_id
-- en le récupérant depuis daily_production
UPDATE shipping_preparations sp
SET 
  mining_company_id = dp.mining_company_id,
  seal_number = COALESCE(sp.seal_number, dp.bar_reference, 'PENDING'),
  total_boxes = COALESCE(sp.total_boxes, 1),
  updated_at = NOW()
FROM daily_production dp
WHERE sp.daily_production_id = dp.id
  AND sp.mining_company_id IS NULL  -- Seulement celles qui n'ont pas de mining_company_id
  AND dp.mining_company_id IS NOT NULL; -- Seulement si la production en a un

-- =====================================================
-- 3. RAPPORT DES CORRECTIONS
-- =====================================================

DO $$
DECLARE
  v_updated_count int;
  v_still_missing_count int;
BEGIN
  -- Compter combien ont été corrigées
  SELECT COUNT(*) INTO v_updated_count
  FROM shipping_preparations sp
  JOIN daily_production dp ON sp.daily_production_id = dp.id
  WHERE sp.mining_company_id = dp.mining_company_id;
  
  -- Compter combien n'ont toujours pas de mining_company_id
  SELECT COUNT(*) INTO v_still_missing_count
  FROM shipping_preparations
  WHERE mining_company_id IS NULL;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'RAPPORT DE CORRECTION';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Shipping preparations corrigées: %', v_updated_count;
  RAISE NOTICE 'Shipping preparations sans mining_company_id: %', v_still_missing_count;
  
  IF v_still_missing_count > 0 THEN
    RAISE WARNING 'Il reste % shipping preparations sans mining_company_id. Vérifier daily_production correspondante.', v_still_missing_count;
  ELSE
    RAISE NOTICE 'Toutes les shipping preparations ont un mining_company_id ✓';
  END IF;
  RAISE NOTICE '==============================================';
END $$;

-- =====================================================
-- 4. COMMENTAIRES ET DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION auto_create_shipping_on_ready_for_customs() IS
'TRIGGER CRITIQUE CORRIGÉ: Crée shipping_preparations avec mining_company_id, seal_number et total_boxes.
WORKFLOW: Production Management → Shipping Preparation
DATA: Copie mining_company_id + bar_reference depuis daily_production
STATUS: ready_for_customs (production) → waiting_for_customs_approval (shipping)';

-- =====================================================
-- 5. VALIDATION DE LA STRUCTURE
-- =====================================================

DO $$
BEGIN
  -- Vérifier que mining_company_id existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations' AND column_name = 'mining_company_id'
  ) THEN
    RAISE EXCEPTION 'ERREUR: La colonne mining_company_id n existe pas dans shipping_preparations';
  END IF;
  
  -- Vérifier que seal_number existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations' AND column_name = 'seal_number'
  ) THEN
    RAISE EXCEPTION 'ERREUR: La colonne seal_number n existe pas dans shipping_preparations';
  END IF;
  
  RAISE NOTICE 'Structure validée: mining_company_id et seal_number présents ✓';
END $$;
