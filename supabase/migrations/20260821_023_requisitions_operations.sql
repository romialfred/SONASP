-- ---------------------------------------------------------------------------
-- Réquisitions : numérotation, transitions, notification, imputation, achat
--
-- Suite de `20260821_022_requisitions_or.sql`.
--
-- Le point juridique se joue au passage à « exécutoire », et il ne se devine
-- pas : la pièce porte son régime, la fonction l'applique. Sous un régime
-- d'accord, l'accord doit exister ; sous un régime exécutoire, la notification
-- suffit et l'accord n'est pas demandé.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION snp_numeroter_requisition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF NEW.reference IS NULL OR length(trim(NEW.reference)) = 0 THEN
    NEW.reference := snp_numero_suivant('REQ',
      extract(year FROM COALESCE(NEW.date_effet, CURRENT_DATE))::int,
      'snp_requisitions'::regclass, 'reference');
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_snp_requisitions_numero ON snp_requisitions;
CREATE TRIGGER trg_snp_requisitions_numero BEFORE INSERT ON snp_requisitions
  FOR EACH ROW EXECUTE FUNCTION snp_numeroter_requisition();

CREATE OR REPLACE FUNCTION snp_numeroter_enlevement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF NEW.reference IS NULL OR length(trim(NEW.reference)) = 0 THEN
    NEW.reference := snp_numero_suivant('ENL', extract(year FROM CURRENT_DATE)::int,
      'snp_requisitions_enlevements'::regclass, 'reference');
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_snp_enlevements_numero ON snp_requisitions_enlevements;
CREATE TRIGGER trg_snp_enlevements_numero BEFORE INSERT ON snp_requisitions_enlevements
  FOR EACH ROW EXECUTE FUNCTION snp_numeroter_enlevement();


