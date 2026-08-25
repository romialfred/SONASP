BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_claims_2m(
  p_sub uuid,p_role text,p_aal text,p_session text
)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',coalesce(p_sub::text,''),true);
  PERFORM set_config('request.jwt.claim.role',coalesce(p_role,''),true);
  PERFORM set_config('request.jwt.claim.aal',coalesce(p_aal,''),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_sub,'role',p_role,'aal',p_aal,'session_id',p_session,
    'exp',floor(extract(epoch FROM clock_timestamp()))::bigint+3600
  )::text,true);
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_status_2m(
  p_target uuid,p_version bigint,p_active boolean,p_reason text,p_key uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_admin_compte_definir_statut(
    p_target,p_version,p_active,p_reason,p_key
  );
  RETURN 'OK:'||coalesce(v->>'status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_delete_2m(
  p_target uuid,p_version bigint,p_reason text,p_key uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_admin_compte_preparer_suppression(
    p_target,p_version,p_reason,p_key
  );
  RETURN 'OK:'||coalesce(v->>'status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_finalize_2m(
  p_key uuid,p_success boolean,p_error text
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_admin_compte_finaliser_action(p_key,p_success,p_error);
  RETURN 'OK:'||coalesce(v->>'status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_status_2m(p_target uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.user_profiles SET is_active=NOT is_active WHERE id=p_target;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_registry_2m()
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM public.snp_2m_assert_dependency_registry_complete();
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC;
SELECT plan(33);

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
('2d000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-2m@invalid.test','','{}','{}',now(),now()),
('2d000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-2m@invalid.test','','{}','{}',now(),now()),
('2d000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin2-2m@invalid.test','','{}','{}',now(),now()),
('2d000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','user-2m@invalid.test','','{}','{}',now(),now()),
('2d000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','blocked-2m@invalid.test','','{}','{}',now(),now()),
('2d000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','delete-2m@invalid.test','','{}','{}',now(),now()),
('2d000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cancelled-2m@invalid.test','','{}','{}',now(),now()),
('2d000000-0000-4000-8000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated','delegated-2m@invalid.test','','{}','{}',now(),now()),
('2d000000-0000-4000-8000-000000000009','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner2-2m@invalid.test','','{}','{}',now(),now());

INSERT INTO public.user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at) VALUES
('2d000000-0000-4000-8000-000000000001','owner-2m@invalid.test','Owner 2M','owner',true,now()),
('2d000000-0000-4000-8000-000000000002','admin-2m@invalid.test','Admin 2M','admin',true,now()),
('2d000000-0000-4000-8000-000000000003','admin2-2m@invalid.test','Admin pair 2M','admin',true,now()),
('2d000000-0000-4000-8000-000000000004','user-2m@invalid.test','User 2M','user',true,NULL),
('2d000000-0000-4000-8000-000000000005','blocked-2m@invalid.test','Blocked 2M','user',false,NULL),
('2d000000-0000-4000-8000-000000000006','delete-2m@invalid.test','Delete 2M','user',false,NULL),
('2d000000-0000-4000-8000-000000000007','cancelled-2m@invalid.test','Cancelled 2M','user',false,NULL),
('2d000000-0000-4000-8000-000000000008','delegated-2m@invalid.test','Delegated 2M','management',true,now()),
('2d000000-0000-4000-8000-000000000009','owner2-2m@invalid.test','Owner pair 2M','owner',true,now());

INSERT INTO public.user_sessions(user_id,session_id) VALUES
('2d000000-0000-4000-8000-000000000001','owner-session-2m'),
('2d000000-0000-4000-8000-000000000002','admin-session-2m'),
('2d000000-0000-4000-8000-000000000003','admin2-session-2m'),
('2d000000-0000-4000-8000-000000000004','user-session-2m'),
('2d000000-0000-4000-8000-000000000005','blocked-session-2m'),
('2d000000-0000-4000-8000-000000000006','delete-session-2m'),
('2d000000-0000-4000-8000-000000000007','cancelled-session-2m'),
('2d000000-0000-4000-8000-000000000008','delegated-session-2m'),
('2d000000-0000-4000-8000-000000000009','owner2-session-2m');
INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed)
VALUES('2d000000-0000-4000-8000-000000000008','accounts.manage',true);
INSERT INTO public.approval_requests(assigned_to,status)
VALUES('2d000000-0000-4000-8000-000000000005','pending');
INSERT INTO public.approval_requests(cancelled_by,status)
VALUES('2d000000-0000-4000-8000-000000000007','cancelled');

SELECT pg_temp.set_claims_2m(
  '2d000000-0000-4000-8000-000000000002','authenticated','aal2','admin-session-2m'
);
SET LOCAL ROLE authenticated;

SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000004',0,false,
  'Désactivation justifiée pour test 2M',
  '2d000000-0000-4000-8000-000000000101'
),'OK:db_completed:false','Admin désactive un compte inférieur via RPC');
SELECT is((SELECT version FROM public.user_profiles
  WHERE id='2d000000-0000-4000-8000-000000000004'),1::bigint,
  'version incrémentée exactement une fois');
