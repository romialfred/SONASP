-- LOT 1D - Surface RPC SECURITY DEFINER deny-by-default.
--
-- Cette migration doit suivre 20260824235900_durcir_cloisonnement_p0_et_quota_export.sql.
-- Elle ne modifie ni le frontend ni les Edge Functions et ne doit pas être
-- appliquée à distance avant validation du drift et sauvegarde du catalogue.

SET statement_timeout = '90s';
SET lock_timeout = '10s';

-- --------------------------------------------------------------------------
-- 0. Préflight : le lot P0 et les capacités utilisées doivent être présents.
-- --------------------------------------------------------------------------
DO $preflight$
BEGIN
  IF to_regprocedure('public.snp_sec_aal2()') IS NULL
     OR to_regprocedure('public.snp_sec_can_read_company(uuid)') IS NULL
     OR to_regprocedure('public.snp_sec_can_prepare_company(uuid)') IS NULL
     OR to_regprocedure(
       'public.snp_transition_shipping_preparation(uuid,public.shipping_preparation_status,public.shipping_preparation_status)'
     ) IS NULL THEN
    RAISE EXCEPTION
      'Préflight RPC : la migration P0 20260824235900 doit être appliquée avant ce lot.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code = 'accounts.manage' AND sensitive
  ) OR NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code = 'sonasp.finance.execute' AND sensitive
  ) THEN
    RAISE EXCEPTION
      'Préflight RPC : accounts.manage ou sonasp.finance.execute est absente/non sensible.';
  END IF;

  IF to_regprocedure('public.check_license_availability(uuid,numeric)') IS NULL
     OR to_regprocedure('public.check_sale_authorization(uuid,uuid,numeric,numeric)') IS NULL
     OR to_regprocedure('public.convert_virtual_to_actual_payment(uuid,date,text,text,text,text,numeric,text,text,uuid)') IS NULL
     OR to_regprocedure('public.get_authorized_customers_for_mine(uuid)') IS NULL
     OR to_regprocedure('public.get_next_expedition_lot_number(uuid,integer)') IS NULL
     OR to_regprocedure('public.get_user_modules(uuid)') IS NULL
     OR to_regprocedure('public.log_security_event(uuid,text,text,text,jsonb)') IS NULL
     OR to_regprocedure('public.log_user_activity(uuid,text,text,text,uuid,text,jsonb,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Préflight RPC : une signature prioritaire attendue est absente.';
  END IF;

  IF to_regclass('public.security_events') IS NULL
     OR to_regclass('public.user_activation_tokens') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_activation_tokens'
         AND column_name = 'used_at' AND data_type = 'timestamp with time zone'
     ) OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_activation_tokens'
         AND column_name = 'expires_at' AND data_type = 'timestamp with time zone'
     ) THEN
    RAISE EXCEPTION
      'Préflight activation : security_events/user_activation_tokens ou colonnes canoniques absentes.';
  END IF;
END;
$preflight$;

CREATE INDEX IF NOT EXISTS idx_security_events_event_ip_created
  ON public.security_events(event_type, ip_address, created_at DESC);

-- Endpoint de consommation réservé à l’Edge Function activate-account.
-- Le secret temporaire historique n’est ni lu, ni écrit, ni retourné.
CREATE OR REPLACE FUNCTION public.consume_activation_token(
  p_token text,
  p_now timestamptz DEFAULT clock_timestamp()
)
RETURNS TABLE(user_id uuid, token_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Cette opération est réservée au service d’activation.'
      USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_token), '') IS NULL OR length(p_token) > 1024
     OR p_now IS NULL THEN
    RAISE EXCEPTION 'Jeton ou horodatage invalide.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.user_activation_tokens t
  SET used_at = p_now
  WHERE t.token = p_token
    AND t.used_at IS NULL
    AND t.expires_at > p_now
    AND t.token_type IN ('activation', 'password_reset')
  RETURNING t.user_id, t.token_type;
END;
$fn$;

