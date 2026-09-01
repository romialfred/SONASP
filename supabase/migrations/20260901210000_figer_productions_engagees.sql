-- ============================================================================
-- Productions : figer les donnees physiques des qu'un achat les engage
-- ============================================================================
-- Une allocation d'achat est une ecriture opposable. Modifier ensuite le poids,
-- la teneur, la date ou la societe de la production rendrait faux le stock et
-- la couverture de l'achat sans rejouer les verrous et les calculs. La garde
-- porte sur toutes les voies d'ecriture, y compris un appel PostgREST forge.
-- Les observations restent editables ; une correction physique exige d'abord
-- l'annulation auditée de l'achat et la liberation de ses allocations.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
DECLARE
  v_invalid uuid;
BEGIN
  IF to_regclass('public.daily_production') IS NULL
     OR to_regclass('public.snp_achats_productions') IS NULL
     OR to_regclass('public.snp_achats_mines') IS NULL THEN
    RAISE EXCEPTION 'Préflight productions engagées : relations absentes.';
  END IF;

  SELECT allocation.id INTO v_invalid
  FROM public.snp_achats_productions allocation
  JOIN public.snp_achats_mines purchase ON purchase.id = allocation.achat_id
  JOIN public.daily_production production ON production.id = allocation.production_id
  WHERE purchase.statut = 'annulee'
     OR production.status::text = 'cancelled'
     OR production.mining_company_id IS DISTINCT FROM purchase.mining_company_id
     OR production.production_date < purchase.periode_debut
     OR production.production_date > purchase.periode_fin
  ORDER BY allocation.id
  LIMIT 1;
  IF v_invalid IS NOT NULL THEN
    RAISE EXCEPTION
      'Préflight productions engagées : allocation historique incohérente (%).',
      v_invalid USING ERRCODE = '23514';
  END IF;

  SELECT allocation.production_id INTO v_invalid
  FROM public.snp_achats_productions allocation
  JOIN public.daily_production production ON production.id = allocation.production_id
  GROUP BY allocation.production_id, production.estimated_oz
  HAVING sum(allocation.quantite_oz) > coalesce(production.estimated_oz, 0) + 0.000001
  ORDER BY allocation.production_id
  LIMIT 1;
  IF v_invalid IS NOT NULL THEN
    RAISE EXCEPTION
      'Préflight productions engagées : production déjà sur-allouée (%).',
      v_invalid USING ERRCODE = '23514';
  END IF;
END;
$preflight$;

-- Aucune mutation d'allocation depuis les rôles API. Les fonctions serveur et
-- triggers SECURITY DEFINER restent les seules voies d'écriture autorisées.
ALTER TABLE public.snp_achats_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_achats_productions FORCE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.snp_achats_productions
  FROM PUBLIC, anon, authenticated, service_role;

-- La vérification historique calculait le cumul sans verrouiller la production.
-- Deux allocations internes concurrentes pouvaient donc lire le même disponible.
-- Le verrou de la production sérialise désormais tous les acheteurs, y compris
-- la fonction FIFO et les tâches privilégiées de reprise.
CREATE OR REPLACE FUNCTION public.snp_verifier_achat_production()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_achat public.snp_achats_mines%ROWTYPE;
  v_prod public.daily_production%ROWTYPE;
  v_deja numeric;
