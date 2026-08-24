-- LOT 4C — Sessions applicatives canoniques et assainissement du lint DB.
--
-- Propriétés de sécurité :
--   * aucun jeton de session en clair n'est conservé ; l'identifiant de session
--     signé dans le JWT est réduit à une empreinte SHA-256 de 32 octets ;
--   * l'empreinte, l'acteur et l'adresse réseau sont dérivés côté serveur ;
--   * aucun DML direct navigateur n'est accordé sur user_sessions ;
--   * lecture/révocation inter-compte = accounts.manage sensible (donc AAL2) ;
--   * lecture/révocation de ses propres sessions = profil actif + AAL2 ;
--   * création et heartbeat ne peuvent concerner que le JWT courant ;
--   * les retours RPC utilisent un type expurgé qui ne contient jamais le hash.
--
-- Cette migration retire aussi des routines historiques non consommées qui
-- compilent contre des objets absents. Les rares contrats encore utilisés sont
-- corrigés ou conservés sous forme de stubs explicitement révoqués.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- --------------------------------------------------------------------------
-- 0. Préflight : échouer fermé si le graphe de sécurité attendu n'est pas là.
-- --------------------------------------------------------------------------
DO $preflight$
BEGIN
  IF to_regclass('public.user_sessions') IS NULL
     OR to_regclass('public.user_profiles') IS NULL THEN
    RAISE EXCEPTION 'Préflight 4C : user_sessions/user_profiles absent.';
  END IF;
  IF to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
     OR to_regprocedure('public.snp_mfa_satisfaite()') IS NULL
     OR to_regprocedure('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Préflight 4C : primitives capability/MFA/audit absentes.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code='accounts.manage' AND sensitive
  ) THEN
    RAISE EXCEPTION 'Préflight 4C : accounts.manage doit exister et être sensible.';
  END IF;
  IF to_regprocedure('extensions.digest(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Préflight 4C : extensions.digest(text,text) absent.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE NOT t.tgisinternal AND n.nspname='public'
      AND p.proname='validate_status_transition'
  ) THEN
    RAISE EXCEPTION
      'Préflight 4C : validate_status_transition reste attachée à un trigger ; retrait manuel requis.';
  END IF;
END;
$preflight$;

-- --------------------------------------------------------------------------
-- 1. Contrat physique user_sessions : migration du clair vers le hash.
-- --------------------------------------------------------------------------
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS token_hash bytea,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS location_country text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid,
  ADD COLUMN IF NOT EXISTS revocation_reason text;

DO $migrate_plaintext_token$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.user_sessions'::regclass
      AND attname='session_token' AND attnum>0 AND NOT attisdropped
  ) THEN
    -- Le backfill est volontairement one-way : aucune copie du jeton en clair.
    EXECUTE $sql$
      UPDATE public.user_sessions
      SET token_hash=extensions.digest(session_token,'sha256')
      WHERE token_hash IS NULL AND session_token IS NOT NULL
    $sql$;
    IF EXISTS (
      SELECT 1 FROM public.user_sessions WHERE token_hash IS NULL
    ) THEN
      RAISE EXCEPTION 'Migration 4C : une session historique ne possède aucun jeton hachable.';
    END IF;
    ALTER TABLE public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_session_token_key;
    ALTER TABLE public.user_sessions DROP COLUMN session_token;
  END IF;
END;
$migrate_plaintext_token$;

UPDATE public.user_sessions
SET created_at=coalesce(created_at,now()),
    last_activity_at=coalesce(last_activity_at,created_at,now()),
    is_active=coalesce(is_active,revoked_at IS NULL AND expires_at>now())
WHERE created_at IS NULL OR last_activity_at IS NULL OR is_active IS NULL;

ALTER TABLE public.user_sessions
  ALTER COLUMN token_hash SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN last_activity_at SET DEFAULT now(),
  ALTER COLUMN last_activity_at SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

