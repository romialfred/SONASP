-- Projection agrégée et sécurisée du tableau de collecte fiscale DGI.
--
-- Le navigateur DGI ne lit aucune table fiscale brute. Cette fonction expose
-- uniquement les agrégats nécessaires au contrôle national : montants, natures,
-- opérateurs contributeurs et échéances. Les preuves de paiement, coordonnées
-- bancaires, notes privées et acteurs d'exécution ne quittent jamais la base.

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.snp_dgi_has_active_fiscal_scope()') IS NULL
     OR to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL
     OR to_regclass('public.snp_grand_livre_fiscal') IS NULL
     OR to_regclass('public.snp_artisan_taxes_retenues') IS NULL
     OR to_regclass('public.snp_artisan_paiements') IS NULL
     OR to_regclass('public.snp_artisan_factures_definitives') IS NULL
     OR to_regclass('public.snp_rpc_execution_allowlist') IS NULL THEN
    RAISE EXCEPTION 'Préflight portail DGI : dépendance fiscale ou IAM absente.';
  END IF;
END;
$preflight$;

CREATE INDEX IF NOT EXISTS idx_snp_glf_dgi_dashboard
  ON public.snp_grand_livre_fiscal(created_at, sens, type_mouvement);
CREATE INDEX IF NOT EXISTS idx_snp_artisan_taxes_dgi_dashboard
  ON public.snp_artisan_taxes_retenues(created_at, statut_reversement);
CREATE INDEX IF NOT EXISTS idx_snp_artisan_paiements_dgi_dashboard
  ON public.snp_artisan_paiements(created_at, statut);

