-- Minimal disposable baseline for LOT 4H only.
-- It is never a production migration and must only be loaded in an isolated
-- Supabase/PostgreSQL clone before 20260825000003.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $enum$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace AND typname='sale_status') THEN
    CREATE TYPE public.sale_status AS ENUM (
      'pending_for_customer_approval','waiting_for_payment','virtual_payment',
      'payment_received','completed','cancelled'
    );
  END IF;
END;
$enum$;

CREATE TABLE public.mining_companies(
  id uuid PRIMARY KEY, code text NOT NULL, name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.customers(
  id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.user_profiles(
  id uuid PRIMARY KEY REFERENCES auth.users(id), email text NOT NULL,
  full_name text NOT NULL, role text NOT NULL, is_active boolean NOT NULL DEFAULT true,
  customer_id uuid REFERENCES public.customers(id)
);
CREATE TABLE public.snp_capability_catalog(
  code text PRIMARY KEY, domain text NOT NULL, label text NOT NULL,
  description text NOT NULL, sensitive boolean NOT NULL DEFAULT false
);
CREATE TABLE public.snp_user_capabilities(
  user_id uuid NOT NULL REFERENCES public.user_profiles(id),
  capability_code text NOT NULL REFERENCES public.snp_capability_catalog(code),
  allowed boolean NOT NULL, PRIMARY KEY(user_id,capability_code)
);
CREATE TABLE public.snp_workflow_audit(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_type text NOT NULL, aggregate_id uuid, action text NOT NULL,
  status_before text,status_after text,actor_id uuid,actor_role text,
  capability_code text,reason text,context jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  seller_id uuid NOT NULL REFERENCES public.mining_companies(id),
  seller_type text NOT NULL,
  currency text,
  final_proceeds numeric NOT NULL,
  status public.sale_status NOT NULL,
  payment_amount numeric,payment_date date,payment_method text,
  payment_proof_url text,payment_received_at timestamptz,
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sale_id uuid NOT NULL REFERENCES public.sales(id),
  customer_id uuid REFERENCES public.customers(id),amount numeric NOT NULL,currency text NOT NULL,
  expected_date date NOT NULL,status text,is_virtual boolean,payment_type text,
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
CREATE POLICY baseline_sales_read ON public.sales FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id=auth.uid() AND up.is_active
            AND (up.role IN ('owner','management') OR up.customer_id=customer_id))
);
CREATE POLICY baseline_sales_update ON public.sales FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id=auth.uid() AND up.is_active AND up.role IN ('owner','management'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id=auth.uid() AND up.is_active AND up.role IN ('owner','management'))
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sales TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.payments TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fx_rate_analysis TO authenticated;
GRANT SELECT ON public.customer_banks,public.stakeholder_bank_accounts,
  public.fx_rates_daily,public.customers,public.mining_companies TO authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;

INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive) VALUES
('sonasp.finance.execute','finance','Execute','Execute payment',true),
('sonasp.finance.reconcile','finance','Reconcile','Reconcile payment',true);

CREATE OR REPLACE FUNCTION public.snp_require_capability(p_capability_code text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF auth.uid() IS NULL
     OR coalesce(
       nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal',
       'aal1'
     )<>'aal2'
     OR NOT EXISTS (
       SELECT 1 FROM public.user_profiles up
       JOIN public.snp_user_capabilities uc ON uc.user_id=up.id AND uc.allowed
       WHERE up.id=auth.uid() AND up.is_active
         AND uc.capability_code=p_capability_code
     ) THEN
    RAISE EXCEPTION 'Capacite AAL2 requise.' USING ERRCODE='42501';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_record_workflow_event(
  p_aggregate_type text,p_aggregate_id uuid,p_action text,
  p_status_before text,p_status_after text,p_capability_code text,
  p_reason text,p_context jsonb
)
RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_id bigint;
BEGIN
  INSERT INTO public.snp_workflow_audit(
    aggregate_type,aggregate_id,action,status_before,status_after,
    actor_id,capability_code,reason,context
  ) VALUES (
    p_aggregate_type,p_aggregate_id,p_action,p_status_before,p_status_after,
    auth.uid(),p_capability_code,p_reason,coalesce(p_context,'{}')
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_peut_consulter_vente(p_sale_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.sales s
    JOIN public.user_profiles up ON up.id=auth.uid() AND up.is_active
    WHERE s.id=p_sale_id
      AND (up.role IN ('owner','management') OR up.customer_id=s.customer_id)
  );
$fn$;
