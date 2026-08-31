-- Instantané explicite de la source et de la date des cours appliqués.
BEGIN;
ALTER TABLE public.reserve_allocations
  ADD COLUMN IF NOT EXISTS valuation_source text NOT NULL DEFAULT 'LBMA / BCEAO',
  ADD COLUMN IF NOT EXISTS valuation_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.snp_stamp_reserve_valuation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $fn$
BEGIN
  NEW.valuation_source := 'LBMA / BCEAO';
  NEW.valuation_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS reserve_valuation_stamp ON public.reserve_allocations;
CREATE TRIGGER reserve_valuation_stamp
BEFORE INSERT OR UPDATE OF gold_price_fcfa_gram,usd_xof_rate,eur_xof_rate
ON public.reserve_allocations
FOR EACH ROW EXECUTE FUNCTION public.snp_stamp_reserve_valuation();
COMMIT;
