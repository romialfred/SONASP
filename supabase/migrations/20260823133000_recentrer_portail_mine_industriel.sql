-- ============================================================================
-- Portail Mine industriel : même métier, périmètre strict de la société
-- ============================================================================
-- La société n'est jamais fournie par le navigateur pour une écriture sensible.
-- Elle est dérivée du profil authentifié après MFA. Les ventes portent uniquement
-- sur le reliquat : production déclarée - achats SONASP - ventes mine engagées.

-- ---------------------------------------------------------------------------
-- Contexte de sécurité autonome
-- ---------------------------------------------------------------------------
-- Ces fonctions sont redéfinies ici car certains environnements historiques
-- ont reçu les tables métier sans la migration du premier portail Mine.
CREATE OR REPLACE FUNCTION public.snp_est_agent_sonasp()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_active
      AND mining_company_id IS NULL
      AND role IN ('owner', 'admin', 'management', 'factory', 'airport', 'refinery')
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_est_direction_lecture()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_active
      AND mining_company_id IS NULL AND role = 'manager'
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_est_operateur_interne()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_est_agent_sonasp();
$fn$;

CREATE OR REPLACE FUNCTION public.snp_societe_compte_mine()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_societe uuid;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Le second facteur doit être validé avant cette opération.'
      USING ERRCODE = '42501';
  END IF;
  SELECT mining_company_id INTO v_societe
  FROM public.user_profiles
  WHERE id = auth.uid() AND is_active AND mining_company_id IS NOT NULL;
  IF v_societe IS NULL THEN
    RAISE EXCEPTION 'Cette opération est réservée au compte de la société minière.'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_societe;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_est_agent_sonasp() FROM public;
REVOKE ALL ON FUNCTION public.snp_est_direction_lecture() FROM public;
REVOKE ALL ON FUNCTION public.snp_est_operateur_interne() FROM public;
REVOKE ALL ON FUNCTION public.snp_societe_compte_mine() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_est_agent_sonasp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_est_direction_lecture() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_est_operateur_interne() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_societe_compte_mine() TO authenticated;

-- Les formulaires nationaux lisent les mêmes tables. La mine voit uniquement
-- ses lignes et écrit par RPC ; les agents internes conservent leur workflow.
DO $block$
DECLARE v_table text; v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'annual_budgets', 'monthly_budgets', 'quarterly_forecasts',
    'daily_production', 'mining_company_documents'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    FOR v_policy IN SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY snp_portail_lecture_perimetre ON public.%I FOR SELECT TO authenticated USING (' ||
      'public.snp_est_agent_sonasp() OR public.snp_est_direction_lecture() OR ' ||
      'mining_company_id = public.snp_societe_utilisateur())', v_table
    );
    EXECUTE format(
      'CREATE POLICY snp_portail_ecriture_interne ON public.%I FOR ALL TO authenticated ' ||
      'USING (public.snp_est_agent_sonasp()) WITH CHECK (public.snp_est_agent_sonasp())', v_table
    );
  END LOOP;
END;
$block$;

