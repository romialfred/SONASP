-- ============================================================================
-- Jeu de démonstration : comptes bancaires, achats, factures et règlements
--
-- Idempotent : chaque objet est reconnu par sa référence et n'est créé que s'il
-- manque. Réexécuter ce fichier ne duplique rien.
--
-- Il ne touche à aucune donnée réelle : les achats directs antérieurs au module
-- restent intacts.
--
-- Situations couvertes, pour que chaque écran ait un cas à montrer :
--   Essakane — trois factures, dont une soldée et une échue depuis des mois ;
--   Houndé   — deux factures dont une soldée par un règlement rapproché ;
--   Wahgnion — une facture récente, non échue, jamais réglée ;
--   Sanbrado — tout est soldé : société volontairement NON éligible ;
--   Boungou  — deux anciennes factures impayées, rien versé.
--
-- ORDRE DES ÉCRITURES. Chaque règlement est créé en brouillon, reçoit ses
-- affectations, puis passe à son état final. Créer un règlement déjà exécuté
-- puis l'affecter échoue — et c'est le bon comportement : le garde-fou refuse
-- de modifier la répartition d'un ordre exécuté, puisqu'il faudrait rappeler la
-- banque. Le jeu suit donc le cycle réel plutôt que de le contourner.
--
-- L'AUTEUR des écritures doit exister dans `auth.users` : deux des trois profils
-- de la plateforme n'ont pas de compte correspondant (anomalie A181).
--
-- Retour arrière :
--   DELETE FROM snp_reglements_preuves WHERE reglement_id IN
--     (SELECT id FROM snp_reglements_achat WHERE reference_interne LIKE 'DEMO-%');
--   DELETE FROM snp_reglements_affectations WHERE reglement_id IN
--     (SELECT id FROM snp_reglements_achat WHERE reference_interne LIKE 'DEMO-%');
--   DELETE FROM snp_reglements_achat WHERE reference_interne LIKE 'DEMO-%';
--   DELETE FROM snp_factures_achat WHERE numero_facture LIKE 'FA-DEMO-%';
--   DELETE FROM snp_achats_mines   WHERE numero_achat LIKE 'ACH-DEMO-%';
--   DELETE FROM stakeholder_bank_accounts WHERE notes = 'Jeu de démonstration';
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Comptes bancaires des sociétés minières
--
-- Le compte bénéficiaire d'un virement ne se saisit jamais au moment du
-- paiement : il vient de la fiche de la société. Sans ces comptes, aucun
-- règlement ne peut être préparé — c'est voulu, et l'écran le dit.
-- ---------------------------------------------------------------------------
INSERT INTO stakeholder_bank_accounts (
  stakeholder_type, stakeholder_id, account_name, account_holder,
  bank_name, bank_country, bank_code, branch_name, branch_code,
  account_number, rib_key, account_currency, swift_code,
  is_primary, is_active, verification_status, verified_at, valid_from, notes)
SELECT
  'mining_company', mc.id,
  'Compte principal ' || mc.code, mc.name,
  b.banque, 'BF', b.code_banque, b.agence, b.code_guichet,
  b.compte, b.cle, 'XOF', b.swift,
  true, true, 'verifie', now() - interval '90 days',
  DATE '2025-01-01', 'Jeu de démonstration'
FROM mining_companies mc
JOIN (VALUES
  ('ESK', 'Coris Bank International',      'BF083', 'Agence Ouaga 2000',   '01001', '00123456789', '18', 'CORIBFBF'),
  ('HGO', 'Ecobank Burkina Faso',          'BF076', 'Agence Bobo Centre',  '02014', '00987654321', '42', 'ECOCBFBF'),
  ('WGM', 'Banque Atlantique Burkina Faso','BF061', 'Agence Ouagadougou',  '03007', '00456789123', '07', 'ATBFBFBF'),
  ('SGO', 'Bank of Africa Burkina Faso',   'BF054', 'Agence Kossodo',      '04002', '00789123456', '33', 'AFRIBFBF'),
  ('SBM', 'Banque Commerciale du Burkina', 'BF049', 'Agence Zone du Bois', '05011', '00321654987', '61', 'BCBUBFBF'),
  ('BGO', 'Société Générale Burkina Faso', 'BF037', 'Agence Ouaga Centre', '06005', '00654987321', '25', 'SGBFBFBF')
) AS b(code, banque, code_banque, agence, code_guichet, compte, cle, swift)
  ON b.code = mc.code
WHERE NOT EXISTS (
  SELECT 1 FROM stakeholder_bank_accounts s
  WHERE s.stakeholder_type = 'mining_company' AND s.stakeholder_id = mc.id);

