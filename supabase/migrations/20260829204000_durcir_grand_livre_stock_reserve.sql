-- Grand livre Stock / Réserve nationale : conservation, idempotence et sources.
-- Migration additive ; aucune donnée métier n'est supprimée. Seules les
-- écritures techniques dupliquées par deux triggers concurrents sont consolidées.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.gold_inventory') IS NULL
     OR to_regclass('public.inventory_transactions') IS NULL
     OR to_regclass('public.snp_ventes_lots') IS NULL
     OR to_regclass('public.reserve_allocation_items') IS NULL THEN
    RAISE EXCEPTION 'Prérequis Stock/Réserve absents.';
  END IF;
END;
$preflight$;

-- 1. Un mouvement d'entrée canonique par ligne d'inventaire.
INSERT INTO public.snp_data_quality_issues(entity_type,entity_id,issue_code,details)
SELECT
  'gold_inventory', movement.inventory_id, 'DUPLICATE_INVENTORY_ENTRY_LEDGER',
  jsonb_build_object('entry_movements',count(*),'detected_unit','ounce')
FROM public.inventory_transactions movement
WHERE movement.transaction_type='entry'
GROUP BY movement.inventory_id
HAVING count(*)>1
ON CONFLICT(entity_type,entity_id,issue_code) DO UPDATE
SET details=EXCLUDED.details, detected_at=now(), resolved_at=NULL;

WITH ranked AS (
  SELECT movement.id,
    row_number() OVER(
      PARTITION BY movement.inventory_id
      ORDER BY (movement.freight_shipment_id IS NOT NULL) DESC,
               movement.created_at ASC NULLS LAST,
               movement.id
    ) AS position
  FROM public.inventory_transactions movement
  WHERE movement.transaction_type='entry'
)
DELETE FROM public.inventory_transactions movement
USING ranked
WHERE movement.id=ranked.id AND ranked.position>1;

UPDATE public.inventory_transactions movement
SET quantity_oz=inventory.final_fine_grams/31.1034768,
    quantity_grams=inventory.final_fine_grams,
    balance_before_oz=0,
    balance_after_oz=inventory.final_fine_grams/31.1034768,
    freight_shipment_id=inventory.freight_shipment_id,
    transaction_reference=coalesce(
      nullif(movement.transaction_reference,''),
      'INV-' || upper(left(inventory.id::text,8))
    )
FROM public.gold_inventory inventory
WHERE movement.inventory_id=inventory.id AND movement.transaction_type='entry';

DROP TRIGGER IF EXISTS trigger_log_inventory_transaction ON public.gold_inventory;
DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON public.gold_inventory;

