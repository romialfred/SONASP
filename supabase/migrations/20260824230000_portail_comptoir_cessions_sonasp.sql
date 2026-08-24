-- ============================================================================
-- Portail Comptoir d'Or : achat certifié, fiscalité, stock et cession SONASP
-- ============================================================================
-- Cette migration complète 20260823190000 sans en modifier le contenu. Les
-- règles critiques vivent en base : l'interface ne constitue jamais la barrière
-- d'autorisation.

-- SONASP est l'unique destinataire possible d'une cession de comptoir.
INSERT INTO public.snp_organizations (
  id, code, name, organization_type, mining_company_id, is_active
)
SELECT mc.id, mc.code, mc.name, 'sonasp', mc.id, mc.is_active
FROM public.mining_companies mc
WHERE upper(mc.code) = 'SONASP'
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    name = EXCLUDED.name,
    organization_type = 'sonasp',
    mining_company_id = EXCLUDED.mining_company_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();

ALTER TABLE public.snp_artisan_ventes_or
  ADD COLUMN IF NOT EXISTS acheteur_comptoir_organization_id uuid
    REFERENCES public.snp_organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_snp_artisan_ventes_comptoir_date
  ON public.snp_artisan_ventes_or(comptoir_organization_id, date_vente DESC);

-- Une opération artisanale enregistrée dans un comptoir est un achat du
-- comptoir, et non un achat direct de SONASP. Les flux historiques SONASP sont
-- conservés hors périmètre comptoir.
CREATE OR REPLACE FUNCTION public.set_sonasp_as_buyer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current_org uuid := public.snp_current_organization_id();
  v_current_type text := public.snp_current_organization_type();
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.comptoir_organization_id IS NOT NULL
     AND v_current_type IS DISTINCT FROM 'comptoir' THEN
    -- Un contrôle SONASP peut faire évoluer le statut sans requalifier
    -- rétroactivement l'achat du comptoir en achat direct de SONASP.
    NEW.comptoir_organization_id := OLD.comptoir_organization_id;
    NEW.acheteur_comptoir_organization_id := OLD.acheteur_comptoir_organization_id;
    NEW.acheteur_id := NULL;
    RETURN NEW;
  END IF;

  IF v_current_type = 'comptoir' THEN
    PERFORM public.snp_require_capability('comptoir.manage');
    IF NOT public.snp_can_access_artisan(NEW.artisan_id) THEN
      RAISE EXCEPTION 'Cet orpailleur n’est pas rattaché à votre comptoir.'
        USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.acheteur_comptoir_organization_id IS NOT NULL
       AND OLD.acheteur_comptoir_organization_id IS DISTINCT FROM v_current_org THEN
      RAISE EXCEPTION 'L’acheteur comptoir d’un achat est immuable.'
        USING ERRCODE = '42501';
    END IF;
    NEW.comptoir_organization_id := v_current_org;
    NEW.acheteur_comptoir_organization_id := v_current_org;
    NEW.acheteur_id := NULL;
  ELSE
    -- Compatibilité avec les opérations nationales historiques.
    NEW.acheteur_comptoir_organization_id := NULL;
    IF NEW.acheteur_id IS NULL THEN
      NEW.acheteur_id := public.get_sonasp_id();
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.mining_companies
      WHERE id = NEW.acheteur_id AND upper(code) = 'SONASP'
    ) THEN
      RAISE EXCEPTION 'Hors comptoir, l’or artisanal peut être acheté uniquement par SONASP.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Requalifie les achats de comptoir déjà présents (notamment les jeux de
-- démonstration appliqués avant cette migration). Le trigger historique est
-- suspendu uniquement pendant cette reprise atomique, sinon il réinjecterait
-- SONASP dans acheteur_id.
DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.snp_artisan_ventes_or'::regclass
      AND tgname = 'trigger_set_sonasp_buyer'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.snp_artisan_ventes_or
      DISABLE TRIGGER trigger_set_sonasp_buyer;
  END IF;

  UPDATE public.snp_artisan_ventes_or
  SET acheteur_comptoir_organization_id = comptoir_organization_id,
      acheteur_id = NULL
  WHERE comptoir_organization_id IS NOT NULL
    AND (
      acheteur_comptoir_organization_id IS DISTINCT FROM comptoir_organization_id
      OR acheteur_id IS NOT NULL
    );

  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.snp_artisan_ventes_or'::regclass
      AND tgname = 'trigger_set_sonasp_buyer'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.snp_artisan_ventes_or
      ENABLE TRIGGER trigger_set_sonasp_buyer;
  END IF;
