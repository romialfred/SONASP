-- R-25 — Lien achat ↔ production.
--
-- Un achat SONASP auprès d'une mine couvre une période de production, mais
-- rien ne rattachait l'achat aux déclarations journalières : deux achats sur
-- périodes chevauchantes pouvaient compter la même production, et l'écran de
-- stock n'était qu'une arithmétique navigateur sans opposabilité.
--
-- Correctif :
--   1. jonction snp_achats_productions (achat, production, quantité en onces,
--      l'unité de l'écran de stock) ;
--   2. intégrité : même société, date dans la période, production non annulée,
--      somme des allocations d'une production bornée par sa quantité déclarée ;
--   3. allocation FIFO serveur (par date de production), rejouée à chaque
--      changement de statut, libérée à l'annulation ;
--   4. passage à « validee » refusé si la production déclarée ne couvre pas
--      la quantité achetée — c'est précisément la fraude visée ;
--   5. backfill honnête des achats existants : on alloue ce qui existe, on
--      consigne les découverts, on n'invente aucune production.
--
-- La lecture suit la visibilité de l'achat (RLS en sous-requête). Aucune
-- écriture cliente : tout passe par la fonction d'allocation.

CREATE TABLE IF NOT EXISTS public.snp_achats_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id uuid NOT NULL REFERENCES public.snp_achats_mines(id) ON DELETE CASCADE,
  production_id uuid NOT NULL REFERENCES public.daily_production(id),
  quantite_oz numeric NOT NULL CHECK (quantite_oz > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (achat_id, production_id)
);

CREATE INDEX IF NOT EXISTS idx_snp_achats_productions_production
  ON public.snp_achats_productions(production_id);

ALTER TABLE public.snp_achats_productions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_achats_productions_lecture ON public.snp_achats_productions;
CREATE POLICY snp_achats_productions_lecture ON public.snp_achats_productions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.snp_achats_mines a WHERE a.id = achat_id)
  );

GRANT SELECT ON public.snp_achats_productions TO authenticated;

-- Intégrité de chaque ligne d'allocation.
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
  SELECT * INTO v_achat FROM public.snp_achats_mines WHERE id = NEW.achat_id;
  SELECT * INTO v_prod FROM public.daily_production WHERE id = NEW.production_id;
  IF v_achat.id IS NULL OR v_prod.id IS NULL THEN
    RAISE EXCEPTION 'Allocation orpheline.' USING ERRCODE='23503';
  END IF;
  IF v_prod.mining_company_id IS DISTINCT FROM v_achat.mining_company_id THEN
    RAISE EXCEPTION 'La production allouée appartient à une autre société.'
      USING ERRCODE='23514';
  END IF;
  IF v_prod.production_date < v_achat.periode_debut
     OR v_prod.production_date > v_achat.periode_fin THEN
    RAISE EXCEPTION 'La production du % est hors période d''achat (% → %).',
      v_prod.production_date, v_achat.periode_debut, v_achat.periode_fin
      USING ERRCODE='23514';
  END IF;
  IF v_prod.status = 'cancelled' THEN
    RAISE EXCEPTION 'Une production annulée ne s''alloue pas.' USING ERRCODE='23514';
  END IF;
  SELECT coalesce(sum(ap.quantite_oz),0) INTO v_deja
  FROM public.snp_achats_productions ap
  WHERE ap.production_id = NEW.production_id
    AND (TG_OP = 'INSERT' OR ap.id <> NEW.id);
  IF v_deja + NEW.quantite_oz > coalesce(v_prod.estimated_oz,0) + 0.000001 THEN
    RAISE EXCEPTION
      'Sur-allocation : % oz déjà alloués + % oz demandés dépassent les % oz déclarés.',
      round(v_deja,3), round(NEW.quantite_oz,3), round(coalesce(v_prod.estimated_oz,0),3)
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_snp_verifier_achat_production ON public.snp_achats_productions;
CREATE TRIGGER trg_snp_verifier_achat_production
  BEFORE INSERT OR UPDATE ON public.snp_achats_productions
  FOR EACH ROW EXECUTE FUNCTION public.snp_verifier_achat_production();