CREATE OR REPLACE FUNCTION public.snp_dgi_charger_tableau_collecte(
  p_date_debut date,
  p_date_fin date
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $fn$
DECLARE
  v_duree integer;
  v_debut_precedent date;
  v_fin_precedent date;
  v_resultat jsonb;
BEGIN
  IF NOT public.snp_dgi_has_active_fiscal_scope()
     OR NOT public.snp_actor_can_module_action('dashboard', 'view') THEN
    RAISE EXCEPTION 'Périmètre fiscal DGI et module Tableau de bord requis.'
      USING ERRCODE = '42501';
  END IF;

  IF p_date_debut IS NULL OR p_date_fin IS NULL
     OR p_date_fin < p_date_debut
     OR p_date_fin - p_date_debut > 1095 THEN
    RAISE EXCEPTION 'Période fiscale invalide ou supérieure à trois ans.'
      USING ERRCODE = '22023';
  END IF;

  v_duree := p_date_fin - p_date_debut + 1;
  v_fin_precedent := p_date_debut - 1;
  v_debut_precedent := p_date_debut - v_duree;

  WITH
  expected_events AS (
    SELECT
      ledger.id::text AS event_id,
      ledger.created_at::date AS event_date,
      ledger.code_taxe AS tax_code,
      CASE ledger.code_taxe
        WHEN 'royalties' THEN 'Redevances minières'
        WHEN 'tva' THEN 'TVA'
        WHEN 'retenue_source' THEN 'Retenues à la source'
        WHEN 'fndl' THEN 'FNDL'
        WHEN 'taxe_communale' THEN 'Taxe communale'
        ELSE ledger.code_taxe
      END AS tax_label,
      ledger.montant AS amount,
      'mine:' || ledger.mining_company_id::text AS contributor_id,
      company.name AS contributor_name,
      'ledger:' || coalesce(ledger.calcul_id::text, ledger.id::text) AS declaration_id
    FROM public.snp_grand_livre_fiscal ledger
    JOIN public.mining_companies company ON company.id = ledger.mining_company_id
    WHERE ledger.sens = 'debit'
      AND upper(ledger.devise) = 'XOF'
      AND ledger.type_mouvement IN ('taxe_provisoire', 'ajustement_conciliation')
      AND NOT EXISTS (
        SELECT 1 FROM public.snp_grand_livre_fiscal reversal
        WHERE reversal.reverses_entry_id = ledger.id
      )
      AND ledger.created_at::date BETWEEN p_date_debut AND p_date_fin

    UNION ALL

    SELECT
      tax.id::text,
      tax.created_at::date,
      'artisan_' || tax.type_taxe::text,
      CASE tax.type_taxe::text
        WHEN 'tva' THEN 'TVA'
        WHEN 'retenue_source' THEN 'Retenues à la source'
        WHEN 'taxe_municipale' THEN 'Taxe communale'
        WHEN 'taxe_regionale' THEN 'Taxe régionale'
        ELSE coalesce(nullif(trim(tax.libelle_taxe), ''), 'Autres taxes')
      END,
      tax.montant_taxe,
      'comptoir:' || coalesce(tax.comptoir_organization_id::text, 'non-rattache'),
      coalesce(organization.name, 'Comptoir non libellé'),
      'artisan:' || tax.paiement_id::text
    FROM public.snp_artisan_taxes_retenues tax
    LEFT JOIN public.snp_organizations organization
      ON organization.id = tax.comptoir_organization_id
    WHERE tax.statut_reversement IS DISTINCT FROM 'annule'
      AND tax.created_at::date BETWEEN p_date_debut AND p_date_fin
  ),
  collected_events AS (
    SELECT
      ledger.id::text AS event_id,
      ledger.created_at::date AS event_date,
      ledger.code_taxe AS tax_code,
      CASE ledger.code_taxe
        WHEN 'royalties' THEN 'Redevances minières'
        WHEN 'tva' THEN 'TVA'
        WHEN 'retenue_source' THEN 'Retenues à la source'
        WHEN 'fndl' THEN 'FNDL'
        WHEN 'taxe_communale' THEN 'Taxe communale'
        ELSE ledger.code_taxe
      END AS tax_label,
      ledger.montant AS amount,
      'mine:' || ledger.mining_company_id::text AS contributor_id,
      company.name AS contributor_name
    FROM public.snp_grand_livre_fiscal ledger
    JOIN public.mining_companies company ON company.id = ledger.mining_company_id
    WHERE ledger.sens = 'credit'
      AND upper(ledger.devise) = 'XOF'
      AND ledger.type_mouvement = 'reversement'
      AND NOT EXISTS (
        SELECT 1 FROM public.snp_grand_livre_fiscal reversal
        WHERE reversal.reverses_entry_id = ledger.id
      )
      AND ledger.created_at::date BETWEEN v_debut_precedent AND p_date_fin

    UNION ALL

    SELECT
      tax.id::text,
      coalesce(tax.date_reversement, tax.updated_at, tax.created_at)::date,
      'artisan_' || tax.type_taxe::text,
      CASE tax.type_taxe::text
        WHEN 'tva' THEN 'TVA'
        WHEN 'retenue_source' THEN 'Retenues à la source'
        WHEN 'taxe_municipale' THEN 'Taxe communale'
        WHEN 'taxe_regionale' THEN 'Taxe régionale'
        ELSE coalesce(nullif(trim(tax.libelle_taxe), ''), 'Autres taxes')
      END,
      tax.montant_taxe,
      'comptoir:' || coalesce(tax.comptoir_organization_id::text, 'non-rattache'),
      coalesce(organization.name, 'Comptoir non libellé')
    FROM public.snp_artisan_taxes_retenues tax
    LEFT JOIN public.snp_organizations organization
      ON organization.id = tax.comptoir_organization_id
    WHERE tax.statut_reversement IN ('reverse', 'comptabilise')
      AND coalesce(tax.date_reversement, tax.updated_at, tax.created_at)::date
        BETWEEN v_debut_precedent AND p_date_fin
  ),
  current_collected AS (
    SELECT * FROM collected_events
    WHERE event_date BETWEEN p_date_debut AND p_date_fin
  ),
  previous_collected AS (
    SELECT coalesce(sum(amount), 0)::numeric AS amount
    FROM collected_events
    WHERE event_date BETWEEN v_debut_precedent AND v_fin_precedent
  ),
  summary AS (
    SELECT
      (SELECT coalesce(sum(amount), 0)::numeric FROM expected_events) AS expected_amount,
      (SELECT coalesce(sum(amount), 0)::numeric FROM current_collected) AS collected_amount,
      (SELECT amount FROM previous_collected) AS previous_collected_amount,
      (SELECT count(DISTINCT declaration_id)::bigint FROM expected_events) AS declaration_count,
      EXISTS (SELECT 1 FROM expected_events) OR EXISTS (SELECT 1 FROM current_collected) AS has_data
  ),
  months AS (
    SELECT month_start::date
    FROM generate_series(
      date_trunc('month', p_date_debut::timestamp),
      date_trunc('month', p_date_fin::timestamp),
      interval '1 month'
    ) month_start
  ),
  monthly AS (
    SELECT
      to_char(month.month_start, 'YYYY-MM') AS month,
      CASE extract(month FROM month.month_start)::integer
        WHEN 1 THEN 'Janv.' WHEN 2 THEN 'Févr.' WHEN 3 THEN 'Mars'
        WHEN 4 THEN 'Avr.' WHEN 5 THEN 'Mai' WHEN 6 THEN 'Juin'
        WHEN 7 THEN 'Juil.' WHEN 8 THEN 'Août' WHEN 9 THEN 'Sept.'
        WHEN 10 THEN 'Oct.' WHEN 11 THEN 'Nov.' ELSE 'Déc.'
      END || ' ' || extract(year FROM month.month_start)::integer AS label,
      coalesce((SELECT sum(event.amount) FROM expected_events event
                WHERE date_trunc('month', event.event_date) = month.month_start), 0)::numeric AS expected_amount,
      coalesce((SELECT sum(event.amount) FROM current_collected event
                WHERE date_trunc('month', event.event_date) = month.month_start), 0)::numeric AS collected_amount
    FROM months month
  ),
  tax_breakdown AS (
    SELECT
      event.tax_code AS code,
      event.tax_label AS label,
      sum(event.amount)::numeric AS amount
    FROM current_collected event
    GROUP BY event.tax_code, event.tax_label
  ),
  contributors AS (
    SELECT event.contributor_id AS id, event.contributor_name AS name,
           sum(event.amount)::numeric AS amount
    FROM current_collected event
    GROUP BY event.contributor_id, event.contributor_name
    ORDER BY amount DESC, name
    LIMIT 5
  ),
  priorities AS (
    SELECT
      tax.id::text AS id,
      coalesce(organization.name, 'Comptoir non libellé') AS operator_name,
      CASE tax.type_taxe::text
        WHEN 'tva' THEN 'TVA'
        WHEN 'retenue_source' THEN 'Retenues à la source'
        WHEN 'taxe_municipale' THEN 'Taxe communale'
        WHEN 'taxe_regionale' THEN 'Taxe régionale'
        ELSE coalesce(nullif(trim(tax.libelle_taxe), ''), 'Autres taxes')
      END AS tax_nature,
      tax.montant_taxe::numeric AS amount_due,
      invoice.date_echeance::date AS due_date,
      CASE
        WHEN invoice.date_echeance::date < current_date THEN 'high'
        WHEN invoice.date_echeance::date <= current_date + 15 THEN 'watch'
        ELSE 'normal'
      END AS priority
    FROM public.snp_artisan_taxes_retenues tax
    JOIN public.snp_artisan_factures_definitives invoice ON invoice.id = tax.facture_id
    LEFT JOIN public.snp_organizations organization
      ON organization.id = tax.comptoir_organization_id
    WHERE tax.statut_reversement NOT IN ('reverse', 'comptabilise', 'annule')
      AND invoice.date_echeance IS NOT NULL
      AND tax.created_at::date <= p_date_fin
    ORDER BY
      CASE
        WHEN invoice.date_echeance::date < current_date THEN 1
        WHEN invoice.date_echeance::date <= current_date + 15 THEN 2
        ELSE 3
      END,
      invoice.date_echeance,
      tax.montant_taxe DESC
    LIMIT 8
  ),
  counters AS (
    SELECT
      (SELECT count(*)::bigint
       FROM public.snp_artisan_paiements payment
       WHERE payment.statut IN ('en_traitement', 'valide')
         AND payment.created_at::date BETWEEN p_date_debut AND p_date_fin) AS payments_to_reconcile,
      (SELECT count(DISTINCT ledger.conciliation_id)::bigint
       FROM public.snp_grand_livre_fiscal ledger
       WHERE ledger.conciliation_id IS NOT NULL
         AND ledger.type_mouvement = 'ajustement_conciliation'
         AND ledger.created_at::date BETWEEN p_date_debut AND p_date_fin) AS assessment_gaps
  ),
  source_health AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.snp_grand_livre_fiscal ledger
      WHERE upper(ledger.devise) <> 'XOF'
        AND ledger.created_at::date BETWEEN v_debut_precedent AND p_date_fin
    ) AS has_unsupported_currency
  )
  SELECT jsonb_build_object(
    'has_data', summary.has_data,
    'partial', source_health.has_unsupported_currency,
    'period', jsonb_build_object(
      'start_date', p_date_debut,
      'end_date', p_date_fin
    ),
    'summary', jsonb_build_object(
      'expected_amount', summary.expected_amount,
      'collected_amount', summary.collected_amount,
      'previous_collected_amount', summary.previous_collected_amount,
      'declaration_count', summary.declaration_count
    ),
    'monthly', CASE WHEN summary.has_data THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'month', monthly.month,
        'label', monthly.label,
        'expected_amount', monthly.expected_amount,
        'collected_amount', monthly.collected_amount
      ) ORDER BY monthly.month) FROM monthly
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'tax_breakdown', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'code', item.code,
        'label', item.label,
        'amount', item.amount,
        'share_percent', CASE WHEN summary.collected_amount > 0
          THEN round(item.amount / summary.collected_amount * 100, 2) ELSE NULL END
      ) ORDER BY item.amount DESC, item.label)
      FROM tax_breakdown item
    ), '[]'::jsonb),
    'contributors', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', item.id,
        'name', item.name,
        'amount', item.amount
      ) ORDER BY item.amount DESC, item.name)
      FROM contributors item
    ), '[]'::jsonb),
    'priorities', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', item.id,
        'operator_name', item.operator_name,
        'tax_nature', item.tax_nature,
        'amount_due', item.amount_due,
        'due_date', item.due_date,
        'priority', item.priority
      ) ORDER BY
        CASE item.priority WHEN 'high' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END,
        item.due_date,
        item.amount_due DESC)
      FROM priorities item
    ), '[]'::jsonb),
    'counters', jsonb_build_object(
      'payments_to_reconcile', counters.payments_to_reconcile,
      -- Aucun référentiel d'échéance déclarative n'existe actuellement : NULL
      -- signifie « non calculable », jamais zéro.
      'late_declarations', NULL,
      'assessment_gaps', counters.assessment_gaps
    ),
    -- Aucun objectif DGI versionné n'existe dans le référentiel courant.
    'objective_rate', NULL
  )
  INTO v_resultat
  FROM summary CROSS JOIN counters CROSS JOIN source_health;

  RETURN v_resultat;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_dgi_charger_tableau_collecte(date, date)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snp_dgi_charger_tableau_collecte(date, date)
