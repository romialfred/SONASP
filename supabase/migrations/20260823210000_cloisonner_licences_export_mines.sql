-- Cloisonnement des licences d'exportation par société minière.
--
-- La migration d'origine autorisait toute session authentifiée à lire et à
-- modifier toutes les licences. Le portail mine doit au contraire être limité
-- à la société portée par le profil, tout en conservant la vue nationale pour
-- les agents SONASP et la lecture consolidée pour la Direction.

BEGIN;

DO $guard$
BEGIN
  IF to_regprocedure('public.snp_est_agent_sonasp()') IS NULL
    OR to_regprocedure('public.snp_est_direction_lecture()') IS NULL
    OR to_regprocedure('public.snp_societe_utilisateur()') IS NULL
  THEN
    RAISE EXCEPTION 'Les fonctions de périmètre et de MFA doivent être installées avant les règles des licences';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.snp_peut_consulter_licence_export(p_license_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.export_licenses el
    WHERE el.id = p_license_id
      AND (
        public.snp_est_agent_sonasp()
        OR public.snp_est_direction_lecture()
        OR el.mining_company_id = public.snp_societe_utilisateur()
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.snp_peut_modifier_licence_export(p_license_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.export_licenses el
    WHERE el.id = p_license_id
      AND (
        public.snp_est_agent_sonasp()
        OR el.mining_company_id = public.snp_societe_utilisateur()
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.snp_peut_consulter_licence_export(uuid) FROM public;
REVOKE ALL ON FUNCTION public.snp_peut_modifier_licence_export(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_consulter_licence_export(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_peut_modifier_licence_export(uuid) TO authenticated;

ALTER TABLE public.export_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_license_documents ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les règles historiques, notamment les anciennes règles
-- `USING (true)`, afin qu'aucune politique permissive ne contourne le périmètre.
DO $policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('export_licenses', 'export_license_documents')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END
$policies$;

CREATE POLICY snp_licences_export_lecture
  ON public.export_licenses
  FOR SELECT
  TO authenticated
  USING (
    public.snp_est_agent_sonasp()
    OR public.snp_est_direction_lecture()
    OR mining_company_id = public.snp_societe_utilisateur()
  );

CREATE POLICY snp_licences_export_creation
  ON public.export_licenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.snp_est_agent_sonasp()
    OR mining_company_id = public.snp_societe_utilisateur()
  );

CREATE POLICY snp_licences_export_modification
  ON public.export_licenses
  FOR UPDATE
  TO authenticated
  USING (
    public.snp_est_agent_sonasp()
    OR mining_company_id = public.snp_societe_utilisateur()
  )
  WITH CHECK (
    public.snp_est_agent_sonasp()
    OR mining_company_id = public.snp_societe_utilisateur()
  );

CREATE POLICY snp_licences_export_suppression
  ON public.export_licenses
  FOR DELETE
  TO authenticated
  USING (
    public.snp_est_agent_sonasp()
    OR mining_company_id = public.snp_societe_utilisateur()
  );

CREATE POLICY snp_documents_licence_export_lecture
  ON public.export_license_documents
  FOR SELECT
  TO authenticated
  USING (public.snp_peut_consulter_licence_export(license_id));

CREATE POLICY snp_documents_licence_export_creation
  ON public.export_license_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.snp_peut_modifier_licence_export(license_id));

CREATE POLICY snp_documents_licence_export_modification
  ON public.export_license_documents
  FOR UPDATE
  TO authenticated
  USING (public.snp_peut_modifier_licence_export(license_id))
  WITH CHECK (public.snp_peut_modifier_licence_export(license_id));

CREATE POLICY snp_documents_licence_export_suppression
  ON public.export_license_documents
  FOR DELETE
  TO authenticated
  USING (public.snp_peut_modifier_licence_export(license_id));

COMMENT ON FUNCTION public.snp_peut_consulter_licence_export(uuid) IS
  'Autorise la lecture d une licence aux agents SONASP, à la Direction et à la mine propriétaire, avec MFA.';
COMMENT ON FUNCTION public.snp_peut_modifier_licence_export(uuid) IS
  'Autorise la modification d une licence aux agents SONASP et à la mine propriétaire, avec MFA.';

COMMIT;
