-- ---------------------------------------------------------------------------
-- Notifications de la plateforme
--
-- Transposition du principe de Medicore. Deux tables :
--   snp_notifications             ce qui est adressé à un utilisateur ;
--   snp_notifications_livraisons  ce qui a été tenté sur chaque canal.
--
-- La séparation compte : une notification lue dans la plateforme et un courriel
-- parti sont deux faits distincts. Les confondre empêche de répondre à « le
-- courriel est-il parti ? » quand un destinataire dit ne rien avoir reçu.
--
-- Le courriel lui-même part de la fonction de bord `envoyer-courriel`. SONASP
-- n'a pas de serveur : un mot de passe SMTP placé dans le paquet du navigateur
-- serait lisible par n'importe quel visiteur.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS snp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'information',
  gravite text NOT NULL DEFAULT 'normale',
  titre text NOT NULL,
  message text NOT NULL,
  objet_domaine text,
  objet_id uuid,
  chemin text,
  faits jsonb,
  lue boolean NOT NULL DEFAULT false,
  lue_le timestamptz,
  cle_dedoublonnage text,
  emise_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_notification_type CHECK (type IN
    ('information', 'validation_attendue', 'decision', 'echeance', 'alerte',
     'paiement', 'securite')),
  CONSTRAINT snp_notification_gravite CHECK (gravite IN ('basse', 'normale', 'haute', 'urgente')),
  CONSTRAINT snp_notification_domaine CHECK (objet_domaine IS NULL OR objet_domaine IN
    ('contrat', 'requisition', 'analyse', 'plan_achat', 'demande_achat', 'reglement',
     'facture', 'stock', 'production', 'vente', 'compte'))
);

