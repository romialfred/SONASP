/*
  # Correction de la Fonction update_license_used_quantity

  ## Problème Identifié
  La fonction `update_license_used_quantity()` dans la migration `add_export_licenses_system.sql`
  fait référence à des statuts obsolètes qui n'existent plus dans l'ENUM `shipping_preparation_status`:
  - ❌ 'prepared' (n'existe plus)
  - ❌ 'shipped' (n'existe plus)

  ## Nouveaux Statuts (ENUM shipping_preparation_status)
  - ✅ 'waiting_for_customs_approval' - En attente d'approbation douanière
  - ✅ 'approved_by_customs' - Approuvé par la douane
  - ✅ 'ready_for_expedition' - Prêt pour l'expédition

  ## Solution
  Remplacer la fonction pour utiliser les bons statuts du workflow actuel.

  ## Logique de Calcul
  On compte les expéditions qui ont été approuvées par la douane ou qui sont prêtes pour l'expédition,
  car ce sont celles qui consomment effectivement le quota de la licence.

  ## IMPORTANT
  Cette migration doit être appliquée APRÈS la migration 20251114_011_fix_shipping_enum_definitif.sql
*/

-- =====================================================
-- RECRÉER LA FONCTION AVEC LES BONS STATUTS
-- =====================================================

CREATE OR REPLACE FUNCTION update_license_used_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_total_weight DECIMAL(15, 2);
BEGIN
  -- Calculer le total des poids nets de toutes les préparations pour cette licence
  -- CORRECTION: Utiliser les nouveaux statuts de shipping_preparation_status
  SELECT COALESCE(SUM(total_net_weight_grams), 0)
  INTO v_total_weight
  FROM shipping_preparations
  WHERE license_id = COALESCE(NEW.license_id, OLD.license_id)
    AND status IN (
      'approved_by_customs',      -- Approuvé par la douane
      'ready_for_expedition'       -- Prêt pour expédition
    );

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

-- =====================================================
-- COMMENTAIRES ET DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION update_license_used_quantity IS
'Trigger function qui calcule et met à jour la quantité utilisée sur une licence d''exportation.
Compte uniquement les expéditions avec statuts: approved_by_customs, ready_for_expedition.
IMPORTANT: Utilise l''ENUM shipping_preparation_status (pas les anciens statuts prepared/shipped).';

-- =====================================================
-- VÉRIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'FONCTION update_license_used_quantity CORRIGÉE';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ La fonction utilise maintenant les bons statuts:';
  RAISE NOTICE '   - approved_by_customs';
  RAISE NOTICE '   - ready_for_expedition';
  RAISE NOTICE '';
  RAISE NOTICE '❌ Anciens statuts SUPPRIMÉS:';
  RAISE NOTICE '   - prepared (obsolète)';
  RAISE NOTICE '   - shipped (obsolète)';
  RAISE NOTICE '';
  RAISE NOTICE 'Les triggers suivants utilisent cette fonction:';
  RAISE NOTICE '   - trg_update_license_quantity_on_insert';
  RAISE NOTICE '   - trg_update_license_quantity_on_update';
  RAISE NOTICE '   - trg_update_license_quantity_on_delete';
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'MIGRATION TERMINÉE';
  RAISE NOTICE '============================================';
END $$;
