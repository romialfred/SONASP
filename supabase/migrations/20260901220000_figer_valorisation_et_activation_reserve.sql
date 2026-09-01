-- Reserve nationale : valorisation opposable et activation idempotente.
--
-- Cette migration ne modifie aucun fichier historique. Elle complete le modele
-- existant avec les preuves exactes des cours utilises et retire l'activation
-- de la RPC generique afin qu'un droit de rapprochement ne suffise plus.

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.reserve_allocations') IS NULL
     OR to_regclass('public.gold_prices_daily') IS NULL
     OR to_regclass('public.fx_rates_daily') IS NULL
     OR to_regclass('public.fx_rate_sources') IS NULL
     OR to_regclass('public.user_profiles') IS NULL
     OR to_regclass('public.snp_capability_catalog') IS NULL
     OR to_regclass('public.snp_role_capabilities') IS NULL
     OR to_regclass('public.snp_rpc_execution_allowlist') IS NULL
     OR to_regprocedure('public.snp_transition_reserve_allocation(uuid,text,text)') IS NULL
     OR to_regprocedure('public.snp_transition_reserve_allocation_core(uuid,text,text)') IS NULL
     OR to_regprocedure('public.snp_ensure_export_sale_physical_backing(uuid)') IS NULL
     OR to_regprocedure('public.snp_guard_reserve_stock_capacity()') IS NULL
     OR to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL
     OR to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
     OR to_regprocedure('public.snp_dgmg_can_validate_reserve_level_1()') IS NULL
     OR to_regprocedure('public.snp_sec_aal2()') IS NULL THEN
    RAISE EXCEPTION 'Prerequis de la reserve nationale absents.';
  END IF;
END;
$preflight$;

INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES(
  'reserve.allocations.activate',
  'reserve',
  'Activer une affectation',
  'Effectuer le dernier controle independant et inscrire les lingots dans la reserve nationale.',
  true
)
ON CONFLICT(code) DO UPDATE SET
  domain=EXCLUDED.domain,
  label=EXCLUDED.label,
  description=EXCLUDED.description,
  sensitive=EXCLUDED.sensitive;

INSERT INTO public.snp_role_capabilities(role,capability_code)
VALUES('management','reserve.allocations.activate')
ON CONFLICT DO NOTHING;

ALTER TABLE public.reserve_allocations
  ADD COLUMN IF NOT EXISTS gold_price_usd_oz numeric,
  ADD COLUMN IF NOT EXISTS gold_price_date date,
  ADD COLUMN IF NOT EXISTS gold_price_source text,
  ADD COLUMN IF NOT EXISTS usd_xof_rate_date date,
  ADD COLUMN IF NOT EXISTS usd_xof_rate_source text,
  ADD COLUMN IF NOT EXISTS usd_xof_currency_pair text,
  ADD COLUMN IF NOT EXISTS eur_xof_rate_date date,
  ADD COLUMN IF NOT EXISTS eur_xof_rate_source text,
  ADD COLUMN IF NOT EXISTS eur_xof_currency_pair text,
  ADD COLUMN IF NOT EXISTS valuation_source text,
  ADD COLUMN IF NOT EXISTS valuation_at timestamptz,
  ADD COLUMN IF NOT EXISTS valuation_frozen_at timestamptz;

DO $pair_constraints$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.reserve_allocations'::regclass
      AND conname='reserve_allocations_usd_xof_pair_check'
  ) THEN
    ALTER TABLE public.reserve_allocations
      ADD CONSTRAINT reserve_allocations_usd_xof_pair_check
      CHECK(usd_xof_currency_pair IS NULL OR usd_xof_currency_pair='USD/XOF');
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.reserve_allocations'::regclass
      AND conname='reserve_allocations_eur_xof_pair_check'
  ) THEN
    ALTER TABLE public.reserve_allocations
      ADD CONSTRAINT reserve_allocations_eur_xof_pair_check
      CHECK(eur_xof_currency_pair IS NULL OR eur_xof_currency_pair='EUR/XOF');
  END IF;
END;
$pair_constraints$;

