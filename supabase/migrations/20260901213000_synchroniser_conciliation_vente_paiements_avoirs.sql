-- ============================================================================
-- Conciliation validee : vente, paiements et avoir client coherents (P1)
-- ============================================================================
-- La validation historique regularise correctement le grand livre commercial
-- dans la devise contractuelle, mais ne propage pas ca_final vers la vente.
-- Cette migration additive conserve ce traitement et lui adjoint, dans la meme
-- transaction, une synchronisation idempotente du montant final, du solde et de
-- l'eventuel avoir client.
--
-- Invariants :
--   * ordre de verrouillage : conciliation, puis vente ;
--   * ca_final est le montant canonique de sales.final_proceeds ;
--   * une devise ISO unique couvre conciliation, vente, paiements et avoir ;
--   * les paiements reels processing/approved ne peuvent plus depasser le
--     montant final de plus d'un centime ;
--   * seul le trop-percu APPROUVE devient un avoir (un seul par conciliation) ;
--   * la relecture d'une validation et la reaplication de la migration ne
--     produisent aucun second mouvement.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Preflight fail-closed : ne pas installer une synchronisation partielle sur
-- un schema historique incomplet ou deja ambigu.
DO $preflight$
DECLARE
  v_missing text;
  v_duplicate uuid;
  v_bad_currency text;