CREATE OR REPLACE FUNCTION public.create_inventory_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  IF NEW.transaction_type='entry' THEN
    INSERT INTO public.inventory_transactions(
      inventory_id,freight_shipment_id,sale_id,transaction_type,
      quantity_oz,quantity_grams,balance_before_oz,balance_after_oz,
      transaction_reference,notes,created_by
    ) VALUES(
      NEW.id,NEW.freight_shipment_id,NEW.sale_id,'entry',
      NEW.final_fine_grams/31.1034768,NEW.final_fine_grams,0,
      NEW.final_fine_grams/31.1034768,
      'INV-' || upper(left(NEW.id::text,8)),NEW.notes,NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trigger_create_inventory_transaction
AFTER INSERT ON public.gold_inventory
FOR EACH ROW EXECUTE FUNCTION public.create_inventory_transaction();

CREATE UNIQUE INDEX IF NOT EXISTS inventory_transactions_one_entry_uidx
  ON public.inventory_transactions(inventory_id)
  WHERE transaction_type='entry';

REVOKE ALL ON FUNCTION public.create_inventory_transaction() FROM PUBLIC,anon,authenticated;

-- 2. Conservation locale : disponible + alloué + vendu + réserve ne peut
-- jamais dépasser le poids fin calculé du lingot.
UPDATE public.gold_inventory
SET quantity_available_oz=greatest(0,
      final_fine_oz
      - coalesce(quantity_allocated_oz,0)
      - coalesce(quantity_sold_oz,0)
      - coalesce(quantity_national_reserve_oz,0))
WHERE transaction_type='entry'
  AND coalesce(quantity_available_oz,0)
      + coalesce(quantity_allocated_oz,0)
      + coalesce(quantity_sold_oz,0)
      + coalesce(quantity_national_reserve_oz,0) > final_fine_oz+0.000001;

ALTER TABLE public.gold_inventory
  DROP CONSTRAINT IF EXISTS gold_inventory_conservation_check;
ALTER TABLE public.gold_inventory
  ADD CONSTRAINT gold_inventory_conservation_check CHECK(
    coalesce(quantity_available_oz,0)>=0
    AND coalesce(quantity_allocated_oz,0)>=0
    AND coalesce(quantity_sold_oz,0)>=0
    AND coalesce(quantity_national_reserve_oz,0)>=0
    AND coalesce(quantity_available_oz,0)
      + coalesce(quantity_allocated_oz,0)
      + coalesce(quantity_sold_oz,0)
      + coalesce(quantity_national_reserve_oz,0) <= final_fine_oz+0.000001
  ) NOT VALID;
ALTER TABLE public.gold_inventory VALIDATE CONSTRAINT gold_inventory_conservation_check;

REVOKE INSERT,UPDATE,DELETE ON public.gold_inventory FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.inventory_transactions FROM authenticated;

DROP POLICY IF EXISTS snp_stock_insertion_interne ON public.gold_inventory;
DROP POLICY IF EXISTS snp_stock_modification_interne ON public.gold_inventory;
DROP POLICY IF EXISTS snp_stock_suppression_interne ON public.gold_inventory;
DROP POLICY IF EXISTS snp_mouvement_stock_insertion ON public.inventory_transactions;
DROP POLICY IF EXISTS snp_mouvement_stock_modification ON public.inventory_transactions;
DROP POLICY IF EXISTS snp_mouvement_stock_suppression ON public.inventory_transactions;

-- L'entrée de stock et la transition du fret sont une seule transaction.
CREATE OR REPLACE FUNCTION public.snp_register_gold_inventory_entry(
  p_freight_shipment_id uuid,
  p_weight_before_melting_grams numeric,
  p_weight_after_melting_grams numeric,
  p_fineness_percentage numeric,
  p_metal_retained_percentage numeric,
  p_silver_percentage numeric DEFAULT 0,
  p_processing_location text DEFAULT NULL,
  p_certificate_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.gold_inventory
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_shipment public.freight_shipments%ROWTYPE;
  v_existing public.gold_inventory%ROWTYPE;
  v_result public.gold_inventory%ROWTYPE;
BEGIN
  IF NOT public.snp_mfa_satisfaite() OR NOT public.snp_actor_has_capability('sonasp.prepare') THEN
    RAISE EXCEPTION 'Habilitation et authentification forte requises.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_actor FROM public.user_profiles WHERE id=auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil actif requis.' USING ERRCODE='42501'; END IF;
  IF p_freight_shipment_id IS NULL
     OR p_weight_before_melting_grams<=0 OR p_weight_after_melting_grams<=0
     OR p_weight_after_melting_grams>p_weight_before_melting_grams
     OR p_fineness_percentage NOT BETWEEN 0 AND 100
     OR p_metal_retained_percentage NOT BETWEEN 0 AND 100
     OR coalesce(p_silver_percentage,0) NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'Mesures de stock invalides.' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_freight_shipment_id::text,0));
  SELECT * INTO v_shipment FROM public.freight_shipments
  WHERE id=p_freight_shipment_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expédition introuvable.' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_existing FROM public.gold_inventory
  WHERE freight_shipment_id=p_freight_shipment_id AND transaction_type='entry'
  ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF abs(v_existing.weight_before_melting_grams-p_weight_before_melting_grams)<=0.001
       AND abs(v_existing.weight_after_melting_grams-p_weight_after_melting_grams)<=0.001
       AND abs(v_existing.fineness_percentage-p_fineness_percentage)<=0.0001
       AND abs(v_existing.metal_retained_percentage-p_metal_retained_percentage)<=0.0001 THEN
      RETURN v_existing;
    END IF;
    RAISE EXCEPTION 'Cette expédition possède déjà une entrée incompatible.' USING ERRCODE='23505';
  END IF;
  IF v_shipment.status::text<>'processed' THEN
    RAISE EXCEPTION 'Seule une expédition traitée peut entrer en stock.' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.gold_inventory(
    entry_date,freight_shipment_id,weight_before_melting_grams,
    weight_after_melting_grams,fineness_percentage,metal_retained_percentage,
    final_fine_grams,final_fine_oz,quantity_available_oz,transaction_type,
    silver_percentage,refinery_id,mining_company_id,processing_location,
    certificate_number,notes,created_by
  ) VALUES(
    current_date,p_freight_shipment_id,p_weight_before_melting_grams,
    p_weight_after_melting_grams,p_fineness_percentage,p_metal_retained_percentage,
    p_weight_after_melting_grams*p_fineness_percentage/100*p_metal_retained_percentage/100,
    p_weight_after_melting_grams*p_fineness_percentage/100*p_metal_retained_percentage/100/31.1034768,
    p_weight_after_melting_grams*p_fineness_percentage/100*p_metal_retained_percentage/100/31.1034768,
    'entry',coalesce(p_silver_percentage,0),v_shipment.destination_refinery_id,
    v_shipment.mining_company_id,nullif(trim(p_processing_location),''),
    nullif(trim(p_certificate_number),''),nullif(trim(p_notes),''),v_actor.id
  ) RETURNING * INTO v_result;

  UPDATE public.freight_shipments
  SET status='in_stock',stocked_at=coalesce(stocked_at,now()),stocked_by=coalesce(stocked_by,v_actor.id),updated_at=now()
  WHERE id=p_freight_shipment_id;
  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_register_gold_inventory_entry(
  uuid,numeric,numeric,numeric,numeric,numeric,text,text,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_register_gold_inventory_entry(
  uuid,numeric,numeric,numeric,numeric,numeric,text,text,text
) TO authenticated;

-- 3. Une cession acceptée par la SONASP est la seule source exportable d'un
-- achat effectué par un comptoir. Elle ne doit jamais être recomptée comme
-- achat artisanal direct de la SONASP.
ALTER TABLE public.snp_ventes_lots
  ADD COLUMN IF NOT EXISTS comptoir_cession_id uuid
  REFERENCES public.snp_comptoir_ventes_sonasp(id) ON DELETE RESTRICT;

ALTER TABLE public.snp_ventes_lots
  DROP CONSTRAINT IF EXISTS snp_ventes_lots_source_type_check;
ALTER TABLE public.snp_ventes_lots
  ADD CONSTRAINT snp_ventes_lots_source_type_check CHECK(
    source_type IN('achat_mine','achat_artisan','cession_comptoir')
  ) NOT VALID;
ALTER TABLE public.snp_ventes_lots VALIDATE CONSTRAINT snp_ventes_lots_source_type_check;

ALTER TABLE public.snp_ventes_lots
  DROP CONSTRAINT IF EXISTS snp_ventes_lots_source_unique;
ALTER TABLE public.snp_ventes_lots
  ADD CONSTRAINT snp_ventes_lots_source_unique CHECK(
    (source_type='achat_mine' AND achat_mine_id IS NOT NULL
      AND artisan_vente_id IS NULL AND comptoir_cession_id IS NULL)
    OR
    (source_type='achat_artisan' AND artisan_vente_id IS NOT NULL
      AND achat_mine_id IS NULL AND comptoir_cession_id IS NULL)
    OR
    (source_type='cession_comptoir' AND comptoir_cession_id IS NOT NULL
      AND achat_mine_id IS NULL AND artisan_vente_id IS NULL)
  ) NOT VALID;
ALTER TABLE public.snp_ventes_lots VALIDATE CONSTRAINT snp_ventes_lots_source_unique;

CREATE INDEX IF NOT EXISTS idx_snp_ventes_lots_active_cession
  ON public.snp_ventes_lots(comptoir_cession_id)
  WHERE released_at IS NULL AND comptoir_cession_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.snp_exportable_stock_capacity()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
  WITH totals AS (
    SELECT
      coalesce((SELECT sum(purchase.quantite_oz)
                FROM public.snp_achats_mines purchase
                WHERE purchase.statut IN('validee','payee')),0)
      + coalesce((SELECT sum(purchase.quantite_grammes)/31.1034768
                  FROM public.snp_artisan_ventes_or purchase
                  WHERE purchase.statut IN('validee','payee')
                    AND purchase.comptoir_organization_id IS NULL),0)
      + coalesce((SELECT sum(cession.quantity_grams)/31.1034768
                  FROM public.snp_comptoir_ventes_sonasp cession
                  WHERE cession.status IN('accepted','paid')),0) AS acquired,
      coalesce((SELECT sum(inventory.final_fine_oz)
                FROM public.gold_inventory inventory
                WHERE inventory.transaction_type='entry'),0) AS legacy_inventory
  )
  SELECT CASE WHEN acquired>0 THEN acquired ELSE legacy_inventory END FROM totals;
$fn$;

REVOKE ALL ON FUNCTION public.snp_exportable_stock_capacity() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.snp_guard_export_sale_lot_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_source_quantity numeric;
  v_source_allocated numeric;
  v_exported numeric;
  v_reserved numeric;
  v_old_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));
  IF TG_OP='UPDATE' THEN v_old_id:=OLD.id; END IF;

  IF NEW.released_at IS NULL THEN
    IF NEW.source_type='achat_mine' THEN
      SELECT purchase.quantite_oz INTO v_source_quantity
      FROM public.snp_achats_mines purchase
      WHERE purchase.id=NEW.achat_mine_id AND purchase.statut IN('validee','payee') FOR UPDATE;
      SELECT coalesce(sum(lot.quantite_oz),0) INTO v_source_allocated
      FROM public.snp_ventes_lots lot
      WHERE lot.achat_mine_id=NEW.achat_mine_id AND lot.released_at IS NULL
        AND (v_old_id IS NULL OR lot.id<>v_old_id);
    ELSIF NEW.source_type='achat_artisan' THEN
      SELECT purchase.quantite_grammes/31.1034768 INTO v_source_quantity
      FROM public.snp_artisan_ventes_or purchase
      WHERE purchase.id=NEW.artisan_vente_id AND purchase.statut IN('validee','payee')
        AND purchase.comptoir_organization_id IS NULL FOR UPDATE;
      SELECT coalesce(sum(lot.quantite_oz),0) INTO v_source_allocated
      FROM public.snp_ventes_lots lot
      WHERE lot.artisan_vente_id=NEW.artisan_vente_id AND lot.released_at IS NULL
        AND (v_old_id IS NULL OR lot.id<>v_old_id);
    ELSIF NEW.source_type='cession_comptoir' THEN
      SELECT cession.quantity_grams/31.1034768 INTO v_source_quantity
      FROM public.snp_comptoir_ventes_sonasp cession
      WHERE cession.id=NEW.comptoir_cession_id AND cession.status IN('accepted','paid') FOR UPDATE;
      SELECT coalesce(sum(lot.quantite_oz),0) INTO v_source_allocated
      FROM public.snp_ventes_lots lot
      WHERE lot.comptoir_cession_id=NEW.comptoir_cession_id AND lot.released_at IS NULL
        AND (v_old_id IS NULL OR lot.id<>v_old_id);
    ELSE
      RAISE EXCEPTION 'Source de lot export inconnue.' USING ERRCODE='23514';
    END IF;
    IF v_source_quantity IS NULL THEN
      RAISE EXCEPTION 'La source n’est pas acquise ou mobilisable.' USING ERRCODE='42501';
    END IF;
    IF v_source_allocated+NEW.quantite_oz>v_source_quantity+0.000001 THEN
      RAISE EXCEPTION 'La quantité du lot source est dépassée.' USING ERRCODE='23514';
    END IF;
  END IF;

  SELECT coalesce(sum(lot.quantite_oz),0) INTO v_exported
  FROM public.snp_ventes_lots lot
  WHERE lot.released_at IS NULL AND (v_old_id IS NULL OR lot.id<>v_old_id);
  SELECT coalesce(sum(inventory.quantity_national_reserve_oz),0) INTO v_reserved
  FROM public.gold_inventory inventory;
  IF v_exported + (CASE WHEN NEW.released_at IS NULL THEN NEW.quantite_oz ELSE 0 END)
       + v_reserved > public.snp_exportable_stock_capacity()+0.000001 THEN
    RAISE EXCEPTION 'Stock national insuffisant après prise en compte de la réserve.' USING ERRCODE='23514';
  END IF;
  NEW.created_by:=coalesce(NEW.created_by,auth.uid());
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_export_sale_lot_stock_guard ON public.snp_ventes_lots;
CREATE TRIGGER snp_export_sale_lot_stock_guard
BEFORE INSERT OR UPDATE OF source_type,achat_mine_id,artisan_vente_id,
  comptoir_cession_id,quantite_oz,released_at
