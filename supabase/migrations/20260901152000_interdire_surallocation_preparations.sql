-- Empêche qu'une production physique soit affectée plusieurs fois au-delà de
-- sa quantité disponible. Les contrôles sont exécutés côté PostgreSQL, dans la
-- même transaction que l'écriture, et sérialisés par verrou sur la production.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
DECLARE
  v_relation text;
  v_invalid_measurements bigint;
  v_invalid_scope bigint;
  v_overallocated bigint;
BEGIN
  FOREACH v_relation IN ARRAY ARRAY[
    'public.shipping_production_items',
    'public.shipping_preparations',
    'public.daily_production'
  ] LOOP
    IF to_regclass(v_relation) IS NULL THEN
      RAISE EXCEPTION 'Migration interrompue : relation requise absente : %.',
        v_relation;
    END IF;
  END LOOP;

  IF to_regprocedure('public.snp_sec_can_read_shipping(uuid)') IS NULL
     OR to_regprocedure('public.snp_sec_can_prepare_shipping(uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Migration interrompue : gardes tenant Shipping absentes.';
  END IF;

  SELECT count(*)
  INTO v_invalid_measurements
  FROM public.shipping_production_items item
  WHERE item.net_weight_grams IS NULL
     OR item.gross_weight_grams IS NULL
     OR item.fineness_pct IS NULL
     OR item.pure_gold_grams IS NULL
     OR item.net_weight_grams <= 0
     OR item.gross_weight_grams <= 0
     OR item.net_weight_grams > item.gross_weight_grams
     OR item.fineness_pct <= 0
     OR item.fineness_pct > 100
     OR item.pure_gold_grams <= 0
     OR item.pure_gold_grams > item.net_weight_grams;

  IF v_invalid_measurements > 0 THEN
    RAISE EXCEPTION
      'Migration interrompue : % ligne(s) shipping_production_items portent des quantités physiques invalides.',
      v_invalid_measurements
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)
  INTO v_invalid_scope
  FROM public.shipping_production_items item
  JOIN public.shipping_preparations preparation
    ON preparation.id = item.shipping_preparation_id
  JOIN public.daily_production production
    ON production.id = item.daily_production_id
  WHERE preparation.mining_company_id IS NULL
     OR production.mining_company_id IS NULL
     OR preparation.mining_company_id IS DISTINCT FROM production.mining_company_id;

  IF v_invalid_scope > 0 THEN
    RAISE EXCEPTION
      'Migration interrompue : % affectation(s) sont hors du périmètre de leur société minière.',
      v_invalid_scope
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)
  INTO v_overallocated
  FROM (
    SELECT
      production.id
    FROM public.daily_production production
    JOIN public.shipping_production_items item
      ON item.daily_production_id = production.id
    GROUP BY
      production.id,
      production.bullion_grams,
      production.pure_gold_grams,
      production.estimated_fineness_pct
    HAVING sum(item.net_weight_grams) > production.bullion_grams + 0.0001
       OR sum(item.pure_gold_grams) > least(
         production.bullion_grams,
         coalesce(
           production.pure_gold_grams,
           production.bullion_grams * production.estimated_fineness_pct / 100.0
         )
       ) + 0.0001
  ) invalid_allocations;

  IF v_overallocated > 0 THEN
    RAISE EXCEPTION
      'Migration interrompue : % production(s) sont déjà suraffectées. Une régularisation contrôlée est requise.',
      v_overallocated
      USING ERRCODE = '23514';
  END IF;
END;
$preflight$;

ALTER TABLE public.shipping_production_items
  DROP CONSTRAINT IF EXISTS snp_shipping_item_weights_valid,
  DROP CONSTRAINT IF EXISTS snp_shipping_item_fineness_valid,
  DROP CONSTRAINT IF EXISTS snp_shipping_item_pure_gold_valid;

ALTER TABLE public.shipping_production_items
  ADD CONSTRAINT snp_shipping_item_weights_valid
    CHECK (
      net_weight_grams > 0
      AND net_weight_grams IS NOT NULL
      AND gross_weight_grams > 0
      AND gross_weight_grams IS NOT NULL
      AND net_weight_grams <= gross_weight_grams
    ) NOT VALID,
  ADD CONSTRAINT snp_shipping_item_fineness_valid
    CHECK (
      fineness_pct IS NOT NULL
      AND fineness_pct > 0
      AND fineness_pct <= 100
    ) NOT VALID,
  ADD CONSTRAINT snp_shipping_item_pure_gold_valid
    CHECK (
      pure_gold_grams IS NOT NULL
      AND pure_gold_grams > 0
      AND pure_gold_grams <= net_weight_grams
    ) NOT VALID;

ALTER TABLE public.shipping_production_items
  VALIDATE CONSTRAINT snp_shipping_item_weights_valid;
ALTER TABLE public.shipping_production_items
  VALIDATE CONSTRAINT snp_shipping_item_fineness_valid;
