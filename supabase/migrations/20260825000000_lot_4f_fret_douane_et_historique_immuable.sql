/*
  LOT 4F - Fret/douane cloisonne et historique de statuts immuable.

  Objectifs :
    * aucune ecriture navigateur directe sur les trois tables freight_customs_* ;
    * tenant et acteurs derives des objets parents/JWT ;
    * transitions atomiques, optimistes et separees entre preparation,
      approbation douaniere et expedition ;
    * historique non forgeable, non modifiable et lisible uniquement dans le
      perimetre de l'acteur ;
    * compatibilite explicite des profils Airport, Factory, Refinery et SONASP.

  Cette migration est compensatoire et volontairement fail-closed. Elle refuse
  de s'appliquer si des operations orphelines ou dupliquees rendent impossible
  le cloisonnement par expedition.

  Rollback operationnel (non destructif) : ne jamais restaurer les anciennes
  policies globalement permissives. En cas d'incompatibilite applicative,
  suspendre les nouvelles RPC, conserver RLS/FORCE RLS et deployer un adaptateur
  frontend avant toute autre migration compensatoire. Les colonnes d'audit et
  les index sont additifs et doivent etre conserves.
*/

-- -------------------------------------------------------------------------
-- 0. Pre-conditions et remise en coherence additive du schema historique.
-- -------------------------------------------------------------------------
DO $preflight$
BEGIN
  IF to_regclass('public.freight_customs_operations') IS NULL
     OR to_regclass('public.freight_customs_documents') IS NULL
     OR to_regclass('public.freight_customs_invoice_data') IS NULL
     OR to_regclass('public.shipping_preparations') IS NULL
     OR to_regclass('public.unified_status_history') IS NULL THEN
    RAISE EXCEPTION
      'LOT 4F: objets fret/historique attendus absents; baseline manuelle requise.'
      USING ERRCODE = '55000';
  END IF;
  IF to_regtype('public.freight_customs_status') IS NULL
     OR to_regtype('public.freight_document_type') IS NULL
     OR to_regtype('public.status_change_context') IS NULL THEN
    RAISE EXCEPTION 'LOT 4F: enums historiques fret/statut absents.'
      USING ERRCODE = '55000';
  END IF;
  IF to_regprocedure('public.snp_require_capability(text)') IS NULL
     OR to_regprocedure('public.snp_session_est_active()') IS NULL
     OR to_regprocedure('public.snp_session_request_ip()') IS NULL THEN
    RAISE EXCEPTION 'LOT 4F: garde capability/session canonique absente.'
      USING ERRCODE = '55000';
  END IF;
  IF (SELECT count(*) FROM pg_enum
      WHERE enumtypid='public.freight_customs_status'::regtype
        AND enumlabel IN ('customs_pending','customs_approved',
                          'ready_for_transport','shipped_to_refinery'))<>4 THEN
    RAISE EXCEPTION
      'LOT 4F: enum fret incomplet; correction de type hors transaction requise avant ce lot.'
      USING ERRCODE='55000';
  END IF;
END;
$preflight$;

-- Certains graphes historiques ont perdu operations.status lors d'un
-- DROP TYPE ... CASCADE. Le recreer uniquement a partir d'une valeur enum
-- reellement disponible rend la correction reapplicable aux deux variantes.
DO $status_column$
DECLARE v_default text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.freight_customs_operations'::regclass
      AND attname = 'status' AND attnum > 0 AND NOT attisdropped
  ) THEN
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM pg_enum
                   WHERE enumtypid = 'public.freight_customs_status'::regtype
                     AND enumlabel = 'customs_pending') THEN 'customs_pending'
      WHEN EXISTS (SELECT 1 FROM pg_enum
                   WHERE enumtypid = 'public.freight_customs_status'::regtype
                     AND enumlabel = 'ready_for_expedition') THEN 'ready_for_expedition'
    END INTO v_default;
    IF v_default IS NULL THEN
      RAISE EXCEPTION 'LOT 4F: aucune valeur initiale fret reconnue.'
        USING ERRCODE = '55000';
    END IF;
    EXECUTE format(
      'ALTER TABLE public.freight_customs_operations ADD COLUMN status public.freight_customs_status NOT NULL DEFAULT %L::public.freight_customs_status',
      v_default
    );
  END IF;
END;
$status_column$;

ALTER TABLE public.freight_customs_operations
  ADD COLUMN IF NOT EXISTS mining_company_id uuid,
  ADD COLUMN IF NOT EXISTS prepared_by uuid,
  ADD COLUMN IF NOT EXISTS customs_approved_by uuid,
  ADD COLUMN IF NOT EXISTS transport_prepared_by uuid,
  ADD COLUMN IF NOT EXISTS dispatched_by uuid,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

ALTER TABLE public.freight_customs_invoice_data
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.unified_status_history
  ADD COLUMN IF NOT EXISTS mining_company_id uuid;

-- L'ancien trigger d'immutabilite peut deja exister lors d'une reapplication.
DROP TRIGGER IF EXISTS snp_unified_status_history_immutable
  ON public.unified_status_history;

UPDATE public.freight_customs_operations o
SET mining_company_id = s.mining_company_id
FROM public.shipping_preparations s
WHERE s.id = o.shipping_preparation_id
  AND o.mining_company_id IS DISTINCT FROM s.mining_company_id;

UPDATE public.unified_status_history h
SET mining_company_id = CASE h.entity_type
  WHEN 'shipping' THEN (
    SELECT s.mining_company_id FROM public.shipping_preparations s
    WHERE s.id = h.entity_id
  )
  WHEN 'production' THEN (
    SELECT p.mining_company_id FROM public.daily_production p
    WHERE p.id = h.entity_id
  )
  WHEN 'freight_customs' THEN (
    SELECT o.mining_company_id FROM public.freight_customs_operations o
    WHERE o.id = h.entity_id
  )
  ELSE h.mining_company_id
END
WHERE h.mining_company_id IS NULL;

DO $historical_integrity$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.freight_customs_operations o
    LEFT JOIN public.shipping_preparations s ON s.id = o.shipping_preparation_id
    WHERE s.id IS NULL OR s.mining_company_id IS NULL
       OR o.mining_company_id IS DISTINCT FROM s.mining_company_id
  ) THEN
    RAISE EXCEPTION
      'LOT 4F: operation fret orpheline ou tenant parent absent/incoherent.'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT shipping_preparation_id
    FROM public.freight_customs_operations
    GROUP BY shipping_preparation_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'LOT 4F: plusieurs operations fret existent pour une meme expedition.'
      USING ERRCODE = '23505';
  END IF;
