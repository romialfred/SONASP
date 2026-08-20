-- ============================================================================
-- Marché d'or artisanal 2026 : ventes, factures, règlements et taxes
--
-- Le module artisanal était presque vide : soixante-trois artisans inscrits,
-- deux ventes, aucun moyen de paiement, aucune facture définitive, aucun
-- règlement. Les écrans « Ventes d'or », « Paiements » et « Rapports et
-- analyses » n'affichaient donc rien.
--
-- Un défaut de données est corrigé au passage : la vente VE-OR-2025-00001
-- portait un prix de 2 740 000 000 FCFA le kilogramme, soit trente-quatre fois
-- le cours réel — 125 g y valaient 342 millions. Le prix est recalculé au cours
-- de la période, ajusté du titre.
--
-- Ce que pose ce fichier, pour trente artisans répartis sur le territoire :
--   • un moyen de règlement par artisan — Orange Money, Moov Money, Wave ou
--     virement, la répartition qu'on observe sur le terrain ;
--   • trente-six ventes d'or entre janvier et août 2026, en poudre, pépites ou
--     lingot, de 18 à 23 carats ;
--   • la facture définitive de chaque vente validée ;
--   • le règlement des factures échues et les taxes retenues correspondantes.
--
-- Le prix au kilogramme se déduit du cours du jour et du taux du jour, ajusté du
-- titre : rien n'est posé indépendamment. Fiscalité : TVA 18 %, taxe de
-- développement communal 1 %, retenue à la source 5 %.
--
-- Retour arrière — toutes ces lignes portent la date du jour :
--   DELETE FROM snp_artisan_taxes_retenues WHERE created_at::date = '2026-08-20';
--   DELETE FROM snp_artisan_paiements WHERE created_at::date = '2026-08-20';
--   DELETE FROM snp_artisan_factures_definitives WHERE created_at::date = '2026-08-20';
--   DELETE FROM snp_artisan_ventes_or WHERE numero_recu LIKE 'VE-OR-2026-%';
--   DELETE FROM snp_artisan_moyens_paiement WHERE created_at::date = '2026-08-20';
-- ============================================================================

-- 0. Le prix aberrant de la vente 2025 ---------------------------------------
UPDATE snp_artisan_ventes_or v
SET prix_kg_fcfa = round(84600000 * v.purete_karat / 24, 2),
    montant_brut_fcfa = round(v.quantite_grammes / 1000 * 84600000 * v.purete_karat / 24, 2),
    montant_total_fcfa = round(v.quantite_grammes / 1000 * 84600000 * v.purete_karat / 24 * 1.19, 2),
    tva_montant_fcfa = round(v.quantite_grammes / 1000 * 84600000 * v.purete_karat / 24 * 0.18, 2),
    taxe_dev_comm_montant_fcfa = round(v.quantite_grammes / 1000 * 84600000 * v.purete_karat / 24 * 0.01, 2),
    observations = trim(coalesce(v.observations, '')
      || ' Prix corrigé : le kilogramme était saisi à 2 740 000 000 FCFA.'),
    updated_at = now()
WHERE v.prix_kg_fcfa > 500000000;

-- 1. Un moyen de règlement par artisan ---------------------------------------
WITH retenus AS (
  SELECT a.id, a.nom, a.prenoms,
         row_number() OVER (ORDER BY a.nom, a.prenoms, a.id) AS rang
  FROM snp_artisans_miniers a
  WHERE a.actif IS NOT FALSE
  LIMIT 30
)
INSERT INTO snp_artisan_moyens_paiement
  (artisan_id, type, libelle, numero_telephone, banque, numero_compte, titulaire,
   est_principal, actif, observations)
SELECT
  r.id,
  moyen.type,
  moyen.libelle,
  CASE WHEN moyen.type <> 'virement_bancaire'
       THEN '+226 7' || lpad(((r.rang * 7919) % 10000000)::text, 7, '0') END,
  CASE WHEN moyen.type = 'virement_bancaire' THEN 'Coris Bank International' END,
  CASE WHEN moyen.type = 'virement_bancaire'
       THEN 'BF' || lpad(((r.rang * 104729) % 100000000000)::text, 20, '0') END,
  r.prenoms || ' ' || r.nom,
  true, true,
  'Coordonnée principale de règlement.'
