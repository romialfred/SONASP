-- Projection agrégée et sécurisée du tableau de bord réglementaire DGMG.
--
-- Le navigateur ne lit plus directement les tables de sociétés, sites et
-- productions. La RPC expose seulement les indicateurs, séries et activités
-- nécessaires à la supervision. Les dimensions sans référentiel fiable restent
-- NULL : elles ne sont jamais déduites d'un statut métier sans rapport.

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
     OR to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL
     OR to_regprocedure('public.snp_dgmg_can_validate_reserve_level_1()') IS NULL
     OR to_regclass('public.user_profiles') IS NULL
     OR to_regclass('public.snp_user_organization_memberships') IS NULL
     OR to_regclass('public.snp_organizations') IS NULL
     OR to_regclass('public.mining_companies') IS NULL
     OR to_regclass('public.artisanal_sites') IS NULL
     OR to_regclass('public.artisanal_site_productions') IS NULL
     OR to_regclass('public.daily_production') IS NULL
     OR to_regclass('public.export_licenses') IS NULL
     OR to_regclass('public.snp_reserve_allocations') IS NULL
     OR to_regclass('public.snp_rpc_execution_allowlist') IS NULL THEN
    RAISE EXCEPTION 'Préflight portail DGMG : dépendance réglementaire ou IAM absente.';
  END IF;
END;
$preflight$;

CREATE INDEX IF NOT EXISTS idx_daily_production_dgmg_dashboard
  ON public.daily_production(production_date, mining_company_id, status);
CREATE INDEX IF NOT EXISTS idx_artisanal_production_dgmg_dashboard
  ON public.artisanal_site_productions(production_date, site_id);
CREATE INDEX IF NOT EXISTS idx_export_licenses_dgmg_expiration
  ON public.export_licenses(end_date, mining_company_id, status);