SELECT is((SELECT is_active FROM public.user_profiles
  WHERE id='2d000000-0000-4000-8000-000000000004'),false,
  'profil désactivé atomiquement');
SELECT is((SELECT is_active FROM public.user_sessions
  WHERE user_id='2d000000-0000-4000-8000-000000000004'),false,
  'sessions applicatives cible révoquées atomiquement');
SELECT is((SELECT status FROM public.snp_account_lifecycle_audit
  WHERE idempotency_key='2d000000-0000-4000-8000-000000000101'),
  'db_completed','journal pré-action puis DB complété');
SELECT is((SELECT action FROM public.snp_comptes_audit
  WHERE cible_id='2d000000-0000-4000-8000-000000000004'),
  'desactivation','snapshot historique compatible UI écrit atomiquement');
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000004',0,false,
  'Désactivation justifiée pour test 2M',
  '2d000000-0000-4000-8000-000000000101'
),'OK:db_completed:true','rejeu identique stable malgré ancienne expected_version');
SELECT is((SELECT version FROM public.user_profiles
  WHERE id='2d000000-0000-4000-8000-000000000004'),1::bigint,
  'rejeu ne réapplique pas la mutation');
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000004',0,true,
  'Payload divergent pour test idempotence',
  '2d000000-0000-4000-8000-000000000101'
),'ERR:23505','clé idempotence divergente refusée');
SELECT is(pg_temp.try_direct_status_2m(
  '2d000000-0000-4000-8000-000000000004'
),'ERR:42501','DML authenticated direct du statut refusé');

SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000003',0,false,
  'Admin ne peut cibler un autre admin',
  '2d000000-0000-4000-8000-000000000102'
),'ERR:42501','Admin ne cible jamais Admin');
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000002',0,false,
  'Auto désactivation strictement interdite',
  '2d000000-0000-4000-8000-000000000103'
),'ERR:22023','auto-modification refusée');
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000005',99,true,
  'Version périmée strictement refusée',
  '2d000000-0000-4000-8000-000000000104'
),'ERR:40001','version obsolète refusée');

SELECT pg_temp.set_claims_2m(
  '2d000000-0000-4000-8000-000000000002','authenticated','aal1','admin-session-2m'
);
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000005',0,true,
  'AAL1 doit être strictement refusé ici',
  '2d000000-0000-4000-8000-000000000105'
),'ERR:42501','AAL1 refusé avant mutation');

SELECT pg_temp.set_claims_2m(
  '2d000000-0000-4000-8000-000000000003','authenticated','aal2','admin2-session-2m'
);
UPDATE public.user_sessions SET is_active=false,revoked_at=clock_timestamp()
WHERE session_id='admin2-session-2m';
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000005',0,true,
  'Session révoquée doit être refusée ici',
  '2d000000-0000-4000-8000-000000000106'
),'ERR:42501','session applicative révoquée refusée');

SELECT pg_temp.set_claims_2m(
  '2d000000-0000-4000-8000-000000000008','authenticated','aal2','delegated-session-2m'
);
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000005',0,true,
  'Capability déléguée sans rôle national refusée',
  '2d000000-0000-4000-8000-000000000112'
),'ERR:42501','capability déléguée ne remplace pas Owner/Admin national');
SELECT is((SELECT count(*) FROM public.snp_account_lifecycle_audit),0::bigint,
  'profil délégué non national ne lit aucun audit lifecycle');
SELECT is((SELECT count(*) FROM public.snp_comptes_audit),0::bigint,
  'profil délégué non national ne lit aucun historique compte');