-- --------------------------------------------------------------------------
-- 1. Durcissement prioritaire sans changement de signature ni de type retour.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_license_availability(
  p_license_id uuid,
  p_required_quantity numeric
)
RETURNS TABLE(is_available boolean, remaining_quantity numeric, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_license record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.snp_sec_aal2() THEN
    RAISE EXCEPTION 'Authentification AAL2 requise.' USING ERRCODE = '42501';
  END IF;
  IF p_license_id IS NULL OR p_required_quantity IS NULL
     OR p_required_quantity <= 0 THEN
    RAISE EXCEPTION 'Licence et quantité strictement positive requises.'
      USING ERRCODE = '22023';
  END IF;

  SELECT el.id, el.status, el.remaining_quantity_grams,
         el.end_date, el.license_number, el.mining_company_id
  INTO v_license
  FROM public.export_licenses el
  WHERE el.id = p_license_id
    AND public.snp_sec_can_read_company(el.mining_company_id);

  IF v_license.id IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric,
      'Licence introuvable ou inaccessible.'::text;
    RETURN;
  END IF;
  IF v_license.status <> 'active' THEN
    RETURN QUERY SELECT false, v_license.remaining_quantity_grams,
      format('Licence %s inactive.', v_license.license_number)::text;
    RETURN;
  END IF;
  IF v_license.end_date < current_date THEN
    RETURN QUERY SELECT false, v_license.remaining_quantity_grams,
      format('Licence %s expirée.', v_license.license_number)::text;
    RETURN;
  END IF;
  IF v_license.remaining_quantity_grams < p_required_quantity THEN
    RETURN QUERY SELECT false, v_license.remaining_quantity_grams,
      format(
        'Quantité insuffisante. Disponible: %sg, requis: %sg.',
        round(v_license.remaining_quantity_grams, 2),
        round(p_required_quantity, 2)
      )::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_license.remaining_quantity_grams,
    format('Quantité disponible: %sg.', round(v_license.remaining_quantity_grams, 2))::text;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_authorized_customers_for_mine(
  p_mining_company_id uuid
)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  max_stock_percentage numeric,
  sale_method text,
  refining_fees_paid_by_customer boolean,
  transport_fees_paid_by_customer boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.snp_sec_aal2() THEN
    RAISE EXCEPTION 'Authentification AAL2 requise.' USING ERRCODE = '42501';
  END IF;
  IF p_mining_company_id IS NULL
     OR NOT public.snp_sec_can_read_company(p_mining_company_id) THEN
    RAISE EXCEPTION 'Périmètre société minière interdit.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, gss.max_stock_percentage, gss.sale_method,
         gss.refining_fees_paid_by_customer,
         gss.transport_fees_paid_by_customer
  FROM public.gold_sales_settings gss
  JOIN public.customers c ON c.id = gss.customer_id
  WHERE gss.mining_company_id = p_mining_company_id
    AND gss.is_active
  ORDER BY c.name;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.check_sale_authorization(
  p_mining_company_id uuid,
  p_customer_id uuid,
  p_quantity_oz numeric,
  p_available_stock_oz numeric
)
RETURNS TABLE(
  is_authorized boolean,
  reason text,
  max_allowed_oz numeric,
  settings jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_settings public.gold_sales_settings%ROWTYPE;
  v_max_allowed_oz numeric;
  v_percentage numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.snp_sec_aal2() THEN
    RAISE EXCEPTION 'Authentification AAL2 requise.' USING ERRCODE = '42501';
  END IF;
  IF p_mining_company_id IS NULL
     OR NOT public.snp_sec_can_read_company(p_mining_company_id) THEN
    RAISE EXCEPTION 'Périmètre société minière interdit.' USING ERRCODE = '42501';
  END IF;
  IF p_customer_id IS NULL OR p_quantity_oz IS NULL OR p_quantity_oz <= 0 THEN
    RETURN QUERY SELECT false, 'La quantité doit être supérieure à zéro.'::text,
      0::numeric, NULL::jsonb;
    RETURN;
  END IF;
  IF p_available_stock_oz IS NULL OR p_available_stock_oz <= 0 THEN
    RETURN QUERY SELECT false, 'Le stock disponible est insuffisant.'::text,
      0::numeric, NULL::jsonb;
    RETURN;
  END IF;

  SELECT * INTO v_settings
  FROM public.gold_sales_settings
  WHERE mining_company_id = p_mining_company_id
    AND customer_id = p_customer_id
    AND is_active
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_settings.id IS NULL THEN
    RETURN QUERY SELECT
      p_quantity_oz <= p_available_stock_oz,
      CASE WHEN p_quantity_oz <= p_available_stock_oz
        THEN 'Vente autorisée.'
        ELSE 'La quantité demandée dépasse le stock disponible.'
      END::text,
      p_available_stock_oz,
      NULL::jsonb;
    RETURN;
  END IF;

  v_max_allowed_oz :=
    (p_available_stock_oz * v_settings.max_stock_percentage) / 100.0;
  v_percentage := (p_quantity_oz / p_available_stock_oz) * 100.0;

  RETURN QUERY SELECT
    p_quantity_oz <= v_max_allowed_oz,
    CASE WHEN p_quantity_oz <= v_max_allowed_oz
      THEN 'Vente autorisée.'
      ELSE format(
        'La quantité demandée (%s %%) dépasse le plafond autorisé (%s %%).',
        round(v_percentage, 2), round(v_settings.max_stock_percentage, 2)
      )
    END::text,
    v_max_allowed_oz,
    jsonb_build_object(
      'max_stock_percentage', v_settings.max_stock_percentage,
      'sale_method', v_settings.sale_method,
      'refining_fees_paid_by_customer', v_settings.refining_fees_paid_by_customer,
      'transport_fees_paid_by_customer', v_settings.transport_fees_paid_by_customer
    );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_next_expedition_lot_number(
  p_mining_company_id uuid,
  p_year integer DEFAULT extract(year FROM current_date)::integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_counter integer;
  v_abbreviation text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.snp_sec_aal2() THEN
    RAISE EXCEPTION 'Authentification AAL2 requise.' USING ERRCODE = '42501';
  END IF;
  IF p_mining_company_id IS NULL
     OR NOT public.snp_sec_can_prepare_company(p_mining_company_id) THEN
    RAISE EXCEPTION 'Préparation interdite dans ce tenant.' USING ERRCODE = '42501';
  END IF;
  IF p_year IS NULL OR p_year < extract(year FROM current_date)::integer - 1
     OR p_year > extract(year FROM current_date)::integer + 1 THEN
    RAISE EXCEPTION 'Année de lot hors fenêtre autorisée.' USING ERRCODE = '22023';
  END IF;

  SELECT mc.abbreviation INTO v_abbreviation
  FROM public.mining_companies mc
  WHERE mc.id = p_mining_company_id AND mc.is_active;
  IF nullif(btrim(v_abbreviation), '') IS NULL THEN
    RAISE EXCEPTION 'Société inactive ou abréviation absente.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.expedition_lot_counters(mining_company_id, year, counter)
  VALUES (p_mining_company_id, p_year, 1)
  ON CONFLICT (mining_company_id, year)
  DO UPDATE SET counter = public.expedition_lot_counters.counter + 1,
                updated_at = clock_timestamp()
  RETURNING counter INTO v_counter;

  RETURN 'HUM-' || v_abbreviation || '-' || lpad(v_counter::text, 4, '0')
    || '/' || p_year::text;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_user_modules(user_id uuid)
RETURNS TABLE(
  id uuid,
  code text,
  nom text,
  description text,
  icone text,
  route text,
  parent_id uuid,
  parent_nom text,
  ordre integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR user_id IS NULL THEN
      RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
    END IF;
    IF user_id <> auth.uid() THEN
      IF NOT public.snp_sec_aal2()
         OR NOT public.snp_actor_has_capability('accounts.manage') THEN
        RAISE EXCEPTION 'Consultation inter-compte interdite.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT m.id, m.code, m.nom, m.description, m.icone, m.route,
         m.parent_id, parent_module.nom, m.ordre
  FROM public.snp_modules m
  LEFT JOIN public.snp_modules parent_module ON parent_module.id = m.parent_id
  WHERE m.est_actif AND m.est_visible_menu
  ORDER BY coalesce(parent_module.ordre, m.ordre), m.ordre;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id uuid,
  p_event_type text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor uuid;
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
BEGIN
  IF v_service THEN
    v_actor := p_user_id;
  ELSE
    v_actor := auth.uid();
    IF v_actor IS NULL OR (p_user_id IS NOT NULL AND p_user_id <> v_actor) THEN
      RAISE EXCEPTION 'Identité du journal de sécurité invalide.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF nullif(btrim(p_event_type), '') IS NULL OR length(p_event_type) > 100 THEN
    RAISE EXCEPTION 'Type d’événement invalide.' USING ERRCODE = '22023';
  END IF;
  IF octet_length(coalesce(p_details, '{}'::jsonb)::text) > 32768 THEN
    RAISE EXCEPTION 'Détails de sécurité trop volumineux.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.security_events(
    user_id, event_type, ip_address, user_agent, details
  ) VALUES (
    v_actor,
    left(btrim(p_event_type), 100),
    CASE WHEN v_service THEN left(p_ip_address, 128) ELSE NULL END,
    left(p_user_agent, 1024),
    p_details
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_user_id uuid,
  p_action_type text,
  p_module_name text,
  p_resource_type text,
  p_resource_id uuid,
  p_description text,
  p_changes_summary jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor uuid;
  v_activity_id uuid;
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
BEGIN
  IF v_service THEN
    v_actor := p_user_id;
  ELSE
    v_actor := auth.uid();
    IF v_actor IS NULL OR p_user_id IS NULL OR p_user_id <> v_actor THEN
      RAISE EXCEPTION 'Identité du journal d’activité invalide.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_actor IS NULL
     OR nullif(btrim(p_action_type), '') IS NULL
     OR nullif(btrim(p_module_name), '') IS NULL
     OR nullif(btrim(p_description), '') IS NULL
     OR length(p_action_type) > 100
     OR length(p_module_name) > 100
     OR length(p_description) > 4000 THEN
    RAISE EXCEPTION 'Journal d’activité invalide.' USING ERRCODE = '22023';
  END IF;
  IF octet_length(coalesce(p_changes_summary, '{}'::jsonb)::text) > 65536 THEN
    RAISE EXCEPTION 'Résumé de changements trop volumineux.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_activity_logs(
    user_id, action_type, module_name, resource_type, resource_id,
    description, changes_summary, ip_address, user_agent
  ) VALUES (
    v_actor, left(btrim(p_action_type), 100), left(btrim(p_module_name), 100),
    left(p_resource_type, 100), p_resource_id, left(p_description, 4000),
    p_changes_summary,
    CASE WHEN v_service THEN left(p_ip_address, 128) ELSE NULL END,
    left(p_user_agent, 1024)
  ) RETURNING user_activity_logs.id INTO v_activity_id;

  RETURN v_activity_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.convert_virtual_to_actual_payment(
  p_payment_id uuid,
  p_actual_date date,
  p_bank_name text,
  p_account_number text,
  p_reference_number text,
  p_transaction_id text,
  p_fx_rate numeric,
  p_proof_url text,
  p_notes text,
  p_converted_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor uuid;
  v_is_virtual boolean;
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
BEGIN
  IF v_service THEN
    v_actor := p_converted_by;
  ELSE
    v_actor := auth.uid();
    IF v_actor IS NULL OR NOT public.snp_sec_aal2()
       OR NOT public.snp_actor_has_capability('sonasp.finance.execute') THEN
      RAISE EXCEPTION 'Capacité finance sous AAL2 requise.' USING ERRCODE = '42501';
    END IF;
    IF p_converted_by IS NOT NULL AND p_converted_by <> v_actor THEN
      RAISE EXCEPTION 'L’acteur de conversion est dérivé du JWT.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF p_payment_id IS NULL OR p_actual_date IS NULL
     OR p_actual_date > current_date
     OR nullif(btrim(p_bank_name), '') IS NULL
     OR nullif(btrim(p_reference_number), '') IS NULL
     OR (p_fx_rate IS NOT NULL AND p_fx_rate <= 0) THEN
    RAISE EXCEPTION 'Paramètres de conversion invalides.' USING ERRCODE = '22023';
  END IF;

  SELECT p.is_virtual INTO v_is_virtual
  FROM public.payments p
  WHERE p.id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT coalesce(v_is_virtual, false) THEN
    RAISE EXCEPTION 'Le paiement n’est pas virtuel.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payments
  SET payment_type = 'actual', is_virtual = false,
      actual_date = p_actual_date,
      bank_name = left(btrim(p_bank_name), 255),
      account_number = left(p_account_number, 255),
      reference_number = left(btrim(p_reference_number), 255),
      transaction_id = left(p_transaction_id, 255),
      fx_rate = p_fx_rate,
      proof_url = left(p_proof_url, 2048),
      notes = concat_ws(E'\n\n', nullif(notes, ''),
        'Converted to actual payment on ' || current_date::text,
        nullif(left(p_notes, 4000), '')),
      converted_to_actual_at = clock_timestamp(),
      converted_by = v_actor,
      status = 'approved'
  WHERE id = p_payment_id;

  RETURN true;
END;
$fn$;

-- --------------------------------------------------------------------------
-- 2. Registre exact de l’allowlist et deny-by-default de toutes les fonctions.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snp_rpc_execution_allowlist (
  function_signature text NOT NULL,
  function_name name NOT NULL,
  grantee name NOT NULL CHECK (grantee IN ('authenticated')),
  purpose text NOT NULL CHECK (
    purpose IN ('runtime-browser', 'rls-policy-helper', 'p0-contract')
  ),
  migration_version text NOT NULL,
  PRIMARY KEY (function_signature, grantee)
);

ALTER TABLE public.snp_rpc_execution_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_rpc_execution_allowlist FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_rpc_execution_allowlist
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.snp_rpc_execution_allowlist TO service_role;

CREATE TEMP TABLE snp_rpc_allowlist_config (
  function_name name PRIMARY KEY,
  purpose text NOT NULL
);

INSERT INTO snp_rpc_allowlist_config(function_name, purpose) VALUES
  ('check_license_availability', 'runtime-browser'),
  ('check_sale_authorization', 'runtime-browser'),
  ('convert_virtual_to_actual_payment', 'runtime-browser'),
  ('get_authorized_customers_for_mine', 'runtime-browser'),
  ('get_daily_target', 'runtime-browser'),
  ('get_next_expedition_lot_number', 'runtime-browser'),
  ('get_production_status_history', 'runtime-browser'),
  ('get_production_summary', 'runtime-browser'),
  ('get_production_variance', 'runtime-browser'),
  ('get_unified_status_history', 'runtime-browser'),
  ('get_user_modules', 'runtime-browser'),
  ('log_security_event', 'runtime-browser'),
  ('log_user_activity', 'runtime-browser'),
  ('reserve_license_quota', 'runtime-browser'),
  ('snp_accuser_reception_requisition', 'runtime-browser'),
  ('snp_activer_configuration_courriel', 'runtime-browser'),
  ('snp_actor_capabilities', 'runtime-browser'),
  ('snp_actor_has_capability', 'runtime-browser'),
  ('snp_affecter_fifo', 'runtime-browser'),
  ('snp_affecter_reglement', 'runtime-browser'),
  ('snp_alertes_contractuelles', 'runtime-browser'),
  ('snp_analyse_synthese', 'runtime-browser'),
  ('snp_annuler_affectation', 'runtime-browser'),
  ('snp_appliquer_contrats_au_plan', 'runtime-browser'),
  ('snp_balance_agee', 'runtime-browser'),
  ('snp_certify_artisan_invoice', 'runtime-browser'),
  ('snp_changer_statut_contrat', 'runtime-browser'),
  ('snp_changer_statut_reglement', 'runtime-browser'),
  ('snp_changer_statut_requisition', 'runtime-browser'),
  ('snp_configurations_courriel', 'runtime-browser'),
  ('snp_configurer_compte_portail', 'runtime-browser'),
  ('snp_confirmer_enrolement_mfa', 'runtime-browser'),
  ('snp_conformite_mfa', 'runtime-browser'),
  ('snp_contrat_execution', 'runtime-browser'),
  ('snp_contrats_actifs_periode', 'runtime-browser'),
  ('snp_convertir_requisition_en_achat', 'runtime-browser'),
  ('snp_creer_configuration_courriel', 'runtime-browser'),
  ('snp_creer_vente_export_mine', 'runtime-browser'),
  ('snp_current_collector_id', 'runtime-browser'),
  ('snp_current_organization_id', 'runtime-browser'),
  ('snp_decider_imputation_requisition', 'runtime-browser'),
  ('snp_definir_approbateur_ventes', 'runtime-browser'),
  ('snp_definir_capacite_utilisateur', 'runtime-browser'),
  ('snp_desactiver_configuration_courriel', 'runtime-browser'),
  ('snp_enregistrer_connexion', 'runtime-browser'),
  ('snp_enregistrer_reglement', 'runtime-browser'),
  ('snp_enregistrer_resultat_analyse', 'runtime-browser'),
  ('snp_etat_mfa', 'runtime-browser'),
  ('snp_evaluer_depassement', 'runtime-browser'),
  ('snp_evaluer_teneur', 'runtime-browser'),
  ('snp_factures_eligibles', 'runtime-browser'),
  ('snp_generer_echeancier', 'runtime-browser'),
  ('snp_marquer_notifications_lues', 'runtime-browser'),
  ('snp_modifier_configuration_courriel', 'runtime-browser'),
  ('snp_notifications_resume', 'runtime-browser'),
  ('snp_notifier', 'runtime-browser'),
  ('snp_notifier_requisition', 'runtime-browser'),
  ('snp_notifier_roles', 'runtime-browser'),
  ('snp_portail_mine_repondre_requisition', 'runtime-browser'),
  ('snp_preparer_reglement', 'runtime-browser'),
  ('snp_reinitialiser_mfa', 'runtime-browser'),
  ('snp_releve_societe', 'runtime-browser'),
  ('snp_remplacer_habilitations_compte', 'runtime-browser'),
  ('snp_repartir_plan', 'runtime-browser'),
  ('snp_repondre_demande', 'runtime-browser'),
  ('snp_requisition_execution', 'runtime-browser'),
  ('snp_situation_societe', 'runtime-browser'),
  ('snp_societes_eligibles_paiement', 'runtime-browser'),
  ('snp_soumettre_plan', 'runtime-browser'),
  ('snp_stock_exportable_mine', 'runtime-browser'),
  ('snp_submit_comptoir_sale_to_sonasp', 'runtime-browser'),
  ('snp_supprimer_configuration_courriel', 'runtime-browser'),
  ('snp_tracer_acces_document', 'runtime-browser'),
  ('snp_trancher_teneur', 'runtime-browser'),
  ('snp_transition_comptoir_sale_to_sonasp', 'runtime-browser'),
  ('is_admin_user', 'rls-policy-helper'),
  ('snp_can_access_artisan', 'rls-policy-helper'),
  ('snp_est_agent_sonasp', 'rls-policy-helper'),
  ('snp_est_direction_lecture', 'rls-policy-helper'),
  ('snp_mfa_satisfaite', 'rls-policy-helper'),
  ('snp_peut_administrer_compte', 'rls-policy-helper'),
  ('snp_peut_consulter_expedition', 'rls-policy-helper'),
  ('snp_peut_consulter_licence_export', 'rls-policy-helper'),
  ('snp_peut_consulter_mouvement_stock', 'rls-policy-helper'),
  ('snp_peut_consulter_production', 'rls-policy-helper'),
  ('snp_peut_consulter_transport', 'rls-policy-helper'),
  ('snp_peut_consulter_vente', 'rls-policy-helper'),
  ('snp_peut_gerer_expedition', 'rls-policy-helper'),
  ('snp_peut_gerer_sites_artisanaux', 'rls-policy-helper'),
  ('snp_peut_modifier_licence_export', 'rls-policy-helper'),
  ('snp_peut_valider', 'rls-policy-helper'),
  ('snp_role_utilisateur', 'rls-policy-helper'),
  ('snp_societe_compte_mine', 'rls-policy-helper'),
  ('snp_societe_utilisateur', 'rls-policy-helper'),
  ('user_accessible_companies', 'rls-policy-helper'),
  ('count_shipping_certificates', 'p0-contract'),
  ('get_certificates_statistics', 'p0-contract'),
  ('get_shipping_assay_certificates', 'p0-contract'),
  ('snp_release_shipping_license_quota', 'p0-contract'),
  ('snp_sec_aal2', 'p0-contract'),
  ('snp_sec_can_access_shipping_storage', 'p0-contract'),
  ('snp_sec_can_admin_referentials', 'p0-contract'),
  ('snp_sec_can_approve_shipping', 'p0-contract'),
  ('snp_sec_can_approve_workflow', 'p0-contract'),
  ('snp_sec_can_delete_mining_document', 'p0-contract'),
  ('snp_sec_can_prepare_company', 'p0-contract'),
  ('snp_sec_can_prepare_shipping', 'p0-contract'),
  ('snp_sec_can_prepare_workflow', 'p0-contract'),
  ('snp_sec_can_read_audit', 'p0-contract'),
  ('snp_sec_can_read_company', 'p0-contract'),
  ('snp_sec_can_read_mining_document', 'p0-contract'),
  ('snp_sec_can_read_shipping', 'p0-contract'),
  ('snp_sec_can_write_mining_document', 'p0-contract'),
  ('snp_sec_is_internal_reader', 'p0-contract'),
  ('snp_transition_shipping_preparation', 'p0-contract');

DO $validate_allowlist_names$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(c.function_name::text, ', ' ORDER BY c.function_name::text)
  INTO v_missing
  FROM snp_rpc_allowlist_config c
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
      AND p.proname = c.function_name
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Allowlist RPC : fonctions SECURITY DEFINER absentes : %', v_missing;
  END IF;
END;
$validate_allowlist_names$;

DO $revoke_client_surface$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function.oid::regprocedure
    );
  END LOOP;
END;
$revoke_client_surface$;

-- Les rôles PostgreSQL d’administration (non-JWT) conservent une surface
-- d’inspection explicite afin que db lint et les opérations de maintenance ne
-- dépendent plus du grant PUBLIC supprimé.
DO $grant_database_administrators$
DECLARE
  v_function record;
  v_role name;
BEGIN
  FOR v_role IN
    SELECT rolname::name FROM pg_roles
    WHERE rolname IN ('postgres', 'supabase_admin')
  LOOP
    FOR v_function IN
      SELECT p.oid
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
    LOOP
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO %I',
        v_function.oid::regprocedure, v_role
      );
    END LOOP;
  END LOOP;
END;
$grant_database_administrators$;

-- Les nouvelles fonctions créées par chacun des propriétaires actuellement
-- présents ne naissent plus avec EXECUTE client. Couvrir seulement
-- current_user serait insuffisant lorsque le dump appartient encore à postgres.
DO $revoke_default_function_privileges$
DECLARE
  v_owner name;
  v_admin name;
BEGIN
  FOR v_owner IN
    SELECT DISTINCT pg_get_userbyid(p.proowner)::name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
    UNION SELECT current_user::name
  LOOP
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I '
      'REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated',
      v_owner
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
      'REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated',
      v_owner
    );
    FOR v_admin IN
      SELECT rolname::name FROM pg_roles
      WHERE rolname IN ('postgres', 'supabase_admin')
    LOOP
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I '
        'GRANT EXECUTE ON FUNCTIONS TO %I',
        v_owner, v_admin
      );
    END LOOP;
  END LOOP;
