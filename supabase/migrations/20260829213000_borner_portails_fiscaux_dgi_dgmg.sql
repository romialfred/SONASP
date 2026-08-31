-- Bornage des interactions institutionnelles DGI / DGMG.
--
-- DGI : la lecture des objets fiscaux est autorisée uniquement aux comptes DGI
-- correctement rattachés. Les paiements bruts (preuves, notes, coordonnées et
-- acteurs d'exécution) restent fermés ; une projection fiscale dédiée est
-- exposée en lecture seule.
--
-- DGMG : la capability de validation niveau 1 ne donne aucun accès au registre
-- patrimonial. Une file et une transition minimales sont exposées uniquement si
-- le module national_reserve est explicitement attribué au compte.

BEGIN;

CREATE OR REPLACE FUNCTION public.snp_dgi_has_active_fiscal_scope()
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles profile
      JOIN public.snp_user_organization_memberships membership
        ON membership.user_id = profile.id
       AND membership.is_primary
       AND membership.valid_from <= clock_timestamp()
       AND (membership.valid_until IS NULL OR membership.valid_until > clock_timestamp())
      JOIN public.snp_organizations organization
        ON organization.id = membership.organization_id
       AND organization.is_active
       AND organization.organization_type = 'dgi'
      WHERE profile.id = auth.uid()
        AND profile.is_active
        AND profile.role = 'dgi'
    )
    AND (
      public.snp_actor_has_capability('dgi.fiscal.control')
      OR public.snp_actor_has_capability('dgi.fiscal.reconcile')
    );
$fn$;

