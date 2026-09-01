-- Contrat réel de la saga de création de compte. Toutes les données sont
-- synthétiques et la transaction est systématiquement annulée.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_creation_claims(
  p_sub uuid,p_aal text,p_session text
) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',p_sub::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.aal',p_aal,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_sub,'role','authenticated','aal',p_aal,'session_id',p_session,
    'exp',floor(extract(epoch FROM clock_timestamp()))::bigint+3600
  )::text,true);
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_create_account(
  p_user_id uuid,p_email text,p_name text,p_role text,p_key text
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_result jsonb;
BEGIN
  v_result:=public.snp_creer_compte_postgresql_transactionnel(
    p_key,p_user_id,p_email,p_name,NULL,p_role,true,NULL,p_role,
    NULL,NULL,NULL,NULL,'{}'::jsonb,'[]'::jsonb
  );
  RETURN 'OK:'||coalesce(v_result->>'role','')||':'||coalesce(v_result->>'replayed','');
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.creation_operation_count(p_user_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT count(*) FROM public.snp_account_creation_operations
  WHERE auth_user_id=p_user_id;
$fn$;
GRANT EXECUTE ON FUNCTION pg_temp.creation_operation_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.try_create_scoped_account(
  p_user_id uuid,p_email text,p_role text,p_key text,p_organization_id uuid,
  p_organization_code text,p_organization_name text,p_collector_id uuid,
  p_responsibilities jsonb
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_result jsonb;
BEGIN
  v_result:=public.snp_creer_compte_postgresql_transactionnel(
    p_key,p_user_id,p_email,'Compte périmétré',NULL,p_role,true,NULL,p_role,
    p_organization_id,p_organization_code,p_organization_name,p_collector_id,
    p_responsibilities,'[]'::jsonb
  );
  RETURN 'OK:'||coalesce(v_result->>'role','')||':'||coalesce(v_result->>'replayed','');
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

SELECT plan(30);

INSERT INTO auth.users(
  id,instance_id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) VALUES
('71000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-creation@invalid.test','','{}','{}',now(),now()),
('71000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-creation@invalid.test','','{}','{}',now(),now()),
('71000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-target-creation@invalid.test','','{}','{}',now(),now()),
('71000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','customer-target-creation@invalid.test','','{}','{}',now(),now()),
('71000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-forbidden-creation@invalid.test','','{}','{}',now(),now()),
('71000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-forbidden-creation@invalid.test','','{}','{}',now(),now()),
('71000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','aal1-target-creation@invalid.test','','{}','{}',now(),now()),
('71000000-0000-4000-8000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comptoir-target-creation@invalid.test','','{}','{}',now(),now()),
('71000000-0000-4000-8000-000000000009','00000000-0000-0000-0000-000000000000','authenticated','authenticated','collector-target-creation@invalid.test','','{}','{}',now(),now());

INSERT INTO public.user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at)
VALUES
('71000000-0000-4000-8000-000000000001','owner-creation@invalid.test','Owner création','owner',true,now()),
('71000000-0000-4000-8000-000000000002','admin-creation@invalid.test','Admin création','admin',true,now());

INSERT INTO public.user_sessions(user_id,expires_at,token_hash)
VALUES
('71000000-0000-4000-8000-000000000001',now()+interval '1 hour',extensions.digest('owner-creation-session','sha256')),
('71000000-0000-4000-8000-000000000002',now()+interval '1 hour',extensions.digest('admin-creation-session','sha256'));

SELECT pg_temp.set_creation_claims(
  '71000000-0000-4000-8000-000000000001','aal2','owner-creation-session'
);
SET LOCAL ROLE authenticated;

SELECT is(pg_temp.try_create_account(
  '71000000-0000-4000-8000-000000000003',
  'owner-target-creation@invalid.test','Owner cible','owner','creation-owner-key-0001'
),'OK:owner:false','Owner peut créer un autre Owner');
SELECT is((SELECT role FROM public.user_profiles
  WHERE id='71000000-0000-4000-8000-000000000003'),'owner','rôle Owner effectivement persisté');
SELECT is((SELECT count(*) FROM public.user_permissions
  WHERE user_id='71000000-0000-4000-8000-000000000003'
    AND can_view AND can_create AND can_edit AND can_delete AND can_approve),
  (SELECT count(*) FROM public.modules),'Owner reçoit tous les droits de tous les modules');
SELECT is((SELECT count(*) FROM public.snp_account_admin_audit
  WHERE target_id='71000000-0000-4000-8000-000000000003' AND action='account_create'),
  1::bigint,'création journalisée exactement une fois');
SELECT is(pg_temp.try_create_account(
  '71000000-0000-4000-8000-000000000003',
  'owner-target-creation@invalid.test','Owner cible','owner','creation-owner-key-0001'
),'OK:owner:true','rejeu identique idempotent');
SELECT is((SELECT count(*) FROM public.user_profiles
  WHERE id='71000000-0000-4000-8000-000000000003'),1::bigint,'rejeu ne duplique pas le profil');
SELECT is(pg_temp.creation_operation_count('71000000-0000-4000-8000-000000000003'),
  1::bigint,'rejeu ne duplique pas le registre');
SELECT is(pg_temp.try_create_account(
  '71000000-0000-4000-8000-000000000003',
  'owner-target-creation@invalid.test','Nom divergent','owner','creation-owner-key-0001'
),'ERR:23505','clé réutilisée avec un payload divergent refusée');
SELECT is((public.snp_confirmer_courriel_creation_compte(
  'creation-owner-key-0001','71000000-0000-4000-8000-000000000003'
)->>'email_sent')::boolean,true,'confirmation du courriel enregistrée');
SELECT is((public.snp_lire_creation_compte_idempotente(
  'creation-owner-key-0001','owner-target-creation@invalid.test','Owner cible',NULL,
  'owner',true,NULL,'owner',NULL,NULL,NULL,NULL,'{}','[]'
)->>'email_sent')::boolean,true,'lecture idempotente restitue la confirmation du courriel');

RESET ROLE;
SELECT pg_temp.set_creation_claims(
  '71000000-0000-4000-8000-000000000002','aal2','admin-creation-session'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_create_account(
  '71000000-0000-4000-8000-000000000004',
  'customer-target-creation@invalid.test','Client cible','customer','creation-admin-key-0001'
),'OK:customer:false','Admin crée un compte strictement inférieur');
SELECT is((SELECT role FROM public.user_profiles
  WHERE id='71000000-0000-4000-8000-000000000004'),'customer','rôle inférieur persisté');
SELECT is(pg_temp.try_create_account(
  '71000000-0000-4000-8000-000000000005',
  'owner-forbidden-creation@invalid.test','Owner interdit','owner','creation-admin-key-0002'
),'ERR:42501','Admin ne crée jamais Owner');
SELECT is(pg_temp.try_create_account(
  '71000000-0000-4000-8000-000000000006',
  'admin-forbidden-creation@invalid.test','Admin interdit','admin','creation-admin-key-0003'
),'ERR:42501','Admin ne crée jamais un pair Admin');
SELECT is((SELECT count(*) FROM public.user_profiles WHERE id IN(
  '71000000-0000-4000-8000-000000000005','71000000-0000-4000-8000-000000000006'
)),0::bigint,'refus hiérarchiques sans profil partiel');

RESET ROLE;
SELECT pg_temp.set_creation_claims(
  '71000000-0000-4000-8000-000000000002','aal1','admin-creation-session'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_create_account(
  '71000000-0000-4000-8000-000000000007',
  'aal1-target-creation@invalid.test','Cible AAL1','customer','creation-admin-key-0004'
),'ERR:42501','AAL1 refusé avant toute écriture');
SELECT is((SELECT count(*) FROM public.user_profiles
  WHERE id='71000000-0000-4000-8000-000000000007'),0::bigint,'AAL1 ne laisse aucun profil partiel');

RESET ROLE;
SELECT pg_temp.set_creation_claims(
  '71000000-0000-4000-8000-000000000001','aal2','owner-creation-session'
);
SET LOCAL ROLE authenticated;
SELECT is((public.snp_annuler_creation_compte_postgresql(
  'creation-owner-key-0001','71000000-0000-4000-8000-000000000003'
)->>'removed')::boolean,true,'compensation PostgreSQL confirmée');
SELECT is((SELECT count(*) FROM public.user_profiles
  WHERE id='71000000-0000-4000-8000-000000000003'),0::bigint,'compensation supprime le profil et ses accès');
SELECT is(pg_temp.creation_operation_count('71000000-0000-4000-8000-000000000003'),
  0::bigint,'compensation retire la clé pour un nouveau réessai');
SELECT is((SELECT count(*) FROM public.snp_account_admin_audit
  WHERE target_id='71000000-0000-4000-8000-000000000003'),0::bigint,'compensation retire les audits liés au compte annulé');
SELECT is(pg_temp.try_create_account(
  '71000000-0000-4000-8000-000000000003',
  'owner-target-creation@invalid.test','Owner cible','owner','creation-owner-key-0001'
),'OK:owner:false','réessai après compensation recrée une seule saga propre');

INSERT INTO public.snp_artisans_miniers(
  id,type_personne,type_artisan,nom,telephone,actif,created_by
) VALUES(
  '71000000-0000-4000-8000-000000000101','physique','collecteur',
  'Collecteur transactionnel','+22670000101',true,'71000000-0000-4000-8000-000000000001'
);
SELECT is(pg_temp.try_create_scoped_account(
  '71000000-0000-4000-8000-000000000008','comptoir-target-creation@invalid.test',
  'comptoir','creation-comptoir-key-0001',NULL,'CTR-IAM-001','Comptoir IAM transactionnel',
  NULL,'{"comptoir.manage":true}'::jsonb
),'OK:comptoir:false','création Comptoir inclut la création organisationnelle atomique');
SELECT ok(EXISTS(
  SELECT 1 FROM public.snp_organizations organization
  JOIN public.snp_user_organization_memberships membership ON membership.organization_id=organization.id
  JOIN public.snp_user_responsibilities responsibility ON responsibility.user_id=membership.user_id
  JOIN public.snp_user_capabilities capability ON capability.user_id=membership.user_id
  WHERE organization.code='CTR-IAM-001'
    AND membership.user_id='71000000-0000-4000-8000-000000000008' AND membership.valid_until IS NULL
    AND responsibility.responsibility_code='comptoir.manage'
    AND capability.capability_code='comptoir.manage' AND capability.allowed
),'organisation, membership, responsabilité et capacité sont cohérents dans la même transaction');
SELECT is(pg_temp.try_create_scoped_account(
  '71000000-0000-4000-8000-000000000009','collector-target-creation@invalid.test',
  'collector','creation-collector-key-0001',
  (SELECT id FROM public.snp_organizations WHERE code='CTR-IAM-001'),NULL,NULL,
  '71000000-0000-4000-8000-000000000101','{"collector.operate":true}'::jsonb
),'OK:collector:false','création Collecteur inclut son rattachement atomique');
SELECT ok(EXISTS(
  SELECT 1 FROM public.snp_collector_accounts account
  JOIN public.snp_user_organization_memberships membership ON membership.user_id=account.user_id
  WHERE account.user_id='71000000-0000-4000-8000-000000000009' AND account.is_active
    AND account.collector_id='71000000-0000-4000-8000-000000000101'
    AND membership.organization_id=account.comptoir_organization_id AND membership.valid_until IS NULL
),'compte Collecteur et membership pointent vers le même Comptoir');
SELECT is((public.snp_annuler_creation_compte_postgresql(
  'creation-collector-key-0001','71000000-0000-4000-8000-000000000009'
)->>'removed')::boolean,true,'compensation du Collecteur confirmée');
SELECT ok(NOT EXISTS(
  SELECT 1 FROM public.snp_collector_accounts
  WHERE user_id='71000000-0000-4000-8000-000000000009'
) AND NOT EXISTS(
  SELECT 1 FROM public.snp_user_organization_memberships
  WHERE user_id='71000000-0000-4000-8000-000000000009'
),'compensation retire compte Collecteur et membership');
SELECT is((public.snp_annuler_creation_compte_postgresql(
  'creation-comptoir-key-0001','71000000-0000-4000-8000-000000000008'
)->>'removed')::boolean,true,'compensation du Comptoir confirmée');
SELECT ok(NOT EXISTS(
  SELECT 1 FROM public.snp_organizations WHERE code='CTR-IAM-001'
),'organisation créée par la saga supprimée après ses dépendances');

SELECT * FROM finish();
ROLLBACK;
