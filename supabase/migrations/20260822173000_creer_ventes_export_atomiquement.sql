-- ============================================================================
-- Création atomique des ventes export et réservation des lots SONASP
-- ============================================================================

ALTER TABLE public.snp_ventes_lots
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS release_reason text;

CREATE INDEX IF NOT EXISTS idx_snp_ventes_lots_actifs_mine
  ON public.snp_ventes_lots (achat_mine_id)
  WHERE released_at IS NULL AND achat_mine_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snp_ventes_lots_actifs_artisan
  ON public.snp_ventes_lots (artisan_vente_id)
  WHERE released_at IS NULL AND artisan_vente_id IS NOT NULL;

ALTER TABLE public.snp_ventes_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_ventes_lots_aucune_insertion_directe ON public.snp_ventes_lots;
CREATE POLICY snp_ventes_lots_aucune_insertion_directe
  ON public.snp_ventes_lots AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS snp_ventes_lots_aucune_modification_directe ON public.snp_ventes_lots;
CREATE POLICY snp_ventes_lots_aucune_modification_directe
  ON public.snp_ventes_lots AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS snp_ventes_lots_aucune_suppression_directe ON public.snp_ventes_lots;
CREATE POLICY snp_ventes_lots_aucune_suppression_directe
  ON public.snp_ventes_lots AS RESTRICTIVE
  FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.snp_ventes_evenements_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created', 'lots_released')),
  previous_status text,
  resulting_status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snp_ventes_evenements_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_ventes_evenements_lecture ON public.snp_ventes_evenements_audit;
CREATE POLICY snp_ventes_evenements_lecture
  ON public.snp_ventes_evenements_audit
  FOR SELECT TO authenticated
  USING (public.snp_est_agent_sonasp());
REVOKE INSERT, UPDATE, DELETE ON public.snp_ventes_evenements_audit FROM anon, authenticated;

-- La valeur canonique existante est rendue explicite en base. La fonction
-- refuse de calculer si cette règle disparaît ou devient incohérente.
INSERT INTO public.business_rules (
  rule_category, rule_key, rule_name, rule_value, unit, description
)
SELECT
  'sales', 'gold_royalty_percentage', 'Redevance sur les ventes d''or',
  3, 'percent', 'Taux de redevance appliqué au produit net des ventes export.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_rules WHERE rule_key = 'gold_royalty_percentage'
);

-- Les ventes historiques créées avec l'identifiant SONASP mais l'ancien type
-- générique doivent être alignées avant que les tableaux de bord n'agrègent les
-- vendeurs. Aucune vente d'une mine n'est modifiée.
UPDATE public.sales s
SET seller_type = 'sonasp'
WHERE s.seller_type IS DISTINCT FROM 'sonasp'
  AND EXISTS (
    SELECT 1
    FROM public.mining_companies mc
    WHERE mc.id = s.seller_id
      AND upper(COALESCE(mc.code, '')) = 'SONASP'
      AND mc.company_type = 'institution'
  );

-- La signature a été enrichie avec la raffinerie de destination. Supprimer
-- explicitement l'ancienne signature évite qu'un appel PostgREST ambigu puisse
-- encore atteindre une version dépourvue de ce contrôle.
DROP FUNCTION IF EXISTS public.snp_creer_vente_export(
  uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb
);

