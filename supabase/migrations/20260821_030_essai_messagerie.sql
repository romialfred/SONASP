-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ESSAI REJOUABLE — PARAMÈTRES DE MESSAGERIE                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Quatorze contrôles sur le référentiel des jeux SMTP.
--
-- L'essai crée ses propres jeux, les éprouve, puis les retire — et remet en
-- service celui qui servait avant. La table revient exactement à son état de
-- départ, ce qui permet de le lancer en production sans couper les envois.
--
-- Il n'écrit ni ne lit aucun secret réel : les mots de passe employés sont des
-- chaînes d'essai, effacées avec les lignes.
--
--   SELECT * FROM snp_essai_messagerie();
--
-- Toute ligne dont `conforme` vaut false est une régression.

CREATE OR REPLACE FUNCTION snp_essai_messagerie()
RETURNS TABLE(etape text, obtenu text, attendu text, conforme boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_a uuid; v_b uuid;
  v_actif_initial uuid;
  v_texte text;
  v_nombre integer;
  v_bool boolean;
BEGIN
  SELECT uid INTO v_actif_initial FROM snp_configuration_courriel WHERE actif;

  /* -- 1. Creation ------------------------------------------------------- */
  v_a := snp_creer_configuration_courriel(
    'Essai A', 'smtp.essai.invalid', 465, true, 'a@essai.invalid',
    '', '', 'secret-essai-a', false);

  SELECT expediteur_nom INTO v_texte FROM snp_configuration_courriel WHERE uid = v_a;
  RETURN QUERY SELECT 'expediteur par defaut', v_texte, 'Administration SONASP',
                      v_texte = 'Administration SONASP';

  SELECT expediteur_courriel INTO v_texte FROM snp_configuration_courriel WHERE uid = v_a;
  RETURN QUERY SELECT 'adresse reprise de l''identifiant', v_texte, 'a@essai.invalid',
                      v_texte = 'a@essai.invalid';

  /* -- 2. Un second jeu s'ajoute (la colonne id heritee ne bloque plus) --- */
  v_b := snp_creer_configuration_courriel(
    'Essai B', 'smtp2.essai.invalid', 587, false, 'b@essai.invalid',
    'b@essai.invalid', 'Essai', 'secret-essai-b', false);
  RETURN QUERY SELECT 'second jeu accepte', (v_b IS NOT NULL)::text, 'true', v_b IS NOT NULL;

  /* -- 3. Le secret ne remonte jamais par la lecture ---------------------- */
  RETURN QUERY
  SELECT 'colonne mot_de_passe absente de la lecture',
         (EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'snp_configuration_courriel'
                    AND column_name = 'mot_de_passe'))::text
         || '/' ||
         (EXISTS (SELECT 1 FROM information_schema.routines r
                  JOIN information_schema.parameters p ON p.specific_name = r.specific_name
                  WHERE r.routine_name = 'snp_configurations_courriel'
                    AND p.parameter_name = 'mot_de_passe'))::text,
         'true/false',
         NOT EXISTS (SELECT 1 FROM information_schema.routines r
                     JOIN information_schema.parameters p ON p.specific_name = r.specific_name
                     WHERE r.routine_name = 'snp_configurations_courriel'
                       AND p.parameter_name = 'mot_de_passe');

  SELECT mot_de_passe_defini INTO v_bool FROM snp_configurations_courriel() WHERE uid = v_a;
  RETURN QUERY SELECT 'secret signale comme pose', v_bool::text, 'true', v_bool;

  /* -- 4. Activation : un seul jeu actif ---------------------------------- */
  PERFORM snp_activer_configuration_courriel(v_a);
  PERFORM snp_activer_configuration_courriel(v_b);
  SELECT count(*) INTO v_nombre FROM snp_configuration_courriel WHERE actif;
  RETURN QUERY SELECT 'un seul jeu actif apres deux activations',
                      v_nombre::text, '1', v_nombre = 1;

  SELECT uid::text INTO v_texte FROM snp_configuration_courriel WHERE actif;
  RETURN QUERY SELECT 'le dernier active est celui qui sert',
                      v_texte, v_b::text, v_texte = v_b::text;

  /* -- 5. La fonction de bord lit bien le jeu actif ----------------------- */
  SELECT identifiant INTO v_texte FROM snp_configuration_courriel_active();
  RETURN QUERY SELECT 'la fonction de bord lit le jeu actif',
                      COALESCE(v_texte, 'aucun'), 'b@essai.invalid',
                      v_texte = 'b@essai.invalid';

  /* -- 6. Un mot de passe vide conserve l'existant ------------------------ */
  PERFORM snp_modifier_configuration_courriel(
    v_a, 'Essai A renomme', 'smtp.essai.invalid', 465, true, 'a@essai.invalid',
    'a@essai.invalid', 'Administration SONASP', NULL);
  SELECT mot_de_passe INTO v_texte FROM snp_configuration_courriel WHERE uid = v_a;
  RETURN QUERY SELECT 'mot de passe vide = inchange',
                      v_texte, 'secret-essai-a', v_texte = 'secret-essai-a';

  /* -- 7. Un jeu sans secret ne peut pas etre mis en service -------------- */
  UPDATE snp_configuration_courriel SET mot_de_passe = NULL WHERE uid = v_a;
  BEGIN
    PERFORM snp_activer_configuration_courriel(v_a);
    RETURN QUERY SELECT 'jeu sans secret refuse a l''activation', 'accepte', 'refuse', false;
  EXCEPTION WHEN others THEN
    RETURN QUERY SELECT 'jeu sans secret refuse a l''activation', 'refuse', 'refuse', true;
  END;

  /* -- 8. Le jeu actif ne se supprime pas --------------------------------- */
  BEGIN
    PERFORM snp_supprimer_configuration_courriel(v_b);
    RETURN QUERY SELECT 'jeu actif protege de la suppression', 'supprime', 'refuse', false;
  EXCEPTION WHEN others THEN
    RETURN QUERY SELECT 'jeu actif protege de la suppression', 'refuse', 'refuse', true;
  END;

  /* -- 9. Un changement de serveur perime la derniere verification -------- */
  UPDATE snp_configuration_courriel
  SET derniere_verification = now(), mot_de_passe = 'secret-essai-a' WHERE uid = v_a;
  PERFORM snp_modifier_configuration_courriel(
    v_a, 'Essai A renomme', 'autre.essai.invalid', 465, true, 'a@essai.invalid',
    'a@essai.invalid', 'Administration SONASP', NULL);
  SELECT derniere_verification IS NULL INTO v_bool
  FROM snp_configuration_courriel WHERE uid = v_a;
  RETURN QUERY SELECT 'changement de serveur perime la verification',
                      v_bool::text, 'true', v_bool;

  /* -- 10. Remise en etat ------------------------------------------------- */
  PERFORM snp_desactiver_configuration_courriel(v_b);
  DELETE FROM snp_configuration_courriel WHERE uid IN (v_a, v_b);
  IF v_actif_initial IS NOT NULL THEN
    UPDATE snp_configuration_courriel SET actif = true WHERE uid = v_actif_initial;
  END IF;

  SELECT count(*) INTO v_nombre
  FROM snp_configuration_courriel WHERE uid IN (v_a, v_b);
  RETURN QUERY SELECT 'jeux d''essai retires', v_nombre::text, '0', v_nombre = 0;

  SELECT COALESCE((SELECT uid::text FROM snp_configuration_courriel WHERE actif), 'aucun')
  INTO v_texte;
  RETURN QUERY SELECT 'jeu initial remis en service',
                      v_texte, COALESCE(v_actif_initial::text, 'aucun'),
                      v_texte = COALESCE(v_actif_initial::text, 'aucun');
END $fn$;

REVOKE ALL ON FUNCTION snp_essai_messagerie() FROM PUBLIC, anon, authenticated;
