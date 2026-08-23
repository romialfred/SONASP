-- ============================================================================
-- Cloisonnement organisationnel transversal
-- ============================================================================
-- Les politiques historiques restent la source des droits fonctionnels. Cette
-- barriere RESTRICTIVE ajoute le perimetre qui leur manquait : un compte Mine
-- ne peut jamais lire ou ecrire une ligne appartenant a une autre societe.
-- Les agents SONASP conservent leur portee nationale ; leurs permissions
-- metier restent imposees par les policies permissives existantes.

DO $block$
DECLARE
  v_table record;
BEGIN
  IF to_regprocedure('public.snp_est_agent_sonasp()') IS NULL
    OR to_regprocedure('public.snp_societe_utilisateur()') IS NULL
  THEN
    RAISE EXCEPTION 'Les fonctions de securite SONASP doivent etre installees avant le cloisonnement.';
  END IF;

  FOR v_table IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      AND a.attname = 'mining_company_id'
      AND NOT a.attisdropped
      AND c.relname <> 'user_profiles'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS snp_perimetre_societe_lecture ON public.%I',
      v_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY snp_perimetre_societe_lecture ON public.%I AS RESTRICTIVE ' ||
      'FOR SELECT TO authenticated USING (' ||
      'public.snp_est_agent_sonasp() OR mining_company_id = public.snp_societe_utilisateur())',
      v_table.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS snp_perimetre_societe_insertion ON public.%I',
      v_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY snp_perimetre_societe_insertion ON public.%I AS RESTRICTIVE ' ||
      'FOR INSERT TO authenticated WITH CHECK (' ||
      'public.snp_est_agent_sonasp() OR mining_company_id = public.snp_societe_utilisateur())',
      v_table.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS snp_perimetre_societe_modification ON public.%I',
      v_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY snp_perimetre_societe_modification ON public.%I AS RESTRICTIVE ' ||
      'FOR UPDATE TO authenticated USING (' ||
      'public.snp_est_agent_sonasp() OR mining_company_id = public.snp_societe_utilisateur()) ' ||
      'WITH CHECK (' ||
      'public.snp_est_agent_sonasp() OR mining_company_id = public.snp_societe_utilisateur())',
      v_table.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS snp_perimetre_societe_suppression ON public.%I',
      v_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY snp_perimetre_societe_suppression ON public.%I AS RESTRICTIVE ' ||
      'FOR DELETE TO authenticated USING (' ||
      'public.snp_est_agent_sonasp() OR mining_company_id = public.snp_societe_utilisateur())',
      v_table.table_name
    );
  END LOOP;
END;
$block$;

COMMENT ON FUNCTION public.snp_societe_utilisateur() IS
  'Societe du compte courant, disponible uniquement avec profil actif et MFA aal2.';