ON public.snp_ventes_lots
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_export_sale_lot_stock();
REVOKE ALL ON FUNCTION public.snp_guard_export_sale_lot_stock() FROM PUBLIC,anon,authenticated;

-- 4. Les lingots sont indivisibles : une affectation ne peut porter que sur
-- un lingot entièrement libre et la photographie du poids est imposée par SQL.
CREATE OR REPLACE FUNCTION public.snp_guard_reserve_allocation_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_inventory public.gold_inventory%ROWTYPE;
BEGIN
  SELECT * INTO v_inventory FROM public.gold_inventory
  WHERE id=NEW.inventory_id FOR UPDATE;
  IF NOT FOUND OR v_inventory.transaction_type<>'entry' OR v_inventory.sale_id IS NOT NULL
     OR v_inventory.final_fine_grams<=0
     OR coalesce(v_inventory.quantity_allocated_oz,0)>0.000001
     OR coalesce(v_inventory.quantity_sold_oz,0)>0.000001
     OR coalesce(v_inventory.quantity_national_reserve_oz,0)>0.000001
     OR v_inventory.quantity_available_oz+0.000001<v_inventory.final_fine_oz THEN
    RAISE EXCEPTION 'Le lingot doit être entièrement libre pour être affecté à la réserve.' USING ERRCODE='23514';
  END IF;
  NEW.lot_reference:=coalesce(nullif(v_inventory.certificate_number,''),'LOT-'||upper(left(v_inventory.id::text,8)));
  NEW.ingot_count:=1;
  NEW.gross_weight_grams:=v_inventory.weight_after_melting_grams;
  NEW.fine_weight_grams:=v_inventory.final_fine_grams;
  NEW.fineness_percentage:=v_inventory.fineness_percentage;
  NEW.certificate_number:=v_inventory.certificate_number;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_reserve_allocation_item_guard ON public.reserve_allocation_items;