RESET ROLE;
SELECT pg_temp.set_claims_2m(
  '2d000000-0000-4000-8000-000000000001','authenticated','aal2','owner-session-2m'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000002',0,false,
  'Owner peut désactiver un administrateur',
  '2d000000-0000-4000-8000-000000000107'
),'OK:db_completed:false','Owner peut gérer Admin sous version verrouillée');
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000001',0,false,
  'Même Owner ne peut se cibler lui-même',
  '2d000000-0000-4000-8000-000000000108'
),'ERR:22023','Owner ne peut jamais se cibler');
SELECT is(pg_temp.try_status_2m(
  '2d000000-0000-4000-8000-000000000009',0,false,
  'Owner ne peut cibler un autre Owner',
  '2d000000-0000-4000-8000-000000000113'
),'ERR:42501','Owner ne peut cibler un autre Owner');
SELECT is(pg_temp.try_delete_2m(
  '2d000000-0000-4000-8000-000000000005',0,
  'Suppression bloquée par assignation métier',
  '2d000000-0000-4000-8000-000000000109'
),'ERR:23503','assigned_to bloque la suppression');
SELECT is(pg_temp.try_delete_2m(
  '2d000000-0000-4000-8000-000000000007',0,
  'Suppression bloquée par annulation métier',
  '2d000000-0000-4000-8000-000000000110'
),'ERR:23503','cancelled_by bloque la suppression');
SELECT is(pg_temp.try_delete_2m(
  '2d000000-0000-4000-8000-000000000006',0,
  'Suppression inactive sans activité métier',
  '2d000000-0000-4000-8000-000000000111'
),'OK:db_completed:false','suppression propre préparée sans DML Auth SQL');
SELECT is((SELECT is_active FROM public.user_sessions
  WHERE user_id='2d000000-0000-4000-8000-000000000006'),false,
  'préparation suppression révoque le registre applicatif');
SELECT is(pg_temp.try_finalize_2m(
  '2d000000-0000-4000-8000-000000000111',true,NULL
),'ERR:42501','authenticated ne peut finaliser le résultat GoTrue');
RESET ROLE;

SELECT pg_temp.set_claims_2m(
  '2d000000-0000-4000-8000-000000000001','service_role','aal2','service-finalizer-2m'
);
SET LOCAL ROLE service_role;
SELECT is(pg_temp.try_finalize_2m(
  '2d000000-0000-4000-8000-000000000111',false,NULL
),'ERR:22023','échec final exige un code générique exploitable');
SELECT is(pg_temp.try_finalize_2m(
  '2d000000-0000-4000-8000-000000000111',true,NULL
),'OK:completed:false','service_role finalise le succès Auth Admin');
SELECT is(pg_temp.try_finalize_2m(
  '2d000000-0000-4000-8000-000000000111',true,NULL
),'OK:completed:true','rejeu finalisation strictement identique');
SELECT is(pg_temp.try_finalize_2m(
  '2d000000-0000-4000-8000-000000000111',false,'auth_error'
),'ERR:23505','finalisation divergente refusée');
RESET ROLE;

ALTER TABLE public.approval_requests
  DROP CONSTRAINT approval_requests_assigned_to_fkey;
ALTER TABLE public.approval_requests
  ADD CONSTRAINT approval_requests_assigned_to_fkey
  FOREIGN KEY(assigned_to) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
SELECT is(pg_temp.try_registry_2m(),'ERR:55000',
  'dérive ON DELETE avec même table/colonne/nom ferme le contrat');
ALTER TABLE public.approval_requests
  DROP CONSTRAINT approval_requests_assigned_to_fkey;
ALTER TABLE public.approval_requests
  ADD CONSTRAINT approval_requests_assigned_to_fkey
  FOREIGN KEY(assigned_to) REFERENCES public.user_profiles(id);
SELECT is(pg_temp.try_registry_2m(),'OK',
  'restauration exacte du manifeste réouvre le contrat');

CREATE TABLE public.unknown_account_reference(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approved_by uuid REFERENCES auth.users(id)
);
SELECT is(pg_temp.try_registry_2m(),'ERR:55000',
  'nouvelle FK acteur absente du registre ferme le contrat');

SELECT * FROM finish();
ROLLBACK;
