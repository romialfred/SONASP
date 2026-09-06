BEGIN;
-- Exécute les branches RPC sans créer de compte ni modifier les données métier.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $test$
DECLARE category record; portal record;
BEGIN
 FOR category IN SELECT code FROM public.snp_actor_categories WHERE is_active LOOP
  PERFORM * FROM public.snp_access_resources_search(category.code,'',0,20);
  PERFORM * FROM public.snp_access_resources_search(category.code,'inexistant-test-290f',1,1);
  FOR portal IN SELECT id FROM public.snp_access_compatible_portals(category.code) LOOP
   PERFORM * FROM public.snp_access_compatible_roles(portal.id,category.code);
  END LOOP;
 END LOOP;
 BEGIN
  PERFORM * FROM public.snp_access_compatible_portals('categorie-inexistante');
  RAISE EXCEPTION 'Expected invalid category rejection';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM * FROM public.snp_access_resources_search('societe-miniere','',0,51);
  RAISE EXCEPTION 'Expected pagination rejection';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
 BEGIN
  PERFORM * FROM public.snp_access_compatible_portals('societe-miniere');
  RAISE EXCEPTION 'Expected authorization rejection';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM * FROM public.snp_access_resources_search('societe-miniere');
  RAISE EXCEPTION 'Expected authorization rejection';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
SELECT 'PASS: 8 categories, resources, portals, compatible roles, pagination and authorization' AS result;

ROLLBACK;
