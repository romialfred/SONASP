BEGIN;

-- Restore the single direct-shipment guard that preceded the migration.
CREATE OR REPLACE FUNCTION public.snp_guard_conciliation_shipped_lot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $function$
DECLARE
  sp public.shipping_preparations%ROWTYPE;
BEGIN
  SELECT preparation.* INTO sp
  FROM public.sales sale
  JOIN public.shipping_preparations preparation
    ON preparation.id=sale.shipping_preparation_id
  WHERE sale.id=NEW.sale_id
    AND sale.status::text NOT IN ('cancelled','canceled','rejected');
  IF NOT FOUND OR sp.shipped_at IS NULL OR sp.refinery_id IS NULL THEN
    RAISE EXCEPTION 'La conciliation exige une vente liée à un lot effectivement expédié à une raffinerie.' USING ERRCODE='23514';
  END IF;
  IF NOT public.snp_can_read_reconciliation_scope(NEW.mining_company_id) THEN
    RAISE EXCEPTION 'Dossier hors de votre périmètre.' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.poids_initial_g:=sp.total_net_weight_grams;
    NEW.teneur_initiale_pct:=CASE WHEN sp.total_net_weight_grams>0
      AND NEW.or_fin_initial_g BETWEEN 0 AND sp.total_net_weight_grams
      THEN round(NEW.or_fin_initial_g/sp.total_net_weight_grams*100,4) END;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.snp_guard_conciliation_shipped_lot()
  FROM PUBLIC,anon,authenticated;

DROP FUNCTION IF EXISTS public.snp_conciliation_expeditions_vente(uuid);

COMMIT;
NOTIFY pgrst, 'reload schema';
