-- ============================================================================
-- LOT 1 DB P0 — cloisonnement, ACL/RLS, Storage et quota d'export canonique
-- ============================================================================
-- Cette migration est volontairement postérieure à 20260824235700.
-- Elle est idempotente sur les objets qu'elle crée, mais son préflight bloque
-- toute ambiguïté métier au lieu de choisir silencieusement une licence.
--
-- Incompatibilités applicatives assumées et à traiter avant déploiement :
--   * shipping-documents devient privé : getPublicUrl doit être remplacé par
--     createSignedUrl côté application/Edge ;
--   * validate_activation_token n'est plus appelable par anon : l'activation
--     doit passer par un endpoint serveur rate-limité ;
--   * release_license_quota(uuid,numeric,uuid) est retirée du contrat public :
--     utiliser snp_release_shipping_license_quota(uuid,text), qui dérive la
--     licence, la quantité et l'acteur depuis l'expédition et auth.uid().
--
-- Convention de poids : 1 once troy = 31,1034768 grammes. La colonne canonique
-- est shipping_preparations.total_net_weight_grams. total_weight_oz ne sert de
-- source que si le poids canonique est nul ou égal à zéro.
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- --------------------------------------------------------------------------
-- 0. Préflight : aucune écriture ne précède ces validations.
-- --------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_count bigint;
BEGIN
  IF to_regclass('public.shipping_preparations') IS NULL
     OR to_regclass('public.export_licenses') IS NULL
     OR to_regclass('public.user_profiles') IS NULL
     OR to_regclass('public.shipping_documents') IS NULL
     OR to_regclass('public.assay_certificates') IS NULL
     OR to_regclass('public.mining_company_documents') IS NULL
     OR to_regclass('storage.objects') IS NULL
     OR to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Préflight P0 : un objet requis est absent.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.assay_certificates
  WHERE shipping_preparation_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Préflight P0 : % certificat(s) d''analyse n''ont pas d''expédition parente.',
      v_count;
  END IF;

  IF to_regprocedure('public.snp_mfa_satisfaite()') IS NULL
     OR to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
     OR to_regprocedure('public.snp_societe_utilisateur()') IS NULL THEN
    RAISE EXCEPTION
      'Préflight P0 : les gardes MFA/capability/tenant doivent être installés avant cette migration.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.shipping_preparations
  WHERE license_id IS NOT NULL
    AND export_license_id IS NOT NULL
    AND license_id <> export_license_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Préflight P0 : % expédition(s) ont license_id et export_license_id divergents. Réconcilier explicitement avant reprise.',
      v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.shipping_preparations sp
  JOIN public.export_licenses el
    ON el.id = COALESCE(sp.export_license_id, sp.license_id)
  WHERE sp.mining_company_id IS NULL
     OR sp.mining_company_id <> el.mining_company_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Préflight P0 : % expédition(s) ne partagent pas le tenant de leur licence.',
      v_count;
  END IF;

  WITH linked AS (
    SELECT COALESCE(sp.export_license_id, sp.license_id) AS license_id,
           sum(
             CASE
               WHEN COALESCE(sp.total_net_weight_grams, 0) > 0
                 THEN sp.total_net_weight_grams
               WHEN COALESCE(sp.total_weight_oz, 0) > 0
                 THEN round(sp.total_weight_oz * 31.1034768, 6)
               ELSE 0
             END
           ) AS reserved_grams
    FROM public.shipping_preparations sp
    WHERE COALESCE(sp.export_license_id, sp.license_id) IS NOT NULL
    GROUP BY COALESCE(sp.export_license_id, sp.license_id)
  )
  SELECT count(*) INTO v_count
  FROM public.export_licenses el
  JOIN linked l ON l.license_id = el.id
  WHERE l.reserved_grams > el.used_quantity_grams + 0.01;
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Préflight P0 : % licence(s) ont un usage courant inférieur aux expéditions liées ; baseline non déductible sans arbitrage.',
      v_count;
  END IF;
END;
$preflight$;

-- --------------------------------------------------------------------------
-- 1. Gardes d'autorisation réutilisables : identité, AAL2, tenant, capability.
-- --------------------------------------------------------------------------
INSERT INTO public.snp_capability_catalog (
  code, domain, label, description, sensitive
)
VALUES (
  'email.settings.manage',
  'administration',
  'Administrer la messagerie',
  'Consulter et modifier les paramètres SMTP sans exposer le secret.',
  true
)
ON CONFLICT (code) DO UPDATE
SET domain = EXCLUDED.domain,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    sensitive = EXCLUDED.sensitive;

-- Le défaut de rôle est strictement owner/admin. Les overrides individuels
-- restent des décisions explicites, datées et motivées du modèle capability.
DELETE FROM public.snp_role_capabilities
WHERE capability_code = 'email.settings.manage'
  AND role NOT IN ('owner', 'admin');
INSERT INTO public.snp_role_capabilities (role, capability_code)
VALUES
  ('owner', 'email.settings.manage'),
  ('admin', 'email.settings.manage')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_sec_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT auth.uid() IS NOT NULL AND public.snp_mfa_satisfaite();
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_is_internal_reader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_sec_aal2() AND (
    public.snp_actor_has_capability('sonasp.workflow.read')
    OR public.snp_actor_has_capability('reports.read')
    OR public.snp_actor_has_capability('support.read')
    OR public.snp_actor_has_capability('referentials.manage')
    OR public.snp_actor_has_capability('sonasp.prepare')
    OR public.snp_actor_has_capability('sonasp.approve')
    OR public.snp_actor_has_capability('sonasp.finance.execute')
    OR public.snp_actor_has_capability('sonasp.finance.reconcile')
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_read_company(p_mining_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT p_mining_company_id IS NOT NULL
    AND public.snp_sec_aal2()
    AND (
      public.snp_sec_is_internal_reader()
      OR (
        public.snp_actor_has_capability('mine.operate')
        AND p_mining_company_id = public.snp_societe_utilisateur()
      )
    );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_prepare_workflow()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_sec_aal2()
    AND public.snp_actor_has_capability('sonasp.prepare');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_prepare_company(
  p_mining_company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT p_mining_company_id IS NOT NULL
    AND public.snp_sec_aal2()
    AND (
      public.snp_actor_has_capability('sonasp.prepare')
      OR (
        public.snp_actor_has_capability('mine.operate')
        AND p_mining_company_id = public.snp_societe_utilisateur()
      )
    );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_approve_workflow()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_sec_aal2()
    AND public.snp_actor_has_capability('sonasp.approve');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_admin_referentials()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_sec_aal2()
    AND public.snp_actor_has_capability('referentials.manage');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_read_audit()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_sec_aal2() AND (
    public.snp_actor_has_capability('reports.read')
    OR public.snp_actor_has_capability('support.read')
    OR public.snp_actor_has_capability('accounts.manage')
  );
$fn$;

REVOKE ALL ON FUNCTION public.snp_sec_aal2() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_is_internal_reader() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_read_company(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_prepare_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_prepare_company(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_approve_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_admin_referentials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_read_audit() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.snp_sec_aal2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_is_internal_reader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_read_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_prepare_workflow() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_prepare_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_approve_workflow() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_admin_referentials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_read_audit() TO authenticated;

COMMENT ON FUNCTION public.snp_sec_can_read_company(uuid) IS
  'Garde tenant fail-closed : AAL2 et lecteur SONASP, ou capability mine.operate sur sa société.';
COMMENT ON FUNCTION public.snp_sec_can_prepare_company(uuid) IS
  'Écriture métier Shipping sous AAL2 : sonasp.prepare global ou mine.operate strictement sur sa société.';

-- --------------------------------------------------------------------------
-- 2. RLS canonique et grants minimaux des tables P0.
-- --------------------------------------------------------------------------
DO $drop_policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'shipping_preparations', 'mining_companies', 'snp_achats_mines',
        'user_sessions', 'audit_logs', 'audit_trail', 'user_activation_tokens'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename
    );
  END LOOP;
END;
$drop_policies$;

ALTER TABLE public.shipping_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_preparations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mining_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_companies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.snp_achats_mines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_achats_mines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activation_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY snp_shipping_read_scope
ON public.shipping_preparations
FOR SELECT TO authenticated
USING (public.snp_sec_can_read_company(mining_company_id));

CREATE POLICY snp_shipping_insert_internal
ON public.shipping_preparations
FOR INSERT TO authenticated
WITH CHECK (
  public.snp_sec_can_prepare_company(mining_company_id)
  AND created_by = auth.uid()
  AND mining_company_id IS NOT NULL
  AND (
    daily_production_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.daily_production dp
      WHERE dp.id = daily_production_id
        AND dp.mining_company_id = shipping_preparations.mining_company_id
    )
  )
  AND (
    export_license_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.export_licenses el
      WHERE el.id = export_license_id
        AND el.mining_company_id = shipping_preparations.mining_company_id
    )
  )
);

-- La policy autorise l'édition métier de la ligne dans le tenant. Le verrou
-- colonne ci-dessous exclut status, shipped_at, mining_company_id, created_by
-- et les métadonnées système : une policy seule ne peut pas distinguer OLD et
-- NEW pour empêcher un changement de statut.
CREATE POLICY snp_shipping_update_business_fields
ON public.shipping_preparations
FOR UPDATE TO authenticated
USING (public.snp_sec_can_prepare_company(mining_company_id))
WITH CHECK (
  public.snp_sec_can_prepare_company(mining_company_id)
  AND (
    daily_production_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.daily_production dp
      WHERE dp.id = daily_production_id
        AND dp.mining_company_id = shipping_preparations.mining_company_id
    )
  )
  AND (
    export_license_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.export_licenses el
      WHERE el.id = export_license_id
        AND el.mining_company_id = shipping_preparations.mining_company_id
    )
  )
);

CREATE POLICY snp_shipping_delete_approver
ON public.shipping_preparations
FOR DELETE TO authenticated
USING (public.snp_sec_can_approve_workflow());