END;
$historical_integrity$;

ALTER TABLE public.freight_customs_operations
  ALTER COLUMN mining_company_id SET NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.freight_customs_operations'::regclass
                   AND conname='freight_customs_operations_mining_company_fkey') THEN
    ALTER TABLE public.freight_customs_operations
      ADD CONSTRAINT freight_customs_operations_mining_company_fkey
      FOREIGN KEY (mining_company_id) REFERENCES public.mining_companies(id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.freight_customs_operations'::regclass
                   AND conname='freight_customs_operations_prepared_by_fkey') THEN
    ALTER TABLE public.freight_customs_operations
      ADD CONSTRAINT freight_customs_operations_prepared_by_fkey
      FOREIGN KEY (prepared_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.freight_customs_operations'::regclass
                   AND conname='freight_customs_operations_customs_approved_by_fkey') THEN
    ALTER TABLE public.freight_customs_operations
      ADD CONSTRAINT freight_customs_operations_customs_approved_by_fkey
      FOREIGN KEY (customs_approved_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.freight_customs_operations'::regclass
                   AND conname='freight_customs_operations_transport_prepared_by_fkey') THEN
    ALTER TABLE public.freight_customs_operations
      ADD CONSTRAINT freight_customs_operations_transport_prepared_by_fkey
      FOREIGN KEY (transport_prepared_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.freight_customs_operations'::regclass
                   AND conname='freight_customs_operations_dispatched_by_fkey') THEN
    ALTER TABLE public.freight_customs_operations
      ADD CONSTRAINT freight_customs_operations_dispatched_by_fkey
      FOREIGN KEY (dispatched_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.freight_customs_invoice_data'::regclass
                   AND conname='freight_customs_invoice_created_by_fkey') THEN
    ALTER TABLE public.freight_customs_invoice_data
      ADD CONSTRAINT freight_customs_invoice_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.freight_customs_invoice_data'::regclass
                   AND conname='freight_customs_invoice_updated_by_fkey') THEN
    ALTER TABLE public.freight_customs_invoice_data
      ADD CONSTRAINT freight_customs_invoice_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.unified_status_history'::regclass
                   AND conname='unified_status_history_mining_company_fkey') THEN
    ALTER TABLE public.unified_status_history
      ADD CONSTRAINT unified_status_history_mining_company_fkey
      FOREIGN KEY (mining_company_id) REFERENCES public.mining_companies(id)
      NOT VALID;
  END IF;
END;
$constraints$;

ALTER TABLE public.freight_customs_operations
  VALIDATE CONSTRAINT freight_customs_operations_mining_company_fkey;
ALTER TABLE public.freight_customs_operations
  VALIDATE CONSTRAINT freight_customs_operations_prepared_by_fkey;
ALTER TABLE public.freight_customs_operations
  VALIDATE CONSTRAINT freight_customs_operations_customs_approved_by_fkey;
ALTER TABLE public.freight_customs_operations
  VALIDATE CONSTRAINT freight_customs_operations_transport_prepared_by_fkey;
ALTER TABLE public.freight_customs_operations
  VALIDATE CONSTRAINT freight_customs_operations_dispatched_by_fkey;
ALTER TABLE public.freight_customs_invoice_data
  VALIDATE CONSTRAINT freight_customs_invoice_created_by_fkey;
ALTER TABLE public.freight_customs_invoice_data
  VALIDATE CONSTRAINT freight_customs_invoice_updated_by_fkey;
ALTER TABLE public.unified_status_history
  VALIDATE CONSTRAINT unified_status_history_mining_company_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS uq_freight_customs_operation_shipping
  ON public.freight_customs_operations(shipping_preparation_id);
