-- ============================================================================
-- Paiements internationaux : résumé de vente dérivé du grand livre
-- ============================================================================
-- `sales.payment_amount` est un résumé de compatibilité. Sa source autoritative
-- est la somme des versements réels encore vivants (`processing`, `approved`).
-- Un rejet ou une annulation ne doit donc jamais laisser un montant obsolète.
-- Le trigger différé s'exécute à la fin de la transaction métier afin de ne pas
-- être écrasé par les RPC historiques qui mettent également à jour la vente.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.sales') IS NULL
     OR to_regclass('public.payments') IS NULL THEN
    RAISE EXCEPTION 'Préflight paiements : tables sales/payments absentes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales'
      AND column_name = 'payment_amount'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
      AND column_name IN ('sale_id', 'amount', 'status', 'is_virtual')
    GROUP BY table_schema, table_name
    HAVING count(*) = 4
  ) THEN
    RAISE EXCEPTION 'Préflight paiements : colonnes de synthèse incomplètes.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.snp_sync_sale_payment_summary(
  p_sale_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_payment_amount numeric;
BEGIN
  IF p_sale_id IS NULL THEN
    RETURN;
  END IF;

  -- Sérialise la synthèse avec les transitions de la vente et garantit que la
  -- ligne parente existe encore. La FK protège normalement ce dernier point.
  PERFORM 1
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT round(coalesce(sum(p.amount), 0), 2)
  INTO v_payment_amount
  FROM public.payments p
  WHERE p.sale_id = p_sale_id
    AND p.is_virtual IS FALSE
    AND p.status IN ('processing', 'approved');

  -- La garde d'immutabilité de sales autorise uniquement les RPC financières.
  -- Ce contexte est local à la transaction et n'est jamais exposé au client.
  PERFORM set_config('sonasp.payment_4h_rpc', '1', true);
  UPDATE public.sales
  SET payment_amount = v_payment_amount,
      updated_at = clock_timestamp()
  WHERE id = p_sale_id
    AND payment_amount IS DISTINCT FROM v_payment_amount;
  PERFORM set_config('sonasp.payment_4h_rpc', '0', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('sonasp.payment_4h_rpc', '0', true);
  RAISE;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_defer_sale_payment_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.snp_sync_sale_payment_summary(OLD.sale_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.sale_id IS DISTINCT FROM NEW.sale_id THEN
    PERFORM public.snp_sync_sale_payment_summary(OLD.sale_id);
  END IF;
  PERFORM public.snp_sync_sale_payment_summary(NEW.sale_id);
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_sync_sale_payment_summary(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_defer_sale_payment_summary()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS snp_payments_99_sync_sale_summary ON public.payments;
CREATE CONSTRAINT TRIGGER snp_payments_99_sync_sale_summary
AFTER INSERT OR UPDATE OR DELETE ON public.payments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.snp_defer_sale_payment_summary();

-- Réconciliation initiale sans supprimer ni inventer de mouvements.
DO $reconcile$
DECLARE
  v_sale record;
BEGIN
  FOR v_sale IN
    SELECT id AS sale_id
    FROM public.sales
    ORDER BY id
  LOOP
    PERFORM public.snp_sync_sale_payment_summary(v_sale.sale_id);
  END LOOP;
END;
$reconcile$;

COMMENT ON FUNCTION public.snp_sync_sale_payment_summary(uuid) IS
  'Recalcule sales.payment_amount depuis les paiements réels processing/approved; fonction interne fail-closed.';
COMMENT ON TRIGGER snp_payments_99_sync_sale_summary ON public.payments IS
  'Synchronisation différée du résumé de vente après toute mutation du grand livre de paiements.';

DO $postflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.payments'::regclass
      AND tgname = 'snp_payments_99_sync_sale_summary'
      AND NOT tgisinternal
      AND tgdeferrable
      AND tginitdeferred
  ) THEN
    RAISE EXCEPTION 'Postflight paiements : trigger différé absent ou non différé.';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.snp_sync_sale_payment_summary(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Postflight paiements : helper interne exposé à authenticated.';
  END IF;
END;
$postflight$;

COMMIT;
