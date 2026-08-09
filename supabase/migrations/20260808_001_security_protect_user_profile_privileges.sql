-- ============================================================================
-- SÉCURITÉ (audit V3) — Protection des colonnes de privilège de user_profiles
-- ============================================================================
-- Constat : la policy RLS d'auto-modification autorise un utilisateur à changer
-- son propre profil ; la colonne `role` n'étant pas protégée, il peut s'auto-
-- promouvoir `management`/`admin`. RLS ne restreint pas au niveau colonne.
--
-- Correctif : un trigger BEFORE UPDATE interdit toute modification de
-- role / site_ids / is_active SAUF :
--   - connexion service_role (edge functions d'administration), ou
--   - utilisateur réellement administrateur (is_admin_user).
--
-- Réversible : DROP TRIGGER trg_protect_user_profile_privileges ON user_profiles;
-- Non destructif. À déployer via le gate (sauvegarde + staging).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_user_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role boolean := (current_user = 'service_role');
  v_is_admin boolean := false;
BEGIN
  -- Autoriser sans contrôle les opérations service_role (edge functions admin).
  IF v_is_service_role THEN
    RETURN NEW;
  END IF;

  -- Déterminer si l'appelant est un administrateur légitime.
  BEGIN
    v_is_admin := public.is_admin_user(auth.uid());
  EXCEPTION WHEN undefined_function THEN
    v_is_admin := false;
  END;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Utilisateur non privilégié : les colonnes sensibles ne doivent pas changer.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modification du rôle interdite (élévation de privilège).';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Modification de is_active interdite.';
  END IF;

  IF NEW.site_ids IS DISTINCT FROM OLD.site_ids THEN
    RAISE EXCEPTION 'Modification des sites autorisés interdite.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_profile_privileges ON public.user_profiles;

CREATE TRIGGER trg_protect_user_profile_privileges
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_profile_privileges();
