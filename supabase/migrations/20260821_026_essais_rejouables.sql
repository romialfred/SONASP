-- ---------------------------------------------------------------------------
-- Essais rejouables des modules contractuels
--
-- Les règles métier vivent en PL/pgSQL : les éprouver depuis le navigateur
-- n'aurait aucun sens. Cette fonction rejoue le parcours complet — contrat,
-- réquisition, analyse — et rend une ligne par contrôle, avec ce qui était
-- attendu et ce qui a été obtenu.
--
-- Elle nettoie derrière elle : les racines créées sont supprimées en fin de
-- parcours, et les cascades emportent le reste. Elle se rejoue donc autant de
-- fois qu'on veut, y compris en intégration continue.
--
--     SELECT * FROM snp_essai_modules_contractuels() WHERE NOT conforme;
--
-- Aucune ligne : les modules se comportent comme décrit. 33 contrôles couvrent
-- la numérotation, les transitions gardées, l'échéancier, le moteur de teneur,
-- le moteur de dépassement, le régime juridique des réquisitions, l'imputation
-- contractuelle, l'absence de double comptage et l'immuabilité des résultats
-- d'analyse.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION snp_essai_modules_contractuels()
RETURNS TABLE (etape text, obtenu text, attendu text, conforme boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_mine uuid; v_contrat uuid; v_req uuid; v_analyse uuid; v_res uuid;
  v_notif uuid; v_achat uuid;
  r record; e record;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Ces essais s''executent sous un compte agent de la SONASP.';
  END IF;

  SELECT id INTO v_mine FROM mining_companies WHERE is_active LIMIT 1;
  IF v_mine IS NULL THEN
    RAISE EXCEPTION 'Aucune societe miniere active : les essais ont besoin d''un partenaire.';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS essai_resultats (
    ordre serial, etape text, obtenu text, attendu text
  ) ON COMMIT DROP;
  DELETE FROM essai_resultats WHERE true;

  /* ---------------------------------------------------------- Contrat -- */

  INSERT INTO snp_contrats (intitule, partenaire_type, mining_company_id, date_debut, date_fin,
    quantite_totale, periodicite, teneur_reference_pct, teneur_minimale_pct,
    teneur_tolerance_pct, plafond_depassement_pct, created_by)
  VALUES ('Essai automatise', 'mine_industrielle', v_mine,
    CURRENT_DATE, (CURRENT_DATE + interval '5 months')::date,
    6000, 'mensuelle', 90, 85, 0.5, 10, auth.uid())
  RETURNING id INTO v_contrat;

  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Numerotation du contrat',
         CASE WHEN numero_contrat ~ '^CT-[0-9]{4}-[0-9]{4}$' THEN 'conforme' ELSE numero_contrat END,
         'conforme'
  FROM snp_contrats WHERE id = v_contrat;

  BEGIN
    PERFORM snp_changer_statut_contrat(v_contrat, 'actif');
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Activation depuis brouillon', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Activation depuis brouillon', 'refusee', 'refusee');
  END;

  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Echeancier compose', snp_generer_echeancier(v_contrat, false)::text, '6');

  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Somme de l echeancier', sum(quantite_prevue)::text, '6000.0000'
  FROM snp_contrats_echeancier WHERE contrat_id = v_contrat;

  BEGIN
    PERFORM snp_generer_echeancier(v_contrat, false);
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Recomposition sans ordre', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Recomposition sans ordre', 'refusee', 'refusee');
  END;

  SELECT * INTO r FROM snp_evaluer_teneur(v_contrat, 90, 89.6);
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Teneur, ecart 0,4 point', r.decision, 'acceptee');

  SELECT * INTO r FROM snp_evaluer_teneur(v_contrat, 90, 89);
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Teneur, ecart 1 point', r.decision, 'contre_analyse');

  SELECT * INTO r FROM snp_evaluer_teneur(v_contrat, 90, 88);
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Teneur, ecart 2 points', r.decision, 'laboratoire_independant');

  SELECT * INTO r FROM snp_evaluer_teneur(v_contrat, 90, 84);
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Teneur sous le minimum', r.decision, 'non_conformite');

  PERFORM snp_changer_statut_contrat(v_contrat, 'soumis');
  PERFORM snp_changer_statut_contrat(v_contrat, 'revue_juridique');
  PERFORM snp_changer_statut_contrat(v_contrat, 'validation_metier');
  PERFORM snp_changer_statut_contrat(v_contrat, 'validation_financiere');
  PERFORM snp_changer_statut_contrat(v_contrat, 'approuve');
  PERFORM snp_changer_statut_contrat(v_contrat, 'signe');
  UPDATE snp_contrats SET date_signature = CURRENT_DATE WHERE id = v_contrat;

  BEGIN
    PERFORM snp_changer_statut_contrat(v_contrat, 'actif');
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Activation sans contrat signe verse', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Activation sans contrat signe verse', 'refusee', 'refusee');
  END;

  INSERT INTO snp_contrats_documents (contrat_id, categorie, intitule, chemin, created_by)
  VALUES (v_contrat, 'contrat_signe', 'Contrat signe', 'essai/contrat.pdf', auth.uid());

  PERFORM snp_changer_statut_contrat(v_contrat, 'actif');
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Contrat actif', statut, 'actif' FROM snp_contrats WHERE id = v_contrat;

  SELECT * INTO r FROM snp_evaluer_depassement(v_contrat, CURRENT_DATE,
    (CURRENT_DATE + interval '29 days')::date, 1050);
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Depassement de 5 pourcent', r.decision, 'depassement_tolere');

  SELECT * INTO r FROM snp_evaluer_depassement(v_contrat, CURRENT_DATE,
    (CURRENT_DATE + interval '29 days')::date, 7000);
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Depassement au-dela du contrat', r.decision, 'avenant_requis');

  /* ------------------------------------------------------ Requisition -- */

  INSERT INTO snp_requisitions (objet, mining_company_id, type_requisition, quantite_oz,
    regime_juridique, contrat_id, periode_debut, periode_fin, created_by)
  VALUES ('Essai automatise', v_mine, 'partielle', 500, 'a_qualifier', v_contrat,
    CURRENT_DATE, (CURRENT_DATE + interval '29 days')::date, auth.uid())
  RETURNING id INTO v_req;

  PERFORM snp_changer_statut_requisition(v_req, 'verification_juridique');
  BEGIN
    PERFORM snp_changer_statut_requisition(v_req, 'validation_metier');
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Avancee sans fondement juridique', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Avancee sans fondement juridique', 'refusee', 'refusee');
  END;

  UPDATE snp_requisitions SET regime_juridique = 'accord_requis',
    autorite_origine = 'Presidence du Faso', nature_acte = 'Decret',
    reference_acte = 'essai', date_signature_acte = CURRENT_DATE
  WHERE id = v_req;

  PERFORM snp_changer_statut_requisition(v_req, 'validation_metier');
  PERFORM snp_changer_statut_requisition(v_req, 'validation_direction');

  BEGIN
    PERFORM snp_changer_statut_requisition(v_req, 'autorisee');
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Autorisation sans acte verse', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Autorisation sans acte verse', 'refusee', 'refusee');
  END;

  INSERT INTO snp_requisitions_documents (requisition_id, categorie, intitule, chemin, created_by)
  VALUES (v_req, 'acte_juridique', 'Decret', 'essai/decret.pdf', auth.uid());
  PERFORM snp_changer_statut_requisition(v_req, 'autorisee');

  SELECT id INTO v_notif FROM snp_notifier_requisition(v_req, 'courrier_officiel',
    'Direction generale', 'Requisition',
    'Texte integral de la notification, conserve en entier pour faire preuve.', NULL);

  PERFORM snp_accuser_reception_requisition(v_notif, 'Le directeur');

  -- Le point juridique : accuser réception ne vaut pas accord.
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Accuse de reception ne vaut pas accord',
         CASE WHEN accord_mine IS NULL THEN 'accord absent' ELSE 'accord pose' END,
         'accord absent'
  FROM snp_requisitions WHERE id = v_req;

  BEGIN
    PERFORM snp_changer_statut_requisition(v_req, 'executoire');
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Executoire sans accord sous regime accord_requis', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Executoire sans accord sous regime accord_requis', 'refusee', 'refusee');
  END;

  UPDATE snp_requisitions SET accord_mine = true, accord_recu_le = now() WHERE id = v_req;
  PERFORM snp_changer_statut_requisition(v_req, 'executoire');
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Requisition executoire', statut, 'executoire' FROM snp_requisitions WHERE id = v_req;

  BEGIN
    PERFORM snp_decider_imputation_requisition(v_req, 'partielle', v_contrat, NULL);
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Imputation partielle sans motif', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Imputation partielle sans motif', 'refusee', 'refusee');
  END;

  PERFORM snp_decider_imputation_requisition(v_req, 'partielle', v_contrat,
    'Trois cents onces viennent en deduction, le reste est exceptionnel.');

  INSERT INTO snp_requisitions_enlevements (requisition_id, poids_brut_g, tare_g, poids_net_g,
    quantite_constatee_oz, statut, constat_contradictoire, created_by)
  VALUES (v_req, 16000, 450, 15550, 500, 'realise', true, auth.uid());

  PERFORM snp_changer_statut_requisition(v_req, 'enlevement_planifie');
  PERFORM snp_changer_statut_requisition(v_req, 'en_cours_enlevement');
  PERFORM snp_changer_statut_requisition(v_req, 'collectee');
  PERFORM snp_changer_statut_requisition(v_req, 'en_analyse');
  PERFORM snp_changer_statut_requisition(v_req, 'acceptee');

  BEGIN
    PERFORM snp_convertir_requisition_en_achat(v_req, 3200000, NULL);
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Achat partiel sans quantite imputee', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Achat partiel sans quantite imputee', 'refusee', 'refusee');
  END;

  SELECT id INTO v_achat FROM snp_convertir_requisition_en_achat(v_req, 3200000, 300);

  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Origine de l achat', origine, 'requisition' FROM snp_achats_mines WHERE id = v_achat;

  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Quantite imputee au contrat', quantite_imputee_oz::text, '300.0000'
  FROM snp_achats_mines WHERE id = v_achat;

  -- Le garde-fou contre le double comptage.
  BEGIN
    PERFORM snp_convertir_requisition_en_achat(v_req, 3200000, 300);
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Second achat sur la meme requisition', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Second achat sur la meme requisition', 'refusee', 'refusee');
  END;

  SELECT * INTO e FROM snp_contrat_execution(v_contrat);
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Contrat, quantite livree', e.quantite_livree::text, '500.0000');
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Contrat, quantite imputee', e.quantite_imputee::text, '300.0000');
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Contrat, hors engagement', e.quantite_hors_contrat::text, '200.0000');
  INSERT INTO essai_resultats (etape, obtenu, attendu)
  VALUES ('Contrat, requisitionnee', e.quantite_requisitionnee::text, '500.0000');

  /* ---------------------------------------------------------- Analyse -- */

  INSERT INTO snp_analyses_teneur (mining_company_id, contrat_id, teneur_declaree_pct,
    numero_echantillon, date_prelevement, created_by)
  VALUES (v_mine, v_contrat, 90, 'ESSAI-001', CURRENT_DATE, auth.uid())
  RETURNING id INTO v_analyse;

  BEGIN
    PERFORM snp_trancher_teneur(v_analyse, 90, 'Justification suffisamment longue.');
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Arbitrage sans resultat', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Arbitrage sans resultat', 'refusee', 'refusee');
  END;

  SELECT id INTO v_res FROM snp_enregistrer_resultat_analyse(v_analyse, 'Laboratoire SONASP', 89,
    'Coupellation', 'CERT-ESSAI-1');

  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Analyse, ecart de 1 point', statut, 'contre_analyse_requise'
  FROM snp_analyses_teneur WHERE id = v_analyse;

  -- L'immuabilité : un résultat ne se réécrit ni ne s'efface isolément.
  BEGIN
    UPDATE snp_analyses_resultats SET teneur_pct = 95 WHERE id = v_res;
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Modification d un resultat', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Modification d un resultat', 'refusee', 'refusee');
  END;

  BEGIN
    DELETE FROM snp_analyses_resultats WHERE id = v_res;
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Suppression d un resultat', 'acceptee', 'refusee');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO essai_resultats (etape, obtenu, attendu)
    VALUES ('Suppression d un resultat', 'refusee', 'refusee');
  END;

  PERFORM snp_enregistrer_resultat_analyse(v_analyse, 'Laboratoire de controle', 89.4,
    'Fluorescence X', 'CERT-ESSAI-2');
  PERFORM snp_enregistrer_resultat_analyse(v_analyse, 'Laboratoire independant', 89.3,
    'Coupellation', 'CERT-ESSAI-3', NULL, NULL, true);

  PERFORM snp_trancher_teneur(v_analyse, 89.3,
    'Le laboratoire independant fait foi selon la clause de contre-expertise.');

  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Teneur arretee', teneur_retenue_pct::text, '89.300'
  FROM snp_analyses_teneur WHERE id = v_analyse;

  INSERT INTO essai_resultats (etape, obtenu, attendu)
  SELECT 'Resultats conserves', count(*)::text, '3'
  FROM snp_analyses_resultats WHERE analyse_id = v_analyse;

  /* -------------------------------------------------------- Nettoyage -- */

  DELETE FROM snp_achats_mines WHERE requisition_id = v_req;
  DELETE FROM snp_requisitions WHERE id = v_req;
  DELETE FROM snp_analyses_teneur WHERE id = v_analyse;
  DELETE FROM snp_contrats WHERE id = v_contrat;

  RETURN QUERY
  SELECT er.etape, er.obtenu, er.attendu, er.obtenu = er.attendu
  FROM essai_resultats er ORDER BY er.ordre;
END $fn$;

REVOKE ALL ON FUNCTION snp_essai_modules_contractuels() FROM public;
GRANT EXECUTE ON FUNCTION snp_essai_modules_contractuels() TO authenticated;

COMMENT ON FUNCTION snp_essai_modules_contractuels() IS
  'Rejoue le parcours contrat / requisition / analyse et rend un rapport de conformite. Nettoie derriere elle.';