CREATE INDEX IF NOT EXISTS idx_freight_customs_operation_tenant_status
  ON public.freight_customs_operations(mining_company_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_freight_documents_operation_uploaded
  ON public.freight_customs_documents(freight_customs_operation_id,uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_freight_invoice_operation
  ON public.freight_customs_invoice_data(freight_customs_operation_id);
CREATE INDEX IF NOT EXISTS idx_unified_history_tenant_entity_changed
  ON public.unified_status_history(
    mining_company_id,entity_type,entity_id,changed_at DESC
  );

-- L'historique couvre desormais aussi le workflow fret canonique.
ALTER TABLE public.unified_status_history
  DROP CONSTRAINT IF EXISTS unified_status_history_entity_type_check;
ALTER TABLE public.unified_status_history
  ADD CONSTRAINT unified_status_history_entity_type_check
  CHECK (entity_type IN ('production','shipping','freight_customs')) NOT VALID;
ALTER TABLE public.unified_status_history
  VALIDATE CONSTRAINT unified_status_history_entity_type_check;

-- -------------------------------------------------------------------------
-- 1. Capacites explicites et matrice de compatibilite des portails.
-- -------------------------------------------------------------------------
INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES
 ('freight.read','freight','Consulter fret et douane',
  'Consulter les operations, documents et factures fret autorises.',true),
 ('freight.prepare','freight','Preparer le dossier fret',
  'Creer et completer un dossier fret avant approbation.',true),
 ('freight.customs.approve','freight','Approuver en douane',
  'Prononcer une approbation douaniere distincte du preparateur.',true),
 ('freight.transport.dispatch','freight','Expedier vers la raffinerie',
  'Finaliser le transport apres approbation douaniere.',true),
 ('freight.invoice.manage','freight','Gerer la facture export',
  'Completer les donnees de facturation derivees du dossier fret.',true),
 ('workflow.history.read','audit','Consulter les historiques metier',
  'Consulter les historiques immuables dans le perimetre autorise.',true)
ON CONFLICT(code) DO UPDATE SET
 domain=EXCLUDED.domain,label=EXCLUDED.label,
 description=EXCLUDED.description,sensitive=EXCLUDED.sensitive;

INSERT INTO public.snp_role_capabilities(role,capability_code)
VALUES
 ('admin','freight.read'),('admin','freight.prepare'),
 ('admin','freight.customs.approve'),('admin','freight.transport.dispatch'),
 ('admin','freight.invoice.manage'),('admin','workflow.history.read'),
 ('management','freight.read'),('management','freight.prepare'),
 ('management','freight.customs.approve'),
 ('management','freight.transport.dispatch'),
 ('management','freight.invoice.manage'),
 ('management','workflow.history.read'),
 ('airport','freight.read'),('airport','freight.prepare'),
 ('airport','freight.customs.approve'),
 ('airport','freight.transport.dispatch'),
 ('airport','workflow.history.read'),
 ('factory','freight.read'),('factory','freight.prepare'),
 ('factory','freight.invoice.manage'),('factory','workflow.history.read'),
 ('refinery','freight.read'),('refinery','workflow.history.read')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------
-- 2. Predicats tenant et gardes d'ecriture (petite surface, fail-closed).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_fret_peut_consulter_tenant(
  p_mining_company_id uuid
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_profile public.user_profiles%ROWTYPE;
BEGIN
  IF coalesce(auth.role(),'')='service_role' THEN RETURN true; END IF;
  IF p_mining_company_id IS NULL OR NOT public.snp_session_est_active() THEN
    RETURN false;
  END IF;
  SELECT * INTO v_profile FROM public.user_profiles
  WHERE id=auth.uid() AND is_active;
  IF NOT FOUND THEN RETURN false; END IF;
  -- Un compte rattache a une mine ne devient jamais transversal par simple
  -- override de capability.
  IF v_profile.mining_company_id IS NOT NULL
     AND v_profile.mining_company_id<>p_mining_company_id THEN
    RETURN false;
  END IF;
  RETURN public.snp_actor_has_capability('freight.read')
    OR (v_profile.mining_company_id=p_mining_company_id
        AND public.snp_actor_has_capability('mine.operate'));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_historique_peut_consulter_tenant(
  p_mining_company_id uuid
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_profile public.user_profiles%ROWTYPE;
BEGIN
  IF coalesce(auth.role(),'')='service_role' THEN RETURN true; END IF;
  IF p_mining_company_id IS NULL OR NOT public.snp_session_est_active() THEN
    RETURN false;
  END IF;
  SELECT * INTO v_profile FROM public.user_profiles
  WHERE id=auth.uid() AND is_active;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_profile.mining_company_id IS NOT NULL
     AND v_profile.mining_company_id<>p_mining_company_id THEN
    RETURN false;
  END IF;
  RETURN public.snp_actor_has_capability('workflow.history.read')
    OR (v_profile.mining_company_id=p_mining_company_id
        AND public.snp_actor_has_capability('mine.operate'));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_exiger_portee(
  p_mining_company_id uuid,
  p_capability text
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_company uuid;
BEGIN
  PERFORM public.snp_require_capability(p_capability);
  IF coalesce(auth.role(),'')='service_role' THEN RETURN; END IF;
  SELECT mining_company_id INTO v_company FROM public.user_profiles
  WHERE id=auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil actif requis.' USING ERRCODE='42501';
  END IF;
  IF v_company IS NOT NULL AND v_company<>p_mining_company_id THEN
    RAISE EXCEPTION 'Operation fret hors du perimetre tenant.'
      USING ERRCODE='42501';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_fret_peut_consulter_tenant(uuid),
 public.snp_historique_peut_consulter_tenant(uuid),
 public.snp_fret_exiger_portee(uuid,text)
FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_fret_peut_consulter_tenant(uuid),
 public.snp_historique_peut_consulter_tenant(uuid)
TO authenticated,service_role;

-- -------------------------------------------------------------------------
-- 3. Derivation serveur des tenants, acteurs et horodatages.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_fret_operation_guard()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_tenant uuid;
BEGIN
  SELECT mining_company_id INTO v_tenant
  FROM public.shipping_preparations
  WHERE id=NEW.shipping_preparation_id;
  IF NOT FOUND OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'Expedition fret introuvable ou sans tenant.'
      USING ERRCODE='23503';
  END IF;
  NEW.mining_company_id:=v_tenant;
  IF TG_OP='INSERT' THEN
    NEW.created_by:=auth.uid();
    NEW.prepared_by:=auth.uid();
    NEW.created_at:=clock_timestamp();
    NEW.updated_at:=NEW.created_at;
    NEW.status_changed_at:=NEW.created_at;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.shipping_preparation_id IS DISTINCT FROM OLD.shipping_preparation_id
       OR NEW.reference_number IS DISTINCT FROM OLD.reference_number
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by THEN
      RAISE EXCEPTION 'Identite, parent et acteurs initiaux sont immuables.'
        USING ERRCODE='23514';
    END IF;
    NEW.created_at:=OLD.created_at;
    NEW.updated_at:=clock_timestamp();
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status_changed_at:=NEW.updated_at;
    ELSE
      NEW.status_changed_at:=OLD.status_changed_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_document_guard()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.freight_customs_operations o
                WHERE o.id=NEW.freight_customs_operation_id) THEN
    RAISE EXCEPTION 'Operation fret parente introuvable.' USING ERRCODE='23503';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.uploaded_by:=auth.uid();
    NEW.uploaded_at:=clock_timestamp();
  ELSIF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.freight_customs_operation_id IS DISTINCT FROM OLD.freight_customs_operation_id
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at THEN
    RAISE EXCEPTION 'Parent et audit document sont immuables.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_invoice_guard()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.freight_customs_operations o
                WHERE o.id=NEW.freight_customs_operation_id) THEN
    RAISE EXCEPTION 'Operation fret parente introuvable.' USING ERRCODE='23503';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.created_by:=auth.uid(); NEW.updated_by:=auth.uid();
    NEW.created_at:=clock_timestamp(); NEW.updated_at:=NEW.created_at;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.freight_customs_operation_id IS DISTINCT FROM OLD.freight_customs_operation_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Parent et createur facture sont immuables.' USING ERRCODE='23514';
    END IF;
    NEW.updated_by:=auth.uid(); NEW.created_at:=OLD.created_at;
    NEW.updated_at:=clock_timestamp();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS freight_customs_operations_updated_at
  ON public.freight_customs_operations;
DROP TRIGGER IF EXISTS snp_fret_operation_guard
  ON public.freight_customs_operations;
CREATE TRIGGER snp_fret_operation_guard
BEFORE INSERT OR UPDATE ON public.freight_customs_operations
FOR EACH ROW EXECUTE FUNCTION public.snp_fret_operation_guard();

DROP TRIGGER IF EXISTS snp_fret_document_guard
  ON public.freight_customs_documents;
CREATE TRIGGER snp_fret_document_guard
BEFORE INSERT OR UPDATE ON public.freight_customs_documents
FOR EACH ROW EXECUTE FUNCTION public.snp_fret_document_guard();

DROP TRIGGER IF EXISTS freight_customs_invoice_data_updated_at
  ON public.freight_customs_invoice_data;
DROP TRIGGER IF EXISTS snp_fret_invoice_guard
  ON public.freight_customs_invoice_data;
CREATE TRIGGER snp_fret_invoice_guard
BEFORE INSERT OR UPDATE ON public.freight_customs_invoice_data
FOR EACH ROW EXECUTE FUNCTION public.snp_fret_invoice_guard();

-- -------------------------------------------------------------------------
-- 4. Historique : normalisation serveur, triggers et immutabilite.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_unified_history_before_insert()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_tenant uuid; v_status text; v_headers jsonb;
BEGIN
  CASE NEW.entity_type
    WHEN 'shipping' THEN
      SELECT mining_company_id,status::text INTO v_tenant,v_status
      FROM public.shipping_preparations WHERE id=NEW.entity_id;
    WHEN 'production' THEN
      SELECT mining_company_id,status::text INTO v_tenant,v_status
      FROM public.daily_production WHERE id=NEW.entity_id;
    WHEN 'freight_customs' THEN
      SELECT mining_company_id,status::text INTO v_tenant,v_status
      FROM public.freight_customs_operations WHERE id=NEW.entity_id;
    ELSE
      RAISE EXCEPTION 'Type historique non autorise: %',NEW.entity_type
        USING ERRCODE='23514';
  END CASE;
  IF v_tenant IS NULL OR v_status IS NULL THEN
    RAISE EXCEPTION 'Objet historique absent ou sans tenant.' USING ERRCODE='23503';
  END IF;
  NEW.mining_company_id:=v_tenant;
  NEW.new_status:=v_status;
  NEW.changed_by:=auth.uid();
  NEW.changed_at:=clock_timestamp();
  NEW.created_at:=NEW.changed_at;
  BEGIN
    v_headers:=nullif(current_setting('request.headers',true),'')::jsonb;
    NEW.user_agent:=left(v_headers->>'user-agent',1024);
    NEW.ip_address:=public.snp_session_request_ip();
  EXCEPTION WHEN OTHERS THEN
    NEW.user_agent:=NULL; NEW.ip_address:=NULL;
  END;
  NEW.metadata:=coalesce(NEW.metadata,'{}'::jsonb)
    || jsonb_build_object('recorded_server_side',true);
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_unified_history_refuse_mutation()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  RAISE EXCEPTION 'L''historique unifie est immuable.' USING ERRCODE='55000';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.log_unified_status_change()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_entity text; v_context public.status_change_context;
        v_old text; v_new text;
BEGIN
  v_entity:=CASE TG_TABLE_NAME
    WHEN 'daily_production' THEN 'production'
    WHEN 'shipping_preparations' THEN 'shipping'
    ELSE NULL END;
  IF v_entity IS NULL THEN
    RAISE EXCEPTION 'Trigger historique attache a une table non autorisee.'
      USING ERRCODE='55000';
  END IF;
  v_context:=CASE v_entity WHEN 'production'
    THEN 'production_management'::public.status_change_context
    ELSE 'shipping_management'::public.status_change_context END;
  v_old:=CASE WHEN TG_OP='UPDATE' THEN OLD.status::text ELSE NULL END;
  v_new:=NEW.status::text;
  IF TG_OP='INSERT' OR v_old IS DISTINCT FROM v_new THEN
    INSERT INTO public.unified_status_history(
      entity_type,entity_id,old_status,new_status,change_context,
      action_description,metadata
    ) VALUES (
      v_entity,NEW.id,v_old,v_new,v_context,
      CASE WHEN TG_OP='INSERT' THEN 'Creation de l''objet metier'
           ELSE 'Transition de statut '||coalesce(v_old,'null')||' -> '||v_new END,
      jsonb_build_object('operation',TG_OP,'source_table',TG_TABLE_NAME)
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_log_status_change()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_old text;
BEGIN
  v_old:=CASE WHEN TG_OP='UPDATE' THEN OLD.status::text ELSE NULL END;
  IF TG_OP='INSERT' OR v_old IS DISTINCT FROM NEW.status::text THEN
    INSERT INTO public.unified_status_history(
      entity_type,entity_id,old_status,new_status,change_context,
      action_description,metadata
    ) VALUES (
      'freight_customs',NEW.id,v_old,NEW.status::text,
      'system'::public.status_change_context,
      CASE WHEN TG_OP='INSERT' THEN 'Creation du dossier fret/douane'
           ELSE 'Transition fret '||coalesce(v_old,'null')||' -> '||NEW.status::text END,
      jsonb_build_object('operation',TG_OP,'source_table',TG_TABLE_NAME)
    );
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_unified_status_history_normalize
  ON public.unified_status_history;
CREATE TRIGGER snp_unified_status_history_normalize
BEFORE INSERT ON public.unified_status_history
FOR EACH ROW EXECUTE FUNCTION public.snp_unified_history_before_insert();

CREATE TRIGGER snp_unified_status_history_immutable
BEFORE UPDATE OR DELETE ON public.unified_status_history
FOR EACH ROW EXECUTE FUNCTION public.snp_unified_history_refuse_mutation();

DROP TRIGGER IF EXISTS snp_fret_status_history
  ON public.freight_customs_operations;
CREATE TRIGGER snp_fret_status_history
AFTER INSERT OR UPDATE OF status ON public.freight_customs_operations
FOR EACH ROW EXECUTE FUNCTION public.snp_fret_log_status_change();

-- -------------------------------------------------------------------------
-- 5. RPC atomiques fret/douane.
-- -------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.snp_freight_customs_reference_seq;

CREATE OR REPLACE FUNCTION public.generate_freight_reference()
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_ref text;
BEGIN
  LOOP
    v_ref:='FC-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'
      ||lpad(nextval('public.snp_freight_customs_reference_seq')::text,8,'0');
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.freight_customs_operations
                         WHERE reference_number=v_ref);
  END LOOP;
  RETURN v_ref;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_creer_operation(
  p_shipping_preparation_id uuid
)
RETURNS public.freight_customs_operations
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_shipping public.shipping_preparations%ROWTYPE;
        v_row public.freight_customs_operations%ROWTYPE;
BEGIN
  IF p_shipping_preparation_id IS NULL THEN
    RAISE EXCEPTION 'Expedition requise.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_shipping FROM public.shipping_preparations
  WHERE id=p_shipping_preparation_id FOR UPDATE;
  IF NOT FOUND OR v_shipping.mining_company_id IS NULL THEN
    RAISE EXCEPTION 'Expedition introuvable ou sans tenant.' USING ERRCODE='23503';
  END IF;
  PERFORM public.snp_fret_exiger_portee(
    v_shipping.mining_company_id,'freight.prepare'
  );
  IF v_shipping.status::text<>'ready_for_expedition' THEN
    RAISE EXCEPTION 'L''expedition doit etre prete pour expedition.'
      USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM public.freight_customs_operations
            WHERE shipping_preparation_id=p_shipping_preparation_id) THEN
    RAISE EXCEPTION 'Une operation fret existe deja pour cette expedition.'
      USING ERRCODE='23505';
  END IF;
  INSERT INTO public.freight_customs_operations(
    shipping_preparation_id,reference_number
  ) VALUES (
    p_shipping_preparation_id,public.generate_freight_reference()
  ) RETURNING * INTO v_row;
  RETURN v_row;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_modifier_operation(
  p_operation_id uuid,
  p_expected_updated_at timestamptz,
  p_modifications jsonb
)
RETURNS public.freight_customs_operations
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_row public.freight_customs_operations%ROWTYPE; v_keys text[];
BEGIN
  IF p_operation_id IS NULL OR p_expected_updated_at IS NULL
     OR jsonb_typeof(p_modifications)<>'object' THEN
    RAISE EXCEPTION 'Operation, version et objet modifications requis.'
      USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_row FROM public.freight_customs_operations
  WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation fret introuvable.' USING ERRCODE='P0002'; END IF;
  PERFORM public.snp_fret_exiger_portee(v_row.mining_company_id,'freight.prepare');
  IF v_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Conflit optimiste sur le dossier fret.' USING ERRCODE='40001';
  END IF;
  IF v_row.status::text='shipped_to_refinery' THEN
    RAISE EXCEPTION 'Un dossier expedie est immuable.' USING ERRCODE='23514';
  END IF;
  SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(p_modifications) k
  WHERE k<>ALL(ARRAY[
    'customs_office','customs_officer_name','customs_reference_number',
    'transport_company_id','freight_forwarder_contact',
    'estimated_departure_date','estimated_arrival_date','awb_number',
    'tracking_number','notes'
  ]);
  IF v_keys IS NOT NULL THEN
    RAISE EXCEPTION 'Champs fret interdits: %',array_to_string(v_keys,',')
      USING ERRCODE='22023';
  END IF;
  IF length(coalesce(p_modifications->>'notes',''))>5000
     OR length(coalesce(p_modifications->>'customs_office',''))>200
     OR length(coalesce(p_modifications->>'customs_officer_name',''))>200
     OR length(coalesce(p_modifications->>'freight_forwarder_contact',''))>500 THEN
    RAISE EXCEPTION 'Valeur fret trop longue.' USING ERRCODE='22023';
  END IF;
  UPDATE public.freight_customs_operations SET
    customs_office=CASE WHEN p_modifications?'customs_office'
      THEN nullif(trim(p_modifications->>'customs_office'),'') ELSE customs_office END,
    customs_officer_name=CASE WHEN p_modifications?'customs_officer_name'
      THEN nullif(trim(p_modifications->>'customs_officer_name'),'') ELSE customs_officer_name END,
    customs_reference_number=CASE WHEN p_modifications?'customs_reference_number'
      THEN nullif(trim(p_modifications->>'customs_reference_number'),'') ELSE customs_reference_number END,
    transport_company_id=CASE WHEN p_modifications?'transport_company_id'
      THEN nullif(p_modifications->>'transport_company_id','')::uuid ELSE transport_company_id END,
    freight_forwarder_contact=CASE WHEN p_modifications?'freight_forwarder_contact'
      THEN nullif(trim(p_modifications->>'freight_forwarder_contact'),'') ELSE freight_forwarder_contact END,
    estimated_departure_date=CASE WHEN p_modifications?'estimated_departure_date'
      THEN nullif(p_modifications->>'estimated_departure_date','')::timestamptz ELSE estimated_departure_date END,
    estimated_arrival_date=CASE WHEN p_modifications?'estimated_arrival_date'
      THEN nullif(p_modifications->>'estimated_arrival_date','')::timestamptz ELSE estimated_arrival_date END,
    awb_number=CASE WHEN p_modifications?'awb_number'
      THEN nullif(trim(p_modifications->>'awb_number'),'') ELSE awb_number END,
    tracking_number=CASE WHEN p_modifications?'tracking_number'
      THEN nullif(trim(p_modifications->>'tracking_number'),'') ELSE tracking_number END,
    notes=CASE WHEN p_modifications?'notes'
      THEN nullif(trim(p_modifications->>'notes'),'') ELSE notes END
  WHERE id=p_operation_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_transitionner_operation(
  p_operation_id uuid,
  p_expected_status text,
  p_new_status text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS public.freight_customs_operations
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_row public.freight_customs_operations%ROWTYPE;
        v_capability text; v_actor uuid:=auth.uid(); v_keys text[];
BEGIN
  IF p_operation_id IS NULL OR p_expected_status IS NULL OR p_new_status IS NULL
     OR jsonb_typeof(coalesce(p_details,'{}'::jsonb))<>'object' THEN
    RAISE EXCEPTION 'Operation, statuts et details valides requis.' USING ERRCODE='22023';
  END IF;
  SELECT array_agg(k) INTO v_keys
  FROM jsonb_object_keys(coalesce(p_details,'{}'::jsonb)) k
  WHERE k<>ALL(ARRAY[
    'customs_office','customs_officer_name','customs_reference_number',
    'transport_company_id','freight_forwarder_contact','awb_number',
    'tracking_number','notes'
  ]);
  IF v_keys IS NOT NULL THEN
    RAISE EXCEPTION 'Details de transition interdits: %',array_to_string(v_keys,',')
      USING ERRCODE='22023';
  END IF;
  IF length(coalesce(p_details->>'notes',''))>5000
     OR length(coalesce(p_details->>'customs_office',''))>200
     OR length(coalesce(p_details->>'customs_officer_name',''))>200
     OR length(coalesce(p_details->>'freight_forwarder_contact',''))>500 THEN
    RAISE EXCEPTION 'Detail de transition trop long.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_row FROM public.freight_customs_operations
  WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation fret introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_row.status::text<>p_expected_status THEN
    RAISE EXCEPTION 'Conflit optimiste: statut courant %.',v_row.status::text
      USING ERRCODE='40001';
  END IF;
  v_capability:=CASE
    WHEN p_expected_status='customs_pending' AND p_new_status='customs_approved'
      THEN 'freight.customs.approve'
    WHEN p_expected_status='customs_approved' AND p_new_status='ready_for_transport'
      THEN 'freight.prepare'
    WHEN p_expected_status='ready_for_transport' AND p_new_status='shipped_to_refinery'
      THEN 'freight.transport.dispatch'
    WHEN p_expected_status='ready_for_expedition' AND p_new_status='shipped_to_refinery'
      THEN 'freight.transport.dispatch'
    ELSE NULL END;
  IF v_capability IS NULL THEN
    RAISE EXCEPTION 'Transition fret interdite: % -> %.',p_expected_status,p_new_status
      USING ERRCODE='23514';
  END IF;
  PERFORM public.snp_fret_exiger_portee(v_row.mining_company_id,v_capability);
  IF p_expected_status='customs_pending'
     AND v_actor IS NOT DISTINCT FROM coalesce(v_row.prepared_by,v_row.created_by) THEN
    RAISE EXCEPTION 'Le preparateur ne peut pas approuver son dossier douanier.'
      USING ERRCODE='42501';
  END IF;
  IF p_expected_status='customs_approved'
     AND v_actor IS NOT DISTINCT FROM v_row.customs_approved_by THEN
    RAISE EXCEPTION 'L''approbateur ne prepare pas lui-meme le transport.'
      USING ERRCODE='42501';
  END IF;
  IF p_new_status='shipped_to_refinery'
     AND v_actor IS NOT DISTINCT FROM coalesce(v_row.customs_approved_by,v_row.created_by) THEN
    RAISE EXCEPTION 'L''approbateur/createur ne peut pas constater seul l''expedition.'
      USING ERRCODE='42501';
  END IF;
  UPDATE public.freight_customs_operations SET
    status=p_new_status::public.freight_customs_status,
    customs_office=CASE WHEN p_details?'customs_office'
      THEN nullif(trim(p_details->>'customs_office'),'') ELSE customs_office END,
    customs_officer_name=CASE WHEN p_details?'customs_officer_name'
      THEN nullif(trim(p_details->>'customs_officer_name'),'') ELSE customs_officer_name END,
    customs_reference_number=CASE WHEN p_details?'customs_reference_number'
      THEN nullif(trim(p_details->>'customs_reference_number'),'') ELSE customs_reference_number END,
    transport_company_id=CASE WHEN p_details?'transport_company_id'
      THEN nullif(p_details->>'transport_company_id','')::uuid ELSE transport_company_id END,
    freight_forwarder_contact=CASE WHEN p_details?'freight_forwarder_contact'
      THEN nullif(trim(p_details->>'freight_forwarder_contact'),'') ELSE freight_forwarder_contact END,
    awb_number=CASE WHEN p_details?'awb_number'
      THEN nullif(trim(p_details->>'awb_number'),'') ELSE awb_number END,
    tracking_number=CASE WHEN p_details?'tracking_number'
      THEN nullif(trim(p_details->>'tracking_number'),'') ELSE tracking_number END,
    notes=CASE WHEN p_details?'notes'
      THEN nullif(trim(p_details->>'notes'),'') ELSE notes END,
    customs_approval_date=CASE WHEN p_new_status='customs_approved'
      THEN clock_timestamp() ELSE customs_approval_date END,
    customs_approved_by=CASE WHEN p_new_status='customs_approved'
      THEN v_actor ELSE customs_approved_by END,
    transport_prepared_by=CASE WHEN p_new_status='ready_for_transport'
      THEN v_actor ELSE transport_prepared_by END,
    actual_departure_date=CASE WHEN p_new_status='shipped_to_refinery'
      THEN clock_timestamp() ELSE actual_departure_date END,
    dispatched_by=CASE WHEN p_new_status='shipped_to_refinery'
      THEN v_actor ELSE dispatched_by END
  WHERE id=p_operation_id AND status::text=p_expected_status
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conflit optimiste pendant la transition.' USING ERRCODE='40001';
  END IF;
  RETURN v_row;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_ajouter_document(
  p_operation_id uuid,
  p_document_type public.freight_document_type,
  p_title text,
  p_description text,
  p_file_path text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text
)
RETURNS public.freight_customs_documents
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_operation public.freight_customs_operations%ROWTYPE;
        v_row public.freight_customs_documents%ROWTYPE;
BEGIN
  SELECT * INTO v_operation FROM public.freight_customs_operations
  WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation fret introuvable.' USING ERRCODE='P0002'; END IF;
  PERFORM public.snp_fret_exiger_portee(v_operation.mining_company_id,'freight.prepare');
  IF v_operation.status::text='shipped_to_refinery' THEN
    RAISE EXCEPTION 'Aucun document ne peut etre ajoute apres expedition.'
      USING ERRCODE='23514';
  END IF;
  IF length(trim(coalesce(p_title,''))) NOT BETWEEN 3 AND 250
     OR p_file_size IS NULL OR p_file_size<=0 OR p_file_size>20971520
     OR p_mime_type NOT IN ('application/pdf','image/jpeg','image/png')
     OR p_file_path !~ ('^freight-customs/'||p_operation_id::text||'/[^/]+$')
     OR length(coalesce(p_file_name,''))>255 THEN
    RAISE EXCEPTION 'Metadonnees ou chemin document fret invalides.'
      USING ERRCODE='22023';
  END IF;
  INSERT INTO public.freight_customs_documents(
    freight_customs_operation_id,document_type,title,description,
    file_path,file_name,file_size,mime_type
  ) VALUES (
    p_operation_id,p_document_type,trim(p_title),nullif(trim(p_description),''),
    p_file_path,p_file_name,p_file_size,p_mime_type
  ) RETURNING * INTO v_row;
  RETURN v_row;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_supprimer_document(
  p_document_id uuid
)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_doc public.freight_customs_documents%ROWTYPE;
        v_operation public.freight_customs_operations%ROWTYPE;
BEGIN
  SELECT * INTO v_doc FROM public.freight_customs_documents
  WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document fret introuvable.' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_operation FROM public.freight_customs_operations
  WHERE id=v_doc.freight_customs_operation_id FOR UPDATE;
  PERFORM public.snp_fret_exiger_portee(v_operation.mining_company_id,'freight.prepare');
  IF v_operation.status::text NOT IN ('customs_pending','ready_for_expedition') THEN
    RAISE EXCEPTION 'Un document engage dans le circuit douanier est immuable.'
      USING ERRCODE='23514';
  END IF;
  DELETE FROM public.freight_customs_documents WHERE id=p_document_id;
  RETURN v_doc.file_path;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_fret_enregistrer_facture(
  p_operation_id uuid,
  p_donnees jsonb
)
RETURNS public.freight_customs_invoice_data
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_operation public.freight_customs_operations%ROWTYPE;
        v_company public.mining_companies%ROWTYPE;
        v_row public.freight_customs_invoice_data%ROWTYPE; v_keys text[];
BEGIN
  IF jsonb_typeof(p_donnees)<>'object' THEN
    RAISE EXCEPTION 'Objet donnees facture requis.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_operation FROM public.freight_customs_operations
  WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation fret introuvable.' USING ERRCODE='P0002'; END IF;
  PERFORM public.snp_fret_exiger_portee(v_operation.mining_company_id,'freight.invoice.manage');
  SELECT * INTO v_company FROM public.mining_companies
  WHERE id=v_operation.mining_company_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Societe miniere inactive ou introuvable.' USING ERRCODE='23503'; END IF;
  SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(p_donnees) k
  WHERE k<>ALL(ARRAY[
    'recipient_name','recipient_address','recipient_city','recipient_country',
    'recipient_phone','exchange_rate_fcfa_usd','number_of_boxes','box_type',
    'description','metal_price_cfa_per_kg','total_value_cfa','total_value_usd'
  ]);
  IF v_keys IS NOT NULL THEN
    RAISE EXCEPTION 'Champs facture interdits/derives: %',array_to_string(v_keys,',')
      USING ERRCODE='22023';
  END IF;
  IF coalesce(nullif(p_donnees->>'exchange_rate_fcfa_usd','')::numeric,1)<=0
     OR coalesce(nullif(p_donnees->>'number_of_boxes','')::integer,1)<=0
     OR coalesce(nullif(p_donnees->>'metal_price_cfa_per_kg','')::numeric,0)<0
     OR coalesce(nullif(p_donnees->>'total_value_cfa','')::numeric,0)<0
     OR coalesce(nullif(p_donnees->>'total_value_usd','')::numeric,0)<0 THEN
    RAISE EXCEPTION 'Montants, taux ou nombre de colis invalides.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.freight_customs_invoice_data(
    freight_customs_operation_id,
    sender_name,sender_address,sender_city,sender_country,sender_nif,
    mine_name,mine_location,country_of_origin,
    recipient_name,recipient_address,recipient_city,recipient_country,
    recipient_phone,exchange_rate_fcfa_usd,number_of_boxes,box_type,
    description,metal_price_cfa_per_kg,total_value_cfa,total_value_usd
  ) VALUES (
    p_operation_id,
    v_company.name,v_company.address,coalesce(v_company.city,v_company.localite),
    v_company.country,v_company.tax_id,v_company.name,
    coalesce(v_company.localite,v_company.city),v_company.country,
    nullif(trim(p_donnees->>'recipient_name'),''),
    nullif(trim(p_donnees->>'recipient_address'),''),
    nullif(trim(p_donnees->>'recipient_city'),''),
    nullif(trim(p_donnees->>'recipient_country'),''),
    nullif(trim(p_donnees->>'recipient_phone'),''),
    nullif(p_donnees->>'exchange_rate_fcfa_usd','')::numeric,
    nullif(p_donnees->>'number_of_boxes','')::integer,
    coalesce(nullif(trim(p_donnees->>'box_type'),''),'Plastic Box'),
    coalesce(nullif(trim(p_donnees->>'description'),''),
      'Dore: Gold, Silver, ingot packed in boxes'),
    nullif(p_donnees->>'metal_price_cfa_per_kg','')::numeric,
    nullif(p_donnees->>'total_value_cfa','')::numeric,
    nullif(p_donnees->>'total_value_usd','')::numeric
  ) ON CONFLICT(freight_customs_operation_id) DO UPDATE SET
    sender_name=EXCLUDED.sender_name,sender_address=EXCLUDED.sender_address,
    sender_city=EXCLUDED.sender_city,sender_country=EXCLUDED.sender_country,
    sender_nif=EXCLUDED.sender_nif,mine_name=EXCLUDED.mine_name,
    mine_location=EXCLUDED.mine_location,country_of_origin=EXCLUDED.country_of_origin,
    recipient_name=EXCLUDED.recipient_name,
    recipient_address=EXCLUDED.recipient_address,
    recipient_city=EXCLUDED.recipient_city,
    recipient_country=EXCLUDED.recipient_country,
    recipient_phone=EXCLUDED.recipient_phone,
    exchange_rate_fcfa_usd=EXCLUDED.exchange_rate_fcfa_usd,
    number_of_boxes=EXCLUDED.number_of_boxes,box_type=EXCLUDED.box_type,
    description=EXCLUDED.description,
    metal_price_cfa_per_kg=EXCLUDED.metal_price_cfa_per_kg,
    total_value_cfa=EXCLUDED.total_value_cfa,
    total_value_usd=EXCLUDED.total_value_usd
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$fn$;

-- -------------------------------------------------------------------------
-- 6. RLS deny-by-default et contrat de lecture historique tenant-aware.
-- -------------------------------------------------------------------------
ALTER TABLE public.freight_customs_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_customs_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.freight_customs_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_customs_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.freight_customs_invoice_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_customs_invoice_data FORCE ROW LEVEL SECURITY;
ALTER TABLE public.unified_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_status_history FORCE ROW LEVEL SECURITY;

DO $drop_policies$
DECLARE v record;
BEGIN
  FOR v IN SELECT schemaname,tablename,policyname FROM pg_policies
           WHERE schemaname='public' AND tablename IN(
             'freight_customs_operations','freight_customs_documents',
             'freight_customs_invoice_data','unified_status_history'
           )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   v.policyname,v.schemaname,v.tablename);
  END LOOP;
