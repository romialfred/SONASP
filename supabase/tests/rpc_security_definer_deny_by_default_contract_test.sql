BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION pg_temp.set_test_claims(
  p_sub uuid,
  p_role text,
  p_aal text
)
RETURNS void
LANGUAGE plpgsql
AS $fn$
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

CREATE OR REPLACE FUNCTION pg_temp.try_customers(p_company_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.get_authorized_customers_for_mine(p_company_id);
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_sale_authorization(p_company_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_allowed boolean;
BEGIN
  SELECT is_authorized INTO v_allowed
  FROM public.check_sale_authorization(
    p_company_id,
    '63000000-0000-4000-8000-000000000901',
    5,
    10
  );
  RETURN 'OK:' || coalesce(v_allowed::text, 'NULL');
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_license(p_license_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_allowed boolean;
BEGIN
  SELECT is_available INTO v_allowed
  FROM public.check_license_availability(p_license_id, 10);
  RETURN 'OK:' || coalesce(v_allowed::text, 'NULL');
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_lot(p_company_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_lot text;
BEGIN
  v_lot := public.get_next_expedition_lot_number(
    p_company_id, extract(year FROM current_date)::integer
  );
  RETURN 'OK:' || v_lot;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_modules(p_user_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM 1 FROM public.get_user_modules(p_user_id) LIMIT 1;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_security_event(p_claimed_user uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM public.log_security_event(
    p_claimed_user,
    'RPC_DENY_DEFAULT_TEST',
    '198.51.100.10',
    'pgTAP',
    jsonb_build_object('contract', 'rpc-deny-default')
  );
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_activity(
  p_claimed_user uuid,
  p_resource_id uuid DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_id uuid;
BEGIN
  v_id := public.log_user_activity(
    p_claimed_user,
    'view',
    'rpc-security',
    'contract',
    p_resource_id,
    'Test de contrat RPC',
    '{}'::jsonb,
    '198.51.100.10',
    'pgTAP'
  );
  RETURN 'OK:' || v_id::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_convert_payment(p_claimed_user uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_ok boolean;
BEGIN
  v_ok := public.convert_virtual_to_actual_payment(
    '63000000-0000-4000-8000-000000000801',
    current_date,
    'Banque test',
    'Compte test',
    'REF-RPC-TEST',
    NULL,
    1,
    NULL,
    'Test de contrat',
    p_claimed_user
  );
  RETURN 'OK:' || v_ok::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_consume_activation_token(
  p_token text,
  p_now timestamptz
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_count bigint;
  v_user_id uuid;
  v_token_type text;
BEGIN
  SELECT count(*), (array_agg(user_id))[1], min(token_type)
  INTO v_count, v_user_id, v_token_type
  FROM public.consume_activation_token(p_token, p_now);
  RETURN format(
    'OK:%s:%s:%s', v_count,
    coalesce(v_user_id::text, '-'), coalesce(v_token_type, '-')
  );
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

-- Les privilèges par défaut durcis s’appliquent aussi aux fonctions de test
-- créées après la migration. Ces grants sont transactionnels et annulés par le
-- ROLLBACK final ; ils ne concernent jamais le schéma public applicatif.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC;

SELECT plan(56);

-- Contrat structurel et inventaire -----------------------------------------
SELECT ok(
  (SELECT c.relrowsecurity AND c.relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'snp_rpc_execution_allowlist'),
  'le registre d’exposition est protégé par RLS forcée'
);
SELECT is(
  (SELECT count(*)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND EXISTS (
       SELECT 1
       FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
     )),
  0::bigint,
  'aucune fonction SECURITY DEFINER publique ne conserve EXECUTE PUBLIC'
);
SELECT is(
  (SELECT count(*)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  'anon ne peut exécuter aucune fonction SECURITY DEFINER publique'
);
SELECT is(
  (WITH owners AS (
     SELECT DISTINCT p.proowner
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
   ), forbidden_defaults AS (
     SELECT owners.proowner, a.grantee
     FROM owners
     LEFT JOIN pg_default_acl d
       ON d.defaclrole = owners.proowner
      AND d.defaclnamespace = 0
      AND d.defaclobjtype = 'f'
     CROSS JOIN LATERAL aclexplode(
       coalesce(d.defaclacl, acldefault('f', owners.proowner))
     ) a
     WHERE a.privilege_type = 'EXECUTE'
       AND (a.grantee = 0 OR a.grantee IN (
         (SELECT oid FROM pg_roles WHERE rolname = 'anon'),
         (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
       ))
     UNION ALL
     SELECT owners.proowner, a.grantee
     FROM owners
     JOIN pg_default_acl d
       ON d.defaclrole = owners.proowner
      AND d.defaclnamespace = 'public'::regnamespace
      AND d.defaclobjtype = 'f'
     CROSS JOIN LATERAL aclexplode(d.defaclacl) a
     WHERE a.privilege_type = 'EXECUTE'
       AND (a.grantee = 0 OR a.grantee IN (
         (SELECT oid FROM pg_roles WHERE rolname = 'anon'),
         (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
       ))
   ) SELECT count(*) FROM forbidden_defaults),
  0::bigint,
  'les privilèges par défaut interdisent les futures RPC aux clients'
);
SELECT is(
  (SELECT count(*)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
     AND NOT EXISTS (
       SELECT 1 FROM public.snp_rpc_execution_allowlist a
       WHERE a.function_signature = p.oid::regprocedure::text
         AND a.grantee = 'authenticated'
     )),
  0::bigint,
  'authenticated ne possède aucun grant SECURITY DEFINER hors registre'
);
SELECT is(
  (SELECT count(*) FROM public.snp_rpc_execution_allowlist a
   WHERE NOT has_function_privilege(
     a.grantee, ('public.' || a.function_signature)::regprocedure, 'EXECUTE'
   )),
  0::bigint,
  'chaque entrée du registre correspond à un grant effectif'
);
SELECT is(
  (SELECT count(*)
   FROM public.snp_rpc_execution_allowlist a
   JOIN pg_proc p ON p.oid = ('public.' || a.function_signature)::regprocedure
   WHERE NOT EXISTS (
     SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) setting
     WHERE setting LIKE 'search_path=pg_catalog, public, auth, storage, extensions, pg_temp%'
   )),
  0::bigint,
  'toute RPC allowlistée possède le search_path canonique'
);
SELECT is(
  (SELECT count(DISTINCT function_name)
   FROM public.snp_rpc_execution_allowlist),
  115::bigint,
  'le registre contient les 115 noms explicitement audités'
);
SELECT is(
  (SELECT count(DISTINCT function_name)
   FROM public.snp_rpc_execution_allowlist
   WHERE purpose = 'runtime-browser'),
  75::bigint,
  'les 75 noms SECURITY DEFINER consommés par src sont inventoriés'
);
SELECT is(
  (SELECT count(DISTINCT function_name)
   FROM public.snp_rpc_execution_allowlist
   WHERE purpose = 'rls-policy-helper'),
  20::bigint,
  'les 20 helpers RLS supplémentaires restent appelables'
);
SELECT is(
  (SELECT count(DISTINCT function_name)
   FROM public.snp_rpc_execution_allowlist
   WHERE purpose = 'p0-contract'),
  20::bigint,
  'les 20 contrats P0 supplémentaires restent appelables'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p
   WHERE p.oid IN (
     'public.auto_allocate_inventory(uuid,numeric)'::regprocedure,
     'public.generate_activation_token(uuid,text,text,uuid)'::regprocedure,
     'public.get_certificate_with_data(uuid)'::regprocedure
   ) AND has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0::bigint,
  'les RPC administratives non consommées restent révoquées'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND (p.proname LIKE 'trigger\_%' ESCAPE '\'
          OR p.proname LIKE '%\_trigger' ESCAPE '\')
     AND p.prosecdef
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0::bigint,
  'les fonctions de trigger ne sont plus des RPC navigateur'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p
   WHERE p.oid IN (
     'public.snp_configuration_courriel_active()'::regprocedure,
     'public.snp_courriels_a_envoyer(integer)'::regprocedure,
     'public.snp_consigner_envoi_courriel(uuid,boolean,text)'::regprocedure,
     'public.snp_consigner_verification_courriel(uuid,boolean,text)'::regprocedure
   ) AND has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0::bigint,
  'les RPC Edge de courriel ne sont pas exposées au navigateur'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.snp_transition_shipping_preparation(uuid,public.shipping_preparation_status,public.shipping_preparation_status)',
    'EXECUTE'
  ),
  'la transition Shipping P0 reste exposée à authenticated'
);
SELECT ok(
  has_function_privilege(
    'authenticated', 'public.reserve_license_quota(uuid,uuid,numeric,uuid)', 'EXECUTE'
  ),
  'la réservation de quota P0 reste exposée à authenticated'
);
SELECT ok(
  has_function_privilege(
    'authenticated', 'public.snp_configurations_courriel()', 'EXECUTE'
  ),
  'la façade SMTP P0 reste exposée sous son contrôle interne'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p
   WHERE p.oid IN (
     'public.check_license_availability(uuid,numeric)'::regprocedure,
     'public.check_sale_authorization(uuid,uuid,numeric,numeric)'::regprocedure,
     'public.convert_virtual_to_actual_payment(uuid,date,text,text,text,text,numeric,text,text,uuid)'::regprocedure,
     'public.get_authorized_customers_for_mine(uuid)'::regprocedure,
     'public.get_next_expedition_lot_number(uuid,integer)'::regprocedure,
     'public.get_user_modules(uuid)'::regprocedure,
     'public.log_security_event(uuid,text,text,text,jsonb)'::regprocedure,
     'public.log_user_activity(uuid,text,text,text,uuid,text,jsonb,text,text)'::regprocedure
   ) AND has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  8::bigint,
  'les huit RPC prioritaires durcies restent compatibles côté authenticated'
);
SELECT ok(
  has_function_privilege(
    'service_role', 'public.consume_activation_token(text,timestamptz)', 'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon', 'public.consume_activation_token(text,timestamptz)', 'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated', 'public.consume_activation_token(text,timestamptz)', 'EXECUTE'
  ),
  'consume_activation_token est strictement service-role-only'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'security_events'
      AND indexname = 'idx_security_events_event_ip_created'
      AND indexdef LIKE '%(event_type, ip_address, created_at DESC)%'
  ),
  'security_events possède l’index composite de contrôle anti-abus'
);
SELECT is(
  (SELECT array_agg(parameter_name::text ORDER BY ordinal_position)
   FROM information_schema.parameters
   WHERE specific_schema = 'public'
     AND specific_name = (
       SELECT p.proname || '_' || p.oid
       FROM pg_proc p
       WHERE p.oid = 'public.consume_activation_token(text,timestamptz)'::regprocedure
     )
     AND parameter_mode IN ('OUT', 'INOUT', 'TABLE')),
  ARRAY['user_id', 'token_type']::text[],
  'la RPC retourne seulement user_id et token_type'
);
SELECT ok(
  position(
    'temporary_password' IN lower(pg_get_functiondef(
      'public.consume_activation_token(text,timestamptz)'::regprocedure
    ))
  ) = 0,
  'la RPC ne lit jamais temporary_password'
);

-- Fixtures multi-profils ----------------------------------------------------
SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);

INSERT INTO auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('63000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rpc-mine-a@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('63000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rpc-mine-b@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('63000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rpc-manager@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('63000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rpc-finance@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('63000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rpc-admin@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('63000000-0000-4000-8000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rpc-service@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.mining_companies(
  id, code, name, abbreviation, country, company_type, is_active
) VALUES
  ('63000000-0000-4000-8000-000000000101', 'RPC-MINE-A', 'RPC Mine A', 'RMA', 'Burkina Faso', 'production_mine', true),
  ('63000000-0000-4000-8000-000000000102', 'RPC-MINE-B', 'RPC Mine B', 'RMB', 'Burkina Faso', 'production_mine', true);

INSERT INTO public.user_profiles(
  id, email, full_name, role, is_active, mining_company_id,
  mfa_enrolled_at, must_change_password
) VALUES
  ('63000000-0000-4000-8000-000000000001', 'rpc-mine-a@sonasp.invalid', 'RPC Mine A', 'mine', true, '63000000-0000-4000-8000-000000000101', now(), false),
  ('63000000-0000-4000-8000-000000000002', 'rpc-mine-b@sonasp.invalid', 'RPC Mine B', 'mine', true, '63000000-0000-4000-8000-000000000102', now(), false),
  ('63000000-0000-4000-8000-000000000003', 'rpc-manager@sonasp.invalid', 'RPC Manager', 'manager', true, NULL, now(), false),
  ('63000000-0000-4000-8000-000000000004', 'rpc-finance@sonasp.invalid', 'RPC Finance', 'management', true, NULL, now(), false),
  ('63000000-0000-4000-8000-000000000005', 'rpc-admin@sonasp.invalid', 'RPC Admin', 'admin', true, NULL, now(), false),
  ('63000000-0000-4000-8000-000000000099', 'rpc-service@sonasp.invalid', 'RPC Service', 'admin', true, NULL, now(), false);

INSERT INTO public.export_licenses(
  id, license_number, mining_company_id, request_date, start_date, end_date,
  issuing_institution, authorized_quantity_grams, used_quantity_grams,
  remaining_quantity_grams, status
) VALUES (
  '63000000-0000-4000-8000-000000000201', 'RPC-LIC-A',
  '63000000-0000-4000-8000-000000000101', current_date,
  current_date, current_date + 30, 'Institution test', 1000, 0, 1000, 'active'
);

INSERT INTO public.user_activation_tokens(
  id, user_id, token, token_type, temporary_password,
  expires_at, used_at, created_by
) VALUES
  ('63000000-0000-4000-8000-000000000701', '63000000-0000-4000-8000-000000000001', 'rpc-valid-activation-token', 'activation', 'NEVER-RETURN-THIS', '2030-01-02T00:00:00Z', NULL, '63000000-0000-4000-8000-000000000099'),
  ('63000000-0000-4000-8000-000000000702', '63000000-0000-4000-8000-000000000002', 'rpc-expired-reset-token', 'password_reset', 'NEVER-RETURN-THIS', '2029-12-31T00:00:00Z', NULL, '63000000-0000-4000-8000-000000000099');

-- anon ----------------------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000001', 'anon', 'aal1'
);
SET LOCAL ROLE anon;
SELECT is(
  pg_temp.try_customers('63000000-0000-4000-8000-000000000101'),
  'ERR:42501', 'anon ne peut appeler une RPC tenant'
);
SELECT is(
  pg_temp.try_security_event('63000000-0000-4000-8000-000000000001'),
  'ERR:42501', 'anon ne peut injecter un événement de sécurité'
);
SELECT is(
  pg_temp.try_consume_activation_token(
    'rpc-valid-activation-token', '2030-01-01T00:00:00Z'
  ),
  'ERR:42501', 'anon ne consomme pas un jeton d’activation'
);
RESET ROLE;

-- Mine A AAL1 ---------------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000001', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_customers('63000000-0000-4000-8000-000000000101'),
  'ERR:42501', 'AAL1 ne consulte pas les paramètres de vente tenant'
);
SELECT is(
  pg_temp.try_license('63000000-0000-4000-8000-000000000201'),
  'ERR:42501', 'AAL1 ne consulte pas le quota de licence'
);
SELECT is(
  pg_temp.try_lot('63000000-0000-4000-8000-000000000101'),
  'ERR:42501', 'AAL1 ne consomme pas un numéro de lot'
);
SELECT is(
  pg_temp.try_sale_authorization('63000000-0000-4000-8000-000000000101'),
  'ERR:42501', 'AAL1 ne consulte pas la décision de vente'
);
RESET ROLE;

-- Mine A AAL2 ---------------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_customers('63000000-0000-4000-8000-000000000101'),
  'OK:0', 'la Mine A consulte uniquement son périmètre de clients'
);
SELECT is(
  pg_temp.try_license('63000000-0000-4000-8000-000000000201'),
  'OK:true', 'la Mine A consulte sa propre licence active'
);
SELECT is(
  pg_temp.try_sale_authorization('63000000-0000-4000-8000-000000000101'),
  'OK:true', 'la Mine A évalue une vente dans son tenant'
);
SELECT ok(
  pg_temp.try_lot('63000000-0000-4000-8000-000000000101')
    LIKE 'OK:HUM-RMA-%',
  'mine.operate AAL2 consomme un numéro de lot de son tenant'
);
SELECT is(
  pg_temp.try_security_event('63000000-0000-4000-8000-000000000002'),
  'ERR:42501', 'une mine ne forge pas le journal au nom d’une autre mine'
);
SELECT is(
  pg_temp.try_security_event('63000000-0000-4000-8000-000000000001'),
  'OK', 'une mine journalise son propre événement'
);
SELECT is(
  (SELECT user_id FROM public.security_events
   WHERE event_type = 'RPC_DENY_DEFAULT_TEST'
   ORDER BY created_at DESC LIMIT 1),
  '63000000-0000-4000-8000-000000000001'::uuid,
  'l’acteur du journal de sécurité est dérivé du JWT'
);
SELECT is(
  pg_temp.try_activity('63000000-0000-4000-8000-000000000002'),
  'ERR:42501', 'une mine ne forge pas une activité au nom d’une autre mine'
);
SELECT ok(
  pg_temp.try_activity('63000000-0000-4000-8000-000000000001') LIKE 'OK:%',
  'une mine journalise sa propre activité'
);
SELECT is(
  (SELECT user_id FROM public.user_activity_logs
   WHERE module_name = 'rpc-security'
   ORDER BY created_at DESC LIMIT 1),
  '63000000-0000-4000-8000-000000000001'::uuid,
  'l’acteur du journal d’activité est dérivé du JWT'
);
SELECT is(
  pg_temp.try_modules('63000000-0000-4000-8000-000000000001'),
  'OK', 'un utilisateur consulte ses propres modules'
);
SELECT is(
  pg_temp.try_modules('63000000-0000-4000-8000-000000000002'),
  'ERR:42501', 'une mine sans accounts.manage ne consulte pas un autre compte'
);
RESET ROLE;

-- Mine B : refus croisé -----------------------------------------------------
SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_customers('63000000-0000-4000-8000-000000000101'),
  'ERR:42501', 'la Mine B ne consulte pas les paramètres de la Mine A'
);
SELECT is(
  pg_temp.try_license('63000000-0000-4000-8000-000000000201'),
  'OK:false', 'la licence de la Mine A est indistinguable d’une licence absente pour B'
);
SELECT is(
  pg_temp.try_lot('63000000-0000-4000-8000-000000000101'),
  'ERR:42501', 'la Mine B ne consomme pas le compteur de la Mine A'
);
SELECT is(
  pg_temp.try_sale_authorization('63000000-0000-4000-8000-000000000101'),
  'ERR:42501', 'la Mine B n’évalue pas une vente de la Mine A'
);
RESET ROLE;

-- Capacité finance et administration ---------------------------------------
SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_convert_payment('63000000-0000-4000-8000-000000000003'),
  'ERR:42501', 'authenticated AAL2 sans capacité finance ne convertit pas un paiement'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000004', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_convert_payment('63000000-0000-4000-8000-000000000004'),
  'ERR:42501', 'sonasp.finance.execute sous AAL1 reste refusée'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000004', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_convert_payment('63000000-0000-4000-8000-000000000003'),
  'ERR:42501', 'la capacité finance ne permet pas d’usurper converted_by'
);
SELECT is(
  pg_temp.try_convert_payment('63000000-0000-4000-8000-000000000004'),
  'ERR:P0002', 'la finance AAL2 franchit l’autorisation puis vérifie le paiement'
);
SELECT is(
  pg_temp.try_consume_activation_token(
    'rpc-valid-activation-token', '2030-01-01T00:00:00Z'
  ),
  'ERR:42501', 'authenticated ne consomme jamais un jeton via la RPC Edge'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000005', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_modules('63000000-0000-4000-8000-000000000001'),
  'OK', 'accounts.manage AAL2 permet la consultation inter-compte'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '63000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);
SET LOCAL ROLE service_role;
SELECT is(
  pg_temp.try_consume_activation_token(
    'rpc-valid-activation-token', '2030-01-01T00:00:00Z'
  ),
  'OK:1:63000000-0000-4000-8000-000000000001:activation',
  'service_role consomme atomiquement un jeton valide'
);
SELECT is(
  pg_temp.try_consume_activation_token(
    'rpc-valid-activation-token', '2030-01-01T00:00:00Z'
  ),
  'OK:0:-:-', 'une seconde consommation est idempotente et sans résultat'
);
SELECT is(
  pg_temp.try_consume_activation_token(
    'rpc-expired-reset-token', '2030-01-01T00:00:00Z'
  ),
  'OK:0:-:-', 'un jeton expiré n’est pas consommé'
);
RESET ROLE;
SELECT is(
  (SELECT used_at FROM public.user_activation_tokens
   WHERE token = 'rpc-valid-activation-token'),
  '2030-01-01T00:00:00Z'::timestamptz,
  'used_at reçoit exactement l’horodatage atomique fourni'
);
SELECT is(
  (SELECT used_at FROM public.user_activation_tokens
   WHERE token = 'rpc-expired-reset-token'),
  NULL::timestamptz,
  'un jeton expiré reste inutilisé'
);

SELECT * FROM finish();
ROLLBACK;
