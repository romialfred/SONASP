/*
  Baseline jetable et autonome du lot 2M.

  A charger uniquement dans une base Supabase temporaire neuve avant
  20260825000007_lot_2m_administration_comptes_atomique.sql. Elle reproduit
  les contrats 4C nécessaires (JWT/session/capability), les journaux comptes,
  une dépendance métier bloquante et des dépendances techniques. Elle n'est
  jamais une migration et ne doit jamais être appliquée sur une base live.
*/

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

DO $roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$roles$;

CREATE TABLE public.user_profiles(
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  mining_company_id uuid,
  mfa_enrolled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.user_sessions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  session_id text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '1 hour',
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text
);

CREATE TABLE public.snp_user_capabilities(
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  capability_code text NOT NULL,
  allowed boolean NOT NULL,
  PRIMARY KEY(user_id,capability_code)
);

CREATE TABLE public.snp_comptes_audit(
  uid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acteur_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cible_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK(action IN ('activation','desactivation')),
  ancien_etat boolean NOT NULL,
  nouvel_etat boolean NOT NULL,
  motif text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.snp_account_admin_audit(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Activité métier autoritative : toute référence empêche le hard-delete.
CREATE TABLE public.approval_requests(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to uuid REFERENCES public.user_profiles(id),
  cancelled_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending'
);

-- Dépendances techniques qui peuvent être nettoyées par la suppression Auth.
CREATE TABLE public.snp_notifications(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message text
);
CREATE TABLE public.user_activation_tokens(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL
);

-- Colonne acteur sans FK : le registre doit tout de même la découvrir.
CREATE TABLE public.business_rules(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  updated_by uuid
);

CREATE OR REPLACE FUNCTION public.snp_mfa_satisfaite()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
  SELECT coalesce(auth.role(),'')='service_role' OR coalesce(
    current_setting('request.jwt.claim.aal',true),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal'
  )='aal2';
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_est_active()
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
  SELECT coalesce(auth.role(),'')='service_role' OR EXISTS(
    SELECT 1 FROM public.user_sessions s
    WHERE s.user_id=auth.uid()
      AND s.session_id=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id'
      AND s.is_active AND s.revoked_at IS NULL
      AND s.expires_at>clock_timestamp()
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_actor_has_capability(p_code text)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
  SELECT p_code='accounts.manage'
    AND public.snp_session_est_active()
    AND public.snp_mfa_satisfaite()
    AND (
      EXISTS(
        SELECT 1 FROM public.user_profiles p
        WHERE p.id=auth.uid() AND p.is_active
          AND lower(p.role) IN('owner','admin')
          AND p.mining_company_id IS NULL
      ) OR EXISTS(
        SELECT 1 FROM public.snp_user_capabilities c
        JOIN public.user_profiles p ON p.id=c.user_id AND p.is_active
        WHERE c.user_id=auth.uid() AND c.capability_code=p_code AND c.allowed
      )
    );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_require_capability(p_code text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  IF NOT public.snp_actor_has_capability(p_code) THEN
    RAISE EXCEPTION 'Capacité/session requise.' USING ERRCODE='42501';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sessions_revoquer_toutes(
  p_user_id uuid DEFAULT NULL,
  p_excepter_session_courante boolean DEFAULT true,
  p_motif text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_count integer;
BEGIN
  UPDATE public.user_sessions s
  SET is_active=false,revoked_at=clock_timestamp(),revoked_by=auth.uid(),
      revocation_reason=p_motif
  WHERE s.user_id=coalesce(p_user_id,auth.uid())
    AND s.is_active AND s.revoked_at IS NULL
    AND (NOT p_excepter_session_courante OR
      s.session_id IS DISTINCT FROM
        nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id');
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_niveau_role(p_role text)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path TO 'pg_catalog','pg_temp'
AS $fn$
  SELECT CASE lower(coalesce(p_role,''))
    WHEN 'owner' THEN 100 WHEN 'admin' THEN 90 WHEN 'management' THEN 70
    WHEN 'direction' THEN 60 WHEN 'user' THEN 10 ELSE -1 END;
$fn$;

GRANT USAGE ON SCHEMA public,auth,extensions TO anon,authenticated,service_role;
GRANT SELECT,UPDATE ON public.user_profiles,public.user_sessions TO authenticated;
GRANT SELECT ON public.snp_user_capabilities TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_mfa_satisfaite(),
  public.snp_session_est_active(),public.snp_actor_has_capability(text),
  public.snp_require_capability(text),
  public.snp_sessions_revoquer_toutes(uuid,boolean,text),public.snp_niveau_role(text)
TO authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;
