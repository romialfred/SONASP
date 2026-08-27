-- Le maillon manquant de la chaine : la vente export ne connaissait pas son expedition.
--
-- CONSTAT, verifie sur les cles etrangeres et les donnees le 27 aout 2026
-- La chaine physique existe : production -> expedition (shipping_production_items,
-- shipping_preparations.daily_production_id) -> fret (freight_shipments) ->
-- analyse (assay_certificates.shipping_preparation_id) -> conciliation
-- (snp_conciliations.assay_certificate_id, .sale_id). Les paiements, preuves,
-- grands livres et avoirs sont tous rattaches a la vente.
--
-- Mais AUCUN lien direct ne relie une vente a son expedition : ni cle, ni
-- donnee (gold_inventory.sale_id+freight_shipment_id : zero ligne). Or le
-- workflow metier l'exige : « le jour de l'expedition, la raffinerie ou le
-- client final doit payer pour cette vente ». Sans ce lien, un dossier de vente
-- ne peut remonter ni a l'or expedie, ni aux productions, ni aux documents
-- d'expedition — sauf detour par une conciliation deja ouverte.
--
-- CE QUI EST AJOUTE
-- sales.shipping_preparation_id, nullable : une vente locale n'a pas
-- d'expedition. Un declencheur verifie la coherence de societe : l'expedition
-- d'une vente de mine doit appartenir a la mine vendeuse.
--
-- REPRISE DE L'EXISTANT
-- Les ventes deja conciliees retrouvent leur expedition par le chemin
-- conciliation -> certificat -> expedition.

BEGIN;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS shipping_preparation_id uuid
  REFERENCES public.shipping_preparations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sales.shipping_preparation_id IS
  'Expedition dont provient l''or vendu. Nulle pour une vente locale. Le declencheur refuse une expedition d''une autre societe que la vendeuse.';

CREATE INDEX IF NOT EXISTS sales_shipping_preparation_idx
  ON public.sales (shipping_preparation_id) WHERE shipping_preparation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Coherence de societe
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_verifier_expedition_vente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_societe_expedition uuid;
BEGIN
  IF NEW.shipping_preparation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sp.mining_company_id INTO v_societe_expedition
  FROM public.shipping_preparations sp WHERE sp.id = NEW.shipping_preparation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expedition introuvable.' USING ERRCODE = '23503';
  END IF;

  -- Une vente de mine ne peut pointer que vers une expedition de cette mine.
  IF NEW.seller_type = 'mining_company'
     AND NEW.seller_id IS NOT NULL
     AND v_societe_expedition IS NOT NULL
     AND v_societe_expedition <> NEW.seller_id THEN
    RAISE EXCEPTION
      'L''expedition designee appartient a une autre societe que la vendeuse.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS snp_verifier_expedition_vente_trg ON public.sales;
CREATE TRIGGER snp_verifier_expedition_vente_trg
  BEFORE INSERT OR UPDATE OF shipping_preparation_id ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.snp_verifier_expedition_vente();

-- ---------------------------------------------------------------------------
-- Reprise : les ventes deja conciliees retrouvent leur expedition
-- ---------------------------------------------------------------------------

UPDATE public.sales s
SET shipping_preparation_id = ac.shipping_preparation_id
FROM public.snp_conciliations c
JOIN public.assay_certificates ac ON ac.id = c.assay_certificate_id
WHERE c.sale_id = s.id
  AND c.statut <> 'annulee'
  AND ac.shipping_preparation_id IS NOT NULL
  AND s.shipping_preparation_id IS NULL
  AND (s.seller_type <> 'mining_company' OR s.seller_id IS NULL
       OR s.seller_id = (SELECT sp.mining_company_id FROM public.shipping_preparations sp
                         WHERE sp.id = ac.shipping_preparation_id));

DO $$
DECLARE
  v_reliees integer;
  v_trigger integer;
BEGIN
  SELECT count(*) INTO v_reliees FROM public.sales WHERE shipping_preparation_id IS NOT NULL;
  SELECT count(*) INTO v_trigger FROM pg_trigger
  WHERE tgname = 'snp_verifier_expedition_vente_trg' AND NOT tgisinternal;

  RAISE NOTICE 'Reprise : % vente(s) reliee(s) a leur expedition.', v_reliees;

  IF v_trigger = 0 THEN
    RAISE EXCEPTION 'Postflight : le declencheur de coherence est absent.';
  END IF;
END;
$$;

COMMIT;