END;
$drop_policies$;

CREATE POLICY snp_freight_operations_read ON public.freight_customs_operations
FOR SELECT TO authenticated
USING(public.snp_fret_peut_consulter_tenant(mining_company_id));
CREATE POLICY snp_freight_operations_service ON public.freight_customs_operations
FOR ALL TO service_role
USING(coalesce(auth.role(),'')='service_role')
WITH CHECK(coalesce(auth.role(),'')='service_role');

CREATE POLICY snp_freight_documents_read ON public.freight_customs_documents
FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.freight_customs_operations o
  WHERE o.id=freight_customs_operation_id
    AND public.snp_fret_peut_consulter_tenant(o.mining_company_id)
));
CREATE POLICY snp_freight_documents_service ON public.freight_customs_documents
FOR ALL TO service_role
USING(coalesce(auth.role(),'')='service_role')
WITH CHECK(coalesce(auth.role(),'')='service_role');

CREATE POLICY snp_freight_invoice_read ON public.freight_customs_invoice_data
FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.freight_customs_operations o
  WHERE o.id=freight_customs_operation_id
    AND public.snp_fret_peut_consulter_tenant(o.mining_company_id)
));
CREATE POLICY snp_freight_invoice_service ON public.freight_customs_invoice_data
FOR ALL TO service_role
USING(coalesce(auth.role(),'')='service_role')
WITH CHECK(coalesce(auth.role(),'')='service_role');

