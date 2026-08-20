-- ============================================================================
-- Achats d'or industriel — intégrité, totaux et audit
--
-- Ce fichier tient les invariants du module. Ils sont posés en base parce qu'il
-- n'y a pas de serveur applicatif entre le navigateur et PostgREST : un contrôle
-- écrit en TypeScript s'obtient en ouvrant la console du navigateur.
--
-- Invariants garantis ici :
--   • un règlement ne s'affecte jamais au-delà de son montant ;
--   • une facture ne reçoit jamais plus que son reste dû ;
--   • le montant payé d'une facture est TOUJOURS la somme de ses affectations
--     vivantes — il n'est jamais saisi ;
--   • le statut de paiement d'une facture découle des montants ;
--   • les totaux d'un plan découlent de ses lignes ;
--   • une écriture financière validée ne se modifie plus ;
--   • toute opération sensible laisse une trace inaltérable.
-- ============================================================================

CREATE OR REPLACE FUNCTION snp_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'snp_plans_achat', 'snp_plans_achat_lignes', 'snp_demandes_achat',
    'snp_factures_achat', 'snp_avoirs_achat', 'snp_reglements_achat'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_touch ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at()', t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Journal d'audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_auditer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE identifiant uuid;
BEGIN
  identifiant := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN (to_jsonb(OLD) ->> 'id') ELSE (to_jsonb(NEW) ->> 'id') END
  )::uuid;

  INSERT INTO snp_achats_audit (objet, objet_id, action, valeurs_avant, valeurs_apres, acteur_id)
  VALUES (
    TG_TABLE_NAME, identifiant, lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    auth.uid());

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'snp_plans_achat', 'snp_plans_achat_lignes', 'snp_demandes_achat',
    'snp_factures_achat', 'snp_avoirs_achat',
    'snp_reglements_achat', 'snp_reglements_affectations'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_audit ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_audit AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION snp_auditer()', t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Reste dû d'une facture, solde disponible d'un règlement
