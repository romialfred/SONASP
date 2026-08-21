-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PARAMÈTRES DE MESSAGERIE — DU RÉGLAGE UNIQUE AU RÉFÉRENTIEL             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ══ POURQUOI PLUSIEURS JEUX ══
--
-- La migration 027 posait un réglage unique (`id = 1`) : un seul serveur, écrit
-- une fois pour toutes. Cela suffit tant que rien ne change. Mais un serveur se
-- remplace, et la seule manœuvre possible était d'écraser le réglage en place —
-- donc de couper les envois pendant la saisie, sans possibilité de revenir en
-- arrière si le nouveau serveur refusait la connexion.
--
-- Ce référentiel garde plusieurs jeux et n'en fait servir qu'un. Le basculement
-- est instantané, et le jeu précédent reste là pour le retour en arrière.
--
-- ══ CE QUI GARANTIT QU'UN SEUL SERT ══
--
-- Un index unique partiel sur `actif`. Ce n'est pas une convention d'écran :
-- deux lignes actives sont refusées par la base, quel que soit le chemin
-- d'écriture. Les fonctions d'activation libèrent donc la place dans la même
-- transaction.
--
-- ══ OÙ VIT LE SECRET ══
--
-- Dans `mot_de_passe`, colonne d'une table dont tous les droits sont retirés à
-- `anon` et `authenticated`. Aucun compte d'application ne la lit, même avec
-- une session d'administrateur et un appel direct à PostgREST.
--
-- Deux fonctions seulement approchent le secret, et toutes deux sont réservées
-- à `service_role` :
--
--   snp_configuration_courriel_active()      la fonction de bord l'appelle pour
--                                            ouvrir la connexion SMTP ;
--   snp_consigner_verification_courriel(…)   elle y consigne le résultat.
--
-- Ce que l'écran d'administration lit — `snp_configurations_courriel()` — ne
-- comporte pas la colonne : le secret n'est pas masqué à l'affichage, il n'est
-- pas transmis. Il ne figure donc ni dans le code, ni dans le dépôt, ni dans
-- aucune page chargée par le navigateur.
--
-- Cette migration ne contient elle-même aucun secret : le mot de passe se pose
-- depuis l'écran d'administration, ou par `supabase secrets set`.

/* ══════════════════════════════ 1. La table ══════════════════════════════ */

ALTER TABLE snp_configuration_courriel
  ADD COLUMN IF NOT EXISTS uid uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS libelle text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  -- La date de pose du secret est portée à part : elle ne doit pas bouger
  -- quand on renomme un jeu ou qu'on corrige son port.
  ADD COLUMN IF NOT EXISTS mot_de_passe_modifie_le timestamptz;

UPDATE snp_configuration_courriel
SET libelle = COALESCE(libelle, 'Serveur principal')
WHERE libelle IS NULL;

UPDATE snp_configuration_courriel
SET mot_de_passe_modifie_le = COALESCE(updated_at, created_at)
WHERE mot_de_passe IS NOT NULL AND length(mot_de_passe) > 0
  AND mot_de_passe_modifie_le IS NULL;

ALTER TABLE snp_configuration_courriel ALTER COLUMN libelle SET NOT NULL;

DO $bloc$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'snp_configuration_libelle') THEN
    ALTER TABLE snp_configuration_courriel
      ADD CONSTRAINT snp_configuration_libelle CHECK (length(trim(libelle)) >= 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'snp_configuration_port') THEN
    ALTER TABLE snp_configuration_courriel
      ADD CONSTRAINT snp_configuration_port CHECK (port > 0 AND port <= 65535);
  END IF;
  -- La clé passe de `id = 1` à `uid`.
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'snp_configuration_courriel_pkey'
               AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)') THEN
    ALTER TABLE snp_configuration_courriel DROP CONSTRAINT snp_configuration_courriel_pkey;
    ALTER TABLE snp_configuration_courriel ADD PRIMARY KEY (uid);
  END IF;
END $bloc$;

