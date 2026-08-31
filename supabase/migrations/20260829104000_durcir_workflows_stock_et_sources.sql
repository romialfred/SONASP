-- =============================================================================
-- Durcissement transversal des workflows et de la cohérence des données.
--
-- Objectifs :
--   * utiliser l'once troy partout ;
--   * empêcher la double mobilisation export / réserve nationale ;
--   * rendre les transitions artisanales opposables en base ;
--   * n'accepter en conciliation que des sources approuvées et cohérentes ;
--   * fermer les cycles dans la hiérarchie des organisations ;
--   * renforcer la séparation des tâches de la réserve ;
--   * borner le search_path de toutes les fonctions privilégiées historiques.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Unités et stock national : 1 once troy = 31,1034768 grammes.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_final_fine()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  NEW.final_fine_grams := (
    NEW.weight_after_melting_grams
    * (NEW.fineness_percentage / 100)
    * (NEW.metal_retained_percentage / 100)
  );
  NEW.final_fine_oz := NEW.final_fine_grams / 31.1034768;

  IF TG_OP='INSERT' AND NEW.transaction_type='entry' THEN
    NEW.quantity_available_oz := NEW.final_fine_oz;
    NEW.quantity_allocated_oz := 0;
    NEW.quantity_sold_oz := 0;
    NEW.quantity_national_reserve_oz := coalesce(NEW.quantity_national_reserve_oz,0);
  END IF;
  RETURN NEW;
END;
$fn$;

-- Corrige les lignes déjà calculées avec l'once avoirdupois. Les mouvements
-- historiques sont conservés ; seul le reliquat disponible est recalculé.
UPDATE public.gold_inventory inventory SET
  final_fine_grams=(
    inventory.weight_after_melting_grams
    * (inventory.fineness_percentage / 100)
    * (inventory.metal_retained_percentage / 100)
  ),
  final_fine_oz=(
    inventory.weight_after_melting_grams
    * (inventory.fineness_percentage / 100)
    * (inventory.metal_retained_percentage / 100)
  ) / 31.1034768,
  quantity_available_oz=CASE
    WHEN coalesce(inventory.quantity_national_reserve_oz,0)>0 THEN 0
    ELSE greatest(0,
      (
        inventory.weight_after_melting_grams
        * (inventory.fineness_percentage / 100)
        * (inventory.metal_retained_percentage / 100)
      ) / 31.1034768
      - coalesce(inventory.quantity_allocated_oz,0)
      - coalesce(inventory.quantity_sold_oz,0)
    )
  END,
  updated_at=now()
WHERE inventory.transaction_type='entry';

CREATE OR REPLACE FUNCTION public.snp_guard_export_sale_lot_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_acquired numeric;
  v_exported numeric;
  v_reserved numeric;
  v_inventory numeric;
  v_old_id uuid;
BEGIN
  -- Ce verrou est partagé avec l'activation d'une affectation à la réserve.
  PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));
  IF TG_OP='UPDATE' THEN v_old_id:=OLD.id; END IF;

  IF NEW.source_type='achat_mine' AND NOT EXISTS(
    SELECT 1 FROM public.snp_achats_mines purchase
    WHERE purchase.id=NEW.achat_mine_id AND purchase.statut IN('validee','payee')
  ) THEN
    RAISE EXCEPTION 'Un achat minier doit être validé avant mobilisation.' USING ERRCODE='42501';
  ELSIF NEW.source_type='achat_artisan' AND NOT EXISTS(
    SELECT 1 FROM public.snp_artisan_ventes_or purchase
    WHERE purchase.id=NEW.artisan_vente_id AND purchase.statut IN('validee','payee')
  ) THEN
    RAISE EXCEPTION 'Un achat artisanal doit être validé avant mobilisation.' USING ERRCODE='42501';
  END IF;

  SELECT
    coalesce((SELECT sum(purchase.quantite_oz) FROM public.snp_achats_mines purchase
              WHERE purchase.statut IN('validee','payee')),0)
    + coalesce((SELECT sum(purchase.quantite_grammes)/31.1034768
                FROM public.snp_artisan_ventes_or purchase
                WHERE purchase.statut IN('validee','payee')),0),
    coalesce((SELECT sum(lot.quantite_oz) FROM public.snp_ventes_lots lot
              WHERE lot.released_at IS NULL
                AND (v_old_id IS NULL OR lot.id<>v_old_id)),0),
    coalesce((SELECT sum(inventory.quantity_national_reserve_oz)
              FROM public.gold_inventory inventory),0),
    coalesce((SELECT sum(inventory.final_fine_oz)
              FROM public.gold_inventory inventory
              WHERE inventory.transaction_type='entry'),0)
  INTO v_acquired,v_exported,v_reserved,v_inventory;

  IF v_exported + NEW.quantite_oz + v_reserved > greatest(v_acquired,v_inventory) + 0.000001 THEN
    RAISE EXCEPTION 'Stock national insuffisant après prise en compte de la réserve.' USING ERRCODE='23514';
  END IF;
  NEW.created_by:=coalesce(NEW.created_by,auth.uid());
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_export_sale_lot_stock_guard ON public.snp_ventes_lots;
CREATE TRIGGER snp_export_sale_lot_stock_guard
BEFORE INSERT OR UPDATE OF source_type,achat_mine_id,artisan_vente_id,quantite_oz,released_at
ON public.snp_ventes_lots
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_export_sale_lot_stock();