CREATE INDEX IF NOT EXISTS idx_snp_notifications_destinataire
  ON snp_notifications (destinataire_id, lue, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snp_notifications_objet
  ON snp_notifications (objet_domaine, objet_id);

-- La déduplication porte sur le destinataire : deux personnes peuvent recevoir
-- la même alerte, la même personne ne la reçoit pas deux fois.
CREATE UNIQUE INDEX IF NOT EXISTS idx_snp_notifications_dedoublonnage
  ON snp_notifications (destinataire_id, cle_dedoublonnage)
  WHERE cle_dedoublonnage IS NOT NULL;

CREATE TABLE IF NOT EXISTS snp_notifications_livraisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES snp_notifications(id) ON DELETE CASCADE,
  canal text NOT NULL,
  destinataire text NOT NULL,
  statut text NOT NULL DEFAULT 'en_attente',
  message_erreur text,
  tentatives integer NOT NULL DEFAULT 0,
  envoye_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_livraison_canal CHECK (canal IN ('plateforme', 'courriel', 'sms')),
  CONSTRAINT snp_livraison_statut CHECK (statut IN ('en_attente', 'envoye', 'echec', 'abandonne')),
  -- Un échec sans motif n'apprend rien à qui doit le corriger.
  CONSTRAINT snp_livraison_echec_motive CHECK (
    statut <> 'echec' OR (message_erreur IS NOT NULL AND length(trim(message_erreur)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_livraisons_notification
  ON snp_notifications_livraisons (notification_id);
CREATE INDEX IF NOT EXISTS idx_snp_livraisons_a_traiter
  ON snp_notifications_livraisons (statut, created_at) WHERE statut = 'en_attente';

DROP TRIGGER IF EXISTS trg_snp_livraisons_touch ON snp_notifications_livraisons;
CREATE TRIGGER trg_snp_livraisons_touch BEFORE UPDATE ON snp_notifications_livraisons
  FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at();

ALTER TABLE snp_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_notifications_livraisons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications lisibles par leur destinataire" ON snp_notifications;
CREATE POLICY "Notifications lisibles par leur destinataire" ON snp_notifications
  FOR SELECT USING (destinataire_id = auth.uid());

DROP POLICY IF EXISTS "Notifications marquees lues par leur destinataire" ON snp_notifications;
CREATE POLICY "Notifications marquees lues par leur destinataire" ON snp_notifications
  FOR UPDATE USING (destinataire_id = auth.uid()) WITH CHECK (destinataire_id = auth.uid());

-- L'émission passe par `snp_notifier`, jamais par une insertion directe.
DROP POLICY IF EXISTS "Notifications emises par la plateforme" ON snp_notifications;
CREATE POLICY "Notifications emises par la plateforme" ON snp_notifications
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Livraisons lisibles avec leur notification" ON snp_notifications_livraisons;
CREATE POLICY "Livraisons lisibles avec leur notification" ON snp_notifications_livraisons
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM snp_notifications n
    WHERE n.id = snp_notifications_livraisons.notification_id AND n.destinataire_id = auth.uid()
  ));


/* ═══════════════════════════════════════════════════ Configuration SMTP ══ */

CREATE TABLE IF NOT EXISTS snp_configuration_courriel (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hote text,
  port integer NOT NULL DEFAULT 465,
  securise boolean NOT NULL DEFAULT true,
  identifiant text,
  expediteur_courriel text,
  expediteur_nom text NOT NULL DEFAULT 'Administration SONASP',
  -- Secret : jamais exposé au client. Seule la fonction de bord le lit.
  mot_de_passe text,
  actif boolean NOT NULL DEFAULT true,
  derniere_verification timestamptz,
  derniere_erreur text,
  updated_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE snp_configuration_courriel FROM anon, authenticated;
ALTER TABLE snp_configuration_courriel ENABLE ROW LEVEL SECURITY;

INSERT INTO snp_configuration_courriel
  (id, hote, port, securise, identifiant, expediteur_courriel, expediteur_nom)
VALUES (1, 'mail.data-univers.com', 465, true, 'no-replay@data-univers.com',
        'no-replay@data-univers.com', 'Administration SONASP')
ON CONFLICT (id) DO UPDATE SET expediteur_nom = 'Administration SONASP';


CREATE OR REPLACE FUNCTION snp_configuration_courriel_lisible()
RETURNS TABLE (
  hote text, port integer, securise boolean, identifiant text,
  expediteur_courriel text, expediteur_nom text, actif boolean,
  mot_de_passe_defini boolean, derniere_verification timestamptz, derniere_erreur text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT hote, port, securise, identifiant, expediteur_courriel, expediteur_nom, actif,
         mot_de_passe IS NOT NULL AND length(mot_de_passe) > 0,
         derniere_verification, derniere_erreur
  FROM snp_configuration_courriel
  WHERE id = 1 AND snp_peut_valider();
$fn$;

REVOKE ALL ON FUNCTION snp_configuration_courriel_lisible() FROM public;
GRANT EXECUTE ON FUNCTION snp_configuration_courriel_lisible() TO authenticated;


-- Un mot de passe vide laisse l'existant en place : on peut corriger le serveur
-- sans avoir à ressaisir le secret.
CREATE OR REPLACE FUNCTION snp_regler_configuration_courriel(
  p_hote text, p_port integer, p_securise boolean, p_identifiant text,
  p_expediteur_courriel text, p_expediteur_nom text, p_actif boolean,
  p_mot_de_passe text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas de regler la messagerie de la plateforme.';
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
    hote = trim(p_hote), port = p_port, securise = COALESCE(p_securise, true),
    identifiant = trim(p_identifiant),
    expediteur_courriel = COALESCE(NULLIF(trim(p_expediteur_courriel), ''), trim(p_identifiant)),
    expediteur_nom = COALESCE(NULLIF(trim(p_expediteur_nom), ''), 'Administration SONASP'),
    actif = COALESCE(p_actif, true),
    mot_de_passe = CASE WHEN p_mot_de_passe IS NULL OR length(p_mot_de_passe) = 0
                     THEN mot_de_passe ELSE p_mot_de_passe END,
    updated_by = auth.uid(), updated_at = now()
  WHERE id = 1;
END $fn$;

REVOKE ALL ON FUNCTION snp_regler_configuration_courriel(text, integer, boolean, text, text, text, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_regler_configuration_courriel(text, integer, boolean, text, text, text, boolean, text) TO authenticated;


/* ═════════════════════════════════════════════ Émission et consultation ══ */

-- L'index de déduplication est partiel : PostgreSQL ne le retient pour un
-- ON CONFLICT que si la clause reprend son prédicat.
CREATE OR REPLACE FUNCTION snp_notifier(
  p_destinataire_id uuid, p_titre text, p_message text,
  p_type text DEFAULT 'information', p_gravite text DEFAULT 'normale',
  p_objet_domaine text DEFAULT NULL, p_objet_id uuid DEFAULT NULL,
  p_chemin text DEFAULT NULL, p_faits jsonb DEFAULT NULL,
  p_cle_dedoublonnage text DEFAULT NULL, p_par_courriel boolean DEFAULT true)
RETURNS snp_notifications
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  n snp_notifications%ROWTYPE;
  v_courriel text;
  v_actif boolean;
BEGIN
  IF p_destinataire_id IS NULL THEN
    RAISE EXCEPTION 'Une notification demande un destinataire.';
  END IF;
  IF p_titre IS NULL OR length(trim(p_titre)) = 0 THEN
    RAISE EXCEPTION 'Une notification demande un titre.';
  END IF;

  SELECT email, is_active INTO v_courriel, v_actif
  FROM user_profiles WHERE id = p_destinataire_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Destinataire introuvable.'; END IF;
  -- Notifier un compte désactivé encombre la boîte de quelqu'un qui n'a plus
  -- à agir : on s'arrête là, sans erreur.
  IF NOT COALESCE(v_actif, false) THEN RETURN NULL; END IF;

  INSERT INTO snp_notifications (
    destinataire_id, type, gravite, titre, message,
    objet_domaine, objet_id, chemin, faits, cle_dedoublonnage, emise_par)
  VALUES (
    p_destinataire_id, p_type, p_gravite, trim(p_titre), p_message,
    p_objet_domaine, p_objet_id, p_chemin, p_faits, p_cle_dedoublonnage, auth.uid())
  ON CONFLICT (destinataire_id, cle_dedoublonnage) WHERE cle_dedoublonnage IS NOT NULL
  DO NOTHING
  RETURNING * INTO n;

  IF n.id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO snp_notifications_livraisons (notification_id, canal, destinataire, statut, envoye_le)
  VALUES (n.id, 'plateforme', p_destinataire_id::text, 'envoye', now());

  IF p_par_courriel AND v_courriel IS NOT NULL AND length(trim(v_courriel)) > 0 THEN
    INSERT INTO snp_notifications_livraisons (notification_id, canal, destinataire, statut)
    VALUES (n.id, 'courriel', trim(v_courriel), 'en_attente');
  END IF;

  RETURN n;
END $fn$;

REVOKE ALL ON FUNCTION snp_notifier(uuid, text, text, text, text, text, uuid, text, jsonb, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION snp_notifier(uuid, text, text, text, text, text, uuid, text, jsonb, text, boolean) TO authenticated, service_role;


-- `ROW IS NOT NULL` n'est vrai que si TOUS les champs sont renseignés. Une
-- notification a pourtant des champs vides par nature : le test porte sur
-- l'identifiant, seul champ toujours présent.
CREATE OR REPLACE FUNCTION snp_notifier_roles(
  p_roles text[], p_titre text, p_message text,
  p_type text DEFAULT 'information', p_gravite text DEFAULT 'normale',
  p_objet_domaine text DEFAULT NULL, p_objet_id uuid DEFAULT NULL,
  p_chemin text DEFAULT NULL, p_faits jsonb DEFAULT NULL,
  p_cle_dedoublonnage text DEFAULT NULL, p_par_courriel boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  v_destinataire uuid;
  n snp_notifications%ROWTYPE;
  v_nombre int := 0;
BEGIN
  FOR v_destinataire IN
    -- Jointure sur `auth.users` : un profil sans compte ne peut pas se
    -- connecter, le notifier n'aurait pas de sens (A181).
    SELECT up.id FROM user_profiles up
    JOIN auth.users au ON au.id = up.id
    WHERE up.is_active AND up.mining_company_id IS NULL AND up.role = ANY (p_roles)
  LOOP
    SELECT * INTO n FROM snp_notifier(v_destinataire, p_titre, p_message, p_type, p_gravite,
                                      p_objet_domaine, p_objet_id, p_chemin, p_faits,
                                      p_cle_dedoublonnage, p_par_courriel);
    IF n.id IS NOT NULL THEN v_nombre := v_nombre + 1; END IF;
  END LOOP;
  RETURN v_nombre;
END $fn$;

REVOKE ALL ON FUNCTION snp_notifier_roles(text[], text, text, text, text, text, uuid, text, jsonb, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION snp_notifier_roles(text[], text, text, text, text, text, uuid, text, jsonb, text, boolean) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION snp_marquer_notifications_lues(p_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_nombre int;
BEGIN
  UPDATE snp_notifications SET lue = true, lue_le = COALESCE(lue_le, now())
  WHERE destinataire_id = auth.uid() AND NOT lue
    AND (p_ids IS NULL OR id = ANY (p_ids));
  GET DIAGNOSTICS v_nombre = ROW_COUNT;
  RETURN v_nombre;
END $fn$;

REVOKE ALL ON FUNCTION snp_marquer_notifications_lues(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION snp_marquer_notifications_lues(uuid[]) TO authenticated;


CREATE OR REPLACE FUNCTION snp_notifications_resume()
RETURNS TABLE (non_lues integer, urgentes integer, hautes integer, plus_ancienne timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT count(*)::int,
         count(*) FILTER (WHERE gravite = 'urgente')::int,
         count(*) FILTER (WHERE gravite = 'haute')::int,
         min(created_at)
  FROM snp_notifications WHERE destinataire_id = auth.uid() AND NOT lue;
$fn$;

REVOKE ALL ON FUNCTION snp_notifications_resume() FROM public;
GRANT EXECUTE ON FUNCTION snp_notifications_resume() TO authenticated;


-- File d'attente des courriels : réservée à la clé de service, elle expose des
-- adresses de courriel.
CREATE OR REPLACE FUNCTION snp_courriels_a_envoyer(p_limite integer DEFAULT 50)
RETURNS TABLE (
  livraison_id uuid, notification_id uuid, destinataire text,
  titre text, message text, gravite text, chemin text, faits jsonb, tentatives integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT l.id, n.id, l.destinataire, n.titre, n.message, n.gravite, n.chemin, n.faits, l.tentatives
  FROM snp_notifications_livraisons l
  JOIN snp_notifications n ON n.id = l.notification_id
  WHERE l.canal = 'courriel' AND l.statut = 'en_attente' AND l.tentatives < 3
  ORDER BY l.created_at
  LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 50), 200));
$fn$;

REVOKE ALL ON FUNCTION snp_courriels_a_envoyer(integer) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION snp_courriels_a_envoyer(integer) TO service_role;


-- Trois tentatives, puis abandon : une adresse fausse ne doit pas occuper la
-- file indéfiniment.
CREATE OR REPLACE FUNCTION snp_consigner_envoi_courriel(
  p_livraison_id uuid, p_reussi boolean, p_erreur text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  UPDATE snp_notifications_livraisons SET
    tentatives = tentatives + 1,
    statut = CASE WHEN p_reussi THEN 'envoye'
                  WHEN tentatives + 1 >= 3 THEN 'abandonne' ELSE 'echec' END,
    message_erreur = CASE WHEN p_reussi THEN NULL
      ELSE COALESCE(NULLIF(trim(COALESCE(p_erreur, '')), ''), 'echec d''envoi non detaille') END,
    envoye_le = CASE WHEN p_reussi THEN now() ELSE envoye_le END
  WHERE id = p_livraison_id;
END $fn$;

REVOKE ALL ON FUNCTION snp_consigner_envoi_courriel(uuid, boolean, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION snp_consigner_envoi_courriel(uuid, boolean, text) TO service_role;
