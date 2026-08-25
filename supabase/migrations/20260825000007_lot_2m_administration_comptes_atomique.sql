-- LOT 2M — Administration des comptes atomique et fail-closed
-- Dépendances obligatoires : lot 4C sessions/capabilities et schéma comptes.

DO $preflight$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY name) INTO v_missing
  FROM (VALUES
    ('public.user_profiles', to_regclass('public.user_profiles') IS NOT NULL),
    ('public.user_sessions', to_regclass('public.user_sessions') IS NOT NULL),
    ('public.snp_comptes_audit', to_regclass('public.snp_comptes_audit') IS NOT NULL),
    ('public.snp_account_admin_audit', to_regclass('public.snp_account_admin_audit') IS NOT NULL),
    ('public.snp_require_capability(text)', to_regprocedure('public.snp_require_capability(text)') IS NOT NULL),
    ('public.snp_session_est_active()', to_regprocedure('public.snp_session_est_active()') IS NOT NULL),
    ('public.snp_sessions_revoquer_toutes(uuid,boolean,text)',
      to_regprocedure('public.snp_sessions_revoquer_toutes(uuid,boolean,text)') IS NOT NULL),
    ('public.snp_mfa_satisfaite()', to_regprocedure('public.snp_mfa_satisfaite()') IS NOT NULL)
  ) AS required(name, present)
  WHERE NOT present;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight lot 2M incomplet : %.', v_missing;
  END IF;
  SELECT string_agg(required_column,', ' ORDER BY required_column) INTO v_missing
  FROM unnest(ARRAY[
    'uid','acteur_id','cible_id','action','ancien_etat','nouvel_etat','motif','cree_le'
  ]) required_column
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='snp_comptes_audit'
      AND c.column_name=required_column
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight lot 2M : colonnes snp_comptes_audit absentes : %.',v_missing;
  END IF;
  IF to_regprocedure('extensions.digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'Préflight lot 2M : extensions.digest(bytea,text) absente.';
  END IF;
END;
$preflight$;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;

DO $version_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.user_profiles'::regclass
      AND conname='user_profiles_version_nonnegative'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_version_nonnegative CHECK(version>=0) NOT VALID;
  END IF;
  ALTER TABLE public.user_profiles VALIDATE CONSTRAINT user_profiles_version_nonnegative;
END;
$version_constraint$;

CREATE OR REPLACE FUNCTION public.snp_2m_versionner_profil_securite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','pg_temp'
AS $fn$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active
       AND coalesce(auth.role(),'')='authenticated'
       AND coalesce(current_setting('snp.account_status_rpc',true),'')<>'on' THEN
      RAISE EXCEPTION 'Le statut du compte se modifie uniquement via le RPC canonique.'
        USING ERRCODE='42501';
    END IF;
    NEW.version:=OLD.version+1;
  ELSE
    NEW.version:=OLD.version;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_2m_versionner_profil_securite() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS snp_2m_versionner_profil_securite ON public.user_profiles;
CREATE TRIGGER snp_2m_versionner_profil_securite
BEFORE UPDATE OF role,is_active,mining_company_id,version ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.snp_2m_versionner_profil_securite();

CREATE TABLE IF NOT EXISTS public.snp_account_lifecycle_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  actor_id uuid NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN ('activate','deactivate','delete')),
  status text NOT NULL CHECK(status IN ('authorized','db_completed','completed','failed')),
  request_payload jsonb NOT NULL,
  payload_hash bytea NOT NULL,
  reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),
  previous_version bigint NOT NULL CHECK(previous_version>=0),
  result_version bigint CHECK(result_version>=0),
  previous_active boolean NOT NULL,
  result_active boolean,
  application_sessions_revoked integer NOT NULL DEFAULT 0 CHECK(application_sessions_revoked>=0),
  external_success boolean,
  external_error_code text,
  authorized_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  db_completed_at timestamptz,
  finalized_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.snp_account_lifecycle_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_account_lifecycle_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_account_lifecycle_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.snp_account_lifecycle_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_2m_can_read_lifecycle_audit()
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  RETURN auth.uid() IS NOT NULL
    AND public.snp_session_est_active()
    AND public.snp_mfa_satisfaite()
    AND public.snp_actor_has_capability('accounts.manage')
    AND EXISTS(
      SELECT 1 FROM public.user_profiles p
      WHERE p.id=auth.uid() AND p.is_active
        AND p.mining_company_id IS NULL
        AND lower(p.role) IN ('owner','admin')
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_2m_can_read_lifecycle_audit() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_2m_can_read_lifecycle_audit() TO authenticated;

ALTER TABLE public.snp_comptes_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_comptes_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE public.snp_account_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_account_admin_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_comptes_audit,public.snp_account_admin_audit
FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.snp_comptes_audit,public.snp_account_admin_audit
TO authenticated,service_role;

DO $replace_historical_audit_policies$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT schemaname,tablename,policyname FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('snp_comptes_audit','snp_account_admin_audit')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',v.policyname,v.schemaname,v.tablename);
  END LOOP;
END;
$replace_historical_audit_policies$;

CREATE POLICY snp_comptes_audit_lecture_2m
ON public.snp_comptes_audit FOR SELECT TO authenticated
USING (public.snp_2m_can_read_lifecycle_audit());
CREATE POLICY snp_account_admin_audit_read_2m
ON public.snp_account_admin_audit FOR SELECT TO authenticated
USING (public.snp_2m_can_read_lifecycle_audit());

DROP POLICY IF EXISTS snp_account_lifecycle_audit_read ON public.snp_account_lifecycle_audit;
CREATE POLICY snp_account_lifecycle_audit_read
ON public.snp_account_lifecycle_audit FOR SELECT TO authenticated
USING (public.snp_2m_can_read_lifecycle_audit());

CREATE TABLE IF NOT EXISTS public.snp_account_deletion_dependency_registry (
  schema_name text NOT NULL,
  table_name text NOT NULL,
  column_name text NOT NULL,
  classification text NOT NULL CHECK(classification IN (
    'blocking','technical_cleanup','audit_snapshot','identity','mixed_audit'
  )),
  constraint_name text,
  referenced_schema_name text,
  referenced_table_name text,
  referenced_column_name text,
  delete_action "char",
  source text NOT NULL CHECK(source IN ('foreign_key','actor_column')),
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(schema_name,table_name,column_name)
);

ALTER TABLE public.snp_account_deletion_dependency_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_account_deletion_dependency_registry FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_account_deletion_dependency_registry
FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.snp_account_deletion_dependency_registry
  ADD COLUMN IF NOT EXISTS constraint_name text,
  ADD COLUMN IF NOT EXISTS referenced_schema_name text,
  ADD COLUMN IF NOT EXISTS referenced_table_name text,
  ADD COLUMN IF NOT EXISTS referenced_column_name text;

CREATE OR REPLACE FUNCTION public.snp_2m_current_dependency_inventory()
RETURNS TABLE(
  schema_name text,table_name text,column_name text,classification text,
  constraint_name text,referenced_schema_name text,referenced_table_name text,
  referenced_column_name text,delete_action "char",source text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
  WITH actor_columns AS (
    SELECT n.nspname schema_name,c.relname table_name,a.attname column_name,
      c.oid relid,a.attnum
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid
    JOIN pg_type t ON t.oid=a.atttypid
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND a.attnum>0 AND NOT a.attisdropped AND t.typname='uuid'
      AND (
        a.attname IN (
          'user_id','actor_id','acteur_id','target_id','cible_id','assigned_to',
          'responsable_id','responsable_traitement','gestionnaire_id','author_id'
        ) OR a.attname ~ '(_by|_par)$'
      )
  ), account_fk_columns AS (
    SELECT src_ns.nspname schema_name,src.relname table_name,
      src_col.attname column_name,src.oid relid,src_col.attnum
    FROM pg_constraint con
    JOIN pg_class src ON src.oid=con.conrelid
    JOIN pg_namespace src_ns ON src_ns.oid=src.relnamespace
    JOIN pg_class dst ON dst.oid=con.confrelid
    JOIN pg_namespace dst_ns ON dst_ns.oid=dst.relnamespace
    JOIN LATERAL unnest(con.conkey) key(attnum) ON true
    JOIN pg_attribute src_col ON src_col.attrelid=src.oid AND src_col.attnum=key.attnum
    WHERE con.contype='f' AND src_ns.nspname='public'
      AND ((dst_ns.nspname='auth' AND dst.relname='users')
        OR (dst_ns.nspname='public' AND dst.relname='user_profiles'))
  ), candidates AS (
    SELECT * FROM actor_columns
    UNION
    SELECT * FROM account_fk_columns
  ), inventory AS (
    SELECT q.schema_name,q.table_name,q.column_name,
      fk.constraint_name,fk.referenced_schema_name,fk.referenced_table_name,
      fk.referenced_column_name,fk.delete_action,
      CASE WHEN fk.constraint_name IS NULL THEN 'actor_column' ELSE 'foreign_key' END source
    FROM candidates q
    LEFT JOIN LATERAL (
      SELECT con.conname constraint_name,dst_ns.nspname referenced_schema_name,
        dst.relname referenced_table_name,dst_col.attname referenced_column_name,
        con.confdeltype delete_action
      FROM pg_constraint con
      JOIN pg_class dst ON dst.oid=con.confrelid
      JOIN pg_namespace dst_ns ON dst_ns.oid=dst.relnamespace
      JOIN LATERAL unnest(con.conkey) WITH ORDINALITY key(attnum,ord) ON true
      JOIN LATERAL unnest(con.confkey) WITH ORDINALITY parent_key(attnum,ord)
        ON parent_key.ord=key.ord
      JOIN pg_attribute dst_col ON dst_col.attrelid=dst.oid
        AND dst_col.attnum=parent_key.attnum
      WHERE con.contype='f' AND con.conrelid=q.relid AND key.attnum=q.attnum
        AND ((dst_ns.nspname='auth' AND dst.relname='users')
          OR (dst_ns.nspname='public' AND dst.relname='user_profiles'))
      ORDER BY con.conname
      LIMIT 1
    ) fk ON true
  )
  SELECT i.schema_name,i.table_name,i.column_name,
    CASE
      WHEN i.table_name IN ('snp_account_admin_audit','snp_comptes_audit','snp_account_lifecycle_audit')
        THEN 'audit_snapshot'
      WHEN i.table_name='user_profiles' AND i.column_name='id' THEN 'identity'
      WHEN i.table_name='snp_achats_audit' AND i.column_name='acteur_id' THEN 'mixed_audit'
      WHEN i.constraint_name IS NOT NULL AND i.delete_action IN ('a','r') THEN 'blocking'
      WHEN i.table_name IN (
        'audit_logs','audit_trail','security_events','password_history',
        'user_2fa_setup','user_acceptance_logs','user_activation_tokens',
        'user_activity_logs','user_capabilities','user_capability_overrides',
        'user_invitations','user_login_history','user_permissions','user_sessions',
        'user_site_assignments','artisanal_site_assignments','snp_user_capabilities',
        'snp_user_organization_memberships','snp_notifications','snp_collector_accounts'
      ) THEN 'technical_cleanup'
      ELSE 'blocking'
    END classification,
    i.constraint_name,i.referenced_schema_name,i.referenced_table_name,
    i.referenced_column_name,i.delete_action,i.source
  FROM inventory i;
$fn$;

DO $seed_registry$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.snp_account_deletion_dependency_registry) THEN
    INSERT INTO public.snp_account_deletion_dependency_registry(
      schema_name,table_name,column_name,classification,constraint_name,
      referenced_schema_name,referenced_table_name,referenced_column_name,
      delete_action,source
    )
    SELECT schema_name,table_name,column_name,classification,constraint_name,
      referenced_schema_name,referenced_table_name,referenced_column_name,
      delete_action,source
    FROM public.snp_2m_current_dependency_inventory()
    ORDER BY schema_name,table_name,column_name;
  END IF;
END;
$seed_registry$;

-- Les journaux d'administration conservent les UUID comme snapshots immuables.
-- Les FK target/actor historiques empêcheraient le hard-delete ou supprimeraient
-- l'attribution ; elles sont retirées sans supprimer ni nullifier les données.
DO $detach_audit_fks$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT con.conname,c.relname
    FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE con.contype='f' AND n.nspname='public'
      AND c.relname IN ('snp_account_admin_audit','snp_comptes_audit')
      AND EXISTS (
        SELECT 1 FROM unnest(con.conkey) key(attnum)
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=key.attnum
        WHERE a.attname IN ('actor_id','target_id','acteur_id','cible_id')
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',v.relname,v.conname);
  END LOOP;
  UPDATE public.snp_account_deletion_dependency_registry
  SET constraint_name=NULL,referenced_schema_name=NULL,referenced_table_name=NULL,
      referenced_column_name=NULL,delete_action=NULL,source='actor_column'
  WHERE schema_name='public'
    AND table_name IN ('snp_account_admin_audit','snp_comptes_audit')
    AND column_name IN ('actor_id','target_id','acteur_id','cible_id');
END;
$detach_audit_fks$;

CREATE OR REPLACE FUNCTION public.snp_2m_require_account_admin()
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_role text;
BEGIN
  PERFORM public.snp_require_capability('accounts.manage');
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'AAL2 requis.' USING ERRCODE='42501';
  END IF;
  SELECT lower(p.role) INTO v_role FROM public.user_profiles p
  WHERE p.id=auth.uid() AND p.is_active AND p.mining_company_id IS NULL;
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Administration nationale Owner/Admin requise.' USING ERRCODE='42501';
  END IF;
  RETURN v_role;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_2m_assert_dependency_registry_complete()
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_unknown text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN LATERAL unnest(con.conkey) key(attnum) ON true
    JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=key.attnum
    JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_class dst ON dst.oid=con.confrelid
    JOIN pg_namespace dst_ns ON dst_ns.oid=dst.relnamespace
    WHERE con.contype='f' AND n.nspname='public'
      AND ((dst_ns.nspname='auth' AND dst.relname='users')
        OR (dst_ns.nspname='public' AND dst.relname='user_profiles'))
    GROUP BY con.conrelid,a.attnum HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'Plusieurs FK concurrentes sur une colonne acteur : inventaire ambigu.'
      USING ERRCODE='55000';
  END IF;

  SELECT string_agg(format('%I.%I.%I',coalesce(q.schema_name,r.schema_name),
    coalesce(q.table_name,r.table_name),coalesce(q.column_name,r.column_name)),
    ', ' ORDER BY coalesce(q.schema_name,r.schema_name),coalesce(q.table_name,r.table_name),
      coalesce(q.column_name,r.column_name))
  INTO v_unknown
  FROM public.snp_2m_current_dependency_inventory() q
  FULL JOIN public.snp_account_deletion_dependency_registry r
    USING(schema_name,table_name,column_name)
  WHERE q.table_name IS NULL OR r.table_name IS NULL
    OR q.classification IS DISTINCT FROM r.classification
    OR q.constraint_name IS DISTINCT FROM r.constraint_name
    OR q.referenced_schema_name IS DISTINCT FROM r.referenced_schema_name
    OR q.referenced_table_name IS DISTINCT FROM r.referenced_table_name
    OR q.referenced_column_name IS DISTINCT FROM r.referenced_column_name
    OR q.delete_action IS DISTINCT FROM r.delete_action
    OR q.source IS DISTINCT FROM r.source;
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Registre de dépendances compte incomplet ou dérivé : %.',v_unknown
      USING ERRCODE='55000';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_2m_account_business_activity(p_target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v record; v_exists boolean; v_blockers jsonb:='[]'::jsonb;
BEGIN
  PERFORM public.snp_2m_assert_dependency_registry_complete();
  FOR v IN
    SELECT * FROM public.snp_account_deletion_dependency_registry
    WHERE classification IN ('blocking','mixed_audit') ORDER BY table_name,column_name
  LOOP
    IF to_regclass(format('%I.%I',v.schema_name,v.table_name)) IS NULL THEN
      RAISE EXCEPTION 'Dépendance enregistrée absente : %.%.',v.table_name,v.column_name
        USING ERRCODE='55000';
    END IF;
    IF v.classification='mixed_audit' AND v.table_name='snp_achats_audit' THEN
      EXECUTE format(
        'SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1 AND NOT (' ||
        'objet=''user_profiles'' AND action=ANY($2)) LIMIT 1)',
        v.schema_name,v.table_name,v.column_name
      ) INTO v_exists USING p_target_id,ARRAY[
        'compte_cree','compte_modifie','compte_desactive','compte_reactive',
        'mfa_enrole','mfa_reinitialise','mot_de_passe_modifie'
      ];
    ELSE
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1 LIMIT 1)',
        v.schema_name,v.table_name,v.column_name) INTO v_exists USING p_target_id;
    END IF;
    IF v_exists THEN
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'table',v.table_name,'column',v.column_name));
      EXIT WHEN jsonb_array_length(v_blockers)>=20;
    END IF;
  END LOOP;
  RETURN v_blockers;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_2m_assert_target(
  p_target_id uuid,p_expected_version bigint,p_actor_role text,p_require_inactive boolean
)
RETURNS public.user_profiles
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_target public.user_profiles%ROWTYPE;
BEGIN
  IF p_target_id IS NULL OR p_target_id=auth.uid() OR p_expected_version IS NULL OR p_expected_version<0 THEN
    RAISE EXCEPTION 'Cible/version invalide.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_target FROM public.user_profiles WHERE id=p_target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_target.version<>p_expected_version THEN
    RAISE EXCEPTION 'Conflit de version compte.' USING ERRCODE='40001';
  END IF;
  IF lower(v_target.role)='owner'
     OR (p_actor_role='admin' AND lower(v_target.role)='admin')
     OR public.snp_niveau_role(v_target.role)<0
     OR public.snp_niveau_role(v_target.role)>public.snp_niveau_role(p_actor_role) THEN
    RAISE EXCEPTION 'Hiérarchie de compte refusée.' USING ERRCODE='42501';
  END IF;
  IF p_require_inactive AND v_target.is_active THEN
    RAISE EXCEPTION 'Le compte doit être inactif.' USING ERRCODE='23514';
  END IF;
  RETURN v_target;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_admin_compte_definir_statut(
  p_target_id uuid,p_expected_version bigint,p_is_active boolean,p_reason text,p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor uuid:=auth.uid(); v_actor_role text; v_target public.user_profiles%ROWTYPE;
  v_action text; v_payload jsonb; v_hash bytea; v_existing public.snp_account_lifecycle_audit%ROWTYPE;
  v_action_id uuid; v_revoked integer:=0; v_result_version bigint; v_previous_status_guc text;
BEGIN
  v_actor_role:=public.snp_2m_require_account_admin();
  IF p_is_active IS NULL OR p_idempotency_key IS NULL
     OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Paramètres de statut invalides.' USING ERRCODE='22023';
  END IF;
  v_action:=CASE WHEN p_is_active THEN 'activate' ELSE 'deactivate' END;
  v_payload:=jsonb_build_object('target_id',p_target_id,'expected_version',p_expected_version,
    'is_active',p_is_active,'reason',trim(p_reason));
  v_hash:=extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  SELECT * INTO v_existing FROM public.snp_account_lifecycle_audit
  WHERE idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.actor_id<>v_actor OR v_existing.target_id<>p_target_id
       OR v_existing.action<>v_action OR v_existing.payload_hash<>v_hash THEN
      RAISE EXCEPTION 'Clé d''idempotence réutilisée avec un autre payload.' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('action_id',v_existing.id,'target_id',v_existing.target_id,
      'previous_version',v_existing.previous_version,'version',v_existing.result_version,
      'is_active',v_existing.result_active,'status',v_existing.status,'replayed',true);
  END IF;

  v_target:=public.snp_2m_assert_target(p_target_id,p_expected_version,v_actor_role,false);
  INSERT INTO public.snp_account_lifecycle_audit(
    idempotency_key,actor_id,target_id,action,status,request_payload,payload_hash,reason,
    previous_version,previous_active
  ) VALUES(p_idempotency_key,v_actor,p_target_id,v_action,'authorized',v_payload,v_hash,
    trim(p_reason),v_target.version,v_target.is_active) RETURNING id INTO v_action_id;

  IF v_target.is_active IS DISTINCT FROM p_is_active THEN
    v_previous_status_guc:=current_setting('snp.account_status_rpc',true);
    PERFORM set_config('snp.account_status_rpc','on',true);
    BEGIN
      UPDATE public.user_profiles SET is_active=p_is_active,updated_at=clock_timestamp()
      WHERE id=p_target_id RETURNING version INTO v_result_version;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('snp.account_status_rpc',coalesce(v_previous_status_guc,''),true);
      RAISE;
    END;
    PERFORM set_config('snp.account_status_rpc',coalesce(v_previous_status_guc,''),true);
    INSERT INTO public.snp_comptes_audit(
      acteur_id,cible_id,action,ancien_etat,nouvel_etat,motif
    ) VALUES(
      v_actor,p_target_id,
      CASE WHEN p_is_active THEN 'activation' ELSE 'desactivation' END,
      v_target.is_active,p_is_active,trim(p_reason)
    );
  ELSE
    v_result_version:=v_target.version;
  END IF;
  IF NOT p_is_active THEN
    v_revoked:=public.snp_sessions_revoquer_toutes(p_target_id,false,trim(p_reason));
  END IF;
  UPDATE public.snp_account_lifecycle_audit SET status='db_completed',
    result_version=v_result_version,result_active=p_is_active,
    application_sessions_revoked=v_revoked,db_completed_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE id=v_action_id;
  RETURN jsonb_build_object('action_id',v_action_id,'target_id',p_target_id,
    'previous_version',v_target.version,'version',v_result_version,'is_active',p_is_active,
    'status','db_completed','replayed',false,'application_sessions_revoked',v_revoked);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_admin_compte_preparer_suppression(
  p_target_id uuid,p_expected_version bigint,p_reason text,p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor uuid:=auth.uid(); v_actor_role text; v_target public.user_profiles%ROWTYPE;
  v_payload jsonb; v_hash bytea; v_existing public.snp_account_lifecycle_audit%ROWTYPE;
  v_action_id uuid; v_revoked integer:=0; v_blockers jsonb;
BEGIN
  v_actor_role:=public.snp_2m_require_account_admin();
  IF p_idempotency_key IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Paramètres de suppression invalides.' USING ERRCODE='22023';
  END IF;
  v_payload:=jsonb_build_object('target_id',p_target_id,'expected_version',p_expected_version,
    'reason',trim(p_reason));
  v_hash:=extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  SELECT * INTO v_existing FROM public.snp_account_lifecycle_audit
  WHERE idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.actor_id<>v_actor OR v_existing.target_id<>p_target_id
       OR v_existing.action<>'delete' OR v_existing.payload_hash<>v_hash THEN
      RAISE EXCEPTION 'Clé d''idempotence réutilisée avec un autre payload.' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('action_id',v_existing.id,'target_id',v_existing.target_id,
      'target_version',v_existing.previous_version,'status',v_existing.status,'replayed',true);
  END IF;

  v_target:=public.snp_2m_assert_target(p_target_id,p_expected_version,v_actor_role,true);
  v_blockers:=public.snp_2m_account_business_activity(p_target_id);
  IF jsonb_array_length(v_blockers)>0 THEN
    RAISE EXCEPTION 'Le compte possède une activité métier.' USING ERRCODE='23503';
  END IF;
  INSERT INTO public.snp_account_lifecycle_audit(
    idempotency_key,actor_id,target_id,action,status,request_payload,payload_hash,reason,
    previous_version,previous_active,result_version,result_active
  ) VALUES(p_idempotency_key,v_actor,p_target_id,'delete','authorized',v_payload,v_hash,
    trim(p_reason),v_target.version,v_target.is_active,v_target.version,v_target.is_active)
  RETURNING id INTO v_action_id;
  v_revoked:=public.snp_sessions_revoquer_toutes(p_target_id,false,trim(p_reason));
  UPDATE public.snp_account_lifecycle_audit SET status='db_completed',
    application_sessions_revoked=v_revoked,db_completed_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE id=v_action_id;
  RETURN jsonb_build_object('action_id',v_action_id,'target_id',p_target_id,
    'target_version',v_target.version,'status','db_completed','replayed',false,
    'application_sessions_revoked',v_revoked);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_admin_compte_finaliser_action(
  p_idempotency_key uuid,p_success boolean,p_error_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_action public.snp_account_lifecycle_audit%ROWTYPE; v_expected text; v_error text;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Finalisation réservée au service Edge.' USING ERRCODE='42501';
  END IF;
  IF p_idempotency_key IS NULL OR p_success IS NULL THEN
    RAISE EXCEPTION 'Finalisation invalide.' USING ERRCODE='22023';
  END IF;
  v_error:=nullif(left(trim(coalesce(p_error_code,'')),80),'');
  IF p_success AND v_error IS NOT NULL THEN
    RAISE EXCEPTION 'Un succès ne porte pas de code erreur.' USING ERRCODE='22023';
  END IF;
  IF NOT p_success AND v_error IS NULL THEN
    RAISE EXCEPTION 'Un échec exige un code erreur générique.' USING ERRCODE='22023';
  END IF;
  v_expected:=CASE WHEN p_success THEN 'completed' ELSE 'failed' END;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  SELECT * INTO v_action FROM public.snp_account_lifecycle_audit
  WHERE idempotency_key=p_idempotency_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Action introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_action.status IN ('completed','failed') THEN
    IF v_action.status<>v_expected OR v_action.external_success IS DISTINCT FROM p_success
       OR v_action.external_error_code IS DISTINCT FROM v_error THEN
      RAISE EXCEPTION 'Finalisation divergente.' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('action_id',v_action.id,'target_id',v_action.target_id,
      'status',v_action.status,'replayed',true);
  END IF;
  IF v_action.status<>'db_completed' THEN
    RAISE EXCEPTION 'Transition de finalisation invalide.' USING ERRCODE='55000';
  END IF;
  UPDATE public.snp_account_lifecycle_audit SET status=v_expected,external_success=p_success,
    external_error_code=v_error,finalized_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE id=v_action.id;
  RETURN jsonb_build_object('action_id',v_action.id,'target_id',v_action.target_id,
    'status',v_expected,'replayed',false);
END;
$fn$;

-- Compatibilité : l'ancien RPC devient un adaptateur vers le contrat sécurisé.
CREATE OR REPLACE FUNCTION public.snp_definir_statut_compte(
  p_utilisateur_id uuid,p_actif boolean,p_motif text
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_version bigint;
BEGIN
  SELECT version INTO v_version FROM public.user_profiles WHERE id=p_utilisateur_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte introuvable.' USING ERRCODE='P0002'; END IF;
  PERFORM public.snp_admin_compte_definir_statut(
    p_utilisateur_id,v_version,p_actif,p_motif,gen_random_uuid());
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_2m_require_account_admin(),
  public.snp_2m_can_read_lifecycle_audit(),
  public.snp_2m_current_dependency_inventory(),
  public.snp_2m_assert_dependency_registry_complete(),
  public.snp_2m_account_business_activity(uuid),
  public.snp_2m_assert_target(uuid,bigint,text,boolean),
  public.snp_admin_compte_definir_statut(uuid,bigint,boolean,text,uuid),
  public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid),
  public.snp_admin_compte_finaliser_action(uuid,boolean,text),
  public.snp_definir_statut_compte(uuid,boolean,text)
FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.snp_2m_can_read_lifecycle_audit() TO authenticated;

GRANT EXECUTE ON FUNCTION public.snp_admin_compte_definir_statut(uuid,bigint,boolean,text,uuid),
  public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid),
  public.snp_definir_statut_compte(uuid,boolean,text)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_admin_compte_finaliser_action(uuid,boolean,text)
TO service_role;

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE con.contype='f' AND n.nspname='public'
      AND c.relname IN ('snp_account_admin_audit','snp_comptes_audit')
      AND con.confdeltype='c'
  ) THEN
    RAISE EXCEPTION 'Postflight lot 2M : CASCADE interdit sur les journaux comptes.';
  END IF;
  PERFORM public.snp_2m_assert_dependency_registry_complete();
END;
$postflight$;
