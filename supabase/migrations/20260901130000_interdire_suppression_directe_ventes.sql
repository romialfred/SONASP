BEGIN;

-- A regulated sale is never physically deleted from a browser session. Its
-- lifecycle is closed by an audited status transition so payments, taxes,
-- reconciliation and stock keep an immutable common reference.
DO $preflight$
BEGIN
  IF to_regclass('public.sales') IS NULL
     OR to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL
     OR to_regprocedure('public.snp_session_est_active()') IS NULL THEN
    RAISE EXCEPTION 'Sales deletion hardening preflight failed.';
  END IF;
END;
$preflight$;

DO $policies$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='sales' AND cmd='DELETE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.sales', item.policyname);
  END LOOP;
END;
$policies$;

REVOKE DELETE ON TABLE public.sales FROM PUBLIC, anon, authenticated;
GRANT DELETE ON TABLE public.sales TO service_role;

COMMENT ON TABLE public.sales IS
  'Registre réglementaire des ventes. Suppression directe interdite aux sessions applicatives ; utiliser les transitions auditées.';

COMMIT;