-- Allocation FIFO d'un achat sur la production de sa période.
-- Rejouable : les allocations de l'achat sont reconstruites à chaque appel.
CREATE OR REPLACE FUNCTION public.snp_allouer_achat_production(p_achat_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_achat public.snp_achats_mines%ROWTYPE;
  v_prod record;
  v_reste numeric;
  v_dispo numeric;
  v_pris numeric;
  v_alloue numeric := 0;
BEGIN
  SELECT * INTO v_achat FROM public.snp_achats_mines WHERE id = p_achat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat introuvable.' USING ERRCODE='P0002';
  END IF;

  DELETE FROM public.snp_achats_productions WHERE achat_id = p_achat_id;

  IF v_achat.statut = 'annulee' THEN
    RETURN jsonb_build_object('requis_oz', 0, 'alloue_oz', 0, 'couverture_complete', true);
  END IF;

  v_reste := coalesce(v_achat.quantite_oz, 0);
  FOR v_prod IN
    SELECT dp.id, coalesce(dp.estimated_oz, 0) AS oz
    FROM public.daily_production dp
    WHERE dp.mining_company_id = v_achat.mining_company_id
      AND dp.production_date BETWEEN v_achat.periode_debut AND v_achat.periode_fin
      AND dp.status <> 'cancelled'
      AND coalesce(dp.estimated_oz, 0) > 0
    ORDER BY dp.production_date, dp.created_at, dp.id
    FOR UPDATE OF dp
  LOOP
    EXIT WHEN v_reste <= 0.000001;
    SELECT coalesce(sum(ap.quantite_oz), 0) INTO v_dispo
    FROM public.snp_achats_productions ap WHERE ap.production_id = v_prod.id;
    v_dispo := v_prod.oz - v_dispo;
    IF v_dispo > 0.000001 THEN
      v_pris := round(least(v_reste, v_dispo), 6);
      INSERT INTO public.snp_achats_productions(achat_id, production_id, quantite_oz)
      VALUES (p_achat_id, v_prod.id, v_pris);
      v_alloue := v_alloue + v_pris;
      v_reste := v_reste - v_pris;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'requis_oz', coalesce(v_achat.quantite_oz, 0),
    'alloue_oz', v_alloue,
    'couverture_complete', v_reste <= 0.000001);
END
$fn$;

REVOKE ALL ON FUNCTION public.snp_allouer_achat_production(uuid) FROM PUBLIC, anon, authenticated;

-- Rejoue l'allocation à la création et à chaque changement de statut.
-- La validation exige la couverture complète ; le backfill historique, non.
CREATE OR REPLACE FUNCTION public.snp_achat_mine_allocation_statut()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_res jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;
  v_res := public.snp_allouer_achat_production(NEW.id);
  IF NEW.statut = 'validee'
     AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'validee')
     AND NOT (v_res->>'couverture_complete')::boolean THEN
    RAISE EXCEPTION
      'Validation refusée : la production déclarée de la période ne couvre que % oz sur les % oz achetés.',
      round((v_res->>'alloue_oz')::numeric, 3), round((v_res->>'requis_oz')::numeric, 3)
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_snp_achat_mine_allocation ON public.snp_achats_mines;
CREATE TRIGGER trg_snp_achat_mine_allocation
  AFTER INSERT OR UPDATE OF statut ON public.snp_achats_mines
  FOR EACH ROW EXECUTE FUNCTION public.snp_achat_mine_allocation_statut();

-- Backfill honnête des achats existants, dans l'ordre chronologique.
DO $backfill$
DECLARE
  v_achat record;
  v_res jsonb;
  v_total int := 0;
  v_incomplets int := 0;
BEGIN
  FOR v_achat IN
    SELECT id, numero_achat FROM public.snp_achats_mines
    WHERE statut IN ('en_attente','validee','payee')
    ORDER BY date_achat, created_at, id
  LOOP
    v_res := public.snp_allouer_achat_production(v_achat.id);
    v_total := v_total + 1;
    IF NOT (v_res->>'couverture_complete')::boolean THEN
      v_incomplets := v_incomplets + 1;
      RAISE NOTICE 'Achat % : % oz alloués sur % oz — découvert historique.',
        v_achat.numero_achat, v_res->>'alloue_oz', v_res->>'requis_oz';
    END IF;
  END LOOP;
  RAISE NOTICE 'Backfill : % achats traités, % à couverture incomplète.',
    v_total, v_incomplets;
END
$backfill$;

-- Postflight : aucune production sur-allouée.
DO $post$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.daily_production dp
    JOIN (SELECT production_id, sum(quantite_oz) AS s
          FROM public.snp_achats_productions GROUP BY 1) x
      ON x.production_id = dp.id
    WHERE x.s > coalesce(dp.estimated_oz, 0) + 0.000001
  ) THEN
    RAISE EXCEPTION 'Postflight : une production est sur-allouée.';
  END IF;
END
$post$;