CREATE OR REPLACE FUNCTION snp_transitions_requisition(p_statut text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE p_statut
    WHEN 'brouillon' THEN ARRAY['verification_juridique', 'annulee']
    WHEN 'verification_juridique' THEN ARRAY['validation_metier', 'brouillon', 'annulee']
    WHEN 'validation_metier' THEN ARRAY['validation_direction', 'brouillon', 'annulee']
    WHEN 'validation_direction' THEN ARRAY['autorisee', 'brouillon', 'annulee']
    WHEN 'autorisee' THEN ARRAY['notifiee', 'suspendue', 'annulee']
    WHEN 'notifiee' THEN ARRAY['accusee', 'contestee', 'executoire', 'suspendue', 'annulee']
    WHEN 'accusee' THEN ARRAY['executoire', 'contestee', 'suspendue', 'annulee']
    WHEN 'contestee' THEN ARRAY['executoire', 'suspendue', 'annulee']
    WHEN 'executoire' THEN ARRAY['enlevement_planifie', 'suspendue', 'annulee']
    WHEN 'enlevement_planifie' THEN ARRAY['en_cours_enlevement', 'suspendue', 'annulee']
    WHEN 'en_cours_enlevement' THEN ARRAY['collectee', 'suspendue']
    WHEN 'collectee' THEN ARRAY['en_analyse', 'suspendue']
    WHEN 'en_analyse' THEN ARRAY['acceptee', 'suspendue']
    WHEN 'acceptee' THEN ARRAY['facturee', 'suspendue']
    WHEN 'facturee' THEN ARRAY['payee', 'suspendue']
    WHEN 'payee' THEN ARRAY['cloturee']
    WHEN 'suspendue' THEN ARRAY['executoire', 'annulee']
    ELSE ARRAY[]::text[]
  END;
$fn$;


-- La contrainte `snp_requisition_fondement` protège la donnée, mais son message
-- est celui de PostgreSQL. L'agent n'a pas à le lire : la fonction vérifie
-- d'abord, en français, et la contrainte reste en dernier recours.
CREATE OR REPLACE FUNCTION snp_changer_statut_requisition(
  p_requisition_id uuid, p_statut text, p_motif text DEFAULT NULL, p_commentaire text DEFAULT NULL)
RETURNS snp_requisitions LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  r snp_requisitions%ROWTYPE;
  v_avant text; v_actes int; v_notifs int; v_enlevements int; v_collecte numeric;
  v_manques text[] := ARRAY[]::text[];
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut faire evoluer une requisition.';
  END IF;

  SELECT * INTO r FROM snp_requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisition introuvable.'; END IF;
  v_avant := r.statut;

  IF NOT (p_statut = ANY (snp_transitions_requisition(v_avant))) THEN
    RAISE EXCEPTION 'Une requisition % ne peut pas passer a l''etat %.', v_avant, p_statut;
  END IF;

  IF p_statut IN ('suspendue', 'annulee', 'contestee')
     AND (p_motif IS NULL OR length(trim(p_motif)) < 5) THEN
    RAISE EXCEPTION 'Cette decision demande un motif d''au moins cinq caracteres.';
  END IF;

  IF p_statut IN ('autorisee', 'executoire') AND NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas cette decision.';
  END IF;

  IF p_statut NOT IN ('brouillon', 'verification_juridique', 'annulee') THEN
    IF r.reference_acte IS NULL OR length(trim(r.reference_acte)) = 0 THEN
      v_manques := array_append(v_manques, 'la reference de l''acte');
    END IF;
    IF r.nature_acte IS NULL OR length(trim(r.nature_acte)) = 0 THEN
      v_manques := array_append(v_manques, 'la nature de l''acte');
    END IF;
    IF r.autorite_origine IS NULL OR length(trim(r.autorite_origine)) = 0 THEN
      v_manques := array_append(v_manques, 'l''autorite a l''origine de la decision');
    END IF;
    IF r.regime_juridique = 'a_qualifier' THEN
      v_manques := array_append(v_manques, 'la qualification du regime juridique');
    END IF;
    IF array_length(v_manques, 1) > 0 THEN
      RAISE EXCEPTION 'Le fondement juridique est incomplet : il manque %.',
        array_to_string(v_manques, ', ');
    END IF;
  END IF;

  IF p_statut = 'autorisee' THEN
    SELECT count(*)::int INTO v_actes FROM snp_requisitions_documents
    WHERE requisition_id = p_requisition_id AND categorie = 'acte_juridique' AND statut = 'actif';
    IF v_actes = 0 THEN
      RAISE EXCEPTION 'L''acte juridique habilitant n''est pas verse au dossier.';
    END IF;
  END IF;

  IF p_statut = 'notifiee' THEN
    SELECT count(*)::int INTO v_notifs FROM snp_requisitions_notifications
    WHERE requisition_id = p_requisition_id;
    IF v_notifs = 0 THEN
      RAISE EXCEPTION 'Aucune notification n''est enregistree : consignez l''envoi avant de changer d''etat.';
    END IF;
  END IF;

  -- Le point juridique : sous un régime d'accord, l'accord doit exister ; sous
  -- un régime exécutoire, la notification suffit.
  IF p_statut = 'executoire' THEN
    IF r.regime_juridique = 'accord_requis' AND COALESCE(r.accord_mine, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Ce regime exige l''accord de la mine, qui n''est pas enregistre.';
    END IF;
    IF r.date_notification IS NULL THEN
      RAISE EXCEPTION 'La requisition n''a pas ete notifiee : elle ne peut pas devenir executoire.';
    END IF;
  END IF;

  IF p_statut = 'collectee' THEN
    SELECT count(*)::int, COALESCE(sum(quantite_constatee_oz), 0)
    INTO v_enlevements, v_collecte FROM snp_requisitions_enlevements
    WHERE requisition_id = p_requisition_id AND statut IN ('realise', 'partiel');
    IF v_enlevements = 0 OR v_collecte <= 0 THEN
      RAISE EXCEPTION 'Aucune quantite constatee : consignez l''enlevement avant de le declarer collecte.';
    END IF;
  END IF;

  UPDATE snp_requisitions SET
    statut = p_statut,
    motif_statut = CASE WHEN p_statut IN ('suspendue', 'annulee', 'contestee')
                     THEN p_motif ELSE motif_statut END,
    date_autorisation = CASE WHEN p_statut = 'autorisee' THEN now() ELSE date_autorisation END,
    autorisee_par = CASE WHEN p_statut = 'autorisee' THEN auth.uid() ELSE autorisee_par END,
    date_notification = CASE WHEN p_statut = 'notifiee' AND date_notification IS NULL
                          THEN now() ELSE date_notification END,
    date_executoire = CASE WHEN p_statut = 'executoire' AND date_executoire IS NULL
                        THEN now() ELSE date_executoire END,
    contestation_motif = CASE WHEN p_statut = 'contestee' THEN p_motif ELSE contestation_motif END,
    contestation_recue_le = CASE WHEN p_statut = 'contestee' AND contestation_recue_le IS NULL
                             THEN now() ELSE contestation_recue_le END,
    date_cloture = CASE WHEN p_statut = 'cloturee' THEN now() ELSE date_cloture END,
    updated_by = auth.uid()
  WHERE id = p_requisition_id
  RETURNING * INTO r;

  INSERT INTO snp_requisitions_historique
    (requisition_id, statut_avant, statut_apres, motif, commentaire, acteur_id)
  VALUES (p_requisition_id, v_avant, p_statut, p_motif, p_commentaire, auth.uid());

  RETURN r;
END $fn$;

REVOKE ALL ON FUNCTION snp_changer_statut_requisition(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_changer_statut_requisition(uuid, text, text, text) TO authenticated;


CREATE OR REPLACE FUNCTION snp_notifier_requisition(
  p_requisition_id uuid, p_canal text, p_destinataires text, p_objet text, p_contenu text,
  p_preuve_envoi text DEFAULT NULL, p_relance_de uuid DEFAULT NULL)
RETURNS snp_requisitions_notifications LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  r snp_requisitions%ROWTYPE;
  n snp_requisitions_notifications%ROWTYPE;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut notifier une requisition.';
  END IF;

  SELECT * INTO r FROM snp_requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisition introuvable.'; END IF;

  IF r.statut IN ('brouillon', 'verification_juridique', 'validation_metier', 'validation_direction') THEN
    RAISE EXCEPTION 'Une requisition non autorisee ne se notifie pas.';
  END IF;
  IF r.statut = 'annulee' THEN RAISE EXCEPTION 'Cette requisition est annulee.'; END IF;

  IF p_destinataires IS NULL OR length(trim(p_destinataires)) = 0 THEN
    RAISE EXCEPTION 'Indiquez au moins un destinataire.';
  END IF;
  IF p_contenu IS NULL OR length(trim(p_contenu)) < 20 THEN
    RAISE EXCEPTION 'Le contenu notifie doit etre conserve en entier.';
  END IF;

  INSERT INTO snp_requisitions_notifications
    (requisition_id, canal, destinataires, objet, contenu, envoye_par, preuve_envoi, relance_de)
  VALUES (p_requisition_id, p_canal, trim(p_destinataires), p_objet, p_contenu,
          auth.uid(), p_preuve_envoi, p_relance_de)
  RETURNING * INTO n;

  UPDATE snp_requisitions
  SET date_notification = COALESCE(date_notification, now()),
      statut = CASE WHEN statut = 'autorisee' THEN 'notifiee' ELSE statut END,
      updated_by = auth.uid()
  WHERE id = p_requisition_id;

  RETURN n;
END $fn$;

REVOKE ALL ON FUNCTION snp_notifier_requisition(uuid, text, text, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION snp_notifier_requisition(uuid, text, text, text, text, text, uuid) TO authenticated;


-- Accuser réception n'est ni accepter ni consentir : la fonction ne touche pas
-- à `accord_mine`.
CREATE OR REPLACE FUNCTION snp_accuser_reception_requisition(
  p_notification_id uuid, p_accuse_par text, p_preuve text DEFAULT NULL)
RETURNS snp_requisitions_notifications LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE n snp_requisitions_notifications%ROWTYPE;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut consigner un accuse de reception.';
  END IF;

  UPDATE snp_requisitions_notifications
  SET accuse_le = COALESCE(accuse_le, now()),
      accuse_par = p_accuse_par,
      preuve_reception = COALESCE(p_preuve, preuve_reception)
  WHERE id = p_notification_id
  RETURNING * INTO n;

  IF NOT FOUND THEN RAISE EXCEPTION 'Notification introuvable.'; END IF;

  UPDATE snp_requisitions
  SET accuse_reception_le = COALESCE(accuse_reception_le, now()),
      accuse_reception_par = COALESCE(accuse_reception_par, p_accuse_par),
      statut = CASE WHEN statut = 'notifiee' THEN 'accusee' ELSE statut END,
      updated_by = auth.uid()
  WHERE id = n.requisition_id;

  RETURN n;
END $fn$;

REVOKE ALL ON FUNCTION snp_accuser_reception_requisition(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_accuser_reception_requisition(uuid, text, text) TO authenticated;


-- Décision d'imputation contractuelle. Elle n'est jamais implicite : la règle,
-- le contrat, le motif et le décideur sont conservés.
CREATE OR REPLACE FUNCTION snp_decider_imputation_requisition(
  p_requisition_id uuid, p_imputation text, p_contrat_id uuid DEFAULT NULL,
  p_motif text DEFAULT NULL)
RETURNS snp_requisitions LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  r snp_requisitions%ROWTYPE;
  c snp_contrats%ROWTYPE;
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas de decider d''une imputation contractuelle.';
  END IF;

  IF p_imputation NOT IN ('totale', 'partielle', 'hors_contrat', 'periode_future', 'avenant', 'exclue') THEN
    RAISE EXCEPTION 'Regle d''imputation inconnue.';
  END IF;

  SELECT * INTO r FROM snp_requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisition introuvable.'; END IF;

  IF p_imputation NOT IN ('totale', 'hors_contrat')
     AND (p_motif IS NULL OR length(trim(p_motif)) < 5) THEN
    RAISE EXCEPTION 'Cette regle d''imputation demande une justification d''au moins cinq caracteres.';
  END IF;

  IF p_imputation <> 'hors_contrat' THEN
    IF p_contrat_id IS NULL THEN
      RAISE EXCEPTION 'Cette imputation demande le contrat sur lequel elle porte.';
    END IF;
    SELECT * INTO c FROM snp_contrats WHERE id = p_contrat_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contrat introuvable.'; END IF;
    IF c.mining_company_id IS DISTINCT FROM r.mining_company_id THEN
      RAISE EXCEPTION 'Ce contrat ne lie pas la societe visee par la requisition.';
    END IF;
    IF c.statut NOT IN ('actif', 'suspendu', 'echu') THEN
      RAISE EXCEPTION 'Un contrat % ne recoit pas d''imputation.', c.statut;
    END IF;
  END IF;

  UPDATE snp_requisitions SET
    imputation_contractuelle = p_imputation,
    contrat_id = CASE WHEN p_imputation = 'hors_contrat' THEN contrat_id ELSE p_contrat_id END,
    imputation_motif = p_motif,
    imputation_decidee_par = auth.uid(),
    imputation_decidee_le = now(),
    updated_by = auth.uid()
  WHERE id = p_requisition_id
  RETURNING * INTO r;

  RETURN r;
END $fn$;

REVOKE ALL ON FUNCTION snp_decider_imputation_requisition(uuid, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_decider_imputation_requisition(uuid, text, uuid, text) TO authenticated;


-- Conversion de la quantité collectée en achat.
--
-- L'achat est la seule source physique d'or acheté : c'est lui qui porte
-- l'origine et la quantité imputée au contrat. Une même once ne peut donc pas
-- être comptée à la fois comme livraison contractuelle et comme réquisition.
CREATE OR REPLACE FUNCTION snp_convertir_requisition_en_achat(
  p_requisition_id uuid, p_prix_once_fcfa numeric, p_quantite_imputee numeric DEFAULT NULL,
  p_observations text DEFAULT NULL, p_tva_taux numeric DEFAULT 18,
  p_taxe_dev_comm_taux numeric DEFAULT 1)
RETURNS snp_achats_mines LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  r snp_requisitions%ROWTYPE; a snp_achats_mines%ROWTYPE;
  v_collectee numeric; v_imputee numeric;
  v_brut numeric; v_tva numeric; v_tdc numeric;
  v_debut date; v_fin date;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut enregistrer cet achat.';
  END IF;

  SELECT * INTO r FROM snp_requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisition introuvable.'; END IF;

  IF r.statut NOT IN ('collectee', 'en_analyse', 'acceptee') THEN
    RAISE EXCEPTION 'La quantite doit etre collectee et acceptee avant d''etre achetee.';
  END IF;
  IF r.mining_company_id IS NULL THEN
    RAISE EXCEPTION 'Cette requisition ne vise pas une societe miniere identifiee.';
  END IF;
  -- Un seul achat par réquisition : c'est ce qui empêche le double comptage.
  IF EXISTS (SELECT 1 FROM snp_achats_mines
              WHERE requisition_id = p_requisition_id AND statut <> 'annulee') THEN
    RAISE EXCEPTION 'Un achat existe deja pour cette requisition.';
  END IF;
  IF NOT (p_prix_once_fcfa > 0) THEN
    RAISE EXCEPTION 'Le prix a l''once doit etre superieur a zero.';
  END IF;

  SELECT COALESCE(sum(quantite_constatee_oz), 0) INTO v_collectee
  FROM snp_requisitions_enlevements
  WHERE requisition_id = p_requisition_id AND statut IN ('realise', 'partiel');

  IF v_collectee <= 0 THEN
    RAISE EXCEPTION 'Aucune quantite constatee : il n''y a rien a acheter.';
  END IF;

  v_imputee := CASE COALESCE(r.imputation_contractuelle, 'hors_contrat')
    WHEN 'totale' THEN v_collectee
    WHEN 'partielle' THEN LEAST(COALESCE(p_quantite_imputee, 0), v_collectee)
    ELSE 0 END;

  IF COALESCE(r.imputation_contractuelle, '') = 'partielle'
     AND NOT (COALESCE(p_quantite_imputee, 0) > 0) THEN
    RAISE EXCEPTION 'Une imputation partielle demande la quantite exacte a imputer.';
  END IF;
  IF v_imputee > 0 AND r.contrat_id IS NULL THEN
    RAISE EXCEPTION 'Aucun contrat n''est rattache : l''imputation est impossible.';
  END IF;

  v_debut := COALESCE(r.periode_debut, date_trunc('month', COALESCE(r.date_effet, CURRENT_DATE))::date);
  v_fin := COALESCE(r.periode_fin, (date_trunc('month', v_debut) + interval '1 month - 1 day')::date);

  v_brut := round(v_collectee * p_prix_once_fcfa, 2);
  v_tva := round(v_brut * COALESCE(p_tva_taux, 0) / 100, 2);
  v_tdc := round(v_brut * COALESCE(p_taxe_dev_comm_taux, 0) / 100, 2);

  INSERT INTO snp_achats_mines (
    mining_company_id, periode_debut, periode_fin, date_achat,
    quantite_oz, quantite_grammes, prix_once_fcfa,
    montant_brut_fcfa, tva_taux, tva_montant_fcfa,
    taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_total_fcfa,
    statut, observations, created_by,
    contrat_id, requisition_id, origine,
    imputation_contractuelle, quantite_imputee_oz, imputation_motif,
    imputation_decidee_par, imputation_decidee_le)
  VALUES (
    r.mining_company_id, v_debut, v_fin, CURRENT_DATE,
    v_collectee, round(v_collectee * 31.1034768, 4), p_prix_once_fcfa,
    v_brut, COALESCE(p_tva_taux, 0), v_tva,
    COALESCE(p_taxe_dev_comm_taux, 0), v_tdc, v_brut + v_tva + v_tdc,
    'validee', COALESCE(p_observations, 'Achat issu de la requisition ' || r.reference),
    auth.uid(), r.contrat_id, p_requisition_id, 'requisition',
    r.imputation_contractuelle, v_imputee, r.imputation_motif,
    r.imputation_decidee_par, r.imputation_decidee_le)
  RETURNING * INTO a;

  RETURN a;
END $fn$;

REVOKE ALL ON FUNCTION snp_convertir_requisition_en_achat(uuid, numeric, numeric, text, numeric, numeric) FROM public;
GRANT EXECUTE ON FUNCTION snp_convertir_requisition_en_achat(uuid, numeric, numeric, text, numeric, numeric) TO authenticated;


-- Consolidation d'une réquisition. Comme pour les contrats, rien n'est stocké.
CREATE OR REPLACE FUNCTION snp_requisition_execution(p_requisition_id uuid)
RETURNS TABLE (
  quantite_requise numeric, quantite_collectee numeric, quantite_restante numeric,
  nb_enlevements integer, quantite_achetee numeric, quantite_imputee_contrat numeric,
  montant_achats_fcfa numeric, montant_facture_fcfa numeric,
  montant_paye_fcfa numeric, solde_a_payer_fcfa numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  WITH r AS (SELECT * FROM snp_requisitions WHERE id = p_requisition_id),
  enl AS (
    SELECT * FROM snp_requisitions_enlevements
    WHERE requisition_id = p_requisition_id AND statut IN ('realise', 'partiel')
  ),
  achats AS (
    SELECT * FROM snp_achats_mines
    WHERE requisition_id = p_requisition_id AND statut <> 'annulee'
  ),
  factures AS (
    SELECT f.id, f.montant_ttc_fcfa FROM snp_factures_achat f
    WHERE f.statut <> 'annulee' AND f.achat_id IN (SELECT id FROM achats)
  )
  SELECT
    COALESCE((SELECT quantite_oz FROM r), 0),
    COALESCE((SELECT sum(quantite_constatee_oz) FROM enl), 0),
    GREATEST(0, COALESCE((SELECT quantite_oz FROM r), 0)
                - COALESCE((SELECT sum(quantite_constatee_oz) FROM enl), 0)),
    (SELECT count(*)::int FROM enl),
    COALESCE((SELECT sum(quantite_oz) FROM achats), 0),
    COALESCE((SELECT sum(quantite_imputee_oz) FROM achats), 0),
    COALESCE((SELECT sum(montant_total_fcfa) FROM achats), 0),
    COALESCE((SELECT sum(montant_ttc_fcfa) FROM factures), 0),
    COALESCE((SELECT sum(snp_facture_paye(id)) FROM factures), 0),
    GREATEST(0, COALESCE((SELECT sum(montant_ttc_fcfa) FROM factures), 0)
                - COALESCE((SELECT sum(snp_facture_paye(id)) FROM factures), 0));
$fn$;

REVOKE ALL ON FUNCTION snp_requisition_execution(uuid) FROM public;
GRANT EXECUTE ON FUNCTION snp_requisition_execution(uuid) TO authenticated;
