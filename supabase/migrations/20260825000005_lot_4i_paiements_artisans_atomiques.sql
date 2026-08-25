-- ============================================================================
-- LOT 4I P0 — factures, paiements artisans et reversements fiscaux atomiques
-- ============================================================================
-- Contrat :
--   * aucune mutation PostgREST directe des quatre agrégats financiers ;
--   * tenant/artisan/acteurs/montants/taxes dérivés exclusivement en base ;
--   * AAL2 via capabilities sensibles, verrou + version + idempotence ;
--   * séparation préparation/validation/exécution et reversement/comptabilisation ;
--   * politique fiscale 2026 explicite, versionnée et non modifiable par le runtime.
--
-- Limite fail-closed assumée : le connecteur DGI et le gateway privé de preuve
-- de paiement ne sont pas raccordés. La certification historique saisie depuis
-- le navigateur est donc retirée du runtime, et `complete` exige une preuve déjà
-- rattachée par un futur service autoritatif. Aucun chemin libre n'est accepté.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '0';

-- --------------------------------------------------------------------------
-- 0. Préflight : le lot n'invente pas le socle historique absent du graphe.
-- --------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_object text;
  v_column record;
  v_count bigint;
BEGIN
  FOREACH v_object IN ARRAY ARRAY[
    'public.snp_artisan_ventes_or',
    'public.snp_artisan_factures_definitives',
    'public.snp_artisan_paiements',
    'public.snp_artisan_taxes_retenues',
    'public.snp_artisan_moyens_paiement',
    'public.snp_artisans_miniers',
    'public.snp_artisanal_stock_ledger',
    'public.snp_organizations',
    'public.snp_capability_catalog',
    'public.snp_role_capabilities',
    'public.snp_workflow_audit'
  ] LOOP
    IF to_regclass(v_object) IS NULL THEN
      RAISE EXCEPTION 'Préflight 4I : objet requis absent : %.', v_object;
    END IF;
  END LOOP;

  IF to_regprocedure('public.snp_require_capability(text)') IS NULL
     OR to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
     OR to_regprocedure('public.snp_current_organization_id()') IS NULL
     OR to_regprocedure('public.snp_current_organization_type()') IS NULL
     OR to_regprocedure('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)') IS NULL
     OR to_regprocedure('public.snp_4b_payment_snapshot(public.snp_artisan_moyens_paiement)') IS NULL THEN
    RAISE EXCEPTION 'Préflight 4I : socle capability/tenant/audit 4B absent.';
  END IF;

  FOR v_column IN
    SELECT * FROM (VALUES
      ('snp_artisan_ventes_or','id'),('snp_artisan_ventes_or','artisan_id'),
      ('snp_artisan_ventes_or','statut'),('snp_artisan_ventes_or','statut_paiement'),
      ('snp_artisan_ventes_or','facture_definitive_id'),
      ('snp_artisan_ventes_or','montant_brut_fcfa'),
      ('snp_artisan_ventes_or','comptoir_organization_id'),
      ('snp_artisan_factures_definitives','id'),
      ('snp_artisan_factures_definitives','vente_or_id'),
      ('snp_artisan_factures_definitives','artisan_id'),
      ('snp_artisan_factures_definitives','statut'),
      ('snp_artisan_factures_definitives','certification_dgi_status'),
      ('snp_artisan_factures_definitives','montant_net_a_payer'),
      ('snp_artisan_factures_definitives','comptoir_organization_id'),
      ('snp_artisan_paiements','id'),('snp_artisan_paiements','facture_id'),
      ('snp_artisan_paiements','vente_or_id'),('snp_artisan_paiements','artisan_id'),
      ('snp_artisan_paiements','statut'),('snp_artisan_paiements','traite_par'),
      ('snp_artisan_paiements','valide_par'),
      ('snp_artisan_paiements','preuve_paiement_url'),
      ('snp_artisan_paiements','comptoir_organization_id'),
      ('snp_artisan_taxes_retenues','id'),
      ('snp_artisan_taxes_retenues','paiement_id'),
      ('snp_artisan_taxes_retenues','statut_reversement'),
      ('snp_artisan_taxes_retenues','comptoir_organization_id')
    ) AS required(table_name,column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public'
        AND c.table_name=required.table_name
        AND c.column_name=required.column_name
    )
  LOOP
    RAISE EXCEPTION 'Préflight 4I : colonne requise absente %.%.',
      v_column.table_name, v_column.column_name;
  END LOOP;

  SELECT count(*) INTO v_count
  FROM public.snp_artisan_factures_definitives
  GROUP BY vente_or_id HAVING count(*) > 1 LIMIT 1;
  IF v_count IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight 4I : plusieurs factures définitives existent pour une vente.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.snp_artisan_paiements
  WHERE statut NOT IN ('annule','echec')
  GROUP BY facture_id HAVING count(*) > 1 LIMIT 1;
  IF v_count IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight 4I : plusieurs paiements actifs existent pour une facture.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.snp_artisan_factures_definitives f
  JOIN public.snp_artisan_ventes_or v ON v.id=f.vente_or_id
  WHERE f.artisan_id IS DISTINCT FROM v.artisan_id
     OR f.comptoir_organization_id IS DISTINCT FROM v.comptoir_organization_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Préflight 4I : % facture(s) divergent de leur vente sur artisan/tenant.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.snp_artisan_paiements p
  JOIN public.snp_artisan_factures_definitives f ON f.id=p.facture_id
  WHERE p.vente_or_id IS DISTINCT FROM f.vente_or_id
     OR p.artisan_id IS DISTINCT FROM f.artisan_id
     OR p.comptoir_organization_id IS DISTINCT FROM f.comptoir_organization_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Préflight 4I : % paiement(s) divergent de leur facture sur parent/tenant.', v_count;
  END IF;
END;
$preflight$;

-- --------------------------------------------------------------------------
-- 1. Capabilities sensibles dédiées. Admin seulement par défaut ; les comptes
-- opérationnels reçoivent des overrides individuels traçables.
-- --------------------------------------------------------------------------
INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES
  ('comptoir.invoices.issue','comptoir','Émettre une facture artisanale',
   'Émettre atomiquement la facture fiscale d’une vente du comptoir.',true),
  ('comptoir.payments.execute','comptoir','Exécuter un paiement artisan',
   'Préparer, exécuter, annuler ou constater l’échec d’un paiement artisan.',true),
  ('comptoir.payments.reconcile','comptoir','Contrôler un paiement artisan',
   'Valider un paiement préparé par un autre acteur du même comptoir.',true),
  ('comptoir.tax.execute','comptoir','Exécuter un reversement fiscal',
   'Préparer et transmettre un reversement fiscal du comptoir.',true),
  ('sonasp.tax.reconcile','finance','Comptabiliser un reversement fiscal',
   'Rapprocher et comptabiliser un reversement exécuté par un autre acteur.',true)
ON CONFLICT(code) DO UPDATE SET
  domain=EXCLUDED.domain,label=EXCLUDED.label,
  description=EXCLUDED.description,sensitive=true;

INSERT INTO public.snp_role_capabilities(role,capability_code)
VALUES
  ('admin','comptoir.invoices.issue'),
  ('admin','comptoir.payments.execute'),
  ('admin','comptoir.payments.reconcile'),
  ('admin','comptoir.tax.execute'),
  ('admin','sonasp.tax.reconcile')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 2. Politique fiscale immuable au runtime et version des agrégats.
-- La retenue 5 % est la règle la plus récente du jeu métier 2026
-- (20260820_009), qui supersède le prototype historique à 1,5 %.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snp_artisan_tax_policies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code text NOT NULL UNIQUE,
  effective_from date NOT NULL,
  effective_until date,
  vat_rate numeric(7,4) NOT NULL CHECK(vat_rate BETWEEN 0 AND 100),
  withholding_rate numeric(7,4) NOT NULL CHECK(withholding_rate BETWEEN 0 AND 100),
  community_rate numeric(7,4) NOT NULL CHECK(community_rate BETWEEN 0 AND 100),
  source_note text NOT NULL CHECK(length(trim(source_note))>=10),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_artisan_tax_policy_period CHECK(
    effective_until IS NULL OR effective_until>=effective_from
  )
);