REVOKE ALL ON FUNCTION public.snp_guard_export_sale_lot_stock() FROM PUBLIC,anon,authenticated;

-- -----------------------------------------------------------------------------
-- 2. Ventes artisanales : auteur, transitions et séparation des fonctions.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_guard_artisan_gold_sale_workflow()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_actor uuid:=auth.uid();
BEGIN
  -- Les traitements d'administration hors JWT restent possibles pour les
  -- migrations contrôlées. Toute requête navigateur est strictement gouvernée.
  IF v_actor IS NULL OR coalesce(auth.role(),'')='service_role' THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP='INSERT' THEN
    NEW.created_by:=v_actor;
    NEW.updated_by:=v_actor;
    NEW.statut:='en_attente';
    RETURN NEW;
  END IF;

  IF TG_OP='DELETE' THEN
    IF OLD.statut<>'en_attente' OR OLD.created_by IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Seul l’auteur peut supprimer sa vente encore en attente.' USING ERRCODE='42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.comptoir_organization_id IS DISTINCT FROM OLD.comptoir_organization_id
     OR NEW.acheteur_comptoir_organization_id IS DISTINCT FROM OLD.acheteur_comptoir_organization_id THEN
    RAISE EXCEPTION 'L’auteur et le périmètre de la vente sont immuables.' USING ERRCODE='42501';
  END IF;

  IF OLD.statut<>'en_attente' AND (
    NEW.artisan_id IS DISTINCT FROM OLD.artisan_id
    OR NEW.date_vente IS DISTINCT FROM OLD.date_vente
    OR NEW.quantite_grammes IS DISTINCT FROM OLD.quantite_grammes
    OR NEW.type_or IS DISTINCT FROM OLD.type_or
    OR NEW.purete_karat IS DISTINCT FROM OLD.purete_karat
    OR NEW.prix_kg_fcfa IS DISTINCT FROM OLD.prix_kg_fcfa
    OR NEW.tva_taux IS DISTINCT FROM OLD.tva_taux
    OR NEW.taxe_dev_comm_taux IS DISTINCT FROM OLD.taxe_dev_comm_taux
  ) THEN
    RAISE EXCEPTION 'Les données d’une vente validée sont immuables.' USING ERRCODE='42501';
  END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    IF OLD.statut='en_attente' AND NEW.statut='validee' THEN
      PERFORM public.snp_require_capability('sonasp.approve');
      IF OLD.created_by=v_actor THEN
        RAISE EXCEPTION 'L’auteur ne peut pas valider sa propre vente.' USING ERRCODE='42501';
      END IF;
    ELSIF OLD.statut='validee' AND NEW.statut='payee' THEN
      PERFORM public.snp_require_capability('sonasp.finance.execute');
      IF OLD.created_by=v_actor THEN
        RAISE EXCEPTION 'L’auteur ne peut pas exécuter le paiement de sa vente.' USING ERRCODE='42501';
      END IF;
    ELSIF OLD.statut='en_attente' AND NEW.statut='annulee' THEN
      IF OLD.created_by IS DISTINCT FROM v_actor
         AND NOT public.snp_actor_has_capability('sonasp.approve') THEN
        RAISE EXCEPTION 'Seul l’auteur ou un approbateur peut annuler ce brouillon.' USING ERRCODE='42501';
      END IF;
    ELSIF OLD.statut='validee' AND NEW.statut='annulee' THEN
      PERFORM public.snp_require_capability('sonasp.approve');
    ELSE
      RAISE EXCEPTION 'Transition de vente artisanale interdite : % -> %.',OLD.statut,NEW.statut USING ERRCODE='22023';
    END IF;
  ELSIF OLD.statut='en_attente'
        AND OLD.created_by IS NOT NULL
        AND OLD.created_by<>v_actor
        AND NOT public.snp_actor_has_capability('sonasp.prepare') THEN
    RAISE EXCEPTION 'Seul l’auteur ou un gestionnaire habilité peut corriger le brouillon.' USING ERRCODE='42501';
  END IF;

  NEW.updated_by:=v_actor;
  NEW.updated_at:=now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_00_artisan_gold_sale_workflow_guard ON public.snp_artisan_ventes_or;
