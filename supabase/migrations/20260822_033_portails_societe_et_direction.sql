-- ============================================================================
-- Portails Société minière et Direction — rôles et garde-fous serveur
--
-- Le rôle historique `management` conserve ses workflows de validation.
-- `manager` est volontairement distinct : lecture transversale, aucune écriture.
-- Le contexte d'une mine reste porté par user_profiles.mining_company_id ; seul
-- l'Owner peut demander un autre périmètre, toujours validé par les politiques.
-- ============================================================================

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (
    role = ANY (ARRAY[
      'owner'::text, 'admin'::text, 'management'::text, 'manager'::text, 'mine'::text,
      'factory'::text, 'airport'::text, 'refinery'::text, 'customer'::text
    ])
  );

-- Le compte propriétaire de référence porte également son rôle dans la base.
UPDATE public.user_profiles
SET role = 'owner', is_active = true, mining_company_id = NULL, updated_at = now()
WHERE lower(email) = 'romuald.tiegnan@gmail.com';

CREATE OR REPLACE FUNCTION public.protect_user_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_privileged boolean := false;
BEGIN
  IF COALESCE(auth.role() = 'service_role', false) THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_active AND role IN ('owner', 'admin', 'management')
  ) INTO v_privileged;
  IF v_privileged THEN RETURN NEW; END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modification du rôle interdite (élévation de privilège).';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Modification de is_active interdite.';
  END IF;
  IF NEW.site_ids IS DISTINCT FROM OLD.site_ids THEN
    RAISE EXCEPTION 'Modification des sites autorisés interdite.';
  END IF;
  IF NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id THEN
    RAISE EXCEPTION 'Modification du rattachement à la société minière interdite.';
  END IF;
  RETURN NEW;
END;
$fn$;

-- Point d'entrée unique de modification d'un compte de portail. Il évite que
-- l'écran d'administration ne transforme des identifiants de mines en sites et
-- maintient l'invariant : un compte `mine`, une société ; les autres, aucune.
CREATE OR REPLACE FUNCTION public.snp_configurer_compte_portail(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_role text,
  p_is_active boolean,
  p_mining_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_active AND role IN ('owner', 'admin', 'management')
  ) THEN
    RAISE EXCEPTION 'Seule une administration habilitée peut configurer un compte.'
      USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('owner', 'admin', 'management', 'manager', 'mine', 'factory', 'airport', 'refinery', 'customer') THEN
    RAISE EXCEPTION 'Rôle de compte invalide.';
  END IF;
  IF p_role = 'mine' AND p_mining_company_id IS NULL THEN
    RAISE EXCEPTION 'Un compte Société minière doit être rattaché à une société.';
  END IF;
  IF p_role <> 'mine' AND p_mining_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ce rôle ne peut pas recevoir un périmètre de société minière.';
  END IF;
  IF p_mining_company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.mining_companies WHERE id = p_mining_company_id AND is_active
  ) THEN
    RAISE EXCEPTION 'La société minière sélectionnée est inactive ou introuvable.';
  END IF;

  UPDATE public.user_profiles
  SET full_name = NULLIF(trim(p_full_name), ''),
      phone = NULLIF(trim(p_phone), ''),
      role = p_role,
      is_active = p_is_active,
      mining_company_id = CASE WHEN p_role = 'mine' THEN p_mining_company_id ELSE NULL END,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Compte utilisateur introuvable.'; END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_configurer_compte_portail(uuid, text, text, text, boolean, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_configurer_compte_portail(uuid, text, text, text, boolean, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_est_direction_lecture()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active
      AND role = 'manager'
      AND mining_company_id IS NULL
  ) AND public.snp_mfa_satisfaite();
$fn$;

COMMENT ON FUNCTION public.snp_est_direction_lecture() IS
  'Profil Direction actif, transversal et strictement consultatif.';
REVOKE ALL ON FUNCTION public.snp_est_direction_lecture() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_est_direction_lecture() TO authenticated;

-- Les politiques anciennes de certains modules autorisent encore des écritures
-- à tout utilisateur authentifié. Ce déclencheur constitue la barrière finale :
-- un Manager ne peut jamais créer, modifier ou supprimer une donnée métier,
-- même si une politique historique trop large subsiste.
CREATE OR REPLACE FUNCTION public.snp_interdire_ecriture_direction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_active AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Le rôle Manager est limité à la consultation.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_interdire_ecriture_direction() FROM public;