CREATE TRIGGER snp_reserve_allocation_item_guard
BEFORE INSERT OR UPDATE OF inventory_id,gross_weight_grams,fine_weight_grams,
  fineness_percentage,ingot_count
ON public.reserve_allocation_items
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_reserve_allocation_item();
REVOKE ALL ON FUNCTION public.snp_guard_reserve_allocation_item() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE VIEW public.snp_reserve_eligible_inventory
WITH (security_invoker=true)
AS
SELECT
  inventory.id,
  coalesce(nullif(inventory.certificate_number,''),'LOT-'||upper(left(inventory.id::text,8))) AS lot_reference,
  inventory.certificate_number,inventory.entry_date,
  inventory.weight_after_melting_grams AS gross_weight_grams,
  inventory.final_fine_grams AS fine_weight_grams,inventory.fineness_percentage,
  inventory.quantity_available_oz,inventory.processing_location,
  inventory.refinery_id,refinery.name AS refinery_name,
  inventory.mining_company_id,company.name AS source_name
FROM public.gold_inventory inventory
LEFT JOIN public.refineries refinery ON refinery.id=inventory.refinery_id
LEFT JOIN public.mining_companies company ON company.id=inventory.mining_company_id
WHERE inventory.transaction_type='entry' AND inventory.sale_id IS NULL
  AND inventory.final_fine_grams>0
  AND coalesce(inventory.quantity_allocated_oz,0)<=0.000001
  AND coalesce(inventory.quantity_sold_oz,0)<=0.000001
  AND coalesce(inventory.quantity_national_reserve_oz,0)<=0.000001
  AND inventory.quantity_available_oz+0.000001>=inventory.final_fine_oz
  AND NOT EXISTS(
    SELECT 1 FROM public.reserve_allocation_items occupied
    WHERE occupied.inventory_id=inventory.id AND occupied.released_at IS NULL
  );