-- ---------------------------------------------------------------------------
-- Budget et prévisions : mêmes tables et calculs que l'administration
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_portail_mine_soumettre_budget(
  p_annee integer, p_mois integer, p_budget_oz numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_budget_annuel uuid; v_budget_mensuel uuid; v_site text; v_jours integer;
BEGIN
  IF p_annee NOT BETWEEN extract(year FROM CURRENT_DATE)::integer - 1
                      AND extract(year FROM CURRENT_DATE)::integer + 5 THEN
    RAISE EXCEPTION 'L''exercice demandé est hors de la période autorisée.';
  END IF;
  IF p_mois NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Le mois est invalide.'; END IF;
  IF p_budget_oz IS NULL OR p_budget_oz < 0 THEN
    RAISE EXCEPTION 'L''objectif budgétaire doit être un volume positif ou nul.';
  END IF;
  SELECT coalesce(nullif(lower(code), ''), id::text) INTO v_site
  FROM public.mining_companies WHERE id = v_societe AND is_active;
  IF v_site IS NULL THEN RAISE EXCEPTION 'La société minière est inactive.'; END IF;

  SELECT id INTO v_budget_annuel FROM public.annual_budgets
  WHERE year = p_annee AND site_id = v_site AND mining_company_id = v_societe
  LIMIT 1 FOR UPDATE;
  IF v_budget_annuel IS NULL THEN
    INSERT INTO public.annual_budgets(year, site_id, mining_company_id, created_by)
    VALUES (p_annee, v_site, v_societe, auth.uid())
    ON CONFLICT DO NOTHING RETURNING id INTO v_budget_annuel;
    IF v_budget_annuel IS NULL THEN
      SELECT id INTO v_budget_annuel FROM public.annual_budgets
      WHERE year = p_annee AND site_id = v_site AND mining_company_id = v_societe LIMIT 1;
    END IF;
  END IF;
  v_jours := extract(day FROM (make_date(p_annee, p_mois, 1) + interval '1 month - 1 day'))::integer;
  INSERT INTO public.monthly_budgets(
    annual_budget_id, month, budget_oz, days_in_month, daily_budget_oz, mining_company_id
  ) VALUES (
    v_budget_annuel, p_mois, p_budget_oz, v_jours,
    round(p_budget_oz / v_jours, 4), v_societe
  )
  ON CONFLICT (annual_budget_id, month) DO UPDATE SET
    budget_oz = EXCLUDED.budget_oz, days_in_month = EXCLUDED.days_in_month,
    daily_budget_oz = EXCLUDED.daily_budget_oz,
    mining_company_id = EXCLUDED.mining_company_id, updated_at = now()
  RETURNING id INTO v_budget_mensuel;
  RETURN v_budget_mensuel;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_portail_mine_soumettre_prevision(
  p_annee integer, p_mois integer, p_prevision_oz numeric, p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_budget uuid; v_prevision uuid; v_site text; v_jours integer; v_trimestre integer;
BEGIN
  IF p_annee NOT BETWEEN extract(year FROM CURRENT_DATE)::integer - 1
                      AND extract(year FROM CURRENT_DATE)::integer + 5 THEN
    RAISE EXCEPTION 'L''exercice demandé est hors de la période autorisée.';
  END IF;
  IF p_mois NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Le mois est invalide.'; END IF;
  IF p_prevision_oz IS NULL OR p_prevision_oz < 0 THEN
    RAISE EXCEPTION 'La prévision doit être un volume positif ou nul.';
  END IF;
  IF length(coalesce(p_notes, '')) > 2000 THEN RAISE EXCEPTION 'Les hypothèses sont trop longues.'; END IF;
  SELECT coalesce(nullif(lower(code), ''), id::text) INTO v_site
  FROM public.mining_companies WHERE id = v_societe AND is_active;
  IF v_site IS NULL THEN RAISE EXCEPTION 'La société minière est inactive.'; END IF;

  SELECT id INTO v_budget FROM public.annual_budgets
  WHERE year = p_annee AND site_id = v_site AND mining_company_id = v_societe
  LIMIT 1 FOR UPDATE;
  IF v_budget IS NULL THEN
    INSERT INTO public.annual_budgets(year, site_id, mining_company_id, created_by)
    VALUES (p_annee, v_site, v_societe, auth.uid())
    ON CONFLICT DO NOTHING RETURNING id INTO v_budget;
    IF v_budget IS NULL THEN
      SELECT id INTO v_budget FROM public.annual_budgets
      WHERE year = p_annee AND site_id = v_site AND mining_company_id = v_societe LIMIT 1;
    END IF;
  END IF;
  v_jours := extract(day FROM (make_date(p_annee, p_mois, 1) + interval '1 month - 1 day'))::integer;
  v_trimestre := ceil(p_mois::numeric / 3)::integer;
  INSERT INTO public.quarterly_forecasts(
    annual_budget_id, quarter, revision_date, month, forecast_oz,
    days_in_month, daily_forecast_oz, notes, mining_company_id, created_by
  ) VALUES (
    v_budget, v_trimestre, CURRENT_DATE, p_mois, p_prevision_oz,
    v_jours, round(p_prevision_oz / v_jours, 4), nullif(trim(p_notes), ''), v_societe, auth.uid()
  )
  ON CONFLICT (annual_budget_id, quarter, month) DO UPDATE SET
    revision_date = EXCLUDED.revision_date, forecast_oz = EXCLUDED.forecast_oz,
    days_in_month = EXCLUDED.days_in_month, daily_forecast_oz = EXCLUDED.daily_forecast_oz,
    notes = EXCLUDED.notes, created_by = auth.uid(), updated_at = now()
  RETURNING id INTO v_prevision;
  RETURN v_prevision;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_portail_mine_declarer_production(
  p_date_production date, p_poids_brut_grammes numeric,
  p_teneur_estimee_pct numeric, p_reference_barre text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_id uuid; v_code text; v_reference text; v_or_fin numeric;
BEGIN
  IF p_date_production IS NULL OR p_date_production > CURRENT_DATE THEN
    RAISE EXCEPTION 'La date de production ne peut pas être future.';
  END IF;
  IF p_poids_brut_grammes IS NULL OR p_poids_brut_grammes <= 0 THEN
    RAISE EXCEPTION 'Le poids doit être strictement positif.';
  END IF;
  IF p_teneur_estimee_pct IS NULL OR p_teneur_estimee_pct <= 0 OR p_teneur_estimee_pct > 100 THEN
    RAISE EXCEPTION 'La teneur estimée doit être comprise entre 0 et 100 %.';
  END IF;
  IF length(coalesce(p_notes, '')) > 2000 THEN RAISE EXCEPTION 'Les observations sont trop longues.'; END IF;
  SELECT upper(coalesce(nullif(code, ''), 'MINE')) INTO v_code
  FROM public.mining_companies WHERE id = v_societe AND is_active;
  IF v_code IS NULL THEN RAISE EXCEPTION 'La société minière est inactive.'; END IF;
  v_reference := nullif(upper(trim(p_reference_barre)), '');
  IF v_reference IS NULL THEN
    SELECT v_code || '-' || to_char(p_date_production, 'YYYYMMDD') || '-' ||
           lpad((count(*) + 1)::text, 3, '0') INTO v_reference
    FROM public.daily_production
    WHERE mining_company_id = v_societe AND production_date = p_date_production;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.daily_production
    WHERE mining_company_id = v_societe AND bar_reference = v_reference
  ) THEN RAISE EXCEPTION 'Cette référence de barre existe déjà pour votre société.'; END IF;
  v_or_fin := round(p_poids_brut_grammes * p_teneur_estimee_pct / 100, 4);
  INSERT INTO public.daily_production(
    production_date, mining_company_id, bullion_grams,
    estimated_fineness_pct, estimated_gold_pct, pure_gold_grams,
    estimated_oz, bar_reference, status, site_id, notes, created_by
  ) VALUES (
    p_date_production, v_societe, p_poids_brut_grammes,
    p_teneur_estimee_pct, p_teneur_estimee_pct, v_or_fin,
    round(v_or_fin / 31.1034768, 4), v_reference, 'prepared', lower(v_code),
    nullif(trim(p_notes), ''), auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_portail_mine_soumettre_budget(integer, integer, numeric) FROM public;
REVOKE ALL ON FUNCTION public.snp_portail_mine_soumettre_prevision(integer, integer, numeric, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_portail_mine_declarer_production(date, numeric, numeric, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_soumettre_budget(integer, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_soumettre_prevision(integer, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_declarer_production(date, numeric, numeric, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Production : modification et suppression contrôlées côté serveur
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_portail_mine_modifier_production(
  p_production_id uuid,
  p_date_production date,
  p_poids_brut_grammes numeric,
  p_teneur_estimee_pct numeric,
  p_reference_barre text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_code text;
  v_reference text;
  v_or_fin numeric;
BEGIN
  IF p_date_production IS NULL OR p_date_production > CURRENT_DATE THEN
    RAISE EXCEPTION 'La date de production ne peut pas être future.';
  END IF;
  IF p_poids_brut_grammes IS NULL OR p_poids_brut_grammes <= 0 THEN
    RAISE EXCEPTION 'Le poids doit être strictement positif.';
  END IF;
  IF p_teneur_estimee_pct IS NULL OR p_teneur_estimee_pct <= 0 OR p_teneur_estimee_pct > 100 THEN
    RAISE EXCEPTION 'La teneur estimée doit être comprise entre 0 et 100 %.';
  END IF;
  IF length(coalesce(p_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Les observations sont trop longues.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.daily_production
    WHERE id = p_production_id
      AND mining_company_id = v_societe
      AND status::text = 'prepared'
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Cette production est introuvable, hors périmètre ou déjà engagée.'
      USING ERRCODE = '42501';
  END IF;

  SELECT upper(coalesce(nullif(code, ''), 'MINE')) INTO v_code
  FROM public.mining_companies WHERE id = v_societe AND is_active;
  IF v_code IS NULL THEN RAISE EXCEPTION 'La société minière est inactive.'; END IF;

  v_reference := nullif(upper(trim(p_reference_barre)), '');
  IF v_reference IS NULL THEN
    SELECT v_code || '-' || to_char(p_date_production, 'YYYYMMDD') || '-' ||
           lpad((count(*) + 1)::text, 3, '0')
    INTO v_reference
    FROM public.daily_production
    WHERE mining_company_id = v_societe
      AND production_date = p_date_production
      AND id <> p_production_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.daily_production
    WHERE mining_company_id = v_societe
      AND bar_reference = v_reference
      AND id <> p_production_id
  ) THEN
    RAISE EXCEPTION 'Cette référence de barre existe déjà pour votre société.';
  END IF;

  v_or_fin := round(p_poids_brut_grammes * p_teneur_estimee_pct / 100, 4);
  UPDATE public.daily_production SET
    production_date = p_date_production,
    bullion_grams = p_poids_brut_grammes,
    estimated_fineness_pct = p_teneur_estimee_pct,
    estimated_gold_pct = p_teneur_estimee_pct,
    pure_gold_grams = v_or_fin,
    estimated_oz = round(v_or_fin / 31.1034768, 4),
    bar_reference = v_reference,
    notes = nullif(trim(p_notes), ''),
    updated_at = now()
  WHERE id = p_production_id AND mining_company_id = v_societe;

  RETURN p_production_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_portail_mine_supprimer_production(
  p_production_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_production
    WHERE id = p_production_id
      AND mining_company_id = v_societe
      AND status::text = 'prepared'
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Cette production est introuvable, hors périmètre ou déjà engagée.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shipping_production_items
    WHERE daily_production_id = p_production_id
  ) OR EXISTS (
    SELECT 1 FROM public.freight_shipment_productions
    WHERE production_id = p_production_id
  ) THEN
    RAISE EXCEPTION 'Une production intégrée à une expédition ne peut plus être supprimée.';
  END IF;

  DELETE FROM public.daily_production
  WHERE id = p_production_id AND mining_company_id = v_societe;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_portail_mine_modifier_production(uuid, date, numeric, numeric, text, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_portail_mine_supprimer_production(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_modifier_production(uuid, date, numeric, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_supprimer_production(uuid) TO authenticated;

-- Les pièces et historiques héritent obligatoirement du périmètre de la
-- production parente. Les anciennes policies USING(true) sont neutralisées.
CREATE OR REPLACE FUNCTION public.snp_peut_consulter_production(p_production_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.daily_production p
    WHERE p.id = p_production_id
      AND (
        public.snp_est_agent_sonasp()
        OR public.snp_est_direction_lecture()
        OR p.mining_company_id = public.snp_societe_utilisateur()
      )
  );
$fn$;

REVOKE ALL ON FUNCTION public.snp_peut_consulter_production(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_consulter_production(uuid) TO authenticated;

DO $block$
DECLARE
  v_table text;
  v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['production_documents', 'production_status_history'] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    FOR v_policy IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY snp_production_enfant_lecture ON public.%I FOR SELECT TO authenticated ' ||
      'USING (public.snp_peut_consulter_production(production_id))', v_table
    );
  END LOOP;
END;
$block$;

CREATE POLICY snp_production_document_insertion ON public.production_documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.snp_peut_consulter_production(production_id));
CREATE POLICY snp_production_document_modification ON public.production_documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() AND public.snp_peut_consulter_production(production_id))
  WITH CHECK (uploaded_by = auth.uid() AND public.snp_peut_consulter_production(production_id));
CREATE POLICY snp_production_document_suppression ON public.production_documents
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() AND public.snp_peut_consulter_production(production_id));

CREATE OR REPLACE FUNCTION public.get_production_status_history(prod_id uuid)
RETURNS TABLE (
  id uuid, old_status text, new_status text, changed_by uuid,
  changed_at timestamptz, notes text, user_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NOT public.snp_peut_consulter_production(prod_id) THEN
    RAISE EXCEPTION 'Production inaccessible dans votre périmètre.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT h.id, h.old_status::text, h.new_status::text, h.changed_by,
         h.changed_at, h.notes, u.email::text
  FROM public.production_status_history h
  LEFT JOIN auth.users u ON u.id = h.changed_by
  WHERE h.production_id = prod_id
  ORDER BY h.changed_at DESC;
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_production_status_history(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_production_status_history(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Stock exportable de la mine, calculé par la base et non par le navigateur
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_stock_exportable_mine()
RETURNS TABLE (
  production_oz numeric,
  rachete_sonasp_oz numeric,
  vendu_mine_oz numeric,
  disponible_oz numeric,
  disponible_grammes numeric,
  suralloue boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_production numeric;
  v_achats numeric;
  v_ventes numeric;
  v_solde numeric;
BEGIN
  SELECT coalesce(sum(coalesce(estimated_oz, 0)), 0) INTO v_production
  FROM public.daily_production
  WHERE mining_company_id = v_societe AND status::text <> 'cancelled';

  SELECT coalesce(sum(coalesce(quantite_oz, 0)), 0) INTO v_achats
  FROM public.snp_achats_mines
  WHERE mining_company_id = v_societe AND statut IN ('en_attente', 'validee', 'payee');

  SELECT coalesce(sum(coalesce(quantity_oz, 0)), 0) INTO v_ventes
  FROM public.sales
  WHERE seller_type = 'mining_company' AND seller_id = v_societe
    AND status::text IN (
      'for_sale', 'sold', 'paid', 'create_sales',
      'pending_management_approval', 'management_approved',
      'pending_for_customer_approval', 'customer_approved',
      'waiting_for_payment', 'virtual_payment', 'payment_received', 'completed'
    );

  v_solde := v_production - v_achats - v_ventes;
  RETURN QUERY SELECT
    round(v_production, 3), round(v_achats, 3), round(v_ventes, 3),
    round(greatest(0, v_solde), 3),
    round(greatest(0, v_solde) * 31.1034768, 3),
    v_solde < -0.000001;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_stock_exportable_mine() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_stock_exportable_mine() TO authenticated;

-- ---------------------------------------------------------------------------
-- Vente export d'une mine : transaction unique et reliquat sérialisé
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snp_ventes_evenements_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created', 'lots_released')),
  previous_status text,
  resulting_status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.snp_ventes_evenements_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_ventes_evenements_lecture ON public.snp_ventes_evenements_audit;
CREATE POLICY snp_ventes_evenements_lecture ON public.snp_ventes_evenements_audit
  FOR SELECT TO authenticated USING (public.snp_est_agent_sonasp());
REVOKE INSERT, UPDATE, DELETE ON public.snp_ventes_evenements_audit FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.snp_creer_vente_export_mine(
  p_customer_id uuid,
  p_quantity_oz numeric,
  p_london_am_rate numeric,
  p_freight_cost numeric DEFAULT 0,
  p_other_costs numeric DEFAULT 0,
  p_mechanism_type text DEFAULT NULL,
  p_in_process_refinery_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_actor public.user_profiles%ROWTYPE;
  v_setting public.gold_sales_settings%ROWTYPE;
  v_production numeric;
  v_achats numeric;
  v_ventes numeric;
  v_disponible numeric;
  v_royalty_rate numeric;
  v_gross numeric;
  v_net numeric;
  v_royalty numeric;
  v_final numeric;
  v_year integer := extract(year FROM current_date)::integer;
  v_next integer;
  v_sale_number text;
  v_sale public.sales%ROWTYPE;
  v_request_id uuid;
BEGIN
  SELECT * INTO v_actor FROM public.user_profiles
  WHERE id = auth.uid() AND is_active AND mining_company_id = v_societe;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte société inactif.' USING ERRCODE = '42501'; END IF;

  IF p_quantity_oz IS NULL OR p_quantity_oz::text = 'NaN' OR p_quantity_oz <= 0
     OR p_london_am_rate IS NULL OR p_london_am_rate::text = 'NaN' OR p_london_am_rate <= 0
     OR coalesce(p_freight_cost, 0) < 0 OR coalesce(p_other_costs, 0) < 0 THEN
    RAISE EXCEPTION 'Les quantités, le prix et les frais sont invalides.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mining_companies
    WHERE id = v_societe AND is_active AND company_type <> 'institution'
  ) THEN RAISE EXCEPTION 'La société minière est inactive.'; END IF;

  IF nullif(trim(coalesce(p_mechanism_type, '')), '') IS NOT NULL
     AND nullif(trim(coalesce(p_mechanism_type, '')), '') NOT IN ('spot', 'forward', 'in_process') THEN
    RAISE EXCEPTION 'Le mécanisme de vente demandé est invalide.';
  END IF;
  IF nullif(trim(coalesce(p_mechanism_type, '')), '') = 'in_process' THEN
    IF p_in_process_refinery_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.refineries_approved
      WHERE id = p_in_process_refinery_id AND is_approved
    ) THEN RAISE EXCEPTION 'Une raffinerie agréée est obligatoire.'; END IF;
  ELSIF p_in_process_refinery_id IS NOT NULL THEN
    RAISE EXCEPTION 'Une raffinerie ne peut être rattachée qu''à une vente en cours de traitement.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customers WHERE id = p_customer_id AND is_active IS DISTINCT FROM false
  ) THEN RAISE EXCEPTION 'Le client est introuvable ou inactif.'; END IF;

  SELECT * INTO v_setting FROM public.gold_sales_settings
  WHERE mining_company_id = v_societe AND customer_id = p_customer_id
    AND is_active AND effective_date <= current_date
  ORDER BY effective_date DESC, updated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce client n''est pas autorisé pour les ventes export de votre société.'
      USING ERRCODE = '42501';
  END IF;

  -- Un verrou par société empêche deux onglets de vendre simultanément le même
  -- reliquat. Le calcul et l'INSERT appartiennent à la même transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('SONASP:mine-stock:' || v_societe::text, 0));

  SELECT coalesce(sum(coalesce(estimated_oz, 0)), 0) INTO v_production
  FROM public.daily_production
  WHERE mining_company_id = v_societe AND status::text <> 'cancelled';
  SELECT coalesce(sum(coalesce(quantite_oz, 0)), 0) INTO v_achats
  FROM public.snp_achats_mines
  WHERE mining_company_id = v_societe AND statut IN ('en_attente', 'validee', 'payee');
  SELECT coalesce(sum(coalesce(quantity_oz, 0)), 0) INTO v_ventes
  FROM public.sales
  WHERE seller_type = 'mining_company' AND seller_id = v_societe
    AND status::text IN (
      'for_sale', 'sold', 'paid', 'create_sales',
      'pending_management_approval', 'management_approved',
      'pending_for_customer_approval', 'customer_approved',
      'waiting_for_payment', 'virtual_payment', 'payment_received', 'completed'
    );
  v_disponible := greatest(0, v_production - v_achats - v_ventes);

  IF p_quantity_oz > v_disponible + 0.000001 THEN
    RAISE EXCEPTION 'La quantité dépasse le reliquat exportable de la mine (% oz).', round(v_disponible, 3);
  END IF;
  IF p_quantity_oz > v_disponible * (v_setting.max_stock_percentage / 100.0) + 0.000001 THEN
    RAISE EXCEPTION 'La quantité dépasse la part de stock autorisée pour ce client.';
  END IF;

  SELECT CASE WHEN rule_value > 1 THEN rule_value / 100.0 ELSE rule_value END
  INTO v_royalty_rate FROM public.business_rules
  WHERE rule_key = 'gold_royalty_percentage'
  ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  IF v_royalty_rate IS NULL OR v_royalty_rate < 0 OR v_royalty_rate >= 1 THEN
    RAISE EXCEPTION 'Le taux de redevance des ventes n''est pas configuré correctement.';
  END IF;

  v_gross := round(p_quantity_oz * p_london_am_rate, 2);
  v_net := round(v_gross - coalesce(p_freight_cost, 0) - coalesce(p_other_costs, 0), 2);
  IF v_net <= 0 THEN RAISE EXCEPTION 'Le produit net de la vente doit être positif.'; END IF;
  v_royalty := round(v_net * v_royalty_rate, 2);
  v_final := round(v_net - v_royalty, 2);

  PERFORM pg_advisory_xact_lock(hashtext('SONASP:sales:' || v_year::text));
  SELECT coalesce(max(substring(sale_number FROM '[0-9]+$')::integer), 0) + 1
  INTO v_next FROM public.sales WHERE sale_number ~ ('^SL-' || v_year::text || '-[0-9]+$');
  v_sale_number := 'SL-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

  INSERT INTO public.sales (
    sale_number, sale_date, customer_id, seller_id, seller_type,
    is_internal_sale, quantity_oz, london_am_rate, freight_cost, other_costs,
    gross_proceeds, net_proceeds, royalty_amount, final_proceeds, total_amount,
    currency, status, mechanism_type, in_process_refinery_id, created_by
  ) VALUES (
    v_sale_number, current_date, p_customer_id, v_societe, 'mining_company',
    false, p_quantity_oz, p_london_am_rate, coalesce(p_freight_cost, 0),
    coalesce(p_other_costs, 0), v_gross, v_net, v_royalty, v_final, v_final,
    'USD', 'pending_management_approval', nullif(trim(coalesce(p_mechanism_type, '')), ''),
    p_in_process_refinery_id, v_actor.id
  ) RETURNING * INTO v_sale;

  INSERT INTO public.approval_requests (
    request_type, entity_id, entity_type, approver_role, requested_by, status
  ) VALUES ('sale', v_sale.id, 'sales', 'management', v_actor.id, 'pending')
  RETURNING id INTO v_request_id;

  INSERT INTO public.snp_ventes_evenements_audit (
    sale_id, event_type, resulting_status, details, actor_id, actor_role
  ) VALUES (
    v_sale.id, 'created', v_sale.status::text,
    jsonb_build_object(
      'sale_number', v_sale.sale_number,
      'source', 'mine_reliquat',
      'seller_id', v_societe,
      'quantity_oz', v_sale.quantity_oz,
      'available_before_oz', v_disponible,
      'approval_request_id', v_request_id
    ), v_actor.id, v_actor.role
  );

  PERFORM public.snp_notifier_roles(
    ARRAY['owner', 'admin', 'management'],
    'Vente minière à valider',
    'La vente ' || v_sale.sale_number || ' attend la validation de la direction.',
    'validation_attendue', 'haute', 'vente', v_sale.id,
    '/sales/' || v_sale.id::text,
    jsonb_build_object('sale_number', v_sale.sale_number, 'request_id', v_request_id),
    'vente-validation-' || v_sale.id::text, true
  );

  RETURN jsonb_build_object(
    'id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'status', v_sale.status,
    'approval_request_id', v_request_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_creer_vente_export_mine(uuid, numeric, numeric, numeric, numeric, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_creer_vente_export_mine(uuid, numeric, numeric, numeric, numeric, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Ventes et tables enfants : visibilité par vendeur, client ou SONASP
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_peut_consulter_vente(p_sale_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1
    FROM public.sales s
    LEFT JOIN public.customers c ON c.id = s.customer_id
    LEFT JOIN public.user_profiles up ON up.id = auth.uid() AND up.is_active
    WHERE s.id = p_sale_id
      AND (
        public.snp_est_agent_sonasp()
        OR public.snp_est_direction_lecture()
        OR (s.seller_type = 'mining_company' AND s.seller_id = public.snp_societe_utilisateur())
        OR (up.role = 'customer' AND lower(up.email) = lower(c.email))
      )
  );
$fn$;
REVOKE ALL ON FUNCTION public.snp_peut_consulter_vente(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_consulter_vente(uuid) TO authenticated;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DO $block$
DECLARE v_policy record;
BEGIN
  FOR v_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sales', v_policy.policyname);
  END LOOP;
END;
$block$;
CREATE POLICY snp_ventes_lecture_perimetre ON public.sales
  FOR SELECT TO authenticated USING (public.snp_peut_consulter_vente(id));
CREATE POLICY snp_ventes_insertion_interne ON public.sales
  FOR INSERT TO authenticated WITH CHECK (public.snp_est_agent_sonasp());
CREATE POLICY snp_ventes_modification_interne ON public.sales
  FOR UPDATE TO authenticated USING (public.snp_est_agent_sonasp())
  WITH CHECK (public.snp_est_agent_sonasp());
CREATE POLICY snp_ventes_suppression_admin ON public.sales
  FOR DELETE TO authenticated USING (public.snp_role_utilisateur() IN ('owner', 'admin'));

ALTER TABLE public.gold_sales_settings ENABLE ROW LEVEL SECURITY;
DO $block$
DECLARE v_policy record;
BEGIN
  FOR v_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'gold_sales_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.gold_sales_settings', v_policy.policyname);
  END LOOP;
END;
$block$;
CREATE POLICY snp_parametres_vente_lecture ON public.gold_sales_settings
  FOR SELECT TO authenticated USING (
    public.snp_est_agent_sonasp()
    OR public.snp_est_direction_lecture()
    OR mining_company_id = public.snp_societe_utilisateur()
  );
CREATE POLICY snp_parametres_vente_ecriture_interne ON public.gold_sales_settings
  FOR ALL TO authenticated USING (public.snp_est_agent_sonasp())
  WITH CHECK (public.snp_est_agent_sonasp());

DO $block$
DECLARE
  v_table text;
  v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['sale_pricing_details', 'sales_allocations'] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    FOR v_policy IN SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY snp_vente_enfant_lecture ON public.%I FOR SELECT TO authenticated ' ||
      'USING (public.snp_peut_consulter_vente(sale_id))', v_table
    );
    EXECUTE format(
      'CREATE POLICY snp_vente_enfant_ecriture ON public.%I FOR ALL TO authenticated ' ||
      'USING (public.snp_est_agent_sonasp()) WITH CHECK (public.snp_est_agent_sonasp())', v_table
    );
  END LOOP;
END;
$block$;

-- Les tables filles d'expédition ne portent pas mining_company_id. Elles
-- héritent donc obligatoirement du périmètre de leur préparation parente.
CREATE OR REPLACE FUNCTION public.snp_peut_consulter_expedition(p_expedition_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.shipping_preparations s
    WHERE s.id = p_expedition_id
      AND (
        public.snp_est_agent_sonasp()
        OR public.snp_est_direction_lecture()
        OR s.mining_company_id = public.snp_societe_utilisateur()
      )
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_peut_gerer_expedition(p_expedition_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.shipping_preparations s
    WHERE s.id = p_expedition_id
      AND (
        public.snp_est_agent_sonasp()
        OR s.mining_company_id = public.snp_societe_utilisateur()
      )
  );
$fn$;

REVOKE ALL ON FUNCTION public.snp_peut_consulter_expedition(uuid) FROM public;
REVOKE ALL ON FUNCTION public.snp_peut_gerer_expedition(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_consulter_expedition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_peut_gerer_expedition(uuid) TO authenticated;

DO $block$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND a.attname = 'shipping_preparation_id' AND NOT a.attisdropped
      AND c.relname <> 'shipping_preparations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table.table_name);
    EXECUTE format('DROP POLICY IF EXISTS snp_expedition_enfant_lecture ON public.%I', v_table.table_name);
    EXECUTE format(
      'CREATE POLICY snp_expedition_enfant_lecture ON public.%I AS RESTRICTIVE ' ||
      'FOR SELECT TO authenticated USING (public.snp_peut_consulter_expedition(shipping_preparation_id))',
      v_table.table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS snp_expedition_enfant_insertion ON public.%I', v_table.table_name);
    EXECUTE format(
      'CREATE POLICY snp_expedition_enfant_insertion ON public.%I AS RESTRICTIVE ' ||
      'FOR INSERT TO authenticated WITH CHECK (public.snp_peut_gerer_expedition(shipping_preparation_id))',
      v_table.table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS snp_expedition_enfant_modification ON public.%I', v_table.table_name);
    EXECUTE format(
      'CREATE POLICY snp_expedition_enfant_modification ON public.%I AS RESTRICTIVE ' ||
      'FOR UPDATE TO authenticated USING (public.snp_peut_gerer_expedition(shipping_preparation_id)) ' ||
      'WITH CHECK (public.snp_peut_gerer_expedition(shipping_preparation_id))',
      v_table.table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS snp_expedition_enfant_suppression ON public.%I', v_table.table_name);
    EXECUTE format(
      'CREATE POLICY snp_expedition_enfant_suppression ON public.%I AS RESTRICTIVE ' ||
      'FOR DELETE TO authenticated USING (public.snp_peut_gerer_expedition(shipping_preparation_id))',
      v_table.table_name
    );
  END LOOP;
END;
$block$;

-- Même principe pour les pièces, productions et signataires d'un transport.
CREATE OR REPLACE FUNCTION public.snp_peut_consulter_transport(p_transport_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.freight_shipments f
    WHERE f.id = p_transport_id
      AND (
        public.snp_est_agent_sonasp()
        OR public.snp_est_direction_lecture()
        OR f.mining_company_id = public.snp_societe_utilisateur()
      )
  );
$fn$;
REVOKE ALL ON FUNCTION public.snp_peut_consulter_transport(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_consulter_transport(uuid) TO authenticated;

DO $block$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND a.attname = 'freight_shipment_id' AND NOT a.attisdropped
      AND c.relname NOT IN ('freight_shipments', 'gold_inventory', 'inventory_transactions')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table.table_name);
    EXECUTE format('DROP POLICY IF EXISTS snp_transport_enfant_lecture ON public.%I', v_table.table_name);
    EXECUTE format(
      'CREATE POLICY snp_transport_enfant_lecture ON public.%I AS RESTRICTIVE ' ||
      'FOR SELECT TO authenticated USING (public.snp_peut_consulter_transport(freight_shipment_id))',
      v_table.table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS snp_transport_enfant_ecriture ON public.%I', v_table.table_name);
    EXECUTE format(
      'CREATE POLICY snp_transport_enfant_ecriture ON public.%I AS RESTRICTIVE FOR ALL TO authenticated ' ||
      'USING (public.snp_est_agent_sonasp() OR public.snp_peut_consulter_transport(freight_shipment_id)) ' ||
      'WITH CHECK (public.snp_est_agent_sonasp() OR public.snp_peut_consulter_transport(freight_shipment_id))',
      v_table.table_name
    );
  END LOOP;
END;
$block$;

-- ---------------------------------------------------------------------------
-- Stock : la mine consulte ses lots, la SONASP conserve l'agrégat national
-- ---------------------------------------------------------------------------
-- `gold_inventory` a reçu mining_company_id après l'ancien passage transversal
-- de cloisonnement. On réinstalle donc explicitement la barrière, puis les
-- mouvements héritent du périmètre de leur lot parent.
ALTER TABLE public.gold_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_stock_acces_authentifie ON public.gold_inventory;
CREATE POLICY snp_stock_acces_authentifie ON public.gold_inventory
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS snp_stock_lecture_perimetre ON public.gold_inventory;
CREATE POLICY snp_stock_lecture_perimetre ON public.gold_inventory AS RESTRICTIVE
  FOR SELECT TO authenticated USING (
    public.snp_mfa_satisfaite()
    AND (
      public.snp_est_agent_sonasp()
      OR public.snp_est_direction_lecture()
      OR mining_company_id = public.snp_societe_utilisateur()
    )
  );

DROP POLICY IF EXISTS snp_stock_insertion_interne ON public.gold_inventory;
CREATE POLICY snp_stock_insertion_interne ON public.gold_inventory AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.snp_est_agent_sonasp());
DROP POLICY IF EXISTS snp_stock_modification_interne ON public.gold_inventory;
CREATE POLICY snp_stock_modification_interne ON public.gold_inventory AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.snp_est_agent_sonasp())
  WITH CHECK (public.snp_est_agent_sonasp());
DROP POLICY IF EXISTS snp_stock_suppression_interne ON public.gold_inventory;
CREATE POLICY snp_stock_suppression_interne ON public.gold_inventory AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.snp_role_utilisateur() IN ('owner', 'admin'));

CREATE OR REPLACE FUNCTION public.snp_peut_consulter_mouvement_stock(p_inventory_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.gold_inventory i
    WHERE i.id = p_inventory_id
      AND (
        public.snp_est_agent_sonasp()
        OR public.snp_est_direction_lecture()
        OR i.mining_company_id = public.snp_societe_utilisateur()
      )
  );
$fn$;
REVOKE ALL ON FUNCTION public.snp_peut_consulter_mouvement_stock(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_consulter_mouvement_stock(uuid) TO authenticated;

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_mouvement_stock_acces_authentifie ON public.inventory_transactions;
CREATE POLICY snp_mouvement_stock_acces_authentifie ON public.inventory_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS snp_mouvement_stock_lecture ON public.inventory_transactions;
CREATE POLICY snp_mouvement_stock_lecture ON public.inventory_transactions AS RESTRICTIVE
  FOR SELECT TO authenticated USING (public.snp_peut_consulter_mouvement_stock(inventory_id));
DROP POLICY IF EXISTS snp_mouvement_stock_ecriture ON public.inventory_transactions;
DROP POLICY IF EXISTS snp_mouvement_stock_insertion ON public.inventory_transactions;
CREATE POLICY snp_mouvement_stock_insertion ON public.inventory_transactions AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.snp_est_agent_sonasp());
DROP POLICY IF EXISTS snp_mouvement_stock_modification ON public.inventory_transactions;
CREATE POLICY snp_mouvement_stock_modification ON public.inventory_transactions AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.snp_est_agent_sonasp())
  WITH CHECK (public.snp_est_agent_sonasp());
DROP POLICY IF EXISTS snp_mouvement_stock_suppression ON public.inventory_transactions;
CREATE POLICY snp_mouvement_stock_suppression ON public.inventory_transactions AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.snp_role_utilisateur() IN ('owner', 'admin'));

-- Toute table annexe portant sale_id reçoit une barrière restrictive de
-- lecture. Elle complète, sans remplacer, ses permissions fonctionnelles.
DO $block$
DECLARE v_table record;
BEGIN
  FOR v_table IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND a.attname = 'sale_id' AND NOT a.attisdropped
      AND c.relname <> 'sales'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table.table_name);
    EXECUTE format('DROP POLICY IF EXISTS snp_vente_enfant_acces_authentifie ON public.%I', v_table.table_name);
    EXECUTE format(
      'CREATE POLICY snp_vente_enfant_acces_authentifie ON public.%I ' ||
      'FOR SELECT TO authenticated USING (true)', v_table.table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS snp_vente_enfant_perimetre ON public.%I', v_table.table_name);
    EXECUTE format(
      'CREATE POLICY snp_vente_enfant_perimetre ON public.%I AS RESTRICTIVE ' ||
      'FOR SELECT TO authenticated USING (public.snp_peut_consulter_vente(sale_id))',
      v_table.table_name
    );
  END LOOP;
END;
$block$;

-- Les vues de stock et de licences doivent appliquer les RLS de leurs tables
-- sources au lieu de s'exécuter avec les droits du propriétaire de la vue.
DO $block$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'current_inventory_status' AND c.relkind = 'v'
  ) THEN
    ALTER VIEW public.current_inventory_status SET (security_invoker = true);
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'monthly_inventory_summary' AND c.relkind = 'v'
  ) THEN
    ALTER VIEW public.monthly_inventory_summary SET (security_invoker = true);
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_export_licenses_summary' AND c.relkind = 'v'
  ) THEN
    ALTER VIEW public.v_export_licenses_summary SET (security_invoker = true);
  END IF;
END;
$block$;

COMMENT ON FUNCTION public.snp_creer_vente_export_mine(uuid, numeric, numeric, numeric, numeric, text, uuid) IS
  'Crée atomiquement une vente du reliquat non racheté de la mine authentifiée.';
COMMENT ON FUNCTION public.snp_stock_exportable_mine() IS
  'Retourne production moins achats SONASP moins ventes engagées pour la mine authentifiée.';
