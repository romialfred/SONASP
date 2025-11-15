/*
  # Fix Shipping Delete Error - Release License Quota

  1. Problème
    - Erreur lors de la suppression d'une shipping_preparation
    - Le trigger appelle release_license_quota avec 4 paramètres
    - La fonction n'accepte que 3 paramètres

  2. Solution
    - Créer ou remplacer le trigger pour DELETE
    - Adapter l'appel de fonction aux bons paramètres

  3. Sécurité
    - Le trigger libère automatiquement le quota de licence
    - Lors de la suppression d'une expédition
*/

-- =====================================================
-- ÉTAPE 1: Créer la fonction trigger
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_release_shipping_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license_id UUID;
  v_total_weight NUMERIC;
BEGIN
  -- Récupérer l'ID de la licence et le poids total de l'expédition supprimée
  v_license_id := OLD.export_license_id;
  v_total_weight := OLD.total_weight_grams;

  -- Si l'expédition avait une licence associée, libérer le quota
  IF v_license_id IS NOT NULL AND v_total_weight IS NOT NULL AND v_total_weight > 0 THEN

    RAISE NOTICE 'Libération du quota de licence pour shipping %: % grammes',
      OLD.expedition_lot_number,
      v_total_weight;

    -- Appeler la fonction avec les bons paramètres (3 paramètres)
    -- release_license_quota(p_license_id, p_quantity, p_user_id)
    PERFORM release_license_quota(
      v_license_id,           -- UUID: license_id
      v_total_weight,         -- NUMERIC: quantity to release
      auth.uid()              -- UUID: user_id (optional)
    );

    RAISE NOTICE '✅ Quota libéré avec succès';

  ELSE
    RAISE NOTICE 'Aucun quota à libérer pour shipping %', OLD.expedition_lot_number;
  END IF;

  RETURN OLD;

EXCEPTION
  WHEN OTHERS THEN
    -- Log l'erreur mais ne pas bloquer la suppression
    RAISE WARNING 'Erreur lors de la libération du quota: % - %', SQLERRM, SQLSTATE;
    -- Retourner OLD pour permettre la suppression quand même
    RETURN OLD;
END;
$$;

-- =====================================================
-- ÉTAPE 2: Créer le trigger sur DELETE
-- =====================================================

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trigger_release_shipping_quota ON shipping_preparations;

-- Créer le nouveau trigger
CREATE TRIGGER trigger_release_shipping_quota
  BEFORE DELETE ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_release_shipping_quota();

-- =====================================================
-- ÉTAPE 3: Permissions
-- =====================================================

-- S'assurer que la fonction peut être exécutée
GRANT EXECUTE ON FUNCTION trigger_release_shipping_quota() TO authenticated;

-- =====================================================
-- ÉTAPE 4: Commentaires
-- =====================================================

COMMENT ON FUNCTION trigger_release_shipping_quota IS
'Trigger function qui libère automatiquement le quota de licence lors de la suppression d''une expédition';

COMMENT ON TRIGGER trigger_release_shipping_quota ON shipping_preparations IS
'Libère le quota de licence automatiquement quand une expédition est supprimée';
