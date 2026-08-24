BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_session_claims(
  p_sub uuid,p_role text,p_aal text,p_session_id text,p_exp_offset integer DEFAULT 3600
)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_claims jsonb;
BEGIN
  v_claims:=jsonb_build_object(
    'sub',p_sub,'role',p_role,'aal',p_aal,'session_id',p_session_id,
    'exp',floor(extract(epoch FROM clock_timestamp()))::bigint+p_exp_offset
  );
  PERFORM set_config('request.jwt.claim.sub',coalesce(p_sub::text,''),true);
  PERFORM set_config('request.jwt.claim.role',coalesce(p_role,''),true);
  PERFORM set_config('request.jwt.claims',v_claims::text,true);
  PERFORM set_config(
    'request.headers',
    jsonb_build_object('x-forwarded-for','203.0.113.42, 10.0.0.1')::text,true
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_register(
  p_country text DEFAULT 'BF'
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_session_public;
BEGIN
  v:=public.snp_session_enregistrer('Mozilla test 4C','desktop','Firefox',p_country);
  RETURN 'OK:'||v.id||':'||v.is_current;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_heartbeat()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_session_public;
BEGIN
  v:=public.snp_session_signaler_activite();
  RETURN 'OK:'||v.id||':'||v.is_current;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_list(p_user uuid,p_active boolean DEFAULT true)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.snp_sessions_lister(p_user,p_active);
  RETURN 'OK:'||v_count;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_revoke(p_id uuid,p_reason text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_session_public;
BEGIN
  v:=public.snp_session_revoquer(p_id,p_reason);
  RETURN 'OK:'||v.is_active||':'||(v.revoked_at IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_revoke_all(
  p_user uuid,p_except_current boolean,p_reason text DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count integer;
BEGIN
  v_count:=public.snp_sessions_revoquer_toutes(p_user,p_except_current,p_reason);
  RETURN 'OK:'||v_count;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_select()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.user_sessions;
  RETURN 'OK:'||v_count;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_insert(p_user uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.user_sessions(user_id,token_hash,expires_at)
  VALUES(p_user,extensions.digest('forged','sha256'),now()+interval '1 hour');
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_require_capability(p_capability text)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM public.snp_require_capability(p_capability);
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.session_id_for_test(p_session_id text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','extensions','pg_temp' AS $fn$
  SELECT id FROM public.user_sessions
  WHERE token_hash=extensions.digest(p_session_id,'sha256');
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC;

SELECT plan(71);

-- Contrat structurel -------------------------------------------------------
SELECT ok(NOT EXISTS(
  SELECT 1 FROM pg_attribute WHERE attrelid='public.user_sessions'::regclass
    AND attname='session_token' AND attnum>0 AND NOT attisdropped
),'aucun token de session en clair ne subsiste');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_attribute WHERE attrelid='public.user_sessions'::regclass
    AND attname='token_hash' AND atttypid='bytea'::regtype AND attnotnull
),'le hash binaire est obligatoire');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint WHERE conrelid='public.user_sessions'::regclass
    AND conname='user_sessions_token_hash_key' AND contype='u'
),'le hash est unique');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint WHERE conrelid='public.user_sessions'::regclass
    AND conname='user_sessions_token_hash_length_check' AND convalidated
),'la longueur SHA-256 est validée');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE oid='public.user_sessions'::regclass),true,
  'RLS est activée');
SELECT is((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.user_sessions'::regclass),true,
  'RLS est forcée');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename='user_sessions'),3::bigint,'trois policies canoniques seulement');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='user_sessions'
    AND grantee IN ('anon','authenticated')),0::bigint,'aucun grant table client');
SELECT is((SELECT count(*) FROM pg_indexes WHERE schemaname='public'
  AND tablename='user_sessions' AND indexname IN(
    'idx_user_sessions_user_activity','idx_user_sessions_active_expiry'
  )),2::bigint,'les deux index runtime existent');
SELECT is((SELECT count(*) FROM pg_attribute a JOIN pg_type t ON t.typrelid=a.attrelid
  WHERE t.oid='public.snp_session_public'::regtype AND a.attnum>0 AND NOT a.attisdropped),
  15::bigint,'le type public expurgé a quinze champs');
SELECT ok(NOT EXISTS(
  SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.typrelid=a.attrelid
  WHERE t.oid='public.snp_session_public'::regtype AND a.attnum>0
    AND a.attname IN('token_hash','session_token')
),'le type RPC ne contient aucun token/hash');

