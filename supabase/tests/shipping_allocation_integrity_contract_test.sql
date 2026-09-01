BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(38);

-- Contraintes physiques ----------------------------------------------------
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.shipping_production_items'::regclass
    AND conname = 'snp_shipping_item_weights_valid'
    AND contype = 'c' AND convalidated
), 'les poids net et brut sont contraints et valides');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.shipping_production_items'::regclass
    AND conname = 'snp_shipping_item_fineness_valid'
    AND contype = 'c' AND convalidated
), 'la finesse est contrainte et validee');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.shipping_production_items'::regclass
    AND conname = 'snp_shipping_item_pure_gold_valid'
    AND contype = 'c' AND convalidated
), 'le poids d or pur est contraint et valide');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.shipping_production_items'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE
      '%shipping_preparation_id%daily_production_id%'
), 'une production ne peut apparaitre qu une fois dans une preparation');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'shipping_production_items'
    AND indexdef ILIKE '%(daily_production_id)%'
), 'le cumul par production dispose de son index');

-- Declencheurs et fonctions ----------------------------------------------
SELECT ok(EXISTS(
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.shipping_production_items'::regclass
    AND tgname = 'snp_shipping_physical_allocation_guard'
    AND NOT tgisinternal
), 'la garde de surallocation est installee');
SELECT ok((
  SELECT pg_get_triggerdef(oid) ILIKE
    '%BEFORE INSERT OR DELETE OR UPDATE%'
  FROM pg_trigger
  WHERE tgrelid = 'public.shipping_production_items'::regclass
    AND tgname = 'snp_shipping_physical_allocation_guard'
), 'la garde couvre INSERT UPDATE et DELETE avant mutation');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.shipping_production_items'::regclass
    AND tgname = 'trigger_shipping_production_items_totals'
    AND NOT tgisinternal
), 'le recalcul des totaux reste installe');
SELECT ok((
  SELECT prosecdef FROM pg_proc
  WHERE oid = 'public.snp_guard_shipping_physical_allocation()'::regprocedure
), 'la garde est SECURITY DEFINER');
SELECT ok((
  SELECT prosecdef FROM pg_proc
  WHERE oid = 'public.calculate_shipping_preparation_totals(uuid)'::regprocedure
), 'le calcul des totaux est SECURITY DEFINER');
SELECT ok((
  SELECT prosecdef FROM pg_proc
  WHERE oid = 'public.trigger_update_shipping_totals()'::regprocedure
), 'le declencheur de totaux est SECURITY DEFINER');
SELECT is((
  SELECT proconfig::text FROM pg_proc
  WHERE oid = 'public.snp_guard_shipping_physical_allocation()'::regprocedure
), '{"search_path=pg_catalog, public, pg_temp"}',
  'la garde fixe un search_path de confiance');
SELECT is((
  SELECT proconfig::text FROM pg_proc
  WHERE oid = 'public.calculate_shipping_preparation_totals(uuid)'::regprocedure
), '{"search_path=pg_catalog, public, pg_temp"}',
  'le calcul fixe un search_path de confiance');
SELECT is((
  SELECT proconfig::text FROM pg_proc
  WHERE oid = 'public.trigger_update_shipping_totals()'::regprocedure
), '{"search_path=pg_catalog, public, pg_temp"}',
  'le declencheur fixe un search_path de confiance');
SELECT is((
  SELECT count(*) FROM information_schema.role_routine_grants
  WHERE routine_schema = 'public'
    AND routine_name IN (
      'snp_guard_shipping_physical_allocation',
      'calculate_shipping_preparation_totals',
      'trigger_update_shipping_totals'
    )
    AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
    AND privilege_type = 'EXECUTE'
), 0::bigint, 'les fonctions internes ne sont appelables par aucun role API');

-- Invariants verifies dans les definitions serveur ------------------------
SELECT ok(position('FOR UPDATE' IN pg_get_functiondef(
  'public.snp_guard_shipping_physical_allocation()'::regprocedure
)) > 0, 'les allocations concurrentes sont serialisees');
SELECT ok(position(
  'FROM public.shipping_preparations preparation'
  IN pg_get_functiondef(
    'public.snp_guard_shipping_physical_allocation()'::regprocedure
  )
) < position(
  'FROM public.daily_production production'
  IN pg_get_functiondef(
    'public.snp_guard_shipping_physical_allocation()'::regprocedure
  )
), 'les preparations sont verrouillees avant les productions');
SELECT ok(position('waiting_for_customs_approval' IN pg_get_functiondef(
  'public.snp_guard_shipping_physical_allocation()'::regprocedure
)) > 0, 'seule une preparation initiale est mutable');
SELECT ok(position('ready_for_customs' IN pg_get_functiondef(
  'public.snp_guard_shipping_physical_allocation()'::regprocedure
)) > 0, 'seule une production prete pour douane est affectable');
SELECT ok(position('IS DISTINCT FROM v_production.mining_company_id'
  IN pg_get_functiondef(
    'public.snp_guard_shipping_physical_allocation()'::regprocedure
  )) > 0, 'le tenant de la production est rapproche de la preparation');
