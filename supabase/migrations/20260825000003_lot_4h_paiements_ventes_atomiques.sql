-- ============================================================================
-- LOT 4H - Paiements internationaux SONASP atomiques (P0)
-- ============================================================================
-- Cette migration ferme les quatre ecritures navigateur non atomiques du flux
-- PaymentCreate. L'engagement virtuel cree par snp_repondre_vente_client est
-- reutilise et converti sous verrou ; il n'est jamais duplique.
--
-- Principes :
--   * acteur, dates, statut et taux FX derives par le serveur ;
--   * AAL2 + sonasp.finance.execute pour executer/annuler ;
--   * AAL2 + sonasp.finance.reconcile et separation des fonctions pour decider ;
--   * verrou pessimiste + version optimiste + cle d'idempotence ;
--   * aucune ecriture PostgREST directe sur payments ni sur les champs de
--     paiement de sales ; les anciens SECURITY DEFINER ne contournent pas la
--     garde transactionnelle ;
--   * lecture payments bornee par le parent sales.
--
-- Le volet paiements artisans/taxes n'est volontairement pas modifie ici : son
-- contrat historique confond emission de facture, certification DGI, paiement
-- et generation fiscale dans plusieurs triggers. Une correction partielle
-- introduirait un second chemin concurrent. Il est documente pour un lot dedie.
-- ============================================================================

-- Preflight fail-closed : ne jamais inventer le schema historique manquant.
DO $preflight$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(required_name, ', ' ORDER BY required_name)
  INTO v_missing
  FROM (VALUES
    ('public.sales', to_regclass('public.sales') IS NOT NULL),
    ('public.payments', to_regclass('public.payments') IS NOT NULL),
    ('public.customers', to_regclass('public.customers') IS NOT NULL),
    ('public.customer_banks', to_regclass('public.customer_banks') IS NOT NULL),
    ('public.stakeholder_bank_accounts', to_regclass('public.stakeholder_bank_accounts') IS NOT NULL),
    ('public.fx_rates_daily', to_regclass('public.fx_rates_daily') IS NOT NULL),
    ('public.mining_companies', to_regclass('public.mining_companies') IS NOT NULL),
    ('public.snp_capability_catalog', to_regclass('public.snp_capability_catalog') IS NOT NULL),
    ('public.snp_workflow_audit', to_regclass('public.snp_workflow_audit') IS NOT NULL),
    ('public.snp_require_capability(text)', to_regprocedure('public.snp_require_capability(text)') IS NOT NULL),
    ('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)',
      to_regprocedure('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)') IS NOT NULL),
    ('public.snp_peut_consulter_vente(uuid)',
      to_regprocedure('public.snp_peut_consulter_vente(uuid)') IS NOT NULL)
  ) AS required(required_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'LOT 4H preflight - objets requis absents : %', v_missing;
  END IF;

  SELECT string_agg(format('%s.%s', table_name, column_name), ', '
                    ORDER BY table_name, column_name)
  INTO v_missing
  FROM (VALUES
    ('sales','id'),('sales','status'),('sales','customer_id'),
    ('sales','seller_id'),('sales','seller_type'),('sales','currency'),
    ('sales','final_proceeds'),('sales','payment_amount'),
    ('sales','payment_date'),('sales','payment_method'),
    ('sales','payment_proof_url'),('sales','payment_received_at'),
    ('sales','updated_at'),
    ('payments','id'),('payments','sale_id'),('payments','customer_id'),
    ('payments','amount'),('payments','currency'),('payments','expected_date'),
    ('payments','status'),('payments','is_virtual'),('payments','payment_type'),
    ('payments','customer_bank_id'),('payments','seller_bank_id'),
    ('payments','payment_currency'),('payments','receiving_currency'),
    ('payments','received_amount'),('payments','actual_date'),
    ('payments','bank_name'),('payments','account_number'),
    ('payments','reference_number'),('payments','transaction_id'),
    ('payments','fx_rate'),('payments','proof_url'),('payments','notes'),
    ('payments','created_by'),('payments','approved_by'),
    ('payments','approved_at'),('payments','converted_by'),
    ('payments','converted_to_actual_at'),('payments','created_at'),
    ('customer_banks','id'),('customer_banks','customer_id'),
    ('customer_banks','currency'),('customer_banks','bank_name'),
    ('customer_banks','account_number'),('customer_banks','is_active'),
    ('stakeholder_bank_accounts','id'),
    ('stakeholder_bank_accounts','stakeholder_id'),
    ('stakeholder_bank_accounts','stakeholder_type'),
    ('stakeholder_bank_accounts','account_currency'),
    ('stakeholder_bank_accounts','is_active'),
    ('stakeholder_bank_accounts','verification_status'),
    ('stakeholder_bank_accounts','valid_from'),
    ('stakeholder_bank_accounts','valid_to'),
    ('fx_rates_daily','currency_pair'),('fx_rates_daily','rate'),
    ('fx_rates_daily','rate_date'),('fx_rates_daily','notes')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name=required.table_name
      AND c.column_name=required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'LOT 4H preflight - colonnes historiques absentes : %', v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code='sonasp.finance.execute' AND sensitive
  ) OR NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code='sonasp.finance.reconcile' AND sensitive
  ) THEN
    RAISE EXCEPTION
      'LOT 4H preflight - capabilities finance execute/reconcile sensibles absentes.';
  END IF;