GRANT SELECT ON public.snp_reserve_eligible_inventory TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_zero_operational_stock_on_reserve()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_delta numeric;
BEGIN
  v_delta:=NEW.quantity_national_reserve_oz-OLD.quantity_national_reserve_oz;
  IF v_delta>0 THEN
    IF v_delta>OLD.quantity_available_oz+0.000001 THEN
      RAISE EXCEPTION 'Le stock disponible du lingot est insuffisant.' USING ERRCODE='23514';
    END IF;
    NEW.quantity_available_oz:=greatest(0,OLD.quantity_available_oz-v_delta);
  END IF;
  RETURN NEW;
END;
$fn$;

-- Dépositaires actifs et typés obligatoires dès la soumission.
CREATE OR REPLACE FUNCTION public.snp_validate_reserve_depository()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  IF NEW.status NOT IN('DRAFT','CANCELLED','REJECTED') AND (
    NEW.depository_organization_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.snp_organizations organization
      WHERE organization.id=NEW.depository_organization_id
        AND organization.is_active
        AND (organization.organization_type='sonasp'
             OR organization.organization_subtype IN(
               'depositaire_reserve','reserve_depository','central_bank','sovereign_vault'
             )
             OR organization.scope_metadata->>'is_reserve_depository'='true')
    )
  ) THEN
    RAISE EXCEPTION 'Un dépositaire de réserve actif et habilité est obligatoire.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_reserve_depository_guard ON public.reserve_allocations;
CREATE TRIGGER snp_reserve_depository_guard
BEFORE INSERT OR UPDATE OF status,depository_organization_id ON public.reserve_allocations
FOR EACH ROW EXECUTE FUNCTION public.snp_validate_reserve_depository();
REVOKE ALL ON FUNCTION public.snp_validate_reserve_depository() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.snp_guard_reserve_stock_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_exported numeric; v_reserved numeric;
BEGIN
  IF NEW.status='ACTIVE' AND OLD.status IS DISTINCT FROM 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));
    IF EXISTS(
      SELECT 1
      FROM public.reserve_allocation_items item
      JOIN public.gold_inventory inventory ON inventory.id=item.inventory_id
      WHERE item.allocation_id=NEW.id AND item.released_at IS NULL
        AND (coalesce(inventory.quantity_allocated_oz,0)>0.000001
          OR coalesce(inventory.quantity_sold_oz,0)>0.000001
          OR coalesce(inventory.quantity_national_reserve_oz,0)>0.000001
          OR inventory.quantity_available_oz+0.000001<inventory.final_fine_oz)
    ) THEN
      RAISE EXCEPTION 'Un lingot de l’affectation n’est plus entièrement disponible.' USING ERRCODE='23514';
    END IF;
    SELECT coalesce(sum(lot.quantite_oz),0) INTO v_exported
    FROM public.snp_ventes_lots lot WHERE lot.released_at IS NULL;
    SELECT coalesce(sum(inventory.quantity_national_reserve_oz),0) INTO v_reserved
    FROM public.gold_inventory inventory;
    IF v_exported+v_reserved+(NEW.fine_weight_grams/31.1034768)
       >public.snp_exportable_stock_capacity()+0.000001 THEN
      RAISE EXCEPTION 'Stock national insuffisant pour activer cette affectation.' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_reserve_stock_capacity_guard ON public.reserve_allocations;
CREATE TRIGGER snp_reserve_stock_capacity_guard
BEFORE UPDATE OF status ON public.reserve_allocations
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_reserve_stock_capacity();
REVOKE ALL ON FUNCTION public.snp_guard_reserve_stock_capacity() FROM PUBLIC,anon,authenticated;