FROM retenus r
JOIN LATERAL (
  SELECT CASE r.rang % 4
           WHEN 0 THEN 'orange_money' WHEN 1 THEN 'moov_money'
           WHEN 2 THEN 'wave' ELSE 'virement_bancaire' END AS type,
         CASE r.rang % 4
           WHEN 0 THEN 'Orange Money' WHEN 1 THEN 'Moov Money'
           WHEN 2 THEN 'Wave' ELSE 'Virement bancaire' END AS libelle
) moyen ON true
WHERE NOT EXISTS (
  SELECT 1 FROM snp_artisan_moyens_paiement m WHERE m.artisan_id = r.id
);

-- 2. Trente-six ventes d'or --------------------------------------------------
WITH artisans AS (
  SELECT a.id, row_number() OVER (ORDER BY a.nom, a.prenoms, a.id) AS rang
  FROM snp_artisans_miniers a
  WHERE a.actif IS NOT FALSE
  LIMIT 30
),
calendrier AS (
  SELECT generate_series AS numero,
         ('2026-01-13'::date + ((generate_series - 1) * 6)) AS jour
  FROM generate_series(1, 36)
),
brute AS (
  SELECT
    c.numero, c.jour, a.id AS artisan_id,
    -- Lot artisanal : de 180 g à un peu plus d'un kilogramme.
    round((180 + 420 * (1 + sin(c.numero / 2.7))
              + 260 * (1 + cos(c.numero / 1.9)))::numeric, 3) AS grammes,
    (ARRAY['poudre', 'pepites', 'poudre', 'lingot'])[(c.numero % 4) + 1] AS type_or,
    (ARRAY[18, 20, 21, 22, 23])[(c.numero % 5) + 1]::numeric AS karat,
    (SELECT g.average_price FROM gold_prices_daily g WHERE g.price_date <= c.jour
      ORDER BY g.price_date DESC LIMIT 1) AS cours_usd,
    (SELECT f.rate FROM fx_rates_daily f
      WHERE f.currency_pair = 'USD/XOF' AND f.rate_date <= c.jour
      ORDER BY f.rate_date DESC LIMIT 1) AS taux
  FROM calendrier c
  JOIN artisans a ON a.rang = ((c.numero - 1) % 30) + 1
),
calcul AS (
  SELECT b.*,
    -- Prix du kilogramme d'or fin, ramené au titre du lot.
    round(b.cours_usd * b.taux / 31.1034768 * 1000 * b.karat / 24, 2) AS prix_kg,
    round(b.grammes / 1000 * b.cours_usd * b.taux / 31.1034768 * 1000 * b.karat / 24, 2) AS brut
  FROM brute b
  WHERE b.cours_usd IS NOT NULL AND b.taux IS NOT NULL
)
INSERT INTO snp_artisan_ventes_or
  (artisan_id, date_vente, quantite_grammes, type_or, purete_karat, prix_kg_fcfa,
   montant_brut_fcfa, tva_taux, tva_montant_fcfa, taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa,
   montant_total_fcfa, numero_recu, reference_vente, statut, statut_paiement, statut_validation,
   observations)
SELECT
  c.artisan_id, c.jour, c.grammes, c.type_or, c.karat, c.prix_kg,
  c.brut, 18.0, round(c.brut * 0.18, 2), 1.0, round(c.brut * 0.01, 2),
  round(c.brut * 1.19, 2),
  'VE-OR-2026-' || lpad(c.numero::text, 5, '0'),
  'VA-2026-' || lpad(c.numero::text, 4, '0'),
  -- Les six dernières ventes attendent encore leur validation.
  CASE WHEN c.numero > 30 THEN 'en_attente' ELSE 'validee' END,
  CASE WHEN c.numero > 30 THEN 'non_paye'
       WHEN c.numero > 24 THEN 'facture_emise'
       ELSE 'paye' END,
  CASE WHEN c.numero > 30 THEN 'en_attente' ELSE 'validee' END,
  'Lot acheté au comptoir régional.'
FROM calcul c
WHERE NOT EXISTS (
  SELECT 1 FROM snp_artisan_ventes_or v
  WHERE v.numero_recu = 'VE-OR-2026-' || lpad(c.numero::text, 5, '0')
);

