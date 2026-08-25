BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

SELECT plan(40);

SELECT ok(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='user_profiles' AND column_name='version'
    AND is_nullable='NO'),'version optimiste profil presente et non nulle');
SELECT ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.user_profiles'::regclass
  AND conname='user_profiles_version_nonnegative' AND convalidated),
  'contrainte version profil validee');
SELECT ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.user_profiles'::regclass
  AND tgname='snp_2m_versionner_profil_securite' AND NOT tgisinternal),
  'trigger version/statut canonique installe');

SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
  WHERE oid='public.snp_account_lifecycle_audit'::regclass),'audit lifecycle FORCE RLS');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='snp_account_lifecycle_audit'
    AND grantee IN('anon','authenticated')
    AND privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE')),0::bigint,
  'aucun DML client audit lifecycle');
SELECT is((SELECT count(*) FROM pg_constraint
  WHERE conrelid='public.snp_account_lifecycle_audit'::regclass AND contype='f'),0::bigint,
  'audit lifecycle conserve acteurs/cibles comme snapshots sans FK destructive');
SELECT ok((SELECT prosecdef AND provolatile='v' FROM pg_proc WHERE oid=
  'public.snp_2m_can_read_lifecycle_audit()'::regprocedure),
  'lecture audit encapsule la garde session dans un helper SECURITY DEFINER');
SELECT ok(position('p.mining_company_id IS NULL' IN pg_get_functiondef(
  'public.snp_2m_can_read_lifecycle_audit()'::regprocedure))>0
  AND position('lower(p.role) IN' IN pg_get_functiondef(
  'public.snp_2m_can_read_lifecycle_audit()'::regprocedure))>0,
  'lecture audit revalide Owner/Admin national actif');
SELECT ok(position('snp_2m_can_read_lifecycle_audit' IN coalesce((SELECT qual FROM pg_policies
  WHERE schemaname='public' AND tablename='snp_account_lifecycle_audit'
    AND policyname='snp_account_lifecycle_audit_read'),''))>0,
  'policy audit emploie la garde canonique executable');
SELECT is((SELECT count(*) FROM pg_class
  WHERE oid IN('public.snp_comptes_audit'::regclass,'public.snp_account_admin_audit'::regclass)
    AND relrowsecurity AND relforcerowsecurity),2::bigint,
  'journaux comptes historiques sous FORCE RLS');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public'
    AND table_name IN('snp_comptes_audit','snp_account_admin_audit')
    AND grantee='service_role' AND privilege_type='SELECT'),2::bigint,
  'service_role conserve seulement la lecture historique explicite');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public'
    AND table_name IN('snp_comptes_audit','snp_account_admin_audit')
    AND grantee IN('anon','authenticated')
    AND privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE')),0::bigint,
  'aucun DML client sur journaux comptes historiques');
SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN('snp_comptes_audit','snp_account_admin_audit')
    AND cmd='SELECT' AND qual LIKE '%snp_2m_can_read_lifecycle_audit%'),2::bigint,
  'policies historiques utilisent exclusivement la garde 2M');

SELECT ok((SELECT prosecdef AND provolatile='v' FROM pg_proc WHERE oid=
  'public.snp_admin_compte_definir_statut(uuid,bigint,boolean,text,uuid)'::regprocedure),
  'RPC statut SECURITY DEFINER volatile');
SELECT ok((SELECT prosecdef AND provolatile='v' FROM pg_proc WHERE oid=
  'public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)'::regprocedure),
  'RPC preparation suppression SECURITY DEFINER volatile');
SELECT ok((SELECT prosecdef AND provolatile='v' FROM pg_proc WHERE oid=
  'public.snp_admin_compte_finaliser_action(uuid,boolean,text)'::regprocedure),
  'RPC finalisation SECURITY DEFINER volatile');

SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public' AND routine_name='snp_admin_compte_definir_statut'
    AND grantee='authenticated' AND privilege_type='EXECUTE'),1::bigint,
  'statut expose seulement authenticated');
SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public' AND routine_name='snp_admin_compte_preparer_suppression'
    AND grantee='authenticated' AND privilege_type='EXECUTE'),1::bigint,
  'preparation suppression exposee seulement authenticated');
SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public' AND routine_name='snp_admin_compte_finaliser_action'
    AND grantee='service_role' AND privilege_type='EXECUTE'),1::bigint,
  'finalisation exposee seulement service_role');
SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public'
    AND routine_name IN('snp_admin_compte_definir_statut','snp_admin_compte_preparer_suppression')
    AND grantee IN('PUBLIC','anon')),0::bigint,'aucun RPC mutation expose anon/PUBLIC');

SELECT ok(position('snp_require_capability(''accounts.manage'')' IN pg_get_functiondef(
  'public.snp_2m_require_account_admin()'::regprocedure))>0,
  'garde exige accounts.manage et session 4C');
SELECT ok(position('snp_mfa_satisfaite' IN pg_get_functiondef(
  'public.snp_2m_require_account_admin()'::regprocedure))>0,
  'garde exige explicitement AAL2');
