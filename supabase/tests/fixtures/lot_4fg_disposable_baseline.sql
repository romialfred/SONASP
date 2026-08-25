/*
  Baseline minimale jetable pour rejouer les lots 4F, 5E et 4G.

  Ce fichier ne constitue pas une migration de production. Il compense
  uniquement l'absence du schema initial historique dans le depot local et
  permet de verifier les migrations additives dans une base Supabase neuve.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

DO $types$
BEGIN
  IF to_regtype('public.production_status_v2') IS NULL THEN
    CREATE TYPE public.production_status_v2 AS ENUM(
      'prepared','ready_for_customs','shipped','cancelled'
    );
  END IF;
  IF to_regtype('public.shipping_preparation_status') IS NULL THEN
    CREATE TYPE public.shipping_preparation_status AS ENUM(
      'draft','pending','prepared','waiting_for_customs_approval',
      'ready_for_expedition','shipped','cancelled'
    );
  END IF;
  IF to_regtype('public.freight_customs_status') IS NULL THEN
    CREATE TYPE public.freight_customs_status AS ENUM(
      'customs_pending','customs_approved','ready_for_transport',
      'shipped_to_refinery','ready_for_expedition'
    );
  END IF;
  IF to_regtype('public.freight_document_type') IS NULL THEN
    CREATE TYPE public.freight_document_type AS ENUM(
      'customs_declaration','customs_approval','transport_document',
      'bill_of_lading','export_invoice','bullion_summary','other'
    );
  END IF;
  IF to_regtype('public.status_change_context') IS NULL THEN
    CREATE TYPE public.status_change_context AS ENUM(
      'production_management','shipping_management','refining_process',
      'sales_management','inventory_management','system'
    );
  END IF;
END;
$types$;

CREATE TABLE public.mining_companies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  country text,
  company_type text,
  is_active boolean NOT NULL DEFAULT true,
  address text,
  city text,
  localite text,
  tax_id text
);

CREATE TABLE public.user_profiles(
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  mining_company_id uuid REFERENCES public.mining_companies(id),
  mfa_enrolled_at timestamptz,
  must_change_password boolean NOT NULL DEFAULT false
);

CREATE TABLE public.user_sessions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE public.transport_companies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text
);

CREATE TABLE public.daily_production(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_date date NOT NULL,
  bullion_grams numeric NOT NULL,
  estimated_fineness_pct numeric,
  estimated_gold_pct numeric,
  mining_company_id uuid NOT NULL REFERENCES public.mining_companies(id),
  bar_reference text,
  status public.production_status_v2 NOT NULL DEFAULT 'prepared',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shipping_preparations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expedition_lot_number text UNIQUE NOT NULL,
  mining_company_id uuid NOT NULL REFERENCES public.mining_companies(id),
  status public.shipping_preparation_status NOT NULL DEFAULT 'draft',
  total_net_weight_grams numeric,
  total_weight_oz numeric,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.production_documents(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES public.daily_production(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.shipping_documents(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid NOT NULL REFERENCES public.shipping_preparations(id) ON DELETE CASCADE,
  title text NOT NULL,
  document_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assay_certificates(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid NOT NULL REFERENCES public.shipping_preparations(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  parsing_status text NOT NULL DEFAULT 'pending',
  approval_status text NOT NULL DEFAULT 'pending',
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mining_company_documents(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mining_company_id uuid NOT NULL REFERENCES public.mining_companies(id) ON DELETE CASCADE,
  doc_type text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.freight_customs_operations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid NOT NULL REFERENCES public.shipping_preparations(id) ON DELETE CASCADE,
  reference_number text UNIQUE NOT NULL,
  status public.freight_customs_status NOT NULL DEFAULT 'customs_pending',
  customs_office text,
  customs_officer_name text,
  customs_approval_date timestamptz,
  customs_reference_number text,
  transport_company_id uuid REFERENCES public.transport_companies(id),
  freight_forwarder_contact text,
  estimated_departure_date timestamptz,
  actual_departure_date timestamptz,
  estimated_arrival_date timestamptz,
  actual_arrival_date timestamptz,
  awb_number text,
  tracking_number text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.freight_customs_documents(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_customs_operation_id uuid NOT NULL REFERENCES public.freight_customs_operations(id) ON DELETE CASCADE,
  document_type public.freight_document_type NOT NULL,
  title text NOT NULL,
  description text,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now()
);

CREATE TABLE public.freight_customs_invoice_data(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_customs_operation_id uuid NOT NULL UNIQUE REFERENCES public.freight_customs_operations(id) ON DELETE CASCADE,
  sender_name text,
  sender_address text,
  sender_city text,
  sender_country text,
  sender_nif text,
  recipient_name text,
  recipient_address text,
  recipient_city text,
  recipient_country text,
  recipient_phone text,
  mine_name text,
  mine_location text,
  country_of_origin text,
  exchange_rate_fcfa_usd numeric(10,4),
  number_of_boxes integer,
  box_type text DEFAULT 'Plastic Box',
  description text,
  metal_price_cfa_per_kg numeric(15,2),
  total_value_cfa numeric(15,2),
  total_value_usd numeric(15,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.unified_status_history(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  change_context public.status_change_context NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  action_description text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unified_status_history_entity_type_check
    CHECK(entity_type IN('production','shipping'))
);

CREATE TABLE public.snp_capability_catalog(
  code text PRIMARY KEY,
  domain text NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  sensitive boolean NOT NULL DEFAULT false
);
CREATE TABLE public.snp_role_capabilities(
  role text NOT NULL,
  capability_code text NOT NULL REFERENCES public.snp_capability_catalog(code) ON DELETE CASCADE,
  PRIMARY KEY(role,capability_code)
);
CREATE TABLE public.snp_user_capabilities(
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  capability_code text NOT NULL REFERENCES public.snp_capability_catalog(code) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  reason text NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,capability_code)
);
CREATE TABLE public.snp_workflow_audit(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  action text NOT NULL,
  status_before text,
  status_after text,
  actor_id uuid REFERENCES auth.users(id),
  actor_role text,
  capability_code text,
  reason text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.snp_workflow_notification_outbox(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES
 ('mine.operate','mine','Mine','Operer pour une mine',true),
 ('sonasp.prepare','sonasp','Preparer','Preparer les workflows',true),
 ('sonasp.approve','sonasp','Approuver','Approuver les workflows',true),
 ('sonasp.workflow.read','sonasp','Lire','Lire les workflows',false),
 ('reports.read','reports','Rapports','Lire les rapports',false)
ON CONFLICT DO NOTHING;
INSERT INTO public.snp_role_capabilities(role,capability_code)
VALUES
 ('mine','mine.operate'),
 ('management','sonasp.prepare'),('management','sonasp.approve'),
 ('management','sonasp.workflow.read'),('management','reports.read'),
 ('manager','sonasp.workflow.read'),('manager','reports.read')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_mfa_satisfaite()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT coalesce(auth.jwt()->>'aal','')='aal2';
$fn$;

CREATE OR REPLACE FUNCTION public.snp_role_utilisateur()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT role FROM public.user_profiles WHERE id=auth.uid() AND is_active;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_actor_has_capability(p_capability_code text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  WITH actor AS (
    SELECT id,role FROM public.user_profiles WHERE id=auth.uid() AND is_active
  ), capability AS (
    SELECT code,sensitive FROM public.snp_capability_catalog WHERE code=p_capability_code
  ), override_value AS (
    SELECT allowed FROM public.snp_user_capabilities
    WHERE user_id=auth.uid() AND capability_code=p_capability_code
      AND valid_from<=clock_timestamp()
      AND (valid_until IS NULL OR valid_until>clock_timestamp())
  )
  SELECT CASE
    WHEN coalesce(auth.role(),'')='service_role' THEN true
    WHEN NOT EXISTS(SELECT 1 FROM actor) OR NOT EXISTS(SELECT 1 FROM capability) THEN false
    WHEN (SELECT sensitive FROM capability) AND NOT public.snp_mfa_satisfaite() THEN false
    WHEN (SELECT role FROM actor)='manager'
      AND p_capability_code NOT IN('reports.read','sonasp.workflow.read') THEN false
    WHEN EXISTS(SELECT 1 FROM override_value) THEN (SELECT allowed FROM override_value LIMIT 1)
    WHEN (SELECT role FROM actor)='owner' THEN true
    ELSE EXISTS(SELECT 1 FROM public.snp_role_capabilities rc
      WHERE rc.role=(SELECT role FROM actor) AND rc.capability_code=p_capability_code)
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_current_hash()
RETURNS bytea LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','extensions','pg_temp' AS $fn$
  SELECT extensions.digest(coalesce(auth.jwt()->>'session_id',''),'sha256');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_est_active()
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT coalesce(auth.role(),'')='service_role' OR EXISTS(
    SELECT 1 FROM public.user_sessions s
    WHERE s.user_id=auth.uid() AND s.token_hash=public.snp_session_current_hash()
      AND s.is_active AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_session_request_ip()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','pg_temp' AS $fn$
DECLARE v jsonb;
BEGIN
  BEGIN v:=nullif(current_setting('request.headers',true),'')::jsonb;
  EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
  RETURN nullif(split_part(coalesce(v->>'x-forwarded-for',''),',',1),'');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_require_capability(p_capability_code text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_session_est_active()
     OR NOT public.snp_actor_has_capability(p_capability_code) THEN
    RAISE EXCEPTION 'Capability ou session requise.' USING ERRCODE='42501';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_societe_compte_mine()
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v uuid;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'AAL2 requis.' USING ERRCODE='42501';
  END IF;
  SELECT mining_company_id INTO v FROM public.user_profiles
  WHERE id=auth.uid() AND is_active AND mining_company_id IS NOT NULL;
  IF v IS NULL THEN RAISE EXCEPTION 'Compte mine requis.' USING ERRCODE='42501'; END IF;
  RETURN v;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_read_company(p_company uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT p_company IS NOT NULL AND public.snp_session_est_active()
    AND public.snp_mfa_satisfaite() AND (
      public.snp_actor_has_capability('sonasp.workflow.read')
      OR public.snp_actor_has_capability('reports.read')
      OR (public.snp_actor_has_capability('mine.operate')
          AND p_company=(SELECT mining_company_id FROM public.user_profiles
                         WHERE id=auth.uid() AND is_active))
    );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_read_shipping(p_shipping uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT EXISTS(SELECT 1 FROM public.shipping_preparations s
    WHERE s.id=p_shipping AND public.snp_sec_can_read_company(s.mining_company_id));
$fn$;

CREATE OR REPLACE FUNCTION public.snp_peut_consulter_production(p_production uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT EXISTS(SELECT 1 FROM public.daily_production p
    WHERE p.id=p_production AND public.snp_sec_can_read_company(p.mining_company_id));
$fn$;

CREATE OR REPLACE FUNCTION public.snp_record_workflow_event(
  p_aggregate_type text,p_aggregate_id uuid,p_action text,
  p_status_before text,p_status_after text,p_capability_code text,
  p_reason text DEFAULT NULL,p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v_id bigint;
BEGIN
  INSERT INTO public.snp_workflow_audit(
    aggregate_type,aggregate_id,action,status_before,status_after,
    actor_id,actor_role,capability_code,reason,context
  ) VALUES(
    p_aggregate_type,p_aggregate_id,p_action,p_status_before,p_status_after,
    auth.uid(),public.snp_role_utilisateur(),p_capability_code,p_reason,
    coalesce(p_context,'{}'::jsonb)
  ) RETURNING id INTO v_id;
  INSERT INTO public.snp_workflow_notification_outbox(
    event_key,event_type,aggregate_type,aggregate_id,payload
  ) VALUES(
    concat_ws(':',p_aggregate_type,p_aggregate_id::text,p_action,v_id::text),
    p_action,p_aggregate_type,p_aggregate_id,
    jsonb_build_object('audit_id',v_id,'status_before',p_status_before,
      'status_after',p_status_after,'actor_id',auth.uid(),'reason',p_reason)
      ||coalesce(p_context,'{}'::jsonb)
  );
  RETURN v_id;
END;
$fn$;

-- Le trigger existe dans le schema historique avant 4F. 4F remplace son
-- implementation, et 5E s'appuie sur lui pour l'audit de statut Production.
CREATE OR REPLACE FUNCTION public.log_unified_status_change()
RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NEW; END; $fn$;
CREATE TRIGGER log_daily_production_status
AFTER INSERT OR UPDATE OF status ON public.daily_production
FOR EACH ROW EXECUTE FUNCTION public.log_unified_status_change();

GRANT USAGE ON SCHEMA public,storage,extensions TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated,service_role;
GRANT SELECT ON storage.buckets TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_actor_has_capability(text),
  public.snp_session_est_active(),public.snp_sec_can_read_company(uuid),
  public.snp_sec_can_read_shipping(uuid),public.snp_peut_consulter_production(uuid),
  public.snp_societe_compte_mine() TO authenticated,service_role;

