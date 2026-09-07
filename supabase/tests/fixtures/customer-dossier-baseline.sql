-- Fixture jetable PGlite uniquement. Schéma customer/customer_banks observé le 30 août,
-- confirmé par src/types/database.ts ; RLS du 5 septembre chargée par le runner.
-- Les helpers d'identité/capacité sont SIMULÉS : aucune preuve Auth/MFA réelle.
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE SCHEMA auth;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.uid',true),'')::uuid
$$;
CREATE FUNCTION public.snp_session_est_active() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.session',true)='active'
$$;
-- ACL observée sur la cible le 7 septembre : le helper de session est privé.
REVOKE ALL ON FUNCTION public.snp_session_est_active() FROM PUBLIC,authenticated,anon;
CREATE FUNCTION public.snp_actor_has_capability(p_code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,pg_temp AS $$
  SELECT current_setting('test.capability',true)=p_code
    AND current_setting('test.aal',true)='aal2'
    AND public.snp_session_est_active()
$$;
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text NOT NULL UNIQUE,
  phone text, country text NOT NULL, address text, contact_person text, tax_id text,
  payment_terms text DEFAULT 'Net 30 days',credit_limit numeric DEFAULT 0,
  status text DEFAULT 'active' CHECK(status IS NULL OR status IN ('pending','active','inactive')),
  created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),is_active boolean DEFAULT true,company text
);
CREATE TABLE public.customer_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  bank_name text NOT NULL,country text NOT NULL,city text NOT NULL,account_number text,iban text,swift_code text,
  currency text NOT NULL DEFAULT 'USD',is_primary boolean DEFAULT false,is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_customer_banks_customer_id ON public.customer_banks(customer_id);
CREATE FUNCTION public.ensure_single_primary_bank() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_primary=true THEN
    UPDATE customer_banks SET is_primary=false WHERE customer_id=NEW.customer_id AND id<>NEW.id AND is_primary=true;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ensure_single_primary_bank_trigger BEFORE INSERT OR UPDATE ON public.customer_banks
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_primary_bank();
CREATE TABLE public.customer_accounts_receivable(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_bank_id uuid REFERENCES public.customer_banks(id));
CREATE TABLE public.pre_sales(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_bank_id uuid REFERENCES public.customer_banks(id));
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_accounts_receivable ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.customers,public.customer_banks,public.customer_accounts_receivable TO authenticated;