-- 3. Facture définitive de chaque vente validée ------------------------------
-- Retenue à la source de 5 %, ajoutée à la TVA et à la taxe communale.
INSERT INTO snp_artisan_factures_definitives
  (numero_facture, vente_or_id, artisan_id, montant_brut, montant_taxe_tva,
   montant_taxe_retenue_source, montant_autres_taxes, montant_total_taxes, montant_net_a_payer,
   taux_tva, taux_retenue_source, date_emission, date_echeance, statut, notes)
SELECT
  'FA-AM-2026-' || substring(v.numero_recu from '[0-9]+$'),
  v.id, v.artisan_id, v.montant_brut_fcfa,
  v.tva_montant_fcfa,
  round(v.montant_brut_fcfa * 0.05, 2),
  v.taxe_dev_comm_montant_fcfa,
  round(v.tva_montant_fcfa + v.montant_brut_fcfa * 0.05 + v.taxe_dev_comm_montant_fcfa, 2),
  round(v.montant_brut_fcfa - v.montant_brut_fcfa * 0.05, 2),
  18.0, 5.0,
  (v.date_vente + 2)::timestamptz,
  (v.date_vente + 17)::timestamptz,
  CASE WHEN v.statut_paiement = 'paye' THEN 'payee' ELSE 'emise' END,
  'Facture définitive de l’achat au comptoir.'
FROM snp_artisan_ventes_or v
WHERE v.numero_recu LIKE 'VE-OR-2026-%'
  AND v.statut = 'validee'
  AND NOT EXISTS (
    SELECT 1 FROM snp_artisan_factures_definitives f WHERE f.vente_or_id = v.id);

UPDATE snp_artisan_ventes_or v
SET facture_definitive_id = f.id, updated_at = now()
FROM snp_artisan_factures_definitives f
WHERE f.vente_or_id = v.id AND v.facture_definitive_id IS NULL;

-- 4. Règlement des factures des ventes déjà payées ---------------------------
INSERT INTO snp_artisan_paiements
  (reference_paiement, facture_id, vente_or_id, artisan_id, moyen_paiement_id, numero_facture,
   type_paiement, montant_paye, montant_taxes_retenues, statut,
   date_paiement, date_validation, date_completion, notes)
SELECT
  'PA-AM-2026-' || substring(v.numero_recu from '[0-9]+$'),
  f.id, v.id, v.artisan_id, m.id, f.numero_facture,
  m.type,
  f.montant_net_a_payer,
  f.montant_total_taxes,
  'complete',
  f.date_echeance - interval '3 days',
  f.date_echeance - interval '2 days',
  f.date_echeance - interval '2 days',
  'Règlement de la facture définitive.'
FROM snp_artisan_ventes_or v
JOIN snp_artisan_factures_definitives f ON f.vente_or_id = v.id
JOIN snp_artisan_moyens_paiement m ON m.artisan_id = v.artisan_id AND m.est_principal
WHERE v.numero_recu LIKE 'VE-OR-2026-%'
  AND v.statut_paiement = 'paye'
  AND NOT EXISTS (SELECT 1 FROM snp_artisan_paiements p WHERE p.vente_or_id = v.id);

-- 5. Taxes retenues, ligne par ligne ------------------------------------------
INSERT INTO snp_artisan_taxes_retenues
  (paiement_id, facture_id, vente_or_id, artisan_id, type_taxe, libelle_taxe,
   taux_taxe, montant_taxe, statut_reversement, periode_fiscale, exercice_fiscal)
SELECT
  p.id, p.facture_id, p.vente_or_id, p.artisan_id, t.code, t.libelle, t.taux,
  round(f.montant_brut * t.taux / 100, 2),
  CASE WHEN p.date_completion < '2026-07-01' THEN 'reverse' ELSE 'a_reverser' END,
  to_char(p.date_completion, 'YYYY-MM'),
  '2026'
FROM snp_artisan_paiements p
JOIN snp_artisan_factures_definitives f ON f.id = p.facture_id
CROSS JOIN (VALUES
  ('tva', 'Taxe sur la valeur ajoutée', 18.0),
  ('retenue_source', 'Retenue à la source', 5.0),
  ('taxe_municipale', 'Taxe de développement communal', 1.0)
) AS t(code, libelle, taux)
WHERE p.reference_paiement LIKE 'PA-AM-2026-%'
  AND NOT EXISTS (
    SELECT 1 FROM snp_artisan_taxes_retenues r
    WHERE r.paiement_id = p.id AND r.type_taxe = t.code);
