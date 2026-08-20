-- ============================================================================
-- Engagé ≠ payé : un règlement en préparation retient sans éteindre
--
-- DÉFAUT CORRIGÉ. `snp_facture_paye` comptait toute affectation active, quel
-- que soit l'état du règlement. Un simple brouillon soldait donc une facture :
-- la balance âgée s'allégeait, le relevé montrait une dette éteinte, alors que
-- la banque n'avait rien exécuté.
--
-- Deux notions désormais distinctes :
--
--   engagé — affectations d'un règlement non rejeté ni annulé. Plafonne toute
--            nouvelle affectation. Sans ce plafond, deux paiements en
--            préparation pourraient chacun couvrir la même facture en entier,
--            et la solder deux fois à l'exécution.
--
--   payé   — affectations d'un règlement EXÉCUTÉ ou RAPPROCHÉ. Éteint la dette,
--            alimente la balance âgée et le relevé.
--
-- Le passage d'un règlement à « exécuté » recalcule ses factures : c'est à ce
-- moment, et à ce moment seulement, que la dette baisse.
--
-- Deux fonctions écrites avant cette distinction s'y adaptent :
--   • `snp_enregistrer_reglement` créait un règlement « enregistre », état qui
--     n'existe plus ; il crée un brouillon ;
--   • `snp_affecter_fifo` visait la dette comptable ; elle vise désormais le
--     reste imputable, sinon elle ré-imputerait des factures déjà couvertes par
--     un règlement en préparation et le garde-fou rejetterait l'opération sans
--     que l'utilisateur comprenne pourquoi.
-- ============================================================================

CREATE OR REPLACE FUNCTION snp_reglement_statuts_engageants() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT ARRAY['brouillon', 'soumis', 'valide', 'en_execution', 'execute', 'rapproche'];
$fn$;

CREATE OR REPLACE FUNCTION snp_reglement_statuts_payeurs() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT ARRAY['execute', 'rapproche'];
$fn$;

