-- Cloisonnement multi-societe du module Conciliation.
--
-- Une capacite de lecture indique ce que l'acteur peut faire ; elle ne doit pas
-- transformer un acteur de mine en lecteur national. Les anciennes policies
-- utilisaient `reconciliation.read` comme branche globale, alors que cette
-- capacite est aussi attribuee au role `mine`. Le meme defaut se propageait aux
-- ecarts, calculs fiscaux et grands livres, ainsi qu'aux fonctions de solde
-- SECURITY DEFINER.

BEGIN;

-- La table d'attribution reste la source de verite. L'exception historique du
-- role manager contredisait ses lignes dans snp_role_capabilities et rendait le
-- comportement UI/serveur incoherent.
CREATE OR REPLACE FUNCTION public.snp_actor_has_capability(p_capability_code text)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  WITH actor AS (
    SELECT p.id, p.role
    FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.is_active
  ), capability AS (
    SELECT c.code, c.sensitive
    FROM public.snp_capability_catalog c
    WHERE c.code = p_capability_code
  ), explicit_override AS (
    SELECT uc.allowed
    FROM public.snp_user_capabilities uc
    WHERE uc.user_id = auth.uid()
      AND uc.capability_code = p_capability_code
      AND uc.valid_from <= clock_timestamp()
      AND (uc.valid_until IS NULL OR uc.valid_until > clock_timestamp())
  )
  SELECT CASE
    WHEN coalesce(auth.role(), '') = 'service_role' THEN true
    WHEN NOT EXISTS (SELECT 1 FROM actor) THEN false
    WHEN NOT EXISTS (SELECT 1 FROM capability) THEN false
    WHEN (SELECT sensitive FROM capability) AND NOT public.snp_mfa_satisfaite() THEN false
    WHEN EXISTS (SELECT 1 FROM explicit_override)
      THEN (SELECT allowed FROM explicit_override LIMIT 1)
    WHEN (SELECT role FROM actor) = 'owner' THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.snp_role_capabilities rc
      WHERE rc.role = (SELECT role FROM actor)
        AND rc.capability_code = p_capability_code
    )
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_can_read_reconciliation_scope(p_mining_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE
    WHEN coalesce(auth.role(), '') = 'service_role' THEN true
    ELSE coalesce((
      SELECT CASE
        WHEN NOT public.snp_actor_has_capability('reconciliation.read') THEN false
        WHEN p.role = 'mine' THEN p.mining_company_id IS NOT NULL
          AND p.mining_company_id = p_mining_company_id
        WHEN p.role IN ('owner', 'management', 'admin', 'manager') THEN true
        ELSE false
      END
      FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.is_active
    ), false)
  END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_can_read_reconciliation_scope(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snp_can_read_reconciliation_scope(uuid) TO authenticated;

DROP POLICY IF EXISTS snp_conciliations_lecture ON public.snp_conciliations;
CREATE POLICY snp_conciliations_lecture
  ON public.snp_conciliations FOR SELECT TO authenticated
  USING (public.snp_can_read_reconciliation_scope(mining_company_id));

DROP POLICY IF EXISTS snp_conciliations_versions_lecture ON public.snp_conciliations_versions;
CREATE POLICY snp_conciliations_versions_lecture
  ON public.snp_conciliations_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.snp_conciliations c
    WHERE c.id = conciliation_id
      AND public.snp_can_read_reconciliation_scope(c.mining_company_id)
  ));

DROP POLICY IF EXISTS snp_conciliations_ecarts_lecture ON public.snp_conciliations_ecarts;
CREATE POLICY snp_conciliations_ecarts_lecture
  ON public.snp_conciliations_ecarts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.snp_conciliations c
    WHERE c.id = conciliation_id
      AND public.snp_can_read_reconciliation_scope(c.mining_company_id)
  ));

DROP POLICY IF EXISTS snp_glc_lecture ON public.snp_grand_livre_commercial;
CREATE POLICY snp_glc_lecture
  ON public.snp_grand_livre_commercial FOR SELECT TO authenticated
  USING (public.snp_can_read_reconciliation_scope(mining_company_id));

DROP POLICY IF EXISTS snp_glf_lecture ON public.snp_grand_livre_fiscal;
CREATE POLICY snp_glf_lecture
  ON public.snp_grand_livre_fiscal FOR SELECT TO authenticated
  USING (public.snp_can_read_reconciliation_scope(mining_company_id));

DROP POLICY IF EXISTS snp_calculs_fiscaux_lecture ON public.snp_calculs_fiscaux;
CREATE POLICY snp_calculs_fiscaux_lecture
  ON public.snp_calculs_fiscaux FOR SELECT TO authenticated
  USING (public.snp_can_read_reconciliation_scope(mining_company_id));

-- Ces fonctions contournent la RLS par conception ; elles reproduisent donc le
-- meme filtre de perimetre dans leur requete interne.
CREATE OR REPLACE FUNCTION public.snp_solde_commercial(
  p_contrepartie_type text,
  p_contrepartie_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT coalesce(sum(
    CASE WHEN sens = 'credit' THEN montant ELSE -montant END
  ), 0)
  FROM public.snp_grand_livre_commercial
  WHERE contrepartie_type = p_contrepartie_type
    AND contrepartie_id = p_contrepartie_id
    AND public.snp_can_read_reconciliation_scope(mining_company_id);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_solde_fiscal(
  p_mining_company_id uuid,
  p_code_taxe text
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT coalesce(sum(
    CASE WHEN sens = 'credit' THEN montant ELSE -montant END
  ), 0)
  FROM public.snp_grand_livre_fiscal
  WHERE mining_company_id = p_mining_company_id
    AND code_taxe = p_code_taxe
    AND public.snp_can_read_reconciliation_scope(mining_company_id);
$fn$;

REVOKE ALL ON FUNCTION public.snp_solde_commercial(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.snp_solde_fiscal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snp_solde_commercial(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_solde_fiscal(uuid, text) TO authenticated;

DO $$
DECLARE
  v_policies integer;
BEGIN
  SELECT count(*) INTO v_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'snp_conciliations_lecture', 'snp_conciliations_versions_lecture',
      'snp_conciliations_ecarts_lecture', 'snp_glc_lecture',
      'snp_glf_lecture', 'snp_calculs_fiscaux_lecture'
    )
    AND qual LIKE '%snp_can_read_reconciliation_scope%';

  IF v_policies <> 6 THEN
    RAISE EXCEPTION 'Postflight : % policies cloisonnees au lieu de 6.', v_policies;
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