-- ---------------------------------------------------------------------------
-- 2. Achats et factures
-- ---------------------------------------------------------------------------
DO $seed$
DECLARE
  v_cas record; v_societe uuid; v_achat uuid;
  v_brut numeric; v_tva numeric; v_tdc numeric; v_ttc numeric;
BEGIN
  FOR v_cas IN
    SELECT * FROM (VALUES
      ('ESK', '01', DATE '2026-02-01', 820.0000, 2540000, 195, 30),
      ('ESK', '02', DATE '2026-04-01', 760.0000, 2580000, 130, 30),
      ('ESK', '03', DATE '2026-07-01', 910.0000, 2660000,  35, 60),
      ('HGO', '01', DATE '2026-03-01', 640.0000, 2560000, 165, 30),
      ('HGO', '02', DATE '2026-06-01', 705.0000, 2620000,  70, 45),
      ('WGM', '01', DATE '2026-07-01', 580.0000, 2660000,  22, 60),
      ('SGO', '01', DATE '2026-05-01', 520.0000, 2600000, 100, 30),
      ('SBM', '01', DATE '2026-01-01', 310.0000, 2500000, 225, 30),
      ('SBM', '02', DATE '2026-02-01', 295.0000, 2540000, 195, 30)
    ) AS c(code, suffixe, periode, quantite, prix, jours_emission, delai)
  LOOP
    SELECT id INTO v_societe FROM mining_companies WHERE code = v_cas.code;
    CONTINUE WHEN v_societe IS NULL;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM snp_factures_achat
      WHERE numero_facture = 'FA-DEMO-' || v_cas.code || '-' || v_cas.suffixe);

    v_brut := round(v_cas.quantite * v_cas.prix, 2);
    v_tva := round(v_brut * 0.18, 2);
    v_tdc := round(v_brut * 0.01, 2);
    v_ttc := v_brut + v_tva + v_tdc;

    INSERT INTO snp_achats_mines (
      numero_achat, mining_company_id, periode_debut, periode_fin, date_achat,
      quantite_oz, quantite_grammes, prix_once_fcfa,
      montant_brut_fcfa, tva_taux, tva_montant_fcfa,
      taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_total_fcfa,
      statut, observations)
    VALUES (
      'ACH-DEMO-' || v_cas.code || '-' || v_cas.suffixe, v_societe,
      v_cas.periode, (v_cas.periode + interval '1 month - 1 day')::date,
      (CURRENT_DATE - v_cas.jours_emission),
      v_cas.quantite, round(v_cas.quantite * 31.1034768, 3), v_cas.prix,
      v_brut, 18, v_tva, 1, v_tdc, v_ttc,
      'validee', 'Achat mensuel de la production déclarée sur la période.')
    RETURNING id INTO v_achat;

    INSERT INTO snp_factures_achat (
      numero_facture, achat_id, mining_company_id,
      date_emission, periode_debut, periode_fin,
      quantite_oz, titre_pct, prix_once_fcfa,
      montant_ht_fcfa, tva_taux, tva_montant_fcfa,
      taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_ttc_fcfa,
      devise, conditions_paiement, date_echeance,
      statut, statut_certification, observations)
    VALUES (
      'FA-DEMO-' || v_cas.code || '-' || v_cas.suffixe, v_achat, v_societe,
      (CURRENT_DATE - v_cas.jours_emission), v_cas.periode,
      (v_cas.periode + interval '1 month - 1 day')::date,
      v_cas.quantite, 91.5, v_cas.prix,
      v_brut, 18, v_tva, 1, v_tdc, v_ttc,
      'XOF',
      CASE WHEN v_cas.delai >= 60 THEN 'differe_60j' ELSE 'differe_30j' END,
      (CURRENT_DATE - v_cas.jours_emission + v_cas.delai),
      'emise', 'en_attente', 'Facture d''achat de production.');

    INSERT INTO snp_factures_achat_lignes
      (facture_id, rang, designation, quantite, unite, titre_pct, prix_unitaire_fcfa, montant_ht_fcfa)
    SELECT id, 1,
      'Or doré — production du ' || to_char(periode_debut, 'DD/MM/YYYY')
        || ' au ' || to_char(periode_fin, 'DD/MM/YYYY'),
      quantite_oz, 'oz', titre_pct, prix_once_fcfa, montant_ht_fcfa
    FROM snp_factures_achat
    WHERE numero_facture = 'FA-DEMO-' || v_cas.code || '-' || v_cas.suffixe;
  END LOOP;
