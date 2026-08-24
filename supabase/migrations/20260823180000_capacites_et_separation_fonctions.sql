-- ============================================================================
-- Capacités serveur et séparation des fonctions
-- ============================================================================
-- Migration additive : les neuf rôles historiques et leurs portails restent
-- valides. Les nouvelles capacités précisent les actions métier sans transformer
-- immédiatement la colonne `user_profiles.role` en système multi-rôles.

CREATE TABLE IF NOT EXISTS public.snp_capability_catalog (
  code text PRIMARY KEY,
  domain text NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_capability_catalog_code_format
    CHECK (code ~ '^[a-z][a-z0-9_.-]+$')
);

CREATE TABLE IF NOT EXISTS public.snp_role_capabilities (
  role text NOT NULL,
  capability_code text NOT NULL
    REFERENCES public.snp_capability_catalog(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, capability_code)
);

CREATE TABLE IF NOT EXISTS public.snp_user_capabilities (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  capability_code text NOT NULL
    REFERENCES public.snp_capability_catalog(code) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  reason text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, capability_code),
  CONSTRAINT snp_user_capabilities_validity
    CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT snp_user_capabilities_reason
    CHECK (length(trim(reason)) >= 10)
);

CREATE TABLE IF NOT EXISTS public.snp_workflow_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  action text NOT NULL,
  status_before text,
  status_after text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  capability_code text,
  reason text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snp_workflow_audit_aggregate
  ON public.snp_workflow_audit(aggregate_type, aggregate_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_snp_workflow_audit_actor
  ON public.snp_workflow_audit(actor_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.snp_workflow_notification_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.snp_capability_catalog (code, domain, label, description, sensitive)
VALUES
  ('accounts.manage', 'administration', 'Administrer les comptes', 'Créer, modifier et désactiver les comptes non-Propriétaire.', true),
  ('referentials.manage', 'administration', 'Administrer les référentiels', 'Gérer les référentiels techniques de la plateforme.', true),
  ('support.read', 'administration', 'Support en lecture', 'Consulter les informations nécessaires au support sans opération métier.', false),
  ('reports.read', 'reporting', 'Consulter les rapports', 'Consulter les rapports autorisés dans le périmètre du compte.', false),
  ('sonasp.workflow.read', 'sonasp', 'Consulter les workflows SONASP', 'Consulter les dossiers opérationnels internes.', false),
  ('sonasp.prepare', 'sonasp', 'Préparer et soumettre', 'Créer les brouillons, les modifier et les soumettre au contrôle.', true),
  ('sonasp.approve', 'sonasp', 'Approuver ou rejeter', 'Contrôler, approuver ou rejeter un dossier avec motif.', true),
  ('sonasp.finance.execute', 'finance', 'Exécuter un paiement', 'Exécuter un règlement et joindre sa preuve bancaire.', true),
  ('sonasp.finance.reconcile', 'finance', 'Rapprocher un paiement', 'Rapprocher et clôturer une opération financière exécutée par un autre acteur.', true),
  ('comptoir.manage', 'comptoir', 'Gérer un comptoir', 'Gérer achats, ventes, paiements, taxes et stock du comptoir rattaché.', true),
  ('collectors.manage', 'artisanat', 'Gérer les collecteurs', 'Créer les rattachements entre collecteurs, orpailleurs et sites.', true),
  ('collector.operate', 'artisanat', 'Opérer comme collecteur', 'Enregistrer les productions et opérations des orpailleurs rattachés.', true),
  ('mine.operate', 'mine', 'Opérer pour une mine', 'Utiliser les modules industriels dans le périmètre de la mine rattachée.', true),
  ('factory.operate', 'factory', 'Opérer pour une usine', 'Utiliser le portail Usine.', true),
  ('airport.operate', 'airport', 'Opérer pour un aéroport', 'Utiliser le portail Aéroport.', true),
  ('refinery.operate', 'refinery', 'Opérer pour une raffinerie', 'Utiliser le portail Raffinerie.', true),
  ('customer.operate', 'customer', 'Opérer pour un client', 'Utiliser le portail Client.', true)
ON CONFLICT (code) DO UPDATE
SET domain = EXCLUDED.domain,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    sensitive = EXCLUDED.sensitive;

-- Compatibilité initiale. `management` conserve temporairement les capacités
-- historiques, mais les gardes par dossier ci-dessous empêchent leur cumul sur
-- une même opération. Les comptes peuvent ensuite recevoir des overrides ciblés.
INSERT INTO public.snp_role_capabilities (role, capability_code)
VALUES
  ('admin', 'accounts.manage'),
  ('admin', 'referentials.manage'),
  ('admin', 'support.read'),
  ('admin', 'reports.read'),
  ('management', 'reports.read'),
  ('management', 'sonasp.workflow.read'),
  ('management', 'sonasp.prepare'),
  ('management', 'sonasp.approve'),
  ('management', 'sonasp.finance.execute'),
  ('management', 'sonasp.finance.reconcile'),
  ('management', 'comptoir.manage'),
  ('management', 'collectors.manage'),
  ('manager', 'reports.read'),
  ('manager', 'sonasp.workflow.read'),
  ('mine', 'mine.operate'),
  ('factory', 'factory.operate'),
  ('airport', 'airport.operate'),
  ('refinery', 'refinery.operate'),
  ('customer', 'customer.operate')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_actor_has_capability(p_capability_code text)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  WITH actor AS (
    SELECT p.id, p.role
    FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.is_active
  ), capability AS (
    SELECT c.code, c.sensitive
    FROM public.snp_capability_catalog c
    WHERE c.code = p_capability_code
  ), explicit_override AS (
    SELECT uc.allowed
    FROM public.snp_user_capabilities uc
    WHERE uc.user_id = auth.uid()
      AND uc.capability_code = p_capability_code
      AND uc.valid_from <= clock_timestamp()
      AND (uc.valid_until IS NULL OR uc.valid_until > clock_timestamp())
  )
  SELECT CASE
    WHEN COALESCE(auth.role(), '') = 'service_role' THEN true
    WHEN NOT EXISTS (SELECT 1 FROM actor) THEN false
    WHEN NOT EXISTS (SELECT 1 FROM capability) THEN false
    WHEN (SELECT sensitive FROM capability) AND NOT public.snp_mfa_satisfaite() THEN false
    WHEN (SELECT role FROM actor) = 'manager'
      AND p_capability_code NOT IN ('reports.read', 'sonasp.workflow.read') THEN false
    WHEN EXISTS (SELECT 1 FROM explicit_override)
      THEN (SELECT allowed FROM explicit_override LIMIT 1)
    WHEN (SELECT role FROM actor) = 'owner' THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.snp_role_capabilities rc
      WHERE rc.role = (SELECT role FROM actor)
        AND rc.capability_code = p_capability_code
    )
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_require_capability(p_capability_code text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NOT public.snp_actor_has_capability(p_capability_code) THEN
    RAISE EXCEPTION 'Capacité serveur requise : %.', p_capability_code
      USING ERRCODE = '42501';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_actor_capabilities()
RETURNS TABLE (capability_code text)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT c.code
  FROM public.snp_capability_catalog c
  WHERE public.snp_actor_has_capability(c.code)
  ORDER BY c.code;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_est_agent_sonasp()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_actor_has_capability('sonasp.prepare')
      OR public.snp_actor_has_capability('sonasp.approve')
      OR public.snp_actor_has_capability('sonasp.finance.execute')
      OR public.snp_actor_has_capability('sonasp.finance.reconcile');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_peut_valider()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_actor_has_capability('sonasp.approve');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_peut_financer(p_action text DEFAULT 'execute')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE p_action
    WHEN 'execute' THEN public.snp_actor_has_capability('sonasp.finance.execute')
    WHEN 'reconcile' THEN public.snp_actor_has_capability('sonasp.finance.reconcile')
    ELSE false
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_est_direction_lecture()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_actor_has_capability('sonasp.workflow.read')
      OR public.snp_actor_has_capability('reports.read');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_peut_gerer_sites_artisanaux()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_actor_has_capability('collectors.manage')
      OR public.snp_actor_has_capability('comptoir.manage');
$fn$;

CREATE OR REPLACE FUNCTION public.snp_record_workflow_event(
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_action text,
  p_status_before text,
  p_status_after text,
  p_capability_code text,
  p_reason text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_id bigint;
BEGIN
  INSERT INTO public.snp_workflow_audit (
    aggregate_type, aggregate_id, action, status_before, status_after,
    actor_id, actor_role, capability_code, reason, context
  ) VALUES (
    p_aggregate_type, p_aggregate_id, p_action, p_status_before, p_status_after,
    auth.uid(), public.snp_role_utilisateur(), p_capability_code, p_reason,
    COALESCE(p_context, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  INSERT INTO public.snp_workflow_notification_outbox (
    event_key, event_type, aggregate_type, aggregate_id, payload
  ) VALUES (
    concat_ws(':', p_aggregate_type, p_aggregate_id::text, p_action, v_id::text),
    p_action, p_aggregate_type, p_aggregate_id,
    jsonb_build_object(
      'audit_id', v_id,
      'status_before', p_status_before,
      'status_after', p_status_after,
      'actor_id', auth.uid(),
      'reason', p_reason
    ) || COALESCE(p_context, '{}'::jsonb)
  );

  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_definir_capacite_utilisateur(
  p_user_id uuid,
  p_capability_code text,
  p_allowed boolean,
  p_reason text,
  p_valid_until timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_target_role text;
BEGIN
  PERFORM public.snp_require_capability('accounts.manage');

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier vos propres capacités.'
      USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'La justification doit contenir au moins 10 caractères.'
      USING ERRCODE = '22023';
  END IF;
  IF p_capability_code = 'accounts.manage' THEN
    RAISE EXCEPTION 'La capacité d’administration des comptes suit exclusivement le rôle administrateur.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog WHERE code = p_capability_code
  ) THEN
    RAISE EXCEPTION 'Capacité inconnue : %.', p_capability_code
      USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_target_role
  FROM public.user_profiles
  WHERE id = p_user_id AND is_active
  FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Compte cible introuvable ou inactif.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Les capacités du Propriétaire sont gérées hors interface.'
      USING ERRCODE = '42501';
  END IF;
  IF v_target_role = 'manager'
     AND p_allowed
     AND p_capability_code NOT IN ('reports.read', 'sonasp.workflow.read') THEN
    RAISE EXCEPTION 'Le profil Manager est strictement limité à la lecture.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.snp_user_capabilities (
    user_id, capability_code, allowed, valid_from, valid_until,
    reason, granted_by, granted_at
  ) VALUES (
    p_user_id, p_capability_code, p_allowed, now(), p_valid_until,
    trim(p_reason), auth.uid(), now()
  )
  ON CONFLICT (user_id, capability_code) DO UPDATE
  SET allowed = EXCLUDED.allowed,
      valid_from = EXCLUDED.valid_from,
      valid_until = EXCLUDED.valid_until,
      reason = EXCLUDED.reason,
      granted_by = EXCLUDED.granted_by,
      granted_at = EXCLUDED.granted_at;

  PERFORM public.snp_record_workflow_event(
    'account-capability', p_user_id,
    CASE WHEN p_allowed THEN 'capability-granted' ELSE 'capability-denied' END,
    NULL, p_capability_code, 'accounts.manage', p_reason,
    jsonb_build_object('allowed', p_allowed, 'valid_until', p_valid_until)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_block_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF COALESCE(auth.role(), '') = 'authenticated' THEN
    RAISE EXCEPTION 'Le journal d’audit est immuable.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_workflow_audit_immutable ON public.snp_workflow_audit;
CREATE TRIGGER snp_workflow_audit_immutable
BEFORE UPDATE OR DELETE ON public.snp_workflow_audit
FOR EACH ROW EXECUTE FUNCTION public.snp_block_audit_mutation();

ALTER TABLE public.snp_capability_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_user_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_workflow_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_workflow_notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_capability_catalog_read ON public.snp_capability_catalog;
CREATE POLICY snp_capability_catalog_read ON public.snp_capability_catalog
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS snp_role_capabilities_read ON public.snp_role_capabilities;
CREATE POLICY snp_role_capabilities_read ON public.snp_role_capabilities
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS snp_user_capabilities_read ON public.snp_user_capabilities;
CREATE POLICY snp_user_capabilities_read ON public.snp_user_capabilities
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.snp_actor_has_capability('accounts.manage')
  );

DROP POLICY IF EXISTS snp_workflow_audit_read ON public.snp_workflow_audit;
CREATE POLICY snp_workflow_audit_read ON public.snp_workflow_audit
  FOR SELECT TO authenticated USING (
    actor_id = auth.uid()
    OR public.snp_actor_has_capability('sonasp.workflow.read')
    OR public.snp_actor_has_capability('accounts.manage')
  );

DROP POLICY IF EXISTS snp_workflow_outbox_read ON public.snp_workflow_notification_outbox;
CREATE POLICY snp_workflow_outbox_read ON public.snp_workflow_notification_outbox
  FOR SELECT TO authenticated USING (
    public.snp_actor_has_capability('sonasp.workflow.read')
  );

REVOKE ALL ON TABLE public.snp_capability_catalog FROM public, anon;
REVOKE ALL ON TABLE public.snp_role_capabilities FROM public, anon;
REVOKE ALL ON TABLE public.snp_user_capabilities FROM public, anon;
REVOKE ALL ON TABLE public.snp_workflow_audit FROM public, anon;
REVOKE ALL ON TABLE public.snp_workflow_notification_outbox FROM public, anon;
GRANT SELECT ON public.snp_capability_catalog TO authenticated;
GRANT SELECT ON public.snp_role_capabilities TO authenticated;
GRANT SELECT ON public.snp_user_capabilities TO authenticated;
GRANT SELECT ON public.snp_workflow_audit TO authenticated;
GRANT SELECT ON public.snp_workflow_notification_outbox TO authenticated;

REVOKE ALL ON FUNCTION public.snp_actor_has_capability(text) FROM public;
REVOKE ALL ON FUNCTION public.snp_actor_capabilities() FROM public;
REVOKE ALL ON FUNCTION public.snp_require_capability(text) FROM public;
REVOKE ALL ON FUNCTION public.snp_est_agent_sonasp() FROM public;
REVOKE ALL ON FUNCTION public.snp_peut_valider() FROM public;
REVOKE ALL ON FUNCTION public.snp_peut_financer(text) FROM public;
REVOKE ALL ON FUNCTION public.snp_est_direction_lecture() FROM public;
REVOKE ALL ON FUNCTION public.snp_peut_gerer_sites_artisanaux() FROM public;
REVOKE ALL ON FUNCTION public.snp_record_workflow_event(text, uuid, text, text, text, text, text, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.snp_definir_capacite_utilisateur(uuid, text, boolean, text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_actor_has_capability(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_actor_capabilities() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_est_agent_sonasp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_peut_valider() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_peut_financer(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_est_direction_lecture() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_peut_gerer_sites_artisanaux() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_definir_capacite_utilisateur(uuid, text, boolean, text, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- Règlements : séparation stricte Préparation / Approbation / Finances
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_changer_statut_reglement(
  p_reglement_id uuid,
  p_statut text,
  p_motif text DEFAULT NULL
)
RETURNS TABLE (r_reglement_id uuid, r_statut text, r_montant_paye numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_r public.snp_reglements_achat%ROWTYPE;
  v_preuves integer;
  v_capability text;
BEGIN
  SELECT * INTO v_r
  FROM public.snp_reglements_achat
  WHERE id = p_reglement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Règlement introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (p_statut = ANY (public.snp_transitions_reglement(v_r.statut))) THEN
    RAISE EXCEPTION 'Transition interdite : un règlement % ne peut pas passer à %.',
      v_r.statut, p_statut USING ERRCODE = '22023';
  END IF;

  v_capability := CASE
    WHEN p_statut IN ('soumis', 'annule') THEN 'sonasp.prepare'
    WHEN p_statut IN ('valide', 'rejete') THEN 'sonasp.approve'
    WHEN p_statut IN ('en_execution', 'execute') THEN 'sonasp.finance.execute'
    WHEN p_statut = 'rapproche' THEN 'sonasp.finance.reconcile'
    ELSE NULL
  END;
  IF v_capability IS NULL THEN
    RAISE EXCEPTION 'Aucune capacité n’est définie pour la transition vers %.', p_statut
      USING ERRCODE = '22023';
  END IF;
  PERFORM public.snp_require_capability(v_capability);

  IF p_statut IN ('rejete', 'annule')
     AND (p_motif IS NULL OR length(trim(p_motif)) < 5) THEN
    RAISE EXCEPTION 'Un rejet ou une annulation doit être motivé.'
      USING ERRCODE = '22023';
  END IF;

  IF p_statut IN ('valide', 'rejete')
     AND auth.uid() IN (v_r.prepare_par, v_r.soumis_par) THEN
    RAISE EXCEPTION 'Séparation des fonctions : le préparateur ne peut ni approuver ni rejeter son règlement.'
      USING ERRCODE = '42501';
  END IF;
  IF p_statut IN ('en_execution', 'execute')
     AND auth.uid() IN (v_r.prepare_par, v_r.soumis_par, v_r.valide_par) THEN
    RAISE EXCEPTION 'Séparation des fonctions : l’exécutant doit être distinct du préparateur et de l’approbateur.'
      USING ERRCODE = '42501';
  END IF;
  IF p_statut = 'rapproche'
     AND auth.uid() IN (v_r.prepare_par, v_r.soumis_par, v_r.valide_par, v_r.execute_par) THEN
    RAISE EXCEPTION 'Séparation des fonctions : le rapprochement doit être réalisé par un autre acteur.'
      USING ERRCODE = '42501';
  END IF;

  IF p_statut = 'execute' THEN
    SELECT count(*) INTO v_preuves
    FROM public.snp_reglements_preuves
    WHERE reglement_id = p_reglement_id
      AND statut_verification <> 'rejetee';
    IF v_preuves = 0 THEN
      RAISE EXCEPTION 'Joignez une preuve bancaire avant de confirmer l’exécution.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.snp_reglements_achat
  SET statut = p_statut,
      motif_rejet = CASE WHEN p_statut IN ('rejete', 'annule') THEN trim(p_motif) ELSE motif_rejet END,
      soumis_par = CASE WHEN p_statut = 'soumis' THEN auth.uid() ELSE soumis_par END,
      date_soumission = CASE WHEN p_statut = 'soumis' THEN now() ELSE date_soumission END,
      valide_par = CASE WHEN p_statut = 'valide' THEN auth.uid() ELSE valide_par END,
      date_validation = CASE WHEN p_statut = 'valide' THEN now() ELSE date_validation END,
      execute_par = CASE WHEN p_statut = 'execute' THEN auth.uid() ELSE execute_par END,
      date_execution = CASE WHEN p_statut = 'execute' THEN now() ELSE date_execution END,
      rapproche_par = CASE WHEN p_statut = 'rapproche' THEN auth.uid() ELSE rapproche_par END,
      date_rapprochement = CASE WHEN p_statut = 'rapproche' THEN now() ELSE date_rapprochement END
  WHERE id = p_reglement_id;

  PERFORM public.snp_record_workflow_event(
    'reglement-achat', p_reglement_id, 'status-changed', v_r.statut,
    p_statut, v_capability, p_motif,
    jsonb_build_object('mining_company_id', v_r.mining_company_id)
  );

  RETURN QUERY
  SELECT p_reglement_id, p_statut,
         COALESCE((
           SELECT sum(public.snp_facture_paye(af.facture_id))
           FROM public.snp_reglements_affectations af
           WHERE af.reglement_id = p_reglement_id AND af.statut = 'active'
         ), 0);
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_changer_statut_reglement(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_changer_statut_reglement(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.snp_actor_has_capability(text) IS
  'Autorité serveur unique : rôle historique, override individuel, MFA et compte actif.';
COMMENT ON TABLE public.snp_workflow_audit IS
  'Journal immuable des décisions et transitions sensibles.';
COMMENT ON TABLE public.snp_workflow_notification_outbox IS
  'Outbox idempotente destinée à l’envoi asynchrone des notifications métier.';