-- Reproduit exactement le périmètre historique des paiements bruts. Il est
-- volontairement distinct du périmètre fiscal DGI.
CREATE OR REPLACE FUNCTION public.snp_4i_can_read_payment_scope(
  p_artisan_id uuid,
  p_comptoir_id uuid
)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
  SELECT auth.uid() IS NOT NULL AND (
    (
      p_comptoir_id IS NOT NULL
      AND p_comptoir_id = public.snp_current_organization_id()
      AND public.snp_current_organization_type() = 'comptoir'
      AND (
        public.snp_can_access_artisan(p_artisan_id)
        OR public.snp_actor_has_capability('comptoir.invoices.issue')
        OR public.snp_actor_has_capability('comptoir.payments.execute')
        OR public.snp_actor_has_capability('comptoir.payments.reconcile')
        OR public.snp_actor_has_capability('comptoir.tax.execute')
      )
    )
    OR (
      p_comptoir_id IS NULL AND (
        public.snp_actor_has_capability('sonasp.prepare')
        OR public.snp_actor_has_capability('sonasp.finance.execute')
        OR public.snp_actor_has_capability('sonasp.finance.reconcile')
        OR public.snp_actor_has_capability('sonasp.tax.reconcile')
      )
    )
    OR public.snp_actor_has_capability('collectors.manage')
    OR public.snp_actor_has_capability('sonasp.tax.reconcile')
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_4i_can_read_finance_scope(
  p_artisan_id uuid,
  p_comptoir_id uuid
)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
  SELECT public.snp_4i_can_read_payment_scope(p_artisan_id, p_comptoir_id)
    OR public.snp_dgi_has_active_fiscal_scope();
$fn$;

DROP POLICY IF EXISTS snp_4i_payments_select ON public.snp_artisan_paiements;
CREATE POLICY snp_4i_payments_select
ON public.snp_artisan_paiements
FOR SELECT TO authenticated
USING (public.snp_4i_can_read_payment_scope(artisan_id, comptoir_organization_id));

CREATE OR REPLACE FUNCTION public.snp_dgi_lister_paiements_fiscaux(
  p_comptoir_organization_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  facture_id uuid,
  vente_or_id uuid,
  artisan_id uuid,
  comptoir_organization_id uuid,
  reference_paiement text,
  numero_facture text,
  montant_paye numeric,
  montant_taxes_retenues numeric,
  statut text,
  date_paiement timestamptz,
  date_validation timestamptz,
  date_completion timestamptz
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
BEGIN
  IF NOT public.snp_dgi_has_active_fiscal_scope() THEN
    RAISE EXCEPTION 'Périmètre fiscal DGI requis.' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Pagination fiscale invalide.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    payment.id,
    payment.facture_id,
    payment.vente_or_id,
    payment.artisan_id,
    payment.comptoir_organization_id,
    payment.reference_paiement,
    payment.numero_facture,
    payment.montant_paye,
    payment.montant_taxes_retenues,
    payment.statut::text,
    payment.date_paiement,
    payment.date_validation,
    payment.date_completion
  FROM public.snp_artisan_paiements payment
  WHERE p_comptoir_organization_id IS NULL
     OR payment.comptoir_organization_id = p_comptoir_organization_id
  ORDER BY payment.date_paiement DESC NULLS LAST, payment.id
  LIMIT p_limit OFFSET p_offset;
END;
$fn$;

-- La DGMG peut recevoir le module Réserve sans obtenir le domaine patrimonial
-- entier : l'habilitation reste attachée au module national_reserve précis.
INSERT INTO public.snp_role_module_ceilings (
  role, access_domain, can_view, can_create, can_edit, can_delete, can_approve
)
VALUES ('dgmg', 'inventory', true, false, false, false, true)
ON CONFLICT (role, access_domain) DO UPDATE SET
  can_view = true,
  can_create = false,
  can_edit = false,
  can_delete = false,
  can_approve = true;

INSERT INTO public.snp_role_capabilities (role, capability_code)
VALUES ('dgmg', 'reserve.allocations.validate_level_1')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_dgmg_can_validate_reserve_level_1()
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles profile
      JOIN public.snp_user_organization_memberships membership
        ON membership.user_id = profile.id
       AND membership.is_primary
       AND membership.valid_from <= clock_timestamp()
       AND (membership.valid_until IS NULL OR membership.valid_until > clock_timestamp())
      JOIN public.snp_organizations organization
        ON organization.id = membership.organization_id
       AND organization.is_active
       AND organization.organization_type = 'dgmg'
      WHERE profile.id = auth.uid()
        AND profile.is_active
        AND profile.role = 'dgmg'
    )
    AND public.snp_actor_has_capability('reserve.allocations.validate_level_1')
    AND public.snp_actor_can_module_action('national_reserve', 'view');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_dgmg_lister_validations_reserve_level_1(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  reference text,
  allocation_date date,
  status text,
  reason text,
  decision_reference text,
  decision_authority text,
  depository_name text,
  lot_count integer,
  ingot_count integer,
  gross_weight_grams numeric,
  fine_weight_grams numeric,
  submitted_at timestamptz
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
BEGIN
  IF NOT public.snp_dgmg_can_validate_reserve_level_1() THEN
    RAISE EXCEPTION 'Validation DGMG de niveau 1 non autorisée.' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Pagination de validation invalide.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    allocation.id,
    allocation.reference,
    allocation.allocation_date,
    allocation.status,
    allocation.reason,
    allocation.decision_reference,
    allocation.decision_authority,
    depository.name,
    allocation.lot_count,
    allocation.ingot_count,
    allocation.gross_weight_grams,
    allocation.fine_weight_grams,
    allocation.submitted_at
  FROM public.reserve_allocations allocation
  LEFT JOIN public.snp_organizations depository
    ON depository.id = allocation.depository_organization_id
  WHERE allocation.status IN ('SUBMITTED', 'UNDER_REVIEW')
    AND allocation.created_by IS DISTINCT FROM auth.uid()
  ORDER BY allocation.submitted_at, allocation.id
  LIMIT p_limit OFFSET p_offset;
END;
$fn$;

-- Le prédicat historique reste fermé pour la DGMG hors de la RPC dédiée.
CREATE OR REPLACE FUNCTION public.snp_reserve_permission_allowed(p_permission text)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
  SELECT CASE
    WHEN coalesce(auth.role(), '') = 'service_role' THEN true
    WHEN p_permission NOT IN (
      'reserve.allocations.view', 'reserve.allocations.create', 'reserve.allocations.edit',
      'reserve.allocations.submit', 'reserve.allocations.validate_level_1',
      'reserve.allocations.validate_level_2', 'reserve.allocations.authorize_transfer',
      'reserve.allocations.confirm_receipt', 'reserve.allocations.reconcile',
      'reserve.allocations.export'
    ) THEN false
    WHEN p_permission = 'reserve.allocations.validate_level_1'
      AND EXISTS (
        SELECT 1 FROM public.user_profiles profile
        WHERE profile.id = auth.uid() AND profile.is_active AND profile.role = 'dgmg'
      ) THEN
        public.snp_dgmg_can_validate_reserve_level_1()
    ELSE public.snp_actor_has_capability(p_permission)
  END;
$fn$;

-- La RPC générique sélectionne historiquement le dossier avant de contrôler la
-- capability. On conserve son implémentation comme cœur privé et on place une
-- garde avant toute lecture : un compte DGMG doit passer par la RPC minimale.
DO $isolate_transition_core$
BEGIN
  IF to_regprocedure('public.snp_transition_reserve_allocation_core(uuid,text,text)') IS NULL THEN
    ALTER FUNCTION public.snp_transition_reserve_allocation(uuid, text, text)
      RENAME TO snp_transition_reserve_allocation_core;
  END IF;
END;
$isolate_transition_core$;

CREATE OR REPLACE FUNCTION public.snp_transition_reserve_allocation(
  p_allocation_id uuid,
  p_target_status text,
  p_comment text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_profiles profile
    WHERE profile.id = auth.uid() AND profile.is_active AND profile.role = 'dgmg'
  ) THEN
    RAISE EXCEPTION 'Utilisez la file DGMG dédiée à la validation de niveau 1.'
      USING ERRCODE = '42501';
  END IF;
  RETURN public.snp_transition_reserve_allocation_core(
    p_allocation_id,
    p_target_status,
    p_comment
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_dgmg_transition_reserve_level_1(
  p_allocation_id uuid,
  p_target_status text,
  p_comment text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_current_status text;
  v_created_by uuid;
  v_target_status text := upper(trim(coalesce(p_target_status, '')));
  v_result text;
BEGIN
  IF NOT public.snp_dgmg_can_validate_reserve_level_1() THEN
    RAISE EXCEPTION 'Validation DGMG de niveau 1 non autorisée.' USING ERRCODE = '42501';
  END IF;

  SELECT allocation.status, allocation.created_by
  INTO v_current_status, v_created_by
  FROM public.reserve_allocations allocation
  WHERE allocation.id = p_allocation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Affectation introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_created_by = auth.uid() THEN
    RAISE EXCEPTION 'Séparation des tâches : l’auteur ne peut pas valider son propre dossier.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT (
    (v_current_status = 'SUBMITTED' AND v_target_status IN ('UNDER_REVIEW', 'REJECTED'))
    OR (v_current_status = 'UNDER_REVIEW' AND v_target_status IN ('VALIDATED_LEVEL_1', 'REJECTED'))
  ) THEN
    RAISE EXCEPTION 'Transition DGMG de niveau 1 interdite : % vers %.',
      v_current_status, v_target_status USING ERRCODE = '22023';
  END IF;
  IF v_target_status = 'REJECTED' AND length(trim(coalesce(p_comment, ''))) < 10 THEN
    RAISE EXCEPTION 'Un motif de rejet détaillé est obligatoire.' USING ERRCODE = '22023';
  END IF;

  v_result := public.snp_transition_reserve_allocation_core(
    p_allocation_id,
    v_target_status,
    p_comment
  );
  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_dgi_has_active_fiscal_scope()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_4i_can_read_payment_scope(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_4i_can_read_finance_scope(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_dgi_lister_paiements_fiscaux(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_dgmg_can_validate_reserve_level_1()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_dgmg_lister_validations_reserve_level_1(integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_dgmg_transition_reserve_level_1(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_reserve_permission_allowed(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_transition_reserve_allocation_core(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_transition_reserve_allocation(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.snp_dgi_has_active_fiscal_scope() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_4i_can_read_payment_scope(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_4i_can_read_finance_scope(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_dgi_lister_paiements_fiscaux(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_dgmg_can_validate_reserve_level_1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_dgmg_lister_validations_reserve_level_1(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_dgmg_transition_reserve_level_1(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_reserve_permission_allowed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_transition_reserve_allocation(uuid, text, text) TO authenticated;

WITH exposed(function_oid, purpose) AS (
  VALUES
    ('public.snp_dgi_has_active_fiscal_scope()'::regprocedure::oid, 'rls-policy-helper'),
    ('public.snp_4i_can_read_payment_scope(uuid,uuid)'::regprocedure::oid, 'rls-policy-helper'),
    ('public.snp_4i_can_read_finance_scope(uuid,uuid)'::regprocedure::oid, 'rls-policy-helper'),
    ('public.snp_dgi_lister_paiements_fiscaux(uuid,integer,integer)'::regprocedure::oid, 'runtime-browser'),
    ('public.snp_dgmg_can_validate_reserve_level_1()'::regprocedure::oid, 'rls-policy-helper'),
    ('public.snp_dgmg_lister_validations_reserve_level_1(integer,integer)'::regprocedure::oid, 'runtime-browser'),
    ('public.snp_dgmg_transition_reserve_level_1(uuid,text,text)'::regprocedure::oid, 'runtime-browser'),
    ('public.snp_reserve_permission_allowed(text)'::regprocedure::oid, 'rls-policy-helper'),
    ('public.snp_transition_reserve_allocation(uuid,text,text)'::regprocedure::oid, 'runtime-browser')
)
INSERT INTO public.snp_rpc_execution_allowlist (
  function_signature, function_name, grantee, purpose, migration_version
)
SELECT procedure.oid::regprocedure::text,
       procedure.proname,
       'authenticated',
       exposed.purpose,
       '20260829213000'
FROM exposed
JOIN pg_catalog.pg_proc procedure ON procedure.oid = exposed.function_oid
ON CONFLICT (function_signature, grantee) DO UPDATE SET
  function_name = EXCLUDED.function_name,
  purpose = EXCLUDED.purpose,
  migration_version = EXCLUDED.migration_version;

DO $postflight$
DECLARE
  v_payment_policy text;
BEGIN
  SELECT pg_get_expr(policy.polqual, policy.polrelid)
  INTO v_payment_policy
  FROM pg_policy policy
  WHERE policy.polrelid = 'public.snp_artisan_paiements'::regclass
    AND policy.polname = 'snp_4i_payments_select';

  IF v_payment_policy IS NULL
     OR position('snp_4i_can_read_payment_scope' IN v_payment_policy) = 0
     OR position('snp_4i_can_read_finance_scope' IN v_payment_policy) > 0 THEN
    RAISE EXCEPTION 'Postflight DGI : la policy des paiements bruts n’est pas bornée.';
  END IF;

  IF has_function_privilege('anon', 'public.snp_dgi_lister_paiements_fiscaux(uuid,integer,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.snp_dgmg_transition_reserve_level_1(uuid,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.snp_dgi_lister_paiements_fiscaux(uuid,integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.snp_dgmg_transition_reserve_level_1(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.snp_transition_reserve_allocation_core(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight portails : grants RPC incohérents.';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';

COMMIT;
