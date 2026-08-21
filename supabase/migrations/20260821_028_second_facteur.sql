-- ---------------------------------------------------------------------------
-- Deuxième facteur d'authentification (TOTP)
--
-- ══ CE QUI EXISTAIT, ET POURQUOI IL FALLAIT LE REMPLACER ══
--
-- `TwoFactorSetup.tsx` composait un secret avec `Math.random()`, l'enregistrait
-- en clair dans `user_profiles.two_factor_secret`, le transmettait à
-- `api.qrserver.com` pour fabriquer le QR code, et n'a jamais vérifié le code
-- saisi : six chiffres quelconques activaient la protection. `ActivateAccount`
-- portait le même défaut, avec un commentaire qui l'avouait.
--
-- Un tel dispositif ne protège rien et fait croire le contraire, ce qui est
-- pire que son absence.
--
-- ══ LE PRINCIPE RETENU ══
--
-- Le secret n'est jamais stocké ici : GoTrue le détient et le chiffre au repos
-- dans `auth.mfa_factors`. Cette migration ne conserve que l'état d'enrôlement.
--
-- ══ OÙ LA RÈGLE S'APPLIQUE ══
--
-- Medicore contrôle le niveau `aal` dans un intergiciel serveur. SONASP n'a pas
-- de serveur : le navigateur parle à PostgREST. La règle vit donc dans la base,
-- au seul endroit qu'aucun client ne contourne — `snp_est_agent_sonasp()`, déjà
-- traversée par toutes les politiques sensibles.
-- ---------------------------------------------------------------------------

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_reset_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_profiles.mfa_enrolled_at IS
  'Date d''enrolement TOTP confirme. NULL = enrolement a faire. Le secret est dans auth.mfa_factors.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_mfa_a_faire
  ON user_profiles (id) WHERE mfa_enrolled_at IS NULL;

UPDATE user_profiles
SET password_changed_at = COALESCE(password_changed_at, created_at, now())
WHERE password_changed_at IS NULL;

-- Le secret composé par l'ancien dispositif ne doit plus exister nulle part.
-- Aucune ligne n'en portait ; les colonnes partent, pour qu'on ne recommence
-- pas.
ALTER TABLE user_profiles DROP COLUMN IF EXISTS two_factor_secret;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS backup_codes;


-- GoTrue place `aal` dans le JWT et ne le porte à `aal2` qu'après un
-- `mfa.verify()` réussi. `auth.jwt()` rend la charge utile du jeton DÉJÀ
-- vérifié par PostgREST : la signature n'est pas à recontrôler ici.
CREATE OR REPLACE FUNCTION snp_aal()
RETURNS text LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT CASE WHEN COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2' THEN 'aal2' ELSE 'aal1' END;
$fn$;

COMMENT ON FUNCTION snp_aal() IS
  'Niveau d''assurance du jeton courant. En cas de doute, aal1 — jamais l''inverse.';


-- Un compte non enrôlé est autorisé en aal1 : c'est précisément l'état dans
-- lequel il doit pouvoir atteindre l'écran d'enrôlement.
CREATE OR REPLACE FUNCTION snp_mfa_satisfaite()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND mfa_enrolled_at IS NOT NULL
    ) THEN true
    ELSE snp_aal() = 'aal2'
  END;
$fn$;

REVOKE ALL ON FUNCTION snp_mfa_satisfaite() FROM public;
GRANT EXECUTE ON FUNCTION snp_mfa_satisfaite() TO authenticated;


-- Le point de passage. Un compte enrôlé dont la session n'a pas validé le
-- second facteur perd l'accès aux données, sans qu'aucun écran n'ait à y penser.
CREATE OR REPLACE FUNCTION snp_est_agent_sonasp()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_active AND mining_company_id IS NULL
  ) AND snp_mfa_satisfaite();
$fn$;


