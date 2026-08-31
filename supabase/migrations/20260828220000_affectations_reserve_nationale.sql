-- Affectations à la Réserve nationale : modèle métier, habilitations, workflow et stockage privé.
-- Migration additive et idempotente. Les lingots restent dans gold_inventory ;
-- reserve_allocation_items ne conserve qu'une relation et les valeurs de preuve au moment de l'affectation.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Permissions métier explicites
-- ---------------------------------------------------------------------------
INSERT INTO public.snp_capability_catalog(code, domain, label, description, sensitive)
VALUES
  ('reserve.allocations.view', 'reserve', 'Consulter les affectations', 'Consulter les affectations à la réserve nationale.', false),
  ('reserve.allocations.create', 'reserve', 'Créer une affectation', 'Créer un brouillon d’affectation.', true),
  ('reserve.allocations.edit', 'reserve', 'Modifier une affectation', 'Modifier une affectation encore éditable.', true),
  ('reserve.allocations.submit', 'reserve', 'Soumettre une affectation', 'Soumettre une affectation au circuit de validation.', true),
  ('reserve.allocations.validate_level_1', 'reserve', 'Validation de niveau 1', 'Réaliser le premier contrôle indépendant.', true),
  ('reserve.allocations.validate_level_2', 'reserve', 'Validation de niveau 2', 'Réaliser le second contrôle indépendant.', true),
  ('reserve.allocations.authorize_transfer', 'reserve', 'Autoriser le transfert', 'Autoriser le transfert vers le dépositaire.', true),
  ('reserve.allocations.confirm_receipt', 'reserve', 'Confirmer la réception', 'Confirmer la réception physique par le dépositaire.', true),
  ('reserve.allocations.reconcile', 'reserve', 'Rapprocher l’affectation', 'Rapprocher les quantités transférées et reçues.', true),
  ('reserve.allocations.export', 'reserve', 'Exporter les affectations', 'Exporter les données autorisées du registre.', false)
ON CONFLICT (code) DO UPDATE SET
  domain=EXCLUDED.domain,
  label=EXCLUDED.label,
  description=EXCLUDED.description,
  sensitive=EXCLUDED.sensitive;

INSERT INTO public.snp_role_capabilities(role, capability_code)
SELECT role_name, permission_name
FROM (VALUES
  ('admin','reserve.allocations.view'), ('admin','reserve.allocations.export'),
  ('management','reserve.allocations.view'), ('management','reserve.allocations.create'),
  ('management','reserve.allocations.edit'), ('management','reserve.allocations.submit'),
  ('management','reserve.allocations.validate_level_1'), ('management','reserve.allocations.validate_level_2'),
  ('management','reserve.allocations.authorize_transfer'), ('management','reserve.allocations.confirm_receipt'),
  ('management','reserve.allocations.reconcile'), ('management','reserve.allocations.export'),
  ('dgmg','reserve.allocations.view'), ('dgmg','reserve.allocations.validate_level_1'),
  ('dgmg','reserve.allocations.export')
) AS grants(role_name, permission_name)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Entités et réservations atomiques du stock
-- ---------------------------------------------------------------------------
ALTER TABLE public.gold_inventory
  ADD COLUMN IF NOT EXISTS quantity_national_reserve_oz numeric NOT NULL DEFAULT 0;

CREATE SEQUENCE IF NOT EXISTS public.reserve_allocation_reference_seq START 1;

