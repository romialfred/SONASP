-- ==========================================================================
-- Sessions éphémères côté client et second facteur obligatoire côté serveur
-- ==========================================================================
-- Le stockage de session et le délai d'inactivité sont appliqués par le client.
-- Cette migration traite la partie que le navigateur ne doit jamais pouvoir
-- contourner : aucune donnée métier n'est accessible avec un jeton aal1.

CREATE OR REPLACE FUNCTION public.snp_mfa_satisfaite()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active
      AND mfa_enrolled_at IS NOT NULL
  ) AND public.snp_aal() = 'aal2';
$fn$;

COMMENT ON FUNCTION public.snp_mfa_satisfaite() IS
  'Vrai uniquement pour un profil actif, enrôlé TOTP et une session aal2.';
REVOKE ALL ON FUNCTION public.snp_mfa_satisfaite() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_mfa_satisfaite() TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_role_utilisateur()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE WHEN public.snp_mfa_satisfaite() THEN (
    SELECT role FROM public.user_profiles WHERE id = auth.uid() AND is_active
  ) ELSE NULL END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_societe_utilisateur()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE WHEN public.snp_mfa_satisfaite() THEN (
    SELECT mining_company_id FROM public.user_profiles WHERE id = auth.uid() AND is_active
  ) ELSE NULL END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_est_agent_sonasp()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_active AND mining_company_id IS NULL
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_est_operateur_interne()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active
      AND mining_company_id IS NULL
      AND role IN ('owner', 'admin', 'management', 'factory', 'airport', 'refinery')
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_societe_compte_mine()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_societe uuid;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Le second facteur doit être validé avant cette opération.'
      USING ERRCODE = '42501';
  END IF;

  SELECT mining_company_id INTO v_societe
  FROM public.user_profiles
  WHERE id = auth.uid() AND is_active AND mining_company_id IS NOT NULL;

  IF v_societe IS NULL THEN
    RAISE EXCEPTION 'Cette opération est réservée au compte de la société minière.'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_societe;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_role_utilisateur() FROM public;
REVOKE ALL ON FUNCTION public.snp_societe_utilisateur() FROM public;
REVOKE ALL ON FUNCTION public.snp_est_agent_sonasp() FROM public;
REVOKE ALL ON FUNCTION public.snp_est_operateur_interne() FROM public;
REVOKE ALL ON FUNCTION public.snp_societe_compte_mine() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_role_utilisateur() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_societe_utilisateur() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_est_agent_sonasp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_est_operateur_interne() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_societe_compte_mine() TO authenticated;

-- Une politique restrictive s'ajoute aux politiques métier existantes : les
-- deux doivent être vraies. Les tables ci-dessous sont les seules nécessaires
-- avant aal2 pour charger le profil et achever l'activation du compte.
DO $block$
DECLARE v_table record;
BEGIN
  FOR v_table IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      AND c.relname NOT IN (
        'user_profiles', 'user_site_assignments', 'password_history',
        'user_2fa_setup', 'user_acceptance_logs'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS snp_mfa_aal2_obligatoire ON public.%I',
      v_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY snp_mfa_aal2_obligatoire ON public.%I AS RESTRICTIVE ' ||
      'FOR ALL TO authenticated USING (public.snp_mfa_satisfaite()) ' ||
      'WITH CHECK (public.snp_mfa_satisfaite())',
      v_table.table_name
    );
  END LOOP;
END;
$block$;

-- Storage ne passe pas par le pre-request PostgREST. Sa barrière est donc
-- explicitement portée par une politique restrictive sur les objets privés.
DROP POLICY IF EXISTS snp_mfa_aal2_obligatoire ON storage.objects;
CREATE POLICY snp_mfa_aal2_obligatoire ON storage.objects AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.snp_mfa_satisfaite())
  WITH CHECK (public.snp_mfa_satisfaite());