DO $session_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.user_sessions'::regclass
      AND conname='user_sessions_token_hash_key'
  ) THEN
    ALTER TABLE public.user_sessions
      ADD CONSTRAINT user_sessions_token_hash_key UNIQUE(token_hash);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.user_sessions'::regclass
      AND conname='user_sessions_token_hash_length_check'
  ) THEN
    ALTER TABLE public.user_sessions
      ADD CONSTRAINT user_sessions_token_hash_length_check
      CHECK(octet_length(token_hash)=32) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.user_sessions'::regclass
      AND conname='user_sessions_revoked_by_fkey'
  ) THEN
    ALTER TABLE public.user_sessions
      ADD CONSTRAINT user_sessions_revoked_by_fkey
      FOREIGN KEY(revoked_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.user_sessions'::regclass
      AND conname='user_sessions_revocation_consistency_check'
  ) THEN
    ALTER TABLE public.user_sessions
      ADD CONSTRAINT user_sessions_revocation_consistency_check
      CHECK((is_active AND revoked_at IS NULL) OR NOT is_active) NOT VALID;
  END IF;
END;
$session_constraints$;

ALTER TABLE public.user_sessions
  VALIDATE CONSTRAINT user_sessions_token_hash_length_check;
ALTER TABLE public.user_sessions
  VALIDATE CONSTRAINT user_sessions_revoked_by_fkey;
ALTER TABLE public.user_sessions
  VALIDATE CONSTRAINT user_sessions_revocation_consistency_check;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_activity
  ON public.user_sessions(user_id,is_active,last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_expiry
  ON public.user_sessions(expires_at)
  WHERE is_active AND revoked_at IS NULL;

COMMENT ON COLUMN public.user_sessions.token_hash IS
  'SHA-256 binaire du claim JWT session_id ; jamais retourné par une RPC ni accordé au navigateur.';
COMMENT ON TABLE public.user_sessions IS
  'Registre applicatif de sessions. Source d’identité : JWT courant ; DML navigateur interdit.';

-- Type de sortie stable et expurgé. Une réapplication vérifie sa forme au lieu
-- de la modifier silencieusement.
DO $session_public_type$
DECLARE v_signature text;
BEGIN
  IF to_regtype('public.snp_session_public') IS NULL THEN
    CREATE TYPE public.snp_session_public AS (
      id uuid,
      user_id uuid,
      ip_address text,
      user_agent text,
      device_type text,
      browser text,
      location_country text,
      last_activity_at timestamptz,
      expires_at timestamptz,
      is_active boolean,
      is_current boolean,
      created_at timestamptz,
      revoked_at timestamptz,
      revoked_by uuid,
      revocation_reason text
    );
  ELSE
    SELECT string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod),',' ORDER BY a.attnum)
    INTO v_signature
    FROM pg_type t JOIN pg_class c ON c.oid=t.typrelid
    JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE t.oid='public.snp_session_public'::regtype
      AND a.attnum>0 AND NOT a.attisdropped;
    IF v_signature IS DISTINCT FROM
       'id:uuid,user_id:uuid,ip_address:text,user_agent:text,device_type:text,browser:text,location_country:text,last_activity_at:timestamp with time zone,expires_at:timestamp with time zone,is_active:boolean,is_current:boolean,created_at:timestamp with time zone,revoked_at:timestamp with time zone,revoked_by:uuid,revocation_reason:text' THEN
      RAISE EXCEPTION 'Préflight 4C : type snp_session_public incompatible : %.',v_signature;
    END IF;
  END IF;
END;
$session_public_type$;

-- --------------------------------------------------------------------------
-- 2. Primitives privées de dérivation et de contrôle.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_session_current_hash()
RETURNS bytea
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','extensions','pg_temp' AS $fn$
DECLARE v_session_id text;
BEGIN
  v_session_id:=auth.jwt()->>'session_id';
  IF v_session_id IS NULL OR length(v_session_id) NOT BETWEEN 8 AND 256
     OR v_session_id !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Claim JWT session_id absent ou invalide.' USING ERRCODE='22023';
  END IF;
  RETURN extensions.digest(v_session_id,'sha256');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_current_expiry()