CREATE TRIGGER snp_00_artisan_gold_sale_workflow_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.snp_artisan_ventes_or
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_artisan_gold_sale_workflow();

REVOKE ALL ON FUNCTION public.snp_guard_artisan_gold_sale_workflow() FROM PUBLIC,anon,authenticated;

-- -----------------------------------------------------------------------------
-- 3. Conciliation : les valeurs saisies doivent provenir de la même expédition.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snp_data_quality_issues(
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  issue_code text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY(entity_type,entity_id,issue_code)
);
ALTER TABLE public.snp_data_quality_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_data_quality_issues_read ON public.snp_data_quality_issues;
CREATE POLICY snp_data_quality_issues_read ON public.snp_data_quality_issues
FOR SELECT TO authenticated USING(
  public.snp_actor_has_capability('accounts.manage')
  OR public.snp_actor_has_capability('reports.read')
  OR public.snp_actor_has_capability('reconciliation.view')
);
REVOKE INSERT,UPDATE,DELETE ON public.snp_data_quality_issues FROM authenticated;
GRANT SELECT ON public.snp_data_quality_issues TO authenticated;

-- Registre autonome des dossiers historiques qui ne respectaient pas encore
-- la séparation des tâches. Il est informatif et non modifiable côté client.
CREATE TABLE IF NOT EXISTS public.snp_sod_legacy_review(
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  issue text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY(aggregate_type,aggregate_id,issue)
);
ALTER TABLE public.snp_sod_legacy_review ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_sod_legacy_review_read ON public.snp_sod_legacy_review;
CREATE POLICY snp_sod_legacy_review_read ON public.snp_sod_legacy_review
FOR SELECT TO authenticated USING(
  public.snp_actor_has_capability('accounts.manage')
  OR public.snp_actor_has_capability('reports.read')
);
REVOKE INSERT,UPDATE,DELETE ON public.snp_sod_legacy_review FROM authenticated;
GRANT SELECT ON public.snp_sod_legacy_review TO authenticated;