SELECT ok(position('v_allocated_net + new.net_weight_grams'
  IN lower(pg_get_functiondef(
    'public.snp_guard_shipping_physical_allocation()'::regprocedure
  ))) > 0, 'le poids net cumule est borne par la production');
SELECT ok(position('v_allocated_pure + new.pure_gold_grams'
  IN lower(pg_get_functiondef(
    'public.snp_guard_shipping_physical_allocation()'::regprocedure
  ))) > 0, 'l or pur cumule est borne par la production');
SELECT ok(position('if tg_op = ''insert''' IN lower(pg_get_functiondef(
  'public.snp_guard_shipping_physical_allocation()'::regprocedure
))) > 0 AND position('elsif tg_op = ''delete'''
  IN lower(pg_get_functiondef(
    'public.snp_guard_shipping_physical_allocation()'::regprocedure
  ))) > 0, 'OLD et NEW sont separes explicitement selon l operation');
SELECT ok(position('count(DISTINCT item.ingot_box_number)'
  IN pg_get_functiondef(
    'public.calculate_shipping_preparation_totals(uuid)'::regprocedure
  )) > 0, 'total_boxes compte les colis physiques distincts');
SELECT ok(position('OLD.shipping_preparation_id' IN pg_get_functiondef(
  'public.trigger_update_shipping_totals()'::regprocedure
)) > 0 AND position('NEW.shipping_preparation_id'
  IN pg_get_functiondef(
    'public.trigger_update_shipping_totals()'::regprocedure
  )) > 0, 'un deplacement recalcule la preparation source et la destination');

-- RLS et privileges -------------------------------------------------------
SELECT ok((
  SELECT relrowsecurity
  FROM pg_class WHERE oid = 'public.shipping_production_items'::regclass
), 'RLS est active sur les affectations');
SELECT ok((
  SELECT relforcerowsecurity
  FROM pg_class WHERE oid = 'public.shipping_production_items'::regclass
), 'FORCE RLS est active sur les affectations');
SELECT is((
  SELECT count(*) FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shipping_production_items'
    AND roles && ARRAY['authenticated'::name]
), 4::bigint, 'authenticated possede exactement quatre policies operationnelles');
SELECT is((
  SELECT count(*) FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shipping_production_items'
    AND roles && ARRAY['anon'::name]
), 0::bigint, 'anon ne possede aucune policy');
SELECT is((
  SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'shipping_production_items'
    AND grantee = 'anon'
), 0::bigint, 'anon ne possede aucun privilege de table');
SELECT ok(has_table_privilege(
  'authenticated', 'public.shipping_production_items', 'SELECT'
), 'authenticated peut lire les affectations dans son perimetre');
SELECT ok(has_table_privilege(
  'authenticated', 'public.shipping_production_items', 'INSERT'
), 'authenticated peut ajouter une affectation autorisee');
SELECT ok(has_table_privilege(
  'authenticated', 'public.shipping_production_items', 'DELETE'
), 'authenticated peut retirer une affectation encore mutable');
SELECT ok(NOT has_table_privilege(
  'authenticated', 'public.shipping_production_items', 'UPDATE'
), 'aucun UPDATE global de table n est accorde');
SELECT is((
  SELECT count(*) FROM information_schema.role_column_grants
  WHERE table_schema = 'public'
    AND table_name = 'shipping_production_items'
    AND grantee = 'authenticated'
    AND privilege_type = 'UPDATE'
), 10::bigint, 'UPDATE est limite aux dix colonnes metier attendues');
SELECT ok(NOT has_column_privilege(
  'authenticated', 'public.shipping_production_items', 'id', 'UPDATE'
), 'la cle primaire ne peut pas etre modifiee par le client');
SELECT ok(NOT has_column_privilege(
  'authenticated', 'public.shipping_production_items', 'created_at', 'UPDATE'
), 'la date de creation ne peut pas etre modifiee par le client');
SELECT is((
  SELECT count(*) FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shipping_production_items'
    AND (
      coalesce(qual, '') IN ('true', '(true)')
      OR coalesce(with_check, '') IN ('true', '(true)')
    )
), 0::bigint, 'aucune policy permissive globale ne subsiste');

SELECT * FROM finish();

ROLLBACK;
