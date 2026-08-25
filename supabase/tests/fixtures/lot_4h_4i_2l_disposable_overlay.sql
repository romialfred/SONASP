/*
  Overlay jetable pour valider ensemble 4H + 4I + 2L.

  A charger uniquement après lot_4i_disposable_baseline.sql dans une base
  temporaire neuve. Ce fichier restitue les objets internationaux, Storage et
  session qui proviennent de migrations historiques absentes du baseline 4I.
  Ce n'est jamais une migration de production.
*/

CREATE TABLE public.mining_companies(
  id uuid PRIMARY KEY,code text NOT NULL UNIQUE,name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.customers(
  id uuid PRIMARY KEY,name text NOT NULL,email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.user_profiles
  ADD COLUMN customer_id uuid REFERENCES public.customers(id);

DO $sale_status$
BEGIN
  IF to_regtype('public.sale_status') IS NULL THEN
    CREATE TYPE public.sale_status AS ENUM(
      'pending_for_customer_approval','waiting_for_payment','virtual_payment',
      'payment_received','completed','cancelled'
    );
  END IF;
END;
$sale_status$;

CREATE TABLE public.sales(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sale_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  seller_id uuid NOT NULL REFERENCES public.mining_companies(id),
  seller_type text NOT NULL,currency text,final_proceeds numeric NOT NULL,
  status public.sale_status NOT NULL,payment_amount numeric,payment_date date,
  payment_method text,payment_proof_url text,payment_received_at timestamptz,
  customer_approved_by uuid,updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.customer_banks(
  id uuid PRIMARY KEY,customer_id uuid NOT NULL REFERENCES public.customers(id),
  currency text NOT NULL,bank_name text NOT NULL,account_number text,
  is_active boolean DEFAULT true
);
CREATE TABLE public.stakeholder_bank_accounts(
  id uuid PRIMARY KEY,stakeholder_id uuid NOT NULL,stakeholder_type text NOT NULL,
  account_currency text NOT NULL,is_active boolean DEFAULT true,
  verification_status text NOT NULL,valid_from timestamptz,valid_to timestamptz
);
CREATE TABLE public.fx_rates_daily(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),currency_pair text NOT NULL,
  rate numeric NOT NULL,rate_date date NOT NULL,notes text
);
CREATE TABLE public.payments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  customer_id uuid REFERENCES public.customers(id),amount numeric NOT NULL,
  currency text NOT NULL,expected_date date NOT NULL,status text,
  is_virtual boolean,payment_type text,
  customer_bank_id uuid REFERENCES public.customer_banks(id),
  seller_bank_id uuid REFERENCES public.stakeholder_bank_accounts(id),
  payment_currency text,receiving_currency text,received_amount numeric,
  actual_date date,bank_name text,account_number text,reference_number text,
  transaction_id text,fx_rate numeric,proof_url text,notes text,
  created_by uuid,approved_by uuid,approved_at timestamptz,
  converted_by uuid,converted_to_actual_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.fx_rate_analysis(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id),notes text
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY combined_sales_read ON public.sales FOR SELECT TO authenticated
USING (
  EXISTS(SELECT 1 FROM public.user_profiles up
         WHERE up.id=auth.uid() AND up.is_active
           AND (up.role IN('owner','management') OR up.customer_id=customer_id))
);
CREATE POLICY combined_sales_update ON public.sales FOR UPDATE TO authenticated
USING (
  EXISTS(SELECT 1 FROM public.user_profiles up
         WHERE up.id=auth.uid() AND up.is_active AND up.role IN('owner','management'))
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.user_profiles up
         WHERE up.id=auth.uid() AND up.is_active AND up.role IN('owner','management'))
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sales,public.payments,
  public.fx_rate_analysis TO authenticated;
GRANT SELECT ON public.customer_banks,public.stakeholder_bank_accounts,
  public.fx_rates_daily,public.customers,public.mining_companies TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_peut_consulter_vente(p_sale_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT EXISTS(
    SELECT 1 FROM public.sales s
    JOIN public.user_profiles up ON up.id=auth.uid() AND up.is_active
    WHERE s.id=p_sale_id
      AND (up.role IN('owner','management') OR up.customer_id=s.customer_id)
  );
$fn$;

-- Le test 2L vérifie la valeur action ; 4I utilise event_type. Le fixture écrit
-- les deux afin de représenter le drift historique sans le masquer.
ALTER TABLE public.snp_workflow_audit ADD COLUMN action text;
CREATE OR REPLACE FUNCTION public.snp_record_workflow_event(
  p_aggregate_type text,p_aggregate_id uuid,p_event_type text,
  p_from text,p_to text,p_capability text,p_reason text,p_context jsonb
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  INSERT INTO public.snp_workflow_audit(
    aggregate_type,aggregate_id,event_type,action,from_status,to_status,
    actor_id,actor_role,capability_code,reason,context
  ) VALUES(
    p_aggregate_type,p_aggregate_id,p_event_type,p_event_type,p_from,p_to,
    auth.uid(),auth.role(),p_capability,p_reason,coalesce(p_context,'{}')
  );
END;
$fn$;

-- Contrat session minimal : aucune valeur de jeton brute, uniquement le claim
-- session_id de cette base jetable. Le contrat complet reste celui du lot 4C.
CREATE TABLE public.user_sessions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
  session_id text NOT NULL UNIQUE,is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '1 hour',
  revoked_at timestamptz
);
CREATE OR REPLACE FUNCTION public.snp_session_est_active()
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT auth.role()='service_role' OR EXISTS(
    SELECT 1 FROM public.user_sessions s
    WHERE s.user_id=auth.uid()
      AND s.session_id=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id'
      AND s.is_active AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
  );
$fn$;
CREATE OR REPLACE FUNCTION public.snp_session_enregistrer(
  p_user_agent text,p_device_type text,p_browser text,p_country text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_session text;
BEGIN
  v_session:=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id';
  IF auth.uid() IS NULL OR coalesce(v_session,'')='' THEN
    RAISE EXCEPTION 'Session JWT requise.' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.user_sessions(user_id,session_id)
  VALUES(auth.uid(),v_session)
  ON CONFLICT(session_id) DO UPDATE SET
    is_active=true,revoked_at=NULL,expires_at=clock_timestamp()+interval '1 hour';
  RETURN jsonb_build_object('registered',true,'session_id',v_session,
    'device_type',p_device_type,'browser',p_browser,'country',p_country,
    'user_agent_present',coalesce(p_user_agent,'')<>'');
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.snp_session_enregistrer(text,text,text,text)
  TO authenticated;

-- Dans l'image Supabase, le schéma storage appartient à supabase_admin.
\connect postgres supabase_admin
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets(
  id text PRIMARY KEY,name text NOT NULL UNIQUE,public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,allowed_mime_types text[]
);
CREATE TABLE storage.objects(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),name text NOT NULL,
  owner_id uuid,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(bucket_id,name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated,service_role;
GRANT SELECT ON storage.objects TO authenticated;
