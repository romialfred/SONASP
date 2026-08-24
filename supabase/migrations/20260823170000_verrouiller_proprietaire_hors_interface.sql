-- ============================================================================
-- Le rôle Owner est un compte exceptionnel de continuité.
--
-- Il reste dans le référentiel pour préserver les comptes et historiques, mais
-- aucune session utilisateur ne peut le créer, l'attribuer, le rétrograder ou
-- le désactiver. Seul un script contrôlé exécuté avec service_role (ou pendant
-- une migration) peut réaliser une telle opération.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.snp_peut_administrer_compte(p_target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite()
    AND p_target_id IS NOT NULL
    AND p_target_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles actor
      JOIN public.user_profiles target ON target.id = p_target_id
      WHERE actor.id = auth.uid()
        AND actor.is_active
        AND actor.mining_company_id IS NULL
        AND actor.role IN ('owner', 'admin')
        AND target.role <> 'owner'
        AND public.snp_niveau_role(target.role) <= public.snp_niveau_role(actor.role)
    );
$fn$;

REVOKE ALL ON FUNCTION public.snp_peut_administrer_compte(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_administrer_compte(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_verrouiller_owner_interactif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  -- Les scripts de continuité utilisent service_role. Une migration exécutée
  -- hors requête HTTP n'a pas non plus de rôle JWT authenticated.
  IF COALESCE(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role = 'owner' THEN
    RAISE EXCEPTION 'Le rôle Propriétaire est réservé au script sécurisé de continuité.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    (
      NEW.role IS DISTINCT FROM OLD.role
      AND (NEW.role = 'owner' OR OLD.role = 'owner')
    )
    OR (
      OLD.role = 'owner'
      AND NEW.is_active IS DISTINCT FROM OLD.is_active
    )
  ) THEN
    RAISE EXCEPTION 'Le rôle ou l’état d’un Propriétaire ne se modifie pas depuis une session utilisateur.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_verrouiller_owner_interactif() FROM public;

DROP TRIGGER IF EXISTS snp_owner_interactif_insert ON public.user_profiles;
CREATE TRIGGER snp_owner_interactif_insert
BEFORE INSERT ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.snp_verrouiller_owner_interactif();

DROP TRIGGER IF EXISTS snp_owner_interactif_update ON public.user_profiles;
CREATE TRIGGER snp_owner_interactif_update
BEFORE UPDATE OF role, is_active ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.snp_verrouiller_owner_interactif();