RETURNS timestamptz
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_exp_text text; v_jwt_exp timestamptz;
BEGIN
  v_exp_text:=auth.jwt()->>'exp';
  IF v_exp_text IS NULL OR v_exp_text !~ '^[0-9]{9,12}$' THEN
    RAISE EXCEPTION 'Claim JWT exp absent ou invalide.' USING ERRCODE='22023';
  END IF;
  v_jwt_exp:=to_timestamp(v_exp_text::double precision);
  IF v_jwt_exp<=clock_timestamp() THEN
    RAISE EXCEPTION 'JWT expiré.' USING ERRCODE='42501';
  END IF;
  RETURN least(v_jwt_exp,clock_timestamp()+interval '10 minutes');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_request_ip()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','pg_temp' AS $fn$
DECLARE v_headers jsonb; v_ip text;
BEGIN
  BEGIN
    v_headers:=nullif(current_setting('request.headers',true),'')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers:='{}'::jsonb;
  END;
  v_ip:=coalesce(
    nullif(v_headers->>'cf-connecting-ip',''),
    nullif(split_part(coalesce(v_headers->>'x-forwarded-for',''),',',1),''),
    nullif(v_headers->>'x-real-ip','')
  );
  IF v_ip IS NULL THEN RETURN NULL; END IF;
  BEGIN
    RETURN host(trim(v_ip)::inet);
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_require_active_actor()
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.role(),'')<>'authenticated'
     OR NOT EXISTS(
       SELECT 1 FROM public.user_profiles p
       WHERE p.id=auth.uid() AND p.is_active
     ) THEN
    RAISE EXCEPTION 'Compte authentifié actif requis.' USING ERRCODE='42501';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_est_active()
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_hash bytea;
BEGIN
  IF coalesce(auth.role(),'')='service_role' THEN RETURN true; END IF;
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  BEGIN
    v_hash:=public.snp_session_current_hash();
  EXCEPTION WHEN SQLSTATE '22023' THEN
    RETURN false;
  END;
  RETURN EXISTS(
    SELECT 1 FROM public.user_sessions s
    WHERE s.user_id=auth.uid() AND s.token_hash=v_hash AND s.is_active
      AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_require_active_session()
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_session_est_active() THEN
    RAISE EXCEPTION 'Session applicative absente, expirée ou révoquée.' USING ERRCODE='42501';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_require_access(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF coalesce(auth.role(),'')='service_role' THEN RETURN; END IF;
  PERFORM public.snp_session_require_active_actor();
  PERFORM public.snp_require_active_session();
  IF p_user_id=auth.uid() THEN
    IF NOT public.snp_mfa_satisfaite() THEN
      RAISE EXCEPTION 'AAL2 requis pour administrer les sessions.' USING ERRCODE='42501';
    END IF;
  ELSIF NOT public.snp_actor_has_capability('accounts.manage') THEN
    RAISE EXCEPTION 'accounts.manage requis pour les sessions d''un autre compte.'
      USING ERRCODE='42501';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_to_public(
  p_session public.user_sessions,
  p_current_hash bytea
)
RETURNS public.snp_session_public
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT ROW(
    p_session.id,p_session.user_id,p_session.ip_address,p_session.user_agent,
    p_session.device_type,p_session.browser,p_session.location_country,
    p_session.last_activity_at,p_session.expires_at,
    p_session.is_active AND p_session.revoked_at IS NULL
      AND p_session.expires_at>clock_timestamp(),
    p_current_hash IS NOT NULL AND p_session.token_hash=p_current_hash,
    p_session.created_at,p_session.revoked_at,p_session.revoked_by,
    p_session.revocation_reason
  )::public.snp_session_public;
$fn$;

REVOKE ALL ON FUNCTION public.snp_session_current_hash(),
  public.snp_session_current_expiry(),public.snp_session_request_ip(),
  public.snp_session_require_active_actor(),public.snp_session_est_active(),
  public.snp_require_active_session(),public.snp_session_require_access(uuid),
  public.snp_session_to_public(public.user_sessions,bytea)
FROM PUBLIC,anon,authenticated,service_role;

-- --------------------------------------------------------------------------
-- 3. API RPC canonique. Aucun paramètre ne porte token, acteur, IP ou tenant.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_session_enregistrer(
  p_user_agent text DEFAULT NULL,
  p_device_type text DEFAULT NULL,
  p_browser text DEFAULT NULL,
  p_location_country text DEFAULT NULL
)
RETURNS public.snp_session_public
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_hash bytea; v_expiry timestamptz; v_session public.user_sessions%ROWTYPE;
BEGIN
  PERFORM public.snp_session_require_active_actor();
  IF length(coalesce(p_user_agent,''))>1024
     OR length(coalesce(p_device_type,''))>80
     OR length(coalesce(p_browser,''))>100 THEN
    RAISE EXCEPTION 'Métadonnée de session trop longue.' USING ERRCODE='22023';
  END IF;
  IF p_location_country IS NOT NULL
     AND upper(trim(p_location_country)) !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Code pays de session invalide.' USING ERRCODE='22023';
  END IF;
  v_hash:=public.snp_session_current_hash();
  v_expiry:=public.snp_session_current_expiry();

  SELECT * INTO v_session FROM public.user_sessions
  WHERE token_hash=v_hash FOR UPDATE;
  IF FOUND AND v_session.user_id<>auth.uid() THEN
    RAISE EXCEPTION 'Collision d''empreinte de session.' USING ERRCODE='23505';
  ELSIF FOUND AND (
    NOT v_session.is_active OR v_session.revoked_at IS NOT NULL
    OR v_session.expires_at<=clock_timestamp()
  ) THEN
    -- Une empreinte révoquée/expirée est irréversible. Seule une nouvelle
    -- authentification GoTrue (donc un nouveau session_id) crée une ligne.
    RAISE EXCEPTION 'Session déjà révoquée ou expirée.' USING ERRCODE='42501';
  ELSIF FOUND THEN
    UPDATE public.user_sessions
    SET ip_address=coalesce(public.snp_session_request_ip(),ip_address),
        user_agent=nullif(trim(p_user_agent),''),
        device_type=nullif(trim(p_device_type),''),
        browser=nullif(trim(p_browser),''),
        location_country=nullif(upper(trim(p_location_country)),''),
        last_activity_at=clock_timestamp(),expires_at=v_expiry,
        is_active=true,revoked_at=NULL,revoked_by=NULL,revocation_reason=NULL
    WHERE id=v_session.id RETURNING * INTO v_session;
  ELSE
    INSERT INTO public.user_sessions(
      user_id,token_hash,ip_address,user_agent,device_type,browser,
      location_country,last_activity_at,expires_at,is_active,created_at
    ) VALUES (
      auth.uid(),v_hash,public.snp_session_request_ip(),nullif(trim(p_user_agent),''),
      nullif(trim(p_device_type),''),nullif(trim(p_browser),''),
      nullif(upper(trim(p_location_country)),''),clock_timestamp(),v_expiry,true,
      clock_timestamp()
    ) RETURNING * INTO v_session;
  END IF;
  RETURN public.snp_session_to_public(v_session,v_hash);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_signaler_activite()
RETURNS public.snp_session_public
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_hash bytea; v_expiry timestamptz; v_session public.user_sessions%ROWTYPE;
BEGIN
  PERFORM public.snp_session_require_active_actor();
  v_hash:=public.snp_session_current_hash();
  v_expiry:=public.snp_session_current_expiry();
  SELECT * INTO v_session FROM public.user_sessions
  WHERE user_id=auth.uid() AND token_hash=v_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session courante non enregistrée.' USING ERRCODE='P0002';
  END IF;
  IF NOT v_session.is_active OR v_session.revoked_at IS NOT NULL
     OR v_session.expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'Session inactive, révoquée ou expirée.' USING ERRCODE='42501';
  END IF;
  IF v_session.last_activity_at<=clock_timestamp()-interval '30 seconds' THEN
    UPDATE public.user_sessions
    SET last_activity_at=clock_timestamp(),expires_at=v_expiry
    WHERE id=v_session.id RETURNING * INTO v_session;
  END IF;
  RETURN public.snp_session_to_public(v_session,v_hash);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sessions_lister(
  p_user_id uuid DEFAULT NULL,
  p_actives_seulement boolean DEFAULT true
)
RETURNS SETOF public.snp_session_public
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_target uuid; v_hash bytea;
BEGIN
  v_target:=coalesce(p_user_id,auth.uid());
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Utilisateur cible requis.' USING ERRCODE='22023';
  END IF;
  PERFORM public.snp_session_require_access(v_target);
  IF coalesce(auth.role(),'')='authenticated' THEN
    v_hash:=public.snp_session_current_hash();
  END IF;
  RETURN QUERY
  SELECT (public.snp_session_to_public(s,v_hash)).*
  FROM public.user_sessions s
  WHERE s.user_id=v_target
    AND (NOT coalesce(p_actives_seulement,true)
      OR (s.is_active AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()))
  ORDER BY s.created_at DESC,s.id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_revoquer(
  p_session_id uuid,
  p_motif text DEFAULT NULL
)
RETURNS public.snp_session_public
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_session public.user_sessions%ROWTYPE; v_hash bytea; v_other boolean;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant de session requis.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_session FROM public.user_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session introuvable.' USING ERRCODE='P0002'; END IF;
  PERFORM public.snp_session_require_access(v_session.user_id);
  v_other:=auth.uid() IS DISTINCT FROM v_session.user_id;
  IF v_other AND (p_motif IS NULL OR length(trim(p_motif))<10) THEN
    RAISE EXCEPTION 'Révocation inter-compte : motif de dix caractères minimum.'
      USING ERRCODE='22023';
  END IF;
  IF coalesce(auth.role(),'')='authenticated' THEN
    v_hash:=public.snp_session_current_hash();
  END IF;
  IF v_session.is_active OR v_session.revoked_at IS NULL THEN
    UPDATE public.user_sessions
    SET is_active=false,revoked_at=clock_timestamp(),revoked_by=auth.uid(),
        revocation_reason=nullif(trim(p_motif),'')
    WHERE id=p_session_id RETURNING * INTO v_session;
    PERFORM public.snp_record_workflow_event(
      'user-session',v_session.id,'revoked','active','revoked',
      CASE WHEN v_other THEN 'accounts.manage' ELSE 'session.self' END,
      p_motif,jsonb_build_object('user_id',v_session.user_id,'is_current',v_session.token_hash=v_hash)
    );
  END IF;
  RETURN public.snp_session_to_public(v_session,v_hash);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sessions_revoquer_toutes(
  p_user_id uuid DEFAULT NULL,
  p_excepter_session_courante boolean DEFAULT true,
  p_motif text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_target uuid; v_hash bytea; v_count integer; v_other boolean;
BEGIN
  v_target:=coalesce(p_user_id,auth.uid());
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Utilisateur cible requis.' USING ERRCODE='22023';
  END IF;
  PERFORM public.snp_session_require_access(v_target);
  v_other:=auth.uid() IS DISTINCT FROM v_target;
  IF v_other AND (p_motif IS NULL OR length(trim(p_motif))<10) THEN
    RAISE EXCEPTION 'Révocation inter-compte : motif de dix caractères minimum.'
      USING ERRCODE='22023';
  END IF;
  IF coalesce(auth.role(),'')='authenticated' THEN
    v_hash:=public.snp_session_current_hash();
  END IF;
  UPDATE public.user_sessions
  SET is_active=false,revoked_at=clock_timestamp(),revoked_by=auth.uid(),
      revocation_reason=nullif(trim(p_motif),'')
  WHERE user_id=v_target AND is_active AND revoked_at IS NULL
    AND (NOT coalesce(p_excepter_session_courante,true)
      OR v_hash IS NULL OR token_hash<>v_hash);
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count>0 THEN
    PERFORM public.snp_record_workflow_event(
      'user-sessions',v_target,'bulk-revoked','active','revoked',
      CASE WHEN v_other THEN 'accounts.manage' ELSE 'session.self' END,
      p_motif,jsonb_build_object('user_id',v_target,'revoked_count',v_count,
        'current_excluded',coalesce(p_excepter_session_courante,true))
    );
  END IF;
  RETURN v_count;
END;
$fn$;

-- --------------------------------------------------------------------------
-- 4. RLS, ACL et exposition RPC explicite.
-- --------------------------------------------------------------------------
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions FORCE ROW LEVEL SECURITY;

DO $session_policies$
DECLARE v record;
BEGIN
  FOR v IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='user_sessions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_sessions',v.policyname);
  END LOOP;
END;
$session_policies$;

CREATE POLICY snp_sessions_select_self_aal2 ON public.user_sessions
FOR SELECT TO authenticated USING (
  user_id=auth.uid()
  AND public.snp_mfa_satisfaite()
  AND EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.is_active)
);
CREATE POLICY snp_sessions_select_accounts_manage ON public.user_sessions
FOR SELECT TO authenticated USING (
  public.snp_actor_has_capability('accounts.manage')
);
CREATE POLICY snp_sessions_service_role ON public.user_sessions
FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL PRIVILEGES ON TABLE public.user_sessions FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.snp_session_enregistrer(text,text,text,text),
  public.snp_session_signaler_activite(),public.snp_sessions_lister(uuid,boolean),
  public.snp_session_revoquer(uuid,text),public.snp_sessions_revoquer_toutes(uuid,boolean,text)
FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_session_enregistrer(text,text,text,text),
  public.snp_session_signaler_activite(),public.snp_sessions_lister(uuid,boolean),
  public.snp_session_revoquer(uuid,text),public.snp_sessions_revoquer_toutes(uuid,boolean,text)
TO authenticated,service_role;

-- --------------------------------------------------------------------------
-- 5. Lint : conserver les contrats utiles, retirer les surfaces mortes.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_change_status(
  p_entity_type text,p_entity_id uuid,p_current_status text,p_new_status text,
  p_context public.status_change_context
)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_allowed boolean:=false;
BEGIN
  IF p_entity_id IS NULL THEN RETURN false; END IF;
  IF p_entity_type='production' AND p_context='production_management' THEN
    IF p_current_status='prepared' THEN
      v_allowed:=p_new_status IN ('prepared','shipped','cancelled');
    ELSIF p_current_status='shipped' THEN v_allowed:=false; END IF;
  ELSIF p_entity_type='shipping' AND p_context='shipping_management' THEN
    v_allowed:=CASE p_current_status
      WHEN 'pending' THEN p_new_status IN ('prepared','cancelled')
      WHEN 'prepared' THEN p_new_status IN ('validated_for_refinery','cancelled')
      WHEN 'validated_for_refinery' THEN p_new_status='in_refining'
      WHEN 'in_refining' THEN p_new_status='refined' ELSE false END;
  ELSIF p_entity_type='shipping' AND p_context='refining_process' THEN
    v_allowed:=(p_current_status='validated_for_refinery' AND p_new_status='in_refining')
      OR (p_current_status='in_refining' AND p_new_status='refined');
  ELSIF p_context='sales_management' THEN
    v_allowed:=(p_current_status IN ('validated_for_refinery','refined') AND p_new_status='in_sale')
      OR (p_current_status='in_sale' AND p_new_status='sold');
  END IF;
  RETURN v_allowed;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_encoder_instant_carte(instant timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'pg_catalog','pg_temp' AS $fn$
DECLARE
  alphabet36 text:='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  alphabet60 text:='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
BEGIN
  RETURN substr(alphabet36,extract(day from instant)::int+1,1)
    ||substr(alphabet36,extract(month from instant)::int+1,1)
    ||substr(alphabet36,extract(hour from instant)::int+1,1)
    ||substr(alphabet60,extract(minute from instant)::int+1,1);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_require_capability(p_capability_code text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  -- Le service_role est explicitement admis par snp_session_est_active ; tout
  -- acteur JWT doit avoir enregistré la session courante et ne pas être révoqué.
  PERFORM public.snp_require_active_session();
  IF NOT public.snp_actor_has_capability(p_capability_code) THEN
    RAISE EXCEPTION 'Capacité serveur requise : %.',p_capability_code USING ERRCODE='42501';
  END IF;
END;
$fn$;

ALTER FUNCTION public.snp_comptoir_stock_balance(uuid) VOLATILE;
ALTER FUNCTION public.snp_configurations_courriel() VOLATILE;
ALTER FUNCTION public.snp_societe_compte_mine() VOLATILE;
ALTER FUNCTION public.snp_stock_exportable_mine() VOLATILE;

-- Ces deux helpers alimentent encore sept policies legacy. Leur ancien JOIN
-- comparait user_site_assignments.site_id (uuid) à daily_production.site_id
-- (text et, dans les données live, jamais un UUID). Le périmètre canonique est
-- désormais le mining_company_id du profil ; accounts.manage sensible conserve
-- l'accès transversal attendu des administrateurs autorisés.
CREATE OR REPLACE FUNCTION public.user_accessible_companies()
RETURNS SETOF uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF public.snp_actor_has_capability('accounts.manage') THEN
    RETURN QUERY SELECT mc.id FROM public.mining_companies mc WHERE mc.is_active;
  ELSE
    RETURN QUERY
    SELECT up.mining_company_id FROM public.user_profiles up
    WHERE up.id=auth.uid() AND up.is_active AND up.mining_company_id IS NOT NULL;
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.user_has_company_access(target_company_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT target_company_id IS NOT NULL
     AND target_company_id IN (SELECT public.user_accessible_companies());
$fn$;

-- Signatures conservées pour compatibilité des tests/clients anciens, mais
-- définitivement fail-closed et sans accès aux objets obsolètes.
CREATE OR REPLACE FUNCTION public.auto_allocate_inventory(p_sale_id uuid,p_quantity_oz numeric)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF p_sale_id IS NULL OR p_quantity_oz IS NULL OR p_quantity_oz<=0 THEN
    RAISE EXCEPTION 'Paramètres d''allocation invalides.' USING ERRCODE='22023';
  END IF;
  RAISE EXCEPTION 'RPC retirée : moteur d''inventaire historique non canonique.' USING ERRCODE='0A000';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.generate_activation_token(
  p_user_id uuid,p_token_type text,p_temporary_password text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF p_user_id IS NULL OR p_token_type IS NULL
     OR p_temporary_password IS NOT NULL OR p_created_by IS NOT NULL THEN
    RAISE EXCEPTION 'Génération historique de jeton interdite.' USING ERRCODE='0A000';
  END IF;
  RAISE EXCEPTION 'RPC retirée : utiliser le flux d''activation Edge canonique.' USING ERRCODE='0A000';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_certificate_with_data(cert_id uuid)
RETURNS TABLE(certificate json,parsed_data json,approval_history json)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT NULL::json,NULL::json,NULL::json
  WHERE cert_id IS NOT NULL AND false;
$fn$;

CREATE OR REPLACE FUNCTION public.release_license_quota(
  p_license_id uuid,p_quantity numeric,p_user_id uuid DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF p_license_id IS NULL OR p_quantity IS NULL OR p_quantity<=0
     OR (p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Paramètres de libération legacy invalides.' USING ERRCODE='22023';
  END IF;
  RAISE EXCEPTION
    'RPC obsolète : utiliser snp_release_shipping_license_quota(shipping_id, reason).'
    USING ERRCODE='0A000';
END;
$fn$;

REVOKE ALL ON FUNCTION public.auto_allocate_inventory(uuid,numeric),
  public.generate_activation_token(uuid,text,text,uuid),
  public.get_certificate_with_data(uuid),public.release_license_quota(uuid,numeric,uuid)
FROM PUBLIC,anon,authenticated,service_role;

-- Aucun usage src/Edge, aucun trigger ni cron live : retrait sans CASCADE.
DROP FUNCTION IF EXISTS public.add_audit_fields(text);
DROP FUNCTION IF EXISTS public.calculate_commission(uuid,uuid,numeric,numeric,text,text);
DROP FUNCTION IF EXISTS public.calculate_forward_price(numeric,integer);
DROP FUNCTION IF EXISTS public.check_approval_escalations();
DROP FUNCTION IF EXISTS public.check_inventory_available(numeric,text);
DROP FUNCTION IF EXISTS public.determine_best_fx_rate(numeric,numeric,numeric,numeric,numeric);
DROP FUNCTION IF EXISTS public.determine_best_rate(numeric,numeric,numeric,numeric,numeric);
DROP FUNCTION IF EXISTS public.get_allowed_customers_for_seller(uuid,text);
DROP FUNCTION IF EXISTS public.get_available_inventory(integer);
DROP FUNCTION IF EXISTS public.get_next_possible_statuses(uuid);
DROP FUNCTION IF EXISTS public.get_recommended_mechanism(numeric,text);
DROP FUNCTION IF EXISTS public.is_valid_customer_for_seller(uuid,text,uuid);
DROP FUNCTION IF EXISTS public.search_audit_by_date(timestamptz,timestamptz);
DROP FUNCTION IF EXISTS public.snp_essai_modules_contractuels();
DROP FUNCTION IF EXISTS public.trigger_daily_fx_update();
DROP FUNCTION IF EXISTS public.trigger_monthly_fx_aggregation();
DROP FUNCTION IF EXISTS public.user_has_permission(uuid,text,text);
DROP FUNCTION IF EXISTS public.validate_status_transition();
DROP FUNCTION IF EXISTS public.validate_status_transition(uuid,text,text,uuid);

-- --------------------------------------------------------------------------
-- 6. Postflight déterministe.
-- --------------------------------------------------------------------------
DO $postflight$
DECLARE v_count integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.user_sessions'::regclass AND attname='session_token'
      AND attnum>0 AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.user_sessions'::regclass AND attname='token_hash'
      AND atttypid='bytea'::regtype AND attnotnull
  ) THEN
    RAISE EXCEPTION 'Postflight 4C : contrat hash user_sessions incomplet.';
  END IF;
  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'snp_session_enregistrer','snp_session_signaler_activite','snp_sessions_lister',
    'snp_session_revoquer','snp_sessions_revoquer_toutes'
  );
  IF v_count<>5 THEN RAISE EXCEPTION 'Postflight 4C : RPC sessions %/5.',v_count; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='user_sessions'
      AND grantee IN ('anon','authenticated')
  ) THEN
    RAISE EXCEPTION 'Postflight 4C : un grant table client subsiste.';
  END IF;
  IF has_function_privilege('anon','public.snp_sessions_lister(uuid,boolean)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.snp_sessions_lister(uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'Postflight 4C : ACL RPC sessions incorrecte.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosrc ~ 'eyJhbGciOiJIUzI1Ni'
  ) THEN
    RAISE EXCEPTION 'Postflight 4C : un JWT hardcodé subsiste dans une routine public.';
  END IF;
END;
$postflight$;

COMMENT ON FUNCTION public.snp_session_enregistrer(text,text,text,text) IS
  'Enregistre uniquement la session JWT courante ; hash/IP/acteur/expiration dérivés serveur.';
COMMENT ON FUNCTION public.snp_sessions_lister(uuid,boolean) IS
  'Liste expurgée : self AAL2 ou accounts.manage sensible pour une cible tierce.';
COMMENT ON FUNCTION public.snp_session_revoquer(uuid,text) IS
  'Révocation idempotente auditée ; aucun hash de session n''est retourné.';

COMMIT;

-- ROLLBACK NON DESTRUCTIF DOCUMENTÉ
-- ---------------------------------
-- Le jeton en clair supprimé ne doit jamais être restauré. En cas de problème :
--   1. REVOKE EXECUTE sur les cinq RPC snp_session_* / snp_sessions_* ;
--   2. conserver token_hash et toutes les lignes pour l'investigation ;
--   3. laisser FORCE RLS et les révocations table en place ;
--   4. livrer une migration roll-forward corrigeant uniquement les RPC ;
--   5. forcer la reconnexion Supabase si une empreinte doit être invalidée.
-- Les fonctions historiques retirées ne sont réintroduites qu'avec leurs objets,
-- tests et contrôles d'accès canoniques ; ne jamais restaurer le JWT FX embarqué.
