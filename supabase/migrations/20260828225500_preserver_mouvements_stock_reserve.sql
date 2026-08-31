-- Le trigger historique recalculait le disponible à chaque UPDATE, annulant les
-- mouvements de stock. L'initialisation est désormais réservée à l'INSERT.
BEGIN;

CREATE OR REPLACE FUNCTION public.calculate_final_fine()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $fn$
BEGIN
  NEW.final_fine_grams := (
    NEW.weight_after_melting_grams
    * (NEW.fineness_percentage / 100)
    * (NEW.metal_retained_percentage / 100)
  );
  NEW.final_fine_oz := NEW.final_fine_grams / 28.3495;

  IF TG_OP = 'INSERT' AND NEW.transaction_type = 'entry' THEN
    NEW.quantity_available_oz := NEW.final_fine_oz;
    NEW.quantity_allocated_oz := 0;
    NEW.quantity_sold_oz := 0;
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_zero_operational_stock_on_reserve()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $fn$
BEGIN
  -- Une ligne de gold_inventory représente ici un lingot indivisible : son
  -- affectation complète à la réserve doit fermer sa disponibilité opérationnelle.
  IF NEW.quantity_national_reserve_oz > OLD.quantity_national_reserve_oz THEN
    NEW.quantity_available_oz := 0;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trigger_zero_operational_stock_on_reserve ON public.gold_inventory;
CREATE TRIGGER trigger_zero_operational_stock_on_reserve
BEFORE UPDATE OF quantity_national_reserve_oz ON public.gold_inventory
FOR EACH ROW EXECUTE FUNCTION public.snp_zero_operational_stock_on_reserve();

COMMIT;
