-- Répare les rares préparations historiques dont la société porteuse ne
-- correspond plus à la production physique affectée. La production demeure
-- la source autoritative. Une préparation déjà engagée dans le fret n'est
-- jamais reparentée automatiquement.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.shipping_preparations') IS NULL
     OR to_regclass('public.shipping_production_items') IS NULL
     OR to_regclass('public.daily_production') IS NULL
     OR to_regclass('public.export_licenses') IS NULL
     OR to_regclass('public.freight_shipments') IS NULL THEN
    RAISE EXCEPTION
      'Réconciliation Shipping impossible : le socle logistique est incomplet.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shipping_production_items item
    JOIN public.shipping_preparations preparation
      ON preparation.id = item.shipping_preparation_id
    JOIN public.daily_production production
      ON production.id = item.daily_production_id
    WHERE preparation.mining_company_id IS DISTINCT FROM production.mining_company_id
    GROUP BY preparation.id
    HAVING count(DISTINCT production.mining_company_id) <> 1
       OR bool_or(production.mining_company_id IS NULL)
  ) THEN
    RAISE EXCEPTION
      'Réconciliation Shipping refusée : une préparation mélange plusieurs périmètres de production.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shipping_production_items item
    JOIN public.shipping_preparations preparation
      ON preparation.id = item.shipping_preparation_id
    JOIN public.daily_production production
      ON production.id = item.daily_production_id
    JOIN public.freight_shipments shipment
      ON shipment.shipping_preparation_id = preparation.id
     AND shipment.deleted_at IS NULL
    WHERE preparation.mining_company_id IS DISTINCT FROM production.mining_company_id
  ) THEN
    RAISE EXCEPTION
      'Réconciliation Shipping refusée : une préparation incohérente est déjà engagée dans le fret.'
      USING ERRCODE = '23514';
  END IF;
END;
$preflight$;

DO $repair$
DECLARE
  v_preparation record;
  v_license_id uuid;
BEGIN
  FOR v_preparation IN
    SELECT
      preparation.id,
      preparation.total_net_weight_grams,
      min(production.mining_company_id::text)::uuid AS mining_company_id
    FROM public.shipping_production_items item
    JOIN public.shipping_preparations preparation
      ON preparation.id = item.shipping_preparation_id
    JOIN public.daily_production production
      ON production.id = item.daily_production_id
    WHERE preparation.mining_company_id IS DISTINCT FROM production.mining_company_id
    GROUP BY preparation.id, preparation.total_net_weight_grams
    ORDER BY preparation.id
  LOOP
    SELECT license.id
    INTO v_license_id
    FROM public.export_licenses license
    WHERE license.mining_company_id = v_preparation.mining_company_id
      AND license.status = 'active'
      AND current_date BETWEEN license.start_date AND license.end_date
      AND coalesce(license.remaining_quantity_grams, 0)
          >= coalesce(v_preparation.total_net_weight_grams, 0)
    ORDER BY license.end_date, license.id
    LIMIT 1
    FOR UPDATE;

    IF v_license_id IS NULL THEN
      RAISE EXCEPTION
        'Réconciliation Shipping refusée pour % : aucune licence compatible ne couvre le poids de la préparation.',
        v_preparation.id
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.shipping_preparations
    SET mining_company_id = v_preparation.mining_company_id,
        export_license_id = v_license_id,
        license_id = v_license_id
    WHERE id = v_preparation.id;
  END LOOP;
END;
$repair$;

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.shipping_production_items item
    JOIN public.shipping_preparations preparation
      ON preparation.id = item.shipping_preparation_id
    JOIN public.daily_production production
      ON production.id = item.daily_production_id
    WHERE preparation.mining_company_id IS NULL
       OR production.mining_company_id IS NULL
       OR preparation.mining_company_id IS DISTINCT FROM production.mining_company_id
  ) THEN
    RAISE EXCEPTION
      'Postflight Shipping : des affectations restent hors périmètre.';
  END IF;
END;
$postflight$;

COMMIT;