BEGIN
  SELECT string_agg(required_name, ', ' ORDER BY required_name)
  INTO v_missing
  FROM (VALUES
    ('public.sales', to_regclass('public.sales') IS NOT NULL),
    ('public.payments', to_regclass('public.payments') IS NOT NULL),
    ('public.snp_conciliations', to_regclass('public.snp_conciliations') IS NOT NULL),
    ('public.snp_avoirs_client', to_regclass('public.snp_avoirs_client') IS NOT NULL),
    ('public.snp_conciliation_valider(uuid,uuid)',
      to_regprocedure('public.snp_conciliation_valider(uuid,uuid)') IS NOT NULL
      OR to_regprocedure('public.snp_conciliation_valider_pre_financial_sync(uuid,uuid)') IS NOT NULL),
    ('public.snp_4h_guard_payment_row()',
      to_regprocedure('public.snp_4h_guard_payment_row()') IS NOT NULL),
    ('public.snp_sync_sale_payment_summary(uuid)',
      to_regprocedure('public.snp_sync_sale_payment_summary(uuid)') IS NOT NULL)
  ) AS required(required_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight conciliation-finance : objets absents : %', v_missing;
  END IF;

  SELECT string_agg(format('%s.%s', table_name, column_name), ', '
                    ORDER BY table_name, column_name)
  INTO v_missing
  FROM (VALUES
    ('sales','id'),('sales','customer_id'),('sales','seller_id'),
    ('sales','currency'),('sales','final_proceeds'),('sales','payment_amount'),
    ('sales','status'),('sales','payment_received_at'),('sales','updated_at'),
    ('payments','id'),('payments','sale_id'),('payments','amount'),
    ('payments','currency'),('payments','status'),('payments','is_virtual'),
    ('payments','payment_type'),('payments','version'),
    ('snp_conciliations','id'),('snp_conciliations','sale_id'),
    ('snp_conciliations','customer_id'),('snp_conciliations','mining_company_id'),
    ('snp_conciliations','ca_final'),('snp_conciliations','devise_initiale'),
    ('snp_conciliations','devise_finale'),('snp_conciliations','statut'),
    ('snp_conciliations','valide_par'),
    ('snp_avoirs_client','id'),('snp_avoirs_client','customer_id'),
    ('snp_avoirs_client','mining_company_id'),
    ('snp_avoirs_client','conciliation_id'),
    ('snp_avoirs_client','sale_id_origine'),
    ('snp_avoirs_client','montant_initial'),('snp_avoirs_client','devise'),
    ('snp_avoirs_client','motif'),('snp_avoirs_client','statut'),
    ('snp_avoirs_client','created_by')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = required.table_name
      AND c.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight conciliation-finance : colonnes absentes : %', v_missing;
  END IF;

  SELECT a.conciliation_id
  INTO v_duplicate
  FROM public.snp_avoirs_client a
  WHERE a.conciliation_id IS NOT NULL
  GROUP BY a.conciliation_id
  HAVING count(*) > 1
  ORDER BY a.conciliation_id
  LIMIT 1;

  IF v_duplicate IS NOT NULL THEN
    RAISE EXCEPTION
      'Preflight conciliation-finance : plusieurs avoirs existent pour la conciliation %.',
      v_duplicate USING ERRCODE = '23514';
  END IF;

  SELECT a.devise
  INTO v_bad_currency
  FROM public.snp_avoirs_client a
  WHERE a.devise IS NULL OR a.devise !~ '^[A-Z]{3}$'
  ORDER BY a.created_at, a.id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Preflight conciliation-finance : devise d''avoir invalide (%).',
      coalesce(v_bad_currency, '<NULL>') USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.status IS NULL OR p.status NOT IN (
      'pending','processing','approved','rejected','cancelled','failed'
    )
  ) THEN
    RAISE EXCEPTION
      'Preflight conciliation-finance : un statut de paiement non canonique subsiste.'
      USING ERRCODE = '23514';
  END IF;
END;
$preflight$;

-- Le LOT 4H avait ajoute la contrainte canonique NOT VALID sans retirer
-- l'ancienne contrainte (pending/approved/rejected). Cette derniere rendait le
-- statut processing produit par la RPC inexecutable. On contracte maintenant
-- vers l'unique vocabulaire canonique, apres le preflight ci-dessus.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  VALIDATE CONSTRAINT payments_4h_canonical_status_check;

-- Une version antérieure du validateur pouvait laisser `devise_finale` vide
-- alors que la devise initiale et celle de la vente étaient déjà identiques.
-- Cette réparation est déterministe : aucune conversion ni devise n'est
-- inventée, et seules les conciliations possédant leur écriture historique
-- sont concernées.
UPDATE public.snp_conciliations conciliation
SET devise_finale = upper(btrim(conciliation.devise_initiale))
FROM public.sales sale
WHERE sale.id = conciliation.sale_id
  AND conciliation.devise_finale IS NULL
  AND upper(btrim(coalesce(conciliation.devise_initiale, ''))) ~ '^[A-Z]{3}$'
  AND upper(btrim(sale.currency)) = upper(btrim(conciliation.devise_initiale))
  AND EXISTS (
    SELECT 1
    FROM public.snp_grand_livre_commercial entry
    WHERE entry.conciliation_id = conciliation.id
      AND entry.type_mouvement = 'ajustement_conciliation'
  );

-- L'ecriture commerciale de conciliation la plus ancienne omettait la devise
-- et laissait donc le DEFAULT XOF s'appliquer. La normalisation est placee a la
-- frontiere du grand livre : quelle que soit la version du validateur appelee,
-- une ecriture de conciliation porte sa devise et sa conversion autoritatives.
CREATE OR REPLACE FUNCTION public.snp_normalize_conciliation_commercial_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_conciliation public.snp_conciliations%ROWTYPE;
  v_sale_currency text;
  v_currency text;
  v_rate numeric;
  v_rate_date date;
  v_rate_id uuid;
  v_pair text;
BEGIN
  IF NEW.type_mouvement <> 'ajustement_conciliation' THEN
    RETURN NEW;
  END IF;
  IF NEW.conciliation_id IS NULL THEN
    RAISE EXCEPTION 'Conciliation requise pour l ajustement commercial.'
      USING ERRCODE = '23514';
  END IF;

  SELECT c.* INTO v_conciliation
  FROM public.snp_conciliations c
  WHERE c.id = NEW.conciliation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conciliation commerciale introuvable.' USING ERRCODE = 'P0002';
  END IF;
  SELECT s.currency INTO v_sale_currency
  FROM public.sales s
  WHERE s.id = v_conciliation.sale_id;

  v_currency := upper(btrim(coalesce(v_conciliation.devise_finale, '')));
  IF v_currency !~ '^[A-Z]{3}$'
     OR v_conciliation.devise_initiale IS DISTINCT FROM v_currency
     OR v_conciliation.devise_finale IS DISTINCT FROM v_currency
     OR v_sale_currency IS DISTINCT FROM v_currency THEN
    RAISE EXCEPTION 'Devise contractuelle incoherente pour le grand livre commercial.'
      USING ERRCODE = '23514';
  END IF;

  IF v_currency = 'XOF' THEN
    v_rate := 1;
    NEW.source_taux := 'Parite XOF';
    NEW.taux_horodate := coalesce(NEW.created_at, clock_timestamp());
  ELSE
    IF v_conciliation.date_fixing IS NULL THEN
      RAISE EXCEPTION 'Date de fixing requise pour convertir %/XOF.', v_currency
        USING ERRCODE = '23514';
    END IF;
    SELECT f.rate, f.rate_date, f.id, f.currency_pair
    INTO v_rate, v_rate_date, v_rate_id, v_pair
    FROM public.fx_rates_daily f
    WHERE f.rate_date = v_conciliation.date_fixing
      AND f.currency_pair IN (v_currency || '/XOF', 'XOF/' || v_currency)
      AND f.rate > 0
      AND f.rate::text NOT IN ('NaN','Infinity','-Infinity')
    ORDER BY (f.currency_pair = v_currency || '/XOF') DESC,
             f.updated_at DESC, f.id
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Taux de conversion %/XOF absent a la date du fixing.', v_currency
        USING ERRCODE = '23514';
    END IF;
    v_rate := CASE WHEN v_pair = v_currency || '/XOF'
                   THEN v_rate ELSE 1 / v_rate END;
    NEW.source_taux := 'fx_rates_daily:' || v_rate_id::text;
    NEW.taux_horodate := v_rate_date::timestamp AT TIME ZONE 'UTC';
  END IF;

  NEW.devise := v_currency;
  NEW.taux_change := v_rate;
  NEW.montant_xof := round(NEW.montant * v_rate, 2);
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_normalize_conciliation_commercial_entry()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS snp_glc_normalize_conciliation_currency
  ON public.snp_grand_livre_commercial;
CREATE TRIGGER snp_glc_normalize_conciliation_currency
BEFORE INSERT ON public.snp_grand_livre_commercial
FOR EACH ROW EXECUTE FUNCTION public.snp_normalize_conciliation_commercial_entry();

-- Corrige sans creer de mouvement les eventuelles ecritures historiques ayant
-- recu le DEFAULT XOF. L'immuabilite est suspendue uniquement dans cette
-- transaction de migration et retablie avant validation de la contrainte.
DO $repair_commercial_entries$
DECLARE
  v_entry record;
  v_currency text;
  v_rate numeric;
  v_rate_date date;
  v_rate_id uuid;
  v_pair text;
  v_source text;
  v_timestamp timestamptz;
  v_has_immutability_trigger boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.snp_grand_livre_commercial'::regclass
      AND tgname = 'snp_glc_immuable' AND NOT tgisinternal
  ) INTO v_has_immutability_trigger;

  IF v_has_immutability_trigger THEN
    ALTER TABLE public.snp_grand_livre_commercial
      DISABLE TRIGGER snp_glc_immuable;
  END IF;

  FOR v_entry IN
    SELECT g.id, g.montant, g.devise, g.montant_xof, g.taux_change,
           g.source_taux, g.taux_horodate, g.created_at,
           c.devise_initiale, c.devise_finale, c.date_fixing,
           s.currency AS sale_currency
    FROM public.snp_grand_livre_commercial g
    JOIN public.snp_conciliations c ON c.id = g.conciliation_id
    JOIN public.sales s ON s.id = c.sale_id
    WHERE g.type_mouvement = 'ajustement_conciliation'
    ORDER BY g.id
    FOR UPDATE OF g
  LOOP
    v_currency := upper(btrim(coalesce(v_entry.devise_finale, '')));
    IF v_currency !~ '^[A-Z]{3}$'
       OR v_entry.devise_initiale IS DISTINCT FROM v_currency
       OR v_entry.devise_finale IS DISTINCT FROM v_currency
       OR v_entry.sale_currency IS DISTINCT FROM v_currency THEN
      RAISE EXCEPTION
        'Ecriture commerciale % : devise contractuelle incoherente.', v_entry.id
        USING ERRCODE = '23514';
    END IF;

    IF v_currency = 'XOF' THEN
      v_rate := 1;
      v_source := 'Parite XOF';
      v_timestamp := v_entry.created_at;
    ELSE
      IF v_entry.date_fixing IS NULL THEN
        RAISE EXCEPTION 'Ecriture commerciale % : date de fixing absente.', v_entry.id
          USING ERRCODE = '23514';
      END IF;
      SELECT f.rate, f.rate_date, f.id, f.currency_pair
      INTO v_rate, v_rate_date, v_rate_id, v_pair
      FROM public.fx_rates_daily f
      WHERE f.rate_date = v_entry.date_fixing
        AND f.currency_pair IN (v_currency || '/XOF', 'XOF/' || v_currency)
        AND f.rate > 0
        AND f.rate::text NOT IN ('NaN','Infinity','-Infinity')
      ORDER BY (f.currency_pair = v_currency || '/XOF') DESC,
               f.updated_at DESC, f.id
      LIMIT 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION
          'Ecriture commerciale % : taux %/XOF absent.', v_entry.id, v_currency
          USING ERRCODE = '23514';
      END IF;
      v_rate := CASE WHEN v_pair = v_currency || '/XOF'
                     THEN v_rate ELSE 1 / v_rate END;
      v_source := 'fx_rates_daily:' || v_rate_id::text;
      v_timestamp := v_rate_date::timestamp AT TIME ZONE 'UTC';
    END IF;

    IF v_entry.devise IS DISTINCT FROM v_currency
       OR v_entry.montant_xof IS DISTINCT FROM round(v_entry.montant * v_rate, 2)
       OR v_entry.taux_change IS DISTINCT FROM v_rate
       OR v_entry.source_taux IS DISTINCT FROM v_source
       OR v_entry.taux_horodate IS DISTINCT FROM v_timestamp THEN
      UPDATE public.snp_grand_livre_commercial
      SET devise = v_currency,
          montant_xof = round(v_entry.montant * v_rate, 2),
          taux_change = v_rate,
          source_taux = v_source,
          taux_horodate = v_timestamp
      WHERE id = v_entry.id;
    END IF;
  END LOOP;

  IF v_has_immutability_trigger THEN
    ALTER TABLE public.snp_grand_livre_commercial
      ENABLE TRIGGER snp_glc_immuable;
  END IF;
