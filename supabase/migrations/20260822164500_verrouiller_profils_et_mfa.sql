-- ============================================================================
-- Barrières d'autorisation indispensables à tout accès métier
--
-- Cette migration est volontairement idempotente. Elle répare deux écarts
-- observés sur le schéma distant :
--   1. la migration MFA historique, mal horodatée, n'a pas été appliquée ;
--   2. un utilisateur pouvait modifier les colonnes sensibles de son profil.
--
-- Elle ne remplace pas les politiques de périmètre par société. Elle ajoute
-- une condition RESTRICTIVE : une politique métier existante ET cette barrière
-- doivent toutes deux autoriser l'opération.
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS batch_notifications boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.snp_aal()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE
    WHEN COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2' THEN 'aal2'
    ELSE 'aal1'
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_mfa_satisfaite()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT auth.uid() IS NOT NULL
    AND public.snp_aal() = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND is_active
        AND NOT COALESCE(must_change_password, false)
        AND mfa_enrolled_at IS NOT NULL
    );
$fn$;

COMMENT ON FUNCTION public.snp_mfa_satisfaite() IS
  'Exige un profil actif, un mot de passe personnel, un facteur TOTP enrôlé et un jeton aal2.';
REVOKE ALL ON FUNCTION public.snp_mfa_satisfaite() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_mfa_satisfaite() TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_role_utilisateur()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE WHEN public.snp_mfa_satisfaite() THEN (
    SELECT role FROM public.user_profiles WHERE id = auth.uid() AND is_active
  ) ELSE NULL END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_societe_utilisateur()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE WHEN public.snp_mfa_satisfaite() THEN (
    SELECT mining_company_id
    FROM public.user_profiles
    WHERE id = auth.uid() AND is_active
  ) ELSE NULL END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_est_agent_sonasp()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active
      AND mining_company_id IS NULL
      AND role IN ('owner', 'admin', 'management', 'manager', 'factory', 'airport', 'refinery')
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
DECLARE
  v_societe uuid;
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

REVOKE ALL ON FUNCTION public.snp_role_utilisateur() FROM public;
REVOKE ALL ON FUNCTION public.snp_societe_utilisateur() FROM public;
REVOKE ALL ON FUNCTION public.snp_est_agent_sonasp() FROM public;
REVOKE ALL ON FUNCTION public.snp_est_operateur_interne() FROM public;
REVOKE ALL ON FUNCTION public.snp_societe_compte_mine() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_role_utilisateur() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_societe_utilisateur() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_est_agent_sonasp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_est_operateur_interne() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_societe_compte_mine() TO authenticated;

-- Une mise à jour directe ne peut plus promouvoir un compte ni modifier son
-- rattachement. Les fonctions SECURITY DEFINER contrôlées et le service_role
-- conservent la possibilité d'administrer ces champs.
CREATE OR REPLACE FUNCTION public.protect_user_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Modification de profil non autorisée.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
    OR NEW.two_factor_enabled IS DISTINCT FROM OLD.two_factor_enabled
    OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
    OR NEW.last_login_ip IS DISTINCT FROM OLD.last_login_ip
    OR NEW.failed_login_attempts IS DISTINCT FROM OLD.failed_login_attempts
    OR NEW.locked_until IS DISTINCT FROM OLD.locked_until
    OR NEW.password_must_change IS DISTINCT FROM OLD.password_must_change
    OR NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at
    OR NEW.account_locked_until IS DISTINCT FROM OLD.account_locked_until
    OR NEW.invitation_id IS DISTINCT FROM OLD.invitation_id
    OR NEW.account_activated IS DISTINCT FROM OLD.account_activated
    OR NEW.activation_completed_at IS DISTINCT FROM OLD.activation_completed_at
    OR NEW.last_password_change IS DISTINCT FROM OLD.last_password_change
    OR NEW.password_expiry_days IS DISTINCT FROM OLD.password_expiry_days
    OR NEW.account_locked IS DISTINCT FROM OLD.account_locked
    OR NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at
    OR NEW.is_sales_approver IS DISTINCT FROM OLD.is_sales_approver
    OR NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id
    OR NEW.mfa_enrolled_at IS DISTINCT FROM OLD.mfa_enrolled_at
    OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
    OR NEW.mfa_reset_at IS DISTINCT FROM OLD.mfa_reset_at
    OR NEW.mfa_reset_by IS DISTINCT FROM OLD.mfa_reset_by
  THEN
    RAISE EXCEPTION 'Modification directe d''un attribut de sécurité interdite.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.protect_user_profile_privileges() FROM public;
DROP TRIGGER IF EXISTS trg_protect_user_profile_privileges ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profile_privileges
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_profile_privileges();

-- Le marqueur de première connexion est levé par la base uniquement après que
-- GoTrue a effectivement remplacé le secret. Une simple requête du navigateur
-- sur user_profiles ne peut donc pas contourner le changement de mot de passe.
CREATE OR REPLACE FUNCTION public.snp_consigner_changement_mot_de_passe_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    UPDATE public.user_profiles
    SET must_change_password = false,
        password_changed_at = now(),
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_consigner_changement_mot_de_passe_auth() FROM public;
DROP TRIGGER IF EXISTS trg_snp_changement_mot_de_passe ON auth.users;
CREATE TRIGGER trg_snp_changement_mot_de_passe
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.snp_consigner_changement_mot_de_passe_auth();

-- La date de connexion est une donnée serveur. Le compte ne peut écrire que
-- sa propre ligne et ne choisit ni l'identifiant ni la valeur enregistrée.
CREATE OR REPLACE FUNCTION public.snp_enregistrer_connexion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Aucune session authentifiée.' USING ERRCODE = '28000';
  END IF;

  UPDATE public.user_profiles
  SET last_login_at = now(),
      failed_login_attempts = 0,
      updated_at = now()
  WHERE id = auth.uid();
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_enregistrer_connexion() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_enregistrer_connexion() TO authenticated;