DO $block$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'mining_companies',
    'annual_budgets', 'monthly_budgets', 'quarterly_forecasts',
    'daily_production', 'mining_company_documents',
    'snp_plans_achat', 'snp_demandes_achat', 'snp_contrats',
    'snp_factures_achat', 'snp_reglements_achat',
    'snp_analyses_teneur', 'snp_requisitions'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS snp_direction_lecture_seule ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY snp_direction_lecture_seule ON public.%I FOR SELECT TO authenticated USING (public.snp_est_direction_lecture())',
      v_table
    );

    EXECUTE format('DROP TRIGGER IF EXISTS snp_direction_aucune_ecriture ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER snp_direction_aucune_ecriture BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.snp_interdire_ecriture_direction()',
      v_table
    );
  END LOOP;
END;
$block$;

-- Le rôle Manager n'entre jamais dans la population des agents SONASP qui
-- valident ou modifient les opérations. Cette fonction remplace explicitement
-- sa définition afin que l'intention reste vérifiable dans le schéma final.
CREATE OR REPLACE FUNCTION public.snp_est_agent_sonasp()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active
      AND mining_company_id IS NULL
      AND role IN ('owner', 'admin', 'management', 'factory', 'airport', 'refinery')
  ) AND public.snp_mfa_satisfaite();
$fn$;

REVOKE ALL ON FUNCTION public.snp_est_agent_sonasp() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_est_agent_sonasp() TO authenticated;

-- ============================================================================
-- Portail Société : un compte primaire, des écritures atomiques et cloisonnées
-- ============================================================================

-- Une mine ne possède qu'un compte primaire actif. Les comptes SONASP et
-- Direction restent hors de cet invariant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_compte_mine_actif_unique
  ON public.user_profiles (mining_company_id)
  WHERE is_active AND mining_company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.snp_est_operateur_interne()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active
      AND mining_company_id IS NULL
      AND role IN ('owner', 'admin', 'management', 'factory', 'airport', 'refinery')
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_societe_compte_mine()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid;
BEGIN
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

REVOKE ALL ON FUNCTION public.snp_est_operateur_interne() FROM public;
REVOKE ALL ON FUNCTION public.snp_societe_compte_mine() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_est_operateur_interne() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_societe_compte_mine() TO authenticated;