END;
$repair_commercial_entries$;

DO $commercial_currency_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.snp_grand_livre_commercial'::regclass
      AND conname = 'snp_glc_conciliation_currency_complete_check'
  ) THEN
    ALTER TABLE public.snp_grand_livre_commercial
      ADD CONSTRAINT snp_glc_conciliation_currency_complete_check CHECK (
        type_mouvement <> 'ajustement_conciliation'
        OR (
          conciliation_id IS NOT NULL
          AND devise ~ '^[A-Z]{3}$'
          AND montant_xof IS NOT NULL AND montant_xof >= 0
          AND taux_change IS NOT NULL AND taux_change > 0
          AND source_taux IS NOT NULL AND length(btrim(source_taux)) > 0
          AND taux_horodate IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END;
$commercial_currency_constraint$;

ALTER TABLE public.snp_grand_livre_commercial
  VALIDATE CONSTRAINT snp_glc_conciliation_currency_complete_check;

-- Une conciliation ne peut engendrer qu'une seule obligation envers le client.
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_avoirs_client_conciliation
  ON public.snp_avoirs_client (conciliation_id)
  WHERE conciliation_id IS NOT NULL;

DO $credit_currency_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.snp_avoirs_client'::regclass
      AND conname = 'snp_avoirs_client_devise_iso_check'
  ) THEN
    ALTER TABLE public.snp_avoirs_client
      ADD CONSTRAINT snp_avoirs_client_devise_iso_check
      CHECK (devise ~ '^[A-Z]{3}$') NOT VALID;
  END IF;
END;
$credit_currency_constraint$;

ALTER TABLE public.snp_avoirs_client
  VALIDATE CONSTRAINT snp_avoirs_client_devise_iso_check;

-- Journal prive : il est a la fois preuve d'audit et barriere d'idempotence.
CREATE TABLE IF NOT EXISTS public.snp_conciliation_financial_sync (
  conciliation_id uuid PRIMARY KEY
    REFERENCES public.snp_conciliations(id) ON DELETE RESTRICT,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  final_proceeds numeric NOT NULL CHECK (
    final_proceeds >= 0
    AND final_proceeds::text NOT IN ('NaN','Infinity','-Infinity')
  ),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  approved_payments numeric NOT NULL CHECK (approved_payments >= 0),
  active_payment_exposure numeric NOT NULL CHECK (active_payment_exposure >= 0),
  overpayment_amount numeric NOT NULL DEFAULT 0 CHECK (overpayment_amount >= 0),
  credit_id uuid REFERENCES public.snp_avoirs_client(id) ON DELETE RESTRICT,
  applied_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  response jsonb NOT NULL,
  CONSTRAINT snp_conciliation_financial_sync_credit_check CHECK (
    (overpayment_amount < 0.01 AND credit_id IS NULL)
    OR (overpayment_amount >= 0.01 AND credit_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_conciliation_financial_sync_sale
  ON public.snp_conciliation_financial_sync (sale_id, applied_at DESC);

ALTER TABLE public.snp_conciliation_financial_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_conciliation_financial_sync FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.snp_conciliation_financial_sync
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.snp_conciliation_financial_sync TO service_role;

-- La fonction historique devient un helper prive. ALTER FUNCTION preserve son
-- OID et ses dependances ; la facade publique est recreee plus bas.
DO $preserve_validator$
BEGIN
  IF to_regprocedure(
       'public.snp_conciliation_valider_pre_financial_sync(uuid,uuid)'
     ) IS NULL THEN
    IF to_regprocedure('public.snp_conciliation_valider(uuid,uuid)') IS NULL THEN
      RAISE EXCEPTION 'RPC de validation de conciliation introuvable.';
    END IF;
    ALTER FUNCTION public.snp_conciliation_valider(uuid,uuid)
      RENAME TO snp_conciliation_valider_pre_financial_sync;
  END IF;
END;
$preserve_validator$;

ALTER FUNCTION public.snp_conciliation_valider_pre_financial_sync(uuid,uuid)
  SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp';
REVOKE ALL ON FUNCTION
  public.snp_conciliation_valider_pre_financial_sync(uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Synchronisation interne. Tous les chemins de paiement prennent egalement le
-- verrou de vente : ce verrou constitue donc la frontiere de serialisation.
CREATE OR REPLACE FUNCTION public.snp_apply_validated_conciliation_financials(
  p_conciliation_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_conciliation public.snp_conciliations%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_existing public.snp_conciliation_financial_sync%ROWTYPE;
  v_credit public.snp_avoirs_client%ROWTYPE;
  v_pending public.payments%ROWTYPE;
  v_currency text;
  v_final numeric;
  v_approved numeric;
  v_active numeric;
  v_overpayment numeric;
  v_remaining numeric;
  v_pending_count integer;
  v_financial_status text;
  v_response jsonb;
BEGIN
  IF p_conciliation_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant de conciliation requis.' USING ERRCODE = '22023';
  END IF;

  -- Ordre global obligatoire : conciliation, puis vente.
  SELECT * INTO v_conciliation
  FROM public.snp_conciliations c
  WHERE c.id = p_conciliation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conciliation introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = v_conciliation.sale_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente parente introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF v_conciliation.statut NOT IN (
    'validee', 'facture_definitive_generee', 'cloturee'
  ) THEN
    RAISE EXCEPTION
      'La conciliation % n''est pas validee (statut %).',
      v_conciliation.reference, v_conciliation.statut
      USING ERRCODE = '23514';
  END IF;

  IF v_conciliation.ca_final IS NULL
     OR v_conciliation.ca_final < 0
     OR v_conciliation.ca_final::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Montant final de conciliation invalide.' USING ERRCODE = '23514';
  END IF;
  v_final := v_conciliation.ca_final;

  v_currency := upper(btrim(coalesce(
    v_conciliation.devise_finale,
    v_conciliation.devise_initiale,
    ''
  )));
  IF v_currency !~ '^[A-Z]{3}$'
     OR v_conciliation.devise_initiale IS DISTINCT FROM v_currency
     OR v_conciliation.devise_finale IS DISTINCT FROM v_currency
     OR v_sale.currency IS DISTINCT FROM v_currency THEN
    RAISE EXCEPTION
      'La devise doit etre explicite et identique sur la conciliation et la vente (% / % / %).',
      coalesce(v_conciliation.devise_initiale, '<NULL>'),
      coalesce(v_conciliation.devise_finale, '<NULL>'),
      coalesce(v_sale.currency, '<NULL>')
      USING ERRCODE = '23514';
  END IF;

  IF v_conciliation.customer_id IS NOT NULL
     AND v_conciliation.customer_id IS DISTINCT FROM v_sale.customer_id THEN
    RAISE EXCEPTION 'Client de conciliation incoherent avec la vente.'
      USING ERRCODE = '23514';
  END IF;
  IF v_conciliation.mining_company_id IS NULL THEN
    RAISE EXCEPTION 'Societe d''origine de la conciliation absente.'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_existing
  FROM public.snp_conciliation_financial_sync f
  WHERE f.conciliation_id = p_conciliation_id;
  IF FOUND THEN
    IF v_existing.sale_id IS DISTINCT FROM v_sale.id
       OR v_existing.final_proceeds IS DISTINCT FROM v_final
       OR v_existing.currency IS DISTINCT FROM v_currency
       OR v_sale.final_proceeds IS DISTINCT FROM v_final
       OR v_sale.currency IS DISTINCT FROM v_currency THEN
      RAISE EXCEPTION
        'La synchronisation financiere precedente diverge de la conciliation.'
        USING ERRCODE = '23514';
    END IF;
    RETURN v_existing.response || jsonb_build_object('replayed', true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.sale_id = v_sale.id
      AND p.is_virtual IS FALSE
      AND p.status IN ('processing','approved')
      AND p.currency IS DISTINCT FROM v_currency
  ) THEN
    RAISE EXCEPTION
      'Un paiement actif n''est pas exprime dans la devise de reglement %.',
      v_currency USING ERRCODE = '23514';
  END IF;

  SELECT
    coalesce(sum(p.amount) FILTER (
      WHERE p.is_virtual IS FALSE AND p.status = 'approved'
    ), 0),
    coalesce(sum(p.amount) FILTER (
      WHERE p.is_virtual IS FALSE
        AND p.status IN ('processing','approved')
    ), 0)
  INTO v_approved, v_active
  FROM public.payments p
  WHERE p.sale_id = v_sale.id;

  IF v_approved < 0 OR v_active < 0
     OR v_approved::text IN ('NaN','Infinity','-Infinity')
     OR v_active::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Cumul de paiements actif invalide.' USING ERRCODE = '23514';
  END IF;

  v_approved := round(v_approved, 2);
  v_active := round(v_active, 2);
  v_overpayment := greatest(round(v_approved - v_final, 2), 0);
  v_remaining := greatest(round(v_final - v_active, 2), 0);

  SELECT count(*) INTO v_pending_count
  FROM public.payments p
  WHERE p.sale_id = v_sale.id AND p.status = 'pending';
  IF v_pending_count > 1 THEN
    RAISE EXCEPTION
      'Plusieurs engagements de paiement en attente existent pour la vente %.',
      v_sale.sale_number USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_pending
  FROM public.payments p
  WHERE p.sale_id = v_sale.id AND p.status = 'pending'
  ORDER BY p.is_virtual DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id
  LIMIT 1
  FOR UPDATE;

  IF v_pending.id IS NOT NULL
     AND (v_pending.is_virtual IS DISTINCT FROM true
          OR coalesce(v_pending.payment_type, '') <> 'virtual') THEN
    RAISE EXCEPTION 'L''engagement restant n''est pas un paiement virtuel.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('sonasp.conciliation_financial_sync', '1', true);
  PERFORM set_config('sonasp.payment_4h_rpc', '1', true);
  BEGIN
    IF v_pending.id IS NOT NULL THEN
      IF v_remaining < 0.01 THEN
        UPDATE public.payments
        SET status = 'cancelled',
            cancellation_reason = concat_ws(
              E'\n', nullif(cancellation_reason, ''),
              'Engagement solde par la conciliation definitive.'
            ),
            cancelled_by = coalesce(p_actor_id, cancelled_by),
            cancelled_at = clock_timestamp(),
            version = version + 1
        WHERE id = v_pending.id;
      ELSE
        UPDATE public.payments
        SET amount = v_remaining,
            currency = v_currency,
            version = version + 1
        WHERE id = v_pending.id;
      END IF;
    END IF;

    IF v_overpayment >= 0.01 THEN
      INSERT INTO public.snp_avoirs_client (
        reference, customer_id, mining_company_id, conciliation_id,
        sale_id_origine, montant_initial, devise, motif, statut, created_by
      ) VALUES (
        NULL, v_sale.customer_id, v_conciliation.mining_company_id,
        v_conciliation.id, v_sale.id, v_overpayment, v_currency,
        format(
          'Trop-percu constate apres validation de la conciliation %s.',
          v_conciliation.reference
        ),
        'disponible', p_actor_id
      )
      ON CONFLICT (conciliation_id) WHERE conciliation_id IS NOT NULL
      DO NOTHING
      RETURNING * INTO v_credit;

      IF v_credit.id IS NULL THEN
        SELECT * INTO v_credit
        FROM public.snp_avoirs_client a
        WHERE a.conciliation_id = v_conciliation.id
        FOR UPDATE;
      END IF;

      IF v_credit.id IS NULL
         OR v_credit.customer_id IS DISTINCT FROM v_sale.customer_id
         OR v_credit.mining_company_id IS DISTINCT FROM v_conciliation.mining_company_id
         OR v_credit.sale_id_origine IS DISTINCT FROM v_sale.id
         OR v_credit.montant_initial IS DISTINCT FROM v_overpayment
         OR v_credit.devise IS DISTINCT FROM v_currency THEN
        RAISE EXCEPTION
          'L''avoir existant de la conciliation est incoherent.'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    v_financial_status := CASE
      WHEN v_approved >= v_final - 0.01 THEN 'payment_received'
      WHEN v_active > 0 OR v_remaining > 0 THEN 'virtual_payment'
      ELSE 'waiting_for_payment'
    END;

    UPDATE public.sales
    SET final_proceeds = v_final,
        payment_amount = v_active,
        status = CASE
          WHEN status::text IN (
            'waiting_for_payment','virtual_payment','payment_received'
          ) THEN v_financial_status::public.sale_status
          ELSE status
        END,
        payment_received_at = CASE
          WHEN status::text IN (
            'waiting_for_payment','virtual_payment','payment_received'
          ) AND v_financial_status = 'payment_received'
            THEN coalesce(payment_received_at, clock_timestamp())
          WHEN status::text IN (
            'waiting_for_payment','virtual_payment','payment_received'
          ) THEN NULL
          ELSE payment_received_at
        END,
        updated_at = clock_timestamp()
    WHERE id = v_sale.id;

    v_response := jsonb_build_object(
      'conciliation_id', v_conciliation.id,
      'sale_id', v_sale.id,
      'final_proceeds', v_final,
      'currency', v_currency,
      'approved_payments', v_approved,
      'active_payment_exposure', v_active,
      'remaining_balance', v_remaining,
      'overpayment_amount', v_overpayment,
      'credit_id', v_credit.id,
      'sale_financial_status', v_financial_status,
      'replayed', false
    );

    INSERT INTO public.snp_conciliation_financial_sync (
      conciliation_id, sale_id, final_proceeds, currency,
      approved_payments, active_payment_exposure, overpayment_amount,
      credit_id, applied_by, response
    ) VALUES (
      v_conciliation.id, v_sale.id, v_final, v_currency,
      v_approved, v_active, v_overpayment,
      v_credit.id, p_actor_id, v_response
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.payment_4h_rpc', '0', true);
    PERFORM set_config('sonasp.conciliation_financial_sync', '0', true);
    RAISE;
  END;
  PERFORM set_config('sonasp.payment_4h_rpc', '0', true);
  PERFORM set_config('sonasp.conciliation_financial_sync', '0', true);

  RETURN v_response;
END;
$fn$;

REVOKE ALL ON FUNCTION
  public.snp_apply_validated_conciliation_financials(uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Renforce la garde canonique des paiements. Le controle est execute avant le
-- marker d'autorisation afin que meme les RPC historiques ne puissent depasser
-- le nouveau total definitif.
CREATE OR REPLACE FUNCTION public.snp_4h_guard_payment_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_sale_status text;
  v_sale_currency text;
  v_final numeric;
  v_other_active numeric;
  v_is_active_real boolean := false;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_is_active_real := NEW.status IN ('processing','approved')
      AND coalesce(NEW.payment_type, '') NOT IN ('virtual','pending');

    IF v_is_active_real THEN
      IF NEW.is_virtual IS DISTINCT FROM false
         OR NEW.amount IS NULL OR NEW.amount <= 0
         OR NEW.amount::text IN ('NaN','Infinity','-Infinity')
         OR NEW.currency IS NULL OR NEW.currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Paiement actif reel ou devise invalide.'
          USING ERRCODE = '23514';
      END IF;

      SELECT s.status::text, s.currency, s.final_proceeds
      INTO v_sale_status, v_sale_currency, v_final
      FROM public.sales s
      WHERE s.id = NEW.sale_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Vente parente introuvable.' USING ERRCODE = 'P0002';
      END IF;
      IF v_sale_currency IS DISTINCT FROM NEW.currency
         OR v_final IS NULL OR v_final < 0
         OR v_final::text IN ('NaN','Infinity','-Infinity') THEN
        RAISE EXCEPTION 'Paiement hors devise ou montant final de vente invalide.'
          USING ERRCODE = '23514';
      END IF;

      SELECT coalesce(sum(p.amount), 0)
      INTO v_other_active
      FROM public.payments p
      WHERE p.sale_id = NEW.sale_id
        AND p.id IS DISTINCT FROM NEW.id
        AND p.is_virtual IS FALSE
        AND p.status IN ('processing','approved');

      IF v_other_active + NEW.amount > v_final THEN
        RAISE EXCEPTION
          'Le cumul des paiements actifs (% %) depasse le montant final (% %).',
          round(v_other_active + NEW.amount, 2), NEW.currency,
          v_final, v_sale_currency USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF current_setting('sonasp.payment_4h_rpc', true) = '1'
     AND current_user NOT IN ('anon','authenticated') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT'
     AND current_user NOT IN ('anon','authenticated')
     AND coalesce(auth.role(), '') = 'authenticated'
     AND NEW.is_virtual IS TRUE
     AND coalesce(NEW.status, 'pending') = 'pending'
     AND NEW.created_by = auth.uid() THEN
    SELECT status::text INTO v_sale_status
    FROM public.sales WHERE id = NEW.sale_id;
    IF v_sale_status = 'pending_for_customer_approval' THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Utilisez les RPC atomiques de paiement international.'
    USING ERRCODE = '42501';
END;
$fn$;

-- Une fois la conciliation synchronisee, montant final et devise sont figes.
CREATE OR REPLACE FUNCTION public.snp_guard_reconciled_sale_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.final_proceeds IS NOT DISTINCT FROM OLD.final_proceeds
     AND NEW.currency IS NOT DISTINCT FROM OLD.currency THEN
    RETURN NEW;
  END IF;

  IF current_setting('sonasp.conciliation_financial_sync', true) = '1'
     AND current_user NOT IN ('anon','authenticated') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.snp_conciliations c
    WHERE c.sale_id = OLD.id
      AND c.statut IN ('validee','facture_definitive_generee','cloturee')
  ) OR EXISTS (
    SELECT 1
    FROM public.snp_conciliation_financial_sync f
    WHERE f.sale_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'Le montant final et la devise sont figes par la conciliation validee.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_reconciled_sale_financials_guard ON public.sales;
CREATE TRIGGER snp_reconciled_sale_financials_guard
BEFORE UPDATE OF final_proceeds, currency ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_reconciled_sale_financials();

REVOKE ALL ON FUNCTION public.snp_guard_reconciled_sale_financials()
  FROM PUBLIC, anon, authenticated, service_role;

-- Facade stable : le traitement historique et la synchronisation financiere
-- appartiennent a la meme transaction SQL.
CREATE OR REPLACE FUNCTION public.snp_conciliation_valider(
  p_conciliation_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_business_result jsonb;
  v_financial_result jsonb;
BEGIN
  v_business_result :=
    public.snp_conciliation_valider_pre_financial_sync(
      p_conciliation_id, p_idempotency_key
    );
  v_financial_result :=
    public.snp_apply_validated_conciliation_financials(
      p_conciliation_id, auth.uid()
    );

  RETURN coalesce(v_business_result, '{}'::jsonb)
    || jsonb_build_object('synchronisation_financiere', v_financial_result);
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_conciliation_valider(uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snp_conciliation_valider(uuid,uuid)
  TO authenticated;

-- Backfill des conciliations deja finalisees. En cas d'incoherence historique,
-- la migration echoue entierement au lieu de fabriquer une correction muette.
DO $backfill$
DECLARE
  v_conciliation record;
BEGIN
  FOR v_conciliation IN
    SELECT c.id, c.valide_par
    FROM public.snp_conciliations c
    WHERE c.statut IN ('validee','facture_definitive_generee','cloturee')
    ORDER BY c.id
  LOOP
    PERFORM public.snp_apply_validated_conciliation_financials(
      v_conciliation.id, v_conciliation.valide_par
    );
  END LOOP;
END;
$backfill$;

COMMENT ON TABLE public.snp_conciliation_financial_sync IS
  'Journal prive et idempotent de propagation conciliation -> vente/paiements/avoir.';
COMMENT ON FUNCTION public.snp_apply_validated_conciliation_financials(uuid,uuid) IS
  'Synchronise sous verrous ca_final, solde et avoir apres validation ; helper interne.';
COMMENT ON FUNCTION public.snp_conciliation_valider(uuid,uuid) IS
  'Valide une conciliation et synchronise atomiquement son montant final avec la vente et les paiements.';

DO $postflight$
BEGIN
  IF to_regprocedure(
       'public.snp_conciliation_valider_pre_financial_sync(uuid,uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.snp_apply_validated_conciliation_financials(uuid,uuid)'
     ) IS NULL
     OR to_regprocedure('public.snp_conciliation_valider(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Postflight conciliation-finance : fonctions absentes.';
  END IF;

  IF has_function_privilege(
       'authenticated',
       'public.snp_apply_validated_conciliation_financials(uuid,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.snp_conciliation_valider_pre_financial_sync(uuid,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Postflight conciliation-finance : helper interne expose.';
  END IF;

  IF NOT has_function_privilege(
       'authenticated', 'public.snp_conciliation_valider(uuid,uuid)', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Postflight conciliation-finance : facade non executable.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.sales'::regclass
      AND tgname = 'snp_reconciled_sale_financials_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Postflight conciliation-finance : garde de vente absente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.payments'::regclass
      AND tgname = 'snp_payments_99_sync_sale_summary'
      AND NOT tgisinternal AND tgdeferrable AND tginitdeferred
  ) THEN
    RAISE EXCEPTION
      'Postflight conciliation-finance : synchronisation differee des paiements absente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_snp_avoirs_client_conciliation'
      AND indexdef ILIKE '%UNIQUE%conciliation_id%WHERE%'
  ) THEN
    RAISE EXCEPTION 'Postflight conciliation-finance : unicite avoir absente.';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';

COMMIT;
