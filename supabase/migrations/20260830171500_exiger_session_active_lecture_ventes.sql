-- Close the session-revocation gap in the mine/customer read branches.
-- Parent scope remains shared by sales, invoices, payments and related RPCs.
-- No business rows, permissions catalog entries or workflow states are changed.
BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public.snp_peut_consulter_vente(uuid)') IS NULL
     OR to_regprocedure('public.snp_session_est_active()') IS NULL THEN
    RAISE EXCEPTION 'Required canonical sales/session helpers are missing.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.snp_peut_consulter_vente(p_sale_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $function$
  SELECT public.snp_session_est_active()
    AND public.snp_mfa_satisfaite()
    AND EXISTS (
      SELECT 1
      FROM public.sales s
      LEFT JOIN public.customers c ON c.id = s.customer_id
      LEFT JOIN public.user_profiles up ON up.id = auth.uid() AND up.is_active
      WHERE s.id = p_sale_id
        AND (
          public.snp_est_agent_sonasp()
          OR public.snp_est_direction_lecture()
          OR (s.seller_type = 'mining_company' AND s.seller_id = public.snp_societe_utilisateur())
          OR (up.role = 'customer' AND lower(up.email) = lower(c.email))
        )
    );
$function$;

REVOKE ALL ON FUNCTION public.snp_peut_consulter_vente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snp_peut_consulter_vente(uuid) TO authenticated, service_role;

DO $$ BEGIN
  IF has_function_privilege('anon','public.snp_peut_consulter_vente(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.snp_peut_consulter_vente(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected sales helper execution privileges.';
  END IF;
END $$;

COMMIT;