END;
$block$;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'snp_artisan_purchase_buyer_scope_check'
      AND conrelid = 'public.snp_artisan_ventes_or'::regclass
  ) THEN
    ALTER TABLE public.snp_artisan_ventes_or
      ADD CONSTRAINT snp_artisan_purchase_buyer_scope_check CHECK (
        (
          comptoir_organization_id IS NULL
          AND acheteur_comptoir_organization_id IS NULL
        )
        OR (
          comptoir_organization_id IS NOT NULL
          AND acheteur_comptoir_organization_id = comptoir_organization_id
          AND acheteur_id IS NULL
        )
      );
  END IF;
END;
$block$;

CREATE TABLE IF NOT EXISTS public.snp_comptoir_ventes_sonasp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comptoir_organization_id uuid NOT NULL
    REFERENCES public.snp_organizations(id) ON DELETE RESTRICT,
  sonasp_organization_id uuid NOT NULL
    REFERENCES public.snp_organizations(id) ON DELETE RESTRICT,
  reference_vente text NOT NULL UNIQUE,
  date_vente date NOT NULL DEFAULT current_date,
  quantity_grams numeric(18, 3) NOT NULL CHECK (quantity_grams > 0),
  unit_price_fcfa numeric(18, 2) NOT NULL CHECK (unit_price_fcfa > 0),
  total_fcfa numeric(20, 2) GENERATED ALWAYS AS (quantity_grams * unit_price_fcfa) STORED,
  status text NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'accepted', 'rejected', 'paid', 'cancelled')
  ),
  notes text,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  paid_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_comptoir_sale_distinct_orgs CHECK (
    comptoir_organization_id <> sonasp_organization_id
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_comptoir_ventes_scope_date
  ON public.snp_comptoir_ventes_sonasp(comptoir_organization_id, date_vente DESC);
CREATE INDEX IF NOT EXISTS idx_snp_comptoir_ventes_status
  ON public.snp_comptoir_ventes_sonasp(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.snp_guard_comptoir_sale_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF current_setting('sonasp.comptoir_sale_rpc', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Utilisez les procédures sécurisées de cession à la SONASP.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_comptoir_sale_guard ON public.snp_comptoir_ventes_sonasp;
CREATE TRIGGER snp_comptoir_sale_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.snp_comptoir_ventes_sonasp
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_comptoir_sale_row();

CREATE OR REPLACE FUNCTION public.snp_submit_comptoir_sale_to_sonasp(
  p_quantity_grams numeric,
  p_unit_price_fcfa numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_comptoir_id uuid := public.snp_current_organization_id();
  v_sonasp_id uuid;
  v_available numeric;
  v_reserved numeric;
  v_code text;
  v_reference text;
  v_id uuid;
BEGIN
  PERFORM public.snp_require_capability('comptoir.manage');
  IF public.snp_current_organization_type() IS DISTINCT FROM 'comptoir' THEN
    RAISE EXCEPTION 'Cette opération est réservée au comptoir connecté.'
      USING ERRCODE = '42501';
  END IF;
  IF p_quantity_grams IS NULL OR p_quantity_grams <= 0
     OR p_unit_price_fcfa IS NULL OR p_unit_price_fcfa <= 0 THEN
    RAISE EXCEPTION 'La quantité et le prix doivent être strictement positifs.'
      USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_sonasp_id
  FROM public.snp_organizations
  WHERE organization_type = 'sonasp' AND upper(code) = 'SONASP' AND is_active
  LIMIT 1;
  IF v_sonasp_id IS NULL THEN
    RAISE EXCEPTION 'L’organisation SONASP active est introuvable.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_comptoir_id::text, 0));
  v_available := public.snp_comptoir_stock_balance(v_comptoir_id);
  SELECT COALESCE(sum(quantity_grams), 0) INTO v_reserved
  FROM public.snp_comptoir_ventes_sonasp
  WHERE comptoir_organization_id = v_comptoir_id AND status = 'submitted';
  IF p_quantity_grams > (v_available - v_reserved) THEN
    RAISE EXCEPTION 'Stock disponible insuffisant : % g libres.', greatest(v_available - v_reserved, 0)
      USING ERRCODE = '23514';
  END IF;

  SELECT code INTO v_code FROM public.snp_organizations WHERE id = v_comptoir_id;
  v_reference := format(
    'CES-%s-%s-%s',
    regexp_replace(upper(v_code), '[^A-Z0-9]', '', 'g'),
    to_char(current_date, 'YYYY'),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

  PERFORM set_config('sonasp.comptoir_sale_rpc', '1', true);
  BEGIN
    INSERT INTO public.snp_comptoir_ventes_sonasp (
      comptoir_organization_id, sonasp_organization_id, reference_vente,
      quantity_grams, unit_price_fcfa, notes, submitted_by
    ) VALUES (
      v_comptoir_id, v_sonasp_id, v_reference,
      p_quantity_grams, p_unit_price_fcfa, nullif(trim(p_notes), ''), auth.uid()
    ) RETURNING id INTO v_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.comptoir_sale_rpc', '0', true);
    RAISE;
  END;
  PERFORM set_config('sonasp.comptoir_sale_rpc', '0', true);

  PERFORM public.snp_record_workflow_event(
    'comptoir-sale', v_id, 'submitted', NULL, 'submitted',
    'comptoir.manage', p_notes,
    jsonb_build_object('comptoir_id', v_comptoir_id, 'sonasp_id', v_sonasp_id,
                       'quantity_grams', p_quantity_grams)
  );
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_transition_comptoir_sale_to_sonasp(
  p_sale_id uuid,
  p_target_status text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_sale public.snp_comptoir_ventes_sonasp%ROWTYPE;
  v_balance numeric;
BEGIN
  SELECT * INTO v_sale
  FROM public.snp_comptoir_ventes_sonasp
  WHERE id = p_sale_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cession introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF p_target_status IN ('accepted', 'rejected') THEN
    PERFORM public.snp_require_capability('sonasp.approve');
    IF v_sale.status <> 'submitted' THEN
      RAISE EXCEPTION 'Seule une cession soumise peut être acceptée ou rejetée.'
        USING ERRCODE = '22023';
    END IF;
    IF v_sale.submitted_by = auth.uid() THEN
      RAISE EXCEPTION 'Le soumissionnaire ne contrôle pas sa propre cession.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_target_status = 'paid' THEN
    PERFORM public.snp_require_capability('sonasp.finance.execute');
    IF v_sale.status <> 'accepted' THEN
      RAISE EXCEPTION 'Seule une cession acceptée peut être réglée.'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Transition de cession inconnue.' USING ERRCODE = '22023';
  END IF;

  IF p_target_status = 'accepted' THEN
    -- Écriture serveur : l'approbateur SONASP n'a pas besoin de recevoir la
    -- capacité opérationnelle du comptoir. Le verrou et la contrainte unique
    -- rendent l'opération atomique et idempotente.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_sale.comptoir_organization_id::text, 0));
    SELECT COALESCE(sum(CASE WHEN direction = 'in' THEN quantity_grams ELSE -quantity_grams END), 0)
    INTO v_balance
    FROM public.snp_artisanal_stock_ledger
    WHERE organization_id = v_sale.comptoir_organization_id;
    IF v_sale.quantity_grams > v_balance THEN
      RAISE EXCEPTION 'Le comptoir ne dispose plus du stock nécessaire.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.snp_artisanal_stock_ledger (
      organization_id, artisan_id, direction, quantity_grams, movement_type,
      business_reference, idempotency_key, source_type, source_id, reason, created_by
    ) VALUES (
      v_sale.comptoir_organization_id, NULL, 'out', v_sale.quantity_grams, 'sale',
      v_sale.reference_vente, 'comptoir-sale:' || v_sale.id::text,
      'snp_comptoir_ventes_sonasp', v_sale.id,
      'Cession acceptée par la SONASP', auth.uid()
    );
  END IF;

  PERFORM set_config('sonasp.comptoir_sale_rpc', '1', true);
  BEGIN
    UPDATE public.snp_comptoir_ventes_sonasp
    SET status = p_target_status,
        notes = COALESCE(nullif(trim(p_notes), ''), notes),
        reviewed_by = CASE WHEN p_target_status IN ('accepted', 'rejected') THEN auth.uid() ELSE reviewed_by END,
        reviewed_at = CASE WHEN p_target_status IN ('accepted', 'rejected') THEN now() ELSE reviewed_at END,
        paid_by = CASE WHEN p_target_status = 'paid' THEN auth.uid() ELSE paid_by END,
        paid_at = CASE WHEN p_target_status = 'paid' THEN now() ELSE paid_at END,
        updated_at = now()
    WHERE id = p_sale_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.comptoir_sale_rpc', '0', true);
    RAISE;
  END;
  PERFORM set_config('sonasp.comptoir_sale_rpc', '0', true);

  PERFORM public.snp_record_workflow_event(
    'comptoir-sale', p_sale_id, 'status-changed', v_sale.status, p_target_status,
    CASE WHEN p_target_status = 'paid' THEN 'sonasp.finance.execute' ELSE 'sonasp.approve' END,
    p_notes, jsonb_build_object('comptoir_id', v_sale.comptoir_organization_id)
  );
END;
$fn$;

-- Une facture DGI certifiée et un paiement terminé alimentent ensemble le
-- stock et le registre fiscal. Avant cela, aucune quantité n'est disponible.
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_artisan_tax_payment_type
  ON public.snp_artisan_taxes_retenues(paiement_id, type_taxe);

CREATE OR REPLACE FUNCTION public.snp_require_dgi_before_comptoir_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_status text;
BEGIN
  IF NEW.comptoir_organization_id IS NULL
     AND public.snp_current_organization_type() IS DISTINCT FROM 'comptoir' THEN
    RETURN NEW;
  END IF;
  SELECT certification_dgi_status INTO v_status
  FROM public.snp_artisan_factures_definitives
  WHERE id = NEW.facture_id;
  IF v_status IS DISTINCT FROM 'certified' THEN
    RAISE EXCEPTION 'La facture DGI doit être certifiée avant d’enregistrer le paiement.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_a_require_dgi_before_payment ON public.snp_artisan_paiements;
CREATE TRIGGER snp_a_require_dgi_before_payment
BEFORE INSERT ON public.snp_artisan_paiements
FOR EACH ROW EXECUTE FUNCTION public.snp_require_dgi_before_comptoir_payment();

CREATE OR REPLACE FUNCTION public.snp_finalize_comptoir_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_facture public.snp_artisan_factures_definitives%ROWTYPE;
  v_vente public.snp_artisan_ventes_or%ROWTYPE;
BEGIN
  IF NEW.statut IS DISTINCT FROM 'complete'
     OR (TG_OP = 'UPDATE' AND OLD.statut IS NOT DISTINCT FROM 'complete') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_facture
  FROM public.snp_artisan_factures_definitives
  WHERE id = NEW.facture_id;
  SELECT * INTO v_vente
  FROM public.snp_artisan_ventes_or
  WHERE id = NEW.vente_or_id;

  IF v_facture.certification_dgi_status IS DISTINCT FROM 'certified' THEN
    RAISE EXCEPTION 'La facture doit être certifiée DGI avant la finalisation du paiement.'
      USING ERRCODE = '23514';
  END IF;
  IF length(trim(COALESCE(NEW.preuve_paiement_url, ''))) < 5 THEN
    RAISE EXCEPTION 'Une preuve de paiement est obligatoire avant l’entrée en stock.'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.comptoir_organization_id IS NULL
     OR NEW.comptoir_organization_id IS DISTINCT FROM v_facture.comptoir_organization_id
     OR NEW.comptoir_organization_id IS DISTINCT FROM v_vente.comptoir_organization_id THEN
    RAISE EXCEPTION 'Achat, facture et paiement ne partagent pas le même comptoir.'
      USING ERRCODE = '23503';
  END IF;

  PERFORM public.snp_record_comptoir_stock_movement(
    NEW.comptoir_organization_id, NEW.artisan_id, 'in', v_vente.quantite_grammes,
    'purchase', COALESCE(v_vente.numero_recu, v_vente.reference_vente, v_vente.id::text),
    'artisan-payment:' || NEW.id::text,
    'snp_artisan_paiements', NEW.id, NULL,
    'Entrée après facture DGI certifiée et paiement finalisé'
  );

  INSERT INTO public.snp_artisan_taxes_retenues (
    paiement_id, facture_id, vente_or_id, artisan_id, type_taxe, libelle_taxe,
    taux_taxe, montant_taxe, statut_reversement, periode_fiscale,
    exercice_fiscal, comptoir_organization_id
  )
  SELECT NEW.id, NEW.facture_id, NEW.vente_or_id, NEW.artisan_id,
         tax.code, tax.label, tax.rate, tax.amount, 'a_reverser',
         to_char(COALESCE(NEW.date_completion, now()), 'YYYY-MM'),
         to_char(COALESCE(NEW.date_completion, now()), 'YYYY'),
         NEW.comptoir_organization_id
  FROM (VALUES
    ('tva', 'Taxe sur la valeur ajoutée', COALESCE(v_facture.taux_tva, 0), COALESCE(v_facture.montant_taxe_tva, 0)),
    ('retenue_source', 'Retenue à la source', COALESCE(v_facture.taux_retenue_source, 0), COALESCE(v_facture.montant_taxe_retenue_source, 0)),
    ('taxe_municipale', 'Taxe de développement communal', COALESCE(v_vente.taxe_dev_comm_taux, 0), COALESCE(v_facture.montant_autres_taxes, 0))
  ) AS tax(code, label, rate, amount)
  WHERE tax.amount > 0
  ON CONFLICT (paiement_id, type_taxe) DO NOTHING;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_finalize_comptoir_purchase ON public.snp_artisan_paiements;
CREATE TRIGGER snp_finalize_comptoir_purchase
AFTER INSERT OR UPDATE OF statut ON public.snp_artisan_paiements
FOR EACH ROW EXECUTE FUNCTION public.snp_finalize_comptoir_purchase();

ALTER TABLE public.snp_comptoir_ventes_sonasp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_comptoir_sales_read_scope ON public.snp_comptoir_ventes_sonasp;
CREATE POLICY snp_comptoir_sales_read_scope
  ON public.snp_comptoir_ventes_sonasp
  FOR SELECT TO authenticated
  USING (
    comptoir_organization_id = public.snp_current_organization_id()
    OR public.snp_actor_has_capability('sonasp.prepare')
    OR public.snp_actor_has_capability('sonasp.approve')
    OR public.snp_actor_has_capability('sonasp.finance.execute')
    OR public.snp_actor_has_capability('sonasp.finance.reconcile')
  );

REVOKE ALL ON TABLE public.snp_comptoir_ventes_sonasp FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.snp_comptoir_ventes_sonasp TO authenticated;

REVOKE ALL ON FUNCTION public.snp_submit_comptoir_sale_to_sonasp(numeric, numeric, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_transition_comptoir_sale_to_sonasp(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_submit_comptoir_sale_to_sonasp(numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_transition_comptoir_sale_to_sonasp(uuid, text, text) TO authenticated;

COMMENT ON TABLE public.snp_comptoir_ventes_sonasp IS
  'Cessions nationales des comptoirs ; SONASP est le seul acheteur possible.';
COMMENT ON FUNCTION public.snp_submit_comptoir_sale_to_sonasp(numeric, numeric, text) IS
  'Soumet une cession dans le stock libre du comptoir connecté, exclusivement à SONASP.';
