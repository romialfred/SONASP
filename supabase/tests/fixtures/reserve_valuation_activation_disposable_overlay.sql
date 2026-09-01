-- Disposable overlay for validating 20260901220000 only.
-- Load it in an isolated database that already contains the physical-stock
-- tables and `reserve_allocation_items`; never apply it to an application DB.

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE TABLE public.user_profiles(
  id uuid PRIMARY KEY,
  role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
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
  capability_code text NOT NULL REFERENCES public.snp_capability_catalog(code),
  PRIMARY KEY(role,capability_code)
);

CREATE TABLE public.snp_rpc_execution_allowlist(
  function_signature text NOT NULL,
  function_name text NOT NULL,
  grantee text NOT NULL,
  purpose text NOT NULL,
  migration_version text NOT NULL,
  PRIMARY KEY(function_signature,grantee)
);

CREATE TABLE public.modules(
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.user_permissions(
  user_id uuid NOT NULL REFERENCES public.user_profiles(id),
  module_id uuid NOT NULL REFERENCES public.modules(id),
  can_approve boolean NOT NULL DEFAULT false,
  PRIMARY KEY(user_id,module_id)
);

CREATE TABLE public.gold_prices_daily(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date date NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  spot_price numeric,
  london_pm_rate numeric,
  london_am_rate numeric,
  source text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.fx_rate_sources(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  name text
);

CREATE TABLE public.fx_rates_daily(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date NOT NULL,
  currency_pair text NOT NULL,
  rate numeric NOT NULL,
  source_id uuid REFERENCES public.fx_rate_sources(id),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.reserve_allocations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  allocation_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'DRAFT',
  gold_price_fcfa_gram numeric NOT NULL DEFAULT 0,
  usd_xof_rate numeric NOT NULL DEFAULT 0,
  eur_xof_rate numeric NOT NULL DEFAULT 0,
  fine_weight_grams numeric NOT NULL DEFAULT 0,
  indicative_value_fcfa numeric NOT NULL DEFAULT 0,
  indicative_value_usd numeric NOT NULL DEFAULT 0,
  indicative_value_eur numeric NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id),
  updated_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.snp_sec_aal2()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT auth.uid() IS NOT NULL
    AND nullif(current_setting('request.jwt.claim.aal',true),'')='aal2';
$fn$;

CREATE OR REPLACE FUNCTION public.snp_actor_has_capability(p_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT public.snp_sec_aal2() AND EXISTS(
    SELECT 1 FROM public.user_profiles profile
    WHERE profile.id=auth.uid() AND profile.is_active
      AND (
        profile.role='owner'
        OR EXISTS(
          SELECT 1 FROM public.snp_role_capabilities role_capability
          WHERE role_capability.role=profile.role
            AND role_capability.capability_code=p_code
        )
      )
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_actor_can_module_action(
  p_module_code text,p_action text
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT public.snp_sec_aal2() AND p_action='approve' AND EXISTS(
    SELECT 1
    FROM public.user_profiles profile
    JOIN public.user_permissions permission ON permission.user_id=profile.id
    JOIN public.modules module ON module.id=permission.module_id
    WHERE profile.id=auth.uid() AND profile.is_active
      AND module.name=p_module_code AND module.is_active
      AND permission.can_approve
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_reserve_permission_allowed(p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT public.snp_actor_has_capability(p_permission);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_dgmg_can_validate_reserve_level_1()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT false;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_test_reserve_capacity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NEW.status='ACTIVE' AND OLD.status IS DISTINCT FROM 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));
    IF EXISTS(
      SELECT 1
      FROM public.reserve_allocation_items item
      JOIN public.gold_inventory inventory ON inventory.id=item.inventory_id
      WHERE item.allocation_id=NEW.id AND item.released_at IS NULL
        AND (
          coalesce(inventory.quantity_allocated_oz,0)>0.000001
          OR coalesce(inventory.quantity_sold_oz,0)>0.000001
          OR coalesce(inventory.quantity_national_reserve_oz,0)>0.000001
          OR inventory.quantity_available_oz+0.000001<inventory.final_fine_oz
        )
    ) THEN
      RAISE EXCEPTION 'Reserve asset is no longer fully available.' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER snp_test_reserve_capacity_guard
BEFORE UPDATE OF status ON public.reserve_allocations
FOR EACH ROW EXECUTE FUNCTION public.snp_test_reserve_capacity_guard();

CREATE OR REPLACE FUNCTION public.snp_guard_reserve_stock_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_transition_reserve_allocation_core(
  p_allocation_id uuid,p_target_status text,p_comment text DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.reserve_allocations
  WHERE id=p_allocation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation not found.' USING ERRCODE='P0002';
  END IF;
  IF v_status<>'RECONCILED' OR upper(trim(p_target_status))<>'ACTIVE' THEN
    RAISE EXCEPTION 'Invalid transition.' USING ERRCODE='22023';
  END IF;
  UPDATE public.reserve_allocations
  SET status='ACTIVE',completed_at=clock_timestamp(),updated_by=auth.uid(),updated_at=clock_timestamp()
  WHERE id=p_allocation_id;
  UPDATE public.gold_inventory inventory
  SET quantity_available_oz=inventory.quantity_available_oz-(item.fine_weight_grams/31.1034768),
      quantity_national_reserve_oz=inventory.quantity_national_reserve_oz+(item.fine_weight_grams/31.1034768)
  FROM public.reserve_allocation_items item
  WHERE item.allocation_id=p_allocation_id
    AND item.inventory_id=inventory.id
    AND item.released_at IS NULL;
  RETURN 'ACTIVE';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_transition_reserve_allocation(
  p_allocation_id uuid,p_target_status text,p_comment text DEFAULT NULL
)
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT public.snp_transition_reserve_allocation_core(
    p_allocation_id,p_target_status,p_comment
  );
$fn$;
