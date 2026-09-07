-- Corrige uniquement l'appel direct redondant au helper privé depuis une policy SELECT.
-- Les deux branches existantes imposent déjà session active, MFA et profil actif.
BEGIN;
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='snp_collector_sales'
   AND policyname='collector_sales_read' AND cmd='SELECT' AND permissive='PERMISSIVE'
   AND roles=ARRAY['authenticated']::name[] AND qual='(snp_session_est_active() AND snp_mfa_satisfaite() AND (snp_collector_org_access(organization_id) OR ((collector_id = snp_current_collector_id()) AND snp_collector_visible(collector_id))))' AND with_check IS NULL) THEN
   RAISE EXCEPTION 'Policy collector_sales_read différente du préflight : refaire la revue';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.snp_collector_org_access(uuid)'::regprocedure AND p.prosecdef AND md5(pg_get_functiondef(p.oid))='af953581a475142b717eae61f12179fc') THEN RAISE EXCEPTION 'Helper de contrôle modifié : refaire la revue'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.snp_collector_visible(uuid)'::regprocedure AND p.prosecdef AND md5(pg_get_functiondef(p.oid))='51b1619c8b03ad8f2ab51857d720e176') THEN RAISE EXCEPTION 'Helper de contrôle modifié : refaire la revue'; END IF;
 IF has_function_privilege('authenticated','public.snp_session_est_active()','EXECUTE') THEN
   RAISE EXCEPTION 'ACL privée de session différente du préflight';
 END IF;
END; $guard$;
ALTER POLICY collector_sales_read ON public.snp_collector_sales
USING (public.snp_mfa_satisfaite() AND (
 public.snp_collector_org_access(organization_id)
 OR (collector_id=public.snp_current_collector_id() AND public.snp_collector_visible(collector_id))
));
NOTIFY pgrst,'reload schema';
COMMIT;