CREATE OR REPLACE FUNCTION public.snp_creer_vente_export(
  p_customer_id uuid,
  p_seller_id uuid,
  p_quantity_oz numeric,
  p_london_am_rate numeric,
  p_freight_cost numeric DEFAULT 0,
  p_other_costs numeric DEFAULT 0,
  p_mechanism_type text DEFAULT NULL,
  p_in_process_refinery_id uuid DEFAULT NULL,
  p_lots jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_setting public.gold_sales_settings%ROWTYPE;
  v_lot record;
  v_source_quantity numeric;
  v_already_allocated numeric;
  v_lots_total numeric := 0;
  v_available_total numeric := 0;
  v_royalty_rate numeric;
  v_gross numeric;
  v_net numeric;
  v_royalty numeric;
  v_final numeric;
  v_year integer := extract(year FROM current_date)::integer;
  v_next integer;
  v_sale_number text;
  v_sale public.sales%ROWTYPE;
  v_request_id uuid;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise pour créer une vente.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.user_profiles
  WHERE id = auth.uid() AND is_active;
  IF NOT FOUND OR v_actor.role NOT IN ('owner', 'admin', 'management') THEN
    RAISE EXCEPTION 'Votre rôle ne permet pas de créer une vente export.'
      USING ERRCODE = '42501';
  END IF;

  IF p_quantity_oz IS NULL OR p_quantity_oz::text = 'NaN' OR p_quantity_oz <= 0
     OR p_london_am_rate IS NULL OR p_london_am_rate::text = 'NaN' OR p_london_am_rate <= 0
     OR COALESCE(p_freight_cost, 0) < 0 OR COALESCE(p_other_costs, 0) < 0 THEN
    RAISE EXCEPTION 'Les quantités, le prix et les frais sont invalides.';
  END IF;
  IF jsonb_typeof(COALESCE(p_lots, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_lots) = 0 THEN
    RAISE EXCEPTION 'La vente doit être couverte par au moins un lot d''achat.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mining_companies
    WHERE id = p_seller_id
      AND upper(COALESCE(code, '')) = 'SONASP'
      AND company_type = 'institution'
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Le vendeur doit être la SONASP active.';
  END IF;

  IF NULLIF(trim(COALESCE(p_mechanism_type, '')), '') IS NOT NULL
     AND NULLIF(trim(COALESCE(p_mechanism_type, '')), '')
       NOT IN ('spot', 'forward', 'in_process') THEN
    RAISE EXCEPTION 'Le mécanisme de vente demandé est invalide.';
  END IF;

  IF NULLIF(trim(COALESCE(p_mechanism_type, '')), '') = 'in_process' THEN
    IF p_in_process_refinery_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.refineries_approved
      WHERE id = p_in_process_refinery_id AND is_approved
    ) THEN
      RAISE EXCEPTION 'Une raffinerie agréée est obligatoire pour une vente en cours de traitement.';
    END IF;
  ELSIF p_in_process_refinery_id IS NOT NULL THEN
    RAISE EXCEPTION 'Une raffinerie ne peut être rattachée qu''à une vente en cours de traitement.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = p_customer_id AND is_active IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Le client est introuvable ou inactif.';
  END IF;

  SELECT * INTO v_setting
  FROM public.gold_sales_settings
  WHERE mining_company_id = p_seller_id
    AND customer_id = p_customer_id
    AND is_active
    AND effective_date <= current_date
  ORDER BY effective_date DESC, updated_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce client n''est pas autorisé pour les ventes export de la SONASP.'
      USING ERRCODE = '42501';
  END IF;

  -- Le verrou sur chaque achat sérialise les réservations concurrentes du même
  -- stock. Les doublons du JSON sont agrégés avant tout contrôle.
  FOR v_lot IN
    SELECT source_type, source_id, sum(quantite_oz)::numeric AS quantite_oz
    FROM jsonb_to_recordset(p_lots)
      AS x(source_type text, source_id uuid, quantite_oz numeric)
    GROUP BY source_type, source_id
    ORDER BY source_type, source_id
  LOOP
    IF v_lot.source_id IS NULL OR v_lot.quantite_oz IS NULL
       OR v_lot.quantite_oz::text = 'NaN' OR v_lot.quantite_oz <= 0
       OR v_lot.source_type NOT IN ('achat_mine', 'achat_artisan') THEN
      RAISE EXCEPTION 'La composition des lots est invalide.';
    END IF;

    IF v_lot.source_type = 'achat_mine' THEN
      SELECT quantite_oz INTO v_source_quantity
      FROM public.snp_achats_mines
      WHERE id = v_lot.source_id AND statut IN ('en_attente', 'validee', 'payee')
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Un achat minier n''est plus mobilisable.'; END IF;

      SELECT COALESCE(sum(quantite_oz), 0) INTO v_already_allocated
      FROM public.snp_ventes_lots
      WHERE achat_mine_id = v_lot.source_id AND released_at IS NULL;
    ELSE
      SELECT quantite_grammes / 31.1034768 INTO v_source_quantity
      FROM public.snp_artisan_ventes_or
      WHERE id = v_lot.source_id AND statut IN ('validee', 'payee')
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Un achat artisanal n''est plus mobilisable.'; END IF;

      SELECT COALESCE(sum(quantite_oz), 0) INTO v_already_allocated
      FROM public.snp_ventes_lots
      WHERE artisan_vente_id = v_lot.source_id AND released_at IS NULL;
    END IF;

    IF v_lot.quantite_oz > (v_source_quantity - v_already_allocated) + 0.000001 THEN
      RAISE EXCEPTION 'Un lot ne dispose plus de la quantité demandée.';
    END IF;
    v_lots_total := v_lots_total + v_lot.quantite_oz;
  END LOOP;

  IF abs(v_lots_total - p_quantity_oz) > 0.001 THEN
    RAISE EXCEPTION 'La composition des lots ne correspond pas à la quantité vendue.';
  END IF;

  SELECT
    COALESCE((
      SELECT sum(GREATEST(0, a.quantite_oz - COALESCE(x.affectee, 0)))
      FROM public.snp_achats_mines a
      LEFT JOIN (
        SELECT achat_mine_id, sum(quantite_oz) AS affectee
        FROM public.snp_ventes_lots WHERE released_at IS NULL GROUP BY achat_mine_id
      ) x ON x.achat_mine_id = a.id
      WHERE a.statut IN ('en_attente', 'validee', 'payee')
    ), 0)
    + COALESCE((
      SELECT sum(GREATEST(0, a.quantite_grammes / 31.1034768 - COALESCE(x.affectee, 0)))
      FROM public.snp_artisan_ventes_or a
      LEFT JOIN (
        SELECT artisan_vente_id, sum(quantite_oz) AS affectee
        FROM public.snp_ventes_lots WHERE released_at IS NULL GROUP BY artisan_vente_id
      ) x ON x.artisan_vente_id = a.id
      WHERE a.statut IN ('validee', 'payee')
    ), 0)
  INTO v_available_total;

  IF p_quantity_oz > v_available_total * (v_setting.max_stock_percentage / 100.0) + 0.000001 THEN
    RAISE EXCEPTION 'La quantité dépasse la part de stock autorisée pour ce client.';
  END IF;

  SELECT CASE WHEN rule_value > 1 THEN rule_value / 100.0 ELSE rule_value END
  INTO v_royalty_rate
  FROM public.business_rules
  WHERE rule_key = 'gold_royalty_percentage'
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;
  IF v_royalty_rate IS NULL OR v_royalty_rate < 0 OR v_royalty_rate >= 1 THEN
    RAISE EXCEPTION 'Le taux de redevance des ventes n''est pas configuré correctement.';
  END IF;

  v_gross := round(p_quantity_oz * p_london_am_rate, 2);
  v_net := round(v_gross - COALESCE(p_freight_cost, 0) - COALESCE(p_other_costs, 0), 2);
  IF v_net <= 0 THEN RAISE EXCEPTION 'Le produit net de la vente doit être positif.'; END IF;
  v_royalty := round(v_net * v_royalty_rate, 2);
  v_final := round(v_net - v_royalty, 2);

  PERFORM pg_advisory_xact_lock(hashtext('SONASP:sales:' || v_year::text));
  SELECT COALESCE(max(substring(sale_number FROM '[0-9]+$')::integer), 0) + 1
  INTO v_next
  FROM public.sales
  WHERE sale_number ~ ('^SL-' || v_year::text || '-[0-9]+$');
  v_sale_number := 'SL-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

  INSERT INTO public.sales (
    sale_number, sale_date, customer_id, seller_id, seller_type,
    is_internal_sale, quantity_oz, london_am_rate, freight_cost, other_costs,
    gross_proceeds, net_proceeds, royalty_amount, final_proceeds, total_amount,
    currency, status, mechanism_type, in_process_refinery_id, created_by
  ) VALUES (
    v_sale_number, current_date, p_customer_id, p_seller_id, 'sonasp',
    false, p_quantity_oz, p_london_am_rate, COALESCE(p_freight_cost, 0),
    COALESCE(p_other_costs, 0), v_gross, v_net, v_royalty, v_final, v_final,
    'USD', 'pending_management_approval', NULLIF(trim(COALESCE(p_mechanism_type, '')), ''),
    p_in_process_refinery_id,
    v_actor.id
  ) RETURNING * INTO v_sale;

  INSERT INTO public.snp_ventes_lots (
    sale_id, source_type, achat_mine_id, artisan_vente_id, quantite_oz, created_by
  )
  SELECT
    v_sale.id,
    x.source_type,
    CASE WHEN x.source_type = 'achat_mine' THEN x.source_id ELSE NULL END,
    CASE WHEN x.source_type = 'achat_artisan' THEN x.source_id ELSE NULL END,
    sum(x.quantite_oz),
    v_actor.id
  FROM jsonb_to_recordset(p_lots)
    AS x(source_type text, source_id uuid, quantite_oz numeric)
  GROUP BY x.source_type, x.source_id;

  INSERT INTO public.approval_requests (
    request_type, entity_id, entity_type, approver_role, requested_by, status
  ) VALUES (
    'sale', v_sale.id, 'sales', 'management', v_actor.id, 'pending'
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.snp_ventes_evenements_audit (
    sale_id, event_type, resulting_status, details, actor_id, actor_role
  ) VALUES (
    v_sale.id, 'created', v_sale.status::text,
    jsonb_build_object(
      'sale_number', v_sale.sale_number,
      'quantity_oz', v_sale.quantity_oz,
      'customer_id', v_sale.customer_id,
      'in_process_refinery_id', v_sale.in_process_refinery_id,
      'lots_count', jsonb_array_length(p_lots),
      'royalty_rate', v_royalty_rate,
      'approval_request_id', v_request_id
    ),
    v_actor.id, v_actor.role
  );

  PERFORM public.snp_notifier_roles(
    ARRAY['owner', 'admin', 'management'],
    'Vente à valider',
    'La vente ' || v_sale.sale_number || ' attend la validation de la direction.',
    'validation_attendue', 'haute', 'vente', v_sale.id,
    '/sales/' || v_sale.id::text,
    jsonb_build_object('sale_number', v_sale.sale_number, 'request_id', v_request_id),
    'vente-validation-' || v_sale.id::text, true
  );

  RETURN jsonb_build_object(
    'id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'status', v_sale.status,
    'approval_request_id', v_request_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_creer_vente_export(
  uuid, uuid, numeric, numeric, numeric, numeric, text, uuid, jsonb
) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_creer_vente_export(
  uuid, uuid, numeric, numeric, numeric, numeric, text, uuid, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_liberer_lots_vente_rejetee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor_role text;
  v_count integer;
BEGIN
  IF NEW.status::text IN ('management_rejected', 'customer_rejected', 'cancelled')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.snp_ventes_lots
    SET released_at = now(), released_by = auth.uid(),
        release_reason = 'Statut de la vente : ' || NEW.status::text
    WHERE sale_id = NEW.id AND released_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count > 0 THEN
      SELECT role INTO v_actor_role FROM public.user_profiles WHERE id = auth.uid();
      INSERT INTO public.snp_ventes_evenements_audit (
        sale_id, event_type, previous_status, resulting_status, details,
        actor_id, actor_role
      ) VALUES (
        NEW.id, 'lots_released', OLD.status::text, NEW.status::text,
        jsonb_build_object('released_lots', v_count), auth.uid(), v_actor_role
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_liberer_lots_vente_rejetee ON public.sales;
CREATE TRIGGER snp_liberer_lots_vente_rejetee
AFTER UPDATE OF status ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.snp_liberer_lots_vente_rejetee();