CREATE POLICY snp_unified_history_read ON public.unified_status_history
FOR SELECT TO authenticated
USING(public.snp_historique_peut_consulter_tenant(mining_company_id));
CREATE POLICY snp_unified_history_service ON public.unified_status_history
FOR SELECT TO service_role USING(coalesce(auth.role(),'')='service_role');

REVOKE ALL PRIVILEGES ON TABLE public.freight_customs_operations,
 public.freight_customs_documents,public.freight_customs_invoice_data,
 public.unified_status_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.freight_customs_operations,
 public.freight_customs_documents,public.freight_customs_invoice_data,
 public.unified_status_history TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.freight_customs_operations,
 public.freight_customs_documents,public.freight_customs_invoice_data,
 public.unified_status_history TO service_role;

CREATE OR REPLACE FUNCTION public.get_unified_status_history(
  p_entity_type text,p_entity_id uuid
)
RETURNS TABLE(
  id uuid,old_status text,new_status text,change_context text,
  changed_by uuid,changed_at timestamptz,action_description text,notes text,
  user_email text,user_name text,metadata jsonb
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF p_entity_type NOT IN ('production','shipping','freight_customs')
     OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Objet historique invalide.' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.unified_status_history h
            WHERE h.entity_type=p_entity_type AND h.entity_id=p_entity_id)
     AND NOT EXISTS(
       SELECT 1 FROM public.unified_status_history h
       WHERE h.entity_type=p_entity_type AND h.entity_id=p_entity_id
         AND public.snp_historique_peut_consulter_tenant(h.mining_company_id)
     ) THEN
    RAISE EXCEPTION 'Historique hors du perimetre autorise.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT h.id,h.old_status,h.new_status,h.change_context::text,
    h.changed_by,h.changed_at,h.action_description,h.notes,
    au.email::text,coalesce(up.full_name,au.email)::text,h.metadata
  FROM public.unified_status_history h
  LEFT JOIN auth.users au ON au.id=h.changed_by
  LEFT JOIN public.user_profiles up ON up.id=h.changed_by
  WHERE h.entity_type=p_entity_type AND h.entity_id=p_entity_id
    AND public.snp_historique_peut_consulter_tenant(h.mining_company_id)
  ORDER BY h.changed_at,h.id;
