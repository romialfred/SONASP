-- Lectures seulement, à exécuter sur la cible ISOLÉE identifiée avant la recette.
-- Aucune donnée personnelle ou bancaire n'est retournée par cette vérification technique.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS database_role;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c WHERE c.oid IN ('public.customers'::regclass,'public.customer_banks'::regclass);
SELECT p.oid::regprocedure AS rpc,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'execute') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') AS authenticated_execute
FROM pg_proc p WHERE p.oid=to_regprocedure('public.save_customer_dossier(uuid,jsonb,jsonb)');
SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN ('customers','customer_banks')
ORDER BY tablename,policyname;
SELECT conrelid::regclass AS source,conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE contype='f' AND confrelid='public.customer_banks'::regclass;
SELECT has_schema_privilege('anon','public','create') AS anon_create,
  has_schema_privilege('authenticated','public','create') AS authenticated_create;
COMMIT;