END;
$revoke_default_function_privileges$;

DELETE FROM public.snp_rpc_execution_allowlist;

DO $grant_allowlist$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid, p.proname, c.purpose
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN snp_rpc_allowlist_config c ON c.function_name = p.proname
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
    ORDER BY p.proname, p.oid::regprocedure::text
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path TO pg_catalog, public, auth, storage, extensions, pg_temp',
      v_function.oid::regprocedure
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO authenticated',
      v_function.oid::regprocedure
    );
    INSERT INTO public.snp_rpc_execution_allowlist(
      function_signature, function_name, grantee, purpose, migration_version
    ) VALUES (
      v_function.oid::regprocedure::text,
      v_function.proname,
      'authenticated',
      v_function.purpose,
      '20260824235930'
    );
  END LOOP;
END;
$grant_allowlist$;

REVOKE ALL PRIVILEGES ON FUNCTION public.consume_activation_token(text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_activation_token(text,timestamptz)
  TO service_role;

COMMENT ON TABLE public.snp_rpc_execution_allowlist IS
  'Inventaire exact des seules fonctions SECURITY DEFINER exposées aux clients par la migration 20260824235930.';

-- --------------------------------------------------------------------------
-- 3. Postflight bloquant.
-- --------------------------------------------------------------------------
DO $postflight$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND EXISTS (
      SELECT 1
      FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight RPC : % fonction(s) restent exécutables par PUBLIC.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight RPC : % fonction(s) restent exécutables par anon.', v_count;
  END IF;

  WITH owners AS (
    SELECT DISTINCT p.proowner
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  ), forbidden_defaults AS (
    SELECT owners.proowner, a.grantee
    FROM owners
    LEFT JOIN pg_default_acl d
      ON d.defaclrole = owners.proowner
     AND d.defaclnamespace = 0
     AND d.defaclobjtype = 'f'
    CROSS JOIN LATERAL aclexplode(
      coalesce(d.defaclacl, acldefault('f', owners.proowner))
    ) a
    WHERE a.privilege_type = 'EXECUTE'
      AND (a.grantee = 0 OR a.grantee IN (
        (SELECT oid FROM pg_roles WHERE rolname = 'anon'),
        (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
      ))
    UNION ALL
    SELECT owners.proowner, a.grantee
    FROM owners
    JOIN pg_default_acl d
      ON d.defaclrole = owners.proowner
     AND d.defaclnamespace = 'public'::regnamespace
     AND d.defaclobjtype = 'f'
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE a.privilege_type = 'EXECUTE'
      AND (a.grantee = 0 OR a.grantee IN (
        (SELECT oid FROM pg_roles WHERE rolname = 'anon'),
        (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
      ))
  )
  SELECT count(*) INTO v_count FROM forbidden_defaults;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight RPC : % privilège(s) EXECUTE client subsistent par défaut.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND NOT EXISTS (
      SELECT 1 FROM public.snp_rpc_execution_allowlist a
      WHERE a.function_signature = p.oid::regprocedure::text
        AND a.grantee = 'authenticated'
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight RPC : % grant(s) authenticated hors allowlist.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.snp_rpc_execution_allowlist a
  WHERE NOT has_function_privilege(
    a.grantee, ('public.' || a.function_signature)::regprocedure, 'EXECUTE'
  );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight RPC : % entrée(s) allowlist sans grant.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.snp_rpc_execution_allowlist a
  JOIN pg_proc p ON p.oid = ('public.' || a.function_signature)::regprocedure
  WHERE NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) setting
    WHERE setting LIKE 'search_path=pg_catalog, public, auth, storage, extensions, pg_temp%'
  );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight RPC : % RPC allowlistée(s) sans search_path canonique.', v_count;
  END IF;

  IF has_function_privilege(
    'authenticated', 'public.auto_allocate_inventory(uuid,numeric)', 'EXECUTE'
  ) OR has_function_privilege(
    'authenticated', 'public.generate_activation_token(uuid,text,text,uuid)', 'EXECUTE'
  ) OR has_function_privilege(
    'authenticated', 'public.get_certificate_with_data(uuid)', 'EXECUTE'
  ) OR has_function_privilege(
    'authenticated', 'public.snp_configuration_courriel_active()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Postflight RPC : une surface administrative interdite est réexposée.';
  END IF;

  IF has_function_privilege(
    'anon', 'public.consume_activation_token(text,timestamptz)', 'EXECUTE'
  ) OR has_function_privilege(
    'authenticated', 'public.consume_activation_token(text,timestamptz)', 'EXECUTE'
  ) OR NOT has_function_privilege(
    'service_role', 'public.consume_activation_token(text,timestamptz)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Postflight activation : ACL de consume_activation_token invalide.';
  END IF;
END;
$postflight$;

DROP TABLE snp_rpc_allowlist_config;

-- --------------------------------------------------------------------------
-- ROLLBACK NON DESTRUCTIF DOCUMENTÉ
-- --------------------------------------------------------------------------
-- Ne jamais restaurer EXECUTE à PUBLIC/anon ni les ACL historiques en masse.
-- En cas de RPC runtime oubliée :
--   1. REVOKE temporairement la mutation applicative concernée ;
--   2. auditer son corps, ajouter AAL2/capacité/tenant si nécessaire ;
--   3. l’ajouter nominativement à l’allowlist d’une migration corrective ;
--   4. rejouer les tests anon/AAL1/capabilité/tenant avant GRANT.
-- Pour geler ce lot sans perte de données, révoquer individuellement les RPC
-- métier concernées ; conserver le registre et les journaux pour investigation.