CREATE OR REPLACE FUNCTION public.snp_dgmg_has_active_supervision_scope()
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $fn$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles profile
      JOIN public.snp_user_organization_memberships membership
        ON membership.user_id = profile.id
       AND membership.is_primary
       AND membership.valid_from <= clock_timestamp()
       AND (membership.valid_until IS NULL OR membership.valid_until > clock_timestamp())
      JOIN public.snp_organizations organization
        ON organization.id = membership.organization_id
       AND organization.is_active
       AND organization.organization_type = 'dgmg'
      WHERE profile.id = auth.uid()
        AND profile.is_active
        AND profile.role = 'dgmg'
    )
    AND public.snp_actor_has_capability('dgmg.supervise');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_dgmg_charger_tableau_reglementaire(
  p_date_debut date,
  p_date_fin date,
  p_type_site text DEFAULT 'all',
  p_societe_id uuid DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_statut_declaration text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $fn$
DECLARE
  v_type_site text := lower(trim(coalesce(p_type_site, 'all')));
  v_region text := nullif(trim(p_region), '');
  v_statut text := nullif(trim(p_statut_declaration), '');
  v_duree integer;
  v_debut_precedent date;
  v_fin_precedent date;
  v_can_sites boolean;
  v_can_production boolean;
  v_can_reserve boolean;
  v_resultat jsonb;
BEGIN
  IF NOT public.snp_dgmg_has_active_supervision_scope()
     OR NOT public.snp_actor_can_module_action('dashboard', 'view') THEN
    RAISE EXCEPTION 'Périmètre de supervision DGMG et module Tableau de bord requis.'
      USING ERRCODE = '42501';
  END IF;

  IF p_date_debut IS NULL OR p_date_fin IS NULL
     OR p_date_fin < p_date_debut
     OR p_date_fin - p_date_debut > 1095 THEN
    RAISE EXCEPTION 'Période réglementaire invalide ou supérieure à trois ans.'
      USING ERRCODE = '22023';
  END IF;
  IF v_type_site NOT IN ('all', 'industrial', 'artisanal') THEN
    RAISE EXCEPTION 'Type de site réglementaire invalide.' USING ERRCODE = '22023';
  END IF;
  IF v_region IS NOT NULL AND length(v_region) > 100 THEN
    RAISE EXCEPTION 'Filtre régional invalide.' USING ERRCODE = '22023';
  END IF;
  IF v_statut IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_type type
    JOIN pg_catalog.pg_enum enum ON enum.enumtypid = type.oid
    WHERE type.typname = 'production_status_v2' AND enum.enumlabel = v_statut
  ) THEN
    RAISE EXCEPTION 'Statut de déclaration invalide.' USING ERRCODE = '22023';
  END IF;

  v_duree := p_date_fin - p_date_debut + 1;
  v_fin_precedent := p_date_debut - 1;
  v_debut_precedent := p_date_debut - v_duree;
  v_can_sites := public.snp_actor_can_module_action('mining_sites', 'view');
  v_can_production := public.snp_actor_can_module_action('production', 'view');
  v_can_reserve := public.snp_dgmg_can_validate_reserve_level_1();

  WITH
  industrial_current AS (
    SELECT
      'industrial:' || production.id::text AS id,
      production.production_date::date AS event_date,
      coalesce(production.created_at, production.production_date::timestamp)::timestamptz AS occurred_at,
      production.bar_reference::text AS reference,
      company.name::text AS operator_name,
      nullif(trim(company.region), '')::text AS zone,
      coalesce(production.pure_gold_grams, production.bullion_grams)::numeric AS weight_grams,
      production.status::text AS status_code,
      CASE production.status::text
        WHEN 'ready_for_customs' THEN 'Prête pour contrôle'
        WHEN 'prepared' THEN 'En préparation'
        WHEN 'cancelled' THEN 'Annulée'
        ELSE production.status::text
      END::text AS status_label,
      CASE production.status::text
        WHEN 'ready_for_customs' THEN 'info'
        WHEN 'cancelled' THEN 'danger'
        ELSE 'neutral'
      END::text AS status_tone,
      'Déclaration de production industrielle'::text AS activity,
      'industrial'::text AS source_type
    FROM public.daily_production production
    JOIN public.mining_companies company ON company.id = production.mining_company_id
    WHERE v_can_production
      AND v_type_site IN ('all', 'industrial')
      AND company.company_type::text = 'production_mine'
      AND upper(company.country) = 'BF'
      AND production.production_date BETWEEN p_date_debut AND p_date_fin
      AND (p_societe_id IS NULL OR production.mining_company_id = p_societe_id)
      AND (v_region IS NULL OR lower(trim(company.region)) = lower(v_region))
      AND (v_statut IS NULL OR production.status::text = v_statut)
  ),
  artisanal_current AS (
    SELECT
      'artisanal:' || production.id::text,
      production.production_date::date,
      coalesce(production.created_at, production.production_date::timestamp)::timestamptz,
      NULL::text,
      site.name::text,
      nullif(trim(site.region), '')::text,
      production.gold_weight_grams::numeric,
      NULL::text,
      NULL::text,
      'neutral'::text,
      'Déclaration de production artisanale'::text,
      'artisanal'::text
    FROM public.artisanal_site_productions production
    JOIN public.artisanal_sites site ON site.id = production.site_id
    WHERE v_can_production AND v_can_sites
      AND v_type_site IN ('all', 'artisanal')
      AND p_societe_id IS NULL
      AND v_statut IS NULL
      AND production.production_date BETWEEN p_date_debut AND p_date_fin
      AND (v_region IS NULL OR lower(trim(site.region)) = lower(v_region))
  ),
  current_events AS (
    SELECT * FROM industrial_current
    UNION ALL
    SELECT * FROM artisanal_current
  ),
  industrial_previous AS (
    SELECT coalesce(production.pure_gold_grams, production.bullion_grams)::numeric AS weight_grams
    FROM public.daily_production production
    JOIN public.mining_companies company ON company.id = production.mining_company_id
    WHERE v_can_production
      AND v_type_site IN ('all', 'industrial')
      AND company.company_type::text = 'production_mine'
      AND upper(company.country) = 'BF'
      AND production.production_date BETWEEN v_debut_precedent AND v_fin_precedent
      AND (p_societe_id IS NULL OR production.mining_company_id = p_societe_id)
      AND (v_region IS NULL OR lower(trim(company.region)) = lower(v_region))
      AND (v_statut IS NULL OR production.status::text = v_statut)
  ),
  artisanal_previous AS (
    SELECT production.gold_weight_grams::numeric AS weight_grams
    FROM public.artisanal_site_productions production
    JOIN public.artisanal_sites site ON site.id = production.site_id
    WHERE v_can_production AND v_can_sites
      AND v_type_site IN ('all', 'artisanal')
      AND p_societe_id IS NULL
      AND v_statut IS NULL
      AND production.production_date BETWEEN v_debut_precedent AND v_fin_precedent
      AND (v_region IS NULL OR lower(trim(site.region)) = lower(v_region))
  ),
  previous_events AS (
    SELECT * FROM industrial_previous
    UNION ALL
    SELECT * FROM artisanal_previous
  ),
  company_summary AS (
    SELECT
      count(*)::bigint AS total,
      count(*) FILTER (WHERE company.is_active)::bigint AS active
    FROM public.mining_companies company
    WHERE v_can_sites
      AND v_type_site <> 'artisanal'
      AND company.company_type::text = 'production_mine'
      AND upper(company.country) = 'BF'
      AND (p_societe_id IS NULL OR company.id = p_societe_id)
      AND (v_region IS NULL OR lower(trim(company.region)) = lower(v_region))
  ),
  site_summary AS (
    SELECT
      count(*)::bigint AS total,
      count(*) FILTER (WHERE lower(site.status) IN ('active', 'actif', 'operational', 'opérationnel'))::bigint AS active
    FROM public.artisanal_sites site
    WHERE v_can_sites
      AND v_type_site <> 'industrial'
      AND p_societe_id IS NULL
      AND (v_region IS NULL OR lower(trim(site.region)) = lower(v_region))
  ),
  event_summary AS (
    SELECT count(*)::bigint AS declarations_total,
           coalesce(sum(event.weight_grams), 0)::numeric AS production_grams
    FROM current_events event
  ),
  previous_summary AS (
    SELECT CASE WHEN count(*) > 0 THEN sum(event.weight_grams)::numeric ELSE NULL END AS production_grams
    FROM previous_events event
  ),
  monthly AS (
    SELECT
      to_char(date_trunc('month', event.event_date), 'YYYY-MM') AS month,
      CASE extract(month FROM date_trunc('month', event.event_date))::integer
        WHEN 1 THEN 'Janv.' WHEN 2 THEN 'Févr.' WHEN 3 THEN 'Mars'
        WHEN 4 THEN 'Avr.' WHEN 5 THEN 'Mai' WHEN 6 THEN 'Juin'
        WHEN 7 THEN 'Juil.' WHEN 8 THEN 'Août' WHEN 9 THEN 'Sept.'
        WHEN 10 THEN 'Oct.' WHEN 11 THEN 'Nov.' ELSE 'Déc.'
      END || ' ' || extract(year FROM date_trunc('month', event.event_date))::integer AS label,
      CASE WHEN bool_or(event.source_type = 'industrial')
        THEN sum(event.weight_grams) FILTER (WHERE event.source_type = 'industrial')::numeric ELSE NULL END AS industrial_grams,
      CASE WHEN bool_or(event.source_type = 'artisanal')
        THEN sum(event.weight_grams) FILTER (WHERE event.source_type = 'artisanal')::numeric ELSE NULL END AS artisanal_grams
    FROM current_events event
    GROUP BY date_trunc('month', event.event_date)
  ),
  activities AS (
    SELECT event.id, event.reference, event.operator_name, event.activity, event.zone,
           event.status_label AS status, event.status_tone, event.occurred_at
    FROM current_events event
    ORDER BY event.occurred_at DESC, event.id
    LIMIT 8
  ),
  attention AS (
    SELECT
      CASE WHEN NOT v_can_sites OR v_type_site = 'artisanal' THEN NULL ELSE (
        SELECT count(*)::bigint
        FROM public.export_licenses license
        JOIN public.mining_companies company ON company.id = license.mining_company_id
        WHERE license.end_date BETWEEN current_date AND current_date + 30
          AND lower(coalesce(license.status, '')) NOT IN ('cancelled', 'annulee', 'annulée', 'expired', 'expiree', 'expirée')
          AND company.company_type::text = 'production_mine'
          AND upper(company.country) = 'BF'
          AND (p_societe_id IS NULL OR company.id = p_societe_id)
          AND (v_region IS NULL OR lower(trim(company.region)) = lower(v_region))
      ) END AS expiring_licenses
  ),
  controls AS (
    SELECT CASE WHEN v_can_reserve THEN (
      SELECT count(*)::bigint FROM public.snp_reserve_allocations allocation
      WHERE allocation.status IN ('SUBMITTED', 'UNDER_REVIEW')
    ) ELSE NULL END AS pending
  ),
  company_options AS (
    SELECT company.id::text AS value, company.name::text AS label
    FROM public.mining_companies company
    WHERE v_can_production
      AND company.company_type::text = 'production_mine'
      AND upper(company.country) = 'BF'
    ORDER BY company.name
  ),
  region_options AS (
    SELECT DISTINCT source.value, source.label FROM (
      SELECT trim(company.region)::text AS value, trim(company.region)::text AS label
      FROM public.mining_companies company
      WHERE v_can_production AND nullif(trim(company.region), '') IS NOT NULL
        AND company.company_type::text = 'production_mine' AND upper(company.country) = 'BF'
      UNION ALL
      SELECT trim(site.region)::text, trim(site.region)::text
      FROM public.artisanal_sites site
      WHERE v_can_sites AND nullif(trim(site.region), '') IS NOT NULL
    ) source
  ),
  status_options AS (
    SELECT enum.enumlabel::text AS value,
      CASE enum.enumlabel
        WHEN 'ready_for_customs' THEN 'Prête pour contrôle'
        WHEN 'prepared' THEN 'En préparation'
        WHEN 'cancelled' THEN 'Annulée'
        ELSE enum.enumlabel::text
      END AS label
    FROM pg_catalog.pg_type type
    JOIN pg_catalog.pg_enum enum ON enum.enumtypid = type.oid
    WHERE v_can_production AND type.typname = 'production_status_v2'
    ORDER BY enum.enumsortorder
  )
  SELECT jsonb_build_object(
    'has_data', company_summary.total > 0 OR site_summary.total > 0 OR event_summary.declarations_total > 0,
    'partial', true,
    'unavailable_dimensions', jsonb_build_array(
      'registre des sites industriels', 'conformité des déclarations',
      'échéances déclaratives', 'écarts de production', 'priorité des contrôles'
    ),
    'period', jsonb_build_object('start_date', p_date_debut, 'end_date', p_date_fin),
    'summary', jsonb_build_object(
      'mining_companies_total', CASE WHEN v_can_sites AND v_type_site <> 'artisanal' THEN company_summary.total ELSE NULL END,
      'mining_companies_active', CASE WHEN v_can_sites AND v_type_site <> 'artisanal' THEN company_summary.active ELSE NULL END,
      'sites_total', CASE WHEN v_can_sites AND v_type_site <> 'industrial' AND p_societe_id IS NULL THEN site_summary.total ELSE NULL END,
      'industrial_sites_total', NULL,
      'artisanal_sites_total', CASE WHEN v_can_sites AND v_type_site <> 'industrial' AND p_societe_id IS NULL THEN site_summary.total ELSE NULL END,
      'declarations_total', CASE WHEN v_can_production THEN event_summary.declarations_total ELSE NULL END,
      'on_time_rate', NULL,
      'production_grams', CASE WHEN v_can_production THEN event_summary.production_grams ELSE NULL END,
      'previous_production_grams', CASE WHEN v_can_production THEN previous_summary.production_grams ELSE NULL END,
      'controls_pending', controls.pending,
      'priority_controls', NULL
    ),
    'monthly', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'month', item.month, 'label', item.label,
      'industrial_grams', item.industrial_grams, 'artisanal_grams', item.artisanal_grams
    ) ORDER BY item.month) FROM monthly item), '[]'::jsonb),
    'compliance', jsonb_build_object('conforming', NULL, 'regularize', NULL, 'non_conforming', NULL),
    'activities', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', item.id, 'reference', item.reference, 'operator_name', item.operator_name,
      'activity', item.activity, 'zone', item.zone, 'status', item.status,
      'status_tone', item.status_tone, 'occurred_at', item.occurred_at
    ) ORDER BY item.occurred_at DESC, item.id) FROM activities item), '[]'::jsonb),
    'attention', jsonb_build_object(
      'late_declarations', NULL,
      'expiring_licenses', attention.expiring_licenses,
      'production_gaps', NULL
    ),
    'filter_options', jsonb_build_object(
      'companies', coalesce((SELECT jsonb_agg(jsonb_build_object('value', option.value, 'label', option.label) ORDER BY option.label) FROM company_options option), '[]'::jsonb),
      'regions', coalesce((SELECT jsonb_agg(jsonb_build_object('value', option.value, 'label', option.label) ORDER BY option.label) FROM region_options option), '[]'::jsonb),
      'declaration_statuses', coalesce((SELECT jsonb_agg(jsonb_build_object('value', option.value, 'label', option.label)) FROM status_options option), '[]'::jsonb)
    )
  ) INTO v_resultat
  FROM company_summary CROSS JOIN site_summary CROSS JOIN event_summary
  CROSS JOIN previous_summary CROSS JOIN attention CROSS JOIN controls;

  RETURN v_resultat;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_dgmg_has_active_supervision_scope()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)
TO authenticated;

INSERT INTO public.snp_rpc_execution_allowlist(
  function_signature, function_name, grantee, purpose, migration_version
)
SELECT procedure.oid::regprocedure::text,
       procedure.proname,
       'authenticated',
       'runtime-browser',
       '20260904203000'
FROM pg_catalog.pg_proc procedure
WHERE procedure.oid = 'public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)'::regprocedure
ON CONFLICT(function_signature, grantee) DO UPDATE SET
  function_name = EXCLUDED.function_name,
  purpose = EXCLUDED.purpose,
  migration_version = EXCLUDED.migration_version;

DO $postflight$
BEGIN
  IF has_function_privilege('anon',
       'public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated',
       'public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.snp_dgmg_has_active_supervision_scope()', 'EXECUTE')
     OR NOT EXISTS (
       SELECT 1 FROM public.snp_rpc_execution_allowlist
       WHERE function_signature =
         'public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)'::regprocedure::text
         AND grantee = 'authenticated'
         AND purpose = 'runtime-browser'
         AND migration_version = '20260904203000'
     ) THEN
    RAISE EXCEPTION 'Postflight portail DGMG : exposition RPC incohérente.';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';

COMMIT;
