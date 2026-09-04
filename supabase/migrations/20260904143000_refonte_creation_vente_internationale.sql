BEGIN;

-- Le brouillon reste hors du grand livre des ventes : il ne réserve donc ni
-- stock physique, ni quantité minière. Seule la soumission transactionnelle
-- appelle les RPC de création existantes, déjà responsables des verrous et de
-- la composition des lots.
CREATE TABLE IF NOT EXISTS public.snp_ventes_export_brouillons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_number text NOT NULL UNIQUE,
  seller_id uuid NOT NULL REFERENCES public.mining_companies(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_contract_id uuid REFERENCES public.customer_contracts(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  idempotency_key uuid NOT NULL UNIQUE,
  submitted_sale_id uuid UNIQUE REFERENCES public.sales(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload) = 'object'),
  CHECK (jsonb_typeof(context_snapshot) = 'object'),
  CHECK ((status = 'submitted') = (submitted_sale_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_snp_ventes_export_brouillons_actor
  ON public.snp_ventes_export_brouillons(created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_snp_ventes_export_brouillons_customer
  ON public.snp_ventes_export_brouillons(customer_id, status);

ALTER TABLE public.snp_ventes_export_brouillons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_ventes_export_brouillons_lecture ON public.snp_ventes_export_brouillons;
CREATE POLICY snp_ventes_export_brouillons_lecture
  ON public.snp_ventes_export_brouillons
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR (
      public.snp_est_agent_sonasp()
      AND public.snp_actor_can_module_action('sales', 'view')
    )
  );

REVOKE ALL ON public.snp_ventes_export_brouillons FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.snp_ventes_export_brouillons TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_enregistrer_brouillon_vente_export(
  p_draft_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid,
  p_payload jsonb,
  p_context_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_existing public.snp_ventes_export_brouillons%ROWTYPE;
  v_draft public.snp_ventes_export_brouillons%ROWTYPE;
  v_seller_id uuid;
  v_customer_id uuid;
  v_contract_id uuid;
  v_quantity numeric;
  v_quantity_oz numeric;
  v_price numeric;
  v_freight numeric;
  v_other numeric;
  v_payment_days integer;
  v_year integer := extract(year FROM current_date)::integer;
  v_next integer;
  v_number text;
BEGIN
  IF auth.uid() IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Session et clé d’idempotence requises.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(coalesce(p_payload, 'null'::jsonb)) <> 'object'
     OR jsonb_typeof(coalesce(p_context_snapshot, 'null'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Le contenu du brouillon est invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_actor
  FROM public.user_profiles
  WHERE id = auth.uid() AND is_active;
  IF NOT FOUND OR NOT public.snp_actor_can_module_action('sales', 'create') THEN
    RAISE EXCEPTION 'Vous n’êtes pas autorisé à préparer une vente internationale.' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_seller_id := nullif(p_payload ->> 'sellerId', '')::uuid;
    v_customer_id := nullif(p_payload ->> 'customerId', '')::uuid;
    v_contract_id := nullif(p_payload ->> 'customerContractId', '')::uuid;
    v_quantity := (p_payload ->> 'quantity')::numeric;
    v_price := (p_payload ->> 'proposedPriceUsdOz')::numeric;
    v_freight := coalesce((p_payload ->> 'freightCostUsd')::numeric, 0);
    v_other := coalesce((p_payload ->> 'otherCostsUsd')::numeric, 0);
    v_payment_days := (p_payload ->> 'paymentTermDays')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Les identifiants ou montants du brouillon sont invalides.' USING ERRCODE = '22023';
  END;

  IF v_seller_id IS NULL OR v_customer_id IS NULL
     OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity::text = 'NaN'
     OR v_price IS NULL OR v_price <= 0 OR v_price::text = 'NaN'
     OR v_freight < 0 OR v_other < 0
     OR v_payment_days IS NULL OR v_payment_days < 0 OR v_payment_days > 365
     OR coalesce(p_payload ->> 'unit', '') NOT IN ('oz', 'g')
     OR coalesce(p_payload ->> 'fixingMethod', '') NOT IN ('spot', 'forward', 'in_process')
     OR coalesce(p_payload ->> 'settlementCurrency', '') <> 'USD'
     OR nullif(p_payload ->> 'fixingDate', '') IS NULL THEN
    RAISE EXCEPTION 'Les paramètres obligatoires de la vente sont invalides.' USING ERRCODE = '22023';
  END IF;

  v_quantity_oz := CASE WHEN p_payload ->> 'unit' = 'g'
    THEN v_quantity / 31.1034768 ELSE v_quantity END;

  IF NOT EXISTS (
    SELECT 1 FROM public.mining_companies company
    WHERE company.id = v_seller_id AND company.is_active
      AND (
        (v_actor.mining_company_id = company.id AND company.company_type <> 'institution')
        OR (
          v_actor.role IN ('owner', 'admin', 'management')
          AND upper(coalesce(company.code, '')) = 'SONASP'
          AND company.company_type = 'institution'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Le vendeur ne correspond pas au périmètre du compte connecté.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customers customer
    WHERE customer.id = v_customer_id
      AND customer.is_active IS DISTINCT FROM false
      AND coalesce(customer.status, 'active') <> 'inactive'
  ) THEN
    RAISE EXCEPTION 'Le client est introuvable ou inactif.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gold_sales_settings setting
    WHERE setting.mining_company_id = v_seller_id
      AND setting.customer_id = v_customer_id
      AND setting.is_active
      AND setting.effective_date <= current_date
  ) THEN
    RAISE EXCEPTION 'Ce client n’est pas autorisé pour ce vendeur.' USING ERRCODE = '42501';
  END IF;

  IF v_contract_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.customer_contracts contract
      WHERE contract.id = v_contract_id
        AND contract.customer_id = v_customer_id
        AND lower(coalesce(contract.status, '')) IN ('active', 'approved', 'signed')
        AND contract.valid_from <= current_date
        AND contract.valid_until >= current_date
        AND (contract.minimum_order_oz IS NULL OR v_quantity_oz + 0.000001 >= contract.minimum_order_oz)
        AND (contract.maximum_order_oz IS NULL OR v_quantity_oz <= contract.maximum_order_oz + 0.000001)
    ) THEN
      RAISE EXCEPTION 'Le contrat client est expiré, inapplicable ou son plafond est dépassé.' USING ERRCODE = '23514';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('SONASP:sale-draft:' || p_idempotency_key::text, 0));
  SELECT * INTO v_existing
  FROM public.snp_ventes_export_brouillons
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF p_draft_id IS NULL AND FOUND THEN
    IF v_existing.created_by IS DISTINCT FROM v_actor.id THEN
      RAISE EXCEPTION 'Cette clé d’idempotence appartient à un autre utilisateur.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'id', v_existing.id, 'draft_number', v_existing.draft_number,
      'version', v_existing.version, 'status', v_existing.status,
      'submitted_sale_id', v_existing.submitted_sale_id, 'updated_at', v_existing.updated_at
    );
  END IF;

  IF p_draft_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('SONASP:sale-drafts:' || v_year::text));
    SELECT coalesce(max(substring(draft_number FROM '[0-9]+$')::integer), 0) + 1
    INTO v_next
    FROM public.snp_ventes_export_brouillons
    WHERE draft_number ~ ('^BRV-' || v_year::text || '-[0-9]+$');
    v_number := 'BRV-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

    INSERT INTO public.snp_ventes_export_brouillons(
      draft_number, seller_id, customer_id, customer_contract_id, payload,
      context_snapshot, idempotency_key, created_by
    ) VALUES (
      v_number, v_seller_id, v_customer_id, v_contract_id, p_payload,
      p_context_snapshot, p_idempotency_key, v_actor.id
    ) RETURNING * INTO v_draft;
  ELSE
    SELECT * INTO v_existing
    FROM public.snp_ventes_export_brouillons
    WHERE id = p_draft_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Le brouillon demandé est introuvable.' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing.created_by IS DISTINCT FROM v_actor.id THEN
      RAISE EXCEPTION 'Vous ne pouvez pas modifier ce brouillon.' USING ERRCODE = '42501';
    END IF;
    IF v_existing.status <> 'draft' THEN
      RAISE EXCEPTION 'Seul un brouillon non soumis peut être modifié.' USING ERRCODE = '23514';
    END IF;
    IF p_expected_version IS NULL OR p_expected_version <> v_existing.version THEN
      RAISE EXCEPTION 'Le brouillon a été modifié dans une autre session. Rechargez la page.' USING ERRCODE = '40001';
    END IF;

    UPDATE public.snp_ventes_export_brouillons
    SET seller_id = v_seller_id,
        customer_id = v_customer_id,
        customer_contract_id = v_contract_id,
        payload = p_payload,
        context_snapshot = p_context_snapshot,
        version = version + 1,
        updated_at = now()
    WHERE id = p_draft_id
    RETURNING * INTO v_draft;
  END IF;

  RETURN jsonb_build_object(
    'id', v_draft.id, 'draft_number', v_draft.draft_number,
    'version', v_draft.version, 'status', v_draft.status,
    'submitted_sale_id', v_draft.submitted_sale_id, 'updated_at', v_draft.updated_at
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_soumettre_brouillon_vente_export(
  p_draft_id uuid,
  p_expected_version integer,
  p_lots jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_draft public.snp_ventes_export_brouillons%ROWTYPE;
  v_company public.mining_companies%ROWTYPE;
  v_response jsonb;
  v_sale_id uuid;
  v_quantity numeric;
  v_quantity_oz numeric;
  v_price numeric;
  v_freight numeric;
  v_other numeric;
  v_payment_days integer;
  v_refinery_id uuid;
  v_contract public.customer_contracts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_draft_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Session, brouillon et version requises.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_actor FROM public.user_profiles WHERE id = auth.uid() AND is_active;
  IF NOT FOUND OR NOT public.snp_actor_can_module_action('sales', 'create') THEN
    RAISE EXCEPTION 'Vous n’êtes pas autorisé à soumettre une vente internationale.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('SONASP:submit-sale-draft:' || p_draft_id::text, 0));
  SELECT * INTO v_draft
  FROM public.snp_ventes_export_brouillons
  WHERE id = p_draft_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Le brouillon demandé est introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_draft.created_by IS DISTINCT FROM v_actor.id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas soumettre ce brouillon.' USING ERRCODE = '42501';
  END IF;
  IF v_draft.status = 'submitted' AND v_draft.submitted_sale_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', sale.id, 'sale_number', sale.sale_number, 'status', sale.status,
      'approval_request_id', request.id, 'replayed', true
    ) INTO v_response
    FROM public.sales sale
    LEFT JOIN LATERAL (
      SELECT approval.id FROM public.approval_requests approval
      WHERE approval.entity_type = 'sales' AND approval.entity_id = sale.id
      ORDER BY approval.requested_at DESC NULLS LAST LIMIT 1
    ) request ON true
    WHERE sale.id = v_draft.submitted_sale_id;
    RETURN v_response;
  END IF;
  IF v_draft.status <> 'draft' OR v_draft.version <> p_expected_version THEN
    RAISE EXCEPTION 'Le brouillon a changé ou n’est plus soumissible. Rechargez la page.' USING ERRCODE = '40001';
  END IF;

  BEGIN
    v_quantity := (v_draft.payload ->> 'quantity')::numeric;
    v_quantity_oz := CASE WHEN v_draft.payload ->> 'unit' = 'g'
      THEN v_quantity / 31.1034768 ELSE v_quantity END;
    v_price := (v_draft.payload ->> 'proposedPriceUsdOz')::numeric;
    v_freight := coalesce((v_draft.payload ->> 'freightCostUsd')::numeric, 0);
    v_other := coalesce((v_draft.payload ->> 'otherCostsUsd')::numeric, 0);
    v_payment_days := (v_draft.payload ->> 'paymentTermDays')::integer;
    v_refinery_id := nullif(v_draft.payload ->> 'inProcessRefineryId', '')::uuid;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Le brouillon contient des paramètres invalides.' USING ERRCODE = '22023';
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.customers customer
    WHERE customer.id = v_draft.customer_id
      AND customer.is_active IS DISTINCT FROM false
      AND coalesce(customer.status, 'active') <> 'inactive'
  ) THEN
    RAISE EXCEPTION 'Le client est devenu inactif avant la soumission.' USING ERRCODE = '23514';
  END IF;

  IF v_draft.customer_contract_id IS NOT NULL THEN
    SELECT * INTO v_contract
    FROM public.customer_contracts contract
    WHERE contract.id = v_draft.customer_contract_id
      AND contract.customer_id = v_draft.customer_id
    FOR SHARE;
    IF NOT FOUND
       OR lower(coalesce(v_contract.status, '')) NOT IN ('active', 'approved', 'signed')
       OR v_contract.valid_from > current_date OR v_contract.valid_until < current_date
       OR (v_contract.minimum_order_oz IS NOT NULL AND v_quantity_oz + 0.000001 < v_contract.minimum_order_oz)
       OR (v_contract.maximum_order_oz IS NOT NULL AND v_quantity_oz > v_contract.maximum_order_oz + 0.000001) THEN
      RAISE EXCEPTION 'Le contrat client n’est plus applicable à cette quantité.' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT * INTO v_company
  FROM public.mining_companies
  WHERE id = v_draft.seller_id AND is_active
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Le vendeur est devenu indisponible.' USING ERRCODE = '23514';
  END IF;

  IF v_company.company_type = 'institution' AND upper(coalesce(v_company.code, '')) = 'SONASP' THEN
    IF jsonb_typeof(coalesce(p_lots, 'null'::jsonb)) <> 'array' OR jsonb_array_length(p_lots) = 0 THEN
      RAISE EXCEPTION 'La vente SONASP doit être couverte par des lots physiques vérifiés.' USING ERRCODE = '23514';
    END IF;
    v_response := public.snp_creer_vente_export_idempotent(
      v_draft.idempotency_key,
      v_draft.customer_id,
      v_draft.seller_id,
      v_quantity_oz,
      v_price,
      v_freight,
      v_other,
      v_draft.payload ->> 'fixingMethod',
      v_refinery_id,
      p_lots
    );
  ELSE
    IF v_actor.mining_company_id IS DISTINCT FROM v_draft.seller_id THEN
      RAISE EXCEPTION 'Le vendeur ne correspond plus au compte connecté.' USING ERRCODE = '42501';
    END IF;
    v_response := public.snp_creer_vente_export_mine(
      v_draft.customer_id,
      v_quantity_oz,
      v_price,
      v_freight,
      v_other,
      v_draft.payload ->> 'fixingMethod',
      v_refinery_id
    );
  END IF;

  v_sale_id := (v_response ->> 'id')::uuid;
  UPDATE public.sales
  SET payment_terms = v_payment_days::text || ' jours',
      pricing_mechanism = v_draft.payload ->> 'fixingMethod',
      spot_pricing_date = (v_draft.payload ->> 'fixingDate')::date,
      final_price_per_oz = v_price,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'creation_workspace_version', 1,
        'draft_id', v_draft.id,
        'draft_number', v_draft.draft_number,
        'input_unit', v_draft.payload ->> 'unit',
        'fixing_date', v_draft.payload ->> 'fixingDate',
        'settlement_currency', v_draft.payload ->> 'settlementCurrency',
        'payment_term_days', v_payment_days,
        'customer_contract_id', v_draft.customer_contract_id,
        'context_snapshot', v_draft.context_snapshot
      ),
      updated_at = now()
  WHERE id = v_sale_id;

  UPDATE public.snp_ventes_evenements_audit
  SET details = details || jsonb_build_object(
    'draft_id', v_draft.id,
    'draft_number', v_draft.draft_number,
    'customer_contract_id', v_draft.customer_contract_id,
    'fixing_date', v_draft.payload ->> 'fixingDate',
    'payment_term_days', v_payment_days,
    'context_snapshot', v_draft.context_snapshot
  )
  WHERE sale_id = v_sale_id AND event_type = 'created';

  UPDATE public.snp_ventes_export_brouillons
  SET status = 'submitted', submitted_sale_id = v_sale_id,
      submitted_at = now(), updated_at = now(), version = version + 1
  WHERE id = v_draft.id;

  RETURN v_response || jsonb_build_object('replayed', false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_enregistrer_brouillon_vente_export(uuid, integer, uuid, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snp_enregistrer_brouillon_vente_export(uuid, integer, uuid, jsonb, jsonb)
  TO authenticated;
REVOKE ALL ON FUNCTION public.snp_soumettre_brouillon_vente_export(uuid, integer, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snp_soumettre_brouillon_vente_export(uuid, integer, jsonb)
  TO authenticated;

COMMENT ON TABLE public.snp_ventes_export_brouillons IS
  'Brouillons versionnés de ventes internationales ; aucune réservation de stock avant soumission.';
COMMENT ON FUNCTION public.snp_soumettre_brouillon_vente_export(uuid, integer, jsonb) IS
  'Soumet atomiquement un brouillon après revalidation du client, du contrat, des droits et du stock par les RPC métier existantes.';

NOTIFY pgrst, 'reload schema';
COMMIT;