CREATE TABLE IF NOT EXISTS public.reserve_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  allocation_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'DRAFT',
  reason text,
  allocation_nature text,
  priority text NOT NULL DEFAULT 'NORMAL',
  decision_reference text,
  decision_date date,
  decision_authority text,
  decision_department text,
  decision_comment text,
  control_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  depository_organization_id uuid REFERENCES public.snp_organizations(id) ON DELETE RESTRICT,
  deposit_type text,
  planned_deposit_reference text,
  planned_transfer_date date,
  gold_price_fcfa_gram numeric NOT NULL DEFAULT 0,
  usd_xof_rate numeric NOT NULL DEFAULT 0,
  eur_xof_rate numeric NOT NULL DEFAULT 0,
  lot_count integer NOT NULL DEFAULT 0,
  ingot_count integer NOT NULL DEFAULT 0,
  gross_weight_grams numeric NOT NULL DEFAULT 0,
  fine_weight_grams numeric NOT NULL DEFAULT 0,
  weighted_fineness numeric NOT NULL DEFAULT 0,
  indicative_value_fcfa numeric NOT NULL DEFAULT 0,
  indicative_value_usd numeric NOT NULL DEFAULT 0,
  indicative_value_eur numeric NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserve_allocations_status_check CHECK (status IN (
    'DRAFT','SUBMITTED','UNDER_REVIEW','VALIDATED_LEVEL_1','VALIDATED_LEVEL_2',
    'TRANSFER_AUTHORIZED','IN_TRANSIT','RECEIVED','RECONCILIATION_PENDING',
    'RECONCILED','ACTIVE','REJECTED','CANCELLED','DISCREPANCY_REVIEW'
  )),
  CONSTRAINT reserve_allocations_priority_check CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  CONSTRAINT reserve_allocations_totals_check CHECK (
    lot_count >= 0 AND ingot_count >= 0 AND gross_weight_grams >= 0
    AND fine_weight_grams >= 0 AND weighted_fineness >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.reserve_allocation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.reserve_allocations(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.gold_inventory(id) ON DELETE RESTRICT,
  lot_reference text NOT NULL,
  ingot_count integer NOT NULL DEFAULT 1 CHECK (ingot_count > 0),
  gross_weight_grams numeric NOT NULL CHECK (gross_weight_grams > 0),
  fine_weight_grams numeric NOT NULL CHECK (fine_weight_grams > 0),
  fineness_percentage numeric NOT NULL CHECK (fineness_percentage BETWEEN 0 AND 100),
  certificate_number text,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(allocation_id, inventory_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS reserve_allocation_items_active_inventory_uidx
  ON public.reserve_allocation_items(inventory_id)
  WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS public.reserve_allocation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.reserve_allocations(id) ON DELETE CASCADE,
  stage text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVED','REJECTED','CONFIRMED','RECONCILED')),
  comment text,
  actor_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(allocation_id, stage)
);

CREATE TABLE IF NOT EXISTS public.reserve_allocation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  allocation_id uuid NOT NULL REFERENCES public.reserve_allocations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status_from text,
  status_to text NOT NULL,
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actor_role text,
  comment text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reserve_allocation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.reserve_allocations(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS reserve_allocations_status_date_idx
  ON public.reserve_allocations(status, allocation_date DESC);
CREATE INDEX IF NOT EXISTS reserve_allocations_creator_idx
  ON public.reserve_allocations(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS reserve_allocation_events_allocation_idx
  ON public.reserve_allocation_events(allocation_id, occurred_at);
CREATE INDEX IF NOT EXISTS reserve_allocation_documents_allocation_idx
  ON public.reserve_allocation_documents(allocation_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Référentiels : dépositaires institutionnels issus des Parties prenantes
-- ---------------------------------------------------------------------------
INSERT INTO public.snp_organizations(
  id, code, name, short_name, organization_type, organization_subtype,
  supervising_ministry_id, is_active, address, administrative_region, scope_metadata
)
SELECT
  '71000000-0000-4000-8000-000000000001'::uuid,
  'BCEAO-BF',
  'Banque Centrale des États de l’Afrique de l’Ouest — Burkina Faso',
  'BCEAO',
  'public_institution',
  'depositaire_reserve',
  ministry.id,
  true,
  'Ouagadougou, Burkina Faso',
  'Centre',
  '{"is_reserve_depository":true,"deposit_types":["reserve_vault"]}'::jsonb
FROM public.snp_ministries ministry
ORDER BY CASE WHEN ministry.code IN ('MEF','MINEFID') THEN 0 ELSE 1 END, ministry.name
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  short_name=EXCLUDED.short_name,
  is_active=true,
  scope_metadata=public.snp_organizations.scope_metadata || EXCLUDED.scope_metadata,
  updated_at=now();

UPDATE public.snp_organizations
SET scope_metadata = scope_metadata || '{"is_reserve_depository":true,"deposit_types":["sovereign_vault"]}'::jsonb,
    updated_at = now()
WHERE organization_type='sonasp' AND is_active=true;

-- ---------------------------------------------------------------------------
-- 4. Fonctions d'autorisation, d'enregistrement et de transition
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_reserve_permission_allowed(p_permission text)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp
AS $fn$
  SELECT CASE
    WHEN coalesce(auth.role(),'')='service_role' THEN true
    WHEN p_permission NOT IN (
      'reserve.allocations.view','reserve.allocations.create','reserve.allocations.edit',
      'reserve.allocations.submit','reserve.allocations.validate_level_1',
      'reserve.allocations.validate_level_2','reserve.allocations.authorize_transfer',
      'reserve.allocations.confirm_receipt','reserve.allocations.reconcile','reserve.allocations.export'
    ) THEN false
    ELSE public.snp_actor_has_capability(p_permission)
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_next_reserve_allocation_reference()
RETURNS text
LANGUAGE sql VOLATILE
SET search_path=public,pg_temp
AS $fn$
  SELECT 'AFF-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.reserve_allocation_reference_seq')::text,4,'0');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_save_reserve_allocation(
  p_allocation_id uuid,
  p_payload jsonb,
  p_inventory_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp
AS $fn$
DECLARE
  v_id uuid;
  v_allocation public.reserve_allocations%ROWTYPE;
  v_expected integer;
  v_saved integer;
  v_gold_usd_oz numeric := 0;
  v_usd_xof numeric := 0;
  v_eur_xof numeric := 0;
  v_fcfa_gram numeric := 0;
BEGIN
  IF p_allocation_id IS NULL THEN
    IF NOT public.snp_reserve_permission_allowed('reserve.allocations.create') THEN
      RAISE EXCEPTION 'Permission reserve.allocations.create requise.' USING ERRCODE='42501';
    END IF;
    INSERT INTO public.reserve_allocations(reference, created_by, updated_by)
    VALUES(public.snp_next_reserve_allocation_reference(), auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    IF NOT public.snp_reserve_permission_allowed('reserve.allocations.edit') THEN
      RAISE EXCEPTION 'Permission reserve.allocations.edit requise.' USING ERRCODE='42501';
    END IF;
    SELECT * INTO v_allocation FROM public.reserve_allocations WHERE id=p_allocation_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Affectation introuvable.' USING ERRCODE='P0002'; END IF;
    IF v_allocation.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Seul un brouillon peut être modifié.' USING ERRCODE='22023';
    END IF;
    IF v_allocation.created_by <> auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='owner' AND p.is_active
    ) THEN
      RAISE EXCEPTION 'Seul l’auteur du brouillon peut le modifier.' USING ERRCODE='42501';
    END IF;
    v_id := p_allocation_id;
  END IF;

  SELECT coalesce(spot_price,london_pm_rate,london_am_rate,0)
  INTO v_gold_usd_oz
  FROM public.gold_prices_daily
  WHERE upper(coalesce(currency,'USD'))='USD'
  ORDER BY price_date DESC, updated_at DESC NULLS LAST LIMIT 1;

  SELECT coalesce(rate,0) INTO v_usd_xof
  FROM public.fx_rates_daily
  WHERE replace(upper(currency_pair),'-','/') IN ('USD/XOF','USD/XAF')
  ORDER BY rate_date DESC, updated_at DESC NULLS LAST LIMIT 1;

  SELECT coalesce(rate,0) INTO v_eur_xof
  FROM public.fx_rates_daily
  WHERE replace(upper(currency_pair),'-','/') IN ('EUR/XOF','EUR/XAF')
  ORDER BY rate_date DESC, updated_at DESC NULLS LAST LIMIT 1;

  v_fcfa_gram := CASE WHEN v_gold_usd_oz > 0 AND v_usd_xof > 0
    THEN (v_gold_usd_oz * v_usd_xof / 31.1034768) ELSE 0 END;

  UPDATE public.reserve_allocations SET
    allocation_date=coalesce(nullif(p_payload->>'allocation_date','')::date, allocation_date),
    reason=nullif(trim(p_payload->>'reason'),''),
    allocation_nature=nullif(trim(p_payload->>'allocation_nature'),''),
    priority=coalesce(nullif(upper(p_payload->>'priority'),''),'NORMAL'),
    decision_reference=nullif(trim(p_payload->>'decision_reference'),''),
    decision_date=nullif(p_payload->>'decision_date','')::date,
    decision_authority=nullif(trim(p_payload->>'decision_authority'),''),
    decision_department=nullif(trim(p_payload->>'decision_department'),''),
    decision_comment=nullif(trim(p_payload->>'decision_comment'),''),
    control_results=coalesce(p_payload->'control_results','{}'::jsonb),
    depository_organization_id=nullif(p_payload->>'depository_organization_id','')::uuid,
    deposit_type=nullif(trim(p_payload->>'deposit_type'),''),
    planned_deposit_reference=nullif(trim(p_payload->>'planned_deposit_reference'),''),
    planned_transfer_date=nullif(p_payload->>'planned_transfer_date','')::date,
    gold_price_fcfa_gram=v_fcfa_gram,
    usd_xof_rate=v_usd_xof,
    eur_xof_rate=v_eur_xof,
    updated_by=auth.uid(), updated_at=now()
  WHERE id=v_id;

  DELETE FROM public.reserve_allocation_items WHERE allocation_id=v_id;
  v_expected := coalesce(array_length(p_inventory_ids,1),0);

  IF v_expected > 0 THEN
    INSERT INTO public.reserve_allocation_items(
      allocation_id,inventory_id,lot_reference,ingot_count,gross_weight_grams,
      fine_weight_grams,fineness_percentage,certificate_number
    )
    SELECT
      v_id, inventory.id,
      coalesce(nullif(inventory.certificate_number,''),'LOT-' || upper(left(inventory.id::text,8))),
      1, inventory.weight_after_melting_grams, inventory.final_fine_grams,
      inventory.fineness_percentage, inventory.certificate_number
    FROM public.gold_inventory inventory
    WHERE inventory.id=ANY(p_inventory_ids)
      AND inventory.transaction_type='entry'
      AND inventory.quantity_available_oz > 0
      AND inventory.sale_id IS NULL
      AND inventory.final_fine_grams > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.reserve_allocation_items occupied
        WHERE occupied.inventory_id=inventory.id
          AND occupied.released_at IS NULL
          AND occupied.allocation_id<>v_id
      );
    GET DIAGNOSTICS v_saved = ROW_COUNT;
    IF v_saved <> v_expected THEN
      RAISE EXCEPTION 'Un ou plusieurs lingots ne sont plus éligibles ou sont déjà réservés.' USING ERRCODE='23505';
    END IF;
  END IF;

  UPDATE public.reserve_allocations allocation SET
    lot_count=totals.lot_count,
    ingot_count=totals.ingot_count,
    gross_weight_grams=totals.gross_weight,
    fine_weight_grams=totals.fine_weight,
    weighted_fineness=CASE WHEN totals.gross_weight>0 THEN totals.fine_weight/totals.gross_weight*100 ELSE 0 END,
    indicative_value_fcfa=totals.fine_weight*allocation.gold_price_fcfa_gram,
    indicative_value_usd=CASE WHEN allocation.usd_xof_rate>0 THEN totals.fine_weight*allocation.gold_price_fcfa_gram/allocation.usd_xof_rate ELSE 0 END,
    indicative_value_eur=CASE WHEN allocation.eur_xof_rate>0 THEN totals.fine_weight*allocation.gold_price_fcfa_gram/allocation.eur_xof_rate ELSE 0 END,
    updated_at=now()
  FROM (
    SELECT count(*)::integer lot_count, coalesce(sum(ingot_count),0)::integer ingot_count,
      coalesce(sum(gross_weight_grams),0) gross_weight,
      coalesce(sum(fine_weight_grams),0) fine_weight
    FROM public.reserve_allocation_items WHERE allocation_id=v_id AND released_at IS NULL
  ) totals
  WHERE allocation.id=v_id;

  IF NOT EXISTS (SELECT 1 FROM public.reserve_allocation_events WHERE allocation_id=v_id) THEN
    INSERT INTO public.reserve_allocation_events(allocation_id,event_type,status_to,actor_id,actor_role,comment)
    SELECT v_id,'CREATED','DRAFT',auth.uid(),profile.role,'Brouillon créé'
    FROM public.user_profiles profile WHERE profile.id=auth.uid();
  ELSE
    INSERT INTO public.reserve_allocation_events(allocation_id,event_type,status_from,status_to,actor_id,actor_role,comment)
    SELECT v_id,'UPDATED','DRAFT','DRAFT',auth.uid(),profile.role,'Brouillon mis à jour'
    FROM public.user_profiles profile WHERE profile.id=auth.uid();
  END IF;
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_transition_reserve_allocation(
  p_allocation_id uuid,
  p_target_status text,
  p_comment text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp
AS $fn$
DECLARE
  v_current public.reserve_allocations%ROWTYPE;
  v_permission text;
  v_previous_actor uuid;
  v_actor_role text;
BEGIN
  SELECT * INTO v_current FROM public.reserve_allocations WHERE id=p_allocation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Affectation introuvable.' USING ERRCODE='P0002'; END IF;
  p_target_status := upper(p_target_status);

  IF NOT (
    (v_current.status='DRAFT' AND p_target_status IN ('SUBMITTED','CANCELLED')) OR
    (v_current.status='SUBMITTED' AND p_target_status IN ('UNDER_REVIEW','REJECTED')) OR
    (v_current.status='UNDER_REVIEW' AND p_target_status IN ('VALIDATED_LEVEL_1','REJECTED','DISCREPANCY_REVIEW')) OR
    (v_current.status='VALIDATED_LEVEL_1' AND p_target_status IN ('VALIDATED_LEVEL_2','REJECTED')) OR
    (v_current.status='VALIDATED_LEVEL_2' AND p_target_status='TRANSFER_AUTHORIZED') OR
    (v_current.status='TRANSFER_AUTHORIZED' AND p_target_status='IN_TRANSIT') OR
    (v_current.status='IN_TRANSIT' AND p_target_status IN ('RECEIVED','DISCREPANCY_REVIEW')) OR
    (v_current.status='RECEIVED' AND p_target_status='RECONCILIATION_PENDING') OR
    (v_current.status IN ('RECONCILIATION_PENDING','DISCREPANCY_REVIEW') AND p_target_status IN ('RECONCILED','REJECTED')) OR
    (v_current.status='RECONCILED' AND p_target_status='ACTIVE')
  ) THEN
    RAISE EXCEPTION 'Transition interdite : % vers %.',v_current.status,p_target_status USING ERRCODE='22023';
  END IF;

  v_permission := CASE p_target_status
    WHEN 'SUBMITTED' THEN 'reserve.allocations.submit'
    WHEN 'UNDER_REVIEW' THEN 'reserve.allocations.validate_level_1'
    WHEN 'VALIDATED_LEVEL_1' THEN 'reserve.allocations.validate_level_1'
    WHEN 'VALIDATED_LEVEL_2' THEN 'reserve.allocations.validate_level_2'
    WHEN 'TRANSFER_AUTHORIZED' THEN 'reserve.allocations.authorize_transfer'
    WHEN 'IN_TRANSIT' THEN 'reserve.allocations.authorize_transfer'
    WHEN 'RECEIVED' THEN 'reserve.allocations.confirm_receipt'
    WHEN 'RECONCILIATION_PENDING' THEN 'reserve.allocations.reconcile'
    WHEN 'RECONCILED' THEN 'reserve.allocations.reconcile'
    WHEN 'ACTIVE' THEN 'reserve.allocations.reconcile'
    WHEN 'CANCELLED' THEN 'reserve.allocations.edit'
    WHEN 'REJECTED' THEN 'reserve.allocations.validate_level_1'
    WHEN 'DISCREPANCY_REVIEW' THEN 'reserve.allocations.reconcile'
  END;
  IF NOT public.snp_reserve_permission_allowed(v_permission) THEN
    RAISE EXCEPTION 'Permission % requise.',v_permission USING ERRCODE='42501';
  END IF;

  IF p_target_status='SUBMITTED' THEN
    IF v_current.lot_count=0 OR v_current.depository_organization_id IS NULL
      OR v_current.reason IS NULL OR v_current.decision_reference IS NULL THEN
      RAISE EXCEPTION 'Sélection, motif, décision et dépositaire sont obligatoires avant soumission.' USING ERRCODE='22023';
    END IF;
    IF NOT (
      coalesce((v_current.control_results->>'purity')::boolean,false)
      AND coalesce((v_current.control_results->>'weight')::boolean,false)
      AND coalesce((v_current.control_results->>'certificates')::boolean,false)
      AND coalesce((v_current.control_results->>'eligibility')::boolean,false)
      AND coalesce((v_current.control_results->>'sale_conflict')::boolean,false)
      AND coalesce((v_current.control_results->>'availability')::boolean,false)
    ) THEN
      RAISE EXCEPTION 'Tous les contrôles d’éligibilité doivent être confirmés.' USING ERRCODE='22023';
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM public.reserve_allocation_documents document
      WHERE document.allocation_id=p_allocation_id
        AND document.deleted_at IS NULL
        AND document.document_type='decision_allocation'
    ) THEN
      RAISE EXCEPTION 'La décision d’affectation doit être jointe avant soumission.' USING ERRCODE='22023';
    END IF;
  END IF;

  IF p_target_status IN ('VALIDATED_LEVEL_1','VALIDATED_LEVEL_2','TRANSFER_AUTHORIZED','RECONCILED','ACTIVE')
     AND v_current.created_by=auth.uid() THEN
    RAISE EXCEPTION 'Séparation des tâches : l’auteur ne peut pas valider son propre dossier.' USING ERRCODE='42501';
  END IF;
  IF p_target_status='VALIDATED_LEVEL_2' THEN
    SELECT actor_id INTO v_previous_actor FROM public.reserve_allocation_approvals
    WHERE allocation_id=p_allocation_id AND stage='VALIDATED_LEVEL_1';
    IF v_previous_actor=auth.uid() THEN
      RAISE EXCEPTION 'La validation de niveau 2 exige un acteur distinct.' USING ERRCODE='42501';
    END IF;
  END IF;

  SELECT role INTO v_actor_role FROM public.user_profiles WHERE id=auth.uid() AND is_active;
  UPDATE public.reserve_allocations SET
    status=p_target_status,
    submitted_at=CASE WHEN p_target_status='SUBMITTED' THEN now() ELSE submitted_at END,
    completed_at=CASE WHEN p_target_status='ACTIVE' THEN now() ELSE completed_at END,
    updated_by=auth.uid(), updated_at=now()
  WHERE id=p_allocation_id;

  INSERT INTO public.reserve_allocation_events(
    allocation_id,event_type,status_from,status_to,actor_id,actor_role,comment
  ) VALUES(p_allocation_id,'STATUS_TRANSITION',v_current.status,p_target_status,auth.uid(),v_actor_role,nullif(trim(p_comment),''));

  IF p_target_status IN ('VALIDATED_LEVEL_1','VALIDATED_LEVEL_2','TRANSFER_AUTHORIZED','RECEIVED','RECONCILED') THEN
    INSERT INTO public.reserve_allocation_approvals(allocation_id,stage,decision,comment,actor_id)
    VALUES(p_allocation_id,p_target_status,
      CASE WHEN p_target_status='RECEIVED' THEN 'CONFIRMED' WHEN p_target_status='RECONCILED' THEN 'RECONCILED' ELSE 'APPROVED' END,
      nullif(trim(p_comment),''),auth.uid())
    ON CONFLICT(allocation_id,stage) DO NOTHING;
  END IF;

  IF p_target_status IN ('CANCELLED','REJECTED') THEN
    UPDATE public.reserve_allocation_items SET released_at=now()
    WHERE allocation_id=p_allocation_id AND released_at IS NULL;
  ELSIF p_target_status='ACTIVE' THEN
    UPDATE public.gold_inventory inventory SET
      quantity_available_oz=greatest(0,inventory.quantity_available_oz-(item.fine_weight_grams/31.1034768)),
      quantity_national_reserve_oz=coalesce(inventory.quantity_national_reserve_oz,0)+(item.fine_weight_grams/31.1034768),
      updated_at=now()
    FROM public.reserve_allocation_items item
    WHERE item.allocation_id=p_allocation_id AND item.inventory_id=inventory.id AND item.released_at IS NULL;
  END IF;
  RETURN p_target_status;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_register_reserve_document(
  p_allocation_id uuid,p_document_type text,p_file_name text,p_storage_path text,p_mime_type text,p_size_bytes bigint
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp
AS $fn$
DECLARE v_id uuid;
BEGIN
  IF NOT public.snp_reserve_permission_allowed('reserve.allocations.edit') THEN
    RAISE EXCEPTION 'Permission reserve.allocations.edit requise.' USING ERRCODE='42501';
  END IF;
  IF p_mime_type NOT IN ('application/pdf','image/png','image/jpeg','image/webp') OR p_size_bytes<=0 OR p_size_bytes>15728640 THEN
    RAISE EXCEPTION 'Document invalide : PDF ou image, 15 Mo maximum.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.reserve_allocations WHERE id=p_allocation_id AND status='DRAFT') THEN
    RAISE EXCEPTION 'Les pièces ne peuvent être modifiées que sur un brouillon.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.reserve_allocation_documents(
    allocation_id,document_type,file_name,storage_path,mime_type,size_bytes,uploaded_by
  ) VALUES(p_allocation_id,p_document_type,p_file_name,p_storage_path,p_mime_type,p_size_bytes,auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Vue d'éligibilité et sécurité RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.snp_reserve_eligible_inventory
WITH (security_invoker=true)
AS
SELECT
  inventory.id,
  coalesce(nullif(inventory.certificate_number,''),'LOT-' || upper(left(inventory.id::text,8))) AS lot_reference,
  inventory.certificate_number,
  inventory.entry_date,
  inventory.weight_after_melting_grams AS gross_weight_grams,
  inventory.final_fine_grams AS fine_weight_grams,
  inventory.fineness_percentage,
  inventory.quantity_available_oz,
  inventory.processing_location,
  inventory.refinery_id,
  refinery.name AS refinery_name,
  inventory.mining_company_id,
  company.name AS source_name
FROM public.gold_inventory inventory
LEFT JOIN public.refineries refinery ON refinery.id=inventory.refinery_id
LEFT JOIN public.mining_companies company ON company.id=inventory.mining_company_id
WHERE inventory.transaction_type='entry'
  AND inventory.quantity_available_oz>0
  AND inventory.sale_id IS NULL
  AND inventory.final_fine_grams>0
  AND NOT EXISTS(
    SELECT 1 FROM public.reserve_allocation_items occupied
    WHERE occupied.inventory_id=inventory.id AND occupied.released_at IS NULL
  );

ALTER TABLE public.reserve_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_allocation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_allocation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_allocation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_allocation_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reserve_allocations_read ON public.reserve_allocations;
CREATE POLICY reserve_allocations_read ON public.reserve_allocations FOR SELECT TO authenticated
USING(public.snp_reserve_permission_allowed('reserve.allocations.view'));
DROP POLICY IF EXISTS reserve_allocation_items_read ON public.reserve_allocation_items;
CREATE POLICY reserve_allocation_items_read ON public.reserve_allocation_items FOR SELECT TO authenticated
USING(public.snp_reserve_permission_allowed('reserve.allocations.view'));
DROP POLICY IF EXISTS reserve_allocation_approvals_read ON public.reserve_allocation_approvals;
CREATE POLICY reserve_allocation_approvals_read ON public.reserve_allocation_approvals FOR SELECT TO authenticated
USING(public.snp_reserve_permission_allowed('reserve.allocations.view'));
DROP POLICY IF EXISTS reserve_allocation_events_read ON public.reserve_allocation_events;
CREATE POLICY reserve_allocation_events_read ON public.reserve_allocation_events FOR SELECT TO authenticated
USING(public.snp_reserve_permission_allowed('reserve.allocations.view'));
DROP POLICY IF EXISTS reserve_allocation_documents_read ON public.reserve_allocation_documents;
CREATE POLICY reserve_allocation_documents_read ON public.reserve_allocation_documents FOR SELECT TO authenticated
USING(public.snp_reserve_permission_allowed('reserve.allocations.view'));

REVOKE INSERT,UPDATE,DELETE ON public.reserve_allocations,public.reserve_allocation_items,
  public.reserve_allocation_approvals,public.reserve_allocation_events,public.reserve_allocation_documents FROM authenticated;
GRANT SELECT ON public.reserve_allocations,public.reserve_allocation_items,
  public.reserve_allocation_approvals,public.reserve_allocation_events,public.reserve_allocation_documents TO authenticated;
GRANT SELECT ON public.snp_reserve_eligible_inventory TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.reserve_allocation_events_id_seq TO authenticated;

REVOKE ALL ON FUNCTION public.snp_save_reserve_allocation(uuid,jsonb,uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_transition_reserve_allocation(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_register_reserve_document(uuid,text,text,text,text,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snp_save_reserve_allocation(uuid,jsonb,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_transition_reserve_allocation(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_register_reserve_document(uuid,text,text,text,text,bigint) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('reserve-documents','reserve-documents',false,15728640,ARRAY['application/pdf','image/png','image/jpeg','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS reserve_documents_storage_read ON storage.objects;
CREATE POLICY reserve_documents_storage_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='reserve-documents' AND public.snp_reserve_permission_allowed('reserve.allocations.view'));
DROP POLICY IF EXISTS reserve_documents_storage_insert ON storage.objects;
CREATE POLICY reserve_documents_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(
  bucket_id='reserve-documents'
  AND public.snp_reserve_permission_allowed('reserve.allocations.edit')
  AND EXISTS(
    SELECT 1 FROM public.reserve_allocations allocation
    WHERE allocation.id=(storage.foldername(name))[1]::uuid AND allocation.status='DRAFT'
  )
);
DROP POLICY IF EXISTS reserve_documents_storage_delete ON storage.objects;
CREATE POLICY reserve_documents_storage_delete ON storage.objects FOR DELETE TO authenticated
USING(
  bucket_id='reserve-documents'
  AND public.snp_reserve_permission_allowed('reserve.allocations.edit')
  AND EXISTS(
    SELECT 1 FROM public.reserve_allocations allocation
    WHERE allocation.id=(storage.foldername(name))[1]::uuid AND allocation.status='DRAFT'
  )
);

-- ---------------------------------------------------------------------------
-- 6. Catalogue de navigation
-- ---------------------------------------------------------------------------
WITH parent AS (SELECT id FROM public.snp_modules WHERE code='gold_inventory' LIMIT 1),
children(code,nom,description,icone,route,ordre) AS (
  VALUES
    ('inventory-overview','Vue d’ensemble','Vue consolidée de la réserve nationale.','Grid2X2','/inventory',1),
    ('inventory-allocations','Affectations à la réserve','Suivi des affectations de lingots à la réserve.','PackageCheck','/national-reserve/allocations',2),
    ('inventory-physical','Réserve physique','Position physique de la réserve.','Landmark','/inventory',3),
    ('inventory-controls','Contrôles & rapprochements','Contrôles et rapprochements de la réserve.','ShieldCheck','/inventory',4),
    ('inventory-valuation','Valorisation & analyse','Valorisation économique de la réserve.','TrendingUp','/inventory',5),
    ('inventory-audit','Rapports & audit','Rapports et journal de la réserve.','ClipboardCheck','/inventory',6)
)
INSERT INTO public.snp_modules(code,nom,description,icone,route,parent_id,ordre,est_actif,est_visible_menu,permissions_requises)
SELECT children.code,children.nom,children.description,children.icone,children.route,parent.id,children.ordre,true,true,'{}'::text[]
FROM children CROSS JOIN parent
ON CONFLICT(code) DO UPDATE SET
  nom=EXCLUDED.nom,description=EXCLUDED.description,icone=EXCLUDED.icone,route=EXCLUDED.route,
  parent_id=EXCLUDED.parent_id,ordre=EXCLUDED.ordre,est_actif=true,est_visible_menu=true,updated_at=now();

UPDATE public.snp_modules SET est_visible_menu=false,updated_at=now()
WHERE code IN ('inventory-national-position','inventory-silver','inventory-new-entry');

NOTIFY pgrst,'reload schema';
COMMIT;
