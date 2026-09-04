-- Simulations financières préalables aux ventes internationales.
--
-- Une simulation ne réserve aucun stock et ne crée aucune vente. Elle fige les
-- sources et résultats utilisés pour l'analyse, afin que l'historique reste
-- explicable même si le cours, le taux de change ou le barème évoluent ensuite.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.sale_simulation_reference_seq START WITH 1;

CREATE TABLE IF NOT EXISTS public.sale_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_reference text NOT NULL UNIQUE DEFAULT (
    'SIM-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.sale_simulation_reference_seq')::text, 6, '0')
  ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  seller_id uuid NOT NULL REFERENCES public.mining_companies(id),
  seller_name_snapshot text NOT NULL CHECK (btrim(seller_name_snapshot) <> ''),
  counterparty_id uuid NOT NULL,
  counterparty_type text NOT NULL CHECK (counterparty_type IN ('customer', 'refinery')),
  counterparty_name_snapshot text NOT NULL CHECK (btrim(counterparty_name_snapshot) <> ''),
  stock_available_oz numeric(20,6) NOT NULL CHECK (stock_available_oz >= 0),
  quantity_oz numeric(20,6) NOT NULL CHECK (quantity_oz > 0 AND quantity_oz <= stock_available_oz),
  input_unit text NOT NULL CHECK (input_unit IN ('oz', 'g')),
  reference_price_usd_oz numeric(20,6) NOT NULL CHECK (reference_price_usd_oz > 0),
  usd_xof_rate numeric(20,8) NOT NULL CHECK (usd_xof_rate > 0),
  settlement_currency text NOT NULL DEFAULT 'USD' CHECK (settlement_currency = 'USD'),
  premium_discount_pct numeric(10,4) NOT NULL DEFAULT 0 CHECK (premium_discount_pct >= -100),
  logistics_cost_usd numeric(20,6) NOT NULL DEFAULT 0 CHECK (logistics_cost_usd >= 0),
  tax_rate_pct numeric(10,4) NOT NULL DEFAULT 0 CHECK (tax_rate_pct BETWEEN 0 AND 100),
  tax_amount_usd numeric(20,6) NOT NULL CHECK (tax_amount_usd >= 0),
  gross_value_usd numeric(20,6) NOT NULL CHECK (gross_value_usd >= 0),
  adjusted_value_usd numeric(20,6) NOT NULL CHECK (adjusted_value_usd >= 0),
  net_proceeds_usd numeric(20,6) NOT NULL,
  net_proceeds_xof numeric(24,6) NOT NULL,
  net_price_xof_oz numeric(24,6) NOT NULL,
  net_margin_pct numeric(12,6) NOT NULL,
  value_date date NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  gold_price_source text,
  fx_source text
);

CREATE INDEX IF NOT EXISTS idx_sale_simulations_created_by_date
  ON public.sale_simulations (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_simulations_seller_date
  ON public.sale_simulations (seller_id, created_at DESC);

ALTER TABLE public.sale_simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sale_simulations_select ON public.sale_simulations;
CREATE POLICY sale_simulations_select ON public.sale_simulations
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.snp_actor_has_capability('sonasp.workflow.read')
  OR public.snp_actor_has_capability('reports.read')
);

DROP POLICY IF EXISTS sale_simulations_insert ON public.sale_simulations;
CREATE POLICY sale_simulations_insert ON public.sale_simulations
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.snp_actor_has_capability('sonasp.prepare')
    OR public.snp_actor_has_capability('mine.operate')
  )
);

REVOKE ALL ON TABLE public.sale_simulations FROM anon;
REVOKE ALL ON TABLE public.sale_simulations FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.sale_simulations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.sale_simulation_reference_seq TO authenticated;

COMMENT ON TABLE public.sale_simulations IS
  'Instantanés immuables des simulations financières précédant une vente internationale.';
COMMENT ON COLUMN public.sale_simulations.premium_discount_pct IS
  'Pourcentage signé : positif pour une prime, négatif pour une décote.';

COMMIT;
