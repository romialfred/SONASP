BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_test_claims(
  p_sub uuid, p_role text, p_aal text
)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal)::text,
    true
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_transition(
  p_production uuid, p_expected text, p_new text, p_request uuid,
  p_notes text DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_result jsonb;
BEGIN
  v_result := public.snp_transition_daily_production(
    p_production, p_expected, p_new, p_request, p_notes
  );
  RETURN concat(
    'OK:', v_result ->> 'status', ':',
    v_result ->> 'idempotent_replay'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_status(p_production uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.daily_production
  SET status = 'ready_for_customs'::public.production_status_v2
  WHERE id = p_production;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_rewrite_history(p_production uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.unified_status_history
  SET notes = 'Historique falsifié depuis le navigateur'
  WHERE entity_type = 'production' AND entity_id = p_production;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

GRANT EXECUTE ON FUNCTION pg_temp.try_transition(uuid,text,text,uuid,text)
  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION pg_temp.try_direct_status(uuid)
  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION pg_temp.try_rewrite_history(uuid)
  TO authenticated, anon;

SELECT plan(27);

SELECT ok(
  to_regprocedure('public.snp_transition_daily_production(uuid,text,text,uuid,text)') IS NOT NULL,
  'la RPC atomique de transition Production existe'
);
SELECT ok(has_function_privilege(
  'authenticated',
  'public.snp_transition_daily_production(uuid,text,text,uuid,text)',
  'EXECUTE'
), 'authenticated peut appeler la RPC');
SELECT ok(NOT has_function_privilege(
  'anon',
  'public.snp_transition_daily_production(uuid,text,text,uuid,text)',
  'EXECUTE'
), 'anon ne peut pas appeler la RPC');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger
          WHERE tgrelid = 'public.daily_production'::regclass
            AND tgname = 'snp_5e_daily_production_status_rpc_only'
            AND NOT tgisinternal),
  'le statut daily_production est protégé par un trigger RPC-only'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger
          WHERE tgrelid = 'public.unified_status_history'::regclass
            AND tgname = 'snp_5e_production_history_rpc_only'
            AND NOT tgisinternal),
  'l’historique Production est protégé contre la réécriture'
);
SELECT ok(to_regclass('public.uq_snp_production_transition_request') IS NOT NULL,
  'la clé d’idempotence Production est unique');
SELECT is(
  (SELECT prosecdef FROM pg_proc
   WHERE oid = 'public.snp_transition_daily_production(uuid,text,text,uuid,text)'::regprocedure),
  true, 'la RPC est SECURITY DEFINER'
);
SELECT matches(
  (SELECT prosrc FROM pg_proc
   WHERE oid = 'public.snp_transition_daily_production(uuid,text,text,uuid,text)'::regprocedure),
  'snp_actor_has_capability.*mine\.operate.*sonasp\.approve',
  'les capabilities sensibles sont vérifiées côté serveur'
);
SELECT matches(
  (SELECT prosrc FROM pg_proc
   WHERE oid = 'public.snp_transition_daily_production(uuid,text,text,uuid,text)'::regprocedure),
  'FOR UPDATE', 'la transition verrouille la ligne métier'
);

SELECT pg_temp.set_test_claims(
  '5e000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('5e000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '5e-creator@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('5e000000-0000-4000-8000-000000000002', '00000000-0000-0000-8000-000000000000', 'authenticated', 'authenticated', '5e-validator@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('5e000000-0000-4000-8000-000000000003', '00000000-0000-0000-8000-000000000000', 'authenticated', 'authenticated', '5e-other-mine@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('5e000000-0000-4000-8000-000000000004', '00000000-0000-0000-8000-000000000000', 'authenticated', 'authenticated', '5e-approver@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('5e000000-0000-4000-8000-000000000005', '00000000-0000-0000-8000-000000000000', 'authenticated', 'authenticated', '5e-manager@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('5e000000-0000-4000-8000-000000000099', '00000000-0000-0000-8000-000000000000', 'authenticated', 'authenticated', '5e-service@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.mining_companies (
  id, code, name, country, company_type, is_active
) VALUES
  ('5e000000-0000-4000-8000-000000000101', '5E-MINE-A', 'Mine A 5E', 'Burkina Faso', 'production_mine', true),
  ('5e000000-0000-4000-8000-000000000102', '5E-MINE-B', 'Mine B 5E', 'Burkina Faso', 'production_mine', true);

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id,
  mfa_enrolled_at, must_change_password
) VALUES
  ('5e000000-0000-4000-8000-000000000001', '5e-creator@sonasp.invalid', 'Créateur Mine A', 'mine', true, '5e000000-0000-4000-8000-000000000101', now(), false),
  ('5e000000-0000-4000-8000-000000000002', '5e-validator@sonasp.invalid', 'Validateur Mine A', 'mine', true, '5e000000-0000-4000-8000-000000000101', now(), false),
  ('5e000000-0000-4000-8000-000000000003', '5e-other-mine@sonasp.invalid', 'Mine B', 'mine', true, '5e000000-0000-4000-8000-000000000102', now(), false),
  ('5e000000-0000-4000-8000-000000000004', '5e-approver@sonasp.invalid', 'Approbateur SONASP', 'management', true, NULL, now(), false),
  ('5e000000-0000-4000-8000-000000000005', '5e-manager@sonasp.invalid', 'Manager lecture', 'manager', true, NULL, now(), false),
  ('5e000000-0000-4000-8000-000000000099', '5e-service@sonasp.invalid', 'Service test', 'admin', true, NULL, now(), false);

INSERT INTO public.daily_production (
  id, production_date, bullion_grams, estimated_fineness_pct,
  estimated_gold_pct, mining_company_id, bar_reference, status, created_by
) VALUES
  ('5e000000-0000-4000-8000-000000000201', current_date, 100, 90, 90, '5e000000-0000-4000-8000-000000000101', '5E-BAR-A', 'prepared', '5e000000-0000-4000-8000-000000000001'),
  ('5e000000-0000-4000-8000-000000000202', current_date, 110, 91, 91, '5e000000-0000-4000-8000-000000000101', '5E-BAR-SOD', 'prepared', '5e000000-0000-4000-8000-000000000002'),
  ('5e000000-0000-4000-8000-000000000203', current_date, 120, 92, 92, '5e000000-0000-4000-8000-000000000102', '5E-BAR-B', 'prepared', '5e000000-0000-4000-8000-000000000003');

SELECT pg_temp.set_test_claims(
  '5e000000-0000-4000-8000-000000000002', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
  '5e000000-0000-4000-8000-000000000201', 'prepared', 'ready_for_customs',
  '5e000000-0000-4000-8000-000000001001'
), 'ERR:42501', 'AAL1 est refusé malgré le rôle Mine');
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '5e000000-0000-4000-8000-000000000005', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
  '5e000000-0000-4000-8000-000000000201', 'prepared', 'ready_for_customs',
  '5e000000-0000-4000-8000-000000001002'
), 'ERR:42501', 'un Manager lecture ne peut valider une production');
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '5e000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
  '5e000000-0000-4000-8000-000000000201', 'prepared', 'ready_for_customs',
  '5e000000-0000-4000-8000-000000001003'
), 'ERR:P0002', 'une Mine ne peut cibler la production d’un autre tenant');
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '5e000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
  '5e000000-0000-4000-8000-000000000202', 'prepared', 'ready_for_customs',
  '5e000000-0000-4000-8000-000000001004'
), 'ERR:42501', 'le créateur ne peut valider sa propre déclaration');
SELECT is(pg_temp.try_direct_status(
  '5e000000-0000-4000-8000-000000000201'
), 'ERR:42501', 'UPDATE PostgREST du statut est refusé');
SELECT is(pg_temp.try_transition(
  '5e000000-0000-4000-8000-000000000201', 'prepared', 'ready_for_customs',
  '5e000000-0000-4000-8000-000000001005', 'Contrôle indépendant conforme'
), 'OK:ready_for_customs:false', 'un second acteur Mine valide dans son tenant');
RESET ROLE;

