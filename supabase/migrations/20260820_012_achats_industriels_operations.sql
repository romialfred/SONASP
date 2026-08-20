-- ============================================================================
-- Achats d'or industriel — opérations métier
--
-- Chaque opération sensible est une fonction : elle s'exécute d'un bloc, ou pas
-- du tout. Un enchaînement d'appels REST depuis le navigateur laisserait, à la
-- moindre coupure, une demande approuvée sans transaction ou une transaction
-- sans facture — et la dette de la SONASP disparaîtrait des écrans sans que
-- personne ne s'en aperçoive.
--
-- Les fonctions sont SECURITY DEFINER et vérifient elles-mêmes l'habilitation :
-- c'est le seul point de passage qu'un client ne peut pas contourner.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Habilitations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_role_utilisateur() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid() AND is_active;
$$;

CREATE OR REPLACE FUNCTION snp_societe_utilisateur() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT mining_company_id FROM user_profiles WHERE id = auth.uid() AND is_active;
$$;

-- Agent de la SONASP : tout profil actif non rattaché à une société minière.
CREATE OR REPLACE FUNCTION snp_est_agent_sonasp() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_active AND mining_company_id IS NULL);
$$;

CREATE OR REPLACE FUNCTION snp_peut_valider() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT snp_est_agent_sonasp()
     AND snp_role_utilisateur() IN ('owner', 'admin', 'management');
$$;