END;
$fn$;

-- Les helpers/triggers et le generateur sont prives. Seule l'allowlist RPC
-- metier est exposable au navigateur authentifie.
REVOKE ALL ON FUNCTION public.generate_freight_reference(),
 public.snp_fret_operation_guard(),public.snp_fret_document_guard(),
 public.snp_fret_invoice_guard(),public.snp_unified_history_before_insert(),
 public.snp_unified_history_refuse_mutation(),public.log_unified_status_change(),
 public.snp_fret_log_status_change(),public.snp_fret_exiger_portee(uuid,text)
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.snp_freight_customs_reference_seq
FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.snp_fret_creer_operation(uuid),
 public.snp_fret_modifier_operation(uuid,timestamptz,jsonb),
 public.snp_fret_transitionner_operation(uuid,text,text,jsonb),
 public.snp_fret_ajouter_document(uuid,public.freight_document_type,text,text,text,text,bigint,text),
 public.snp_fret_supprimer_document(uuid),
 public.snp_fret_enregistrer_facture(uuid,jsonb),
 public.get_unified_status_history(text,uuid)
FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.snp_fret_creer_operation(uuid),
 public.snp_fret_modifier_operation(uuid,timestamptz,jsonb),
 public.snp_fret_transitionner_operation(uuid,text,text,jsonb),
 public.snp_fret_ajouter_document(uuid,public.freight_document_type,text,text,text,text,bigint,text),
 public.snp_fret_supprimer_document(uuid),
 public.snp_fret_enregistrer_facture(uuid,jsonb),
 public.get_unified_status_history(text,uuid)
