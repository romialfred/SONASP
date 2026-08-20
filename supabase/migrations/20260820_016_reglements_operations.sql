-- ============================================================================
-- Règlements : éligibilité, préparation, cycle de validation
--
-- SÉPARATION DES FONCTIONS. Le préparateur n'est pas le validateur. La base le
-- vérifie. La règle s'assouplit s'il n'existe qu'un seul habilité — sinon aucun
-- règlement ne pourrait jamais être validé sur une petite installation.
--
-- DÉFAUT CORRIGÉ dans ce décompte : il portait d'abord sur `user_profiles`, où
-- deux profils sur trois n'ont **aucun compte `auth.users`**. Ils sont actifs à
-- l'écran mais personne ne peut s'y connecter : la règle croyait à trois
-- validateurs là où il n'y en a qu'un, et bloquait le seul administrateur réel.
-- Le décompte joint désormais `auth.users` — un validateur qui ne peut pas se
-- connecter n'est pas un validateur.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sociétés éligibles au paiement
--
-- Une société n'apparaît que si elle porte une dette réellement exigible. Une
-- facture annulée, soldée ou en brouillon ne rend personne éligible : proposer
-- une société sans dette invite à créer un paiement sans objet.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_societes_eligibles_paiement()
RETURNS TABLE (
  mining_company_id uuid, societe text, code text, devise text,
  nb_factures_ouvertes int, reste_du numeric, dette_echue numeric,
  plus_ancienne_facture text, plus_ancienne_echeance date, anciennete_jours int,
  nb_comptes_actifs int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH ouvertes AS (
    SELECT f.mining_company_id, f.devise, f.numero_facture, f.date_echeance,
           snp_facture_reste_a_affecter(f.id) AS affectable,
           snp_facture_reste_du(f.id) AS reste
    FROM snp_factures_achat f
    WHERE f.statut NOT IN ('annulee', 'brouillon')
      AND snp_facture_reste_a_affecter(f.id) > 0.005
  )
  SELECT
    o.mining_company_id, mc.name, mc.code, o.devise,
    count(*)::int,
    round(sum(o.reste), 2),
    round(COALESCE(sum(o.reste) FILTER (WHERE o.date_echeance < CURRENT_DATE), 0), 2),
    (SELECT p.numero_facture FROM ouvertes p
      WHERE p.mining_company_id = o.mining_company_id AND p.devise = o.devise
      ORDER BY p.date_echeance, p.numero_facture LIMIT 1),
    min(o.date_echeance),
    GREATEST(0, CURRENT_DATE - min(o.date_echeance))::int,
    (SELECT count(*)::int FROM stakeholder_bank_accounts b
      WHERE b.stakeholder_type = 'mining_company'
        AND b.stakeholder_id = o.mining_company_id
        AND b.is_active
        AND b.account_currency = o.devise
        AND (b.valid_to IS NULL OR b.valid_to >= CURRENT_DATE))
  FROM ouvertes o
  JOIN mining_companies mc ON mc.id = o.mining_company_id
  GROUP BY o.mining_company_id, mc.name, mc.code, o.devise
  ORDER BY 6 DESC;
$fn$;

CREATE OR REPLACE FUNCTION snp_factures_eligibles(p_mining_company_id uuid, p_devise text DEFAULT 'XOF')
RETURNS TABLE (
  facture_id uuid, numero_facture text, achat_numero text,
  periode_debut date, periode_fin date, date_emission date, date_echeance date,
  montant_ttc numeric, montant_paye numeric, montant_engage numeric,
  reste_du numeric, reste_a_affecter numeric,
  anciennete_jours int, tranche text, statut text, statut_certification text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT
    f.id, f.numero_facture, a.numero_achat,
    f.periode_debut, f.periode_fin, f.date_emission, f.date_echeance,
    f.montant_ttc_fcfa, snp_facture_paye(f.id), snp_facture_engage(f.id),
    snp_facture_reste_du(f.id), snp_facture_reste_a_affecter(f.id),
    GREATEST(0, CURRENT_DATE - f.date_echeance)::int,
    CASE
      WHEN f.date_echeance >= CURRENT_DATE THEN 'non_echu'
      WHEN CURRENT_DATE - f.date_echeance <= 30 THEN 'j1_30'
      WHEN CURRENT_DATE - f.date_echeance <= 60 THEN 'j31_60'
      WHEN CURRENT_DATE - f.date_echeance <= 90 THEN 'j61_90'
      WHEN CURRENT_DATE - f.date_echeance <= 180 THEN 'j91_180'
      ELSE 'plus_180'
    END,
    f.statut, f.statut_certification
  FROM snp_factures_achat f
  LEFT JOIN snp_achats_mines a ON a.id = f.achat_id
  WHERE f.mining_company_id = p_mining_company_id
    AND f.devise = p_devise
    AND f.statut NOT IN ('annulee', 'brouillon')
    AND snp_facture_reste_a_affecter(f.id) > 0.005
  ORDER BY f.date_echeance, f.date_emission, f.numero_facture;
$fn$;

-- ---------------------------------------------------------------------------
-- Préparation d'un règlement, avec ses affectations, d'un seul bloc
--
-- Le compte bancaire vient obligatoirement de la fiche de la société : il n'est
-- pas saisi ici. Ses coordonnées sont recopiées dans le règlement — une
-- modification ultérieure de la fiche ne réécrira pas un ordre déjà émis.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_preparer_reglement(
  p_mining_company_id uuid,
  p_compte_bancaire_id uuid,
  p_montant numeric,
  p_affectations jsonb,
  p_date_execution_prevue date DEFAULT NULL,
  p_objet text DEFAULT NULL,
  p_reference_interne text DEFAULT NULL,
  p_observations text DEFAULT NULL)
RETURNS TABLE (r_reglement_id uuid, r_reference text, r_affecte numeric, r_non_affecte numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_id uuid; v_ref text; v_compte stakeholder_bank_accounts%ROWTYPE;
  v_ligne jsonb; v_total numeric := 0;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP prépare un règlement.';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant du règlement doit être strictement positif.';
  END IF;

  SELECT * INTO v_compte FROM stakeholder_bank_accounts WHERE id = p_compte_bancaire_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte bancaire introuvable. Renseignez-le sur la fiche de la société.';
  END IF;
  IF v_compte.stakeholder_type <> 'mining_company' OR v_compte.stakeholder_id <> p_mining_company_id THEN
    RAISE EXCEPTION 'Ce compte bancaire n''appartient pas à la société bénéficiaire.';
  END IF;
  IF NOT v_compte.is_active THEN
    RAISE EXCEPTION 'Ce compte bancaire est désactivé.';
  END IF;
  IF v_compte.valid_to IS NOT NULL AND v_compte.valid_to < CURRENT_DATE THEN
    RAISE EXCEPTION 'Les coordonnées de ce compte ont expiré le %.', v_compte.valid_to;
  END IF;

  IF p_reference_interne IS NOT NULL AND EXISTS (
    SELECT 1 FROM snp_reglements_achat
    WHERE reference_interne = p_reference_interne AND statut <> 'annule'
  ) THEN
    RAISE EXCEPTION 'La référence interne « % » est déjà utilisée.', p_reference_interne;
  END IF;

  v_ref := snp_numero_suivant('REG', extract(year FROM CURRENT_DATE)::int,
                              'snp_reglements_achat', 'reference_reglement');

  INSERT INTO snp_reglements_achat (
    reference_reglement, mining_company_id, date_reglement, montant_fcfa, devise,
    mode_reglement, compte_bancaire_id, banque, reference_bancaire,
    coordonnees_utilisees, objet, reference_interne, date_execution_prevue,
    observations, statut, prepare_par, date_preparation, created_by)
  VALUES (
    v_ref, p_mining_company_id, CURRENT_DATE, round(p_montant, 2), v_compte.account_currency,
    -- Les mines industrielles se règlent par virement. Aucun autre mode n'a
    -- cours pour des montants de cet ordre.
    'virement', p_compte_bancaire_id, v_compte.bank_name, NULL,
    jsonb_build_object(
      'banque', v_compte.bank_name, 'agence', v_compte.branch_name,
      'titulaire', COALESCE(v_compte.account_holder, v_compte.account_name),
      'numero_compte', v_compte.account_number, 'code_banque', v_compte.bank_code,
      'code_guichet', v_compte.branch_code, 'cle_rib', v_compte.rib_key,
      'swift', v_compte.swift_code, 'iban', v_compte.iban,
      'devise', v_compte.account_currency, 'pays', v_compte.bank_country,
      'fige_le', now()),
    p_objet, p_reference_interne, p_date_execution_prevue,
    p_observations, 'brouillon', auth.uid(), now(), auth.uid())
  RETURNING id INTO v_id;

  IF p_affectations IS NOT NULL THEN
    FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_affectations) LOOP
      INSERT INTO snp_reglements_affectations
        (reglement_id, facture_id, montant_affecte_fcfa, mode_affectation, affecte_par)
      VALUES (v_id, (v_ligne ->> 'facture_id')::uuid,
              round((v_ligne ->> 'montant')::numeric, 2), 'manuelle', auth.uid());
      v_total := v_total + round((v_ligne ->> 'montant')::numeric, 2);
    END LOOP;
  END IF;

  IF v_total > round(p_montant, 2) + 0.005 THEN
    RAISE EXCEPTION 'Le total affecté (%) dépasse le montant du règlement (%).', v_total, p_montant;
  END IF;

  RETURN QUERY SELECT v_id, v_ref, v_total, round(p_montant, 2) - v_total;
END $fn$;

-- ---------------------------------------------------------------------------
-- Transitions du cycle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_transitions_reglement(p_statut text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE p_statut
    WHEN 'brouillon'    THEN ARRAY['soumis', 'annule']
    WHEN 'soumis'       THEN ARRAY['valide', 'rejete', 'annule']
    WHEN 'valide'       THEN ARRAY['en_execution', 'rejete', 'annule']
    WHEN 'en_execution' THEN ARRAY['execute', 'rejete']
    WHEN 'execute'      THEN ARRAY['rapproche']
    ELSE ARRAY[]::text[]
  END;
$fn$;

CREATE OR REPLACE FUNCTION snp_changer_statut_reglement(
  p_reglement_id uuid, p_statut text, p_motif text DEFAULT NULL)
RETURNS TABLE (r_reglement_id uuid, r_statut text, r_montant_paye numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_r snp_reglements_achat%ROWTYPE;
  v_preuves int;
  v_validateurs int;
BEGIN
  SELECT * INTO v_r FROM snp_reglements_achat WHERE id = p_reglement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Règlement introuvable.'; END IF;

  IF NOT (p_statut = ANY (snp_transitions_reglement(v_r.statut))) THEN
    RAISE EXCEPTION 'Transition interdite : un règlement % ne peut pas passer à %.',
      v_r.statut, p_statut;
  END IF;

  IF p_statut = 'soumis' AND NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP soumet un règlement.';
  END IF;
  IF p_statut IN ('valide', 'en_execution', 'execute', 'rapproche', 'rejete')
     AND NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Vous n''êtes pas habilité à cette action sur un règlement.';
  END IF;

  -- Séparation des fonctions : on ne valide pas son propre ordre, sauf s'il
  -- n'existe qu'un seul habilité réellement en mesure de se connecter.
  IF p_statut = 'valide' AND v_r.prepare_par IS NOT NULL AND v_r.prepare_par = auth.uid() THEN
    SELECT count(*) INTO v_validateurs
    FROM user_profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.is_active AND p.mining_company_id IS NULL
      AND p.role IN ('owner', 'admin', 'management');

    IF v_validateurs > 1 THEN
      RAISE EXCEPTION 'Séparation des fonctions : le préparateur d''un règlement ne peut pas le valider.';
    END IF;
  END IF;

  IF p_statut IN ('rejete', 'annule') AND (p_motif IS NULL OR length(trim(p_motif)) < 5) THEN
    RAISE EXCEPTION 'Un rejet ou une annulation doit être motivé.';
  END IF;

  -- Une exécution s'atteste : sans pièce bancaire, elle n'est qu'une déclaration.
  IF p_statut = 'execute' THEN
    SELECT count(*) INTO v_preuves FROM snp_reglements_preuves
    WHERE reglement_id = p_reglement_id AND statut_verification <> 'rejetee';
    IF v_preuves = 0 THEN
      RAISE EXCEPTION 'Joignez la preuve bancaire (MT103, avis SWIFT, avis de débit) avant de confirmer l''exécution.';
    END IF;
  END IF;

  UPDATE snp_reglements_achat
  SET statut = p_statut,
      motif_rejet = CASE WHEN p_statut IN ('rejete', 'annule') THEN p_motif ELSE motif_rejet END,
      soumis_par = CASE WHEN p_statut = 'soumis' THEN auth.uid() ELSE soumis_par END,
      date_soumission = CASE WHEN p_statut = 'soumis' THEN now() ELSE date_soumission END,
      valide_par = CASE WHEN p_statut = 'valide' THEN auth.uid() ELSE valide_par END,
      date_validation = CASE WHEN p_statut = 'valide' THEN now() ELSE date_validation END,
      execute_par = CASE WHEN p_statut = 'execute' THEN auth.uid() ELSE execute_par END,
      date_execution = CASE WHEN p_statut = 'execute' THEN now() ELSE date_execution END,
      rapproche_par = CASE WHEN p_statut = 'rapproche' THEN auth.uid() ELSE rapproche_par END,
      date_rapprochement = CASE WHEN p_statut = 'rapproche' THEN now() ELSE date_rapprochement END
  WHERE id = p_reglement_id;

  RETURN QUERY
  SELECT p_reglement_id, p_statut,
         COALESCE((SELECT sum(snp_facture_paye(af.facture_id))
                   FROM snp_reglements_affectations af
                   WHERE af.reglement_id = p_reglement_id AND af.statut = 'active'), 0);
END $fn$;

REVOKE ALL ON FUNCTION snp_preparer_reglement(uuid, uuid, numeric, jsonb, date, text, text, text) FROM public;
REVOKE ALL ON FUNCTION snp_changer_statut_reglement(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_preparer_reglement(uuid, uuid, numeric, jsonb, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_changer_statut_reglement(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_societes_eligibles_paiement() TO authenticated;
GRANT EXECUTE ON FUNCTION snp_factures_eligibles(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_transitions_reglement(text) TO authenticated;