TO authenticated;

INSERT INTO public.snp_rpc_execution_allowlist(
  function_signature, function_name, grantee, purpose, migration_version
)
SELECT procedure.oid::regprocedure::text,
       procedure.proname,
       'authenticated',
       'runtime-browser',
       '20260904200000'
FROM pg_catalog.pg_proc procedure
WHERE procedure.oid = 'public.snp_dgi_charger_tableau_collecte(date,date)'::regprocedure
ON CONFLICT(function_signature, grantee) DO UPDATE SET
  function_name = EXCLUDED.function_name,
  purpose = EXCLUDED.purpose,
  migration_version = EXCLUDED.migration_version;

DO $postflight$
BEGIN
  IF has_function_privilege('anon',
       'public.snp_dgi_charger_tableau_collecte(date,date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated',
       'public.snp_dgi_charger_tableau_collecte(date,date)', 'EXECUTE')
     OR NOT EXISTS (
       SELECT 1 FROM public.snp_rpc_execution_allowlist
       WHERE function_signature =
         'public.snp_dgi_charger_tableau_collecte(date,date)'::regprocedure::text
         AND grantee = 'authenticated'
         AND purpose = 'runtime-browser'
         AND migration_version = '20260904200000'
     ) THEN
    RAISE EXCEPTION 'Postflight portail DGI : exposition RPC incohérente.';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';

COMMIT;