CREATE OR REPLACE FUNCTION snp_numero_suivant(p_prefixe text, p_annee int, p_table regclass, p_colonne text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_rang int;
  v_motif text := p_prefixe || '-' || p_annee || '-';
BEGIN
  EXECUTE format(
    'SELECT COALESCE(max(substring(%I from ''[0-9]+$'')::int), 0) + 1 FROM %s WHERE %I LIKE $1',
    p_colonne, p_table, p_colonne)
  INTO v_rang USING v_motif || '%';
  RETURN v_motif || lpad(v_rang::text, 4, '0');
END $$;

-- ---------------------------------------------------------------------------
-- Répartition d'un plan entre les mines
--
-- ASSIETTE D'ÉLIGIBILITÉ. Une première rédaction retenait la production
-- *validée* (statut « prêt pour la douane ») comme base, tout en déduisant des
-- engagements calculés, eux, sur la production *déclarée*. Comparer deux
-- assiettes différentes donnait mécaniquement un éligible nul : sur juillet
-- 2026, Essakane affichait 3 862 oz validées contre 4 889 oz engagées.
--
-- Règle retenue :  éligible = déclarée non annulée − déjà engagé
--
-- C'est le raisonnement du stock : la SONASP achète l'or détenu au coffre, et
-- le statut douanier ne conditionne pas la vente. On ne peut pas acheter deux
-- fois la même once ; c'est le seul plafond qui ait un sens. La production
-- validée reste calculée et affichée, à titre d'indicateur de maturité.
--
-- ARRONDIS. En mode « quantité nationale », le reliquat d'arrondi va à la plus
-- grosse ligne : sans cela, la somme des lignes ne retomberait pas exactement
-- sur la cible et l'écart, invisible, se propagerait jusqu'aux factures.
--
-- Les lignes déjà ajustées à la main sont préservées : un arbitrage individuel
-- ne s'efface pas au profit d'une règle globale.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_repartir_plan(p_plan_id uuid, p_ecraser_ajustements boolean DEFAULT false)
RETURNS TABLE (lignes_creees int, lignes_mises_a_jour int, lignes_preservees int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_plan snp_plans_achat%ROWTYPE;
  v_debut date; v_fin date;
  v_total_eligible numeric := 0; v_reste numeric;
  v_creees int := 0; v_maj int := 0; v_preservees int := 0;
  v_ligne record; v_quantite numeric; v_prix numeric;
  v_plus_grosse uuid; v_existait boolean;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut répartir un plan d''achat.';
  END IF;

  SELECT * INTO v_plan FROM snp_plans_achat WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan introuvable.'; END IF;
  IF v_plan.statut NOT IN ('brouillon', 'pret_soumission') THEN
    RAISE EXCEPTION 'Un plan % ne se répartit plus.', v_plan.statut;
  END IF;

  v_debut := make_date(v_plan.annee, v_plan.mois, 1);
  v_fin := (v_debut + interval '1 month - 1 day')::date;
  v_prix := COALESCE(v_plan.prix_once_global_fcfa, 0);

  CREATE TEMP TABLE IF NOT EXISTS eligible_tmp (
    mining_company_id uuid PRIMARY KEY,
    declaree numeric, validee numeric, engage numeric, eligible numeric, titre numeric
  ) ON COMMIT DROP;
  DELETE FROM eligible_tmp;

  INSERT INTO eligible_tmp
  SELECT
    mc.id,
    COALESCE(p.declaree, 0),
    COALESCE(p.validee, 0),
    COALESCE(e.engage, 0),
    GREATEST(0, COALESCE(p.declaree, 0) - COALESCE(e.engage, 0)),
    p.titre
  FROM mining_companies mc
  LEFT JOIN (
    SELECT dp.mining_company_id,
           sum(dp.estimated_oz) AS declaree,
           COALESCE(sum(dp.estimated_oz) FILTER (WHERE dp.status = 'ready_for_customs'), 0) AS validee,
           avg(dp.estimated_fineness_pct) AS titre
    FROM daily_production dp
    WHERE dp.production_date BETWEEN v_debut AND v_fin AND dp.status <> 'cancelled'
    GROUP BY dp.mining_company_id
  ) p ON p.mining_company_id = mc.id
  LEFT JOIN (
    SELECT a.mining_company_id, sum(a.quantite_oz) AS engage
    FROM snp_achats_mines a
    WHERE a.statut <> 'annulee' AND a.periode_debut <= v_fin AND a.periode_fin >= v_debut
    GROUP BY a.mining_company_id
  ) e ON e.mining_company_id = mc.id
  WHERE mc.is_active AND mc.company_type = 'production_mine';

  SELECT COALESCE(sum(eligible), 0) INTO v_total_eligible FROM eligible_tmp;

  FOR v_ligne IN SELECT * FROM eligible_tmp LOOP
    -- `INSERT ... ON CONFLICT DO UPDATE` laisse toujours FOUND à vrai : le
    -- comptage se fait sur l'existence préalable, non sur FOUND.
    SELECT EXISTS (
      SELECT 1 FROM snp_plans_achat_lignes
      WHERE plan_id = p_plan_id AND mining_company_id = v_ligne.mining_company_id
    ) INTO v_existait;

    IF NOT p_ecraser_ajustements AND EXISTS (
      SELECT 1 FROM snp_plans_achat_lignes
      WHERE plan_id = p_plan_id AND mining_company_id = v_ligne.mining_company_id
        AND ajustee_manuellement
    ) THEN
      v_preservees := v_preservees + 1;
      CONTINUE;
    END IF;

    v_quantite := CASE
      WHEN v_plan.mode_repartition = 'pourcentage'
        THEN round(v_ligne.eligible * COALESCE(v_plan.pourcentage_global, 0) / 100, 4)
      WHEN v_total_eligible > 0
        THEN round(v_plan.quantite_cible_oz * v_ligne.eligible / v_total_eligible, 4)
      ELSE 0
    END;

    INSERT INTO snp_plans_achat_lignes (
      plan_id, mining_company_id, periode_debut, periode_fin,
      production_declaree_oz, production_validee_oz, deja_engage_oz,
      production_eligible_oz, titre_moyen_pct,
      pourcentage_applique, quantite_proposee_oz, prix_once_fcfa, statut, ajustee_manuellement)
    VALUES (
      p_plan_id, v_ligne.mining_company_id, v_debut, v_fin,
      v_ligne.declaree, v_ligne.validee, v_ligne.engage, v_ligne.eligible, v_ligne.titre,
      CASE WHEN v_ligne.eligible > 0 THEN round(v_quantite * 100 / v_ligne.eligible, 4) END,
      v_quantite, v_prix, 'brouillon', false)
    ON CONFLICT (plan_id, mining_company_id) DO UPDATE
    SET production_declaree_oz = EXCLUDED.production_declaree_oz,
        production_validee_oz = EXCLUDED.production_validee_oz,
        deja_engage_oz = EXCLUDED.deja_engage_oz,
        production_eligible_oz = EXCLUDED.production_eligible_oz,
        titre_moyen_pct = EXCLUDED.titre_moyen_pct,
        pourcentage_applique = EXCLUDED.pourcentage_applique,
        quantite_proposee_oz = EXCLUDED.quantite_proposee_oz,
        prix_once_fcfa = EXCLUDED.prix_once_fcfa,
        ajustee_manuellement = false;

    IF v_existait THEN v_maj := v_maj + 1; ELSE v_creees := v_creees + 1; END IF;
  END LOOP;

  IF v_plan.mode_repartition = 'quantite_cible' AND v_total_eligible > 0 THEN
    SELECT v_plan.quantite_cible_oz - COALESCE(sum(quantite_proposee_oz), 0) INTO v_reste
    FROM snp_plans_achat_lignes WHERE plan_id = p_plan_id AND statut <> 'annulee';

    IF v_reste <> 0 THEN
      SELECT id INTO v_plus_grosse FROM snp_plans_achat_lignes
      WHERE plan_id = p_plan_id AND statut <> 'annulee' AND NOT ajustee_manuellement
      ORDER BY quantite_proposee_oz DESC LIMIT 1;

      IF v_plus_grosse IS NOT NULL THEN
        UPDATE snp_plans_achat_lignes
        SET quantite_proposee_oz = GREATEST(0, quantite_proposee_oz + v_reste)
        WHERE id = v_plus_grosse;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_creees, v_maj, v_preservees;
END $$;

-- ---------------------------------------------------------------------------
-- Soumission d'un plan : une demande par ligne retenue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_soumettre_plan(p_plan_id uuid)
RETURNS TABLE (demandes_creees int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_plan snp_plans_achat%ROWTYPE;
  v_ligne snp_plans_achat_lignes%ROWTYPE;
  v_nb int := 0; v_invalides int;
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Seule la direction de la SONASP peut soumettre un plan d''achat.';
  END IF;

  SELECT * INTO v_plan FROM snp_plans_achat WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan introuvable.'; END IF;
  IF v_plan.statut NOT IN ('brouillon', 'pret_soumission') THEN
    RAISE EXCEPTION 'Ce plan est déjà % : il ne se soumet pas deux fois.', v_plan.statut;
  END IF;

  -- Un plan ne part pas avec des lignes invalides : la mine recevrait une
  -- demande insoutenable et le refus serait mécanique.
  SELECT count(*) INTO v_invalides FROM snp_plans_achat_lignes
  WHERE plan_id = p_plan_id AND statut <> 'annulee' AND quantite_proposee_oz > 0
    AND (prix_once_fcfa <= 0 OR quantite_proposee_oz > production_eligible_oz + 0.0001);

  IF v_invalides > 0 THEN
    RAISE EXCEPTION '% ligne(s) dépassent la production éligible ou n''ont pas de prix.', v_invalides;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM snp_plans_achat_lignes
                 WHERE plan_id = p_plan_id AND statut <> 'annulee' AND quantite_proposee_oz > 0) THEN
    RAISE EXCEPTION 'Aucune ligne à soumettre : le plan ne demande rien.';
  END IF;

  FOR v_ligne IN
    SELECT * FROM snp_plans_achat_lignes
    WHERE plan_id = p_plan_id AND statut <> 'annulee' AND quantite_proposee_oz > 0
    ORDER BY quantite_proposee_oz DESC
  LOOP
    INSERT INTO snp_demandes_achat (
      numero_demande, plan_id, ligne_id, mining_company_id,
      periode_debut, periode_fin, production_reference_oz,
      quantite_demandee_oz, pourcentage_applique, titre_pct,
      cours_reference_usd, taux_usd_xof, prix_once_fcfa, devise,
      montant_estime_fcfa, date_limite_reponse, statut, date_soumission, created_by)
    VALUES (
      snp_numero_suivant('DA', v_plan.annee, 'snp_demandes_achat', 'numero_demande'),
      p_plan_id, v_ligne.id, v_ligne.mining_company_id,
      v_ligne.periode_debut, v_ligne.periode_fin, v_ligne.production_eligible_oz,
      v_ligne.quantite_proposee_oz, v_ligne.pourcentage_applique, v_ligne.titre_moyen_pct,
      v_ligne.cours_reference_usd, v_ligne.taux_usd_xof, v_ligne.prix_once_fcfa, v_plan.devise,
      v_ligne.montant_estime_fcfa, CURRENT_DATE + 7, 'soumise', now(), auth.uid())
    ON CONFLICT (ligne_id) DO NOTHING;

    IF FOUND THEN
      v_nb := v_nb + 1;
      UPDATE snp_plans_achat_lignes SET statut = 'soumise' WHERE id = v_ligne.id;
    END IF;
  END LOOP;

  UPDATE snp_plans_achat
  SET statut = 'soumis', date_soumission = now(), updated_by = auth.uid()
  WHERE id = p_plan_id;

  INSERT INTO snp_demandes_achat_historique (demande_id, action, statut_apres, acteur_id, acteur_role)
  SELECT id, 'soumission', 'soumise', auth.uid(), snp_role_utilisateur()
  FROM snp_demandes_achat WHERE plan_id = p_plan_id AND statut = 'soumise';

  RETURN QUERY SELECT v_nb;
END $$;

-- ---------------------------------------------------------------------------
-- Réponse de la mine — et, si elle approuve, transaction puis facture
--
-- Les trois écritures forment un tout.
--
-- NOMMAGE. Les colonnes de sortie sont préfixées `r_` : une première rédaction
-- nommait la sortie `demande_id`, homonyme de `snp_achats_mines.demande_id`, et
-- PL/pgSQL refusait la requête d'idempotence — « column reference is
-- ambiguous ». Toute approbation échouait.
--
-- IDEMPOTENCE. L'index unique sur `snp_achats_mines.demande_id` garantit qu'une
-- seconde approbation ne peut pas produire une seconde transaction : la
-- fonction renvoie alors les identifiants existants.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS snp_repondre_demande(uuid, text, text);

CREATE OR REPLACE FUNCTION snp_repondre_demande(
  p_demande_id uuid, p_decision text, p_motif text DEFAULT NULL)
RETURNS TABLE (r_demande_id uuid, r_achat_id uuid, r_facture_id uuid, r_numero_facture text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_d snp_demandes_achat%ROWTYPE;
  v_societe uuid; v_achat uuid; v_facture uuid; v_numero text;
  v_brut numeric; v_tva numeric; v_tdc numeric; v_ttc numeric;
  v_echeance date;
BEGIN
  IF p_decision NOT IN ('approuvee', 'rejetee', 'modification_demandee') THEN
    RAISE EXCEPTION 'Décision inconnue : %.', p_decision;
  END IF;

  SELECT * INTO v_d FROM snp_demandes_achat d WHERE d.id = p_demande_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable.'; END IF;

  -- Isolation : une mine ne répond que pour elle-même.
  v_societe := snp_societe_utilisateur();
  IF v_societe IS NOT NULL AND v_societe <> v_d.mining_company_id THEN
    RAISE EXCEPTION 'Cette demande ne concerne pas votre société.';
  END IF;
  IF v_societe IS NULL AND NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Vous n''êtes pas habilité à répondre à cette demande.';
  END IF;

  IF v_d.statut <> 'soumise' THEN
    RAISE EXCEPTION 'Cette demande est % : elle n''attend plus de réponse.', v_d.statut;
  END IF;

  IF p_decision IN ('rejetee', 'modification_demandee')
     AND (p_motif IS NULL OR length(trim(p_motif)) < 5) THEN
    RAISE EXCEPTION 'Un refus ou une demande de modification doit être motivé.';
  END IF;

  UPDATE snp_demandes_achat d
  SET statut = p_decision,
      motif_rejet = CASE WHEN p_decision = 'rejetee' THEN p_motif END,
      motif_modification = CASE WHEN p_decision = 'modification_demandee' THEN p_motif END,
      date_reponse = now(), repondu_par = auth.uid()
  WHERE d.id = p_demande_id;

  INSERT INTO snp_demandes_achat_historique
    (demande_id, action, statut_avant, statut_apres, motif, acteur_id, acteur_role)
  VALUES (p_demande_id, 'reponse', 'soumise', p_decision, p_motif, auth.uid(), snp_role_utilisateur());

  IF v_d.ligne_id IS NOT NULL THEN
    UPDATE snp_plans_achat_lignes l
    SET statut = CASE WHEN p_decision = 'approuvee' THEN 'approuvee'
                      WHEN p_decision = 'rejetee' THEN 'rejetee' ELSE l.statut END
    WHERE l.id = v_d.ligne_id;
  END IF;

  IF p_decision <> 'approuvee' THEN
    RETURN QUERY SELECT p_demande_id, NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT a.id INTO v_achat FROM snp_achats_mines a WHERE a.demande_id = p_demande_id;
  IF v_achat IS NOT NULL THEN
    SELECT f.id, f.numero_facture INTO v_facture, v_numero
    FROM snp_factures_achat f WHERE f.achat_id = v_achat AND f.statut <> 'annulee';
    RETURN QUERY SELECT p_demande_id, v_achat, v_facture, v_numero;
    RETURN;
  END IF;

  v_brut := round(v_d.quantite_demandee_oz * v_d.prix_once_fcfa, 2);
  v_tva := round(v_brut * 0.18, 2);
  v_tdc := round(v_brut * 0.01, 2);
  v_ttc := v_brut + v_tva + v_tdc;

  INSERT INTO snp_achats_mines (
    numero_achat, mining_company_id, demande_id, periode_debut, periode_fin, date_achat,
    quantite_oz, quantite_grammes, prix_once_fcfa, cours_once_usd, taux_usd_xof,
    montant_brut_fcfa, tva_taux, tva_montant_fcfa,
    taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_total_fcfa,
    statut, observations, created_by)
  VALUES (
    'ACH-' || to_char(v_d.periode_debut, 'YYYYMM') || '-' ||
      (SELECT mc.code FROM mining_companies mc WHERE mc.id = v_d.mining_company_id),
    v_d.mining_company_id, p_demande_id, v_d.periode_debut, v_d.periode_fin, CURRENT_DATE,
    v_d.quantite_demandee_oz, round(v_d.quantite_demandee_oz * 31.1034768, 3),
    v_d.prix_once_fcfa, v_d.cours_reference_usd, v_d.taux_usd_xof,
    v_brut, 18, v_tva, 1, v_tdc, v_ttc,
    'validee', 'Issu de la demande ' || v_d.numero_demande || '.', auth.uid())
  RETURNING id INTO v_achat;

  v_echeance := CURRENT_DATE + CASE v_d.conditions_paiement
    WHEN 'differe_30j' THEN 30 WHEN 'differe_60j' THEN 60
    WHEN 'differe_90j' THEN 90 WHEN 'echelonne' THEN 30 ELSE 0 END;

  v_numero := snp_numero_suivant('FA', extract(year FROM CURRENT_DATE)::int,
                                 'snp_factures_achat', 'numero_facture');

  INSERT INTO snp_factures_achat (
    numero_facture, achat_id, demande_id, mining_company_id,
    date_emission, periode_debut, periode_fin,
    quantite_oz, titre_pct, prix_once_fcfa,
    montant_ht_fcfa, tva_taux, tva_montant_fcfa,
    taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_ttc_fcfa,
    devise, conditions_paiement, date_echeance,
    statut, statut_certification, created_by)
  VALUES (
    v_numero, v_achat, p_demande_id, v_d.mining_company_id,
    CURRENT_DATE, v_d.periode_debut, v_d.periode_fin,
    v_d.quantite_demandee_oz, v_d.titre_pct, v_d.prix_once_fcfa,
    v_brut, 18, v_tva, 1, v_tdc, v_ttc,
    v_d.devise, v_d.conditions_paiement, v_echeance,
    'emise', 'en_attente', auth.uid())
  RETURNING id INTO v_facture;

  INSERT INTO snp_factures_achat_lignes
    (facture_id, rang, designation, quantite, unite, titre_pct, prix_unitaire_fcfa, montant_ht_fcfa)
  VALUES (
    v_facture, 1,
    'Or doré — production du ' || to_char(v_d.periode_debut, 'DD/MM/YYYY')
      || ' au ' || to_char(v_d.periode_fin, 'DD/MM/YYYY'),
    v_d.quantite_demandee_oz, v_d.unite, v_d.titre_pct, v_d.prix_once_fcfa, v_brut);

  RETURN QUERY SELECT p_demande_id, v_achat, v_facture, v_numero;
END $$;

-- ---------------------------------------------------------------------------
-- Enregistrer un règlement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_enregistrer_reglement(
  p_mining_company_id uuid, p_montant numeric, p_date date DEFAULT CURRENT_DATE,
  p_mode text DEFAULT 'virement', p_banque text DEFAULT NULL,
  p_reference_bancaire text DEFAULT NULL, p_observations text DEFAULT NULL,
  p_affecter_fifo boolean DEFAULT false)
RETURNS TABLE (reglement_id uuid, reference text, montant_affecte numeric, solde_non_affecte numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_ref text;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP enregistre un règlement.';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant d''un règlement doit être strictement positif.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mining_companies WHERE id = p_mining_company_id AND is_active) THEN
    RAISE EXCEPTION 'Société minière inconnue ou inactive.';
  END IF;

  -- Une même référence bancaire ne s'enregistre pas deux fois : c'est la
  -- protection ordinaire contre le double paiement.
  IF p_reference_bancaire IS NOT NULL AND EXISTS (
    SELECT 1 FROM snp_reglements_achat
    WHERE reference_bancaire = p_reference_bancaire AND statut <> 'annule'
  ) THEN
    RAISE EXCEPTION 'Un règlement porte déjà la référence bancaire %.', p_reference_bancaire;
  END IF;

  v_ref := snp_numero_suivant('REG', extract(year FROM p_date)::int,
                              'snp_reglements_achat', 'reference_reglement');

  INSERT INTO snp_reglements_achat (
    reference_reglement, mining_company_id, date_reglement, montant_fcfa,
    mode_reglement, banque, reference_bancaire, observations, statut, created_by)
  VALUES (v_ref, p_mining_company_id, p_date, round(p_montant, 2),
          p_mode, p_banque, p_reference_bancaire, p_observations, 'enregistre', auth.uid())
  RETURNING id INTO v_id;

  IF p_affecter_fifo THEN PERFORM snp_affecter_fifo(v_id); END IF;

  RETURN QUERY
  SELECT v_id, v_ref, r.montant_affecte_fcfa, snp_reglement_solde(v_id)
  FROM snp_reglements_achat r WHERE r.id = v_id;
END $$;

CREATE OR REPLACE FUNCTION snp_affecter_reglement(
  p_reglement_id uuid, p_facture_id uuid, p_montant numeric, p_observations text DEFAULT NULL)
RETURNS TABLE (affectation_id uuid, reste_facture numeric, solde_reglement numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP affecte un règlement.';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant affecté doit être strictement positif.';
  END IF;

  -- Les plafonds sont vérifiés par `snp_verifier_affectation`, sous verrou :
  -- le contrôle n'est pas dupliqué ici.
  INSERT INTO snp_reglements_affectations
    (reglement_id, facture_id, montant_affecte_fcfa, mode_affectation, affecte_par, observations)
  VALUES (p_reglement_id, p_facture_id, round(p_montant, 2), 'manuelle', auth.uid(), p_observations)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, snp_facture_reste_du(p_facture_id), snp_reglement_solde(p_reglement_id);
END $$;

-- Affectation automatique, de la facture la plus ancienne à la plus récente.
-- L'ordre retient l'échéance puis l'émission : deux factures échues le même jour
-- se règlent dans l'ordre où elles ont été émises.
CREATE OR REPLACE FUNCTION snp_affecter_fifo(p_reglement_id uuid)
RETURNS TABLE (factures_soldees int, montant_affecte numeric, solde_non_affecte numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reglement snp_reglements_achat%ROWTYPE;
  v_facture record; v_solde numeric; v_part numeric;
  v_total numeric := 0; v_nb int := 0;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP affecte un règlement.';
  END IF;

  SELECT * INTO v_reglement FROM snp_reglements_achat WHERE id = p_reglement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Règlement introuvable.'; END IF;
  IF v_reglement.statut IN ('rejete', 'annule') THEN
    RAISE EXCEPTION 'Ce règlement est % : il ne s''affecte plus.', v_reglement.statut;
  END IF;

  v_solde := snp_reglement_solde(p_reglement_id);

  FOR v_facture IN
    SELECT f.id, snp_facture_reste_du(f.id) AS reste
    FROM snp_factures_achat f
    WHERE f.mining_company_id = v_reglement.mining_company_id
      AND f.devise = v_reglement.devise
      AND f.statut NOT IN ('annulee', 'brouillon', 'contestee', 'suspendue')
    ORDER BY f.date_echeance, f.date_emission, f.numero_facture
  LOOP
    EXIT WHEN v_solde <= 0.005;
    CONTINUE WHEN v_facture.reste <= 0.005;

    v_part := LEAST(v_solde, v_facture.reste);

    INSERT INTO snp_reglements_affectations
      (reglement_id, facture_id, montant_affecte_fcfa, mode_affectation, affecte_par)
    VALUES (p_reglement_id, v_facture.id, round(v_part, 2), 'automatique_fifo', auth.uid())
    ON CONFLICT DO NOTHING;

    v_solde := v_solde - v_part;
    v_total := v_total + v_part;
    v_nb := v_nb + 1;
  END LOOP;

  RETURN QUERY SELECT v_nb, round(v_total, 2), snp_reglement_solde(p_reglement_id);
END $$;

-- L'affectation n'est jamais supprimée : elle passe à « annulée ». Effacer une
-- écriture financière ferait disparaître la question qu'elle pose.
CREATE OR REPLACE FUNCTION snp_annuler_affectation(p_affectation_id uuid, p_motif text)
RETURNS TABLE (affectation_id uuid, reste_facture numeric, solde_reglement numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_a snp_reglements_affectations%ROWTYPE;
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Seule la direction peut annuler une affectation.';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN
    RAISE EXCEPTION 'L''annulation d''une affectation doit être motivée.';
  END IF;

  SELECT * INTO v_a FROM snp_reglements_affectations WHERE id = p_affectation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Affectation introuvable.'; END IF;
  IF v_a.statut = 'annulee' THEN RAISE EXCEPTION 'Cette affectation est déjà annulée.'; END IF;

  UPDATE snp_reglements_affectations
  SET statut = 'annulee', motif_annulation = p_motif,
      annulee_par = auth.uid(), date_annulation = now()
  WHERE id = p_affectation_id;

  RETURN QUERY SELECT p_affectation_id, snp_facture_reste_du(v_a.facture_id),
                      snp_reglement_solde(v_a.reglement_id);
END $$;

-- ---------------------------------------------------------------------------
-- Balance âgée
--
-- L'ancienneté part de la date d'échéance. Les factures non échues forment une
-- tranche à part : les mêler aux retards ferait passer pour du retard ce qui
-- n'est qu'un délai contractuel.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_balance_agee(
  p_date date DEFAULT CURRENT_DATE, p_mining_company_id uuid DEFAULT NULL)
RETURNS TABLE (
  mining_company_id uuid, societe text, devise text,
  non_echu numeric, j1_30 numeric, j31_60 numeric, j61_90 numeric,
  j91_180 numeric, plus_180 numeric, total numeric,
  nb_factures int, plus_ancienne date, anciennete_moyenne numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH ouvertes AS (
    SELECT f.mining_company_id, mc.name AS societe, f.devise, f.date_echeance,
           snp_facture_reste_du(f.id) AS reste,
           GREATEST(0, p_date - f.date_echeance) AS jours
    FROM snp_factures_achat f
    JOIN mining_companies mc ON mc.id = f.mining_company_id
    WHERE f.statut NOT IN ('annulee', 'brouillon')
      AND (p_mining_company_id IS NULL OR f.mining_company_id = p_mining_company_id)
      AND snp_facture_reste_du(f.id) > 0.005
  )
  SELECT
    o.mining_company_id, o.societe, o.devise,
    round(sum(o.reste) FILTER (WHERE o.date_echeance >= p_date), 2),
    round(sum(o.reste) FILTER (WHERE o.jours BETWEEN 1 AND 30), 2),
    round(sum(o.reste) FILTER (WHERE o.jours BETWEEN 31 AND 60), 2),
    round(sum(o.reste) FILTER (WHERE o.jours BETWEEN 61 AND 90), 2),
    round(sum(o.reste) FILTER (WHERE o.jours BETWEEN 91 AND 180), 2),
    round(sum(o.reste) FILTER (WHERE o.jours > 180), 2),
    round(sum(o.reste), 2),
    count(*)::int, min(o.date_echeance), round(avg(o.jours), 1)
  FROM ouvertes o
  GROUP BY o.mining_company_id, o.societe, o.devise
  ORDER BY 10 DESC;
$$;

-- ---------------------------------------------------------------------------
-- Relevé de compte
--
-- Convention retenue, du point de vue de la SONASP qui est le débiteur : la
-- facture augmente la dette (crédit), le règlement la diminue (débit). Le solde
-- progressif se lit donc « ce que la SONASP doit encore ».
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_releve_societe(
  p_mining_company_id uuid, p_debut date DEFAULT NULL, p_fin date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  ligne_date date, type_operation text, reference text, libelle text,
  debit numeric, credit numeric, solde numeric, statut text, piece_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH mouvements AS (
    SELECT f.date_emission AS d, 'facture' AS t, f.numero_facture AS r,
           'Facture d''achat — ' || round(f.quantite_oz, 2) || ' oz' AS l,
           0::numeric AS deb, snp_facture_net_exigible(f.id) AS cred,
           f.statut AS s, f.id AS pid, 1 AS ordre
    FROM snp_factures_achat f
    WHERE f.mining_company_id = p_mining_company_id AND f.statut <> 'annulee'
    UNION ALL
    SELECT r.date_reglement, 'reglement', r.reference_reglement,
           'Règlement ' || r.mode_reglement, r.montant_fcfa, 0::numeric,
           r.statut, r.id, 2
    FROM snp_reglements_achat r
    WHERE r.mining_company_id = p_mining_company_id AND r.statut <> 'annule'
    UNION ALL
    SELECT a.date_avoir, 'avoir', a.numero_avoir, 'Avoir — ' || a.motif,
           a.montant_fcfa, 0::numeric, a.statut, a.id, 3
    FROM snp_avoirs_achat a
    WHERE a.mining_company_id = p_mining_company_id AND a.statut = 'applique'
  )
  SELECT d, t, r, l, round(deb, 2), round(cred, 2),
         round(sum(cred - deb) OVER (ORDER BY d, ordre, r
                                     ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2),
         s, pid
  FROM mouvements
  WHERE (p_debut IS NULL OR d >= p_debut) AND d <= p_fin
  ORDER BY d, ordre, r;
$$;

CREATE OR REPLACE FUNCTION snp_situation_societe(p_mining_company_id uuid)
RETURNS TABLE (
  facture_total numeric, facture_payee numeric, reste_du numeric,
  dette_echue numeric, nb_factures int, nb_ouvertes int, nb_echues int,
  plus_ancienne_echeance date, anciennete_moyenne numeric,
  reglements_total numeric, non_affecte numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH f AS (
    SELECT id, date_echeance,
           snp_facture_net_exigible(id) AS net,
           snp_facture_paye(id) AS paye,
           snp_facture_reste_du(id) AS reste
    FROM snp_factures_achat
    WHERE mining_company_id = p_mining_company_id AND statut NOT IN ('annulee', 'brouillon')
  ), r AS (
    SELECT COALESCE(sum(montant_fcfa), 0) AS total,
           COALESCE(sum(montant_fcfa - montant_affecte_fcfa), 0) AS libre
    FROM snp_reglements_achat
    WHERE mining_company_id = p_mining_company_id AND statut NOT IN ('annule', 'rejete')
  )
  SELECT
    round(COALESCE(sum(f.net), 0), 2),
    round(COALESCE(sum(f.paye), 0), 2),
    round(COALESCE(sum(f.reste), 0), 2),
    round(COALESCE(sum(f.reste) FILTER (WHERE f.date_echeance < CURRENT_DATE), 0), 2),
    count(*)::int,
    count(*) FILTER (WHERE f.reste > 0.005)::int,
    count(*) FILTER (WHERE f.reste > 0.005 AND f.date_echeance < CURRENT_DATE)::int,
    min(f.date_echeance) FILTER (WHERE f.reste > 0.005),
    round(avg(GREATEST(0, CURRENT_DATE - f.date_echeance)) FILTER (WHERE f.reste > 0.005), 1),
    (SELECT round(total, 2) FROM r),
    (SELECT round(libre, 2) FROM r)
  FROM f;
$$;