END;
$preflight$;

-- Colonnes canoniques : seules les RPC 4H les alimentent pour les nouvelles
-- operations. Les lignes historiques restent lisibles sans backfill invente.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS executed_by uuid,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS fx_rate_date date,
  ADD COLUMN IF NOT EXISTS fx_rate_source text,
  ADD COLUMN IF NOT EXISTS execution_reference_key text;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.payments'::regclass
      AND conname='payments_4h_version_nonnegative_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_4h_version_nonnegative_check
      CHECK (version >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.payments'::regclass
      AND conname='payments_4h_canonical_status_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_4h_canonical_status_check
      CHECK (status IN (
        'pending','processing','approved','rejected','cancelled','failed'
      )) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.payments'::regclass
      AND conname='payments_4h_executed_by_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_4h_executed_by_fkey
      FOREIGN KEY (executed_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.payments'::regclass
      AND conname='payments_4h_rejected_by_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_4h_rejected_by_fkey
      FOREIGN KEY (rejected_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.payments'::regclass
      AND conname='payments_4h_cancelled_by_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_4h_cancelled_by_fkey
      FOREIGN KEY (cancelled_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END;
$constraints$;

ALTER TABLE public.payments
  VALIDATE CONSTRAINT payments_4h_version_nonnegative_check;
ALTER TABLE public.payments
  VALIDATE CONSTRAINT payments_4h_executed_by_fkey;
ALTER TABLE public.payments
  VALIDATE CONSTRAINT payments_4h_rejected_by_fkey;
ALTER TABLE public.payments
  VALIDATE CONSTRAINT payments_4h_cancelled_by_fkey;

-- Les nouvelles references bancaires sont uniques sans imposer un nettoyage
-- silencieux des anciennes lignes (toutes ont execution_reference_key NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_4h_execution_reference
  ON public.payments(execution_reference_key)
  WHERE execution_reference_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_4h_sale_status_created
  ON public.payments(sale_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_4h_executor_created
  ON public.payments(executed_by,executed_at DESC)
  WHERE executed_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.snp_payment_operation_ledger (
  idempotency_key uuid PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN ('execute','decide','cancel')),
  aggregate_id uuid NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES public.sales(id) ON DELETE RESTRICT,
  request_fingerprint text NOT NULL CHECK (length(request_fingerprint)=32),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  capability_code text NOT NULL CHECK (
    capability_code IN ('sonasp.finance.execute','sonasp.finance.reconcile')
  ),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT snp_payment_operation_ledger_completion_check CHECK (
    (result IS NULL AND completed_at IS NULL)
    OR (result IS NOT NULL AND completed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_snp_payment_operation_aggregate
  ON public.snp_payment_operation_ledger(operation,aggregate_id,created_at DESC);

ALTER TABLE public.snp_payment_operation_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_payment_operation_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.snp_payment_operation_ledger
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.snp_payment_operation_ledger TO service_role;

-- Retourne NULL pour une reservation nouvelle, sinon le resultat immuable du
-- premier traitement marque replayed=true. ON CONFLICT attend la transaction
-- concurrente : une cle ne peut produire qu'un seul effet metier.
CREATE OR REPLACE FUNCTION public.snp_4h_payment_idempotency_reserve(
  p_idempotency_key uuid,
  p_operation text,
  p_aggregate_id uuid,
  p_request_fingerprint text,
  p_actor uuid,
  p_capability text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_inserted boolean := false;
  v_row public.snp_payment_operation_ledger%ROWTYPE;
BEGIN
  IF p_idempotency_key IS NULL OR p_aggregate_id IS NULL OR p_actor IS NULL
     OR p_operation NOT IN ('execute','decide','cancel')
     OR p_capability NOT IN (
       'sonasp.finance.execute','sonasp.finance.reconcile'
     )
     OR p_request_fingerprint !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'Reservation idempotente invalide.' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.snp_payment_operation_ledger(
    idempotency_key,operation,aggregate_id,request_fingerprint,
    actor_id,capability_code
  ) VALUES (
    p_idempotency_key,p_operation,p_aggregate_id,p_request_fingerprint,
    p_actor,p_capability
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING true INTO v_inserted;

  IF coalesce(v_inserted,false) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.snp_payment_operation_ledger
  WHERE idempotency_key=p_idempotency_key
  FOR UPDATE;

  IF v_row.operation<>p_operation
     OR v_row.aggregate_id<>p_aggregate_id
     OR v_row.request_fingerprint<>p_request_fingerprint THEN
    RAISE EXCEPTION 'Cle d''idempotence reutilisee pour une autre requete.'
      USING ERRCODE='23505';
  END IF;
  IF v_row.actor_id<>p_actor THEN
    RAISE EXCEPTION 'Une cle d''idempotence appartient a un autre acteur.'
      USING ERRCODE='42501';
  END IF;
  IF v_row.result IS NULL THEN
    RAISE EXCEPTION 'Operation idempotente incomplete; reessayer.'
      USING ERRCODE='40001';
  END IF;
  RETURN v_row.result || jsonb_build_object('replayed',true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_4h_payment_idempotency_reserve(
  uuid,text,uuid,text,uuid,text
) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.snp_4h_complete_payment_operation(
  p_idempotency_key uuid,
  p_payment_id uuid,
  p_sale_id uuid,
  p_result jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  UPDATE public.snp_payment_operation_ledger
  SET payment_id=p_payment_id,sale_id=p_sale_id,
      result=p_result,completed_at=clock_timestamp()
  WHERE idempotency_key=p_idempotency_key
    AND actor_id=auth.uid()
    AND result IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation idempotente absente ou deja finalisee.'
      USING ERRCODE='40001';
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_4h_complete_payment_operation(
  uuid,uuid,uuid,jsonb
) FROM PUBLIC,anon,authenticated,service_role;

-- Garde non contournable. Un marker local n'est pose que par les RPC 4H. La
-- seule exception preservee est l'engagement virtuel cree par la RPC client
-- historique sous SECURITY DEFINER, avant que la vente passe a waiting.
CREATE OR REPLACE FUNCTION public.snp_4h_guard_payment_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_sale_status text;
BEGIN
  IF current_setting('sonasp.payment_4h_rpc',true)='1' THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP='INSERT'
     AND current_user NOT IN ('anon','authenticated')
     AND coalesce(auth.role(),'')='authenticated'
     AND NEW.is_virtual IS TRUE
     AND coalesce(NEW.status,'pending')='pending'
     AND NEW.created_by=auth.uid() THEN
    SELECT status::text INTO v_sale_status
    FROM public.sales WHERE id=NEW.sale_id;
    IF v_sale_status='pending_for_customer_approval' THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Utilisez les RPC atomiques de paiement international.'
    USING ERRCODE='42501';
END;
$fn$;

DROP TRIGGER IF EXISTS snp_4h_payment_rpc_only ON public.payments;
CREATE TRIGGER snp_4h_payment_rpc_only
BEFORE INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.snp_4h_guard_payment_row();

CREATE OR REPLACE FUNCTION public.snp_4h_guard_sale_payment_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  IF current_setting('sonasp.payment_4h_rpc',true)='1' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.payment_amount IS NOT DISTINCT FROM OLD.payment_amount
     AND NEW.payment_date IS NOT DISTINCT FROM OLD.payment_date
     AND NEW.payment_method IS NOT DISTINCT FROM OLD.payment_method
     AND NEW.payment_proof_url IS NOT DISTINCT FROM OLD.payment_proof_url
     AND NEW.payment_received_at IS NOT DISTINCT FROM OLD.payment_received_at THEN
    RETURN NEW;
  END IF;

  -- Compatibilite de la decision client atomique existante.
  IF current_user NOT IN ('anon','authenticated')
     AND coalesce(auth.role(),'')='authenticated'
     AND OLD.status::text='pending_for_customer_approval'
     AND NEW.status::text='waiting_for_payment'
     AND NEW.customer_approved_by=auth.uid()
     AND NEW.payment_amount IS NOT DISTINCT FROM OLD.payment_amount
     AND NEW.payment_date IS NOT DISTINCT FROM OLD.payment_date
     AND NEW.payment_method IS NOT DISTINCT FROM OLD.payment_method
     AND NEW.payment_proof_url IS NOT DISTINCT FROM OLD.payment_proof_url
     AND NEW.payment_received_at IS NOT DISTINCT FROM OLD.payment_received_at THEN
    RETURN NEW;
  END IF;

  IF OLD.status::text IN ('waiting_for_payment','virtual_payment','payment_received')
     OR NEW.status::text IN ('waiting_for_payment','virtual_payment','payment_received')
     OR NEW.payment_amount IS DISTINCT FROM OLD.payment_amount
     OR NEW.payment_date IS DISTINCT FROM OLD.payment_date
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_proof_url IS DISTINCT FROM OLD.payment_proof_url
     OR NEW.payment_received_at IS DISTINCT FROM OLD.payment_received_at THEN
    RAISE EXCEPTION 'Le statut financier de la vente passe exclusivement par LOT 4H.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_4h_sale_payment_rpc_only ON public.sales;
CREATE TRIGGER snp_4h_sale_payment_rpc_only
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.snp_4h_guard_sale_payment_fields();

-- Execute le paiement reel sur l'engagement pending/virtuel existant. Si une
-- dette legacy waiting_for_payment n'a aucun engagement, une unique ligne est
-- creee sous le meme verrou de vente.
CREATE OR REPLACE FUNCTION public.snp_paiement_international_executer(
  p_sale_id uuid,
  p_expected_sale_status text,
  p_expected_payment_version bigint,
  p_paid_amount numeric,
  p_payment_currency text,
  p_customer_bank_id uuid,
  p_seller_bank_id uuid,
  p_payment_date date,
  p_reference_number text,
  p_transaction_id text,
  p_proof_path text,
  p_notes text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_sale public.sales%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_customer_bank public.customer_banks%ROWTYPE;
  v_seller_bank public.stakeholder_bank_accounts%ROWTYPE;
  v_payment_currency text := upper(btrim(coalesce(p_payment_currency,'')));
  v_sale_currency text;
  v_fx_rate numeric;
  v_fx_date date;
  v_fx_source text;
  v_converted numeric;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
  v_active_count integer;
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.execute');
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Acteur JWT authentifie requis.' USING ERRCODE='42501';
  END IF;
  IF p_sale_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_sale_status NOT IN ('waiting_for_payment','virtual_payment')
     OR p_paid_amount IS NULL OR p_paid_amount<=0
     OR v_payment_currency !~ '^[A-Z]{3}$'
     OR p_customer_bank_id IS NULL OR p_seller_bank_id IS NULL
     OR p_payment_date IS NULL OR p_payment_date>current_date
     OR p_payment_date<current_date-30
     OR length(btrim(coalesce(p_reference_number,'')))<5 THEN
    RAISE EXCEPTION 'Parametres d''execution du paiement invalides.'
      USING ERRCODE='22023';
  END IF;
  IF nullif(btrim(p_proof_path),'') IS NOT NULL THEN
    RAISE EXCEPTION
      'La preuve bancaire doit etre rattachee par un gateway prive verifie.'
      USING ERRCODE='42501';
  END IF;

  v_fingerprint:=md5(jsonb_build_object(
    'sale_id',p_sale_id,'expected_sale_status',p_expected_sale_status,
    'expected_payment_version',p_expected_payment_version,
    'paid_amount',p_paid_amount,'payment_currency',v_payment_currency,
    'customer_bank_id',p_customer_bank_id,'seller_bank_id',p_seller_bank_id,
    'payment_date',p_payment_date,'reference_number',btrim(p_reference_number),
    'transaction_id',nullif(btrim(p_transaction_id),''),
    'proof_path',nullif(btrim(p_proof_path),''),'notes',nullif(btrim(p_notes),'')
  )::text);
  v_replay:=public.snp_4h_payment_idempotency_reserve(
    p_idempotency_key,'execute',p_sale_id,v_fingerprint,v_actor,
    'sonasp.finance.execute'
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id=p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_sale.status::text<>p_expected_sale_status THEN
    RAISE EXCEPTION 'Conflit optimiste vente : attendu %, courant %.',
      p_expected_sale_status,v_sale.status::text USING ERRCODE='40001';
  END IF;
  IF v_sale.seller_type IS DISTINCT FROM 'sonasp'
     OR NOT EXISTS (
       SELECT 1 FROM public.mining_companies mc
       WHERE mc.id=v_sale.seller_id AND upper(coalesce(mc.code,''))='SONASP'
         AND mc.is_active
     ) THEN
    RAISE EXCEPTION 'Le paiement international doit concerner une vente SONASP active.'
      USING ERRCODE='42501';
  END IF;

  v_sale_currency:=upper(coalesce(v_sale.currency,'USD'));
  IF v_sale_currency !~ '^[A-Z]{3}$' OR v_sale.final_proceeds IS NULL
     OR v_sale.final_proceeds<=0 THEN
    RAISE EXCEPTION 'Montant/devise de vente incoherent.' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_customer_bank FROM public.customer_banks
  WHERE id=p_customer_bank_id FOR SHARE;
  IF NOT FOUND OR v_customer_bank.customer_id<>v_sale.customer_id
     OR v_customer_bank.is_active IS DISTINCT FROM true
     OR upper(v_customer_bank.currency)<>v_payment_currency THEN
    RAISE EXCEPTION 'Compte client inactif, hors client ou hors devise.'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_seller_bank FROM public.stakeholder_bank_accounts
  WHERE id=p_seller_bank_id FOR SHARE;
  IF NOT FOUND OR v_seller_bank.stakeholder_id<>v_sale.seller_id
     OR v_seller_bank.stakeholder_type<>v_sale.seller_type
     OR v_seller_bank.is_active IS DISTINCT FROM true
     OR lower(coalesce(v_seller_bank.verification_status,''))<>'verified'
     OR upper(v_seller_bank.account_currency)<>v_sale_currency
     OR (v_seller_bank.valid_from IS NOT NULL
         AND v_seller_bank.valid_from::date>p_payment_date)
     OR (v_seller_bank.valid_to IS NOT NULL
         AND v_seller_bank.valid_to::date<p_payment_date) THEN
    RAISE EXCEPTION 'Compte receveur SONASP non verifie, invalide ou hors devise.'
      USING ERRCODE='23514';
  END IF;

  IF v_payment_currency=v_sale_currency THEN
    v_fx_rate:=1; v_fx_date:=p_payment_date; v_fx_source:='parity';
  ELSE
    SELECT CASE WHEN f.currency_pair=v_payment_currency||'/'||v_sale_currency
                THEN f.rate ELSE 1/f.rate END,
           f.rate_date,coalesce(nullif(btrim(f.notes),''),'Referentiel SONASP')
    INTO v_fx_rate,v_fx_date,v_fx_source
    FROM public.fx_rates_daily f
    WHERE f.currency_pair IN (
      v_payment_currency||'/'||v_sale_currency,
      v_sale_currency||'/'||v_payment_currency
    ) AND f.rate>0 AND f.rate_date<=p_payment_date
      AND f.rate_date>=p_payment_date-5
    ORDER BY f.rate_date DESC,
      (f.currency_pair=v_payment_currency||'/'||v_sale_currency) DESC
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Taux FX autoritatif indisponible pour %/% a la date %.',
        v_payment_currency,v_sale_currency,p_payment_date USING ERRCODE='P0002';
    END IF;
  END IF;

  v_converted:=round(p_paid_amount*v_fx_rate,2);
  IF abs(v_converted-v_sale.final_proceeds)>
     greatest(1::numeric,round(abs(v_sale.final_proceeds)*0.005,2)) THEN
    RAISE EXCEPTION 'Montant converti % % incompatible avec la vente % %.',
      v_converted,v_sale_currency,v_sale.final_proceeds,v_sale_currency
      USING ERRCODE='23514';
  END IF;

  SELECT count(*) INTO v_active_count FROM public.payments p
  WHERE p.sale_id=p_sale_id AND p.status IN ('pending','processing','approved');
  IF v_active_count>1 THEN
    RAISE EXCEPTION 'Plusieurs engagements actifs historiques existent pour cette vente.'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_payment FROM public.payments p
  WHERE p.sale_id=p_sale_id AND p.status='pending'
  ORDER BY p.is_virtual DESC NULLS LAST,p.created_at DESC NULLS LAST,p.id
  LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    IF p_expected_payment_version IS NULL
       OR v_payment.version<>p_expected_payment_version THEN
      RAISE EXCEPTION 'Conflit optimiste paiement : attendu %, courant %.',
        p_expected_payment_version,v_payment.version USING ERRCODE='40001';
    END IF;
  ELSIF p_expected_payment_version IS NOT NULL THEN
    RAISE EXCEPTION 'Aucun engagement ne correspond a la version attendue.'
      USING ERRCODE='40001';
  END IF;

  PERFORM set_config('sonasp.payment_4h_rpc','1',true);
  BEGIN
    IF v_payment.id IS NULL THEN
      INSERT INTO public.payments(
        sale_id,customer_id,amount,currency,expected_date,status,is_virtual,
        payment_type,customer_bank_id,seller_bank_id,payment_currency,
        receiving_currency,received_amount,actual_date,bank_name,account_number,
        reference_number,transaction_id,fx_rate,proof_url,notes,created_by,
        executed_by,executed_at,converted_by,converted_to_actual_at,
        fx_rate_date,fx_rate_source,execution_reference_key,version
      ) VALUES (
        v_sale.id,v_sale.customer_id,v_converted,v_sale_currency,p_payment_date,
        'processing',false,'actual',p_customer_bank_id,p_seller_bank_id,
        v_payment_currency,v_sale_currency,p_paid_amount,p_payment_date,
        v_customer_bank.bank_name,v_customer_bank.account_number,
        left(btrim(p_reference_number),255),left(nullif(btrim(p_transaction_id),''),255),
        v_fx_rate,left(nullif(btrim(p_proof_path),''),2048),left(nullif(btrim(p_notes),''),4000),
        v_actor,v_actor,clock_timestamp(),v_actor,clock_timestamp(),
        v_fx_date,left(v_fx_source,255),
        p_seller_bank_id::text||':'||lower(btrim(p_reference_number)),1
      ) RETURNING * INTO v_payment;
    ELSE
      UPDATE public.payments SET
        amount=v_converted,currency=v_sale_currency,status='processing',
        is_virtual=false,payment_type='actual',customer_bank_id=p_customer_bank_id,
        seller_bank_id=p_seller_bank_id,payment_currency=v_payment_currency,
        receiving_currency=v_sale_currency,received_amount=p_paid_amount,
        actual_date=p_payment_date,bank_name=v_customer_bank.bank_name,
        account_number=v_customer_bank.account_number,
        reference_number=left(btrim(p_reference_number),255),
        transaction_id=left(nullif(btrim(p_transaction_id),''),255),
        fx_rate=v_fx_rate,proof_url=left(nullif(btrim(p_proof_path),''),2048),
        notes=concat_ws(E'\n',nullif(notes,''),left(nullif(btrim(p_notes),''),4000)),
        executed_by=v_actor,executed_at=clock_timestamp(),converted_by=v_actor,
        converted_to_actual_at=clock_timestamp(),fx_rate_date=v_fx_date,
        fx_rate_source=left(v_fx_source,255),
        execution_reference_key=p_seller_bank_id::text||':'||lower(btrim(p_reference_number)),
        approved_by=NULL,approved_at=NULL,rejected_by=NULL,rejected_at=NULL,
        rejection_reason=NULL,cancelled_by=NULL,cancelled_at=NULL,
        cancellation_reason=NULL,version=version+1
      WHERE id=v_payment.id RETURNING * INTO v_payment;
    END IF;

    UPDATE public.sales SET
      status='virtual_payment',payment_amount=v_converted,
      payment_date=p_payment_date,payment_method='bank_transfer',
      payment_proof_url=left(nullif(btrim(p_proof_path),''),2048),
      payment_received_at=NULL,updated_at=clock_timestamp()
    WHERE id=v_sale.id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.payment_4h_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.payment_4h_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_payment.id,'sale_id',v_sale.id,
    'payment_status','processing','sale_status','virtual_payment',
    'version',v_payment.version,'idempotency_key',p_idempotency_key,
    'replayed',false,'paid_amount',p_paid_amount,
    'payment_currency',v_payment_currency,'settlement_amount',v_converted,
    'settlement_currency',v_sale_currency,'fx_rate',v_fx_rate,
    'fx_rate_date',v_fx_date,'fx_rate_source',v_fx_source,
    'processed_at',v_payment.executed_at
  );
  PERFORM public.snp_record_workflow_event(
    'international-payment',v_payment.id,'executed','pending','processing',
    'sonasp.finance.execute',p_notes,
    jsonb_build_object('sale_id',v_sale.id,'idempotency_key',p_idempotency_key,
      'payment_currency',v_payment_currency,'settlement_currency',v_sale_currency,
      'fx_rate',v_fx_rate,'fx_rate_date',v_fx_date,
      'customer_bank_id',p_customer_bank_id,'seller_bank_id',p_seller_bank_id)
  );
  PERFORM public.snp_4h_complete_payment_operation(
    p_idempotency_key,v_payment.id,v_sale.id,v_result
  );
  RETURN v_result;
END;
$fn$;

-- La validation est le rapprochement financier : elle requiert la capability
-- distincte et interdit a l'executeur de valider/rejeter sa propre saisie.
CREATE OR REPLACE FUNCTION public.snp_paiement_international_decider(
  p_payment_id uuid,
  p_expected_status text,
  p_expected_version bigint,
  p_decision text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor uuid:=auth.uid();
  v_payment public.payments%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_new_status text;
  v_sale_status text;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.reconcile');
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Acteur JWT authentifie requis.' USING ERRCODE='42501'; END IF;
  IF p_payment_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_status<>'processing' OR p_expected_version IS NULL
     OR p_decision NOT IN ('approve','reject')
     OR (p_decision='reject' AND length(btrim(coalesce(p_reason,'')))<10) THEN
    RAISE EXCEPTION 'Parametres de decision invalides.' USING ERRCODE='22023';
  END IF;
  v_fingerprint:=md5(jsonb_build_object(
    'payment_id',p_payment_id,'expected_status',p_expected_status,
    'expected_version',p_expected_version,'decision',p_decision,
    'reason',nullif(btrim(p_reason),'')
  )::text);
  v_replay:=public.snp_4h_payment_idempotency_reserve(
    p_idempotency_key,'decide',p_payment_id,v_fingerprint,v_actor,
    'sonasp.finance.reconcile'
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_payment.status<>p_expected_status OR v_payment.version<>p_expected_version THEN
    RAISE EXCEPTION 'Conflit optimiste paiement : attendu %/%, courant %/%.',
      p_expected_status,p_expected_version,v_payment.status,v_payment.version
      USING ERRCODE='40001';
  END IF;
  IF v_payment.executed_by IS NULL OR v_payment.executed_by=v_actor THEN
    RAISE EXCEPTION 'Double controle requis : l''executeur ne rapproche pas son paiement.'
      USING ERRCODE='42501';
  END IF;
  IF p_decision='approve'
     AND length(btrim(coalesce(v_payment.proof_url,'')))<5 THEN
    RAISE EXCEPTION
      'Une preuve bancaire privee verifiee est requise avant rapprochement.'
      USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id=v_payment.sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente parente introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_sale.status::text<>'virtual_payment' THEN
    RAISE EXCEPTION 'Conflit optimiste vente : statut courant %.',v_sale.status::text
      USING ERRCODE='40001';
  END IF;

  v_new_status:=CASE p_decision WHEN 'approve' THEN 'approved' ELSE 'rejected' END;
  v_sale_status:=CASE p_decision WHEN 'approve' THEN 'payment_received' ELSE 'waiting_for_payment' END;
  PERFORM set_config('sonasp.payment_4h_rpc','1',true);
  BEGIN
    UPDATE public.payments SET
      status=v_new_status,
      approved_by=CASE WHEN p_decision='approve' THEN v_actor ELSE NULL END,
      approved_at=CASE WHEN p_decision='approve' THEN clock_timestamp() ELSE NULL END,
      rejected_by=CASE WHEN p_decision='reject' THEN v_actor ELSE NULL END,
      rejected_at=CASE WHEN p_decision='reject' THEN clock_timestamp() ELSE NULL END,
      rejection_reason=CASE WHEN p_decision='reject' THEN left(btrim(p_reason),4000) ELSE NULL END,
      notes=CASE WHEN nullif(btrim(p_reason),'') IS NULL THEN notes
                 ELSE concat_ws(E'\n',nullif(notes,''),left(btrim(p_reason),4000)) END,
      version=version+1
    WHERE id=p_payment_id RETURNING * INTO v_payment;
    UPDATE public.sales SET
      status=CASE WHEN p_decision='approve'
        THEN 'payment_received'::public.sale_status
        ELSE 'waiting_for_payment'::public.sale_status END,
      payment_received_at=CASE WHEN p_decision='approve' THEN clock_timestamp() ELSE NULL END,
      updated_at=clock_timestamp()
    WHERE id=v_sale.id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.payment_4h_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.payment_4h_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_payment.id,'sale_id',v_sale.id,
    'payment_status',v_new_status,'sale_status',v_sale_status,
    'version',v_payment.version,'decision',p_decision,
    'idempotency_key',p_idempotency_key,'replayed',false,
    'processed_at',coalesce(v_payment.approved_at,v_payment.rejected_at)
  );
  PERFORM public.snp_record_workflow_event(
    'international-payment',v_payment.id,'reconciled',p_expected_status,v_new_status,
    'sonasp.finance.reconcile',p_reason,
    jsonb_build_object('sale_id',v_sale.id,'idempotency_key',p_idempotency_key,
      'decision',p_decision,'executor_id',v_payment.executed_by)
  );
  PERFORM public.snp_4h_complete_payment_operation(
    p_idempotency_key,v_payment.id,v_sale.id,v_result
  );
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_paiement_international_annuler(
  p_payment_id uuid,
  p_expected_status text,
  p_expected_version bigint,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor uuid:=auth.uid();
  v_payment public.payments%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.execute');
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Acteur JWT authentifie requis.' USING ERRCODE='42501'; END IF;
  IF p_payment_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_status NOT IN ('pending','processing')
     OR p_expected_version IS NULL
     OR length(btrim(coalesce(p_reason,'')))<10 THEN
    RAISE EXCEPTION 'Parametres d''annulation invalides.' USING ERRCODE='22023';
  END IF;
  v_fingerprint:=md5(jsonb_build_object(
    'payment_id',p_payment_id,'expected_status',p_expected_status,
    'expected_version',p_expected_version,'reason',btrim(p_reason)
  )::text);
  v_replay:=public.snp_4h_payment_idempotency_reserve(
    p_idempotency_key,'cancel',p_payment_id,v_fingerprint,v_actor,
    'sonasp.finance.execute'
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_payment.status<>p_expected_status OR v_payment.version<>p_expected_version THEN
    RAISE EXCEPTION 'Conflit optimiste paiement : attendu %/%, courant %/%.',
      p_expected_status,p_expected_version,v_payment.status,v_payment.version
      USING ERRCODE='40001';
  END IF;
  IF v_payment.executed_by IS NOT NULL AND v_payment.executed_by<>v_actor THEN
    RAISE EXCEPTION 'Seul l''executeur peut annuler avant rapprochement.'
      USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id=v_payment.sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente parente introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_sale.status::text NOT IN ('waiting_for_payment','virtual_payment') THEN
    RAISE EXCEPTION 'Conflit optimiste vente : statut courant %.',v_sale.status::text
      USING ERRCODE='40001';
  END IF;

  PERFORM set_config('sonasp.payment_4h_rpc','1',true);
  BEGIN
    UPDATE public.payments SET
      status='cancelled',cancelled_by=v_actor,cancelled_at=clock_timestamp(),
      cancellation_reason=left(btrim(p_reason),4000),
      notes=concat_ws(E'\n',nullif(notes,''),left(btrim(p_reason),4000)),
      version=version+1
    WHERE id=p_payment_id RETURNING * INTO v_payment;
    UPDATE public.sales SET status='waiting_for_payment',
      payment_received_at=NULL,updated_at=clock_timestamp()
    WHERE id=v_sale.id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.payment_4h_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.payment_4h_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_payment.id,'sale_id',v_sale.id,
    'payment_status','cancelled','sale_status','waiting_for_payment',
    'version',v_payment.version,'idempotency_key',p_idempotency_key,
    'replayed',false,'processed_at',v_payment.cancelled_at
  );
  PERFORM public.snp_record_workflow_event(
    'international-payment',v_payment.id,'cancelled',p_expected_status,'cancelled',
    'sonasp.finance.execute',p_reason,
    jsonb_build_object('sale_id',v_sale.id,'idempotency_key',p_idempotency_key)
  );
  PERFORM public.snp_4h_complete_payment_operation(
    p_idempotency_key,v_payment.id,v_sale.id,v_result
  );
  RETURN v_result;
END;
$fn$;

-- RLS/ACL deny-by-default. Les fonctions SECURITY DEFINER possedent les droits
-- table ; PostgREST authenticated ne recoit que SELECT filtre par le parent.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
DO $drop_payment_policies$
DECLARE v_policy record;
BEGIN
  FOR v_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='payments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.payments',v_policy.policyname);
  END LOOP;
END;
$drop_payment_policies$;
CREATE POLICY snp_4h_payments_select_parent_scope ON public.payments
FOR SELECT TO authenticated
USING (public.snp_peut_consulter_vente(sale_id));

REVOKE ALL ON TABLE public.payments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;

-- Les snapshots FX historiques restent consultables, mais ne sont plus forges
-- par le navigateur. Le flux 4H conserve son snapshot sur payments + audit.
DO $fx_acl$
DECLARE v_policy record;
BEGIN
  IF to_regclass('public.fx_rate_analysis') IS NULL THEN RETURN; END IF;
  ALTER TABLE public.fx_rate_analysis ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fx_rate_analysis FORCE ROW LEVEL SECURITY;
  FOR v_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='fx_rate_analysis'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fx_rate_analysis',v_policy.policyname);
  END LOOP;
  EXECUTE $policy$
    CREATE POLICY snp_4h_fx_analysis_select_parent_scope
    ON public.fx_rate_analysis FOR SELECT TO authenticated
    USING (
      payment_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.id=payment_id AND public.snp_peut_consulter_vente(p.sale_id)
      )
    )
  $policy$;
  REVOKE ALL ON TABLE public.fx_rate_analysis FROM PUBLIC,anon,authenticated;
  GRANT SELECT ON TABLE public.fx_rate_analysis TO authenticated;
END;
$fx_acl$;

-- Les anciennes procedures permettent soit p_converted_by forgeable cote
-- service, soit une approbation sans expected_status/idempotence/SoD. Elles ne
-- sont plus une surface runtime apres 4H.
DO $legacy_acl$
BEGIN
  IF to_regprocedure(
    'public.convert_virtual_to_actual_payment(uuid,date,text,text,text,text,numeric,text,text,uuid)'
  ) IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.convert_virtual_to_actual_payment(
      uuid,date,text,text,text,text,numeric,text,text,uuid
    ) FROM PUBLIC,anon,authenticated,service_role;
  END IF;
END;
$legacy_acl$;

REVOKE ALL ON FUNCTION public.snp_paiement_international_executer(
  uuid,text,bigint,numeric,text,uuid,uuid,date,text,text,text,text,uuid
) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_paiement_international_decider(
  uuid,text,bigint,text,text,uuid
) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_paiement_international_annuler(
  uuid,text,bigint,text,uuid
) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_paiement_international_executer(
  uuid,text,bigint,numeric,text,uuid,uuid,date,text,text,text,text,uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_paiement_international_decider(
  uuid,text,bigint,text,text,uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_paiement_international_annuler(
  uuid,text,bigint,text,uuid
) TO authenticated;

COMMENT ON FUNCTION public.snp_paiement_international_executer(
  uuid,text,bigint,numeric,text,uuid,uuid,date,text,text,text,text,uuid
) IS 'Convertit/exécute atomiquement l engagement virtuel existant. FX, acteur, tenant, banques et statuts sont controles serveur.';
COMMENT ON FUNCTION public.snp_paiement_international_decider(
  uuid,text,bigint,text,text,uuid
) IS 'Rapproche (approve/reject) un paiement processing avec SoD executeur/reconciliateur et conflit optimiste 40001.';
COMMENT ON FUNCTION public.snp_paiement_international_annuler(
  uuid,text,bigint,text,uuid
) IS 'Annule avant rapprochement un paiement pending/processing par son executeur, de facon idempotente.';
COMMENT ON TABLE public.snp_payment_operation_ledger IS
  'Ledger append-only d idempotence des paiements internationaux; aucune exposition PostgREST.';

-- Validation post-deploiement structurelle. Le catalogue applicatif doit rester
-- coherent avant qu'une release ne branche le frontend sur les RPC.
DO $postflight$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM information_schema.role_routine_grants
  WHERE specific_schema='public'
    AND routine_name IN (
      'snp_paiement_international_executer',
      'snp_paiement_international_decider',
      'snp_paiement_international_annuler'
    ) AND grantee='authenticated' AND privilege_type='EXECUTE';
  IF v_count<>3 THEN
    RAISE EXCEPTION 'LOT 4H postflight - allowlist RPC incomplete (%/3).',v_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='payments'
      AND grantee IN ('anon','authenticated')
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) THEN
    RAISE EXCEPTION 'LOT 4H postflight - DML client payments encore accorde.';
  END IF;
END;
$postflight$;

-- Rollback non destructif documente :
--   1. REVOKE EXECUTE sur les trois RPC 4H ;
--   2. conserver ledger/audit/colonnes (preuves), ne pas les supprimer ;
--   3. si rollback applicatif temporaire approuve, retablir explicitement les
--      anciens grants/policies depuis un changement separe et journalise ;
--   4. ne jamais remettre p_converted_by ni les UPDATE de statut navigateur.