INSERT INTO public.snp_data_quality_issues(entity_type,entity_id,issue_code,details)
SELECT 'conciliation',conciliation.id,'LEGACY_ANALYSIS_SOURCE_UNVERIFIED',jsonb_build_object(
  'source_type',conciliation.source_analyse_type,
  'assay_certificate_id',conciliation.assay_certificate_id,
  'analyse_teneur_id',conciliation.analyse_teneur_id
)
FROM public.snp_conciliations conciliation
LEFT JOIN public.assay_certificates certificate ON certificate.id=conciliation.assay_certificate_id
LEFT JOIN public.snp_analyses_teneur analysis ON analysis.id=conciliation.analyse_teneur_id
WHERE (conciliation.assay_certificate_id IS NOT NULL OR conciliation.analyse_teneur_id IS NOT NULL)
  AND (
    conciliation.source_analyse_type IS NULL
    OR (conciliation.assay_certificate_id IS NOT NULL AND certificate.approval_status IS DISTINCT FROM 'approved')
    OR (conciliation.analyse_teneur_id IS NOT NULL AND analysis.statut IS DISTINCT FROM 'tranchee')
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_guard_conciliation_analysis_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_certificate public.assay_certificates%ROWTYPE;
  v_analysis public.snp_analyses_teneur%ROWTYPE;
  v_shipping public.shipping_preparations%ROWTYPE;
  v_verified_data public.assay_certificate_data%ROWTYPE;
  v_expected_weight numeric;
  v_expected_purity numeric;
  v_expected_price numeric;
  v_expected_date date;
BEGIN
  IF NEW.assay_certificate_id IS NULL AND NEW.analyse_teneur_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.source_analyse_type NOT IN('certificat_acheteur','analyse_teneur')
     OR (NEW.source_analyse_type='certificat_acheteur' AND (NEW.assay_certificate_id IS NULL OR NEW.analyse_teneur_id IS NOT NULL))
     OR (NEW.source_analyse_type='analyse_teneur' AND (NEW.analyse_teneur_id IS NULL OR NEW.assay_certificate_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'La source d’analyse est incohérente.' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id=NEW.sale_id;
  IF NOT FOUND OR v_sale.shipping_preparation_id IS NULL THEN
    RAISE EXCEPTION 'La vente doit être reliée à une expédition avant analyse.' USING ERRCODE='23503';
  END IF;
  SELECT * INTO v_shipping FROM public.shipping_preparations WHERE id=v_sale.shipping_preparation_id;

  IF NEW.source_analyse_type='certificat_acheteur' THEN
    SELECT * INTO v_certificate FROM public.assay_certificates WHERE id=NEW.assay_certificate_id;
    IF NOT FOUND OR v_certificate.shipping_preparation_id IS DISTINCT FROM v_sale.shipping_preparation_id
       OR v_certificate.approval_status IS DISTINCT FROM 'approved'
       OR v_certificate.approved_by IS NULL OR v_certificate.approved_at IS NULL THEN
      RAISE EXCEPTION 'Le certificat doit être approuvé et appartenir à l’expédition de la vente.' USING ERRCODE='42501';
    END IF;
    SELECT * INTO v_verified_data FROM public.assay_certificate_data data
    WHERE data.certificate_id=v_certificate.id
      AND data.shipping_preparation_id=v_sale.shipping_preparation_id
      AND data.is_verified
    ORDER BY data.updated_at DESC LIMIT 1;
    v_expected_purity:=coalesce(
      v_certificate.purity_percent,
      v_certificate.gold_content_percent,
      v_verified_data.gold_purity_percentage,
      CASE WHEN v_certificate.fineness>100 THEN v_certificate.fineness/10 ELSE v_certificate.fineness END,
      CASE WHEN v_verified_data.fineness>100 THEN v_verified_data.fineness/10 ELSE v_verified_data.fineness END
    );
    v_expected_weight:=coalesce(v_verified_data.total_weight_g,v_sale.quantity_oz*31.1034768,v_shipping.total_net_weight_grams);
  ELSE
    SELECT * INTO v_analysis FROM public.snp_analyses_teneur WHERE id=NEW.analyse_teneur_id;
    IF NOT FOUND OR v_analysis.shipping_preparation_id IS DISTINCT FROM v_sale.shipping_preparation_id
       OR v_analysis.statut IS DISTINCT FROM 'tranchee'
       OR v_analysis.teneur_retenue_pct IS NULL THEN
      RAISE EXCEPTION 'L’analyse de teneur doit être tranchée et appartenir à l’expédition de la vente.' USING ERRCODE='42501';
    END IF;
    v_expected_purity:=v_analysis.teneur_retenue_pct;
    v_expected_weight:=coalesce(v_sale.quantity_oz*31.1034768,v_shipping.total_net_weight_grams);
  END IF;

  IF v_expected_purity IS NULL OR abs(NEW.teneur_finale_pct-v_expected_purity)>0.01 THEN
    RAISE EXCEPTION 'La teneur finale ne correspond pas à la source approuvée.' USING ERRCODE='23514';
  END IF;
  IF v_expected_weight IS NULL OR abs(NEW.poids_final_g-v_expected_weight)>greatest(1,v_expected_weight*0.01) THEN
    RAISE EXCEPTION 'Le poids final est hors de la tolérance de la source approuvée.' USING ERRCODE='23514';
  END IF;

  v_expected_price:=coalesce(v_sale.final_price_per_oz,v_sale.london_am_rate);
  v_expected_date:=coalesce(v_sale.spot_value_date,v_sale.forward_value_date,v_sale.spot_pricing_date::date,v_sale.sale_date);
  IF v_expected_price IS NULL THEN
    SELECT coalesce(price.spot_price,price.london_pm_rate,price.london_am_rate,price.average_price)
    INTO v_expected_price FROM public.gold_prices_daily price
    WHERE price.price_date=NEW.date_fixing AND upper(coalesce(price.currency,'USD'))='USD'
    ORDER BY price.updated_at DESC NULLS LAST LIMIT 1;
    v_expected_date:=NEW.date_fixing;
  END IF;
  IF NEW.date_fixing IS NULL OR v_expected_date IS DISTINCT FROM NEW.date_fixing
     OR v_expected_price IS NULL OR abs(NEW.prix_final-v_expected_price)>0.01 THEN
    RAISE EXCEPTION 'Le fixing ne correspond pas au prix contractuel ou au cours de référence.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_conciliation_analysis_source_guard ON public.snp_conciliations;
CREATE TRIGGER snp_conciliation_analysis_source_guard
BEFORE INSERT OR UPDATE OF source_analyse_type,assay_certificate_id,analyse_teneur_id,
  poids_final_g,teneur_finale_pct,prix_final,date_fixing
ON public.snp_conciliations
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_conciliation_analysis_source();

REVOKE ALL ON FUNCTION public.snp_guard_conciliation_analysis_source() FROM PUBLIC,anon,authenticated;

-- Les écritures de pièces de réserve passent exclusivement par la passerelle
-- sensible (contrôle MIME/signature, MFA, taille, audit et compensation).
DROP POLICY IF EXISTS reserve_documents_storage_insert ON storage.objects;
DROP POLICY IF EXISTS reserve_documents_storage_delete ON storage.objects;

CREATE OR REPLACE FUNCTION public.snp_register_reserve_document_gateway(
  p_allocation_id uuid,p_document_type text,p_file_name text,p_storage_path text,
  p_mime_type text,p_size_bytes bigint,p_actor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_id uuid; v_role text; v_allowed boolean;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Cette opération est réservée à la passerelle documentaire.' USING ERRCODE='42501';
  END IF;
  SELECT profile.role,
    CASE WHEN profile.role='owner' THEN true ELSE
      EXISTS(SELECT 1 FROM public.snp_role_capabilities role_permission
             WHERE role_permission.role=profile.role
               AND role_permission.capability_code='reserve.allocations.edit')
      AND coalesce((SELECT override.allowed FROM public.snp_user_capabilities override
                    WHERE override.user_id=profile.id
                      AND override.capability_code='reserve.allocations.edit'
                      AND override.valid_from<=clock_timestamp()
                      AND (override.valid_until IS NULL OR override.valid_until>clock_timestamp())
                    LIMIT 1),true)
    END
  INTO v_role,v_allowed
  FROM public.user_profiles profile WHERE profile.id=p_actor_id AND profile.is_active;
  IF v_role IS NULL OR NOT coalesce(v_allowed,false) OR NOT EXISTS(
    SELECT 1 FROM public.reserve_allocations allocation
    WHERE allocation.id=p_allocation_id AND allocation.status='DRAFT'
      AND (v_role='owner' OR allocation.created_by=p_actor_id)
  ) THEN
    RAISE EXCEPTION 'Acteur ou brouillon de réserve invalide.' USING ERRCODE='42501';
  END IF;
  IF p_document_type!~'^[a-z0-9][a-z0-9_-]{0,79}$'
     OR p_file_name IS NULL OR length(trim(p_file_name)) NOT BETWEEN 1 AND 255
     OR p_file_name~'[\\/[:cntrl:]]'
     OR p_mime_type NOT IN('application/pdf','image/png','image/jpeg')
     OR p_size_bytes<=0 OR p_size_bytes>15728640
     OR p_storage_path !~ ('^' || p_allocation_id::text
       || '/format-validated/[0-9]{4}/[0-9]{2}/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'Métadonnées documentaires invalides.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.reserve_allocation_documents(
    allocation_id,document_type,file_name,storage_path,mime_type,size_bytes,uploaded_by
  ) VALUES(p_allocation_id,p_document_type,p_file_name,p_storage_path,p_mime_type,p_size_bytes,p_actor_id)
  RETURNING id INTO v_id;
  INSERT INTO public.reserve_allocation_events(
    allocation_id,event_type,status_from,status_to,actor_id,actor_role,comment,metadata
  ) VALUES(
    p_allocation_id,'DOCUMENT_ADDED','DRAFT','DRAFT',p_actor_id,v_role,'Pièce jointe ajoutée',
    jsonb_build_object('document_id',v_id,'document_type',p_document_type,'file_name',p_file_name)
  );
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_delete_reserve_document_gateway(p_document_id uuid,p_actor_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_document public.reserve_allocation_documents%ROWTYPE; v_role text; v_allowed boolean;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Cette opération est réservée à la passerelle documentaire.' USING ERRCODE='42501';
  END IF;
  SELECT profile.role,
    CASE WHEN profile.role='owner' THEN true ELSE
      EXISTS(SELECT 1 FROM public.snp_role_capabilities role_permission
             WHERE role_permission.role=profile.role
               AND role_permission.capability_code='reserve.allocations.edit')
      AND coalesce((SELECT override.allowed FROM public.snp_user_capabilities override
                    WHERE override.user_id=profile.id
                      AND override.capability_code='reserve.allocations.edit'
                      AND override.valid_from<=clock_timestamp()
                      AND (override.valid_until IS NULL OR override.valid_until>clock_timestamp())
                    LIMIT 1),true)
    END
  INTO v_role,v_allowed
  FROM public.user_profiles profile WHERE profile.id=p_actor_id AND profile.is_active;
  SELECT document.* INTO v_document FROM public.reserve_allocation_documents document
  JOIN public.reserve_allocations allocation ON allocation.id=document.allocation_id AND allocation.status='DRAFT'
    AND (v_role='owner' OR allocation.created_by=p_actor_id)
  WHERE document.id=p_document_id AND document.deleted_at IS NULL FOR UPDATE OF document;
  IF v_role IS NULL OR NOT coalesce(v_allowed,false) OR NOT FOUND THEN
    RAISE EXCEPTION 'Document ou acteur invalide.' USING ERRCODE='42501';
  END IF;
  UPDATE public.reserve_allocation_documents SET deleted_at=now() WHERE id=p_document_id;
  INSERT INTO public.reserve_allocation_events(
    allocation_id,event_type,status_from,status_to,actor_id,actor_role,comment,metadata
  ) VALUES(
    v_document.allocation_id,'DOCUMENT_REMOVED','DRAFT','DRAFT',p_actor_id,v_role,'Pièce jointe retirée',
    jsonb_build_object('document_id',v_document.id,'document_type',v_document.document_type,'file_name',v_document.file_name)
  );
  RETURN v_document.storage_path;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_register_reserve_document(uuid,text,text,text,text,bigint) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_delete_reserve_document(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_register_reserve_document_gateway(uuid,text,text,text,text,bigint,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.snp_delete_reserve_document_gateway(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.snp_register_reserve_document_gateway(uuid,text,text,text,text,bigint,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.snp_delete_reserve_document_gateway(uuid,uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Hiérarchie des organisations : aucune boucle directe ou indirecte.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_guard_organization_hierarchy_cycle()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  IF NEW.parent_organization_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_organization_id=NEW.id THEN
    RAISE EXCEPTION 'Une organisation ne peut pas être son propre parent.' USING ERRCODE='23514';
  END IF;
  IF EXISTS(
    WITH RECURSIVE ancestors AS(
      SELECT parent.id,parent.parent_organization_id,ARRAY[parent.id] path
      FROM public.snp_organizations parent WHERE parent.id=NEW.parent_organization_id
      UNION ALL
      SELECT parent.id,parent.parent_organization_id,ancestors.path||parent.id
      FROM public.snp_organizations parent JOIN ancestors ON parent.id=ancestors.parent_organization_id
      WHERE NOT parent.id=ANY(ancestors.path)
    )
    SELECT 1 FROM ancestors WHERE id=NEW.id
  ) THEN
    RAISE EXCEPTION 'La hiérarchie organisationnelle contiendrait un cycle.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_organization_hierarchy_cycle_guard ON public.snp_organizations;
CREATE TRIGGER snp_organization_hierarchy_cycle_guard
BEFORE INSERT OR UPDATE OF parent_organization_id ON public.snp_organizations
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_organization_hierarchy_cycle();

REVOKE ALL ON FUNCTION public.snp_guard_organization_hierarchy_cycle() FROM PUBLIC,anon,authenticated;

-- -----------------------------------------------------------------------------
-- 5. Réserve nationale : acteurs distincts et arbitrage atomique du stock.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_guard_reserve_allocation_transition()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_acquired numeric;
  v_exported numeric;
  v_reserved numeric;
  v_inventory numeric;
BEGIN
  IF OLD.status='DRAFT' AND NEW.status IN('SUBMITTED','CANCELLED')
     AND NOT public.snp_reserve_draft_owned_or_owner(OLD.id) THEN
    RAISE EXCEPTION 'Seul l’auteur du brouillon ou le Owner peut engager cette transition.' USING ERRCODE='42501';
  END IF;
  IF NEW.status IN('UNDER_REVIEW','VALIDATED_LEVEL_1','VALIDATED_LEVEL_2','TRANSFER_AUTHORIZED','RECONCILED','ACTIVE')
     AND OLD.created_by=auth.uid() AND coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Séparation des tâches : l’auteur ne peut pas contrôler ni valider son propre dossier.' USING ERRCODE='42501';
  END IF;

  IF NEW.status='RECEIVED' AND EXISTS(
    SELECT 1 FROM public.reserve_allocation_events event
    WHERE event.allocation_id=OLD.id AND event.status_to IN('TRANSFER_AUTHORIZED','IN_TRANSIT')
      AND event.actor_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'Le réceptionnaire doit être distinct de l’auteur du transfert.' USING ERRCODE='42501';
  ELSIF NEW.status='RECONCILED' AND EXISTS(
    SELECT 1 FROM public.reserve_allocation_events event
    WHERE event.allocation_id=OLD.id AND event.status_to IN('TRANSFER_AUTHORIZED','RECEIVED')
      AND event.actor_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'Le rapprochement exige un acteur distinct du transfert et de la réception.' USING ERRCODE='42501';
  ELSIF NEW.status='ACTIVE' AND EXISTS(
    SELECT 1 FROM public.reserve_allocation_events event
    WHERE event.allocation_id=OLD.id
      AND event.status_to IN('TRANSFER_AUTHORIZED','IN_TRANSIT','RECEIVED','RECONCILED')
      AND event.actor_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'L’activation exige un dernier contrôle indépendant.' USING ERRCODE='42501';
  END IF;

  IF NEW.status='ACTIVE' AND OLD.status IS DISTINCT FROM 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));
    SELECT
      coalesce((SELECT sum(purchase.quantite_oz) FROM public.snp_achats_mines purchase
                WHERE purchase.statut IN('validee','payee')),0)
      + coalesce((SELECT sum(purchase.quantite_grammes)/31.1034768
                  FROM public.snp_artisan_ventes_or purchase
                  WHERE purchase.statut IN('validee','payee')),0),
      coalesce((SELECT sum(lot.quantite_oz) FROM public.snp_ventes_lots lot
                WHERE lot.released_at IS NULL),0),
      coalesce((SELECT sum(inventory.quantity_national_reserve_oz)
                FROM public.gold_inventory inventory),0),
      coalesce((SELECT sum(inventory.final_fine_oz)
                FROM public.gold_inventory inventory
                WHERE inventory.transaction_type='entry'),0)
    INTO v_acquired,v_exported,v_reserved,v_inventory;
    IF v_exported + v_reserved + (NEW.fine_weight_grams/31.1034768) > greatest(v_acquired,v_inventory) + 0.000001 THEN
      RAISE EXCEPTION 'Stock national insuffisant pour activer cette affectation.' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

-- Le trigger existe déjà ; sa fonction vient d'être remplacée sans perdre son ordre.
REVOKE ALL ON FUNCTION public.snp_guard_reserve_allocation_transition() FROM PUBLIC,anon,authenticated;

-- -----------------------------------------------------------------------------
-- 6. Fonctions privilégiées historiques : search_path déterministe.
-- -----------------------------------------------------------------------------
DO $hardening$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT procedure.oid::regprocedure AS signature
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace
    WHERE namespace.nspname='public'
      AND procedure.prosecdef
      AND NOT EXISTS(
        SELECT 1 FROM unnest(coalesce(procedure.proconfig,ARRAY[]::text[])) setting
        WHERE setting LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path TO pg_catalog, public, auth, storage, extensions, pg_temp',
      target.signature
    );
  END LOOP;
END;
$hardening$;

NOTIFY pgrst,'reload schema';
COMMIT;