SELECT is(
  (SELECT status::text FROM public.daily_production
   WHERE id = '5e000000-0000-4000-8000-000000000201'),
  'ready_for_customs', 'la transition métier est persistée'
);

SELECT pg_temp.set_test_claims(
  '5e000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
  '5e000000-0000-4000-8000-000000000201', 'prepared', 'ready_for_customs',
  '5e000000-0000-4000-8000-000000001005', 'Contrôle indépendant conforme'
), 'OK:ready_for_customs:true', 'le rejeu de la même requête est idempotent');
SELECT is(pg_temp.try_transition(
  '5e000000-0000-4000-8000-000000000201', 'ready_for_customs', 'ready_for_customs',
  '5e000000-0000-4000-8000-000000001005'
), 'ERR:22023', 'une clé existante ne peut être réaffectée');
SELECT is(pg_temp.try_transition(
  '5e000000-0000-4000-8000-000000000201', 'prepared', 'ready_for_customs',
  '5e000000-0000-4000-8000-000000001006'
), 'ERR:40001', 'une intention concurrente obsolète reçoit un conflit optimiste');
SELECT is(pg_temp.try_rewrite_history(
  '5e000000-0000-4000-8000-000000000201'
), 'ERR:42501', 'le navigateur ne peut réécrire l’historique réglementaire');
RESET ROLE;

