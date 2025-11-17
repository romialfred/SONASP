-- =====================================================
-- CORRECTION CRITIQUE: TRIGGER MANQUANT
-- Production → Shipping Automatique
-- =====================================================
--
-- À EXÉCUTER DANS: Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
--
-- =====================================================

-- 1. FONCTION: Créer Shipping Automatiquement
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
      'waiting_for_customs_approval', -- Status initial dans shipping (CORRECT)
      NEW.bullion_grams, -- Poids net
      NEW.bullion_grams * 1.02, -- Poids brut estimé (+2%)
      'Créé automatiquement depuis Production (ready_for_customs)',
      auth.uid()
    )
    RETURNING id INTO v_shipping_id;

    -- Log dans l'historique unifié (si la table existe)
    BEGIN
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
        auth.uid(),
        'Shipping créé automatiquement',
        'Production ID: ' || NEW.id || ' passée à ready_for_customs'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Table history n'existe pas, ignorer
      NULL;
    END;

    RAISE NOTICE 'Shipping % créé automatiquement pour production %', v_expedition_lot, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. TRIGGER: Auto-création Shipping
DROP TRIGGER IF EXISTS trigger_auto_create_shipping_on_ready_for_customs ON daily_production;

CREATE TRIGGER trigger_auto_create_shipping_on_ready_for_customs
  AFTER UPDATE OF status ON daily_production
  FOR EACH ROW
  WHEN (NEW.status = 'ready_for_customs')
  EXECUTE FUNCTION auto_create_shipping_on_ready_for_customs();

-- 3. PERMISSIONS
GRANT EXECUTE ON FUNCTION auto_create_shipping_on_ready_for_customs() TO authenticated;

-- 4. CONFIRMATION
SELECT 'TRIGGER INSTALLÉ AVEC SUCCÈS !' as status;
SELECT 'Workflow Production → Shipping opérationnel' as message;