-- Les changements d'état d'un compte sont centralisés, autorisés en aal2,
-- protégés contre l'auto-verrouillage et consignés dans un journal immuable.
CREATE TABLE IF NOT EXISTS public.snp_comptes_audit (
  uid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acteur_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cible_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('activation', 'desactivation')),
  ancien_etat boolean NOT NULL,
  nouvel_etat boolean NOT NULL,
  motif text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snp_comptes_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.snp_comptes_audit FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.snp_comptes_audit TO authenticated;

DROP POLICY IF EXISTS snp_comptes_audit_lecture ON public.snp_comptes_audit;
CREATE POLICY snp_comptes_audit_lecture
  ON public.snp_comptes_audit FOR SELECT TO authenticated
  USING (public.snp_est_operateur_interne());

CREATE OR REPLACE FUNCTION public.snp_definir_statut_compte(
  p_utilisateur_id uuid,
  p_actif boolean,
  p_motif text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_acteur_role text;
  v_cible_role text;
  v_ancien_etat boolean;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Validez votre second facteur avant d’administrer un compte.'
      USING ERRCODE = '42501';
  END IF;
  IF p_utilisateur_id IS NULL OR p_actif IS NULL THEN
    RAISE EXCEPTION 'Compte ou état manquant.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Un motif explicite est obligatoire.' USING ERRCODE = '22023';
  END IF;
  IF p_utilisateur_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier l’état de votre propre compte.'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_acteur_role
  FROM public.user_profiles
  WHERE id = auth.uid() AND is_active AND mining_company_id IS NULL;
  IF v_acteur_role NOT IN ('owner', 'admin', 'management') THEN
    RAISE EXCEPTION 'Habilitation insuffisante.' USING ERRCODE = '42501';
  END IF;

  SELECT role, is_active INTO v_cible_role, v_ancien_etat
  FROM public.user_profiles
  WHERE id = p_utilisateur_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_cible_role = 'owner' AND v_acteur_role <> 'owner' THEN
    RAISE EXCEPTION 'Seul un propriétaire peut administrer un autre propriétaire.'
      USING ERRCODE = '42501';
  END IF;
  IF v_cible_role = 'owner' AND NOT p_actif AND (
    SELECT count(*) FROM public.user_profiles WHERE role = 'owner' AND is_active
  ) <= 1 THEN
    RAISE EXCEPTION 'Le dernier compte propriétaire actif ne peut pas être désactivé.'
      USING ERRCODE = '23514';
  END IF;
  IF v_ancien_etat = p_actif THEN RETURN; END IF;

  UPDATE public.user_profiles
  SET is_active = p_actif, updated_at = now()
  WHERE id = p_utilisateur_id;

  INSERT INTO public.snp_comptes_audit (
    acteur_id, cible_id, action, ancien_etat, nouvel_etat, motif
  ) VALUES (
    auth.uid(), p_utilisateur_id,
    CASE WHEN p_actif THEN 'activation' ELSE 'desactivation' END,
    v_ancien_etat, p_actif, trim(p_motif)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_definir_statut_compte(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_definir_statut_compte(uuid, boolean, text) TO authenticated;

-- Avant aal2, seules les données strictement nécessaires à l'activation du
-- compte restent accessibles, et uniquement pour le compte courant.
DROP POLICY IF EXISTS snp_mfa_profil_propre_ou_aal2 ON public.user_profiles;
CREATE POLICY snp_mfa_profil_propre_ou_aal2
  ON public.user_profiles AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (id = auth.uid() OR public.snp_mfa_satisfaite())
  WITH CHECK (id = auth.uid() OR public.snp_mfa_satisfaite());

DO $block$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      AND c.relname NOT IN (
        'user_profiles', 'user_site_assignments', 'password_history',
        'user_2fa_setup', 'user_acceptance_logs'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS snp_mfa_aal2_obligatoire ON public.%I',
      v_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY snp_mfa_aal2_obligatoire ON public.%I AS RESTRICTIVE ' ||
      'FOR ALL TO authenticated USING (public.snp_mfa_satisfaite()) ' ||
      'WITH CHECK (public.snp_mfa_satisfaite())',
      v_table.table_name
    );
  END LOOP;
END;
$block$;

-- Ces quatre tables participent à l'activation initiale. Leur accès en aal1
-- reste strictement borné au propriétaire de la ligne.
DO $block$
DECLARE
  v_table text;
  v_colonne text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'user_site_assignments', 'password_history',
    'user_2fa_setup', 'user_acceptance_logs'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN CONTINUE; END IF;
    v_colonne := CASE WHEN v_table = 'user_site_assignments' THEN 'user_id' ELSE 'user_id' END;
    EXECUTE format(
      'DROP POLICY IF EXISTS snp_mfa_proprietaire_ou_aal2 ON public.%I',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY snp_mfa_proprietaire_ou_aal2 ON public.%I AS RESTRICTIVE ' ||
      'FOR ALL TO authenticated USING (%I = auth.uid() OR public.snp_mfa_satisfaite()) ' ||
      'WITH CHECK (%I = auth.uid() OR public.snp_mfa_satisfaite())',
      v_table, v_colonne, v_colonne
    );
  END LOOP;
END;
$block$;

DROP POLICY IF EXISTS snp_mfa_aal2_obligatoire ON storage.objects;
CREATE POLICY snp_mfa_aal2_obligatoire
  ON storage.objects AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.snp_mfa_satisfaite())
  WITH CHECK (public.snp_mfa_satisfaite());