--
-- Ces fonctions sont la référence unique du module : tout écran, toute
-- validation et tout déclencheur s'y rapportent, ce qui interdit qu'un solde
-- soit calculé différemment selon l'endroit d'où on le regarde.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_facture_net_exigible(p_facture_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT GREATEST(0, f.montant_ttc_fcfa - COALESCE((
    SELECT sum(a.montant_fcfa) FROM snp_avoirs_achat a
    WHERE a.facture_id = f.id AND a.statut = 'applique'), 0))
  FROM snp_factures_achat f WHERE f.id = p_facture_id;
$$;

CREATE OR REPLACE FUNCTION snp_facture_paye(p_facture_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT COALESCE(sum(af.montant_affecte_fcfa), 0)
  FROM snp_reglements_affectations af
  WHERE af.facture_id = p_facture_id AND af.statut = 'active';
$$;

CREATE OR REPLACE FUNCTION snp_facture_reste_du(p_facture_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT GREATEST(0, snp_facture_net_exigible(p_facture_id) - snp_facture_paye(p_facture_id));
$$;

CREATE OR REPLACE FUNCTION snp_reglement_solde(p_reglement_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT GREATEST(0, r.montant_fcfa - COALESCE((
    SELECT sum(af.montant_affecte_fcfa) FROM snp_reglements_affectations af
    WHERE af.reglement_id = r.id AND af.statut = 'active'), 0))
  FROM snp_reglements_achat r WHERE r.id = p_reglement_id;
$$;

-- Statut de paiement : déduit des montants, jamais saisi. Les états décidés par
-- un humain — contestée, suspendue, annulée — ne se recalculent pas.
CREATE OR REPLACE FUNCTION snp_facture_statut_calcule(
  p_statut_actuel text, p_net numeric, p_paye numeric, p_echeance date
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_statut_actuel IN ('annulee', 'contestee', 'suspendue', 'brouillon') THEN p_statut_actuel
    WHEN p_paye >= p_net AND p_net > 0 THEN 'payee'
    WHEN p_paye > 0 THEN 'partiellement_payee'
    ELSE p_statut_actuel
  END;
$$;

CREATE OR REPLACE FUNCTION snp_recalculer_facture(p_facture_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_net numeric; v_paye numeric; v_ajust numeric;
  v_facture snp_factures_achat%ROWTYPE;
BEGIN
  SELECT * INTO v_facture FROM snp_factures_achat WHERE id = p_facture_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(sum(montant_fcfa), 0) INTO v_ajust
  FROM snp_avoirs_achat WHERE facture_id = p_facture_id AND statut = 'applique';

  v_net := GREATEST(0, v_facture.montant_ttc_fcfa - v_ajust);
  v_paye := snp_facture_paye(p_facture_id);

  UPDATE snp_factures_achat
  SET montant_ajustements_fcfa = v_ajust,
      montant_paye_fcfa = v_paye,
      statut = snp_facture_statut_calcule(statut, v_net, v_paye, date_echeance)
  WHERE id = p_facture_id;
END $$;

-- ---------------------------------------------------------------------------
-- Garde-fou des affectations
--
-- Les deux plafonds sont vérifiés sous verrou : sans cela, deux affectations
-- simultanées passeraient chacune le contrôle et dépasseraient ensemble.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_verifier_affectation() RETURNS trigger
LANGUAGE plpgsql AS $$
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

  SELECT COALESCE(sum(montant_affecte_fcfa), 0) INTO v_deja_facture
  FROM snp_reglements_affectations
  WHERE facture_id = NEW.facture_id AND statut = 'active'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  v_net := snp_facture_net_exigible(NEW.facture_id);

  IF v_deja_facture + NEW.montant_affecte_fcfa > v_net + 0.005 THEN
    RAISE EXCEPTION 'Affectation de % impossible : il ne reste que % à payer sur cette facture.',
      NEW.montant_affecte_fcfa, v_net - v_deja_facture;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_affectation_verifier ON snp_reglements_affectations;
CREATE TRIGGER trg_affectation_verifier
  BEFORE INSERT OR UPDATE ON snp_reglements_affectations
  FOR EACH ROW EXECUTE FUNCTION snp_verifier_affectation();

CREATE OR REPLACE FUNCTION snp_repercuter_affectation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_facture uuid; v_reglement uuid;
BEGIN
  v_facture := COALESCE(NEW.facture_id, OLD.facture_id);
  v_reglement := COALESCE(NEW.reglement_id, OLD.reglement_id);

  PERFORM snp_recalculer_facture(v_facture);
  IF TG_OP = 'UPDATE' AND OLD.facture_id <> NEW.facture_id THEN
    PERFORM snp_recalculer_facture(OLD.facture_id);
  END IF;

  UPDATE snp_reglements_achat
  SET montant_affecte_fcfa = COALESCE((
        SELECT sum(montant_affecte_fcfa) FROM snp_reglements_affectations
        WHERE reglement_id = v_reglement AND statut = 'active'), 0)
  WHERE id = v_reglement;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_affectation_repercuter ON snp_reglements_affectations;
CREATE TRIGGER trg_affectation_repercuter
  AFTER INSERT OR UPDATE OR DELETE ON snp_reglements_affectations
  FOR EACH ROW EXECUTE FUNCTION snp_repercuter_affectation();

-- Un avoir déplace le net exigible : la facture se recalcule.
CREATE OR REPLACE FUNCTION snp_repercuter_avoir() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM snp_recalculer_facture(COALESCE(NEW.facture_id, OLD.facture_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_avoir_repercuter ON snp_avoirs_achat;
CREATE TRIGGER trg_avoir_repercuter
  AFTER INSERT OR UPDATE OR DELETE ON snp_avoirs_achat
  FOR EACH ROW EXECUTE FUNCTION snp_repercuter_avoir();

-- ---------------------------------------------------------------------------
-- Protection des écritures financières finalisées
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_proteger_facture() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.statut = 'annulee' AND NEW.statut <> 'annulee' THEN
    RAISE EXCEPTION 'Une facture annulée ne se rouvre pas : émettez une facture de remplacement.';
  END IF;

  -- Les montants d'une facture certifiée sont figés : la corriger suppose un
  -- avoir ou une annulation suivie d'un remplacement.
  IF OLD.statut_certification = 'certifiee' AND (
       NEW.montant_ht_fcfa IS DISTINCT FROM OLD.montant_ht_fcfa
    OR NEW.montant_ttc_fcfa IS DISTINCT FROM OLD.montant_ttc_fcfa
    OR NEW.quantite_oz IS DISTINCT FROM OLD.quantite_oz
    OR NEW.prix_once_fcfa IS DISTINCT FROM OLD.prix_once_fcfa
    OR NEW.numero_facture IS DISTINCT FROM OLD.numero_facture
  ) THEN
    RAISE EXCEPTION 'Facture certifiée : ses montants ne se modifient plus. Passez par un avoir ou une annulation.';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_facture_proteger ON snp_factures_achat;
CREATE TRIGGER trg_facture_proteger
  BEFORE UPDATE ON snp_factures_achat
  FOR EACH ROW EXECUTE FUNCTION snp_proteger_facture();

CREATE OR REPLACE FUNCTION snp_proteger_reglement() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.statut IN ('valide', 'rejete', 'annule')
     AND NEW.montant_fcfa IS DISTINCT FROM OLD.montant_fcfa THEN
    RAISE EXCEPTION 'Le montant d''un règlement % ne se modifie plus.', OLD.statut;
  END IF;

  IF NEW.statut IN ('rejete', 'annule') AND OLD.statut NOT IN ('rejete', 'annule')
     AND EXISTS (SELECT 1 FROM snp_reglements_affectations
                 WHERE reglement_id = NEW.id AND statut = 'active') THEN
    RAISE EXCEPTION 'Ce règlement porte des affectations actives : annulez-les d''abord.';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reglement_proteger ON snp_reglements_achat;
CREATE TRIGGER trg_reglement_proteger
  BEFORE UPDATE ON snp_reglements_achat
  FOR EACH ROW EXECUTE FUNCTION snp_proteger_reglement();

-- ---------------------------------------------------------------------------
-- Totaux d'un plan, tenus depuis ses lignes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snp_recalculer_plan() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_plan uuid;
BEGIN
  v_plan := COALESCE(NEW.plan_id, OLD.plan_id);

  UPDATE snp_plans_achat p
  SET quantite_repartie_oz = COALESCE(t.quantite, 0),
      montant_previsionnel_fcfa = COALESCE(t.montant, 0)
  FROM (
    SELECT sum(quantite_proposee_oz) AS quantite, sum(montant_estime_fcfa) AS montant
    FROM snp_plans_achat_lignes
    WHERE plan_id = v_plan AND statut <> 'annulee'
  ) t
  WHERE p.id = v_plan;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_plan_ligne_totaux ON snp_plans_achat_lignes;
CREATE TRIGGER trg_plan_ligne_totaux
  AFTER INSERT OR UPDATE OR DELETE ON snp_plans_achat_lignes
  FOR EACH ROW EXECUTE FUNCTION snp_recalculer_plan();

-- Le montant estimé d'une ligne découle de sa quantité et de son prix : il ne
-- se saisit pas, sans quoi l'écran et la base finiraient par diverger.
CREATE OR REPLACE FUNCTION snp_calculer_ligne_plan() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.montant_estime_fcfa := round(NEW.quantite_proposee_oz * NEW.prix_once_fcfa, 2);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_plan_ligne_calcul ON snp_plans_achat_lignes;
CREATE TRIGGER trg_plan_ligne_calcul
  BEFORE INSERT OR UPDATE ON snp_plans_achat_lignes
  FOR EACH ROW EXECUTE FUNCTION snp_calculer_ligne_plan();