SELECT is((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN(
    'snp_session_enregistrer','snp_session_signaler_activite','snp_sessions_lister',
    'snp_session_revoquer','snp_sessions_revoquer_toutes'
  )),5::bigint,'les cinq RPC sessions existent');
SELECT ok(has_function_privilege('authenticated',
  'public.snp_session_enregistrer(text,text,text,text)','EXECUTE'),
  'authenticated appelle register');
SELECT ok(has_function_privilege('authenticated',
  'public.snp_sessions_lister(uuid,boolean)','EXECUTE'),
  'authenticated appelle list derrière la garde');
SELECT ok(NOT has_function_privilege('anon',
  'public.snp_session_enregistrer(text,text,text,text)','EXECUTE'),
  'anon ne peut enregistrer une session');
SELECT ok(NOT has_function_privilege('anon',
  'public.snp_session_revoquer(uuid,text)','EXECUTE'),
  'anon ne révoque aucune session');
SELECT is((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN(
    'snp_session_current_hash','snp_session_to_public','snp_session_request_ip',
    'snp_session_current_expiry','snp_session_require_access'
  ) AND has_function_privilege('authenticated',p.oid,'EXECUTE')),0::bigint,
  'les helpers porteurs de données restent privés');
SELECT ok(pg_get_functiondef('public.snp_require_capability(text)'::regprocedure)
  LIKE '%snp_require_active_session%',
  'la garde capability impose une session applicative active');

-- Lint/API historique ------------------------------------------------------
SELECT is((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN(
    'add_audit_fields','calculate_commission','calculate_forward_price',
    'check_approval_escalations','check_inventory_available','determine_best_fx_rate',
    'determine_best_rate','get_allowed_customers_for_seller','get_available_inventory',
    'get_next_possible_statuses','get_recommended_mechanism','is_valid_customer_for_seller',
    'search_audit_by_date','snp_essai_modules_contractuels','trigger_daily_fx_update',
    'trigger_monthly_fx_aggregation','user_has_permission','validate_status_transition'
  )),0::bigint,'les routines mortes/cassées sont retirées');
SELECT ok(to_regprocedure('public.user_accessible_companies()') IS NOT NULL,
  'le helper encore utilisé par les policies est conservé');
SELECT ok(to_regprocedure('public.user_has_company_access(uuid)') IS NOT NULL,
  'le helper company access est corrigé');
SELECT is((SELECT provolatile::text FROM pg_proc WHERE oid='public.snp_require_capability(text)'::regprocedure),
  'v'::text,'snp_require_capability est VOLATILE');
SELECT is((SELECT provolatile::text FROM pg_proc WHERE oid='public.snp_encoder_instant_carte(timestamptz)'::regprocedure),
  's'::text,'l’encodage timestamptz est STABLE');
SELECT is((SELECT provolatile::text FROM pg_proc WHERE oid='public.snp_comptoir_stock_balance(uuid)'::regprocedure),
  'v'::text,'le solde comptoir reflète ses gardes volatiles');
SELECT is((SELECT provolatile::text FROM pg_proc WHERE oid='public.snp_configurations_courriel()'::regprocedure),
  'v'::text,'la configuration courriel reflète sa garde volatile');
SELECT is((SELECT provolatile::text FROM pg_proc WHERE oid='public.snp_societe_compte_mine()'::regprocedure),
  'v'::text,'le résolveur Mine reflète sa garde volatile');
SELECT is((SELECT provolatile::text FROM pg_proc WHERE oid='public.snp_stock_exportable_mine()'::regprocedure),
  'v'::text,'le stock exportable reflète le résolveur volatile');
SELECT is((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosrc~'eyJhbGciOiJIUzI1Ni'),0::bigint,
  'aucun JWT hardcodé ne subsiste dans public');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.generate_activation_token(uuid,text,text,uuid)','EXECUTE'),
  'la génération activation historique reste révoquée');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.auto_allocate_inventory(uuid,numeric)','EXECUTE'),
  'l’allocation historique cassée reste révoquée');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.get_certificate_with_data(uuid)','EXECUTE'),
  'la lecture certificat historique reste révoquée');

-- Fixtures ----------------------------------------------------------------
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000099','service_role','aal2','4c-service'
);

INSERT INTO auth.users(
  id,instance_id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) VALUES
 ('4c000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4c-user-a@sonasp.invalid','','{}','{}',now(),now()),
 ('4c000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4c-user-b@sonasp.invalid','','{}','{}',now(),now()),
 ('4c000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4c-admin@sonasp.invalid','','{}','{}',now(),now()),
 ('4c000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4c-inactive@sonasp.invalid','','{}','{}',now(),now()),
 ('4c000000-0000-4000-8000-000000000099','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4c-service@sonasp.invalid','','{}','{}',now(),now());