-- `id smallint NOT NULL CHECK (id = 1)` était la clé du réglage unique. Tant
-- qu'elle subsistait, l'ajout d'un SECOND jeu échouait sur la contrainte, avec
-- un message que personne n'aurait su lire.
ALTER TABLE snp_configuration_courriel DROP COLUMN IF EXISTS id;

-- Un seul jeu actif. Garanti par la base, non par une règle d'écran.
CREATE UNIQUE INDEX IF NOT EXISTS idx_snp_configuration_courriel_actif
  ON snp_configuration_courriel (actif) WHERE actif;

REVOKE ALL ON TABLE snp_configuration_courriel FROM anon, authenticated;

/* ══════════════════════ 2. Lecture sans le secret ═══════════════════════ */

DROP FUNCTION IF EXISTS snp_configuration_courriel_lisible();

CREATE OR REPLACE FUNCTION snp_configurations_courriel()
RETURNS TABLE(
  uid uuid, libelle text, hote text, port integer, securise boolean,
  identifiant text, expediteur_courriel text, expediteur_nom text, actif boolean,
  mot_de_passe_defini boolean, mot_de_passe_modifie_le timestamptz,
  derniere_verification timestamptz, derniere_erreur text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT c.uid, c.libelle, c.hote, c.port, c.securise, c.identifiant,
         c.expediteur_courriel, c.expediteur_nom, c.actif,
         c.mot_de_passe IS NOT NULL AND length(c.mot_de_passe) > 0,
         c.mot_de_passe_modifie_le,
         c.derniere_verification, c.derniere_erreur, c.created_at
  FROM snp_configuration_courriel c
  WHERE snp_peut_valider()
  ORDER BY c.actif DESC, c.libelle;
$fn$;

REVOKE ALL ON FUNCTION snp_configurations_courriel() FROM public;
GRANT EXECUTE ON FUNCTION snp_configurations_courriel() TO authenticated;

/* ═════════════════════════════ 3. Écritures ═════════════════════════════ */

CREATE OR REPLACE FUNCTION snp_creer_configuration_courriel(
  p_libelle text, p_hote text, p_port integer, p_securise boolean,
  p_identifiant text, p_expediteur_courriel text, p_expediteur_nom text,
  p_mot_de_passe text, p_activer boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_uid uuid;
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas de regler la messagerie de la plateforme.';
  END IF;
  IF p_libelle IS NULL OR length(trim(p_libelle)) < 2 THEN
    RAISE EXCEPTION 'Donnez un nom a ce jeu de parametres.';
  END IF;
  IF p_hote IS NULL OR length(trim(p_hote)) = 0 THEN
    RAISE EXCEPTION 'Indiquez le serveur SMTP.';
  END IF;
  IF p_identifiant IS NULL OR length(trim(p_identifiant)) = 0 THEN
    RAISE EXCEPTION 'Indiquez l''identifiant de connexion au serveur.';
  END IF;
  IF p_port IS NULL OR p_port <= 0 OR p_port > 65535 THEN
    RAISE EXCEPTION 'Le port doit etre compris entre 1 et 65535.';
  END IF;
  -- Un jeu sans mot de passe ne servira jamais : autant le dire a la creation.
  IF p_mot_de_passe IS NULL OR length(p_mot_de_passe) = 0 THEN
    RAISE EXCEPTION 'Le mot de passe du serveur est necessaire.';
  END IF;

  -- L'index unique partiel interdit deux jeux actifs : on libere la place dans
  -- la meme transaction, sinon l'insertion echouerait sur l'index.
  IF p_activer THEN
    UPDATE snp_configuration_courriel SET actif = false WHERE actif;
  END IF;

  INSERT INTO snp_configuration_courriel (
    libelle, hote, port, securise, identifiant,
    expediteur_courriel, expediteur_nom, mot_de_passe, mot_de_passe_modifie_le,
    actif, created_by, updated_by)
  VALUES (
    trim(p_libelle), trim(p_hote), p_port, COALESCE(p_securise, true), trim(p_identifiant),
    COALESCE(NULLIF(trim(p_expediteur_courriel), ''), trim(p_identifiant)),
    COALESCE(NULLIF(trim(p_expediteur_nom), ''), 'Administration SONASP'),
    p_mot_de_passe, now(), COALESCE(p_activer, false), auth.uid(), auth.uid())
  RETURNING uid INTO v_uid;

  RETURN v_uid;
END $fn$;

CREATE OR REPLACE FUNCTION snp_modifier_configuration_courriel(
  p_uid uuid, p_libelle text, p_hote text, p_port integer, p_securise boolean,
  p_identifiant text, p_expediteur_courriel text, p_expediteur_nom text,
  p_mot_de_passe text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_secret_change boolean := p_mot_de_passe IS NOT NULL AND length(p_mot_de_passe) > 0;
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas de regler la messagerie de la plateforme.';
  END IF;
  IF p_libelle IS NULL OR length(trim(p_libelle)) < 2 THEN
    RAISE EXCEPTION 'Donnez un nom a ce jeu de parametres.';
  END IF;
  IF p_hote IS NULL OR length(trim(p_hote)) = 0 THEN
    RAISE EXCEPTION 'Indiquez le serveur SMTP.';
  END IF;
  IF p_identifiant IS NULL OR length(trim(p_identifiant)) = 0 THEN
    RAISE EXCEPTION 'Indiquez l''identifiant de connexion au serveur.';
  END IF;
  IF p_port IS NULL OR p_port <= 0 OR p_port > 65535 THEN
    RAISE EXCEPTION 'Le port doit etre compris entre 1 et 65535.';
  END IF;

  UPDATE snp_configuration_courriel SET
    libelle = trim(p_libelle),
    hote = trim(p_hote),
    port = p_port,
    securise = COALESCE(p_securise, true),
    identifiant = trim(p_identifiant),
    expediteur_courriel = COALESCE(NULLIF(trim(p_expediteur_courriel), ''), trim(p_identifiant)),
    expediteur_nom = COALESCE(NULLIF(trim(p_expediteur_nom), ''), 'Administration SONASP'),
    -- Un mot de passe vide vaut « ne change rien » : on corrige un serveur sans
    -- avoir a ressaisir le secret.
    mot_de_passe = CASE WHEN v_secret_change THEN p_mot_de_passe ELSE mot_de_passe END,
    mot_de_passe_modifie_le = CASE WHEN v_secret_change THEN now() ELSE mot_de_passe_modifie_le END,
    -- Les parametres ont change : la derniere verification ne vaut plus.
    derniere_verification = CASE
      WHEN hote IS DISTINCT FROM trim(p_hote) OR port IS DISTINCT FROM p_port
        OR identifiant IS DISTINCT FROM trim(p_identifiant) OR v_secret_change
      THEN NULL ELSE derniere_verification END,
    derniere_erreur = NULL,
    updated_by = auth.uid()
  WHERE uid = p_uid;

  IF NOT FOUND THEN RAISE EXCEPTION 'Jeu de parametres introuvable.'; END IF;
END $fn$;

CREATE OR REPLACE FUNCTION snp_activer_configuration_courriel(p_uid uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_secret boolean;
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas de regler la messagerie de la plateforme.';
  END IF;

  SELECT mot_de_passe IS NOT NULL AND length(mot_de_passe) > 0 INTO v_secret
  FROM snp_configuration_courriel WHERE uid = p_uid;

  IF v_secret IS NULL THEN RAISE EXCEPTION 'Jeu de parametres introuvable.'; END IF;
  -- Activer un jeu sans secret couperait les envois sans le dire.
  IF NOT v_secret THEN
    RAISE EXCEPTION 'Ce jeu n''a pas de mot de passe : il ne pourrait envoyer aucun message.';
  END IF;

  UPDATE snp_configuration_courriel SET actif = false, updated_by = auth.uid()
  WHERE actif AND uid <> p_uid;

  UPDATE snp_configuration_courriel SET actif = true, updated_by = auth.uid()
  WHERE uid = p_uid;
END $fn$;

CREATE OR REPLACE FUNCTION snp_desactiver_configuration_courriel(p_uid uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas de regler la messagerie de la plateforme.';
  END IF;

  UPDATE snp_configuration_courriel SET actif = false, updated_by = auth.uid()
  WHERE uid = p_uid;

  IF NOT FOUND THEN RAISE EXCEPTION 'Jeu de parametres introuvable.'; END IF;
END $fn$;

CREATE OR REPLACE FUNCTION snp_supprimer_configuration_courriel(p_uid uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_actif boolean;
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas de regler la messagerie de la plateforme.';
  END IF;

  SELECT actif INTO v_actif FROM snp_configuration_courriel WHERE uid = p_uid;
  IF v_actif IS NULL THEN RAISE EXCEPTION 'Jeu de parametres introuvable.'; END IF;
  -- Retirer le jeu qui sert couperait les envois d'un clic, sans avertissement.
  IF v_actif THEN
    RAISE EXCEPTION 'Ce jeu est actif : activez-en un autre, ou desactivez-le avant de le retirer.';
  END IF;

  DELETE FROM snp_configuration_courriel WHERE uid = p_uid;
END $fn$;

DROP FUNCTION IF EXISTS snp_regler_configuration_courriel(
  text, integer, boolean, text, text, text, boolean, text);

REVOKE ALL ON FUNCTION snp_creer_configuration_courriel(
  text, text, integer, boolean, text, text, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION snp_creer_configuration_courriel(
  text, text, integer, boolean, text, text, text, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION snp_modifier_configuration_courriel(
  uuid, text, text, integer, boolean, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_modifier_configuration_courriel(
  uuid, text, text, integer, boolean, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION snp_activer_configuration_courriel(uuid) FROM public;
GRANT EXECUTE ON FUNCTION snp_activer_configuration_courriel(uuid) TO authenticated;
REVOKE ALL ON FUNCTION snp_desactiver_configuration_courriel(uuid) FROM public;
GRANT EXECUTE ON FUNCTION snp_desactiver_configuration_courriel(uuid) TO authenticated;
REVOKE ALL ON FUNCTION snp_supprimer_configuration_courriel(uuid) FROM public;
GRANT EXECUTE ON FUNCTION snp_supprimer_configuration_courriel(uuid) TO authenticated;

/* ═══════════════ 4. Ce que seule la fonction de bord approche ════════════ */

CREATE OR REPLACE FUNCTION snp_configuration_courriel_active()
RETURNS TABLE(
  uid uuid, hote text, port integer, securise boolean, identifiant text,
  mot_de_passe text, expediteur_courriel text, expediteur_nom text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn$
  -- Un jeu incomplet ne remonte pas : la fonction de bord retombe alors sur les
  -- variables d'environnement plutot que d'echouer a la connexion.
  SELECT c.uid, c.hote, c.port, c.securise, c.identifiant, c.mot_de_passe,
         c.expediteur_courriel, c.expediteur_nom
  FROM snp_configuration_courriel c
  WHERE c.actif
    AND c.hote IS NOT NULL AND c.identifiant IS NOT NULL
    AND c.mot_de_passe IS NOT NULL AND length(c.mot_de_passe) > 0
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION snp_consigner_verification_courriel(
  p_uid uuid, p_reussi boolean, p_erreur text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  UPDATE snp_configuration_courriel SET
    derniere_verification = now(),
    derniere_erreur = CASE WHEN p_reussi THEN NULL ELSE p_erreur END
  WHERE uid = p_uid;
END $fn$;

-- Ces deux-là seules approchent le secret : réservées au rôle de service.
REVOKE ALL ON FUNCTION snp_configuration_courriel_active() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION snp_configuration_courriel_active() TO service_role;
REVOKE ALL ON FUNCTION snp_consigner_verification_courriel(uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION snp_consigner_verification_courriel(uuid, boolean, text) TO service_role;