-- 5. Création export : les trois sources sont verrouillées et consommées
-- atomiquement. L'ancien point d'entrée devient interne ; le navigateur passe
-- par une enveloppe idempotente.
CREATE OR REPLACE FUNCTION public.snp_creer_vente_export(
  p_customer_id uuid,p_seller_id uuid,p_quantity_oz numeric,p_london_am_rate numeric,
  p_freight_cost numeric DEFAULT 0,p_other_costs numeric DEFAULT 0,
  p_mechanism_type text DEFAULT NULL,p_in_process_refinery_id uuid DEFAULT NULL,
  p_lots jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_setting public.gold_sales_settings%ROWTYPE;
  v_lot record;
  v_source_quantity numeric;
  v_already_allocated numeric;
  v_lots_total numeric:=0;
  v_available_total numeric:=0;
  v_royalty_rate numeric;
  v_gross numeric; v_net numeric; v_royalty numeric; v_final numeric;
  v_year integer:=extract(year FROM current_date)::integer;
  v_next integer; v_sale_number text;
  v_sale public.sales%ROWTYPE;
  v_request_id uuid;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise pour créer une vente.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_actor FROM public.user_profiles WHERE id=auth.uid() AND is_active;
  IF NOT FOUND OR v_actor.role NOT IN('owner','admin','management') THEN
    RAISE EXCEPTION 'Votre rôle ne permet pas de créer une vente export.' USING ERRCODE='42501';
  END IF;
  IF p_quantity_oz IS NULL OR p_quantity_oz::text='NaN' OR p_quantity_oz<=0
     OR p_london_am_rate IS NULL OR p_london_am_rate::text='NaN' OR p_london_am_rate<=0
     OR coalesce(p_freight_cost,0)<0 OR coalesce(p_other_costs,0)<0 THEN
    RAISE EXCEPTION 'Les quantités, le prix et les frais sont invalides.' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(coalesce(p_lots,'null'::jsonb))<>'array' OR jsonb_array_length(p_lots)=0 THEN
    RAISE EXCEPTION 'La vente doit être couverte par au moins un lot acquis.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mining_companies company
    WHERE company.id=p_seller_id AND upper(coalesce(company.code,''))='SONASP'
      AND company.company_type='institution' AND company.is_active) THEN
    RAISE EXCEPTION 'Le vendeur doit être la SONASP active.' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(coalesce(p_mechanism_type,'')),'') IS NOT NULL
     AND nullif(trim(coalesce(p_mechanism_type,'')),'') NOT IN('spot','forward','in_process') THEN
    RAISE EXCEPTION 'Le mécanisme de vente demandé est invalide.' USING ERRCODE='22023';
  END IF;
  IF nullif(trim(coalesce(p_mechanism_type,'')),'')='in_process' THEN
    IF p_in_process_refinery_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.refineries_approved refinery
      WHERE refinery.id=p_in_process_refinery_id AND refinery.is_approved
    ) THEN
      RAISE EXCEPTION 'Une raffinerie agréée est obligatoire.' USING ERRCODE='22023';
    END IF;
  ELSIF p_in_process_refinery_id IS NOT NULL THEN
    RAISE EXCEPTION 'La raffinerie est réservée au mécanisme in_process.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customers customer
    WHERE customer.id=p_customer_id AND customer.is_active IS DISTINCT FROM false) THEN
    RAISE EXCEPTION 'Le client est introuvable ou inactif.' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_setting FROM public.gold_sales_settings setting
  WHERE setting.mining_company_id=p_seller_id AND setting.customer_id=p_customer_id
    AND setting.is_active AND setting.effective_date<=current_date
  ORDER BY setting.effective_date DESC,setting.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce client n’est pas autorisé pour les ventes export.' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));
  FOR v_lot IN
    SELECT source_type,source_id,sum(quantite_oz)::numeric AS quantite_oz
    FROM jsonb_to_recordset(p_lots) AS item(source_type text,source_id uuid,quantite_oz numeric)
    GROUP BY source_type,source_id ORDER BY source_type,source_id
  LOOP
    IF v_lot.source_id IS NULL OR v_lot.quantite_oz IS NULL
       OR v_lot.quantite_oz::text='NaN' OR v_lot.quantite_oz<=0
       OR v_lot.source_type NOT IN('achat_mine','achat_artisan','cession_comptoir') THEN
      RAISE EXCEPTION 'La composition des lots est invalide.' USING ERRCODE='22023';
    END IF;
    IF v_lot.source_type='achat_mine' THEN
      SELECT purchase.quantite_oz INTO v_source_quantity FROM public.snp_achats_mines purchase
      WHERE purchase.id=v_lot.source_id AND purchase.statut IN('validee','payee') FOR UPDATE;
      SELECT coalesce(sum(lot.quantite_oz),0) INTO v_already_allocated FROM public.snp_ventes_lots lot
      WHERE lot.achat_mine_id=v_lot.source_id AND lot.released_at IS NULL;
    ELSIF v_lot.source_type='achat_artisan' THEN
      SELECT purchase.quantite_grammes/31.1034768 INTO v_source_quantity
      FROM public.snp_artisan_ventes_or purchase
      WHERE purchase.id=v_lot.source_id AND purchase.statut IN('validee','payee')
        AND purchase.comptoir_organization_id IS NULL FOR UPDATE;
      SELECT coalesce(sum(lot.quantite_oz),0) INTO v_already_allocated FROM public.snp_ventes_lots lot
      WHERE lot.artisan_vente_id=v_lot.source_id AND lot.released_at IS NULL;
    ELSE
      SELECT cession.quantity_grams/31.1034768 INTO v_source_quantity
      FROM public.snp_comptoir_ventes_sonasp cession
      WHERE cession.id=v_lot.source_id AND cession.status IN('accepted','paid') FOR UPDATE;
      SELECT coalesce(sum(lot.quantite_oz),0) INTO v_already_allocated FROM public.snp_ventes_lots lot
      WHERE lot.comptoir_cession_id=v_lot.source_id AND lot.released_at IS NULL;
    END IF;
    IF v_source_quantity IS NULL THEN
      RAISE EXCEPTION 'Une source n’est plus acquise ou mobilisable.' USING ERRCODE='42501';
    END IF;
    IF v_lot.quantite_oz>v_source_quantity-v_already_allocated+0.000001 THEN
      RAISE EXCEPTION 'Un lot ne dispose plus de la quantité demandée.' USING ERRCODE='23514';
    END IF;
    v_lots_total:=v_lots_total+v_lot.quantite_oz;
  END LOOP;
  IF abs(v_lots_total-p_quantity_oz)>0.001 THEN
    RAISE EXCEPTION 'La composition ne correspond pas à la quantité vendue.' USING ERRCODE='23514';
  END IF;

  SELECT
    coalesce((SELECT sum(greatest(0,purchase.quantite_oz-coalesce(used.quantity_oz,0)))
      FROM public.snp_achats_mines purchase
      LEFT JOIN(SELECT achat_mine_id,sum(quantite_oz) quantity_oz FROM public.snp_ventes_lots
        WHERE released_at IS NULL GROUP BY achat_mine_id) used ON used.achat_mine_id=purchase.id
      WHERE purchase.statut IN('validee','payee')),0)
    +coalesce((SELECT sum(greatest(0,purchase.quantite_grammes/31.1034768-coalesce(used.quantity_oz,0)))
      FROM public.snp_artisan_ventes_or purchase
      LEFT JOIN(SELECT artisan_vente_id,sum(quantite_oz) quantity_oz FROM public.snp_ventes_lots
        WHERE released_at IS NULL GROUP BY artisan_vente_id) used ON used.artisan_vente_id=purchase.id
      WHERE purchase.statut IN('validee','payee') AND purchase.comptoir_organization_id IS NULL),0)
    +coalesce((SELECT sum(greatest(0,cession.quantity_grams/31.1034768-coalesce(used.quantity_oz,0)))
      FROM public.snp_comptoir_ventes_sonasp cession
      LEFT JOIN(SELECT comptoir_cession_id,sum(quantite_oz) quantity_oz FROM public.snp_ventes_lots
        WHERE released_at IS NULL GROUP BY comptoir_cession_id) used ON used.comptoir_cession_id=cession.id
      WHERE cession.status IN('accepted','paid')),0)
  INTO v_available_total;
  IF p_quantity_oz>v_available_total*(v_setting.max_stock_percentage/100.0)+0.000001 THEN
    RAISE EXCEPTION 'La quantité dépasse la part de stock autorisée.' USING ERRCODE='23514';
  END IF;

  SELECT CASE WHEN rule.rule_value>1 THEN rule.rule_value/100.0 ELSE rule.rule_value END
  INTO v_royalty_rate FROM public.business_rules rule
  WHERE rule.rule_key='gold_royalty_percentage'
  ORDER BY rule.updated_at DESC NULLS LAST LIMIT 1;
  IF v_royalty_rate IS NULL OR v_royalty_rate<0 OR v_royalty_rate>=1 THEN
    RAISE EXCEPTION 'Le taux de redevance est invalide.' USING ERRCODE='23514';
  END IF;
  v_gross:=round(p_quantity_oz*p_london_am_rate,2);
  v_net:=round(v_gross-coalesce(p_freight_cost,0)-coalesce(p_other_costs,0),2);
  IF v_net<=0 THEN RAISE EXCEPTION 'Le produit net doit être positif.' USING ERRCODE='23514'; END IF;
  v_royalty:=round(v_net*v_royalty_rate,2); v_final:=round(v_net-v_royalty,2);

  PERFORM pg_advisory_xact_lock(hashtext('SONASP:sales:'||v_year::text));
  SELECT coalesce(max(substring(sale.sale_number FROM '[0-9]+$')::integer),0)+1 INTO v_next
  FROM public.sales sale WHERE sale.sale_number~('^SL-'||v_year::text||'-[0-9]+$');
  v_sale_number:='SL-'||v_year::text||'-'||lpad(v_next::text,6,'0');
  INSERT INTO public.sales(
    sale_number,sale_date,customer_id,seller_id,seller_type,is_internal_sale,
    quantity_oz,london_am_rate,freight_cost,other_costs,gross_proceeds,net_proceeds,
    royalty_amount,final_proceeds,total_amount,currency,status,mechanism_type,
    in_process_refinery_id,created_by
  ) VALUES(
    v_sale_number,current_date,p_customer_id,p_seller_id,'sonasp',false,p_quantity_oz,
    p_london_am_rate,coalesce(p_freight_cost,0),coalesce(p_other_costs,0),v_gross,v_net,
    v_royalty,v_final,v_final,'USD','pending_management_approval',
    nullif(trim(coalesce(p_mechanism_type,'')),''),p_in_process_refinery_id,v_actor.id
  ) RETURNING * INTO v_sale;

  INSERT INTO public.snp_ventes_lots(
    sale_id,source_type,achat_mine_id,artisan_vente_id,comptoir_cession_id,quantite_oz,created_by
  )
  SELECT v_sale.id,item.source_type,
    CASE WHEN item.source_type='achat_mine' THEN item.source_id END,
    CASE WHEN item.source_type='achat_artisan' THEN item.source_id END,
    CASE WHEN item.source_type='cession_comptoir' THEN item.source_id END,
    sum(item.quantite_oz),v_actor.id
  FROM jsonb_to_recordset(p_lots) AS item(source_type text,source_id uuid,quantite_oz numeric)
  GROUP BY item.source_type,item.source_id;

  INSERT INTO public.approval_requests(request_type,entity_id,entity_type,approver_role,requested_by,status)
  VALUES('sale',v_sale.id,'sales','management',v_actor.id,'pending') RETURNING id INTO v_request_id;
  INSERT INTO public.snp_ventes_evenements_audit(
    sale_id,event_type,resulting_status,details,actor_id,actor_role
  ) VALUES(
    v_sale.id,'created',v_sale.status::text,
    jsonb_build_object('sale_number',v_sale.sale_number,'quantity_oz',v_sale.quantity_oz,
      'customer_id',v_sale.customer_id,'lots_count',jsonb_array_length(p_lots),
      'royalty_rate',v_royalty_rate,'approval_request_id',v_request_id),
    v_actor.id,v_actor.role
  );
  PERFORM public.snp_notifier_roles(
    ARRAY['owner','admin','management'],'Vente à valider',
    'La vente '||v_sale.sale_number||' attend la validation de la direction.',
    'validation_attendue','haute','vente',v_sale.id,'/sales/'||v_sale.id::text,
    jsonb_build_object('sale_number',v_sale.sale_number,'request_id',v_request_id),
    'vente-validation-'||v_sale.id::text,true
  );
  RETURN jsonb_build_object('id',v_sale.id,'sale_number',v_sale.sale_number,
    'status',v_sale.status,'approval_request_id',v_request_id);