-- Les anciennes politiques de ces tables étaient globales (`USING (true)`).
-- Elles sont remplacées par une lecture limitée au périmètre et des écritures
-- directes réservées à la SONASP. Le compte mine écrit uniquement via les RPC
-- ci-dessous, qui dérivent sa société depuis auth.uid().
DO $block$
DECLARE
  v_table text;
  v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'annual_budgets', 'monthly_budgets', 'quarterly_forecasts',
    'daily_production', 'mining_company_documents'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);

    FOR v_policy IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY snp_portail_lecture_perimetre ON public.%I FOR SELECT TO authenticated USING (' ||
      'public.snp_est_operateur_interne() OR public.snp_est_direction_lecture() OR ' ||
      'mining_company_id = public.snp_societe_utilisateur())',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY snp_portail_ecriture_interne ON public.%I FOR ALL TO authenticated USING (' ||
      'public.snp_est_operateur_interne()) WITH CHECK (public.snp_est_operateur_interne())',
      v_table
    );
  END LOOP;
END;
$block$;

-- ---------------------------------------------------------------------------
-- Prévisions : création de l'exercice si nécessaire, puis révision mensuelle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_portail_mine_soumettre_budget(
  p_annee integer,
  p_mois integer,
  p_budget_oz numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_budget_annuel uuid;
  v_budget_mensuel uuid;
  v_site text;
  v_jours integer;
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
    budget_oz = EXCLUDED.budget_oz,
    days_in_month = EXCLUDED.days_in_month,
    daily_budget_oz = EXCLUDED.daily_budget_oz,
    mining_company_id = EXCLUDED.mining_company_id,
    updated_at = now()
  RETURNING id INTO v_budget_mensuel;
  RETURN v_budget_mensuel;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_portail_mine_soumettre_prevision(
  p_annee integer,
  p_mois integer,
  p_prevision_oz numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_budget uuid;
  v_prevision uuid;
  v_site text;
  v_jours integer;
  v_trimestre integer;
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
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_budget;
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
    revision_date = EXCLUDED.revision_date,
    forecast_oz = EXCLUDED.forecast_oz,
    days_in_month = EXCLUDED.days_in_month,
    daily_forecast_oz = EXCLUDED.daily_forecast_oz,
    notes = EXCLUDED.notes,
    created_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_prevision;

  RETURN v_prevision;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Production : tous les calculs et le rattachement sont faits sur le serveur
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_portail_mine_declarer_production(
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
  v_id uuid;
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
  IF length(coalesce(p_notes, '')) > 2000 THEN RAISE EXCEPTION 'Les observations sont trop longues.'; END IF;

  SELECT upper(coalesce(nullif(code, ''), 'MINE')) INTO v_code
  FROM public.mining_companies WHERE id = v_societe AND is_active;
  IF v_code IS NULL THEN RAISE EXCEPTION 'La société minière est inactive.'; END IF;

  v_reference := nullif(upper(trim(p_reference_barre)), '');
  IF v_reference IS NULL THEN
    SELECT v_code || '-' || to_char(p_date_production, 'YYYYMMDD') || '-' ||
           lpad((count(*) + 1)::text, 3, '0')
    INTO v_reference
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

-- ---------------------------------------------------------------------------
-- Demandes SONASP : réponse de la mine, sous verrou et avec motif obligatoire
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_portail_mine_repondre_demande(
  p_demande_id uuid,
  p_decision text,
  p_motif text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_statut text;
BEGIN
  SELECT statut INTO v_statut FROM public.snp_demandes_achat
  WHERE id = p_demande_id AND mining_company_id = v_societe FOR UPDATE;
  IF v_statut IS NULL THEN RAISE EXCEPTION 'Demande introuvable dans votre périmètre.'; END IF;
  IF v_statut <> 'soumise' THEN RAISE EXCEPTION 'Cette demande a déjà été traitée ou n''est pas encore soumise.'; END IF;
  IF p_decision NOT IN ('approuver', 'rejeter', 'clarification') THEN RAISE EXCEPTION 'Décision invalide.'; END IF;
  IF p_decision <> 'approuver' AND length(trim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Un motif d''au moins cinq caractères est requis.';
  END IF;

  UPDATE public.snp_demandes_achat SET
    statut = CASE p_decision WHEN 'approuver' THEN 'approuvee' WHEN 'rejeter' THEN 'rejetee' ELSE 'modification_demandee' END,
    motif_rejet = CASE WHEN p_decision = 'rejeter' THEN trim(p_motif) ELSE NULL END,
    motif_modification = CASE WHEN p_decision = 'clarification' THEN trim(p_motif) ELSE NULL END,
    date_reponse = now(), repondu_par = auth.uid(), updated_by = auth.uid(), updated_at = now()
  WHERE id = p_demande_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Règlements : accusé de réception distinct du cycle comptable SONASP
-- ---------------------------------------------------------------------------
ALTER TABLE public.snp_reglements_achat
  ADD COLUMN IF NOT EXISTS reception_statut text NOT NULL DEFAULT 'a_confirmer',
  ADD COLUMN IF NOT EXISTS reception_motif text,
  ADD COLUMN IF NOT EXISTS reception_repondu_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reception_repondu_le timestamptz;

DO $block$ BEGIN
  ALTER TABLE public.snp_reglements_achat
    ADD CONSTRAINT snp_reglement_reception_statut_check
    CHECK (reception_statut IN ('non_requise', 'a_confirmer', 'confirmee', 'contestee'));
EXCEPTION WHEN duplicate_object THEN NULL; END $block$;

CREATE OR REPLACE FUNCTION public.snp_portail_mine_repondre_reglement(
  p_reglement_id uuid,
  p_decision text,
  p_motif text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_statut text;
  v_reception text;
BEGIN
  SELECT statut, reception_statut INTO v_statut, v_reception
  FROM public.snp_reglements_achat
  WHERE id = p_reglement_id AND mining_company_id = v_societe FOR UPDATE;
  IF v_statut IS NULL THEN RAISE EXCEPTION 'Règlement introuvable dans votre périmètre.'; END IF;
  IF v_statut NOT IN ('execute', 'rapproche') THEN
    RAISE EXCEPTION 'Seul un règlement exécuté peut être confirmé.';
  END IF;
  IF v_reception <> 'a_confirmer' THEN RAISE EXCEPTION 'Une réponse a déjà été enregistrée.'; END IF;
  IF p_decision NOT IN ('confirmer', 'contester') THEN RAISE EXCEPTION 'Décision invalide.'; END IF;
  IF p_decision = 'contester' AND length(trim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Le motif de contestation doit contenir au moins cinq caractères.';
  END IF;

  UPDATE public.snp_reglements_achat SET
    reception_statut = CASE WHEN p_decision = 'confirmer' THEN 'confirmee' ELSE 'contestee' END,
    reception_motif = CASE WHEN p_decision = 'contester' THEN trim(p_motif) ELSE NULL END,
    reception_repondu_par = auth.uid(), reception_repondu_le = now(), updated_at = now()
  WHERE id = p_reglement_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Documents : dépôt privé, métadonnées rattachées côté serveur à la mine
-- ---------------------------------------------------------------------------
ALTER TABLE public.mining_company_documents
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.snp_contrats(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.snp_portail_mine_enregistrer_document(
  p_chemin_temporaire text,
  p_nom_fichier text,
  p_type_document text,
  p_type_mime text,
  p_taille_octets bigint,
  p_contrat_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_id uuid;
BEGIN
  IF p_chemin_temporaire NOT LIKE 'incoming/' || auth.uid()::text || '/%' THEN
    RAISE EXCEPTION 'Chemin de dépôt non autorisé.' USING ERRCODE = '42501';
  END IF;
  IF p_taille_octets IS NULL OR p_taille_octets <= 0 OR p_taille_octets > 15728640 THEN
    RAISE EXCEPTION 'Le document doit avoir une taille comprise entre 1 octet et 15 Mo.';
  END IF;
  IF p_type_mime NOT IN ('application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') THEN
    RAISE EXCEPTION 'Ce format de document n''est pas autorisé.';
  END IF;
  IF p_contrat_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.snp_contrats WHERE id = p_contrat_id AND mining_company_id = v_societe
  ) THEN RAISE EXCEPTION 'Le contrat sélectionné n''appartient pas à votre société.'; END IF;

  INSERT INTO public.mining_company_documents(
    mining_company_id, contract_id, doc_type, file_name, file_path,
    file_size, mime_type, uploaded_by
  ) VALUES (
    v_societe, p_contrat_id, nullif(trim(p_type_document), ''), trim(p_nom_fichier),
    p_chemin_temporaire, p_taille_octets, p_type_mime, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_portail_mine_soumettre_prevision(integer, integer, numeric, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_portail_mine_soumettre_budget(integer, integer, numeric) FROM public;
REVOKE ALL ON FUNCTION public.snp_portail_mine_declarer_production(date, numeric, numeric, text, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_portail_mine_repondre_demande(uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_portail_mine_repondre_reglement(uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_portail_mine_enregistrer_document(text, text, text, text, bigint, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_soumettre_prevision(integer, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_soumettre_budget(integer, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_declarer_production(date, numeric, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_repondre_demande(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_repondre_reglement(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_enregistrer_document(text, text, text, text, bigint, uuid) TO authenticated;

-- Le bucket reste privé. Un compte mine ne peut déposer que sous son identité,
-- puis lire seulement les objets devenus des documents de sa propre société.
DROP POLICY IF EXISTS "mining_company_docs_read" ON storage.objects;
DROP POLICY IF EXISTS "mining_company_docs_write" ON storage.objects;
DROP POLICY IF EXISTS "mining_company_docs_delete" ON storage.objects;
DROP POLICY IF EXISTS snp_portail_mine_documents_read ON storage.objects;
DROP POLICY IF EXISTS snp_portail_mine_documents_write ON storage.objects;
DROP POLICY IF EXISTS snp_portail_mine_documents_delete ON storage.objects;

CREATE POLICY snp_portail_mine_documents_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'mining-company-documents' AND (
      public.snp_est_operateur_interne() OR public.snp_est_direction_lecture() OR EXISTS (
        SELECT 1 FROM public.mining_company_documents d
        WHERE d.file_path = storage.objects.name
          AND d.mining_company_id = public.snp_societe_utilisateur()
      )
    )
  );

CREATE POLICY snp_portail_mine_documents_write ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'mining-company-documents' AND (
      public.snp_est_operateur_interne()
      OR name LIKE 'incoming/' || auth.uid()::text || '/%'
    )
  );

CREATE POLICY snp_portail_mine_documents_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'mining-company-documents' AND (
      public.snp_est_operateur_interne()
      OR name LIKE 'incoming/' || auth.uid()::text || '/%'
    )
  );