CREATE TABLE IF NOT EXISTS public.snp_reserve_valuation_gaps(
  allocation_id uuid PRIMARY KEY REFERENCES public.reserve_allocations(id) ON DELETE CASCADE,
  reference text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL,
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.snp_reserve_activation_requests(
  request_key uuid PRIMARY KEY,
  allocation_id uuid NOT NULL UNIQUE REFERENCES public.reserve_allocations(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  result_status text NOT NULL CHECK(result_status='ACTIVE'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Les anciennes affectations conservent strictement les taux et montants deja
-- enregistres. La source "historique migre" rend explicite que la date de
-- publication d'origine n'etait pas stockee par l'ancien schema.
UPDATE public.reserve_allocations allocation SET
  gold_price_usd_oz=CASE
    WHEN allocation.gold_price_fcfa_gram>0 AND allocation.usd_xof_rate>0
      THEN allocation.gold_price_fcfa_gram*31.1034768/allocation.usd_xof_rate
    ELSE NULL END,
  gold_price_date=CASE WHEN allocation.gold_price_fcfa_gram>0 THEN allocation.allocation_date ELSE NULL END,
  gold_price_source=CASE WHEN allocation.gold_price_fcfa_gram>0 THEN 'Historique SONASP migre' ELSE NULL END,
  usd_xof_rate_date=CASE WHEN allocation.usd_xof_rate>0 THEN allocation.allocation_date ELSE NULL END,
  usd_xof_rate_source=CASE WHEN allocation.usd_xof_rate>0 THEN 'Historique SONASP migre' ELSE NULL END,
  eur_xof_rate_date=CASE WHEN allocation.eur_xof_rate>0 THEN allocation.allocation_date ELSE NULL END,
  eur_xof_rate_source=CASE WHEN allocation.eur_xof_rate>0 THEN 'Historique SONASP migre' ELSE NULL END,
  valuation_source=CASE
    WHEN allocation.gold_price_fcfa_gram>0 AND allocation.usd_xof_rate>0
      THEN 'Cours historiques SONASP migres (or et XOF)'
    ELSE NULL END,
  valuation_at=CASE
    WHEN allocation.gold_price_fcfa_gram>0 AND allocation.usd_xof_rate>0
      THEN coalesce(allocation.updated_at,allocation.created_at,clock_timestamp())
    ELSE NULL END,
  valuation_frozen_at=CASE
    WHEN allocation.status<>'DRAFT' AND allocation.gold_price_fcfa_gram>0 AND allocation.usd_xof_rate>0
      THEN coalesce(allocation.submitted_at,allocation.updated_at,allocation.created_at,clock_timestamp())
    ELSE NULL END
WHERE allocation.valuation_at IS NULL;

INSERT INTO public.snp_reserve_valuation_gaps(allocation_id,reference,reason)
SELECT allocation.id,allocation.reference,
       'Valorisation historique incomplete : cours or USD/oz ou parite USD/XOF absent.'
FROM public.reserve_allocations allocation
WHERE allocation.status NOT IN('DRAFT','CANCELLED','REJECTED')
  AND (
    coalesce(allocation.gold_price_usd_oz,0)<=0
    OR coalesce(allocation.usd_xof_rate,0)<=0
    OR allocation.usd_xof_currency_pair IS DISTINCT FROM 'USD/XOF'
    OR allocation.gold_price_date IS NULL
    OR allocation.usd_xof_rate_date IS NULL
  )
ON CONFLICT(allocation_id) DO UPDATE SET
  reference=EXCLUDED.reference,
  reason=EXCLUDED.reason,
  resolved_at=NULL;

CREATE OR REPLACE FUNCTION public.snp_snapshot_reserve_valuation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_gold_price numeric;
  v_gold_date date;
  v_gold_source text;
  v_usd_xof numeric;
  v_usd_xof_date date;
  v_usd_xof_source text;
  v_eur_xof numeric;
  v_eur_xof_date date;
  v_eur_xof_source text;
  v_reference_date date:=coalesce(NEW.allocation_date,current_date);
BEGIN
  IF TG_OP='UPDATE' AND OLD.status<>'DRAFT' THEN
    IF NEW.gold_price_usd_oz IS DISTINCT FROM OLD.gold_price_usd_oz
       OR NEW.gold_price_fcfa_gram IS DISTINCT FROM OLD.gold_price_fcfa_gram
       OR NEW.gold_price_date IS DISTINCT FROM OLD.gold_price_date
       OR NEW.gold_price_source IS DISTINCT FROM OLD.gold_price_source
       OR NEW.usd_xof_rate IS DISTINCT FROM OLD.usd_xof_rate
       OR NEW.usd_xof_rate_date IS DISTINCT FROM OLD.usd_xof_rate_date
       OR NEW.usd_xof_rate_source IS DISTINCT FROM OLD.usd_xof_rate_source
       OR NEW.usd_xof_currency_pair IS DISTINCT FROM OLD.usd_xof_currency_pair
       OR NEW.eur_xof_rate IS DISTINCT FROM OLD.eur_xof_rate
       OR NEW.eur_xof_rate_date IS DISTINCT FROM OLD.eur_xof_rate_date
       OR NEW.eur_xof_rate_source IS DISTINCT FROM OLD.eur_xof_rate_source
       OR NEW.eur_xof_currency_pair IS DISTINCT FROM OLD.eur_xof_currency_pair
       OR NEW.valuation_source IS DISTINCT FROM OLD.valuation_source
       OR NEW.valuation_at IS DISTINCT FROM OLD.valuation_at
       OR NEW.valuation_frozen_at IS DISTINCT FROM OLD.valuation_frozen_at
       OR NEW.indicative_value_fcfa IS DISTINCT FROM OLD.indicative_value_fcfa
       OR NEW.indicative_value_usd IS DISTINCT FROM OLD.indicative_value_usd
       OR NEW.indicative_value_eur IS DISTINCT FROM OLD.indicative_value_eur THEN
      RAISE EXCEPTION 'La valorisation d une affectation soumise est immuable.' USING ERRCODE='42501';
    END IF;
  ELSIF NEW.status='DRAFT'
        OR (TG_OP='UPDATE' AND OLD.status='DRAFT' AND NEW.status='SUBMITTED') THEN
    SELECT coalesce(price.spot_price,price.london_pm_rate,price.london_am_rate),
           price.price_date,
           coalesce(nullif(trim(price.source),''),'Referentiel or SONASP')
    INTO v_gold_price,v_gold_date,v_gold_source
    FROM public.gold_prices_daily price
    WHERE upper(coalesce(price.currency,'USD'))='USD'
      AND price.price_date<=v_reference_date
      AND coalesce(price.spot_price,price.london_pm_rate,price.london_am_rate,0)>0
    ORDER BY price.price_date DESC,price.updated_at DESC NULLS LAST,price.id DESC
    LIMIT 1;

    SELECT rate.rate,rate.rate_date,
           coalesce(nullif(trim(source.code),''),nullif(trim(source.name),''),'Referentiel XOF SONASP')
    INTO v_usd_xof,v_usd_xof_date,v_usd_xof_source
    FROM public.fx_rates_daily rate
    LEFT JOIN public.fx_rate_sources source ON source.id=rate.source_id
    WHERE replace(upper(rate.currency_pair),'-','/')='USD/XOF'
      AND rate.rate_date<=v_reference_date AND rate.rate>0
    ORDER BY rate.rate_date DESC,rate.updated_at DESC NULLS LAST,rate.id DESC
    LIMIT 1;

    SELECT rate.rate,rate.rate_date,
           coalesce(nullif(trim(source.code),''),nullif(trim(source.name),''),'Referentiel XOF SONASP')
    INTO v_eur_xof,v_eur_xof_date,v_eur_xof_source
    FROM public.fx_rates_daily rate
    LEFT JOIN public.fx_rate_sources source ON source.id=rate.source_id
    WHERE replace(upper(rate.currency_pair),'-','/')='EUR/XOF'
      AND rate.rate_date<=v_reference_date AND rate.rate>0
    ORDER BY rate.rate_date DESC,rate.updated_at DESC NULLS LAST,rate.id DESC
    LIMIT 1;

    NEW.gold_price_usd_oz:=v_gold_price;
    NEW.gold_price_date:=v_gold_date;
    NEW.gold_price_source:=v_gold_source;
    NEW.usd_xof_rate:=coalesce(v_usd_xof,0);
    NEW.usd_xof_rate_date:=v_usd_xof_date;
    NEW.usd_xof_rate_source:=v_usd_xof_source;
    NEW.usd_xof_currency_pair:=CASE WHEN v_usd_xof IS NOT NULL THEN 'USD/XOF' END;
    NEW.eur_xof_rate:=coalesce(v_eur_xof,0);
    NEW.eur_xof_rate_date:=v_eur_xof_date;
    NEW.eur_xof_rate_source:=v_eur_xof_source;
    NEW.eur_xof_currency_pair:=CASE WHEN v_eur_xof IS NOT NULL THEN 'EUR/XOF' END;
    NEW.gold_price_fcfa_gram:=CASE
      WHEN coalesce(v_gold_price,0)>0 AND coalesce(v_usd_xof,0)>0
        THEN v_gold_price*v_usd_xof/31.1034768
      ELSE 0 END;
    NEW.valuation_source:=CASE
      WHEN v_gold_source IS NOT NULL AND v_usd_xof_source IS NOT NULL
        THEN format('Or: %s ; USD/XOF: %s ; EUR/XOF: %s',
                    v_gold_source,v_usd_xof_source,coalesce(v_eur_xof_source,'indisponible'))
      ELSE NULL END;
    NEW.valuation_at:=clock_timestamp();
    NEW.valuation_frozen_at:=NULL;

    NEW.indicative_value_fcfa:=coalesce(NEW.fine_weight_grams,0)*NEW.gold_price_fcfa_gram;
    NEW.indicative_value_usd:=CASE WHEN NEW.usd_xof_rate>0
      THEN NEW.indicative_value_fcfa/NEW.usd_xof_rate ELSE 0 END;
    NEW.indicative_value_eur:=CASE WHEN NEW.eur_xof_rate>0
      THEN NEW.indicative_value_fcfa/NEW.eur_xof_rate ELSE 0 END;
  END IF;

  IF TG_OP='UPDATE' AND OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
    IF coalesce(NEW.gold_price_usd_oz,0)<=0
       OR coalesce(NEW.gold_price_fcfa_gram,0)<=0
       OR coalesce(NEW.usd_xof_rate,0)<=0
       OR NEW.usd_xof_currency_pair IS DISTINCT FROM 'USD/XOF'
       OR NEW.gold_price_date IS NULL
       OR NEW.gold_price_source IS NULL
       OR NEW.usd_xof_rate_date IS NULL
       OR NEW.usd_xof_rate_source IS NULL
       OR NEW.valuation_at IS NULL THEN
      RAISE EXCEPTION 'Cours or USD et USD/XOF dates et sources requis avant soumission.' USING ERRCODE='23514';
    END IF;
    NEW.valuation_frozen_at:=clock_timestamp();
  ELSIF TG_OP='UPDATE'
        AND OLD.status NOT IN('DRAFT','CANCELLED','REJECTED')
        AND NEW.status NOT IN('CANCELLED','REJECTED')
        AND (
          coalesce(NEW.gold_price_usd_oz,0)<=0
          OR coalesce(NEW.usd_xof_rate,0)<=0
          OR NEW.usd_xof_currency_pair IS DISTINCT FROM 'USD/XOF'
          OR NEW.valuation_frozen_at IS NULL
        ) THEN
    RAISE EXCEPTION 'Valorisation historique incomplete : regularisation requise avant transition.' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_reserve_valuation_snapshot_guard ON public.reserve_allocations;
CREATE TRIGGER snp_reserve_valuation_snapshot_guard
BEFORE INSERT OR UPDATE ON public.reserve_allocations
FOR EACH ROW EXECUTE FUNCTION public.snp_snapshot_reserve_valuation();

CREATE OR REPLACE FUNCTION public.snp_reserve_permission_allowed(p_permission text)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth','storage','extensions','pg_temp'
AS $fn$
  SELECT CASE
    WHEN coalesce(auth.role(),'')='service_role' THEN true
    WHEN p_permission NOT IN(
      'reserve.allocations.view','reserve.allocations.create','reserve.allocations.edit',
      'reserve.allocations.submit','reserve.allocations.validate_level_1',
      'reserve.allocations.validate_level_2','reserve.allocations.authorize_transfer',
      'reserve.allocations.confirm_receipt','reserve.allocations.reconcile',
      'reserve.allocations.activate','reserve.allocations.export'
    ) THEN false
    WHEN p_permission='reserve.allocations.validate_level_1'
      AND EXISTS(
        SELECT 1 FROM public.user_profiles profile
        WHERE profile.id=auth.uid() AND profile.is_active AND profile.role='dgmg'
      ) THEN public.snp_dgmg_can_validate_reserve_level_1()
    ELSE public.snp_actor_has_capability(p_permission)
  END;
$fn$;

-- La transition generique ne peut plus activer la reserve. Les appels DGMG
-- restent isoles comme auparavant.
CREATE OR REPLACE FUNCTION public.snp_transition_reserve_allocation(
  p_allocation_id uuid,
  p_target_status text,
  p_comment text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth','storage','extensions','pg_temp'
AS $fn$
BEGIN
  IF upper(trim(coalesce(p_target_status,'')))='ACTIVE' THEN
    RAISE EXCEPTION 'Utilisez l activation dediee et idempotente de la reserve.' USING ERRCODE='42501';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.user_profiles profile
    WHERE profile.id=auth.uid() AND profile.is_active AND profile.role='dgmg'
  ) THEN
    RAISE EXCEPTION 'Utilisez la file DGMG dediee a la validation de niveau 1.' USING ERRCODE='42501';
  END IF;
  RETURN public.snp_transition_reserve_allocation_core(p_allocation_id,p_target_status,p_comment);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_activate_reserve_allocation(
  p_allocation_id uuid,
  p_request_key uuid,
  p_comment text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth','storage','extensions','pg_temp'
AS $fn$
DECLARE
  v_existing public.snp_reserve_activation_requests%ROWTYPE;
  v_status text;
  v_actor uuid:=auth.uid();
  v_result text;
BEGIN
  IF p_request_key IS NULL THEN
    RAISE EXCEPTION 'Une cle d idempotence est obligatoire.' USING ERRCODE='22023';
  END IF;
  IF v_actor IS NULL OR NOT public.snp_sec_aal2() THEN
    RAISE EXCEPTION 'Une session AAL2 est obligatoire pour activer la reserve.' USING ERRCODE='42501';
  END IF;
  IF NOT public.snp_reserve_permission_allowed('reserve.allocations.activate')
     OR NOT public.snp_actor_can_module_action('national_reserve','approve') THEN
    RAISE EXCEPTION 'Activation de la reserve non autorisee.' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('SONASP:reserve-activation:'||p_request_key::text));
  -- Même arbitre transactionnel que la vente export et la réservation d'un
  -- lingot : aucune activation ne peut observer un stock périmé.
  PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));
  SELECT * INTO v_existing
  FROM public.snp_reserve_activation_requests request
  WHERE request.request_key=p_request_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.allocation_id<>p_allocation_id THEN
      RAISE EXCEPTION 'Cle d idempotence deja utilisee pour une autre affectation.' USING ERRCODE='23505';
    END IF;
    RETURN v_existing.result_status;
  END IF;

  SELECT allocation.status INTO v_status
  FROM public.reserve_allocations allocation
  WHERE allocation.id=p_allocation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Affectation introuvable.' USING ERRCODE='P0002';
  END IF;
  IF v_status='ACTIVE' THEN
    RAISE EXCEPTION 'Affectation deja activee avec une autre requete.' USING ERRCODE='23505';
  END IF;
  IF v_status<>'RECONCILED' THEN
    RAISE EXCEPTION 'Seule une affectation rapprochee peut etre activee.' USING ERRCODE='22023';
  END IF;

  v_result:=public.snp_transition_reserve_allocation_core(
    p_allocation_id,
    'ACTIVE',
    nullif(trim(p_comment),'')
  );

  INSERT INTO public.snp_reserve_activation_requests(
    request_key,allocation_id,actor_id,result_status
  ) VALUES(p_request_key,p_allocation_id,v_actor,v_result);

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON TABLE public.snp_reserve_valuation_gaps,
  public.snp_reserve_activation_requests FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_snapshot_reserve_valuation(),
  public.snp_transition_reserve_allocation_core(uuid,text,text),
  public.snp_activate_reserve_allocation(uuid,uuid,text)
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_reserve_permission_allowed(text),
  public.snp_transition_reserve_allocation(uuid,text,text)
FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.snp_reserve_permission_allowed(text),
  public.snp_transition_reserve_allocation(uuid,text,text),
  public.snp_activate_reserve_allocation(uuid,uuid,text)
TO authenticated;

INSERT INTO public.snp_rpc_execution_allowlist(
  function_signature,function_name,grantee,purpose,migration_version
)
VALUES(
  'public.snp_activate_reserve_allocation(uuid,uuid,text)',
  'snp_activate_reserve_allocation',
  'authenticated',
  'runtime-browser',
  '20260901220000'
)
ON CONFLICT(function_signature,grantee) DO UPDATE SET
  function_name=EXCLUDED.function_name,
  purpose=EXCLUDED.purpose,
  migration_version=EXCLUDED.migration_version;

DO $postflight$
BEGIN
  IF has_function_privilege('anon','public.snp_activate_reserve_allocation(uuid,uuid,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.snp_activate_reserve_allocation(uuid,uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.snp_transition_reserve_allocation_core(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Postflight reserve : grants RPC incoherents.';
  END IF;
  IF position('XAF' IN pg_get_functiondef(
       'public.snp_snapshot_reserve_valuation()'::regprocedure
     ))>0
     OR position('USD/XOF' IN pg_get_functiondef(
       'public.snp_snapshot_reserve_valuation()'::regprocedure
     ))=0
     OR position('snp_sec_aal2' IN pg_get_functiondef(
       'public.snp_activate_reserve_allocation(uuid,uuid,text)'::regprocedure
     ))=0 THEN
    RAISE EXCEPTION 'Postflight reserve : preuve XOF exacte ou garde AAL2 absente.';
  END IF;
END;
$postflight$;

NOTIFY pgrst,'reload schema';
COMMIT;