/** Ce qui est retenu sur une facture, exécuté ou seulement engagé. */
CREATE OR REPLACE FUNCTION snp_facture_engage(p_facture_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(sum(af.montant_affecte_fcfa), 0)
  FROM snp_reglements_affectations af
  JOIN snp_reglements_achat r ON r.id = af.reglement_id
  WHERE af.facture_id = p_facture_id AND af.statut = 'active'
    AND r.statut = ANY (snp_reglement_statuts_engageants());
$fn$;

/** Ce qui a réellement quitté la trésorerie. */
CREATE OR REPLACE FUNCTION snp_facture_paye(p_facture_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(sum(af.montant_affecte_fcfa), 0)
  FROM snp_reglements_affectations af
  JOIN snp_reglements_achat r ON r.id = af.reglement_id
  WHERE af.facture_id = p_facture_id AND af.statut = 'active'
    AND r.statut = ANY (snp_reglement_statuts_payeurs());
$fn$;

/** Ce qu'il reste possible d'affecter — plafond des nouvelles imputations. */
CREATE OR REPLACE FUNCTION snp_facture_reste_a_affecter(p_facture_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $fn$
  SELECT GREATEST(0, snp_facture_net_exigible(p_facture_id) - snp_facture_engage(p_facture_id));
$fn$;

/** Dette comptable : ce que la SONASP doit encore réellement. */
CREATE OR REPLACE FUNCTION snp_facture_reste_du(p_facture_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $fn$
  SELECT GREATEST(0, snp_facture_net_exigible(p_facture_id) - snp_facture_paye(p_facture_id));
$fn$;

-- Le garde-fou plafonne sur l'engagé, non sur le payé.
CREATE OR REPLACE FUNCTION snp_verifier_affectation() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_reglement snp_reglements_achat%ROWTYPE;
  v_facture snp_factures_achat%ROWTYPE;
  v_deja_reglement numeric; v_deja_facture numeric; v_net numeric;
BEGIN
  IF NEW.statut <> 'active' THEN RETURN NEW; END IF;

  SELECT * INTO v_reglement FROM snp_reglements_achat WHERE id = NEW.reglement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Règlement introuvable.'; END IF;
  IF v_reglement.statut IN ('rejete', 'annule') THEN
    RAISE EXCEPTION 'Ce règlement est % : il ne peut plus être affecté.', v_reglement.statut;
  END IF;
  -- Une fois l'ordre exécuté, sa répartition est arrêtée : la corriger
  -- supposerait de rappeler la banque.
  IF v_reglement.statut IN ('execute', 'rapproche') AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Ce règlement est déjà exécuté : sa répartition ne se modifie plus.';
  END IF;

  SELECT * INTO v_facture FROM snp_factures_achat WHERE id = NEW.facture_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facture introuvable.'; END IF;
  IF v_facture.statut = 'annulee' THEN
    RAISE EXCEPTION 'Une facture annulée ne reçoit pas de règlement.';
  END IF;
  IF v_facture.mining_company_id <> v_reglement.mining_company_id THEN
    RAISE EXCEPTION 'Le règlement et la facture ne concernent pas la même société minière.';
  END IF;
  IF v_facture.devise <> v_reglement.devise THEN
    RAISE EXCEPTION 'Devises différentes : facture en %, règlement en %.',
      v_facture.devise, v_reglement.devise;
  END IF;

  SELECT COALESCE(sum(montant_affecte_fcfa), 0) INTO v_deja_reglement
  FROM snp_reglements_affectations
  WHERE reglement_id = NEW.reglement_id AND statut = 'active'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_deja_reglement + NEW.montant_affecte_fcfa > v_reglement.montant_fcfa + 0.005 THEN
    RAISE EXCEPTION 'Affectation de % impossible : il ne reste que % sur ce règlement.',
      NEW.montant_affecte_fcfa, v_reglement.montant_fcfa - v_deja_reglement;
  END IF;

  -- Plafond de la facture : l'ENGAGÉ, qui compte aussi les règlements en
  -- préparation. C'est ce qui empêche deux paiements concurrents de solder
  -- deux fois la même dette.
  SELECT COALESCE(sum(af.montant_affecte_fcfa), 0) INTO v_deja_facture
  FROM snp_reglements_affectations af
  JOIN snp_reglements_achat r ON r.id = af.reglement_id
  WHERE af.facture_id = NEW.facture_id AND af.statut = 'active'
    AND r.statut = ANY (snp_reglement_statuts_engageants())
    AND (TG_OP = 'INSERT' OR af.id <> NEW.id);

  v_net := snp_facture_net_exigible(NEW.facture_id);

  IF v_deja_facture + NEW.montant_affecte_fcfa > v_net + 0.005 THEN
    RAISE EXCEPTION 'Affectation de % impossible : il ne reste que % à imputer sur cette facture (engagements en cours compris).',
      NEW.montant_affecte_fcfa, v_net - v_deja_facture;
  END IF;

  RETURN NEW;
END $fn$;

-- Un changement d'état du règlement déplace la frontière entre engagé et payé :
-- ses factures se recalculent.
CREATE OR REPLACE FUNCTION snp_repercuter_statut_reglement() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE v_facture uuid;
BEGIN
  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    FOR v_facture IN
      SELECT DISTINCT facture_id FROM snp_reglements_affectations
      WHERE reglement_id = NEW.id AND statut = 'active'
    LOOP
      PERFORM snp_recalculer_facture(v_facture);
    END LOOP;
  END IF;
  RETURN NULL;
END $fn$;

DROP TRIGGER IF EXISTS trg_reglement_statut_repercuter ON snp_reglements_achat;
CREATE TRIGGER trg_reglement_statut_repercuter
  AFTER UPDATE ON snp_reglements_achat
  FOR EACH ROW EXECUTE FUNCTION snp_repercuter_statut_reglement();

-- Le montant d'un règlement ne se modifie plus dès qu'il est sorti du brouillon.
CREATE OR REPLACE FUNCTION snp_proteger_reglement() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD.statut <> 'brouillon'
     AND NEW.montant_fcfa IS DISTINCT FROM OLD.montant_fcfa THEN
    RAISE EXCEPTION 'Le montant d''un règlement % ne se modifie plus.', OLD.statut;
  END IF;

  IF OLD.statut <> 'brouillon'
     AND NEW.compte_bancaire_id IS DISTINCT FROM OLD.compte_bancaire_id THEN
    RAISE EXCEPTION 'Le compte bénéficiaire d''un règlement % ne se change plus : annulez et reprenez.', OLD.statut;
  END IF;

  IF NEW.statut IN ('rejete', 'annule') AND OLD.statut NOT IN ('rejete', 'annule')
     AND OLD.statut IN ('execute', 'rapproche') THEN
    RAISE EXCEPTION 'Un règlement exécuté ne s''annule pas : passez par une contrepassation.';
  END IF;

  RETURN NEW;
END $fn$;

-- Les deux fonctions héritées, alignées sur le nouveau cycle -----------------
CREATE OR REPLACE FUNCTION snp_enregistrer_reglement(
  p_mining_company_id uuid, p_montant numeric, p_date date DEFAULT CURRENT_DATE,
  p_mode text DEFAULT 'virement', p_banque text DEFAULT NULL,
  p_reference_bancaire text DEFAULT NULL, p_observations text DEFAULT NULL,
  p_affecter_fifo boolean DEFAULT false)
RETURNS TABLE (reglement_id uuid, reference text, montant_affecte numeric, solde_non_affecte numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
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
    mode_reglement, banque, reference_bancaire, observations, statut,
    prepare_par, date_preparation, created_by)
  VALUES (v_ref, p_mining_company_id, p_date, round(p_montant, 2),
          p_mode, p_banque, p_reference_bancaire, p_observations, 'brouillon',
          auth.uid(), now(), auth.uid())
  RETURNING id INTO v_id;

  IF p_affecter_fifo THEN PERFORM snp_affecter_fifo(v_id); END IF;

  RETURN QUERY
  SELECT v_id, v_ref, r.montant_affecte_fcfa, snp_reglement_solde(v_id)
  FROM snp_reglements_achat r WHERE r.id = v_id;
END $fn$;

CREATE OR REPLACE FUNCTION snp_affecter_fifo(p_reglement_id uuid)
RETURNS TABLE (factures_soldees int, montant_affecte numeric, solde_non_affecte numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
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
  IF v_reglement.statut NOT IN ('brouillon', 'soumis') THEN
    RAISE EXCEPTION 'Un règlement % ne se réimpute plus.', v_reglement.statut;
  END IF;

  v_solde := snp_reglement_solde(p_reglement_id);

  -- L'ordre est celui de l'échéance, puis de l'émission : deux factures échues
  -- le même jour se règlent dans l'ordre où elles ont été émises.
  FOR v_facture IN
    SELECT f.id, snp_facture_reste_a_affecter(f.id) AS reste
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
END $fn$;

GRANT EXECUTE ON FUNCTION snp_facture_engage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_facture_reste_a_affecter(uuid) TO authenticated;
