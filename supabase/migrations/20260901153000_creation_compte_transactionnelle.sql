-- Création de compte : transaction PostgreSQL unique, idempotence et compensation.
-- La création GoTrue reste l'unique effet externe et est orchestrée par l'Edge
-- Function. Toutes les écritures public.* sont réalisées ou annulées ensemble.

BEGIN;

DO $preflight$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(required_name, ', ' ORDER BY required_name) INTO v_missing
  FROM (VALUES
    ('public.user_profiles', to_regclass('public.user_profiles') IS NOT NULL),
    ('public.snp_organizations', to_regclass('public.snp_organizations') IS NOT NULL),
    ('public.snp_user_organization_memberships', to_regclass('public.snp_user_organization_memberships') IS NOT NULL),
    ('public.snp_collector_accounts', to_regclass('public.snp_collector_accounts') IS NOT NULL),
    ('public.snp_user_responsibilities', to_regclass('public.snp_user_responsibilities') IS NOT NULL),
    ('public.snp_user_capabilities', to_regclass('public.snp_user_capabilities') IS NOT NULL),
    ('public.user_permissions', to_regclass('public.user_permissions') IS NOT NULL),
    ('public.snp_account_admin_audit', to_regclass('public.snp_account_admin_audit') IS NOT NULL),
    ('public.snp_rpc_execution_allowlist', to_regclass('public.snp_rpc_execution_allowlist') IS NOT NULL),
    ('public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb)',
      to_regprocedure('public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb)') IS NOT NULL),
    ('public.snp_actor_can_module_action(text,text)',
      to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NOT NULL),
    ('public.snp_session_est_active()', to_regprocedure('public.snp_session_est_active()') IS NOT NULL),
    ('public.snp_mfa_satisfaite()', to_regprocedure('public.snp_mfa_satisfaite()') IS NOT NULL)
  ) required(required_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight création transactionnelle incomplet : %.', v_missing;
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.snp_account_creation_operations (
  actor_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  auth_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  request_payload jsonb NOT NULL,
  result_payload jsonb NOT NULL,
  organization_id uuid,
  organization_created boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'db_completed' CHECK (status IN ('db_completed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  email_sent_at timestamptz,
  PRIMARY KEY (actor_id, idempotency_key),
  UNIQUE (auth_user_id),
  CONSTRAINT snp_account_creation_key_format CHECK (
    length(idempotency_key) BETWEEN 8 AND 128
    AND idempotency_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  CONSTRAINT snp_account_creation_payload_shape CHECK (
    jsonb_typeof(request_payload) = 'object'
    AND jsonb_typeof(result_payload) = 'object'
  )
);

ALTER TABLE public.snp_account_creation_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_account_creation_operations FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_account_creation_operations
  FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.snp_account_admin_audit
  DROP CONSTRAINT IF EXISTS snp_account_admin_audit_action_check;
ALTER TABLE public.snp_account_admin_audit
  ADD CONSTRAINT snp_account_admin_audit_action_check CHECK (action IN (
    'profile_update', 'role_change', 'permissions_replace',
    'approver_grant', 'approver_revoke',
    'access_configuration', 'module_catalog_update', 'account_create'
  ));

CREATE OR REPLACE FUNCTION public.snp_creation_compte_payload(
  p_email text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_is_active boolean,
  p_mining_company_id uuid,
  p_account_type text,
  p_organization_id uuid,
  p_organization_code text,
  p_organization_name text,
  p_collector_id uuid,
  p_responsibilities jsonb,
  p_permissions jsonb
) RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT jsonb_build_object(
    'email', lower(trim(coalesce(p_email, ''))),
    'full_name', trim(coalesce(p_full_name, '')),
    'phone', nullif(trim(coalesce(p_phone, '')), ''),
    'role', lower(trim(coalesce(p_role, ''))),
    'is_active', coalesce(p_is_active, true),
    'mining_company_id', p_mining_company_id,
    'account_type', nullif(lower(trim(coalesce(p_account_type, ''))), ''),
    'organization_id', p_organization_id,
    'organization_code', nullif(upper(trim(coalesce(p_organization_code, ''))), ''),
    'organization_name', nullif(trim(coalesce(p_organization_name, '')), ''),
    'collector_id', p_collector_id,
    'responsibilities', coalesce(p_responsibilities, '{}'::jsonb),
    'permissions', coalesce(p_permissions, '[]'::jsonb)
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_creation_compte_require_actor(p_target_role text)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE v_actor_role text;
BEGIN
  IF auth.uid() IS NULL
    OR NOT public.snp_session_est_active()
    OR NOT public.snp_mfa_satisfaite()
    OR NOT public.snp_actor_has_capability('accounts.manage')
    OR NOT public.snp_actor_can_module_action('administration', 'create') THEN
    RAISE EXCEPTION 'Session de création de compte non autorisée.' USING ERRCODE='42501';
  END IF;

  SELECT lower(profile.role) INTO v_actor_role
  FROM public.user_profiles profile
  WHERE profile.id=auth.uid() AND profile.is_active AND profile.mining_company_id IS NULL
  FOR UPDATE;

  IF v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Rôle créateur non autorisé.' USING ERRCODE='42501';
  END IF;
  IF lower(coalesce(p_target_role, '')) NOT IN (
    'owner','admin','management','dgmg','dgi','mine','comptoir','collector','customer'
  ) THEN
    RAISE EXCEPTION 'Rôle cible non attribuable.' USING ERRCODE='22023';
  END IF;
  IF v_actor_role='admin'
    AND public.snp_niveau_role(lower(p_target_role))>=public.snp_niveau_role(v_actor_role) THEN
    RAISE EXCEPTION 'Admin ne peut créer un compte de niveau équivalent ou supérieur.' USING ERRCODE='42501';
  END IF;
  RETURN v_actor_role;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_lire_creation_compte_idempotente(
  p_idempotency_key text,
  p_email text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_is_active boolean,
  p_mining_company_id uuid,
  p_account_type text,
  p_organization_id uuid,
  p_organization_code text,
  p_organization_name text,
  p_collector_id uuid,
  p_responsibilities jsonb,
  p_permissions jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
DECLARE v_operation public.snp_account_creation_operations%ROWTYPE;
DECLARE v_payload jsonb;
BEGIN
  PERFORM public.snp_creation_compte_require_actor(p_role);
  IF p_idempotency_key IS NULL
    OR length(p_idempotency_key) NOT BETWEEN 8 AND 128
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'Clé d’idempotence invalide.' USING ERRCODE='22023';
  END IF;
  v_payload:=public.snp_creation_compte_payload(
    p_email,p_full_name,p_phone,p_role,p_is_active,p_mining_company_id,
    p_account_type,p_organization_id,p_organization_code,p_organization_name,
    p_collector_id,p_responsibilities,p_permissions
  );
  SELECT * INTO v_operation
  FROM public.snp_account_creation_operations operation
  WHERE operation.actor_id=auth.uid() AND operation.idempotency_key=p_idempotency_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_operation.request_payload<>v_payload THEN
    RAISE EXCEPTION 'Cette clé d’idempotence est déjà liée à une autre demande.' USING ERRCODE='23505';
  END IF;
  RETURN v_operation.result_payload || jsonb_build_object(
    'replayed',true,'email_sent',v_operation.email_sent_at IS NOT NULL
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_creer_compte_postgresql_transactionnel(
  p_idempotency_key text,
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_is_active boolean,
  p_mining_company_id uuid,
  p_account_type text,
  p_organization_id uuid,
  p_organization_code text,
  p_organization_name text,
  p_collector_id uuid,
  p_responsibilities jsonb,
  p_permissions jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_actor_role text;
  v_operation public.snp_account_creation_operations%ROWTYPE;
  v_payload jsonb;
  v_result jsonb;
  v_email text;
  v_role text;
  v_organization_id uuid:=p_organization_id;
  v_organization_created boolean:=false;
  v_ministry_id uuid;
BEGIN
  IF p_idempotency_key IS NULL
    OR length(p_idempotency_key) NOT BETWEEN 8 AND 128
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'Clé d’idempotence invalide.' USING ERRCODE='22023';
  END IF;
  IF p_user_id IS NULL OR p_user_id=auth.uid() THEN
    RAISE EXCEPTION 'Identité Auth cible invalide.' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'snp-create-account:'||coalesce(auth.uid()::text,'')||':'||p_idempotency_key,0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended('snp-account-administration',0));
  v_actor_role:=public.snp_creation_compte_require_actor(p_role);
  v_payload:=public.snp_creation_compte_payload(
    p_email,p_full_name,p_phone,p_role,p_is_active,p_mining_company_id,
    p_account_type,p_organization_id,p_organization_code,p_organization_name,
    p_collector_id,p_responsibilities,p_permissions
  );

  SELECT * INTO v_operation
  FROM public.snp_account_creation_operations operation
  WHERE operation.actor_id=auth.uid() AND operation.idempotency_key=p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_operation.request_payload<>v_payload OR v_operation.auth_user_id<>p_user_id THEN
      RAISE EXCEPTION 'Cette clé d’idempotence est déjà liée à une autre demande.' USING ERRCODE='23505';
    END IF;
    RETURN v_operation.result_payload || jsonb_build_object(
      'replayed',true,'email_sent',v_operation.email_sent_at IS NOT NULL
    );
  END IF;

  v_email:=v_payload->>'email';
  v_role:=v_payload->>'role';
  IF length(v_email) NOT BETWEEN 3 AND 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR length(v_payload->>'full_name') NOT BETWEEN 1 AND 160
    OR length(coalesce(v_payload->>'phone',''))>40 THEN
    RAISE EXCEPTION 'Identité du compte invalide.' USING ERRCODE='22023';
  END IF;
  IF (v_payload->>'account_type') IS NOT NULL AND v_payload->>'account_type'<>v_role THEN
    RAISE EXCEPTION 'Type de compte incohérent avec le rôle.' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(v_payload->'responsibilities')<>'object'
    OR jsonb_typeof(v_payload->'permissions')<>'array'
    OR jsonb_array_length(v_payload->'permissions')>200 THEN
    RAISE EXCEPTION 'Responsabilités ou habilitations invalides.' USING ERRCODE='22023';
  END IF;
  IF (v_role='mine') IS DISTINCT FROM (p_mining_company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Le périmètre minier est obligatoire uniquement pour le rôle Mine.' USING ERRCODE='22023';
  END IF;
  IF v_role<>'collector' AND p_collector_id IS NOT NULL THEN
    RAISE EXCEPTION 'Le profil Collecteur est incompatible avec ce rôle.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM auth.users identity
    WHERE identity.id=p_user_id AND lower(identity.email)=v_email
  ) THEN
    RAISE EXCEPTION 'Identité Auth absente ou adresse incohérente.' USING ERRCODE='23503';
  END IF;
  IF EXISTS(SELECT 1 FROM public.user_profiles profile WHERE profile.id=p_user_id OR lower(profile.email)=v_email) THEN
    RAISE EXCEPTION 'Ce compte possède déjà un profil.' USING ERRCODE='23505';
  END IF;

  IF v_role='comptoir' AND v_organization_id IS NULL THEN
    IF nullif(v_payload->>'organization_code','') IS NULL
      OR (v_payload->>'organization_code') !~ '^[A-Z0-9][A-Z0-9_-]{1,19}$'
      OR length(coalesce(v_payload->>'organization_name','')) NOT BETWEEN 3 AND 160 THEN
      RAISE EXCEPTION 'Code et nom du nouveau Comptoir obligatoires.' USING ERRCODE='23502';
    END IF;
    SELECT ministry.id INTO v_ministry_id
    FROM public.snp_ministries ministry
    WHERE ministry.code='MEMC' AND ministry.is_active
    FOR SHARE;
    IF v_ministry_id IS NULL THEN
      RAISE EXCEPTION 'Ministère MEMC actif introuvable.' USING ERRCODE='23503';
    END IF;
    INSERT INTO public.snp_organizations(
      code,name,organization_type,supervising_ministry_id,is_active,created_by
    ) VALUES(
      v_payload->>'organization_code',v_payload->>'organization_name','comptoir',
      v_ministry_id,true,auth.uid()
    ) RETURNING id INTO v_organization_id;
    v_organization_created:=true;
  ELSIF v_role<>'comptoir' AND (
    (v_payload->>'organization_code') IS NOT NULL OR (v_payload->>'organization_name') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Seul un compte Comptoir peut créer une organisation.' USING ERRCODE='22023';
  END IF;

  -- Le profil sans privilège est invisible hors transaction. Le RPC canonique
  -- applique ensuite rôle, périmètre, membership, collecteur, responsabilités,
  -- capacités, habilitations et audit dans cette même transaction.
  INSERT INTO public.user_profiles(
    id,email,full_name,phone,role,mining_company_id,is_active,
    two_factor_enabled,mfa_enrolled_at,must_change_password,password_changed_at
  ) VALUES(
    p_user_id,v_email,v_payload->>'full_name',v_payload->>'phone','customer',NULL,false,
    false,NULL,true,NULL
  );

  PERFORM public.snp_configurer_acces_compte(
    p_user_id,v_payload->>'full_name',v_payload->>'phone',v_role,
    (v_payload->>'is_active')::boolean,p_mining_company_id,v_organization_id,
    p_collector_id,v_payload->'responsibilities',v_payload->'permissions'
  );

  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,new_values)
  VALUES(auth.uid(),p_user_id,'account_create',jsonb_build_object(
    'role',v_role,'email',v_email,'organization_id',v_organization_id,
    'organization_created',v_organization_created,'idempotency_key',p_idempotency_key
  ));

  v_result:=jsonb_build_object(
    'user_id',p_user_id,'email',v_email,'full_name',v_payload->>'full_name',
    'role',v_role,'account_type',v_payload->>'account_type',
    'organization_id',v_organization_id,'organization_created',v_organization_created,
    'replayed',false,'email_sent',false
  );
  INSERT INTO public.snp_account_creation_operations(
    actor_id,idempotency_key,auth_user_id,request_payload,result_payload,
    organization_id,organization_created
  ) VALUES(
    auth.uid(),p_idempotency_key,p_user_id,v_payload,
    v_result-'replayed'-'email_sent',v_organization_id,v_organization_created
  );
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_confirmer_courriel_creation_compte(
  p_idempotency_key text,p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
DECLARE v_operation public.snp_account_creation_operations%ROWTYPE;
BEGIN
  PERFORM public.snp_creation_compte_require_actor('customer');
  UPDATE public.snp_account_creation_operations operation
  SET email_sent_at=coalesce(operation.email_sent_at,clock_timestamp())
  WHERE operation.actor_id=auth.uid()
    AND operation.idempotency_key=p_idempotency_key
    AND operation.auth_user_id=p_user_id
  RETURNING * INTO v_operation;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Création de compte idempotente introuvable.' USING ERRCODE='P0002';
  END IF;
  RETURN v_operation.result_payload || jsonb_build_object('replayed',false,'email_sent',true);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_annuler_creation_compte_postgresql(
  p_idempotency_key text,p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_operation public.snp_account_creation_operations%ROWTYPE;
  v_actor_role text;
  v_target_role text;
  v_removed integer:=0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'snp-create-account:'||coalesce(auth.uid()::text,'')||':'||coalesce(p_idempotency_key,''),0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended('snp-account-administration',0));

  SELECT * INTO v_operation
  FROM public.snp_account_creation_operations operation
  WHERE operation.actor_id=auth.uid()
    AND operation.idempotency_key=p_idempotency_key
    AND operation.auth_user_id=p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Création de compte idempotente introuvable.' USING ERRCODE='P0002';
  END IF;
  SELECT profile.role INTO v_target_role FROM public.user_profiles profile WHERE profile.id=p_user_id FOR UPDATE;
  v_actor_role:=public.snp_creation_compte_require_actor(coalesce(v_target_role,'customer'));
  IF v_actor_role='admin'
    AND public.snp_niveau_role(coalesce(v_target_role,'customer'))>=public.snp_niveau_role('admin') THEN
    RAISE EXCEPTION 'Hiérarchie insuffisante pour annuler cette création.' USING ERRCODE='42501';
  END IF;

  DELETE FROM public.snp_account_admin_audit audit WHERE audit.target_id=p_user_id;
  DELETE FROM public.snp_collector_accounts account WHERE account.user_id=p_user_id;
  DELETE FROM public.snp_user_organization_memberships membership WHERE membership.user_id=p_user_id;
  DELETE FROM public.snp_user_responsibilities responsibility WHERE responsibility.user_id=p_user_id;
  DELETE FROM public.snp_user_capabilities capability WHERE capability.user_id=p_user_id;
  DELETE FROM public.user_permissions permission WHERE permission.user_id=p_user_id;
  DELETE FROM public.user_sessions session WHERE session.user_id=p_user_id;
  DELETE FROM public.snp_account_creation_operations operation
    WHERE operation.actor_id=auth.uid() AND operation.idempotency_key=p_idempotency_key;
  DELETE FROM public.user_profiles profile WHERE profile.id=p_user_id;
  GET DIAGNOSTICS v_removed=ROW_COUNT;
  IF v_removed<>1 THEN
    RAISE EXCEPTION 'Le profil créé n’a pas pu être supprimé.' USING ERRCODE='P0002';
  END IF;
  IF v_operation.organization_created AND v_operation.organization_id IS NOT NULL THEN
    DELETE FROM public.snp_organizations organization
    WHERE organization.id=v_operation.organization_id
      AND organization.created_by=auth.uid()
      AND NOT EXISTS(
        SELECT 1 FROM public.snp_user_organization_memberships membership
        WHERE membership.organization_id=organization.id
      );
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Le Comptoir créé ne peut pas être annulé sans contrôle manuel.' USING ERRCODE='23503';
    END IF;
  END IF;
  RETURN jsonb_build_object('removed',true,'user_id',p_user_id,'organization_removed',v_operation.organization_created);
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_creation_compte_payload(
  text,text,text,text,boolean,uuid,text,uuid,text,text,uuid,jsonb,jsonb
) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_creation_compte_require_actor(text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_lire_creation_compte_idempotente(
  text,text,text,text,text,boolean,uuid,text,uuid,text,text,uuid,jsonb,jsonb
) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.snp_creer_compte_postgresql_transactionnel(
  text,uuid,text,text,text,text,boolean,uuid,text,uuid,text,text,uuid,jsonb,jsonb
) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.snp_confirmer_courriel_creation_compte(text,uuid)
  FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.snp_annuler_creation_compte_postgresql(text,uuid)
  FROM PUBLIC,anon,service_role;

GRANT EXECUTE ON FUNCTION public.snp_lire_creation_compte_idempotente(
  text,text,text,text,text,boolean,uuid,text,uuid,text,text,uuid,jsonb,jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_creer_compte_postgresql_transactionnel(
  text,uuid,text,text,text,text,boolean,uuid,text,uuid,text,text,uuid,jsonb,jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_confirmer_courriel_creation_compte(text,uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_annuler_creation_compte_postgresql(text,uuid)
  TO authenticated;

WITH exposed(function_oid,purpose) AS (VALUES
  ('public.snp_lire_creation_compte_idempotente(text,text,text,text,text,boolean,uuid,text,uuid,text,text,uuid,jsonb,jsonb)'::regprocedure::oid,'p0-contract'),
  ('public.snp_creer_compte_postgresql_transactionnel(text,uuid,text,text,text,text,boolean,uuid,text,uuid,text,text,uuid,jsonb,jsonb)'::regprocedure::oid,'p0-contract'),
  ('public.snp_confirmer_courriel_creation_compte(text,uuid)'::regprocedure::oid,'p0-contract'),
  ('public.snp_annuler_creation_compte_postgresql(text,uuid)'::regprocedure::oid,'p0-contract')
)
INSERT INTO public.snp_rpc_execution_allowlist(
  function_signature,function_name,grantee,purpose,migration_version
)
SELECT procedure.oid::regprocedure::text,procedure.proname,'authenticated',
  exposed.purpose,'20260901153000'
FROM exposed
JOIN pg_catalog.pg_proc procedure ON procedure.oid=exposed.function_oid
ON CONFLICT(function_signature,grantee) DO UPDATE SET
  function_name=excluded.function_name,purpose=excluded.purpose,
  migration_version=excluded.migration_version;

DO $postflight$
BEGIN
  IF to_regprocedure('public.snp_creer_compte_postgresql_transactionnel(text,uuid,text,text,text,text,boolean,uuid,text,uuid,text,text,uuid,jsonb,jsonb)') IS NULL
    OR to_regprocedure('public.snp_annuler_creation_compte_postgresql(text,uuid)') IS NULL
    OR NOT EXISTS(
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.snp_account_creation_operations'::regclass
        AND conname='snp_account_creation_operations_pkey'
    ) OR (SELECT count(*) FROM public.snp_rpc_execution_allowlist
      WHERE migration_version='20260901153000')<>4
    THEN
    RAISE EXCEPTION 'Postflight création transactionnelle incomplet.';
  END IF;
END;
$postflight$;

COMMIT;