SELECT is(
  (SELECT count(*) FROM public.snp_workflow_audit
   WHERE aggregate_type = 'daily_production'
     AND aggregate_id = '5e000000-0000-4000-8000-000000000201'
     AND action = 'status-transition'),
  1::bigint, 'un rejeu ne duplique pas l’audit'
);
SELECT is(
  (SELECT actor_id FROM public.snp_workflow_audit
   WHERE aggregate_type = 'daily_production'
     AND aggregate_id = '5e000000-0000-4000-8000-000000000201'
     AND action = 'status-transition'),
  '5e000000-0000-4000-8000-000000000002'::uuid,
  'l’acteur d’audit est dérivé de auth.uid'
);
SELECT is(
  (SELECT reason FROM public.snp_workflow_audit
   WHERE aggregate_type = 'daily_production'
     AND aggregate_id = '5e000000-0000-4000-8000-000000000201'
     AND action = 'status-transition'),
  'Contrôle indépendant conforme', 'la justification est auditée'
);
SELECT is(
  (SELECT notes FROM public.unified_status_history
   WHERE entity_type = 'production'
     AND entity_id = '5e000000-0000-4000-8000-000000000201'
     AND old_status = 'prepared' AND new_status = 'ready_for_customs'
   ORDER BY changed_at DESC LIMIT 1),
  'Contrôle indépendant conforme', 'les notes sont écrites atomiquement par la RPC'
);

SELECT pg_temp.set_test_claims(
  '5e000000-0000-4000-8000-000000000004', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
  '5e000000-0000-4000-8000-000000000203', 'prepared', 'ready_for_customs',
  '5e000000-0000-4000-8000-000000001007', 'Contrôle national SONASP conforme'
), 'OK:ready_for_customs:false', 'un approbateur SONASP AAL2 peut valider nationalement');
RESET ROLE;

SELECT is(
  (SELECT capability_code FROM public.snp_workflow_audit
   WHERE aggregate_type = 'daily_production'
     AND aggregate_id = '5e000000-0000-4000-8000-000000000203'
     AND action = 'status-transition'),
  'sonasp.approve', 'la capability effectivement utilisée est auditée'
);
SELECT is(
  (SELECT count(*) FROM public.snp_workflow_notification_outbox o
   WHERE o.aggregate_type = 'daily_production'
     AND o.aggregate_id IN (
       '5e000000-0000-4000-8000-000000000201',
       '5e000000-0000-4000-8000-000000000203'
     ) AND o.event_type = 'status-transition'),
  2::bigint, 'chaque transition réussie produit exactement une notification transactionnelle'
);

SELECT * FROM finish();
ROLLBACK;