END $seed$;

-- ---------------------------------------------------------------------------
-- 3. Règlements, à différents stades du cycle
-- ---------------------------------------------------------------------------
DO $seed$
DECLARE
  v_reg uuid; v_societe uuid; v_compte uuid;
  v_f1 uuid; v_f2 uuid; v_agent uuid; v_banque text;
BEGIN
  SELECT p.id INTO v_agent
  FROM user_profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.is_active AND p.mining_company_id IS NULL
    AND p.role IN ('owner', 'admin', 'management')
  ORDER BY p.role LIMIT 1;

  ---------------------------------------------------------------- Essakane --
  SELECT id INTO v_societe FROM mining_companies WHERE code = 'ESK';
  SELECT id, bank_name INTO v_compte, v_banque FROM stakeholder_bank_accounts
   WHERE stakeholder_type='mining_company' AND stakeholder_id = v_societe AND is_primary;
  SELECT id INTO v_f1 FROM snp_factures_achat WHERE numero_facture = 'FA-DEMO-ESK-01';
  SELECT id INTO v_f2 FROM snp_factures_achat WHERE numero_facture = 'FA-DEMO-ESK-02';

  IF v_f1 IS NOT NULL AND v_compte IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM snp_reglements_achat WHERE reference_interne = 'DEMO-ESK-VIR-001') THEN

    INSERT INTO snp_reglements_achat (
      reference_reglement, mining_company_id, date_reglement, montant_fcfa, devise,
      mode_reglement, compte_bancaire_id, banque, reference_bancaire,
      objet, reference_interne, statut, prepare_par, date_preparation, created_by)
    VALUES (
      'REG-DEMO-0001', v_societe, CURRENT_DATE - 120, 2800000000, 'XOF',
      'virement', v_compte, v_banque, 'MT103-BF-2026-0451',
      'Règlement partiel des achats d''or de février et avril 2026',
      'DEMO-ESK-VIR-001', 'brouillon', v_agent, now() - interval '121 days', v_agent)
    RETURNING id INTO v_reg;

    INSERT INTO snp_reglements_affectations
      (reglement_id, facture_id, montant_affecte_fcfa, mode_affectation, affecte_par, date_affectation)
    VALUES (v_reg, v_f1, snp_facture_net_exigible(v_f1), 'automatique_fifo', v_agent, now() - interval '120 days');

    INSERT INTO snp_reglements_affectations
      (reglement_id, facture_id, montant_affecte_fcfa, mode_affectation, affecte_par, date_affectation)
    VALUES (v_reg, v_f2, 2800000000 - snp_facture_net_exigible(v_f1), 'automatique_fifo', v_agent, now() - interval '120 days');

    UPDATE snp_reglements_achat SET
      statut = 'execute',
      soumis_par = v_agent, date_soumission = now() - interval '121 days',
      valide_par = v_agent, date_validation = now() - interval '120 days',
      execute_par = v_agent, date_execution = now() - interval '119 days'
    WHERE id = v_reg;
  END IF;

  -- Acompte validé mais non exécuté : il ne réduit aucune dette.
  IF v_compte IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM snp_reglements_achat WHERE reference_interne = 'DEMO-ESK-ACO-002') THEN
    INSERT INTO snp_reglements_achat (
      reference_reglement, mining_company_id, date_reglement, montant_fcfa, devise,
      mode_reglement, compte_bancaire_id, banque, objet, reference_interne,
      statut, prepare_par, date_preparation, soumis_par, date_soumission,
      valide_par, date_validation, observations, created_by)
    VALUES (
      'REG-DEMO-0002', v_societe, CURRENT_DATE - 5, 500000000, 'XOF',
      'virement', v_compte, v_banque,
      'Acompte sur la production de juillet 2026', 'DEMO-ESK-ACO-002',
      'valide', v_agent, now() - interval '6 days', v_agent, now() - interval '6 days',
      v_agent, now() - interval '5 days',
      'Acompte non encore affecté : en attente d''arbitrage.', v_agent);
  END IF;

  ------------------------------------------------------------------ Houndé --
  SELECT id INTO v_societe FROM mining_companies WHERE code = 'HGO';
  SELECT id, bank_name INTO v_compte, v_banque FROM stakeholder_bank_accounts
   WHERE stakeholder_type='mining_company' AND stakeholder_id = v_societe AND is_primary;
  SELECT id INTO v_f1 FROM snp_factures_achat WHERE numero_facture = 'FA-DEMO-HGO-01';

  IF v_f1 IS NOT NULL AND v_compte IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM snp_reglements_achat WHERE reference_interne = 'DEMO-HGO-VIR-001') THEN

    INSERT INTO snp_reglements_achat (
      reference_reglement, mining_company_id, date_reglement, montant_fcfa, devise,
      mode_reglement, compte_bancaire_id, banque, reference_bancaire,
      objet, reference_interne, statut, prepare_par, date_preparation, created_by)
    VALUES (
      'REG-DEMO-0003', v_societe, CURRENT_DATE - 90, 2400000000, 'XOF',
      'virement', v_compte, v_banque, 'MT103-BF-2026-0512',
      'Règlement de la production de mars 2026', 'DEMO-HGO-VIR-001',
      'brouillon', v_agent, now() - interval '92 days', v_agent)
    RETURNING id INTO v_reg;

    INSERT INTO snp_reglements_affectations
      (reglement_id, facture_id, montant_affecte_fcfa, mode_affectation, affecte_par, date_affectation)
    VALUES (v_reg, v_f1, snp_facture_net_exigible(v_f1), 'automatique_fifo', v_agent, now() - interval '90 days');

    UPDATE snp_reglements_achat SET
      statut = 'rapproche',
      soumis_par = v_agent, date_soumission = now() - interval '92 days',
      valide_par = v_agent, date_validation = now() - interval '91 days',
      execute_par = v_agent, date_execution = now() - interval '90 days',
      rapproche_par = v_agent, date_rapprochement = now() - interval '85 days'
    WHERE id = v_reg;
  END IF;

  --------------------------------------------------------------- Sanbrado --
  SELECT id INTO v_societe FROM mining_companies WHERE code = 'SGO';
  SELECT id, bank_name INTO v_compte, v_banque FROM stakeholder_bank_accounts
   WHERE stakeholder_type='mining_company' AND stakeholder_id = v_societe AND is_primary;
  SELECT id INTO v_f1 FROM snp_factures_achat WHERE numero_facture = 'FA-DEMO-SGO-01';

  IF v_f1 IS NOT NULL AND v_compte IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM snp_reglements_achat WHERE reference_interne = 'DEMO-SGO-VIR-001') THEN

    INSERT INTO snp_reglements_achat (
      reference_reglement, mining_company_id, date_reglement, montant_fcfa, devise,
      mode_reglement, compte_bancaire_id, banque, reference_bancaire,
      objet, reference_interne, statut, prepare_par, date_preparation, created_by)
    VALUES (
      'REG-DEMO-0004', v_societe, CURRENT_DATE - 60, snp_facture_net_exigible(v_f1), 'XOF',
      'virement', v_compte, v_banque, 'MT103-BF-2026-0588',
      'Règlement intégral de la production de mai 2026', 'DEMO-SGO-VIR-001',
      'brouillon', v_agent, now() - interval '62 days', v_agent)
    RETURNING id INTO v_reg;

    INSERT INTO snp_reglements_affectations
      (reglement_id, facture_id, montant_affecte_fcfa, mode_affectation, affecte_par, date_affectation)
    VALUES (v_reg, v_f1, snp_facture_net_exigible(v_f1), 'manuelle', v_agent, now() - interval '60 days');

    UPDATE snp_reglements_achat SET
      statut = 'execute',
      soumis_par = v_agent, date_soumission = now() - interval '62 days',
      valide_par = v_agent, date_validation = now() - interval '61 days',
      execute_par = v_agent, date_execution = now() - interval '60 days'
    WHERE id = v_reg;
  END IF;
END $seed$;

-- Preuves bancaires des règlements exécutés. Sans elles, le cycle refuserait de
-- les déclarer exécutés : une exécution s'atteste.
INSERT INTO snp_reglements_preuves (
  reglement_id, type_document, fichier_url, nom_origine, type_mime, taille_octets,
  empreinte_sha256, reference_document, date_emission, banque_emettrice,
  commentaire, statut_verification, ajoute_le)
SELECT
  r.id, 'mt103',
  'preuves/' || r.reference_reglement || '-mt103.pdf',
  r.reference_bancaire || '.pdf', 'application/pdf', 184320,
  encode(sha256(r.reference_reglement::bytea), 'hex'),
  r.reference_bancaire, r.date_reglement, r.banque,
  'Message MT103 émis par la banque.', 'verifiee', r.date_execution
FROM snp_reglements_achat r
WHERE r.reference_interne LIKE 'DEMO-%'
  AND r.statut IN ('execute', 'rapproche')
  AND NOT EXISTS (SELECT 1 FROM snp_reglements_preuves p WHERE p.reglement_id = r.id);