INSERT INTO public.mining_companies(id,code,name,country,company_type,is_active) VALUES
 ('4c000000-0000-4000-8000-000000000101','4C-MINE-A','Mine A 4C','Burkina Faso','production_mine',true),
 ('4c000000-0000-4000-8000-000000000102','4C-MINE-B','Mine B 4C','Burkina Faso','production_mine',true);

INSERT INTO public.user_profiles(
  id,email,full_name,role,is_active,mining_company_id,mfa_enrolled_at,must_change_password
) VALUES
 ('4c000000-0000-4000-8000-000000000001','4c-user-a@sonasp.invalid','Utilisateur A','mine',true,'4c000000-0000-4000-8000-000000000101',now(),false),
 ('4c000000-0000-4000-8000-000000000002','4c-user-b@sonasp.invalid','Utilisateur B','mine',true,'4c000000-0000-4000-8000-000000000102',now(),false),
 ('4c000000-0000-4000-8000-000000000003','4c-admin@sonasp.invalid','Administrateur','admin',true,NULL,now(),false),
 ('4c000000-0000-4000-8000-000000000004','4c-inactive@sonasp.invalid','Compte inactif','manager',false,NULL,now(),false),
 ('4c000000-0000-4000-8000-000000000099','4c-service@sonasp.invalid','Service','admin',true,NULL,now(),false);

-- Register AAL1 : autorisé après login et profil actif ---------------------
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000001','authenticated','aal1','4c-session-a1'
);
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.try_register() LIKE 'OK:%:true','register AAL1 crée la session courante');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.user_sessions
  WHERE user_id='4c000000-0000-4000-8000-000000000001'),1::bigint,
  'une seule ligne est créée');
SELECT is((SELECT octet_length(token_hash) FROM public.user_sessions
  WHERE user_id='4c000000-0000-4000-8000-000000000001'),32,
  'le hash stocké mesure 32 octets');
SELECT is((SELECT token_hash FROM public.user_sessions
  WHERE user_id='4c000000-0000-4000-8000-000000000001'),
  extensions.digest('4c-session-a1','sha256'),'le hash vient du claim session_id');
SELECT is((SELECT ip_address FROM public.user_sessions
  WHERE user_id='4c000000-0000-4000-8000-000000000001'),
  '203.0.113.42','l’IP vient des headers serveur');
SELECT ok((SELECT expires_at<=now()+interval '10 minutes 2 seconds'
  AND expires_at>now() FROM public.user_sessions
  WHERE user_id='4c000000-0000-4000-8000-000000000001'),
  'l’expiration est bornée à dix minutes');

SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_list(NULL,true),'ERR:42501','AAL1 ne liste pas les sessions');
SELECT is(pg_temp.try_direct_select(),'ERR:42501','aucun SELECT table direct');
SELECT is(pg_temp.try_direct_insert('4c000000-0000-4000-8000-000000000001'),
  'ERR:42501','aucun INSERT table direct');
RESET ROLE;

-- AAL2 self et heartbeat ---------------------------------------------------
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000001','authenticated','aal2','4c-session-a1'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_list(NULL,true),'OK:1','AAL2 liste sa session active');
SELECT ok(pg_temp.try_heartbeat() LIKE 'OK:%:true','heartbeat retrouve la session courante');
RESET ROLE;

UPDATE public.user_sessions SET last_activity_at=now()-interval '1 minute'
WHERE user_id='4c000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.try_heartbeat() LIKE 'OK:%:true','heartbeat met à jour après coalescence');
RESET ROLE;
SELECT ok((SELECT last_activity_at>now()-interval '5 seconds' FROM public.user_sessions
  WHERE user_id='4c000000-0000-4000-8000-000000000001'),
  'activité serveur actualisée');

-- Deuxième session et isolation B -----------------------------------------
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000001','authenticated','aal2','4c-session-a2'
);
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.try_register() LIKE 'OK:%:true','une nouvelle session_id crée une deuxième ligne');
SELECT is(pg_temp.try_list(NULL,true),'OK:2','A voit ses deux sessions');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.user_sessions
  WHERE user_id='4c000000-0000-4000-8000-000000000001'),2::bigint,
  'les deux empreintes sont distinctes');

SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000002','authenticated','aal1','4c-session-b1'
);
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.try_register() LIKE 'OK:%:true','B enregistre sa propre session');
RESET ROLE;
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000002','authenticated','aal2','4c-session-b1'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_list('4c000000-0000-4000-8000-000000000001',true),
  'ERR:42501','B ne liste pas les sessions de A');
SELECT is(pg_temp.try_revoke(pg_temp.session_id_for_test('4c-session-a1'),
  'Tentative inter-compte interdite'),
  'ERR:42501','B ne révoque pas la session de A');
RESET ROLE;

-- Admin : AAL2 + accounts.manage + motif ----------------------------------
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000003','authenticated','aal1','4c-session-admin'
);
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.try_register() LIKE 'OK:%:true','admin enregistre sa session à AAL1');
SELECT is(pg_temp.try_list('4c000000-0000-4000-8000-000000000001',true),
  'ERR:42501','admin AAL1 ne bénéficie pas de accounts.manage sensible');
RESET ROLE;
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000003','authenticated','aal2','4c-session-admin'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_list('4c000000-0000-4000-8000-000000000001',true),
  'OK:2','admin AAL2 liste la cible');
SELECT is(pg_temp.try_revoke(pg_temp.session_id_for_test('4c-session-a1'),'court'),
  'ERR:22023','révocation tierce exige un motif long');
SELECT is(pg_temp.try_revoke(pg_temp.session_id_for_test('4c-session-a1'),
  'Compromission confirmée du navigateur'),
  'OK:false:true','admin révoque avec double état cohérent');
RESET ROLE;
SELECT ok((SELECT NOT is_active AND revoked_at IS NOT NULL
  AND revoked_by='4c000000-0000-4000-8000-000000000003'
  FROM public.user_sessions WHERE token_hash=extensions.digest('4c-session-a1','sha256')),
  'acteur et révocation sont dérivés serveur');

-- Une empreinte révoquée ne ressuscite jamais ------------------------------
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000001','authenticated','aal2','4c-session-a1'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_register(),'ERR:42501','register ne réactive pas un hash révoqué');
SELECT is(pg_temp.try_heartbeat(),'ERR:42501','heartbeat refuse le hash révoqué');
SELECT is(pg_temp.try_require_capability('mine.operate'),'ERR:42501',
  'la garde capability refuse la session révoquée');
RESET ROLE;

-- Révocation de masse self, session courante exclue -----------------------
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000001','authenticated','aal2','4c-session-a3'
);
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.try_register() LIKE 'OK:%:true','A crée une troisième session distincte');
RESET ROLE;
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000001','authenticated','aal2','4c-session-a2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_revoke_all(NULL,true,'Nettoyage volontaire des autres sessions'),
  'OK:1','revoke-all exclut exactement la session courante');
SELECT is(pg_temp.try_list(NULL,true),'OK:1','une seule session active subsiste');
SELECT is(pg_temp.try_list(NULL,false),'OK:3','la liste historique conserve les révocations');
SELECT is(pg_temp.try_revoke(pg_temp.session_id_for_test('4c-session-a2'),NULL),
  'OK:false:true','self peut révoquer sa session courante');
SELECT is(pg_temp.try_register(),'ERR:42501','la session self révoquée ne ressuscite pas');
RESET ROLE;

SELECT is((SELECT count(*) FROM public.snp_workflow_audit
  WHERE aggregate_type IN('user-session','user-sessions')),
  3::bigint,'les trois opérations de révocation sont auditées');
SELECT ok(NOT EXISTS(
  SELECT 1 FROM public.snp_workflow_audit
  WHERE aggregate_type IN('user-session','user-sessions')
    AND (context::text LIKE '%4c-session-%' OR context::text LIKE '%token_hash%')
),'l’audit ne contient ni session_id ni hash');

-- Erreurs d’entrée et compte inactif --------------------------------------
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000004','authenticated','aal1','4c-inactive-session'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_register(),'ERR:42501','un profil inactif ne crée aucune session');
RESET ROLE;
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000002','authenticated','aal2','4c-new-invalid'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_register('BURKINA'),'ERR:22023','le code pays invalide est refusé');
RESET ROLE;
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000002','authenticated','aal2','x'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_register(),'ERR:22023','un session_id trop court est refusé');
RESET ROLE;
SELECT pg_temp.set_session_claims(
  '4c000000-0000-4000-8000-000000000002','authenticated','aal2','4c-expired-jwt',-5
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_register(),'ERR:42501','un JWT expiré est refusé');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