TO authenticated,service_role;

COMMENT ON FUNCTION public.snp_fret_creer_operation(uuid) IS
  'LOT 4F: cree un dossier fret pour une expedition ready_for_expedition; tenant/reference/auteur derives serveur.';
COMMENT ON FUNCTION public.snp_fret_transitionner_operation(uuid,text,text,jsonb) IS
  'LOT 4F: transition fret optimiste avec capabilities distinctes et separation preparateur/approbateur/expediteur.';
COMMENT ON TABLE public.unified_status_history IS
  'Historique metier immuable; inserts exclusivement issus des triggers serveur et lectures tenant-aware.';

-- Validation post-migration : aucune policy client d'ecriture, aucun grant
-- DML client, FORCE RLS et toutes les RPC sensibles privees par defaut.
DO $postcheck$
BEGIN
  IF EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename IN(
      'freight_customs_operations','freight_customs_documents',
      'freight_customs_invoice_data','unified_status_history'
    ) AND roles && ARRAY['authenticated'::name]
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    RAISE EXCEPTION 'LOT 4F: policy DML client residuelle.' USING ERRCODE='55000';
  END IF;
  IF EXISTS(
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name IN(
      'freight_customs_operations','freight_customs_documents',
      'freight_customs_invoice_data','unified_status_history'
    ) AND grantee IN ('anon','authenticated')
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) THEN
    RAISE EXCEPTION 'LOT 4F: grant DML client residuel.' USING ERRCODE='55000';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_class
    WHERE oid IN(
      'public.freight_customs_operations'::regclass,
      'public.freight_customs_documents'::regclass,
      'public.freight_customs_invoice_data'::regclass,
      'public.unified_status_history'::regclass
    ) AND (NOT relrowsecurity OR NOT relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'LOT 4F: RLS/FORCE RLS incomplet.' USING ERRCODE='55000';
  END IF;
END;
$postcheck$;