CREATE POLICY snp_mining_companies_read_scope
ON public.mining_companies
FOR SELECT TO authenticated
USING (public.snp_sec_can_read_company(id));

CREATE POLICY snp_mining_companies_insert_admin
ON public.mining_companies
FOR INSERT TO authenticated
WITH CHECK (public.snp_sec_can_admin_referentials());

CREATE POLICY snp_mining_companies_update_admin
ON public.mining_companies
FOR UPDATE TO authenticated
USING (public.snp_sec_can_admin_referentials())
WITH CHECK (public.snp_sec_can_admin_referentials());

CREATE POLICY snp_mining_companies_delete_admin
ON public.mining_companies
FOR DELETE TO authenticated
USING (public.snp_sec_can_admin_referentials());

CREATE POLICY snp_achats_mines_read_scope
ON public.snp_achats_mines
FOR SELECT TO authenticated
USING (public.snp_sec_can_read_company(mining_company_id));

CREATE POLICY snp_achats_mines_insert_preparer
ON public.snp_achats_mines
FOR INSERT TO authenticated
WITH CHECK (
  public.snp_sec_can_prepare_workflow()
  AND created_by = auth.uid()
  AND mining_company_id IS NOT NULL
  AND quantite_oz > 0
);

CREATE POLICY snp_achats_mines_update_workflow
ON public.snp_achats_mines
FOR UPDATE TO authenticated
USING (
  public.snp_sec_can_prepare_workflow()
  OR public.snp_sec_can_approve_workflow()
)
WITH CHECK (
  (public.snp_sec_can_prepare_workflow() OR public.snp_sec_can_approve_workflow())
  AND mining_company_id IS NOT NULL
  AND quantite_oz > 0
);

CREATE POLICY snp_achats_mines_delete_approver
ON public.snp_achats_mines
FOR DELETE TO authenticated
USING (public.snp_sec_can_approve_workflow());

CREATE POLICY snp_user_sessions_read_own_aal2
ON public.user_sessions
FOR SELECT TO authenticated
USING (public.snp_sec_aal2() AND user_id = auth.uid());

CREATE POLICY snp_user_sessions_insert_own_aal2
ON public.user_sessions
FOR INSERT TO authenticated
WITH CHECK (public.snp_sec_aal2() AND user_id = auth.uid());

CREATE POLICY snp_user_sessions_delete_own_aal2
ON public.user_sessions
FOR DELETE TO authenticated
USING (public.snp_sec_aal2() AND user_id = auth.uid());

CREATE POLICY snp_audit_logs_read_auditor
ON public.audit_logs
FOR SELECT TO authenticated
USING (public.snp_sec_can_read_audit());

CREATE POLICY snp_audit_trail_read_auditor
ON public.audit_trail
FOR SELECT TO authenticated
USING (public.snp_sec_can_read_audit());

-- user_activation_tokens est fail-closed : service_role contourne la RLS et
-- aucune policy navigateur n'est créée. Les secrets ne sont jamais lisibles
-- par anon/authenticated.

REVOKE ALL PRIVILEGES ON TABLE public.shipping_preparations FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.mining_companies FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.snp_achats_mines FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_sessions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.audit_trail FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_activation_tokens FROM anon, authenticated;

-- Les transitions restent interdites en UPDATE direct. Seules les colonnes
-- métier nécessaires à updatePreparation sont modifiables ; le tenant, le
-- créateur, status, shipped_at et les métadonnées système sont absents du grant.
GRANT SELECT, INSERT, DELETE ON TABLE public.shipping_preparations TO authenticated;
GRANT UPDATE (
  daily_production_id,
  expedition_lot_number,
  seal_number,
  packing_list_url,
  shipped_to_company,
  shipped_to_address,
  shipped_to_country,
  prepared_at,
  notes,
  packing_list_document_id,
  total_net_weight_grams,
  total_gross_weight_grams,
  total_boxes,
  license_id,
  total_weight_oz,
  refinery_id,
  freight_company_id,
  export_license_id
) ON TABLE public.shipping_preparations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mining_companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.snp_achats_mines TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_sessions TO authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT ON TABLE public.audit_trail TO authenticated;

-- --------------------------------------------------------------------------
-- 3. Surface RPC : deny-by-default pour les SECURITY DEFINER dangereuses.
-- --------------------------------------------------------------------------
DO $revoke_dangerous$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_artisan_sale_to_sonasp',
        'release_license_quota',
        'reserve_license_quota',
        'log_security_event',
        'log_user_activity',
        'generate_activation_token',
        'validate_activation_token',
        'auto_allocate_inventory',
        'trigger_reserve_shipping_quota',
        'trigger_release_shipping_quota',
        'update_license_used_quantity'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function.oid::regprocedure
    );
  END LOOP;
END;
$revoke_dangerous$;