END;
$fn$;

CREATE TABLE IF NOT EXISTS public.snp_export_sale_idempotency(
  idempotency_key uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  request_fingerprint text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.snp_export_sale_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.snp_export_sale_idempotency FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.snp_creer_vente_export_idempotent(
  p_idempotency_key uuid,p_customer_id uuid,p_seller_id uuid,p_quantity_oz numeric,
  p_london_am_rate numeric,p_freight_cost numeric DEFAULT 0,p_other_costs numeric DEFAULT 0,
  p_mechanism_type text DEFAULT NULL,p_in_process_refinery_id uuid DEFAULT NULL,
  p_lots jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_fingerprint text; v_existing public.snp_export_sale_idempotency%ROWTYPE; v_response jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Clé d’idempotence et session requises.' USING ERRCODE='22023';
  END IF;
  v_fingerprint:=md5(jsonb_build_object(
    'actor',auth.uid(),'customer',p_customer_id,'seller',p_seller_id,
    'quantity',p_quantity_oz,'rate',p_london_am_rate,'freight',coalesce(p_freight_cost,0),
    'other',coalesce(p_other_costs,0),'mechanism',p_mechanism_type,
    'refinery',p_in_process_refinery_id,'lots',p_lots
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  SELECT * INTO v_existing FROM public.snp_export_sale_idempotency
  WHERE idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.actor_id IS DISTINCT FROM auth.uid()
       OR v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Cette clé d’idempotence appartient à une autre requête.' USING ERRCODE='23505';
    END IF;
    RETURN v_existing.response;
  END IF;
  v_response:=public.snp_creer_vente_export(
    p_customer_id,p_seller_id,p_quantity_oz,p_london_am_rate,p_freight_cost,
    p_other_costs,p_mechanism_type,p_in_process_refinery_id,p_lots
  );
  INSERT INTO public.snp_export_sale_idempotency(
    idempotency_key,actor_id,request_fingerprint,response
  ) VALUES(p_idempotency_key,auth.uid(),v_fingerprint,v_response);
  RETURN v_response;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_creer_vente_export(
  uuid,uuid,numeric,numeric,numeric,numeric,text,uuid,jsonb
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.snp_creer_vente_export_idempotent(
  uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,uuid,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_creer_vente_export_idempotent(
  uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,uuid,jsonb
) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