INSERT INTO public.snp_artisan_tax_policies(
  policy_code,effective_from,effective_until,
  vat_rate,withholding_rate,community_rate,source_note
)
VALUES(
  'BF-ARTISAN-2026','2026-01-01',NULL,18.0000,5.0000,1.0000,
  'Politique serveur issue du scénario fiscal artisanal canonique 2026.'
)
ON CONFLICT(policy_code) DO UPDATE SET
  effective_from=EXCLUDED.effective_from,
  effective_until=EXCLUDED.effective_until,
  vat_rate=EXCLUDED.vat_rate,
  withholding_rate=EXCLUDED.withholding_rate,
  community_rate=EXCLUDED.community_rate,
  source_note=EXCLUDED.source_note;

ALTER TABLE public.snp_artisan_tax_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_artisan_tax_policies FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.snp_artisan_tax_policies FROM PUBLIC,anon,authenticated;

ALTER TABLE public.snp_artisan_ventes_or
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
ALTER TABLE public.snp_artisan_factures_definitives
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_policy_id uuid;
ALTER TABLE public.snp_artisan_paiements
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS failed_by uuid,
  ADD COLUMN IF NOT EXISTS terminal_reason text;
ALTER TABLE public.snp_artisan_taxes_retenues
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversement_started_by uuid,
  ADD COLUMN IF NOT EXISTS reversement_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid,
  ADD COLUMN IF NOT EXISTS comptabilise_par uuid,
  ADD COLUMN IF NOT EXISTS comptabilise_at timestamptz;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_ventes_version_check') THEN
    ALTER TABLE public.snp_artisan_ventes_or ADD CONSTRAINT snp_artisan_ventes_version_check CHECK(version>=0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_factures_version_check') THEN
    ALTER TABLE public.snp_artisan_factures_definitives ADD CONSTRAINT snp_artisan_factures_version_check CHECK(version>=0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_paiements_version_check') THEN
    ALTER TABLE public.snp_artisan_paiements ADD CONSTRAINT snp_artisan_paiements_version_check CHECK(version>=0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_taxes_version_check') THEN
    ALTER TABLE public.snp_artisan_taxes_retenues ADD CONSTRAINT snp_artisan_taxes_version_check CHECK(version>=0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_factures_tax_policy_fkey') THEN
    ALTER TABLE public.snp_artisan_factures_definitives
      ADD CONSTRAINT snp_artisan_factures_tax_policy_fkey FOREIGN KEY(tax_policy_id)
      REFERENCES public.snp_artisan_tax_policies(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_paiements_completed_by_fkey') THEN
    ALTER TABLE public.snp_artisan_paiements ADD CONSTRAINT snp_artisan_paiements_completed_by_fkey
      FOREIGN KEY(completed_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_paiements_cancelled_by_fkey') THEN
    ALTER TABLE public.snp_artisan_paiements ADD CONSTRAINT snp_artisan_paiements_cancelled_by_fkey
      FOREIGN KEY(cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_paiements_failed_by_fkey') THEN
    ALTER TABLE public.snp_artisan_paiements ADD CONSTRAINT snp_artisan_paiements_failed_by_fkey
      FOREIGN KEY(failed_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_taxes_started_by_fkey') THEN
    ALTER TABLE public.snp_artisan_taxes_retenues ADD CONSTRAINT snp_artisan_taxes_started_by_fkey
      FOREIGN KEY(reversement_started_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_taxes_reversed_by_fkey') THEN
    ALTER TABLE public.snp_artisan_taxes_retenues ADD CONSTRAINT snp_artisan_taxes_reversed_by_fkey
      FOREIGN KEY(reversed_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='snp_artisan_taxes_comptabilise_par_fkey') THEN
    ALTER TABLE public.snp_artisan_taxes_retenues ADD CONSTRAINT snp_artisan_taxes_comptabilise_par_fkey
      FOREIGN KEY(comptabilise_par) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END;
$constraints$;

ALTER TABLE public.snp_artisan_factures_definitives
  VALIDATE CONSTRAINT snp_artisan_factures_tax_policy_fkey;
ALTER TABLE public.snp_artisan_paiements
  VALIDATE CONSTRAINT snp_artisan_paiements_completed_by_fkey;
ALTER TABLE public.snp_artisan_paiements
  VALIDATE CONSTRAINT snp_artisan_paiements_cancelled_by_fkey;
ALTER TABLE public.snp_artisan_paiements
  VALIDATE CONSTRAINT snp_artisan_paiements_failed_by_fkey;
ALTER TABLE public.snp_artisan_taxes_retenues
  VALIDATE CONSTRAINT snp_artisan_taxes_started_by_fkey;
ALTER TABLE public.snp_artisan_taxes_retenues
  VALIDATE CONSTRAINT snp_artisan_taxes_reversed_by_fkey;
ALTER TABLE public.snp_artisan_taxes_retenues
  VALIDATE CONSTRAINT snp_artisan_taxes_comptabilise_par_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_artisan_facture_par_vente
  ON public.snp_artisan_factures_definitives(vente_or_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_artisan_paiement_actif_facture
  ON public.snp_artisan_paiements(facture_id)
  WHERE statut NOT IN ('annule','echec');
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_artisan_tax_payment_type
  ON public.snp_artisan_taxes_retenues(paiement_id,type_taxe);
CREATE INDEX IF NOT EXISTS idx_snp_artisan_paiements_scope_status
  ON public.snp_artisan_paiements(comptoir_organization_id,statut,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_snp_artisan_taxes_scope_status_version
  ON public.snp_artisan_taxes_retenues(comptoir_organization_id,statut_reversement,version);

-- --------------------------------------------------------------------------
-- 3. Ledger d'idempotence non exposé.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snp_artisan_finance_operation_ledger(
  idempotency_key uuid PRIMARY KEY,
  operation text NOT NULL CHECK(operation IN(
    'invoice.issue','payment.create','payment.transition','tax.transition'
  )),
  aggregate_id uuid NOT NULL,
  comptoir_organization_id uuid,
  request_fingerprint text NOT NULL CHECK(length(request_fingerprint)=64),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  capability_code text NOT NULL,
  response jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snp_artisan_finance_ledger_aggregate
  ON public.snp_artisan_finance_operation_ledger(operation,aggregate_id,created_at DESC);
ALTER TABLE public.snp_artisan_finance_operation_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_artisan_finance_operation_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.snp_artisan_finance_operation_ledger FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.snp_4i_idempotency_reserve(
  p_idempotency_key uuid,p_operation text,p_aggregate_id uuid,
  p_comptoir_id uuid,p_request jsonb,p_capability text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_actor uuid:=auth.uid();
  v_hash text:=encode(extensions.digest(convert_to(p_request::text,'UTF8'),'sha256'),'hex');
  v_row public.snp_artisan_finance_operation_ledger%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_idempotency_key IS NULL OR p_aggregate_id IS NULL THEN
    RAISE EXCEPTION 'Acteur, agrégat et clé idempotente sont obligatoires.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.snp_artisan_finance_operation_ledger(
    idempotency_key,operation,aggregate_id,comptoir_organization_id,
    request_fingerprint,actor_id,capability_code
  ) VALUES(
    p_idempotency_key,p_operation,p_aggregate_id,p_comptoir_id,
    v_hash,v_actor,p_capability
  ) ON CONFLICT(idempotency_key) DO NOTHING;

  SELECT * INTO v_row FROM public.snp_artisan_finance_operation_ledger
  WHERE idempotency_key=p_idempotency_key FOR UPDATE;
  IF v_row.operation IS DISTINCT FROM p_operation
     OR v_row.aggregate_id IS DISTINCT FROM p_aggregate_id
     OR v_row.request_fingerprint IS DISTINCT FROM v_hash
     OR v_row.actor_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Clé idempotente déjà utilisée avec une autre requête.' USING ERRCODE='23505';
  END IF;
  RETURN v_row.response;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_4i_idempotency_complete(
  p_idempotency_key uuid,p_response jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  UPDATE public.snp_artisan_finance_operation_ledger
  SET response=p_response,completed_at=now()
  WHERE idempotency_key=p_idempotency_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation idempotente introuvable.' USING ERRCODE='P0002';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_4i_idempotency_reserve(uuid,text,uuid,uuid,jsonb,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_4i_idempotency_complete(uuid,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

-- --------------------------------------------------------------------------
-- 4. Helpers d'autorisation et gardes RPC-only.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_4i_capability_for_scope(
  p_comptoir_id uuid,p_comptoir_capability text,p_sonasp_capability text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v_capability text;
BEGIN
  IF p_comptoir_id IS NOT NULL THEN
    IF public.snp_current_organization_type() IS DISTINCT FROM 'comptoir'
       OR public.snp_current_organization_id() IS DISTINCT FROM p_comptoir_id THEN
      RAISE EXCEPTION 'Opération hors du comptoir connecté.' USING ERRCODE='42501';
    END IF;
    v_capability:=p_comptoir_capability;
  ELSE
    v_capability:=p_sonasp_capability;
  END IF;
  PERFORM public.snp_require_capability(v_capability);
  RETURN v_capability;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_4i_can_read_finance_scope(
  p_artisan_id uuid,p_comptoir_id uuid
)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT auth.uid() IS NOT NULL AND (
    (
      p_comptoir_id IS NOT NULL
      AND p_comptoir_id=public.snp_current_organization_id()
      AND public.snp_current_organization_type()='comptoir'
      AND (
        public.snp_can_access_artisan(p_artisan_id)
        OR public.snp_actor_has_capability('comptoir.invoices.issue')
        OR public.snp_actor_has_capability('comptoir.payments.execute')
        OR public.snp_actor_has_capability('comptoir.payments.reconcile')
        OR public.snp_actor_has_capability('comptoir.tax.execute')
      )
    )
    OR (
      p_comptoir_id IS NULL AND (
        public.snp_actor_has_capability('sonasp.prepare')
        OR public.snp_actor_has_capability('sonasp.finance.execute')
        OR public.snp_actor_has_capability('sonasp.finance.reconcile')
        OR public.snp_actor_has_capability('sonasp.tax.reconcile')
      )
    )
    OR public.snp_actor_has_capability('collectors.manage')
    OR public.snp_actor_has_capability('sonasp.tax.reconcile')
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_4i_require_trusted_mutation()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','pg_temp' AS $fn$
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'Mutation directe interdite : utilisez la RPC artisanale dédiée.'
      USING ERRCODE='42501';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_4i_capability_for_scope(uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_4i_can_read_finance_scope(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
-- Le prédicat est référencé par des policies TO authenticated. PostgreSQL
-- vérifie aussi EXECUTE sur une fonction SECURITY DEFINER appelée par RLS ;
-- l'appel direct ne renvoie qu'un booléen lié au JWT courant.
GRANT EXECUTE ON FUNCTION public.snp_4i_can_read_finance_scope(uuid,uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.snp_4i_require_trusted_mutation()
  FROM PUBLIC,anon,authenticated,service_role;

-- Remplace la garde historique : tout ancien DML, même s'il reçoit par erreur
-- un grant, est fermé ; les invariants sont désormais dans les RPC 4I.
CREATE OR REPLACE FUNCTION public.snp_guard_artisan_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  IF current_setting('sonasp.artisan_finance_rpc',true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Utilisez les RPC atomiques de paiement artisan.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_guard_artisan_payment()
  FROM PUBLIC,anon,authenticated,service_role;

-- Les achats SONASP historiques n'alimentent pas le stock d'un comptoir.
-- Les taxes directes sont créées par la RPC 4I après la transition complète.
CREATE OR REPLACE FUNCTION public.snp_finalize_comptoir_purchase()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_facture public.snp_artisan_factures_definitives%ROWTYPE;
  v_vente public.snp_artisan_ventes_or%ROWTYPE;
BEGIN
  IF NEW.statut IS DISTINCT FROM 'complete'
     OR (TG_OP='UPDATE' AND OLD.statut IS NOT DISTINCT FROM 'complete')
     OR NEW.comptoir_organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT v_facture FROM public.snp_artisan_factures_definitives WHERE id=NEW.facture_id;
  SELECT * INTO STRICT v_vente FROM public.snp_artisan_ventes_or WHERE id=NEW.vente_or_id;
  IF v_facture.certification_dgi_status IS DISTINCT FROM 'certified'
     OR length(trim(coalesce(NEW.preuve_paiement_url,'')))<5 THEN
    RAISE EXCEPTION 'Certification DGI et preuve canonique requises.' USING ERRCODE='23514';
  END IF;
  IF NEW.comptoir_organization_id IS DISTINCT FROM v_facture.comptoir_organization_id
     OR NEW.comptoir_organization_id IS DISTINCT FROM v_vente.comptoir_organization_id THEN
    RAISE EXCEPTION 'Achat, facture et paiement ne partagent pas le même comptoir.' USING ERRCODE='23503';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.comptoir_organization_id::text,0));
  INSERT INTO public.snp_artisanal_stock_ledger(
    organization_id,artisan_id,direction,quantity_grams,movement_type,
    business_reference,idempotency_key,source_type,source_id,reason,created_by
  ) VALUES(
    NEW.comptoir_organization_id,NEW.artisan_id,'in',v_vente.quantite_grammes,'purchase',
    coalesce(v_vente.numero_recu,v_vente.reference_vente,v_vente.id::text),
    'artisan-payment:'||NEW.id::text,'snp_artisan_paiements',NEW.id,
    'Entrée après facture DGI certifiée et paiement finalisé',auth.uid()
  ) ON CONFLICT(organization_id,idempotency_key) DO NOTHING;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_finalize_comptoir_purchase()
  FROM PUBLIC,anon,authenticated,service_role;

-- --------------------------------------------------------------------------
-- 5. Émission atomique d'une facture à partir de la vente verrouillée.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_artisan_emettre_facture(
  p_vente_id uuid,
  p_expected_vente_statut text,
  p_expected_vente_version bigint,
  p_idempotency_key uuid,
  p_date_echeance timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_vente public.snp_artisan_ventes_or%ROWTYPE;
  v_facture public.snp_artisan_factures_definitives%ROWTYPE;
  v_policy public.snp_artisan_tax_policies%ROWTYPE;
  v_capability text;
  v_replay jsonb;
  v_result jsonb;
  v_numero text;
  v_brut numeric;
  v_tva numeric;
  v_retenue numeric;
  v_autres numeric;
  v_total_taxes numeric;
  v_net numeric;
BEGIN
  IF p_vente_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_vente_statut IS NULL OR p_expected_vente_version IS NULL THEN
    RAISE EXCEPTION 'Vente, état/version attendus et idempotence sont obligatoires.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_vente FROM public.snp_artisan_ventes_or WHERE id=p_vente_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente artisanale introuvable.' USING ERRCODE='P0002'; END IF;
  v_capability:=public.snp_4i_capability_for_scope(
    v_vente.comptoir_organization_id,'comptoir.invoices.issue','sonasp.prepare'
  );

  v_replay:=public.snp_4i_idempotency_reserve(
    p_idempotency_key,'invoice.issue',p_vente_id,v_vente.comptoir_organization_id,
    jsonb_build_object(
      'sale_id',p_vente_id,'expected_status',p_expected_vente_statut,
      'expected_version',p_expected_vente_version,
      'due_at',p_date_echeance,'notes',nullif(trim(p_notes),'')
    ),v_capability
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay||jsonb_build_object('replayed',true);
  END IF;

  SELECT * INTO v_vente FROM public.snp_artisan_ventes_or
  WHERE id=p_vente_id FOR UPDATE;
  IF v_vente.statut IS DISTINCT FROM p_expected_vente_statut
     OR v_vente.version IS DISTINCT FROM p_expected_vente_version THEN
    RAISE EXCEPTION 'Conflit vente : état/version attendus %/%, courants %/%.',
      p_expected_vente_statut,p_expected_vente_version,v_vente.statut,v_vente.version
      USING ERRCODE='40001';
  END IF;
  IF v_vente.statut IS DISTINCT FROM 'validee'
     OR v_vente.statut_paiement NOT IN ('non_paye','en_attente_facture') THEN
    RAISE EXCEPTION 'La vente validée doit attendre sa facture.' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.snp_artisan_factures_definitives WHERE vente_or_id=p_vente_id) THEN
    RAISE EXCEPTION 'Une facture définitive existe déjà pour cette vente.' USING ERRCODE='23505';
  END IF;
  IF v_vente.montant_brut_fcfa IS NULL OR v_vente.montant_brut_fcfa<=0 THEN
    RAISE EXCEPTION 'Le montant brut serveur de la vente est invalide.' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_policy FROM public.snp_artisan_tax_policies
  WHERE v_vente.date_vente>=effective_from
    AND (effective_until IS NULL OR v_vente.date_vente<=effective_until)
  ORDER BY effective_from DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune politique fiscale ne couvre la date de vente.' USING ERRCODE='P0002';
  END IF;

  v_brut:=round(v_vente.montant_brut_fcfa,2);
  v_tva:=round(v_brut*v_policy.vat_rate/100,2);
  v_retenue:=round(v_brut*v_policy.withholding_rate/100,2);
  v_autres:=round(v_brut*v_policy.community_rate/100,2);
  v_total_taxes:=v_tva+v_retenue+v_autres;
  -- Le net vendeur suit le contrat 20260820_009 : seule la retenue à la
  -- source est déduite du prix HT ; TVA et taxe communale sont comptabilisées.
  v_net:=v_brut-v_retenue;

  IF v_net<=0 OR v_total_taxes<0 THEN
    RAISE EXCEPTION 'Le calcul fiscal serveur produit un montant invalide.' USING ERRCODE='23514';
  END IF;

  v_numero:=format(
    'FA-ART-%s-%s',to_char(current_date,'YYYY'),
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
  );

  PERFORM set_config('sonasp.artisan_finance_rpc','1',true);
  BEGIN
    INSERT INTO public.snp_artisan_factures_definitives(
      numero_facture,vente_or_id,artisan_id,montant_brut,
      montant_taxe_tva,montant_taxe_retenue_source,montant_autres_taxes,
      montant_total_taxes,montant_net_a_payer,taux_tva,taux_retenue_source,
      date_emission,date_echeance,statut,notes,emise_par,
      comptoir_organization_id,tax_policy_id,version
    ) VALUES(
      v_numero,v_vente.id,v_vente.artisan_id,v_brut,
      v_tva,v_retenue,v_autres,v_total_taxes,v_net,
      v_policy.vat_rate,v_policy.withholding_rate,now(),
      coalesce(p_date_echeance,now()+interval '15 days'),'emise',
      nullif(trim(p_notes),''),auth.uid(),v_vente.comptoir_organization_id,
      v_policy.id,0
    ) RETURNING * INTO v_facture;

    UPDATE public.snp_artisan_ventes_or
    SET facture_definitive_id=v_facture.id,
        statut_paiement='facture_emise',
        version=version+1,updated_by=auth.uid(),updated_at=now()
    WHERE id=v_vente.id RETURNING * INTO v_vente;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.artisan_finance_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.artisan_finance_rpc','0',true);

  v_result:=jsonb_build_object(
    'invoice_id',v_facture.id,'sale_id',v_vente.id,
    'invoice_number',v_facture.numero_facture,
    'invoice_status',v_facture.statut,'invoice_version',v_facture.version,
    'sale_status',v_vente.statut,'sale_payment_status',v_vente.statut_paiement,
    'sale_version',v_vente.version,'gross_amount',v_facture.montant_brut,
    'vat_amount',v_facture.montant_taxe_tva,
    'withholding_amount',v_facture.montant_taxe_retenue_source,
    'other_tax_amount',v_facture.montant_autres_taxes,
    'total_taxes',v_facture.montant_total_taxes,
    'net_payable',v_facture.montant_net_a_payer,
    'tax_policy_version',v_policy.policy_code,
    'idempotency_key',p_idempotency_key,'replayed',false,'processed_at',now()
  );
  PERFORM public.snp_record_workflow_event(
    'artisan-invoice',v_facture.id,'issued',NULL,'emise',v_capability,p_notes,
    jsonb_build_object('sale_id',v_vente.id,'tax_policy',v_policy.policy_code,
                       'idempotency_key',p_idempotency_key)
  );
  PERFORM public.snp_4i_idempotency_complete(p_idempotency_key,v_result);
  RETURN v_result;
END;
$fn$;

-- --------------------------------------------------------------------------
-- 6. Création atomique du paiement depuis facture + moyen vérifié.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_artisan_creer_paiement(
  p_facture_id uuid,
  p_expected_facture_statut text,
  p_expected_facture_version bigint,
  p_moyen_paiement_id uuid,
  p_idempotency_key uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_facture public.snp_artisan_factures_definitives%ROWTYPE;
  v_vente public.snp_artisan_ventes_or%ROWTYPE;
  v_moyen public.snp_artisan_moyens_paiement%ROWTYPE;
  v_paiement public.snp_artisan_paiements%ROWTYPE;
  v_capability text;
  v_type text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  IF p_facture_id IS NULL OR p_moyen_paiement_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_facture_statut IS NULL OR p_expected_facture_version IS NULL THEN
    RAISE EXCEPTION 'Facture, moyen, état/version attendus et idempotence sont obligatoires.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_facture FROM public.snp_artisan_factures_definitives WHERE id=p_facture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facture artisanale introuvable.' USING ERRCODE='P0002'; END IF;
  v_capability:=public.snp_4i_capability_for_scope(
    v_facture.comptoir_organization_id,'comptoir.payments.execute','sonasp.finance.execute'
  );
  v_replay:=public.snp_4i_idempotency_reserve(
    p_idempotency_key,'payment.create',p_facture_id,v_facture.comptoir_organization_id,
    jsonb_build_object(
      'invoice_id',p_facture_id,'expected_status',p_expected_facture_statut,
      'expected_version',p_expected_facture_version,
      'payment_method_id',p_moyen_paiement_id,'notes',nullif(trim(p_notes),'')
    ),v_capability
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay||jsonb_build_object('replayed',true);
  END IF;

  SELECT * INTO v_facture FROM public.snp_artisan_factures_definitives
  WHERE id=p_facture_id FOR UPDATE;
  SELECT * INTO v_vente FROM public.snp_artisan_ventes_or
  WHERE id=v_facture.vente_or_id FOR UPDATE;
  IF v_facture.statut IS DISTINCT FROM p_expected_facture_statut
     OR v_facture.version IS DISTINCT FROM p_expected_facture_version THEN
    RAISE EXCEPTION 'Conflit facture : état/version attendus %/%, courants %/%.',
      p_expected_facture_statut,p_expected_facture_version,v_facture.statut,v_facture.version
      USING ERRCODE='40001';
  END IF;
  IF v_facture.statut IS DISTINCT FROM 'emise'
     OR v_facture.certification_dgi_status IS DISTINCT FROM 'certified' THEN
    RAISE EXCEPTION 'Une facture émise et certifiée DGI est requise.' USING ERRCODE='23514';
  END IF;
  IF v_vente.id IS NULL
     OR v_facture.artisan_id IS DISTINCT FROM v_vente.artisan_id
     OR v_facture.comptoir_organization_id IS DISTINCT FROM v_vente.comptoir_organization_id
     OR v_vente.facture_definitive_id IS DISTINCT FROM v_facture.id THEN
    RAISE EXCEPTION 'Facture et vente ne partagent pas leur parent/tenant.' USING ERRCODE='23503';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.snp_artisan_paiements
    WHERE facture_id=p_facture_id AND statut NOT IN('annule','echec')
  ) THEN
    RAISE EXCEPTION 'Un paiement actif existe déjà pour cette facture.' USING ERRCODE='23505';
  END IF;

  SELECT * INTO v_moyen FROM public.snp_artisan_moyens_paiement
  WHERE id=p_moyen_paiement_id FOR SHARE;
  IF NOT FOUND OR v_moyen.artisan_id IS DISTINCT FROM v_facture.artisan_id THEN
    RAISE EXCEPTION 'Moyen de paiement absent du dossier artisan.' USING ERRCODE='23514';
  END IF;
  IF NOT v_moyen.actif OR v_moyen.verifie_le IS NULL THEN
    RAISE EXCEPTION 'Le moyen de paiement doit être actif et vérifié.' USING ERRCODE='23514';
  END IF;
  v_type:=CASE v_moyen.type WHEN 'especes' THEN 'cash' ELSE v_moyen.type END;
  IF v_type NOT IN(
    'virement_bancaire','cash','orange_money','mobile_money',
    'moov_money','wave','cheque'
  ) THEN
    RAISE EXCEPTION 'Type de paiement non supporté : %.',v_moyen.type USING ERRCODE='22023';
  END IF;

  PERFORM set_config('sonasp.artisan_finance_rpc','1',true);
  BEGIN
    INSERT INTO public.snp_artisan_paiements(
      reference_paiement,facture_id,vente_or_id,artisan_id,
      moyen_paiement_id,numero_facture,type_paiement,montant_paye,
      montant_taxes_retenues,details_paiement,statut,date_paiement,
      traite_par,notes,comptoir_organization_id,version
    ) VALUES(
      format('PA-ART-%s-%s',to_char(current_date,'YYYYMMDD'),
             upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
      v_facture.id,v_vente.id,v_facture.artisan_id,v_moyen.id,
      v_facture.numero_facture,v_type,v_facture.montant_net_a_payer,
      v_facture.montant_total_taxes,public.snp_4b_payment_snapshot(v_moyen),
      'en_attente',now(),auth.uid(),nullif(trim(p_notes),''),
      v_facture.comptoir_organization_id,0
    ) RETURNING * INTO v_paiement;

    UPDATE public.snp_artisan_factures_definitives
    SET statut='en_paiement',version=version+1,updated_at=now()
    WHERE id=v_facture.id RETURNING * INTO v_facture;
    UPDATE public.snp_artisan_ventes_or
    SET statut_paiement='en_paiement',version=version+1,
        updated_by=auth.uid(),updated_at=now()
    WHERE id=v_vente.id RETURNING * INTO v_vente;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.artisan_finance_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.artisan_finance_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_paiement.id,'invoice_id',v_facture.id,'sale_id',v_vente.id,
    'artisan_id',v_paiement.artisan_id,'payment_reference',v_paiement.reference_paiement,
    'payment_status',v_paiement.statut,'payment_version',v_paiement.version,
    'invoice_status',v_facture.statut,'invoice_version',v_facture.version,
    'sale_status',v_vente.statut,'sale_payment_status',v_vente.statut_paiement,
    'sale_version',v_vente.version,'amount_paid',v_paiement.montant_paye,
    'taxes_withheld',v_paiement.montant_taxes_retenues,
    'payment_method_id',v_paiement.moyen_paiement_id,'payment_type',v_paiement.type_paiement,
    'idempotency_key',p_idempotency_key,'replayed',false,'processed_at',now()
  );
  PERFORM public.snp_record_workflow_event(
    'artisan-payment',v_paiement.id,'created',NULL,'en_attente',v_capability,p_notes,
    jsonb_build_object('invoice_id',v_facture.id,'sale_id',v_vente.id,
                       'idempotency_key',p_idempotency_key)
  );
  PERFORM public.snp_4i_idempotency_complete(p_idempotency_key,v_result);
  RETURN v_result;
END;
$fn$;

-- --------------------------------------------------------------------------
-- 7. Transition paiement : optimistic locking + SoD + parents atomiques.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_artisan_transition_paiement(
  p_paiement_id uuid,
  p_expected_statut text,
  p_expected_version bigint,
  p_nouveau_statut text,
  p_idempotency_key uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_paiement public.snp_artisan_paiements%ROWTYPE;
  v_facture public.snp_artisan_factures_definitives%ROWTYPE;
  v_vente public.snp_artisan_ventes_or%ROWTYPE;
  v_capability text;
  v_comptoir_capability text;
  v_sonasp_capability text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  IF p_paiement_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_statut IS NULL OR p_expected_version IS NULL
     OR p_nouveau_statut IS NULL THEN
    RAISE EXCEPTION 'Paiement, transition/version et idempotence sont obligatoires.' USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut='valide' THEN
    v_comptoir_capability:='comptoir.payments.reconcile';
    v_sonasp_capability:='sonasp.finance.reconcile';
  ELSE
    v_comptoir_capability:='comptoir.payments.execute';
    v_sonasp_capability:='sonasp.finance.execute';
  END IF;

  SELECT * INTO v_paiement FROM public.snp_artisan_paiements WHERE id=p_paiement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement artisan introuvable.' USING ERRCODE='P0002'; END IF;
  v_capability:=public.snp_4i_capability_for_scope(
    v_paiement.comptoir_organization_id,v_comptoir_capability,v_sonasp_capability
  );
  v_replay:=public.snp_4i_idempotency_reserve(
    p_idempotency_key,'payment.transition',p_paiement_id,
    v_paiement.comptoir_organization_id,
    jsonb_build_object(
      'payment_id',p_paiement_id,'expected_status',p_expected_statut,
      'expected_version',p_expected_version,'new_status',p_nouveau_statut,
      'notes',nullif(trim(p_notes),'')
    ),v_capability
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay||jsonb_build_object('replayed',true);
  END IF;

  SELECT * INTO v_paiement FROM public.snp_artisan_paiements
  WHERE id=p_paiement_id FOR UPDATE;
  SELECT * INTO v_facture FROM public.snp_artisan_factures_definitives
  WHERE id=v_paiement.facture_id FOR UPDATE;
  SELECT * INTO v_vente FROM public.snp_artisan_ventes_or
  WHERE id=v_paiement.vente_or_id FOR UPDATE;
  IF v_paiement.statut IS DISTINCT FROM p_expected_statut
     OR v_paiement.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Conflit paiement : état/version attendus %/%, courants %/%.',
      p_expected_statut,p_expected_version,v_paiement.statut,v_paiement.version
      USING ERRCODE='40001';
  END IF;
  IF NOT (
    (v_paiement.statut='en_attente' AND p_nouveau_statut IN('en_traitement','annule','echec'))
    OR (v_paiement.statut='en_traitement' AND p_nouveau_statut IN('valide','annule','echec'))
    OR (v_paiement.statut='valide' AND p_nouveau_statut IN('complete','annule','echec'))
  ) THEN
    RAISE EXCEPTION 'Transition de paiement interdite : % vers %.',
      v_paiement.statut,p_nouveau_statut USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut IN('annule','echec')
     AND length(trim(coalesce(p_notes,'')))<10 THEN
    RAISE EXCEPTION 'Annulation/échec : motif de dix caractères minimum.' USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut='valide' AND auth.uid()=v_paiement.traite_par THEN
    RAISE EXCEPTION 'Le préparateur ne valide pas son propre paiement.' USING ERRCODE='42501';
  END IF;
  IF p_nouveau_statut='complete' THEN
    IF auth.uid()=v_paiement.valide_par THEN
      RAISE EXCEPTION 'Le validateur ne clôture pas le paiement qu’il a contrôlé.' USING ERRCODE='42501';
    END IF;
    IF v_facture.certification_dgi_status IS DISTINCT FROM 'certified'
       OR length(trim(coalesce(v_paiement.preuve_paiement_url,'')))<5 THEN
      RAISE EXCEPTION 'Certification DGI et preuve de paiement canonique requises.' USING ERRCODE='23514';
    END IF;
  END IF;

  IF v_facture.id IS NULL OR v_vente.id IS NULL
     OR v_facture.vente_or_id IS DISTINCT FROM v_vente.id
     OR v_paiement.artisan_id IS DISTINCT FROM v_facture.artisan_id
     OR v_paiement.comptoir_organization_id IS DISTINCT FROM v_facture.comptoir_organization_id
     OR v_facture.comptoir_organization_id IS DISTINCT FROM v_vente.comptoir_organization_id THEN
    RAISE EXCEPTION 'Paiement, facture et vente divergent sur parent/tenant.' USING ERRCODE='23503';
  END IF;

  PERFORM set_config('sonasp.artisan_finance_rpc','1',true);
  BEGIN
    UPDATE public.snp_artisan_paiements
    SET statut=p_nouveau_statut,version=version+1,
        date_validation=CASE WHEN p_nouveau_statut='valide' THEN now() ELSE date_validation END,
        valide_par=CASE WHEN p_nouveau_statut='valide' THEN auth.uid() ELSE valide_par END,
        date_completion=CASE WHEN p_nouveau_statut='complete' THEN now() ELSE date_completion END,
        completed_by=CASE WHEN p_nouveau_statut='complete' THEN auth.uid() ELSE completed_by END,
        cancelled_by=CASE WHEN p_nouveau_statut='annule' THEN auth.uid() ELSE cancelled_by END,
        failed_by=CASE WHEN p_nouveau_statut='echec' THEN auth.uid() ELSE failed_by END,
        terminal_reason=CASE WHEN p_nouveau_statut IN('annule','echec') THEN trim(p_notes) ELSE terminal_reason END,
        notes=coalesce(nullif(trim(p_notes),''),notes),updated_at=now()
    WHERE id=v_paiement.id RETURNING * INTO v_paiement;

    IF p_nouveau_statut='complete' THEN
      UPDATE public.snp_artisan_factures_definitives
      SET statut='payee',version=version+1,updated_at=now()
      WHERE id=v_facture.id RETURNING * INTO v_facture;
      UPDATE public.snp_artisan_ventes_or
      SET statut='payee',statut_paiement='paye',version=version+1,
          updated_by=auth.uid(),updated_at=now()
      WHERE id=v_vente.id RETURNING * INTO v_vente;

      INSERT INTO public.snp_artisan_taxes_retenues(
        paiement_id,facture_id,vente_or_id,artisan_id,type_taxe,libelle_taxe,
        taux_taxe,montant_taxe,statut_reversement,periode_fiscale,
        exercice_fiscal,comptoir_organization_id,version
      ) SELECT
        v_paiement.id,v_facture.id,v_vente.id,v_paiement.artisan_id,
        tax.code,tax.label,tax.rate,tax.amount,'a_reverser',
        to_char(v_paiement.date_completion,'YYYY-MM'),
        to_char(v_paiement.date_completion,'YYYY'),
        v_paiement.comptoir_organization_id,0
      FROM (VALUES
        ('tva','Taxe sur la valeur ajoutée',coalesce(v_facture.taux_tva,0),coalesce(v_facture.montant_taxe_tva,0)),
        ('retenue_source','Retenue à la source',coalesce(v_facture.taux_retenue_source,0),coalesce(v_facture.montant_taxe_retenue_source,0)),
        ('taxe_municipale','Taxe de développement communal',
          CASE WHEN v_facture.montant_brut>0 THEN round(coalesce(v_facture.montant_autres_taxes,0)*100/v_facture.montant_brut,4) ELSE 0 END,
          coalesce(v_facture.montant_autres_taxes,0))
      ) AS tax(code,label,rate,amount)
      WHERE tax.amount>0
      ON CONFLICT(paiement_id,type_taxe) DO NOTHING;
    ELSIF p_nouveau_statut IN('annule','echec') THEN
      UPDATE public.snp_artisan_factures_definitives
      SET statut='emise',version=version+1,updated_at=now()
      WHERE id=v_facture.id RETURNING * INTO v_facture;
      UPDATE public.snp_artisan_ventes_or
      SET statut='validee',statut_paiement='facture_emise',version=version+1,
          updated_by=auth.uid(),updated_at=now()
      WHERE id=v_vente.id RETURNING * INTO v_vente;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.artisan_finance_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.artisan_finance_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_paiement.id,'invoice_id',v_facture.id,'sale_id',v_vente.id,
    'artisan_id',v_paiement.artisan_id,'payment_reference',v_paiement.reference_paiement,
    'payment_status',v_paiement.statut,'payment_version',v_paiement.version,
    'invoice_status',v_facture.statut,'invoice_version',v_facture.version,
    'sale_status',v_vente.statut,'sale_payment_status',v_vente.statut_paiement,
    'sale_version',v_vente.version,'amount_paid',v_paiement.montant_paye,
    'taxes_withheld',v_paiement.montant_taxes_retenues,
    'payment_method_id',v_paiement.moyen_paiement_id,'payment_type',v_paiement.type_paiement,
    'idempotency_key',p_idempotency_key,'replayed',false,'processed_at',now()
  );
  PERFORM public.snp_record_workflow_event(
    'artisan-payment',v_paiement.id,'status-changed',p_expected_statut,p_nouveau_statut,
    v_capability,p_notes,jsonb_build_object('invoice_id',v_facture.id,'sale_id',v_vente.id,
                                            'idempotency_key',p_idempotency_key)
  );
  PERFORM public.snp_4i_idempotency_complete(p_idempotency_key,v_result);
  RETURN v_result;
END;
$fn$;

-- --------------------------------------------------------------------------
-- 8. Reversement fiscal : exécution comptoir puis rapprochement SONASP.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_artisan_transition_reversement_taxe(
  p_taxe_id uuid,
  p_expected_statut text,
  p_expected_version bigint,
  p_nouveau_statut text,
  p_idempotency_key uuid,
  p_reversement_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_taxe public.snp_artisan_taxes_retenues%ROWTYPE;
  v_capability text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  IF p_taxe_id IS NULL OR p_idempotency_key IS NULL OR p_expected_statut IS NULL
     OR p_expected_version IS NULL OR p_nouveau_statut IS NULL THEN
    RAISE EXCEPTION 'Taxe, transition/version et idempotence sont obligatoires.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_taxe FROM public.snp_artisan_taxes_retenues WHERE id=p_taxe_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Écriture fiscale introuvable.' USING ERRCODE='P0002'; END IF;

  IF p_nouveau_statut='comptabilise' THEN
    PERFORM public.snp_require_capability('sonasp.tax.reconcile');
    v_capability:='sonasp.tax.reconcile';
  ELSE
    v_capability:=public.snp_4i_capability_for_scope(
      v_taxe.comptoir_organization_id,'comptoir.tax.execute','sonasp.finance.execute'
    );
  END IF;
  v_replay:=public.snp_4i_idempotency_reserve(
    p_idempotency_key,'tax.transition',p_taxe_id,v_taxe.comptoir_organization_id,
    jsonb_build_object(
      'tax_id',p_taxe_id,'expected_status',p_expected_statut,
      'expected_version',p_expected_version,'new_status',p_nouveau_statut,
      'reference',nullif(trim(p_reversement_reference),''),
      'notes',nullif(trim(p_notes),'')
    ),v_capability
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay||jsonb_build_object('replayed',true);
  END IF;

  SELECT * INTO v_taxe FROM public.snp_artisan_taxes_retenues
  WHERE id=p_taxe_id FOR UPDATE;
  IF v_taxe.statut_reversement IS DISTINCT FROM p_expected_statut
     OR v_taxe.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Conflit taxe : état/version attendus %/%, courants %/%.',
      p_expected_statut,p_expected_version,v_taxe.statut_reversement,v_taxe.version
      USING ERRCODE='40001';
  END IF;
  IF NOT (
    (v_taxe.statut_reversement='a_reverser' AND p_nouveau_statut='en_cours')
    OR (v_taxe.statut_reversement='en_cours' AND p_nouveau_statut='reverse')
    OR (v_taxe.statut_reversement='reverse' AND p_nouveau_statut='comptabilise')
  ) THEN
    RAISE EXCEPTION 'Transition fiscale interdite : % vers %.',
      v_taxe.statut_reversement,p_nouveau_statut USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut='reverse'
     AND length(trim(coalesce(p_reversement_reference,'')))<5 THEN
    RAISE EXCEPTION 'Le reversement exige une référence externe.' USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut='comptabilise' AND auth.uid()=v_taxe.reversed_by THEN
    RAISE EXCEPTION 'L’exécuteur ne comptabilise pas son propre reversement.' USING ERRCODE='42501';
  END IF;

  UPDATE public.snp_artisan_taxes_retenues
  SET statut_reversement=p_nouveau_statut,version=version+1,
      reversement_started_by=CASE WHEN p_nouveau_statut='en_cours' THEN auth.uid() ELSE reversement_started_by END,
      reversement_started_at=CASE WHEN p_nouveau_statut='en_cours' THEN now() ELSE reversement_started_at END,
      reversed_by=CASE WHEN p_nouveau_statut='reverse' THEN auth.uid() ELSE reversed_by END,
      date_reversement=CASE WHEN p_nouveau_statut='reverse' THEN now() ELSE date_reversement END,
      reversement_reference=CASE WHEN p_nouveau_statut='reverse' THEN trim(p_reversement_reference) ELSE reversement_reference END,
      comptabilise_par=CASE WHEN p_nouveau_statut='comptabilise' THEN auth.uid() ELSE comptabilise_par END,
      comptabilise_at=CASE WHEN p_nouveau_statut='comptabilise' THEN now() ELSE comptabilise_at END,
      updated_at=now()
  WHERE id=v_taxe.id RETURNING * INTO v_taxe;

  v_result:=jsonb_build_object(
    'tax_id',v_taxe.id,'payment_id',v_taxe.paiement_id,
    'invoice_id',v_taxe.facture_id,'sale_id',v_taxe.vente_or_id,
    'tax_type',v_taxe.type_taxe,'tax_status',v_taxe.statut_reversement,
    'tax_version',v_taxe.version,'remittance_reference',v_taxe.reversement_reference,
    'idempotency_key',p_idempotency_key,'replayed',false,'processed_at',now()
  );
  PERFORM public.snp_record_workflow_event(
    'artisan-tax',v_taxe.id,'status-changed',p_expected_statut,p_nouveau_statut,
    v_capability,p_notes,jsonb_build_object('payment_id',v_taxe.paiement_id,
                                            'idempotency_key',p_idempotency_key)
  );
  PERFORM public.snp_4i_idempotency_complete(p_idempotency_key,v_result);
  RETURN v_result;
END;
$fn$;

-- --------------------------------------------------------------------------
-- 9. RLS, grants et mutation RPC-only.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_4i_guard_sale_payment_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','pg_temp' AS $fn$
BEGIN
  IF current_user<>'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP='INSERT' THEN
    NEW.created_by:=auth.uid();
    NEW.updated_by:=auth.uid();
    NEW.statut_paiement:='non_paye';
    NEW.facture_definitive_id:=NULL;
    RETURN NEW;
  END IF;

  IF NEW.artisan_id IS DISTINCT FROM OLD.artisan_id
     OR NEW.comptoir_organization_id IS DISTINCT FROM OLD.comptoir_organization_id
     OR NEW.acheteur_comptoir_organization_id IS DISTINCT FROM OLD.acheteur_comptoir_organization_id
     OR NEW.acheteur_id IS DISTINCT FROM OLD.acheteur_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.statut_paiement IS DISTINCT FROM OLD.statut_paiement
     OR NEW.facture_definitive_id IS DISTINCT FROM OLD.facture_definitive_id
     OR (NEW.statut IS DISTINCT FROM OLD.statut AND (
       OLD.statut<>'en_attente' OR NEW.statut IN('payee','annulee')
     ))
     OR (OLD.statut<>'en_attente' AND ROW(
       NEW.date_vente,NEW.quantite_grammes,NEW.type_or,NEW.purete_karat,
       NEW.prix_kg_fcfa,NEW.montant_brut_fcfa,NEW.tva_taux,
       NEW.tva_montant_fcfa,NEW.taxe_dev_comm_taux,
       NEW.taxe_dev_comm_montant_fcfa,NEW.montant_total_fcfa,
       NEW.numero_recu,NEW.reference_vente
     ) IS DISTINCT FROM ROW(
       OLD.date_vente,OLD.quantite_grammes,OLD.type_or,OLD.purete_karat,
       OLD.prix_kg_fcfa,OLD.montant_brut_fcfa,OLD.tva_taux,
       OLD.tva_montant_fcfa,OLD.taxe_dev_comm_taux,
       OLD.taxe_dev_comm_montant_fcfa,OLD.montant_total_fcfa,
       OLD.numero_recu,OLD.reference_vente
     )) THEN
    RAISE EXCEPTION 'Les champs financiers de la vente sont réservés aux RPC artisanales.'
      USING ERRCODE='42501';
  END IF;
  NEW.updated_by:=auth.uid();
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_4i_guard_sale_payment_fields()
  FROM PUBLIC,anon,authenticated,service_role;

DROP TRIGGER IF EXISTS snp_4i_sale_payment_fields ON public.snp_artisan_ventes_or;
CREATE TRIGGER snp_4i_sale_payment_fields
BEFORE INSERT OR UPDATE
ON public.snp_artisan_ventes_or
FOR EACH ROW EXECUTE FUNCTION public.snp_4i_guard_sale_payment_fields();

DO $rpc_only$
DECLARE v_table text; v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'snp_artisan_factures_definitives','snp_artisan_paiements','snp_artisan_taxes_retenues'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',v_table);
    FOR v_policy IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_policy.policyname,v_table);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS snp_4i_rpc_only ON public.%I',v_table);
    EXECUTE format(
      'CREATE TRIGGER snp_4i_rpc_only BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
      ||'FOR EACH ROW EXECUTE FUNCTION public.snp_4i_require_trusted_mutation()',v_table
    );
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC,anon,authenticated',v_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',v_table);
  END LOOP;
END;
$rpc_only$;

ALTER TABLE public.snp_artisan_ventes_or ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_artisan_ventes_or FORCE ROW LEVEL SECURITY;

DO $sale_policies$
DECLARE v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='snp_artisan_ventes_or'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.snp_artisan_ventes_or',v_policy.policyname);
  END LOOP;
END;
$sale_policies$;
CREATE POLICY snp_4i_sales_select ON public.snp_artisan_ventes_or
FOR SELECT TO authenticated USING(
  public.snp_4i_can_read_finance_scope(artisan_id,comptoir_organization_id)
  OR public.snp_can_access_artisan(artisan_id)
);
CREATE POLICY snp_4i_sales_insert ON public.snp_artisan_ventes_or
FOR INSERT TO authenticated WITH CHECK(
  public.snp_can_access_artisan(artisan_id)
  AND (
    comptoir_organization_id=public.snp_current_organization_id()
    OR (comptoir_organization_id IS NULL AND public.snp_actor_has_capability('collectors.manage'))
  )
);
CREATE POLICY snp_4i_sales_update ON public.snp_artisan_ventes_or
FOR UPDATE TO authenticated
USING(public.snp_can_access_artisan(artisan_id))
WITH CHECK(
  public.snp_can_access_artisan(artisan_id)
  AND (
    comptoir_organization_id=public.snp_current_organization_id()
    OR (comptoir_organization_id IS NULL AND public.snp_actor_has_capability('collectors.manage'))
  )
);
CREATE POLICY snp_4i_sales_delete ON public.snp_artisan_ventes_or
FOR DELETE TO authenticated USING(
  statut='en_attente' AND public.snp_can_access_artisan(artisan_id)
);

CREATE POLICY snp_4i_invoices_select ON public.snp_artisan_factures_definitives
FOR SELECT TO authenticated USING(
  public.snp_4i_can_read_finance_scope(artisan_id,comptoir_organization_id)
);
CREATE POLICY snp_4i_payments_select ON public.snp_artisan_paiements
FOR SELECT TO authenticated USING(
  public.snp_4i_can_read_finance_scope(artisan_id,comptoir_organization_id)
);
CREATE POLICY snp_4i_taxes_select ON public.snp_artisan_taxes_retenues
FOR SELECT TO authenticated USING(
  public.snp_4i_can_read_finance_scope(artisan_id,comptoir_organization_id)
);

-- Les vues historiques deviennent explicitement SECURITY INVOKER ; elles ne
-- réintroduisent donc pas une lecture globale au-dessus des nouvelles policies.
CREATE OR REPLACE VIEW public.v_artisan_paiements_resume
WITH (security_invoker=true,security_barrier=true) AS
SELECT
  a.id AS artisan_id,a.nom,a.prenoms,a.numero_carte,
  count(DISTINCT v.id) AS nombre_ventes,
  count(DISTINCT p.id) AS nombre_paiements,
  coalesce(sum(f.montant_brut),0) AS total_brut,
  coalesce(sum(f.montant_total_taxes),0) AS total_taxes,
  coalesce(sum(f.montant_net_a_payer),0) AS total_net,
  coalesce(sum(CASE WHEN p.statut='complete' THEN p.montant_paye ELSE 0 END),0) AS total_paye,
  coalesce(sum(CASE WHEN v.statut_paiement='paye' THEN 0 ELSE f.montant_net_a_payer END),0) AS solde_du
FROM public.snp_artisans_miniers a
LEFT JOIN public.snp_artisan_ventes_or v ON v.artisan_id=a.id
LEFT JOIN public.snp_artisan_factures_definitives f ON f.vente_or_id=v.id
LEFT JOIN public.snp_artisan_paiements p ON p.vente_or_id=v.id
WHERE a.actif=true
GROUP BY a.id,a.nom,a.prenoms,a.numero_carte;

CREATE OR REPLACE VIEW public.v_taxes_a_reverser
WITH (security_invoker=true,security_barrier=true) AS
SELECT
  t.type_taxe,t.libelle_taxe,t.periode_fiscale,t.exercice_fiscal,
  count(*) AS nombre_transactions,sum(t.montant_taxe) AS montant_total,
  t.statut_reversement
FROM public.snp_artisan_taxes_retenues t
GROUP BY t.type_taxe,t.libelle_taxe,t.periode_fiscale,t.exercice_fiscal,t.statut_reversement;

CREATE OR REPLACE VIEW public.v_paiements_en_attente
WITH (security_invoker=true,security_barrier=true) AS
SELECT
  v.id AS vente_id,v.reference_vente,v.date_vente,a.id AS artisan_id,
  a.nom||' '||a.prenoms AS artisan_nom_complet,a.numero_carte,a.telephone,
  f.id AS facture_id,f.numero_facture,f.montant_net_a_payer,
  f.date_emission AS date_facture,v.statut_paiement,
  current_date-f.date_emission::date AS jours_attente
FROM public.snp_artisan_ventes_or v
JOIN public.snp_artisans_miniers a ON a.id=v.artisan_id
LEFT JOIN public.snp_artisan_factures_definitives f ON f.vente_or_id=v.id
WHERE v.statut_validation='validee'
  AND (v.statut_paiement IS NULL OR v.statut_paiement IN('non_paye','facture_emise','en_paiement'));

REVOKE ALL ON TABLE public.v_artisan_paiements_resume,
  public.v_taxes_a_reverser,public.v_paiements_en_attente FROM PUBLIC,anon;
GRANT SELECT ON TABLE public.v_artisan_paiements_resume,
  public.v_taxes_a_reverser,public.v_paiements_en_attente TO authenticated;

-- Retire les primitives historiques qui généraient références/taxes côté
-- navigateur et la certification DGI manuelle non raccordée.
DO $legacy_revoke$
BEGIN
  IF to_regprocedure('public.generer_numero_facture()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.generer_numero_facture() FROM PUBLIC,anon,authenticated;
  END IF;
  IF to_regprocedure('public.generer_reference_paiement()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.generer_reference_paiement() FROM PUBLIC,anon,authenticated;
  END IF;
  IF to_regprocedure('public.calculer_taxes_vente(numeric,numeric,numeric)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.calculer_taxes_vente(numeric,numeric,numeric)
      FROM PUBLIC,anon,authenticated;
  END IF;
  IF to_regprocedure('public.snp_certify_artisan_invoice(uuid,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.snp_certify_artisan_invoice(uuid,text,text)
      FROM PUBLIC,anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION public.snp_certify_artisan_invoice(uuid,text,text)
      TO service_role;
  END IF;
END;
$legacy_revoke$;

REVOKE ALL ON FUNCTION public.snp_artisan_emettre_facture(uuid,text,bigint,uuid,timestamptz,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_artisan_creer_paiement(uuid,text,bigint,uuid,uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_artisan_transition_paiement(uuid,text,bigint,text,uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_artisan_transition_reversement_taxe(uuid,text,bigint,text,uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_artisan_emettre_facture(uuid,text,bigint,uuid,timestamptz,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_artisan_creer_paiement(uuid,text,bigint,uuid,uuid,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_artisan_transition_paiement(uuid,text,bigint,text,uuid,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_artisan_transition_reversement_taxe(uuid,text,bigint,text,uuid,text,text)
  TO authenticated;

COMMENT ON FUNCTION public.snp_artisan_emettre_facture(uuid,text,bigint,uuid,timestamptz,text) IS
  'Émet facture+transition vente atomiquement, taxes issues de la politique serveur 2026.';
COMMENT ON FUNCTION public.snp_artisan_creer_paiement(uuid,text,bigint,uuid,uuid,text) IS
  'Crée un paiement depuis facture DGI certifiée et moyen artisan vérifié, sans montant/acteur client.';
COMMENT ON FUNCTION public.snp_artisan_transition_paiement(uuid,text,bigint,text,uuid,text) IS
  'Transition paiement versionnée et idempotente avec double contrôle et parents atomiques.';
COMMENT ON FUNCTION public.snp_artisan_transition_reversement_taxe(uuid,text,bigint,text,uuid,text,text) IS
  'Reversement fiscal versionné : exécution comptoir, comptabilisation SONASP séparée.';

-- --------------------------------------------------------------------------
-- 10. Postflight et rollback non destructif.
-- --------------------------------------------------------------------------
DO $postflight$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'snp_artisan_ventes_or','snp_artisan_factures_definitives',
    'snp_artisan_paiements','snp_artisan_taxes_retenues'
  ] LOOP
    IF NOT EXISTS(
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_table
        AND c.relrowsecurity AND c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'Postflight 4I : RLS/FORCE RLS absent sur %.',v_table;
    END IF;
  END LOOP;
  IF EXISTS(
    SELECT 1 FROM (VALUES
      ('snp_artisan_factures_definitives'),('snp_artisan_paiements'),
      ('snp_artisan_taxes_retenues')
    ) t(name)
    WHERE has_table_privilege('authenticated','public.'||t.name,'INSERT')
       OR has_table_privilege('authenticated','public.'||t.name,'UPDATE')
       OR has_table_privilege('authenticated','public.'||t.name,'DELETE')
  ) THEN
    RAISE EXCEPTION 'Postflight 4I : un DML direct financier reste accordé.';
  END IF;
END;
$postflight$;

-- Rollback non destructif documenté :
--   1. révoquer EXECUTE sur les quatre RPC 4I et conserver tables/audit/ledger ;
--   2. désactiver les parcours frontend concernés (fail-closed) ;
--   3. ne pas supprimer versions, acteurs, politique fiscale ou traces ;
--   4. ne restaurer aucun DML direct ni certification DGI navigateur.

COMMIT;