-- --------------------------------------------------------------------------
-- 3.b Transition Shipping canonique : verrou optimiste et audit déclenché.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_shipping_audit_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_capability text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_capability := CASE
    WHEN NEW.status = 'approved_by_customs'::public.shipping_preparation_status
      THEN 'sonasp.approve'
    WHEN NEW.status = 'ready_for_expedition'::public.shipping_preparation_status
      THEN 'sonasp.prepare'
    ELSE NULL
  END;

  INSERT INTO public.snp_workflow_audit (
    aggregate_type, aggregate_id, action, status_before, status_after,
    actor_id, actor_role, capability_code, reason, context, occurred_at
  ) VALUES (
    'shipping_preparation', NEW.id, 'status.transition',
    OLD.status::text, NEW.status::text, auth.uid(),
    public.snp_role_utilisateur(), v_capability,
    'Transition canonique du workflow expédition',
    jsonb_build_object(
      'source', 'snp_transition_shipping_preparation',
      'aal', public.snp_aal(),
      'mining_company_id', NEW.mining_company_id,
      'updated_at', NEW.updated_at
    ),
    now()
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS shipping_status_change_trigger
  ON public.shipping_preparations;
DROP TRIGGER IF EXISTS snp_shipping_status_audit
  ON public.shipping_preparations;
CREATE TRIGGER snp_shipping_status_audit
AFTER UPDATE OF status ON public.shipping_preparations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.snp_shipping_audit_status_change();

CREATE OR REPLACE FUNCTION public.snp_transition_shipping_preparation(
  p_shipping_id uuid,
  p_expected_status public.shipping_preparation_status,
  p_new_status public.shipping_preparation_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_shipping public.shipping_preparations%ROWTYPE;
  v_required_capability text;
  v_transitioned_at timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR NOT public.snp_sec_aal2() THEN
    RAISE EXCEPTION 'Une session authentifiée AAL2 est requise.'
      USING ERRCODE = '42501';
  END IF;

  IF p_expected_status IS NULL OR p_new_status IS NULL
     OR p_expected_status = p_new_status THEN
    RAISE EXCEPTION 'Les statuts attendu et cible doivent définir une transition.'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_shipping
  FROM public.shipping_preparations
  WHERE id = p_shipping_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expédition introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.snp_sec_can_read_company(v_shipping.mining_company_id) THEN
    RAISE EXCEPTION 'Expédition hors du périmètre autorisé.'
      USING ERRCODE = '42501';
  END IF;

  IF v_shipping.status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION
      'Conflit optimiste : statut courant %, statut attendu %.',
      v_shipping.status, p_expected_status
      USING ERRCODE = '40001',
            DETAIL = jsonb_build_object(
              'shipping_id', p_shipping_id,
              'current_status', v_shipping.status,
              'expected_status', p_expected_status
            )::text;
  END IF;

  v_required_capability := CASE
    WHEN p_expected_status = 'waiting_for_customs_approval'::public.shipping_preparation_status
     AND p_new_status = 'approved_by_customs'::public.shipping_preparation_status
      THEN 'sonasp.approve'
    WHEN p_expected_status = 'approved_by_customs'::public.shipping_preparation_status
     AND p_new_status = 'ready_for_expedition'::public.shipping_preparation_status
      THEN 'sonasp.prepare'
    ELSE NULL
  END;

  IF v_required_capability IS NULL THEN
    RAISE EXCEPTION 'Transition Shipping interdite : % -> %.',
      p_expected_status, p_new_status
      USING ERRCODE = '23514';
  END IF;
  PERFORM public.snp_require_capability(v_required_capability);

  UPDATE public.shipping_preparations
  SET status = p_new_status,
      updated_at = v_transitioned_at,
      shipped_at = CASE
        WHEN p_new_status = 'ready_for_expedition'::public.shipping_preparation_status
          THEN coalesce(shipped_at, v_transitioned_at)
        ELSE shipped_at
      END
  WHERE id = p_shipping_id;

  RETURN jsonb_build_object(
    'shipping_id', p_shipping_id,
    'previous_status', p_expected_status,
    'status', p_new_status,
    'updated_at', v_transitioned_at,
    'shipped_at', CASE
      WHEN p_new_status = 'ready_for_expedition'::public.shipping_preparation_status
        THEN coalesce(v_shipping.shipped_at, v_transitioned_at)
      ELSE v_shipping.shipped_at
    END
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_shipping_audit_status_change()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_transition_shipping_preparation(
  uuid, public.shipping_preparation_status, public.shipping_preparation_status
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snp_transition_shipping_preparation(
  uuid, public.shipping_preparation_status, public.shipping_preparation_status
) TO authenticated;

COMMENT ON FUNCTION public.snp_transition_shipping_preparation(
  uuid, public.shipping_preparation_status, public.shipping_preparation_status
) IS
  'Transition Shipping AAL2 avec capability, verrou FOR UPDATE, statut attendu et retour JSON stable.';

-- --------------------------------------------------------------------------
-- 3.c Administration SMTP : capability dédiée, aucun accès table navigateur.
-- --------------------------------------------------------------------------
DO $drop_smtp_policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'snp_configuration_courriel'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.snp_configuration_courriel',
      v_policy.policyname
    );
  END LOOP;
END;
$drop_smtp_policies$;

ALTER TABLE public.snp_configuration_courriel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_configuration_courriel FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_configuration_courriel
  FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.snp_audit_email_settings_change(
  p_configuration_id uuid,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  INSERT INTO public.snp_workflow_audit (
    aggregate_type, aggregate_id, action, actor_id, actor_role,
    capability_code, reason, context, occurred_at
  ) VALUES (
    'email_configuration', p_configuration_id, p_action, auth.uid(),
    public.snp_role_utilisateur(), 'email.settings.manage',
    'Administration des paramètres SMTP',
    jsonb_build_object('configuration_id', p_configuration_id), now()
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_configurations_courriel()
RETURNS TABLE(
  uid uuid, libelle text, hote text, port integer, securise boolean,
  identifiant text, expediteur_courriel text, expediteur_nom text, actif boolean,
  mot_de_passe_defini boolean, mot_de_passe_modifie_le timestamptz,
  derniere_verification timestamptz, derniere_erreur text, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  PERFORM public.snp_require_capability('email.settings.manage');
  RETURN QUERY
  SELECT c.uid, c.libelle, c.hote, c.port, c.securise, c.identifiant,
         c.expediteur_courriel, c.expediteur_nom, c.actif,
         c.mot_de_passe IS NOT NULL AND length(c.mot_de_passe) > 0,
         c.mot_de_passe_modifie_le, c.derniere_verification,
         c.derniere_erreur, c.created_at
  FROM public.snp_configuration_courriel c
  ORDER BY c.actif DESC, c.libelle;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_creer_configuration_courriel(
  p_libelle text,
  p_hote text,
  p_port integer,
  p_securise boolean,
  p_identifiant text,
  p_expediteur_courriel text,
  p_expediteur_nom text,
  p_mot_de_passe text,
  p_activer boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_uid uuid;
BEGIN
  PERFORM public.snp_require_capability('email.settings.manage');
  IF p_libelle IS NULL OR length(trim(p_libelle)) < 2 THEN
    RAISE EXCEPTION 'Donnez un nom à ce jeu de paramètres.' USING ERRCODE = '23514';
  END IF;
  IF p_hote IS NULL OR length(trim(p_hote)) = 0 THEN
    RAISE EXCEPTION 'Indiquez le serveur SMTP.' USING ERRCODE = '23514';
  END IF;
  IF p_identifiant IS NULL OR length(trim(p_identifiant)) = 0 THEN
    RAISE EXCEPTION 'Indiquez l''identifiant SMTP.' USING ERRCODE = '23514';
  END IF;
  IF p_port IS NULL OR p_port <= 0 OR p_port > 65535 THEN
    RAISE EXCEPTION 'Le port SMTP doit être compris entre 1 et 65535.' USING ERRCODE = '23514';
  END IF;
  IF p_mot_de_passe IS NULL OR length(p_mot_de_passe) = 0 THEN
    RAISE EXCEPTION 'Le mot de passe SMTP est requis.' USING ERRCODE = '23514';
  END IF;

  IF coalesce(p_activer, false) THEN
    UPDATE public.snp_configuration_courriel
    SET actif = false, updated_by = auth.uid()
    WHERE actif;
  END IF;

  INSERT INTO public.snp_configuration_courriel (
    libelle, hote, port, securise, identifiant,
    expediteur_courriel, expediteur_nom, mot_de_passe,
    mot_de_passe_modifie_le, actif, created_by, updated_by
  ) VALUES (
    trim(p_libelle), trim(p_hote), p_port, coalesce(p_securise, true),
    trim(p_identifiant),
    coalesce(nullif(trim(p_expediteur_courriel), ''), trim(p_identifiant)),
    coalesce(nullif(trim(p_expediteur_nom), ''), 'Administration SONASP'),
    p_mot_de_passe, now(), coalesce(p_activer, false), auth.uid(), auth.uid()
  )
  RETURNING snp_configuration_courriel.uid INTO v_uid;

  PERFORM public.snp_audit_email_settings_change(v_uid, 'email.settings.create');
  RETURN v_uid;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_modifier_configuration_courriel(
  p_uid uuid,
  p_libelle text,
  p_hote text,
  p_port integer,
  p_securise boolean,
  p_identifiant text,
  p_expediteur_courriel text,
  p_expediteur_nom text,
  p_mot_de_passe text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_secret_change boolean := p_mot_de_passe IS NOT NULL
                             AND length(p_mot_de_passe) > 0;
BEGIN
  PERFORM public.snp_require_capability('email.settings.manage');
  IF p_libelle IS NULL OR length(trim(p_libelle)) < 2
     OR p_hote IS NULL OR length(trim(p_hote)) = 0
     OR p_identifiant IS NULL OR length(trim(p_identifiant)) = 0
     OR p_port IS NULL OR p_port <= 0 OR p_port > 65535 THEN
    RAISE EXCEPTION 'Paramètres SMTP invalides.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.snp_configuration_courriel
  SET libelle = trim(p_libelle),
      hote = trim(p_hote),
      port = p_port,
      securise = coalesce(p_securise, true),
      identifiant = trim(p_identifiant),
      expediteur_courriel = coalesce(
        nullif(trim(p_expediteur_courriel), ''), trim(p_identifiant)
      ),
      expediteur_nom = coalesce(
        nullif(trim(p_expediteur_nom), ''), 'Administration SONASP'
      ),
      mot_de_passe = CASE
        WHEN v_secret_change THEN p_mot_de_passe ELSE mot_de_passe
      END,
      mot_de_passe_modifie_le = CASE
        WHEN v_secret_change THEN now() ELSE mot_de_passe_modifie_le
      END,
      derniere_verification = CASE
        WHEN hote IS DISTINCT FROM trim(p_hote)
          OR port IS DISTINCT FROM p_port
          OR identifiant IS DISTINCT FROM trim(p_identifiant)
          OR v_secret_change
        THEN NULL ELSE derniere_verification
      END,
      derniere_erreur = NULL,
      updated_by = auth.uid()
  WHERE uid = p_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jeu de paramètres SMTP introuvable.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.snp_audit_email_settings_change(p_uid, 'email.settings.update');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_activer_configuration_courriel(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_secret boolean;
BEGIN
  PERFORM public.snp_require_capability('email.settings.manage');
  SELECT mot_de_passe IS NOT NULL AND length(mot_de_passe) > 0
  INTO v_secret
  FROM public.snp_configuration_courriel
  WHERE uid = p_uid
  FOR UPDATE;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Jeu de paramètres SMTP introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_secret THEN
    RAISE EXCEPTION 'Le jeu SMTP ne contient pas de secret.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.snp_configuration_courriel
  SET actif = false, updated_by = auth.uid()
  WHERE actif AND uid <> p_uid;
  UPDATE public.snp_configuration_courriel
  SET actif = true, updated_by = auth.uid()
  WHERE uid = p_uid;
  PERFORM public.snp_audit_email_settings_change(p_uid, 'email.settings.activate');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_desactiver_configuration_courriel(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  PERFORM public.snp_require_capability('email.settings.manage');
  UPDATE public.snp_configuration_courriel
  SET actif = false, updated_by = auth.uid()
  WHERE uid = p_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jeu de paramètres SMTP introuvable.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.snp_audit_email_settings_change(p_uid, 'email.settings.deactivate');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_supprimer_configuration_courriel(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actif boolean;
BEGIN
  PERFORM public.snp_require_capability('email.settings.manage');
  SELECT actif INTO v_actif
  FROM public.snp_configuration_courriel
  WHERE uid = p_uid
  FOR UPDATE;
  IF v_actif IS NULL THEN
    RAISE EXCEPTION 'Jeu de paramètres SMTP introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_actif THEN
    RAISE EXCEPTION 'Désactivez le jeu SMTP avant suppression.' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.snp_configuration_courriel WHERE uid = p_uid;
  PERFORM public.snp_audit_email_settings_change(p_uid, 'email.settings.delete');
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_audit_email_settings_change(uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_configurations_courriel()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_creer_configuration_courriel(
  text,text,integer,boolean,text,text,text,text,boolean
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_modifier_configuration_courriel(
  uuid,text,text,integer,boolean,text,text,text,text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_activer_configuration_courriel(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_desactiver_configuration_courriel(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_supprimer_configuration_courriel(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Les signatures SMTP existent déjà dans certains environnements : leur owner
-- historique doit pouvoir appeler le nouvel audit interne sans rendre cette
-- fonction directement exécutable par un rôle navigateur.
DO $grant_smtp_audit_dependency$
DECLARE
  v_wrapper regprocedure;
  v_wrapper_owner name;
BEGIN
  FOREACH v_wrapper IN ARRAY ARRAY[
    'public.snp_creer_configuration_courriel(text,text,integer,boolean,text,text,text,text,boolean)'::regprocedure,
    'public.snp_modifier_configuration_courriel(uuid,text,text,integer,boolean,text,text,text,text)'::regprocedure,
    'public.snp_activer_configuration_courriel(uuid)'::regprocedure,
    'public.snp_desactiver_configuration_courriel(uuid)'::regprocedure,
    'public.snp_supprimer_configuration_courriel(uuid)'::regprocedure
  ]
  LOOP
    SELECT pg_get_userbyid(p.proowner)
    INTO v_wrapper_owner
    FROM pg_proc p
    WHERE p.oid = v_wrapper::oid;

    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.snp_audit_email_settings_change(uuid,text) TO %I',
      v_wrapper_owner
    );
  END LOOP;
END;
$grant_smtp_audit_dependency$;

GRANT EXECUTE ON FUNCTION public.snp_configurations_courriel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_creer_configuration_courriel(
  text,text,integer,boolean,text,text,text,text,boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_modifier_configuration_courriel(
  uuid,text,text,integer,boolean,text,text,text,text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_activer_configuration_courriel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_desactiver_configuration_courriel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_supprimer_configuration_courriel(uuid) TO authenticated;

-- Les deux RPC contenant/traçant le secret restent strictement Edge/service.
REVOKE ALL ON FUNCTION public.snp_configuration_courriel_active()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_consigner_verification_courriel(uuid,boolean,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snp_configuration_courriel_active() TO service_role;
GRANT EXECUTE ON FUNCTION public.snp_consigner_verification_courriel(uuid,boolean,text)
  TO service_role;

COMMENT ON FUNCTION public.snp_configurations_courriel() IS
  'Liste SMTP sans secret, réservée à email.settings.manage sous AAL2.';

-- --------------------------------------------------------------------------
-- 4. Storage privé, lié au tenant et à l'objet parent.
-- --------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'shipping-documents', 'shipping-documents', false, 26214400,
    ARRAY[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
  ),
  (
    'ASSAY-CERTIFICATES', 'ASSAY-CERTIFICATES', false, 26214400,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'mining-company-documents', 'mining-company-documents', false, 26214400,
    ARRAY[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
  )
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Une ancienne variante minuscule peut exister après replay historique. Elle
-- est rendue privée et fail-closed, sans suppression ni déplacement d'objet.
UPDATE storage.buckets
SET public = false
WHERE id = 'assay-certificates';

CREATE OR REPLACE FUNCTION public.snp_sec_storage_shipping_id(
  p_bucket_id text,
  p_object_name text
)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_candidate text;
BEGIN
  IF p_bucket_id = 'shipping-documents' THEN
    -- Compatibilité avec le chemin historique accidentel
    -- shipping-documents/<shipping_uuid>/<fichier> dans le bucket homonyme.
    v_candidate := CASE
      WHEN split_part(p_object_name, '/', 1) = 'shipping-documents'
        THEN split_part(p_object_name, '/', 2)
      ELSE split_part(p_object_name, '/', 1)
    END;
  ELSIF p_bucket_id = 'ASSAY-CERTIFICATES' THEN
    v_candidate := split_part(p_object_name, '/', 1);
  ELSE
    RETURN NULL;
  END IF;

  IF v_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN v_candidate::uuid;
  END IF;
  RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_access_shipping_storage(
  p_bucket_id text,
  p_object_name text,
  p_write boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.shipping_preparations sp
    WHERE sp.id = public.snp_sec_storage_shipping_id(p_bucket_id, p_object_name)
      AND CASE
        WHEN p_write THEN public.snp_sec_can_prepare_company(sp.mining_company_id)
        ELSE public.snp_sec_can_read_company(sp.mining_company_id)
      END
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_read_mining_document(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage', 'pg_temp'
AS $fn$
  SELECT public.snp_sec_aal2() AND EXISTS (
    SELECT 1
    FROM public.mining_company_documents d
    WHERE d.file_path = p_object_name
      AND public.snp_sec_can_read_company(d.mining_company_id)
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_write_mining_document(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage', 'pg_temp'
AS $fn$
  SELECT public.snp_sec_aal2() AND (
    public.snp_sec_can_prepare_workflow()
    OR (
      public.snp_actor_has_capability('mine.operate')
      AND public.snp_societe_utilisateur() IS NOT NULL
      AND (
        p_object_name LIKE public.snp_societe_utilisateur()::text || '/%'
        OR p_object_name LIKE 'incoming/' || auth.uid()::text || '/%'
      )
    )
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_delete_mining_document(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage', 'pg_temp'
AS $fn$
  SELECT public.snp_sec_aal2() AND (
    public.snp_sec_can_approve_workflow()
    OR p_object_name LIKE 'incoming/' || auth.uid()::text || '/%'
    OR EXISTS (
      SELECT 1
      FROM public.mining_company_documents d
      WHERE d.file_path = p_object_name
        AND d.uploaded_by = auth.uid()
        AND d.mining_company_id = public.snp_societe_utilisateur()
        AND public.snp_actor_has_capability('mine.operate')
    )
  );
$fn$;

REVOKE ALL ON FUNCTION public.snp_sec_storage_shipping_id(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_access_shipping_storage(text,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_read_mining_document(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_write_mining_document(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_delete_mining_document(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_access_shipping_storage(text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_read_mining_document(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_write_mining_document(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_delete_mining_document(text) TO authenticated;

DO $drop_storage_policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        coalesce(qual, '') ILIKE ANY (ARRAY[
          '%shipping-documents%', '%ASSAY-CERTIFICATES%',
          '%assay-certificates%', '%mining-company-documents%'
        ])
        OR coalesce(with_check, '') ILIKE ANY (ARRAY[
          '%shipping-documents%', '%ASSAY-CERTIFICATES%',
          '%assay-certificates%', '%mining-company-documents%'
        ])
        OR policyname ILIKE ANY (ARRAY[
          '%shipping%', '%assay%', '%mining_company_docs%',
          '%portail_mine_documents%'
        ])
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
  END LOOP;
END;
$drop_storage_policies$;

CREATE POLICY snp_shipping_storage_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'shipping-documents'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, false)
);

CREATE POLICY snp_shipping_storage_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shipping-documents'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, true)
);

CREATE POLICY snp_shipping_storage_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'shipping-documents'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, true)
)
WITH CHECK (
  bucket_id = 'shipping-documents'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, true)
);

CREATE POLICY snp_shipping_storage_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'shipping-documents'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, true)
);

CREATE POLICY snp_assay_storage_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, false)
);

CREATE POLICY snp_assay_storage_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, true)
);

CREATE POLICY snp_assay_storage_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, true)
)
WITH CHECK (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, true)
);

CREATE POLICY snp_assay_storage_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND public.snp_sec_can_access_shipping_storage(bucket_id, name, true)
);

CREATE POLICY snp_mining_documents_storage_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mining-company-documents'
  AND public.snp_sec_can_read_mining_document(name)
);

CREATE POLICY snp_mining_documents_storage_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mining-company-documents'
  AND public.snp_sec_can_write_mining_document(name)
);

CREATE POLICY snp_mining_documents_storage_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'mining-company-documents'
  AND public.snp_sec_can_write_mining_document(name)
)
WITH CHECK (
  bucket_id = 'mining-company-documents'
  AND public.snp_sec_can_write_mining_document(name)
);

CREATE POLICY snp_mining_documents_storage_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'mining-company-documents'
  AND public.snp_sec_can_delete_mining_document(name)
);

-- --------------------------------------------------------------------------
-- 4.b Métadonnées documentaires : même parent, même tenant, mêmes garanties.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_sec_can_read_shipping(
  p_shipping_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT p_shipping_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.shipping_preparations sp
    WHERE sp.id = p_shipping_id
      AND public.snp_sec_can_read_company(sp.mining_company_id)
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_prepare_shipping(
  p_shipping_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT p_shipping_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.shipping_preparations sp
    WHERE sp.id = p_shipping_id
      AND public.snp_sec_can_prepare_company(sp.mining_company_id)
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sec_can_approve_shipping(
  p_shipping_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT p_shipping_id IS NOT NULL
    AND public.snp_sec_can_approve_workflow()
    AND EXISTS (
      SELECT 1 FROM public.shipping_preparations sp
      WHERE sp.id = p_shipping_id
    );
$fn$;

REVOKE ALL ON FUNCTION public.snp_sec_can_read_shipping(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_prepare_shipping(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sec_can_approve_shipping(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_read_shipping(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_prepare_shipping(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_sec_can_approve_shipping(uuid) TO authenticated;

ALTER TABLE public.assay_certificates
  ALTER COLUMN shipping_preparation_id SET NOT NULL;

DO $drop_document_metadata_policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'shipping_documents', 'assay_certificates',
        'mining_company_documents'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename
    );
  END LOOP;
END;
$drop_document_metadata_policies$;

ALTER TABLE public.shipping_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assay_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assay_certificates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mining_company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_company_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY snp_shipping_documents_read_scope
ON public.shipping_documents FOR SELECT TO authenticated
USING (public.snp_sec_can_read_shipping(shipping_preparation_id));

CREATE POLICY snp_shipping_documents_insert_scope
ON public.shipping_documents FOR INSERT TO authenticated
WITH CHECK (
  public.snp_sec_can_prepare_shipping(shipping_preparation_id)
  AND uploaded_by = auth.uid()
);

CREATE POLICY snp_shipping_documents_update_scope
ON public.shipping_documents FOR UPDATE TO authenticated
USING (public.snp_sec_can_prepare_shipping(shipping_preparation_id))
WITH CHECK (
  public.snp_sec_can_prepare_shipping(shipping_preparation_id)
  AND uploaded_by IS NOT NULL
);

CREATE POLICY snp_shipping_documents_delete_scope
ON public.shipping_documents FOR DELETE TO authenticated
USING (public.snp_sec_can_prepare_shipping(shipping_preparation_id));

CREATE POLICY snp_assay_certificates_read_scope
ON public.assay_certificates FOR SELECT TO authenticated
USING (public.snp_sec_can_read_shipping(shipping_preparation_id));

CREATE POLICY snp_assay_certificates_insert_scope
ON public.assay_certificates FOR INSERT TO authenticated
WITH CHECK (
  public.snp_sec_can_prepare_shipping(shipping_preparation_id)
  AND uploaded_by = auth.uid()
  AND parsing_status = 'pending'
  AND approval_status = 'pending'
  AND approved_by IS NULL
  AND approved_at IS NULL
);

CREATE POLICY snp_assay_certificates_update_scope
ON public.assay_certificates FOR UPDATE TO authenticated
USING (
  public.snp_sec_can_prepare_shipping(shipping_preparation_id)
  OR public.snp_sec_can_approve_shipping(shipping_preparation_id)
)
WITH CHECK (
  public.snp_sec_can_prepare_shipping(shipping_preparation_id)
  OR public.snp_sec_can_approve_shipping(shipping_preparation_id)
);

CREATE POLICY snp_assay_certificates_delete_scope
ON public.assay_certificates FOR DELETE TO authenticated
USING (public.snp_sec_can_prepare_shipping(shipping_preparation_id));

CREATE POLICY snp_mining_company_documents_read_scope
ON public.mining_company_documents FOR SELECT TO authenticated
USING (public.snp_sec_can_read_company(mining_company_id));

CREATE POLICY snp_mining_company_documents_insert_scope
ON public.mining_company_documents FOR INSERT TO authenticated
WITH CHECK (
  public.snp_sec_can_prepare_company(mining_company_id)
  AND uploaded_by = auth.uid()
);

CREATE POLICY snp_mining_company_documents_update_scope
ON public.mining_company_documents FOR UPDATE TO authenticated
USING (public.snp_sec_can_prepare_company(mining_company_id))
WITH CHECK (
  public.snp_sec_can_prepare_company(mining_company_id)
  AND uploaded_by IS NOT NULL
);

CREATE POLICY snp_mining_company_documents_delete_scope
ON public.mining_company_documents FOR DELETE TO authenticated
USING (public.snp_sec_can_prepare_company(mining_company_id));

CREATE OR REPLACE FUNCTION public.snp_shipping_document_audit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.uploaded_by := auth.uid();
    END IF;
    IF NEW.document_url NOT LIKE NEW.shipping_preparation_id::text || '/%'
       AND NEW.document_url NOT LIKE
         'shipping-documents/' || NEW.shipping_preparation_id::text || '/%' THEN
      RAISE EXCEPTION 'Le chemin documentaire ne correspond pas à l''expédition parente.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.shipping_preparation_id IS DISTINCT FROM OLD.shipping_preparation_id THEN
      RAISE EXCEPTION 'Le parent du document est immuable.'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.uploaded_by IS NULL AND auth.uid() IS NOT NULL THEN
      -- Reprise progressive des lignes legacy dont l'auteur n'était pas tracé.
      NEW.uploaded_by := auth.uid();
    ELSIF NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
      RAISE EXCEPTION 'L''auteur du document est immuable.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.document_url IS DISTINCT FROM OLD.document_url
       AND NEW.document_url NOT LIKE NEW.shipping_preparation_id::text || '/%'
       AND NEW.document_url NOT LIKE
         'shipping-documents/' || NEW.shipping_preparation_id::text || '/%' THEN
      RAISE EXCEPTION 'Le chemin documentaire ne correspond pas à l''expédition parente.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_mining_company_document_audit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.uploaded_by := auth.uid();
    END IF;
  ELSE
    IF NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id THEN
      RAISE EXCEPTION 'La société du document est immuable.'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.uploaded_by IS NULL AND auth.uid() IS NOT NULL THEN
      NEW.uploaded_by := auth.uid();
    ELSIF NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
      RAISE EXCEPTION 'L''auteur du document est immuable.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.file_path IS DISTINCT FROM OLD.file_path)
     AND NEW.file_path NOT LIKE NEW.mining_company_id::text || '/%' THEN
    RAISE EXCEPTION 'Le chemin documentaire ne correspond pas à la société parente.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_assay_certificate_audit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_content_changed boolean;
  v_approval_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.uploaded_by := auth.uid();
      NEW.parsing_status := 'pending';
      NEW.parsing_error := NULL;
      NEW.parsed_at := NULL;
      NEW.approval_status := 'pending';
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
      NEW.approval_notes := NULL;
    END IF;
    IF NEW.file_path NOT LIKE NEW.shipping_preparation_id::text || '/%' THEN
      RAISE EXCEPTION 'Le chemin du certificat ne correspond pas à l''expédition parente.'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.shipping_preparation_id IS DISTINCT FROM OLD.shipping_preparation_id THEN
    RAISE EXCEPTION 'Le parent du certificat est immuable.'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.uploaded_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.uploaded_by := auth.uid();
  ELSIF NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
    RAISE EXCEPTION 'L''auteur du certificat est immuable.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.file_path IS DISTINCT FROM OLD.file_path
     AND NEW.file_path NOT LIKE NEW.shipping_preparation_id::text || '/%' THEN
    RAISE EXCEPTION 'Le chemin du certificat ne correspond pas à l''expédition parente.'
      USING ERRCODE = '23514';
  END IF;

  v_content_changed :=
    (to_jsonb(NEW) - ARRAY[
      'id', 'shipping_preparation_id', 'uploaded_by', 'created_at',
      'updated_at', 'approval_status', 'approved_by', 'approved_at',
      'approval_notes'
    ]) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY[
      'id', 'shipping_preparation_id', 'uploaded_by', 'created_at',
      'updated_at', 'approval_status', 'approved_by', 'approved_at',
      'approval_notes'
    ]);
  v_approval_changed := ROW(
    NEW.approval_status, NEW.approved_by, NEW.approved_at, NEW.approval_notes
  ) IS DISTINCT FROM ROW(
    OLD.approval_status, OLD.approved_by, OLD.approved_at, OLD.approval_notes
  );

  IF v_content_changed THEN
    IF NOT public.snp_sec_can_prepare_shipping(OLD.shipping_preparation_id) THEN
      RAISE EXCEPTION 'La préparation de l''expédition est requise pour modifier le certificat.'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.approval_status <> 'pending' THEN
      RAISE EXCEPTION 'Le contenu d''un certificat déjà statué est immuable.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_approval_changed THEN
    IF NOT public.snp_sec_can_approve_shipping(OLD.shipping_preparation_id) THEN
      RAISE EXCEPTION 'La capability sonasp.approve sous AAL2 est requise.'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.approval_status <> 'pending'
       OR NEW.approval_status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Transition d''approbation du certificat interdite.'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.approval_status = 'rejected'
       AND length(trim(coalesce(NEW.approval_notes, ''))) < 5 THEN
      RAISE EXCEPTION 'Un motif de rejet d''au moins cinq caractères est requis.'
        USING ERRCODE = '23514';
    END IF;
    NEW.approved_by := auth.uid();
    NEW.approved_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_shipping_document_audit_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_mining_company_document_audit_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_assay_certificate_audit_guard()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS snp_shipping_document_audit_guard
  ON public.shipping_documents;
CREATE TRIGGER snp_shipping_document_audit_guard
BEFORE INSERT OR UPDATE ON public.shipping_documents
FOR EACH ROW EXECUTE FUNCTION public.snp_shipping_document_audit_guard();

DROP TRIGGER IF EXISTS snp_mining_company_document_audit_guard
  ON public.mining_company_documents;
CREATE TRIGGER snp_mining_company_document_audit_guard
BEFORE INSERT OR UPDATE ON public.mining_company_documents
FOR EACH ROW EXECUTE FUNCTION public.snp_mining_company_document_audit_guard();

DROP TRIGGER IF EXISTS snp_assay_certificate_audit_guard
  ON public.assay_certificates;
CREATE TRIGGER snp_assay_certificate_audit_guard
BEFORE INSERT OR UPDATE ON public.assay_certificates
FOR EACH ROW EXECUTE FUNCTION public.snp_assay_certificate_audit_guard();

REVOKE ALL PRIVILEGES ON TABLE public.shipping_documents FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.assay_certificates FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.mining_company_documents FROM anon, authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.shipping_documents TO authenticated;
GRANT UPDATE (
  title, document_url, file_name, file_size, mime_type
) ON TABLE public.shipping_documents TO authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.assay_certificates TO authenticated;
GRANT UPDATE (
  certificate_number, certificate_date, issuing_laboratory,
  file_path, file_name, file_size, mime_type,
  parsing_status, parsing_error, parsed_at,
  approval_status, approved_by, approved_at, approval_notes,
  sample_id, sample_weight_grams,
  gold_content_ppm, gold_content_gpt, gold_content_percent,
  silver_content_ppm, silver_content_gpt, silver_content_percent,
  platinum_content_ppm, palladium_content_ppm, fineness, purity_percent
) ON TABLE public.assay_certificates TO authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.mining_company_documents TO authenticated;
GRANT UPDATE (
  doc_type, file_name, file_path, file_size, mime_type
) ON TABLE public.mining_company_documents TO authenticated;

CREATE OR REPLACE FUNCTION public.count_shipping_certificates(p_shipping_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.snp_sec_can_read_shipping(p_shipping_id) THEN
    RAISE EXCEPTION 'Expédition hors du périmètre autorisé.'
      USING ERRCODE = '42501';
  END IF;
  SELECT count(*)::integer INTO v_count
  FROM public.assay_certificates ac
  WHERE ac.shipping_preparation_id = p_shipping_id;
  RETURN v_count;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_shipping_assay_certificates(p_shipping_id uuid)
RETURNS TABLE(
  id uuid, certificate_number text, certificate_date date,
  issuing_laboratory text, file_path text, file_name text, file_size bigint,
  parsing_status text, approval_status text, uploaded_by uuid,
  created_at timestamptz, parsed_data jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NOT public.snp_sec_can_read_shipping(p_shipping_id) THEN
    RAISE EXCEPTION 'Expédition hors du périmètre autorisé.'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT ac.id, ac.certificate_number, ac.certificate_date,
         ac.issuing_laboratory, ac.file_path, ac.file_name, ac.file_size,
         ac.parsing_status, ac.approval_status, ac.uploaded_by,
         ac.created_at, row_to_json(acd.*)::jsonb
  FROM public.assay_certificates ac
  LEFT JOIN public.assay_certificate_data acd ON ac.id = acd.certificate_id
  WHERE ac.shipping_preparation_id = p_shipping_id
  ORDER BY ac.created_at DESC;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_certificates_statistics()
RETURNS TABLE(
  total_certificates bigint, pending_approval bigint, approved bigint,
  rejected bigint, pending_parsing bigint, parsing_completed bigint,
  parsing_failed bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NOT public.snp_sec_is_internal_reader() THEN
    RAISE EXCEPTION 'Lecture statistique interne AAL2 requise.'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT count(*)::bigint,
         count(*) FILTER (WHERE ac.approval_status = 'pending')::bigint,
         count(*) FILTER (WHERE ac.approval_status = 'approved')::bigint,
         count(*) FILTER (WHERE ac.approval_status = 'rejected')::bigint,
         count(*) FILTER (WHERE ac.parsing_status = 'pending')::bigint,
         count(*) FILTER (WHERE ac.parsing_status = 'completed')::bigint,
         count(*) FILTER (WHERE ac.parsing_status = 'failed')::bigint
  FROM public.assay_certificates ac;
END;
$fn$;

REVOKE ALL ON FUNCTION public.count_shipping_certificates(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_shipping_assay_certificates(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_certificates_statistics()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_certificate_with_data(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_certificate_data_shipping_id()
  FROM PUBLIC, anon, authenticated;

DO $grant_document_rpc_dependencies$
DECLARE
  v_owner name;
BEGIN
  SELECT pg_get_userbyid(p.proowner) INTO v_owner
  FROM pg_proc p
  WHERE p.oid = 'public.count_shipping_certificates(uuid)'::regprocedure;
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.snp_sec_can_read_shipping(uuid) TO %I',
    v_owner
  );

  SELECT pg_get_userbyid(p.proowner) INTO v_owner
  FROM pg_proc p
  WHERE p.oid = 'public.get_shipping_assay_certificates(uuid)'::regprocedure;
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.snp_sec_can_read_shipping(uuid) TO %I',
    v_owner
  );

  SELECT pg_get_userbyid(p.proowner) INTO v_owner
  FROM pg_proc p
  WHERE p.oid = 'public.get_certificates_statistics()'::regprocedure;
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.snp_sec_is_internal_reader() TO %I',
    v_owner
  );
END;
$grant_document_rpc_dependencies$;

GRANT EXECUTE ON FUNCTION public.count_shipping_certificates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shipping_assay_certificates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_certificates_statistics() TO authenticated;

COMMENT ON FUNCTION public.snp_assay_certificate_audit_guard() IS
  'Dérive uploaded_by/approved_by/approved_at, fige le parent et sépare préparation et approbation.';

-- --------------------------------------------------------------------------
-- 5. Quota export canonique, ledger idempotent et verrous concurrents.
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_release_shipping_quota ON public.shipping_preparations;
DROP TRIGGER IF EXISTS trigger_release_shipping_quota ON public.shipping_preparations;
DROP TRIGGER IF EXISTS trg_reserve_shipping_quota ON public.shipping_preparations;
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_insert ON public.shipping_preparations;
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_update ON public.shipping_preparations;
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_delete ON public.shipping_preparations;

CREATE OR REPLACE FUNCTION public.snp_troy_ounces_to_grams(p_ounces numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT round(p_ounces * 31.1034768, 6);
$fn$;

REVOKE ALL ON FUNCTION public.snp_troy_ounces_to_grams(numeric) FROM PUBLIC, anon, authenticated;

UPDATE public.shipping_preparations
SET export_license_id = COALESCE(export_license_id, license_id),
    license_id = COALESCE(export_license_id, license_id),
    total_net_weight_grams = CASE
      WHEN COALESCE(total_net_weight_grams, 0) > 0 THEN total_net_weight_grams
      WHEN COALESCE(total_weight_oz, 0) > 0
        THEN public.snp_troy_ounces_to_grams(total_weight_oz)
      ELSE total_net_weight_grams
    END
WHERE export_license_id IS NOT NULL
   OR license_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_export_licenses_id_company
  ON public.export_licenses(id, mining_company_id);

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shipping_preparations'::regclass
      AND conname = 'shipping_license_columns_consistent'
  ) THEN
    ALTER TABLE public.shipping_preparations
      ADD CONSTRAINT shipping_license_columns_consistent
      CHECK (license_id IS NOT DISTINCT FROM export_license_id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shipping_preparations'::regclass
      AND conname = 'shipping_license_requires_company'
  ) THEN
    ALTER TABLE public.shipping_preparations
      ADD CONSTRAINT shipping_license_requires_company
      CHECK (export_license_id IS NULL OR mining_company_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shipping_preparations'::regclass
      AND conname = 'shipping_export_license_company_fkey'
  ) THEN
    ALTER TABLE public.shipping_preparations
      ADD CONSTRAINT shipping_export_license_company_fkey
      FOREIGN KEY (export_license_id, mining_company_id)
      REFERENCES public.export_licenses(id, mining_company_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID;
  END IF;
END;
$constraints$;

ALTER TABLE public.shipping_preparations
  VALIDATE CONSTRAINT shipping_license_columns_consistent;
ALTER TABLE public.shipping_preparations
  VALIDATE CONSTRAINT shipping_license_requires_company;
ALTER TABLE public.shipping_preparations
  VALIDATE CONSTRAINT shipping_export_license_company_fkey;

COMMENT ON COLUMN public.shipping_preparations.export_license_id IS
  'Licence canonique de l’expédition. license_id est conservée synchronisée pour compatibilité legacy.';
COMMENT ON COLUMN public.shipping_preparations.total_net_weight_grams IS
  'Poids canonique utilisé par le quota. Une once troy vaut exactement 31,1034768 g dans les conversions de repli.';

ALTER TABLE public.export_licenses
  ADD COLUMN IF NOT EXISTS quota_baseline_used_grams numeric;

WITH linked AS (
  SELECT sp.export_license_id AS license_id,
         sum(sp.total_net_weight_grams) AS reserved_grams
  FROM public.shipping_preparations sp
  WHERE sp.export_license_id IS NOT NULL
    AND sp.total_net_weight_grams > 0
  GROUP BY sp.export_license_id
)
UPDATE public.export_licenses el
SET quota_baseline_used_grams = greatest(
  el.used_quantity_grams - coalesce(linked.reserved_grams, 0),
  0
)
FROM (SELECT el2.id, l.reserved_grams
      FROM public.export_licenses el2
      LEFT JOIN linked l ON l.license_id = el2.id) linked
WHERE el.id = linked.id
  AND el.quota_baseline_used_grams IS NULL;

ALTER TABLE public.export_licenses
  ALTER COLUMN quota_baseline_used_grams SET DEFAULT 0,
  ALTER COLUMN quota_baseline_used_grams SET NOT NULL;

DO $baseline_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.export_licenses'::regclass
      AND conname = 'export_licenses_quota_baseline_nonnegative'
  ) THEN
    ALTER TABLE public.export_licenses
      ADD CONSTRAINT export_licenses_quota_baseline_nonnegative
      CHECK (quota_baseline_used_grams >= 0) NOT VALID;
  END IF;
END;
$baseline_constraint$;
ALTER TABLE public.export_licenses
  VALIDATE CONSTRAINT export_licenses_quota_baseline_nonnegative;

CREATE TABLE IF NOT EXISTS public.snp_export_license_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_reference uuid NOT NULL UNIQUE,
  shipping_preparation_id uuid UNIQUE
    REFERENCES public.shipping_preparations(id) ON DELETE SET NULL,
  license_id uuid NOT NULL REFERENCES public.export_licenses(id) ON DELETE RESTRICT,
  mining_company_id uuid NOT NULL REFERENCES public.mining_companies(id) ON DELETE RESTRICT,
  reserved_grams numeric NOT NULL CHECK (reserved_grams > 0),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'released')),
  reserved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at timestamptz,
  release_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_export_license_reservation_release_shape CHECK (
    (status = 'reserved' AND released_at IS NULL)
    OR (status = 'released' AND released_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_export_license_reservations_license_status
  ON public.snp_export_license_reservations(license_id, status);
CREATE INDEX IF NOT EXISTS idx_snp_export_license_reservations_company
  ON public.snp_export_license_reservations(mining_company_id, reserved_at DESC);

ALTER TABLE public.snp_export_license_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_export_license_reservations FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_export_license_reservations FROM anon, authenticated;

INSERT INTO public.snp_export_license_reservations (
  shipping_reference, shipping_preparation_id, license_id, mining_company_id,
  reserved_grams, status, reserved_by, reserved_at
)
SELECT sp.id, sp.id, sp.export_license_id, sp.mining_company_id,
       sp.total_net_weight_grams, 'reserved', sp.created_by,
       coalesce(sp.created_at, now())
FROM public.shipping_preparations sp
WHERE sp.export_license_id IS NOT NULL
  AND sp.total_net_weight_grams > 0
ON CONFLICT (shipping_reference) DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_recompute_license_usage(
  p_license_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_authorized numeric;
  v_baseline numeric;
  v_used numeric;
BEGIN
  SELECT authorized_quantity_grams, quota_baseline_used_grams
  INTO v_authorized, v_baseline
  FROM public.export_licenses
  WHERE id = p_license_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Licence introuvable.' USING ERRCODE = '23503';
  END IF;

  SELECT v_baseline + coalesce(sum(r.reserved_grams), 0)
  INTO v_used
  FROM public.snp_export_license_reservations r
  WHERE r.license_id = p_license_id
    AND r.status = 'reserved';

  IF v_used > v_authorized + 0.000001 THEN
    RAISE EXCEPTION 'Quota insuffisant : autorisé % g, demandé/cumulé % g.',
      v_authorized, v_used
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.export_licenses
  SET used_quantity_grams = v_used,
      status = CASE
        WHEN status IN ('cancelled', 'suspended') THEN status
        WHEN current_date > end_date THEN 'expired'
        WHEN v_used >= authorized_quantity_grams THEN 'exhausted'
        WHEN current_date < start_date THEN 'pending'
        ELSE 'active'
      END,
      updated_by = p_actor_id,
      updated_at = now()
  WHERE id = p_license_id;

  RETURN v_used;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sync_shipping_license_reservation(
  p_shipping_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_shipping public.shipping_preparations%ROWTYPE;
  v_old_license uuid;
  v_old_grams numeric;
  v_old_status text;
  v_license_company uuid;
  v_license_status text;
  v_start_date date;
  v_end_date date;
  v_authorized numeric;
  v_projected numeric;
  v_grams numeric;
BEGIN
  SELECT * INTO v_shipping
  FROM public.shipping_preparations
  WHERE id = p_shipping_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expédition introuvable.' USING ERRCODE = '23503';
  END IF;

  v_grams := CASE
    WHEN coalesce(v_shipping.total_net_weight_grams, 0) > 0
      THEN round(v_shipping.total_net_weight_grams, 6)
    WHEN coalesce(v_shipping.total_weight_oz, 0) > 0
      THEN public.snp_troy_ounces_to_grams(v_shipping.total_weight_oz)
    ELSE 0
  END;

  SELECT r.license_id, r.reserved_grams, r.status
  INTO v_old_license, v_old_grams, v_old_status
  FROM public.snp_export_license_reservations r
  WHERE r.shipping_reference = p_shipping_id
  FOR UPDATE;

  IF v_shipping.export_license_id IS NULL OR v_grams <= 0 THEN
    IF v_old_license IS NOT NULL AND v_old_status = 'reserved' THEN
      UPDATE public.snp_export_license_reservations
      SET status = 'released', released_by = p_actor_id, released_at = now(),
          release_reason = 'Synchronisation : licence ou poids retiré', updated_at = now()
      WHERE shipping_reference = p_shipping_id;
      PERFORM public.snp_recompute_license_usage(v_old_license, p_actor_id);
    END IF;
    RETURN true;
  END IF;

  IF v_old_status = 'reserved'
     AND v_old_license = v_shipping.export_license_id
     AND abs(v_old_grams - v_grams) <= 0.000001 THEN
    RETURN true;
  END IF;

  -- Ordre UUID déterministe + FOR UPDATE : sérialise deux réservations sur la
  -- même licence et évite les deadlocks lors d'un changement de licence.
  PERFORM el.id
  FROM public.export_licenses el
  WHERE el.id IN (v_old_license, v_shipping.export_license_id)
  ORDER BY el.id
  FOR UPDATE;

  SELECT mining_company_id, status, start_date, end_date,
         authorized_quantity_grams
  INTO v_license_company, v_license_status, v_start_date, v_end_date,
       v_authorized
  FROM public.export_licenses
  WHERE id = v_shipping.export_license_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Licence introuvable.' USING ERRCODE = '23503';
  END IF;
  IF v_license_company <> v_shipping.mining_company_id THEN
    RAISE EXCEPTION 'La licence et l''expédition appartiennent à des sociétés différentes.'
      USING ERRCODE = '23514';
  END IF;
  IF v_license_status <> 'active'
     OR current_date < v_start_date
     OR current_date > v_end_date THEN
    RAISE EXCEPTION 'La licence n''est pas active à la date de réservation.'
      USING ERRCODE = '23514';
  END IF;

  SELECT el.quota_baseline_used_grams
         + coalesce(sum(r.reserved_grams)
           FILTER (WHERE r.shipping_reference <> p_shipping_id), 0)
         + v_grams
  INTO v_projected
  FROM public.export_licenses el
  LEFT JOIN public.snp_export_license_reservations r
    ON r.license_id = el.id AND r.status = 'reserved'
  WHERE el.id = v_shipping.export_license_id
  GROUP BY el.quota_baseline_used_grams;

  IF v_projected > v_authorized + 0.000001 THEN
    RAISE EXCEPTION 'Quota insuffisant : autorisé % g, projeté % g.',
      v_authorized, v_projected
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.snp_export_license_reservations (
    shipping_reference, shipping_preparation_id, license_id,
    mining_company_id, reserved_grams, status, reserved_by,
    reserved_at, released_by, released_at, release_reason, updated_at
  ) VALUES (
    p_shipping_id, p_shipping_id, v_shipping.export_license_id,
    v_shipping.mining_company_id, v_grams, 'reserved', p_actor_id,
    now(), NULL, NULL, NULL, now()
  )
  ON CONFLICT (shipping_reference) DO UPDATE
  SET shipping_preparation_id = EXCLUDED.shipping_preparation_id,
      license_id = EXCLUDED.license_id,
      mining_company_id = EXCLUDED.mining_company_id,
      reserved_grams = EXCLUDED.reserved_grams,
      status = 'reserved',
      reserved_by = EXCLUDED.reserved_by,
      reserved_at = now(),
      released_by = NULL,
      released_at = NULL,
      release_reason = NULL,
      updated_at = now();

  IF v_old_license IS NOT NULL
     AND v_old_license <> v_shipping.export_license_id THEN
    PERFORM public.snp_recompute_license_usage(v_old_license, p_actor_id);
  END IF;
  PERFORM public.snp_recompute_license_usage(v_shipping.export_license_id, p_actor_id);
  RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_release_shipping_reservation_internal(
  p_shipping_id uuid,
  p_actor_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_license_id uuid;
  v_status text;
BEGIN
  SELECT license_id, status INTO v_license_id, v_status
  FROM public.snp_export_license_reservations
  WHERE shipping_reference = p_shipping_id
  FOR UPDATE;

  IF NOT FOUND OR v_status = 'released' THEN
    RETURN true;
  END IF;

  UPDATE public.snp_export_license_reservations
  SET status = 'released', released_by = p_actor_id, released_at = now(),
      release_reason = p_reason, updated_at = now()
  WHERE shipping_reference = p_shipping_id;

  PERFORM public.snp_recompute_license_usage(v_license_id, p_actor_id);
  RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reserve_license_quota(
  p_license_id uuid,
  p_shipping_id uuid,
  p_quantity numeric,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_license_id uuid;
  v_mining_company_id uuid;
  v_expected numeric;
BEGIN
  IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'L''acteur est dérivé du jeton et ne peut pas être usurpé.'
      USING ERRCODE = '42501';
  END IF;

  SELECT export_license_id, mining_company_id,
         CASE
           WHEN coalesce(total_net_weight_grams, 0) > 0
             THEN round(total_net_weight_grams, 6)
           WHEN coalesce(total_weight_oz, 0) > 0
             THEN public.snp_troy_ounces_to_grams(total_weight_oz)
           ELSE 0
         END
  INTO v_license_id, v_mining_company_id, v_expected
  FROM public.shipping_preparations
  WHERE id = p_shipping_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expédition introuvable.' USING ERRCODE = '23503';
  END IF;
  IF NOT public.snp_sec_can_prepare_company(v_mining_company_id) THEN
    RAISE EXCEPTION
      'AAL2 et sonasp.prepare, ou mine.operate sur la société de l''expédition, requis.'
      USING ERRCODE = '42501';
  END IF;
  IF v_license_id IS DISTINCT FROM p_license_id THEN
    RAISE EXCEPTION 'La licence demandée n''est pas celle de l''expédition.'
      USING ERRCODE = '23514';
  END IF;
  IF p_quantity IS NULL OR abs(p_quantity - v_expected) > 0.01 THEN
    RAISE EXCEPTION 'La quantité est dérivée de l''expédition : attendu % g.', v_expected
      USING ERRCODE = '23514';
  END IF;

  RETURN public.snp_sync_shipping_license_reservation(p_shipping_id, auth.uid());
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_release_shipping_license_quota(
  p_shipping_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  PERFORM public.snp_require_capability('sonasp.approve');
  IF length(trim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Un motif de libération d''au moins 10 caractères est requis.'
      USING ERRCODE = '23514';
  END IF;
  RETURN public.snp_release_shipping_reservation_internal(
    p_shipping_id, auth.uid(), trim(p_reason)
  );
END;
$fn$;

-- Signature legacy neutralisée : elle ne contient pas shipping_id et ne peut
-- donc pas prouver l'objet parent ni garantir l'idempotence.
CREATE OR REPLACE FUNCTION public.release_license_quota(
  p_license_id uuid,
  p_quantity numeric,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  RAISE EXCEPTION
    'RPC obsolète : utiliser snp_release_shipping_license_quota(shipping_id, reason).'
    USING ERRCODE = '0A000';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_shipping_canonicalize_quota_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_license_company uuid;
BEGIN
  IF NEW.license_id IS NOT NULL
     AND NEW.export_license_id IS NOT NULL
     AND NEW.license_id <> NEW.export_license_id THEN
    RAISE EXCEPTION 'license_id et export_license_id ne peuvent pas diverger.'
      USING ERRCODE = '23514';
  END IF;

  NEW.export_license_id := coalesce(NEW.export_license_id, NEW.license_id);
  NEW.license_id := NEW.export_license_id;

  IF NEW.export_license_id IS NOT NULL
     AND coalesce(NEW.total_net_weight_grams, 0) <= 0
     AND coalesce(NEW.total_weight_oz, 0) > 0 THEN
    NEW.total_net_weight_grams := public.snp_troy_ounces_to_grams(NEW.total_weight_oz);
  END IF;

  IF NEW.export_license_id IS NOT NULL THEN
    IF NEW.mining_company_id IS NULL OR coalesce(NEW.total_net_weight_grams, 0) <= 0 THEN
      RAISE EXCEPTION 'Une expédition avec licence exige une société et un poids net positif en grammes.'
        USING ERRCODE = '23514';
    END IF;
    SELECT mining_company_id INTO v_license_company
    FROM public.export_licenses WHERE id = NEW.export_license_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Licence introuvable.' USING ERRCODE = '23503';
    END IF;
    IF v_license_company <> NEW.mining_company_id THEN
      RAISE EXCEPTION 'La licence et l''expédition appartiennent à des sociétés différentes.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Le créateur d''une expédition est immuable.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_shipping_sync_quota_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  PERFORM public.snp_sync_shipping_license_reservation(NEW.id, auth.uid());
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_shipping_release_quota_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  PERFORM public.snp_release_shipping_reservation_internal(
    OLD.id, auth.uid(), 'Suppression de l''expédition'
  );
  RETURN OLD;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_recompute_license_usage(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_sync_shipping_license_reservation(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_release_shipping_reservation_internal(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_license_quota(uuid,uuid,numeric,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_release_shipping_license_quota(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_license_quota(uuid,numeric,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_shipping_canonicalize_quota_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_shipping_sync_quota_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snp_shipping_release_quota_trigger() FROM PUBLIC, anon, authenticated;

-- CREATE OR REPLACE conserve le propriétaire d'une signature préexistante.
-- Si le rôle de migration diffère de cet owner (cas d'une restauration ou
-- d'une promotion multi-environnement), le wrapper doit néanmoins pouvoir
-- exécuter ses dépendances internes sans les réexposer aux rôles clients.
DO $grant_reserve_dependencies$
DECLARE
  v_wrapper_owner name;
BEGIN
  SELECT pg_get_userbyid(p.proowner)
  INTO v_wrapper_owner
  FROM pg_proc p
  WHERE p.oid = 'public.reserve_license_quota(uuid,uuid,numeric,uuid)'::regprocedure;

  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.snp_troy_ounces_to_grams(numeric) TO %I',
    v_wrapper_owner
  );
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.snp_sec_can_prepare_company(uuid) TO %I',
    v_wrapper_owner
  );
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.snp_sync_shipping_license_reservation(uuid,uuid) TO %I',
    v_wrapper_owner
  );
END;
$grant_reserve_dependencies$;

GRANT EXECUTE ON FUNCTION public.reserve_license_quota(uuid,uuid,numeric,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_release_shipping_license_quota(uuid,text) TO authenticated, service_role;

DROP TRIGGER IF EXISTS snp_shipping_00_canonicalize_quota
  ON public.shipping_preparations;
CREATE TRIGGER snp_shipping_00_canonicalize_quota
BEFORE INSERT OR UPDATE OF license_id, export_license_id,
  total_net_weight_grams, total_weight_oz, mining_company_id, created_by
ON public.shipping_preparations
FOR EACH ROW EXECUTE FUNCTION public.snp_shipping_canonicalize_quota_fields();

DROP TRIGGER IF EXISTS snp_shipping_90_sync_quota
  ON public.shipping_preparations;
CREATE TRIGGER snp_shipping_90_sync_quota
AFTER INSERT OR UPDATE OF export_license_id, total_net_weight_grams,
  total_weight_oz, mining_company_id
ON public.shipping_preparations
FOR EACH ROW EXECUTE FUNCTION public.snp_shipping_sync_quota_trigger();

DROP TRIGGER IF EXISTS snp_shipping_05_release_quota
  ON public.shipping_preparations;
CREATE TRIGGER snp_shipping_05_release_quota
BEFORE DELETE ON public.shipping_preparations
FOR EACH ROW EXECUTE FUNCTION public.snp_shipping_release_quota_trigger();

COMMENT ON TABLE public.snp_export_license_reservations IS
  'Registre idempotent des réservations par expédition. Le baseline conserve les usages antérieurs non rattachés.';
COMMENT ON FUNCTION public.reserve_license_quota(uuid,uuid,numeric,uuid) IS
  'RPC compatible : AAL2, sonasp.prepare global ou mine.operate du tenant ; quantité et acteur dérivés, appels répétés idempotents.';
COMMENT ON FUNCTION public.snp_release_shipping_license_quota(uuid,text) IS
  'Libération idempotente par shipping_id, réservée à sonasp.approve sous AAL2.';

-- --------------------------------------------------------------------------
-- 6. Postflight bloquant.
-- --------------------------------------------------------------------------
DO $postflight$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.shipping_preparations
  WHERE license_id IS DISTINCT FROM export_license_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight P0 : % divergence(s) de colonne licence.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.export_licenses el
  WHERE abs(
    el.used_quantity_grams
    - (
      el.quota_baseline_used_grams
      + coalesce((
        SELECT sum(r.reserved_grams)
        FROM public.snp_export_license_reservations r
        WHERE r.license_id = el.id AND r.status = 'reserved'
      ), 0)
    )
  ) > 0.01;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight P0 : % licence(s) ne correspondent pas au ledger.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.shipping_preparations'::regclass
    AND NOT t.tgisinternal
    AND t.tgname IN (
      'trg_release_shipping_quota', 'trigger_release_shipping_quota',
      'trg_reserve_shipping_quota',
      'trg_update_license_quantity_on_insert',
      'trg_update_license_quantity_on_update',
      'trg_update_license_quantity_on_delete'
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight P0 : un trigger quota legacy subsiste.';
  END IF;

  SELECT count(*) INTO v_count
  FROM storage.buckets
  WHERE id IN ('shipping-documents', 'ASSAY-CERTIFICATES', 'mining-company-documents')
    AND public;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight P0 : un bucket sensible est encore public.';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'create_artisan_sale_to_sonasp', 'release_license_quota',
      'log_security_event', 'log_user_activity', 'generate_activation_token',
      'validate_activation_token', 'auto_allocate_inventory'
    )
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight P0 : % RPC dangereuse(s) restent exécutables par anon.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (
      'shipping_preparations', 'mining_companies', 'snp_achats_mines',
      'user_sessions', 'audit_logs', 'audit_trail', 'user_activation_tokens',
      'shipping_documents', 'assay_certificates', 'mining_company_documents'
    )
    AND grantee = 'anon';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Postflight P0 : anon conserve % grant(s) sur les tables critiques.', v_count;
  END IF;

  IF has_table_privilege(
    'authenticated', 'public.shipping_preparations', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : UPDATE table-wide Shipping reste accordé à authenticated.';
  END IF;

  IF has_column_privilege(
    'authenticated', 'public.shipping_preparations', 'status', 'UPDATE'
  ) OR has_column_privilege(
    'authenticated', 'public.shipping_preparations', 'shipped_at', 'UPDATE'
  ) OR has_column_privilege(
    'authenticated', 'public.shipping_preparations', 'mining_company_id', 'UPDATE'
  ) OR NOT has_column_privilege(
    'authenticated', 'public.shipping_preparations', 'notes', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : ACL colonne Shipping invalide.';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.snp_transition_shipping_preparation(uuid,public.shipping_preparation_status,public.shipping_preparation_status)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.snp_transition_shipping_preparation(uuid,public.shipping_preparation_status,public.shipping_preparation_status)',
    'EXECUTE'
  ) OR has_function_privilege(
    'service_role',
    'public.snp_transition_shipping_preparation(uuid,public.shipping_preparation_status,public.shipping_preparation_status)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : ACL inattendue sur la RPC de transition Shipping.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.shipping_preparations'::regclass
      AND tgname = 'snp_shipping_status_audit'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : le trigger d''audit Shipping est absent.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code = 'email.settings.manage' AND sensitive
  ) OR EXISTS (
    SELECT 1 FROM public.snp_role_capabilities
    WHERE capability_code = 'email.settings.manage'
      AND role NOT IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : attribution par défaut SMTP invalide.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'snp_configuration_courriel'
  ) OR has_table_privilege(
    'authenticated', 'public.snp_configuration_courriel', 'SELECT'
  ) OR has_table_privilege(
    'anon', 'public.snp_configuration_courriel', 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : la table SMTP n''est pas fail-closed.';
  END IF;

  IF has_function_privilege(
    'anon', 'public.snp_configurations_courriel()', 'EXECUTE'
  ) OR has_function_privilege(
    'authenticated', 'public.snp_configuration_courriel_active()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : ACL SMTP inattendue.';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'shipping_documents', 'assay_certificates', 'mining_company_documents'
    )
    AND c.relrowsecurity
    AND c.relforcerowsecurity;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Postflight P0 : RLS/FORCE incomplet sur les métadonnées documentaires.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'shipping_documents', 'assay_certificates',
        'mining_company_documents'
      )
      AND (
        coalesce(qual, '') IN ('true', '(true)')
        OR coalesce(with_check, '') IN ('true', '(true)')
      )
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : une policy documentaire globale subsiste.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assay_certificates'
      AND column_name = 'shipping_preparation_id'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : un certificat peut encore être créé sans parent.';
  END IF;

  IF has_function_privilege(
    'anon', 'public.count_shipping_certificates(uuid)', 'EXECUTE'
  ) OR has_function_privilege(
    'anon', 'public.get_shipping_assay_certificates(uuid)', 'EXECUTE'
  ) OR has_function_privilege(
    'anon', 'public.get_certificates_statistics()', 'EXECUTE'
  ) OR has_function_privilege(
    'authenticated', 'public.get_certificate_with_data(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Postflight P0 : une RPC documentaire contourne encore le cloisonnement.';
  END IF;
END;
$postflight$;

-- --------------------------------------------------------------------------
-- ROLLBACK NON DESTRUCTIF DOCUMENTÉ (à exécuter seulement en fenêtre dédiée)
-- --------------------------------------------------------------------------
-- Le rollback de sécurité ne restaure jamais les policies TRUE, les buckets
-- publics, les grants anon ni les anciennes RPC usurpables.
--
-- En cas d'incompatibilité applicative :
--   1. passer les workflows expédition/licence en lecture seule ;
--   2. REVOKE EXECUTE sur snp_transition_shipping_preparation,
--      reserve_license_quota et snp_release_shipping_license_quota pour geler
--      les mutations ;
--   3. conserver snp_export_license_reservations et
--      quota_baseline_used_grams (aucune donnée ne doit être supprimée) ;
--   4. corriger le client/endpoint et livrer une migration roll-forward ;
--   5. réconcilier avec : baseline + SUM(reservations reserved), puis réactiver
--      uniquement les trois triggers snp_shipping_* de cette migration.
--
-- Si les triggers doivent être neutralisés temporairement, les désactiver sous
-- verrou métier après l'étape 2 ; ne jamais recréer les triggers legacy. Un
-- retour de schéma complet exige une restauration testée du snapshot pré-déploiement.