SELECT ok(position('FOR UPDATE' IN pg_get_functiondef(
  'public.snp_2m_assert_target(uuid,bigint,text,boolean)'::regprocedure))>0,
  'cible verrouillee en base');
SELECT ok(position('v_target.version<>p_expected_version' IN replace(pg_get_functiondef(
  'public.snp_2m_assert_target(uuid,bigint,text,boolean)'::regprocedure),' ',''))>0,
  'version cible verifiee');
SELECT ok(position('p_actor_role=''admin''' IN replace(pg_get_functiondef(
  'public.snp_2m_assert_target(uuid,bigint,text,boolean)'::regprocedure),' ',''))>0,
  'Admin ne peut pas cibler un pair Admin');

SELECT ok(position('snp_sessions_revoquer_toutes' IN pg_get_functiondef(
  'public.snp_admin_compte_definir_statut(uuid,bigint,boolean,text,uuid)'::regprocedure))>0,
  'desactivation revoque atomiquement le registre de sessions');
SELECT ok(position('snp_account_lifecycle_audit' IN pg_get_functiondef(
  'public.snp_admin_compte_definir_statut(uuid,bigint,boolean,text,uuid)'::regprocedure))>0,
  'statut audite avant mutation');
SELECT ok(position('pg_advisory_xact_lock' IN pg_get_functiondef(
  'public.snp_admin_compte_definir_statut(uuid,bigint,boolean,text,uuid)'::regprocedure))>0,
  'statut idempotent serialise');
SELECT ok(position('v_previous_status_guc' IN pg_get_functiondef(
  'public.snp_admin_compte_definir_statut(uuid,bigint,boolean,text,uuid)'::regprocedure))>0
  AND position('set_config(''snp.account_status_rpc''' IN pg_get_functiondef(
  'public.snp_admin_compte_definir_statut(uuid,bigint,boolean,text,uuid)'::regprocedure))>0,
  'marqueur interne de statut restaure dans la transaction');
SELECT ok(position('INSERT INTO public.snp_comptes_audit' IN pg_get_functiondef(
  'public.snp_admin_compte_definir_statut(uuid,bigint,boolean,text,uuid)'::regprocedure))>0,
  'historique statut compatible UI écrit par le RPC canonique');
SELECT ok(position('snp_2m_account_business_activity' IN pg_get_functiondef(
  'public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)'::regprocedure))>0,
  'suppression exige absence activite autoritative');
SELECT ok(position('v_actor_role,false' IN regexp_replace(lower(pg_get_functiondef(
  'public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)'::regprocedure)),'\s+','','g'))>0
  AND position('setis_active=false' IN regexp_replace(lower(pg_get_functiondef(
  'public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)'::regprocedure)),'\s+','','g'))>0,
  'suppression désactive atomiquement une cible éligible');
SELECT ok(position('v_action.status<>''db_completed''' IN replace(pg_get_functiondef(
  'public.snp_admin_compte_finaliser_action(uuid,boolean,text)'::regprocedure),' ',''))>0,
  'finalisation monotone depuis db_completed');

SELECT ok(EXISTS(SELECT 1 FROM public.snp_account_deletion_dependency_registry
  WHERE column_name='assigned_to' AND classification='blocking'),
  'assigned_to est une dependance bloquante');
SELECT ok(EXISTS(SELECT 1 FROM public.snp_account_deletion_dependency_registry
  WHERE column_name='cancelled_by' AND classification='blocking'),
  'cancelled_by est une dependance bloquante');
SELECT is((SELECT count(*) FROM information_schema.columns
  WHERE table_schema='public' AND table_name='snp_account_deletion_dependency_registry'
    AND column_name IN('constraint_name','referenced_schema_name','referenced_table_name',
      'referenced_column_name','delete_action')),5::bigint,
  'manifeste conserve identité parent et action ON DELETE exactes');
SELECT ok((SELECT prosecdef AND provolatile='s' FROM pg_proc WHERE oid=
  'public.snp_2m_current_dependency_inventory()'::regprocedure),
  'inventaire déterministe encapsulé et non exposé');
SELECT ok(position('55000' IN pg_get_functiondef(
  'public.snp_2m_assert_dependency_registry_complete()'::regprocedure))>0,
  'nouvelle dependance inconnue fait echouer la suppression');
SELECT ok(position('delete_action IS DISTINCT FROM' IN pg_get_functiondef(
  'public.snp_2m_assert_dependency_registry_complete()'::regprocedure))>0,
  'dérive identité ou ON DELETE ferme le contrat');
SELECT is((SELECT count(*) FROM pg_constraint con
  JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE con.contype='f' AND n.nspname='public'
    AND c.relname IN('snp_account_admin_audit','snp_comptes_audit')
    AND con.confdeltype='c'),0::bigint,'aucun CASCADE sur journaux comptes historiques');

SELECT * FROM finish();
ROLLBACK;