CREATE OR REPLACE FUNCTION snp_compter_facteurs_verifies(p_user_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp' AS $fn$
  SELECT count(*)::int FROM auth.mfa_factors f
  WHERE f.user_id = COALESCE(p_user_id, auth.uid())
    AND f.status = 'verified' AND f.factor_type = 'totp'
    -- On ne compte que pour soi, sauf habilitation d'administration.
    AND (COALESCE(p_user_id, auth.uid()) = auth.uid() OR snp_peut_valider());
$fn$;

REVOKE ALL ON FUNCTION snp_compter_facteurs_verifies(uuid) FROM public;
GRANT EXECUTE ON FUNCTION snp_compter_facteurs_verifies(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION snp_etat_mfa()
RETURNS TABLE (
  enrole boolean, enrole_le timestamptz, mot_de_passe_a_changer boolean,
  aal text, facteurs_verifies integer, etape_suivante text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  p user_profiles%ROWTYPE;
  v_aal text := snp_aal();
  v_facteurs int;
BEGIN
  SELECT * INTO p FROM user_profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    -- Profil illisible : on ne devine pas, on exige le parcours complet.
    RETURN QUERY SELECT false, NULL::timestamptz, true, v_aal, 0, 'enrolement';
    RETURN;
  END IF;

  v_facteurs := snp_compter_facteurs_verifies(NULL);

  RETURN QUERY SELECT
    p.mfa_enrolled_at IS NOT NULL, p.mfa_enrolled_at,
    COALESCE(p.must_change_password, false), v_aal, v_facteurs,
    CASE
      WHEN COALESCE(p.must_change_password, false) THEN 'mot_de_passe'
      WHEN p.mfa_enrolled_at IS NULL THEN 'enrolement'
      WHEN v_aal <> 'aal2' THEN 'verification'
      ELSE 'pret'
    END;
END $fn$;

REVOKE ALL ON FUNCTION snp_etat_mfa() FROM public;
GRANT EXECUTE ON FUNCTION snp_etat_mfa() TO authenticated;


-- Deux preuves indépendantes sont exigées : un facteur réellement vérifié dans
-- `auth.mfa_factors`, ET une session élevée à `aal2`. Le client ne peut forger
-- ni l'une ni l'autre.
CREATE OR REPLACE FUNCTION snp_confirmer_enrolement_mfa()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_facteurs int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Aucune session.'; END IF;

  IF snp_aal() <> 'aal2' THEN
    RAISE EXCEPTION 'Le code n''a pas ete valide : la session n''est pas elevee au second facteur.';
  END IF;

  v_facteurs := snp_compter_facteurs_verifies(NULL);
  IF v_facteurs = 0 THEN
    RAISE EXCEPTION 'Aucun facteur verifie n''est rattache a ce compte.';
  END IF;

  UPDATE user_profiles
  SET mfa_enrolled_at = COALESCE(mfa_enrolled_at, now()),
      two_factor_enabled = true, updated_at = now()
  WHERE id = auth.uid();

  INSERT INTO snp_achats_audit (objet, objet_id, action, valeurs_apres, acteur_id)
  VALUES ('user_profiles', auth.uid(), 'mfa_enrole',
          jsonb_build_object('facteurs_verifies', v_facteurs, 'enrole_le', now()), auth.uid());

  RETURN true;
END $fn$;

REVOKE ALL ON FUNCTION snp_confirmer_enrolement_mfa() FROM public;
GRANT EXECUTE ON FUNCTION snp_confirmer_enrolement_mfa() TO authenticated;


-- Réinitialisation par un administrateur, pour un porteur ayant perdu son
-- appareil. Il n'y a pas de codes de secours : un code conservé en clair
-- réintroduirait exactement le défaut qu'on vient de corriger.
CREATE OR REPLACE FUNCTION snp_reinitialiser_mfa(p_utilisateur_id uuid, p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp' AS $fn$
DECLARE v_supprimes int;
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas de reinitialiser un second facteur.';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN
    RAISE EXCEPTION 'La reinitialisation d''un second facteur demande un motif.';
  END IF;
  IF p_utilisateur_id = auth.uid() THEN
    RAISE EXCEPTION 'On ne reinitialise pas son propre second facteur : demandez a un autre administrateur.';
  END IF;

  DELETE FROM auth.mfa_factors WHERE user_id = p_utilisateur_id;
  GET DIAGNOSTICS v_supprimes = ROW_COUNT;

  UPDATE user_profiles
  SET mfa_enrolled_at = NULL, two_factor_enabled = false,
      mfa_reset_at = now(), mfa_reset_by = auth.uid(), updated_at = now()
  WHERE id = p_utilisateur_id;

  INSERT INTO snp_achats_audit (objet, objet_id, action, valeurs_apres, acteur_id)
  VALUES ('user_profiles', p_utilisateur_id, 'mfa_reinitialise',
          jsonb_build_object('facteurs_supprimes', v_supprimes, 'motif', trim(p_motif)), auth.uid());
END $fn$;

REVOKE ALL ON FUNCTION snp_reinitialiser_mfa(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_reinitialiser_mfa(uuid, text) TO authenticated;


-- Supervision : qui est protégé, qui ne l'est pas.
CREATE OR REPLACE FUNCTION snp_conformite_mfa()
RETURNS TABLE (
  utilisateur_id uuid, courriel text, nom text, role text, actif boolean,
  enrole_le timestamptz, facteurs_verifies integer,
  reinitialise_le timestamptz, protege boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp' AS $fn$
  SELECT up.id, up.email, up.full_name, up.role, up.is_active, up.mfa_enrolled_at,
         (SELECT count(*)::int FROM auth.mfa_factors f
           WHERE f.user_id = up.id AND f.status = 'verified'),
         up.mfa_reset_at, up.mfa_enrolled_at IS NOT NULL
  FROM user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE snp_peut_valider()
  ORDER BY up.mfa_enrolled_at NULLS FIRST, up.full_name;
$fn$;

REVOKE ALL ON FUNCTION snp_conformite_mfa() FROM public;
GRANT EXECUTE ON FUNCTION snp_conformite_mfa() TO authenticated;
