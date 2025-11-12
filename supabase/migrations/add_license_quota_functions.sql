/*
  # Fonctions de Gestion des Quotas de Licence d'Exportation

  ## Vue d'ensemble
  Ce fichier crée les fonctions PostgreSQL nécessaires pour gérer les quotas
  des licences d'exportation lors de la création d'expéditions.

  ## Fonctions Créées
  1. `check_license_availability` : Vérifie si une licence a assez de quota disponible
  2. `reserve_license_quota` : Réserve une quantité sur une licence pour une expédition
  3. `release_license_quota` : Libère une réservation (en cas d'annulation)
  4. `update_license_status` : Met à jour automatiquement le statut d'une licence

  ## Sécurité
  - Toutes les fonctions sont SECURITY DEFINER pour garantir l'exécution avec les bonnes permissions
  - Vérifications d'intégrité pour éviter les sur-réservations
  - Logs d'erreurs détaillés

  ## Utilisation
  Ces fonctions sont appelées automatiquement lors de :
  - La création d'une expédition (reserve_license_quota)
  - L'annulation d'une expédition (release_license_quota)
  - La vérification de disponibilité (check_license_availability)
*/

-- =====================================================
-- 1. FONCTION: check_license_availability
-- =====================================================
-- Vérifie si une licence a suffisamment de quota disponible

CREATE OR REPLACE FUNCTION check_license_availability(
  p_license_id UUID,
  p_required_quantity NUMERIC
)
RETURNS TABLE (
  is_available BOOLEAN,
  remaining_quantity NUMERIC,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license RECORD;
  v_is_active BOOLEAN;
BEGIN
  -- Récupérer la licence
  SELECT 
    id,
    status,
    remaining_quantity_grams,
    end_date,
    license_number
  INTO v_license
  FROM export_licenses
  WHERE id = p_license_id;

  -- Vérifier si la licence existe
  IF v_license.id IS NULL THEN
    RETURN QUERY SELECT 
      FALSE, 
      0::NUMERIC, 
      'Licence introuvable'::TEXT;
    RETURN;
  END IF;

  -- Vérifier si la licence est active
  IF v_license.status != 'active' THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_license.remaining_quantity_grams, 
      format('Licence %s : statut "%s" (doit être "active")', v_license.license_number, v_license.status)::TEXT;
    RETURN;
  END IF;

  -- Vérifier si la licence n'est pas expirée
  IF v_license.end_date < CURRENT_DATE THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_license.remaining_quantity_grams, 
      format('Licence %s expirée le %s', v_license.license_number, v_license.end_date::TEXT)::TEXT;
    RETURN;
  END IF;

  -- Vérifier la quantité disponible
  IF v_license.remaining_quantity_grams < p_required_quantity THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_license.remaining_quantity_grams, 
      format('Quantité insuffisante. Disponible: %.2fg, Requis: %.2fg', v_license.remaining_quantity_grams, p_required_quantity)::TEXT;
    RETURN;
  END IF;

  -- Tout est OK
  RETURN QUERY SELECT 
    TRUE, 
    v_license.remaining_quantity_grams, 
    format('✅ Quantité disponible: %.2fg', v_license.remaining_quantity_grams)::TEXT;
END;
$$;

-- =====================================================
-- 2. FONCTION: reserve_license_quota
-- =====================================================
-- Réserve une quantité sur une licence pour une expédition

CREATE OR REPLACE FUNCTION reserve_license_quota(
  p_license_id UUID,
  p_shipping_id UUID,
  p_quantity NUMERIC,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining NUMERIC;
  v_license_number TEXT;
BEGIN
  -- Vérifier la disponibilité
  SELECT remaining_quantity, message
  INTO v_remaining
  FROM check_license_availability(p_license_id, p_quantity);

  -- Obtenir le numéro de licence pour les logs
  SELECT license_number INTO v_license_number
  FROM export_licenses
  WHERE id = p_license_id;

  -- Si pas disponible, lever une erreur
  IF v_remaining < p_quantity THEN
    RAISE EXCEPTION 'Quota insuffisant sur la licence %: disponible %.2fg, requis %.2fg', 
      v_license_number, v_remaining, p_quantity;
  END IF;

  -- Mettre à jour la licence
  UPDATE export_licenses
  SET 
    used_quantity_grams = used_quantity_grams + p_quantity,
    remaining_quantity_grams = remaining_quantity_grams - p_quantity,
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE id = p_license_id;

  -- Vérifier si la licence est épuisée
  UPDATE export_licenses
  SET status = 'exhausted'
  WHERE id = p_license_id
    AND remaining_quantity_grams <= 0
    AND status = 'active';

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la réservation du quota: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- =====================================================
-- 3. FONCTION: release_license_quota
-- =====================================================
-- Libère une réservation (en cas d'annulation d'expédition)

CREATE OR REPLACE FUNCTION release_license_quota(
  p_license_id UUID,
  p_quantity NUMERIC,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remettre la quantité dans le quota disponible
  UPDATE export_licenses
  SET 
    used_quantity_grams = GREATEST(0, used_quantity_grams - p_quantity),
    remaining_quantity_grams = LEAST(
      authorized_quantity_grams,
      remaining_quantity_grams + p_quantity
    ),
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE id = p_license_id;

  -- Si la licence était exhausted et qu'on libère du quota, la remettre en active
  UPDATE export_licenses
  SET status = 'active'
  WHERE id = p_license_id
    AND status = 'exhausted'
    AND remaining_quantity_grams > 0
    AND end_date >= CURRENT_DATE;

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la libération du quota: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- =====================================================
-- 4. FONCTION: update_license_status
-- =====================================================
-- Met à jour automatiquement le statut d'une licence

CREATE OR REPLACE FUNCTION update_license_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si la quantité restante est épuisée
  IF NEW.remaining_quantity_grams <= 0 AND NEW.status = 'active' THEN
    NEW.status := 'exhausted';
  END IF;

  -- Si la date d'expiration est dépassée
  IF NEW.end_date < CURRENT_DATE AND NEW.status IN ('active', 'pending') THEN
    NEW.status := 'expired';
  END IF;

  -- Si on libère du quota et que la licence était exhausted
  IF NEW.remaining_quantity_grams > 0 
     AND OLD.remaining_quantity_grams <= 0 
     AND NEW.status = 'exhausted'
     AND NEW.end_date >= CURRENT_DATE THEN
    NEW.status := 'active';
  END IF;

  RETURN NEW;
END;
$$;

-- Créer le trigger sur export_licenses
DROP TRIGGER IF EXISTS trigger_update_license_status ON export_licenses;
CREATE TRIGGER trigger_update_license_status
  BEFORE UPDATE ON export_licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_license_status();

-- =====================================================
-- 5. COMMENTAIRES ET DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION check_license_availability IS 
'Vérifie si une licence d''exportation a suffisamment de quota disponible pour une quantité demandée';

COMMENT ON FUNCTION reserve_license_quota IS 
'Réserve une quantité de quota sur une licence d''exportation pour une expédition';

COMMENT ON FUNCTION release_license_quota IS 
'Libère une quantité de quota précédemment réservée (en cas d''annulation d''expédition)';

COMMENT ON FUNCTION update_license_status IS 
'Trigger function qui met à jour automatiquement le statut d''une licence selon sa date et quota';

-- =====================================================
-- 6. PERMISSIONS
-- =====================================================

-- Accorder l'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION check_license_availability TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_license_quota TO authenticated;
GRANT EXECUTE ON FUNCTION release_license_quota TO authenticated;