ALTER TABLE public.shipping_production_items
  VALIDATE CONSTRAINT snp_shipping_item_pure_gold_valid;

CREATE OR REPLACE FUNCTION public.snp_guard_shipping_physical_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_production_ids uuid[];
  v_preparation_ids uuid[];
  v_production public.daily_production%ROWTYPE;
  v_preparation public.shipping_preparations%ROWTYPE;
  v_old_preparation public.shipping_preparations%ROWTYPE;
  v_allocated_net numeric;
  v_allocated_pure numeric;
  v_available_pure numeric;
BEGIN
  -- Ne jamais lire OLD pendant INSERT ni NEW pendant DELETE : chaque branche
  -- construit explicitement les identifiants qu'elle est autorisee a consulter.
  IF TG_OP = 'INSERT' THEN
    v_preparation_ids := ARRAY[NEW.shipping_preparation_id];
    v_production_ids := ARRAY[NEW.daily_production_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_preparation_ids := ARRAY[OLD.shipping_preparation_id];
    v_production_ids := ARRAY[OLD.daily_production_id];
  ELSE
    v_preparation_ids := ARRAY[
      OLD.shipping_preparation_id,
      NEW.shipping_preparation_id
    ];
    v_production_ids := ARRAY[
      OLD.daily_production_id,
      NEW.daily_production_id
    ];
  END IF;

  -- Même ordre de familles que la création atomique du fret : préparation,
  -- puis production. L'ordre UUID interne évite les cycles lors d'un déplacement.
  PERFORM preparation.id
  FROM public.shipping_preparations preparation
  WHERE preparation.id = ANY (v_preparation_ids)
  ORDER BY preparation.id
  FOR UPDATE;

  PERFORM production.id
  FROM public.daily_production production
  WHERE production.id = ANY (v_production_ids)
  ORDER BY production.id
  FOR UPDATE;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT *
    INTO v_old_preparation
    FROM public.shipping_preparations
    WHERE id = OLD.shipping_preparation_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Préparation d''expédition source introuvable.'
        USING ERRCODE = '23503';
    END IF;

    IF v_old_preparation.status::text <> 'waiting_for_customs_approval' THEN
      RAISE EXCEPTION
        'Les productions d''une préparation engagée dans le workflow sont immuables.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT *
  INTO v_preparation
  FROM public.shipping_preparations
  WHERE id = NEW.shipping_preparation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Préparation d''expédition introuvable.'
      USING ERRCODE = '23503';
  END IF;

  IF v_preparation.status::text <> 'waiting_for_customs_approval' THEN
    RAISE EXCEPTION
      'Une production ne peut être affectée que pendant la préparation initiale de l''expédition.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_production
  FROM public.daily_production
  WHERE id = NEW.daily_production_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production quotidienne introuvable.'
      USING ERRCODE = '23503';
  END IF;

  IF v_production.status::text <> 'ready_for_customs' THEN
    RAISE EXCEPTION
      'Seule une production validée et prête pour la douane peut être expédiée.'
      USING ERRCODE = '23514';
  END IF;

  IF v_preparation.mining_company_id IS NULL
     OR v_production.mining_company_id IS NULL
     OR v_preparation.mining_company_id IS DISTINCT FROM v_production.mining_company_id THEN
    RAISE EXCEPTION
      'La production et la préparation doivent appartenir à la même société minière.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.net_weight_grams IS NULL
     OR NEW.gross_weight_grams IS NULL
     OR NEW.fineness_pct IS NULL
     OR NEW.pure_gold_grams IS NULL
     OR NEW.net_weight_grams <= 0
     OR NEW.gross_weight_grams <= 0
     OR NEW.net_weight_grams > NEW.gross_weight_grams
     OR NEW.fineness_pct <= 0
     OR NEW.fineness_pct > 100
     OR NEW.pure_gold_grams <= 0
     OR NEW.pure_gold_grams > NEW.net_weight_grams THEN
    RAISE EXCEPTION 'Les quantités physiques de l''affectation sont incohérentes.'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    coalesce(sum(item.net_weight_grams), 0),
    coalesce(sum(item.pure_gold_grams), 0)
  INTO v_allocated_net, v_allocated_pure
  FROM public.shipping_production_items item
  WHERE item.daily_production_id = NEW.daily_production_id
    AND item.id IS DISTINCT FROM NEW.id;

  v_available_pure := least(
    v_production.bullion_grams,
    coalesce(
      v_production.pure_gold_grams,
      v_production.bullion_grams * v_production.estimated_fineness_pct / 100.0
    )
  );

  IF v_allocated_net + NEW.net_weight_grams > v_production.bullion_grams + 0.0001 THEN
    RAISE EXCEPTION
      'Surallocation interdite : le poids net cumulé dépasse les % g disponibles.',
      v_production.bullion_grams
      USING ERRCODE = '23514';
  END IF;

  IF v_allocated_pure + NEW.pure_gold_grams > v_available_pure + 0.0001 THEN
    RAISE EXCEPTION
      'Surallocation interdite : l''or pur cumulé dépasse les % g disponibles.',
      v_available_pure
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS snp_shipping_physical_allocation_guard
  ON public.shipping_production_items;
CREATE TRIGGER snp_shipping_physical_allocation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.shipping_production_items
FOR EACH ROW
EXECUTE FUNCTION public.snp_guard_shipping_physical_allocation();

-- Corrige également l'ancien déclencheur qui ne recalculait pas la préparation
-- source lorsqu'un élément était déplacé vers une autre préparation.
CREATE OR REPLACE FUNCTION public.calculate_shipping_preparation_totals(prep_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.shipping_preparations preparation
  SET total_net_weight_grams = totals.net_weight,
      total_gross_weight_grams = totals.gross_weight,
      total_weight_oz = totals.net_weight / 31.1034768,
      total_boxes = totals.box_count,
      updated_at = clock_timestamp()
  FROM (
    SELECT
      coalesce(sum(item.net_weight_grams), 0) AS net_weight,
      coalesce(sum(item.gross_weight_grams), 0) AS gross_weight,
      count(DISTINCT item.ingot_box_number)::integer AS box_count
    FROM public.shipping_production_items item
    WHERE item.shipping_preparation_id = prep_id
  ) totals
  WHERE preparation.id = prep_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_update_shipping_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.calculate_shipping_preparation_totals(
      NEW.shipping_preparation_id
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.calculate_shipping_preparation_totals(OLD.shipping_preparation_id);
  ELSE
    PERFORM public.calculate_shipping_preparation_totals(OLD.shipping_preparation_id);

    IF NEW.shipping_preparation_id IS DISTINCT FROM OLD.shipping_preparation_id THEN
      PERFORM public.calculate_shipping_preparation_totals(
        NEW.shipping_preparation_id
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.snp_guard_shipping_physical_allocation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.calculate_shipping_preparation_totals(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trigger_update_shipping_totals()
  FROM PUBLIC, anon, authenticated, service_role;

DO $drop_item_policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shipping_production_items'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END;
$drop_item_policies$;

ALTER TABLE public.shipping_production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_production_items FORCE ROW LEVEL SECURITY;

CREATE POLICY snp_shipping_items_read_scope
ON public.shipping_production_items
FOR SELECT TO authenticated
USING (public.snp_sec_can_read_shipping(shipping_preparation_id));

CREATE POLICY snp_shipping_items_insert_scope
ON public.shipping_production_items
FOR INSERT TO authenticated
WITH CHECK (public.snp_sec_can_prepare_shipping(shipping_preparation_id));

CREATE POLICY snp_shipping_items_update_scope
ON public.shipping_production_items
FOR UPDATE TO authenticated
USING (public.snp_sec_can_prepare_shipping(shipping_preparation_id))
WITH CHECK (public.snp_sec_can_prepare_shipping(shipping_preparation_id));

CREATE POLICY snp_shipping_items_delete_scope
ON public.shipping_production_items
FOR DELETE TO authenticated
USING (public.snp_sec_can_prepare_shipping(shipping_preparation_id));

REVOKE ALL PRIVILEGES ON TABLE public.shipping_production_items
  FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.shipping_production_items
  TO authenticated;
GRANT UPDATE (
  shipping_preparation_id,
  daily_production_id,
  ingot_box_number,
  net_weight_grams,
  gross_weight_grams,
  fineness_pct,
  pure_gold_grams,
  seal_number_1,
  seal_number_2,
  order_index
) ON TABLE public.shipping_production_items TO authenticated;

-- Réconcilie en une seule passe les agrégats existants à partir de l'unique
-- source de vérité, y compris les préparations sans élément.
WITH totals AS (
  SELECT
    preparation.id AS preparation_id,
    coalesce(sum(item.net_weight_grams), 0) AS net_weight,
    coalesce(sum(item.gross_weight_grams), 0) AS gross_weight,
    count(DISTINCT item.ingot_box_number)::integer AS box_count
  FROM public.shipping_preparations preparation
  LEFT JOIN public.shipping_production_items item
    ON item.shipping_preparation_id = preparation.id
  GROUP BY preparation.id
)
UPDATE public.shipping_preparations preparation
SET total_net_weight_grams = totals.net_weight,
    total_gross_weight_grams = totals.gross_weight,
    total_weight_oz = totals.net_weight / 31.1034768,
    total_boxes = totals.box_count,
    updated_at = clock_timestamp()
FROM totals
WHERE preparation.id = totals.preparation_id;

COMMENT ON FUNCTION public.snp_guard_shipping_physical_allocation() IS
  'Sérialise et valide les affectations de production pour empêcher toute surallocation physique inter-expéditions.';
COMMENT ON TABLE public.shipping_production_items IS
  'Affectations physiques tenant-scoped ; les cumuls net et or pur ne peuvent dépasser la production source.';

NOTIFY pgrst, 'reload schema';

COMMIT;