BEGIN
  SELECT * INTO v_achat
  FROM public.snp_achats_mines
  WHERE id = NEW.achat_id
  FOR SHARE;
  SELECT * INTO v_prod
  FROM public.daily_production
  WHERE id = NEW.production_id
  FOR UPDATE;

  IF v_achat.id IS NULL OR v_prod.id IS NULL THEN
    RAISE EXCEPTION 'Allocation orpheline.' USING ERRCODE = '23503';
  END IF;
  IF v_achat.statut = 'annulee' THEN
    RAISE EXCEPTION 'Un achat annulé ne peut conserver une allocation.'
      USING ERRCODE = '23514';
  END IF;
  IF v_prod.mining_company_id IS DISTINCT FROM v_achat.mining_company_id THEN
    RAISE EXCEPTION 'La production allouée appartient à une autre société.'
      USING ERRCODE = '23514';
  END IF;
  IF v_prod.production_date < v_achat.periode_debut
     OR v_prod.production_date > v_achat.periode_fin THEN
    RAISE EXCEPTION 'La production est hors période d''achat.'
      USING ERRCODE = '23514';
  END IF;
  IF v_prod.status::text = 'cancelled' THEN
    RAISE EXCEPTION 'Une production annulée ne s''alloue pas.'
      USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(sum(allocation.quantite_oz), 0)
  INTO v_deja
  FROM public.snp_achats_productions allocation
  WHERE allocation.production_id = NEW.production_id
    AND (TG_OP = 'INSERT' OR allocation.id <> NEW.id);

  IF v_deja + NEW.quantite_oz > coalesce(v_prod.estimated_oz, 0) + 0.000001 THEN
    RAISE EXCEPTION
      'Sur-allocation : le cumul demandé dépasse la quantité déclarée.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_verifier_achat_production()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.snp_guard_engaged_production_measurements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.production_date IS NOT DISTINCT FROM OLD.production_date
     AND NEW.mining_company_id IS NOT DISTINCT FROM OLD.mining_company_id
     AND NEW.site_id IS NOT DISTINCT FROM OLD.site_id
     AND NEW.bar_reference IS NOT DISTINCT FROM OLD.bar_reference
     AND NEW.bullion_grams IS NOT DISTINCT FROM OLD.bullion_grams
     AND NEW.estimated_fineness_pct IS NOT DISTINCT FROM OLD.estimated_fineness_pct
     AND NEW.estimated_gold_pct IS NOT DISTINCT FROM OLD.estimated_gold_pct
     AND NEW.estimated_silver_pct IS NOT DISTINCT FROM OLD.estimated_silver_pct
     AND NEW.pure_gold_grams IS NOT DISTINCT FROM OLD.pure_gold_grams
     AND NEW.estimated_oz IS NOT DISTINCT FROM OLD.estimated_oz
     AND NEW.silver_content_grams IS NOT DISTINCT FROM OLD.silver_content_grams THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.snp_achats_productions allocation
    JOIN public.snp_achats_mines purchase ON purchase.id = allocation.achat_id
    WHERE allocation.production_id = OLD.id
      AND purchase.statut <> 'annulee'
  ) THEN
    RAISE EXCEPTION
      'Production engagée : annulez l''achat et libérez ses allocations avant de corriger les données physiques.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_guard_engaged_production_measurements()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS snp_daily_production_engagement_guard
  ON public.daily_production;
CREATE TRIGGER snp_daily_production_engagement_guard
BEFORE UPDATE OF
  production_date,
  mining_company_id,
  site_id,
  bar_reference,
  bullion_grams,
  estimated_fineness_pct,
  estimated_gold_pct,
  estimated_silver_pct,
  pure_gold_grams,
  estimated_oz,
  silver_content_grams
ON public.daily_production
FOR EACH ROW
EXECUTE FUNCTION public.snp_guard_engaged_production_measurements();

COMMENT ON FUNCTION public.snp_guard_engaged_production_measurements() IS
  'Interdit toute mutation physique ou identitaire d une production couverte par un achat non annulé.';

DO $postflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.daily_production'::regclass
      AND tgname = 'snp_daily_production_engagement_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Postflight productions engagées : garde absente.';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.snp_guard_engaged_production_measurements()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Postflight productions engagées : helper interne exposé.';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.snp_verifier_achat_production()',
    'EXECUTE'
  ) OR position(
    'FOR UPDATE' IN pg_get_functiondef(
      'public.snp_verifier_achat_production()'::regprocedure
    )
  ) = 0 THEN
    RAISE EXCEPTION 'Postflight productions engagées : allocation non sérialisée.';
  END IF;

  IF NOT (
    SELECT relrowsecurity AND relforcerowsecurity
    FROM pg_class
    WHERE oid = 'public.snp_achats_productions'::regclass
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'snp_achats_productions'
      AND grantee IN ('anon','authenticated','service_role')
      AND privilege_type IN (
        'INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
      )
  ) THEN
    RAISE EXCEPTION
      'Postflight productions engagées : surface DML client encore ouverte.';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';

COMMIT;
