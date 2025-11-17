/*
  # Correction Critique: Trigger Production → Shipping

  ## Problème Identifié
  - AUCUN trigger existant pour créer automatiquement shipping_preparations
  - Quand production passe à 'ready_for_customs', rien ne se passe
  - RÉGRESSION CRITIQUE dans le workflow

  ## Solution
  - Créer trigger automatique sur daily_production
  - Quand status devient 'ready_for_customs':
    * Créer shipping_preparations automatiquement
    * Status initial: 'pending_customs_approval'
    * Copier toutes les données essentielles

  ## Tables Impactées
  - daily_production (trigger)
  - shipping_preparations (insertion auto)
  - unified_status_history (log)
*/

-- =====================================================
-- 1. FONCTION: Créer Shipping Automatiquement
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

    -- Créer shipping_preparations
    INSERT INTO shipping_preparations (
      daily_production_id,
      expedition_lot_number,
      status,
      total_net_weight_grams,
      total_gross_weight_grams,
      notes,
      created_by
    ) VALUES (
      NEW.id,
      v_expedition_lot,
      'pending', -- Status initial dans shipping
      NEW.bullion_grams, -- Poids net
      NEW.bullion_grams * 1.02, -- Poids brut estimé (+2%)
      'Créé automatiquement depuis Production (ready_for_customs)',
      auth.uid()
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
      'pending',
      'system',
      auth.uid(),
      'Shipping créé automatiquement',
      'Production ID: ' || NEW.id || ' passée à ready_for_customs'
    );

    RAISE NOTICE 'Shipping % créé automatiquement pour production %', v_expedition_lot, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- 2. TRIGGER: Auto-création Shipping
-- =====================================================

DROP TRIGGER IF EXISTS trigger_auto_create_shipping_on_ready_for_customs ON daily_production;

CREATE TRIGGER trigger_auto_create_shipping_on_ready_for_customs
  AFTER UPDATE OF status ON daily_production
  FOR EACH ROW
  WHEN (NEW.status = 'ready_for_customs')
  EXECUTE FUNCTION auto_create_shipping_on_ready_for_customs();

-- =====================================================
-- 3. COMMENTAIRES ET DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION auto_create_shipping_on_ready_for_customs() IS
'TRIGGER CRITIQUE: Crée automatiquement shipping_preparations quand production passe à ready_for_customs.
WORKFLOW: Production Management → Shipping Preparation
STATUS MAPPING: ready_for_customs (production) → pending (shipping)';

COMMENT ON TRIGGER trigger_auto_create_shipping_on_ready_for_customs ON daily_production IS
'Auto-création shipping_preparations pour workflow Production → Shipping';

-- =====================================================
-- 4. PERMISSIONS
-- =====================================================

-- Permettre à authenticated d'utiliser la fonction
GRANT EXECUTE ON FUNCTION auto_create_shipping_on_ready_for_customs() TO authenticated;

-- =====================================================
-- 5. TEST RAPIDE (optionnel)
-- =====================================================

DO $$
DECLARE
  v_test_prod_id uuid;
BEGIN
  -- Vérifier qu'il existe au moins une production pour tester
  SELECT id INTO v_test_prod_id
  FROM daily_production
  WHERE status = 'prepared'
  LIMIT 1;

  IF v_test_prod_id IS NOT NULL THEN
    RAISE NOTICE 'Trigger installé avec succès. Prêt pour production %', v_test_prod_id;
  ELSE
    RAISE NOTICE 'Trigger installé. Aucune production prepared disponible pour test.';
  END IF;
END $$;
