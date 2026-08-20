-- ============================================================================
-- Jeu de données de présentation — année 2026
--
-- ATTENTION. Ce fichier insère des données **fabriquées** pour permettre de
-- présenter la plateforme. Elles contredisent la consigne permanente du projet
-- (« Aucune donnée inventée. Pas de jeu de démonstration en production ») et
-- n'ont été posées que sur demande explicite.
--
-- Tout ce qu'il crée est reconnaissable, donc supprimable :
--   • daily_production.notes         LIKE 'Jeu de présentation%'
--   • snp_achats_mines.observations  LIKE 'Jeu de présentation%'
--   • freight_shipments.notes        LIKE 'Jeu de présentation%'
--   • export_licenses.notes          LIKE 'Jeu de présentation%'
--   • quarterly_forecasts.notes      LIKE 'Jeu de présentation%'
--   • payments.notes                 LIKE 'Jeu de présentation%'
--   • sales.sale_number              LIKE 'SL-2026-%'
--   • gold_prices_daily.source       = 'SIMULATION_PRESENTATION_2026'
--   • fx_rates_daily.notes           = 'SIMULATION_PRESENTATION_2026'
--   • budgets des mines de code ESK, HGO, SGO, BGO
--
-- Les cours et les taux sont **simulés**, pas relevés : leur source le dit, pour
-- que nul ne les prenne pour un fixing LBMA ou une cotation BCEAO.
--
-- Tout le reste se déduit : le doré vient de l'or fin et du titre, l'achat de la
-- production du mois, la vente du cours du jour, la licence du budget. Aucune
-- grandeur n'est posée indépendamment de celles dont elle découle.
--
-- À exécuter après 20260820_005 et 20260820_006.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cours de l'or, jusqu'au 20 août 2026
-- ---------------------------------------------------------------------------
UPDATE gold_prices_daily
SET low_price = round(average_price * 0.985, 2),
    notes = trim(coalesce(notes, '') || ' Plancher aberrant corrigé (2 706 $/oz).')
WHERE price_date >= '2026-01-01' AND low_price < average_price * 0.9;

WITH jours AS (
  SELECT d::date AS jour, (d::date - '2026-01-15'::date) AS rang
  FROM generate_series('2026-01-16'::date, '2026-08-20'::date, interval '1 day') d
  WHERE extract(isodow FROM d) <= 5
),
cotation AS (
  SELECT jour,
    round((4300 + 1.29 * rang + 46 * sin(rang / 9.0) + 18 * cos(rang / 3.0))::numeric, 2) AS moyen
  FROM jours
)
INSERT INTO gold_prices_daily
  (price_date, london_am_rate, london_pm_rate, spot_price, average_price, high_price, low_price,
   source, currency, notes)
SELECT jour, round(moyen * 0.9985, 2), round(moyen * 1.0015, 2), moyen, moyen,
       round(moyen * 1.0062, 2), round(moyen * 0.9938, 2),
       'SIMULATION_PRESENTATION_2026', 'USD',
       'Cours simulé pour la présentation de la plateforme — ne pas citer comme fixing.'
FROM cotation
WHERE NOT EXISTS (SELECT 1 FROM gold_prices_daily g WHERE g.price_date = cotation.jour);

-- ---------------------------------------------------------------------------
-- 2. Taux de change, jusqu'au 20 août 2026
-- ---------------------------------------------------------------------------
WITH jours AS (
  SELECT d::date AS jour, (d::date - '2026-01-17'::date) AS rang
  FROM generate_series('2026-01-18'::date, '2026-08-20'::date, interval '1 day') d
  WHERE extract(isodow FROM d) <= 5
),
paires AS (
  SELECT jour, rang, 'USD/XOF' AS paire,
         round((583 + 0.021 * rang + 4.2 * sin(rang / 11.0))::numeric, 4) AS taux FROM jours
  UNION ALL
  SELECT jour, rang, 'EUR/USD',
         round((1.112 + 0.00009 * rang + 0.012 * sin(rang / 13.0))::numeric, 4) FROM jours
  UNION ALL
  -- Le franc CFA est arrimé à l'euro à parité fixe : 655,957 XOF pour 1 EUR.
  SELECT jour, rang, 'EUR/XOF', 655.9570 FROM jours
)
INSERT INTO fx_rates_daily (rate_date, currency_pair, rate, bid_rate, ask_rate, spread, notes)
SELECT jour, paire, taux, round(taux * 0.9985, 4), round(taux * 1.0015, 4),
       round(taux * 0.003, 4), 'SIMULATION_PRESENTATION_2026'
FROM paires
WHERE NOT EXISTS (
  SELECT 1 FROM fx_rates_daily f WHERE f.rate_date = paires.jour AND f.currency_pair = paires.paire
);

-- ---------------------------------------------------------------------------
-- 3. Budgets 2026 et prévisions révisées
--
-- `unique_quarterly_forecast` porte sur (budget annuel, trimestre, mois) : la
-- base n'accepte qu'UNE prévision par mois, non un historique de révisions
-- successives, là où le code applicatif sait départager plusieurs révisions
-- (`dernieresRevisions`). L'écart est noté ; il n'est pas tranché ici.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE saison(mois int, poids numeric, jours int) ON COMMIT DROP;
INSERT INTO saison VALUES
  (1, 0.088, 31), (2, 0.080, 28), (3, 0.090, 31), (4, 0.086, 30),
  (5, 0.088, 31), (6, 0.078, 30), (7, 0.072, 31), (8, 0.070, 31),
  (9, 0.076, 30), (10, 0.090, 31), (11, 0.092, 30), (12, 0.090, 31);

CREATE TEMP TABLE cibles(code text, budget_oz numeric) ON COMMIT DROP;
INSERT INTO cibles VALUES ('ESK', 54000), ('HGO', 41000), ('SGO', 33000), ('BGO', 26000);

INSERT INTO annual_budgets (year, site_id, mining_company_id)
SELECT 2026, 'burkina_faso', mc.id
FROM cibles c JOIN mining_companies mc ON mc.code = c.code
WHERE NOT EXISTS (
  SELECT 1 FROM annual_budgets ab WHERE ab.year = 2026 AND ab.mining_company_id = mc.id);

INSERT INTO monthly_budgets
  (annual_budget_id, month, budget_oz, days_in_month, daily_budget_oz, mining_company_id)
SELECT ab.id, s.mois, round(c.budget_oz * s.poids, 2), s.jours,
       round(c.budget_oz * s.poids / s.jours, 4), mc.id
FROM cibles c
JOIN mining_companies mc ON mc.code = c.code
JOIN annual_budgets ab ON ab.mining_company_id = mc.id AND ab.year = 2026
CROSS JOIN saison s
WHERE NOT EXISTS (
  SELECT 1 FROM monthly_budgets mb WHERE mb.annual_budget_id = ab.id AND mb.month = s.mois);

INSERT INTO quarterly_forecasts
  (annual_budget_id, quarter, revision_date, month, forecast_oz, days_in_month, daily_forecast_oz,
   mining_company_id, notes)
SELECT ab.id, ((mb.month - 1) / 3) + 1,
       (make_date(2026, ((mb.month - 1) / 3) * 3 + 1, 1) + interval '4 days')::date,
       mb.month, round(mb.budget_oz * coef.valeur, 2), mb.days_in_month,
       round(mb.budget_oz * coef.valeur / mb.days_in_month, 4),
       ab.mining_company_id, 'Jeu de présentation — prévision révisée'
FROM annual_budgets ab
JOIN mining_companies mc ON mc.id = ab.mining_company_id
JOIN monthly_budgets mb ON mb.annual_budget_id = ab.id
JOIN LATERAL (
  SELECT CASE ((mb.month - 1) / 3) + 1
           WHEN 1 THEN 1.02 WHEN 2 THEN 0.96 WHEN 3 THEN 1.05 ELSE 0.99 END AS valeur
) coef ON true
WHERE ab.year = 2026 AND mc.company_type = 'production_mine'
  AND NOT EXISTS (
    SELECT 1 FROM quarterly_forecasts qf
    WHERE qf.annual_budget_id = ab.id AND qf.quarter = ((mb.month - 1) / 3) + 1
      AND qf.month = mb.month);

-- ---------------------------------------------------------------------------
-- 4. Production journalière : une coulée par semaine et par mine
--
-- Chaque mine tient une trajectoire différente, pour que la comparaison au
-- budget montre autre chose qu'une ligne plate : Bomboré dépasse son objectif,
-- Wahgnion et Essakane le tiennent, Houndé et Sanbrado décrochent un peu,
-- Boungou nettement.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE trajectoire(code text, oz_total numeric, titre_base numeric) ON COMMIT DROP;
INSERT INTO trajectoire VALUES
  ('ESK', 32400, 91.5), ('HGO', 23500, 89.0), ('WGM', 22200, 87.5),
  ('SGO', 19400, 92.0), ('BGO', 17600, 88.5), ('SBM', 11900, 90.0);

WITH semaines AS (
  SELECT d::date AS jour, row_number() OVER (ORDER BY d) AS rang, count(*) OVER () AS total
  FROM generate_series('2026-01-09'::date, '2026-08-14'::date, interval '7 days') d
),
depart AS (
  SELECT mc.id, mc.code, t.oz_total, t.titre_base,
         coalesce(max(substring(dp.bar_reference from '[0-9]+$')::int), 0) AS dernier
  FROM trajectoire t
  JOIN mining_companies mc ON mc.code = t.code
  LEFT JOIN daily_production dp
    ON dp.mining_company_id = mc.id AND dp.bar_reference ~ ('^' || mc.code || '-[0-9]+$')
  GROUP BY mc.id, mc.code, t.oz_total, t.titre_base
),
coulees AS (
  SELECT d.id AS mine_id, d.code, s.jour, d.dernier + s.rang AS numero,
    round(((d.oz_total / s.total)
           * (1 + 0.16 * sin(s.rang / 2.3) + 0.07 * cos(s.rang / 1.4)))::numeric, 2) AS oz,
    round((d.titre_base + 2.2 * sin(s.rang / 3.1))::numeric, 2) AS titre,
    round((6.4 + 1.8 * cos(s.rang / 2.7))::numeric, 2) AS argent_pct,
    s.rang, s.total
  FROM depart d CROSS JOIN semaines s
)
INSERT INTO daily_production
  (production_date, mining_company_id, bullion_grams, estimated_fineness_pct, pure_gold_grams,
   estimated_oz, estimated_gold_pct, estimated_silver_pct, silver_content_grams,
   bar_reference, status, site_id, notes)
SELECT jour, mine_id,
  round(oz * 31.1034768 / (titre / 100), 2), titre, round(oz * 31.1034768, 2), oz, titre, argent_pct,
  round(oz * 31.1034768 / (titre / 100) * argent_pct / 100, 2),
  code || '-' || lpad(numero::text, 4, '0'),
  -- Les trois dernières coulées de chaque mine sont encore en préparation.
  CASE WHEN rang > total - 3 THEN 'prepared' ELSE 'ready_for_customs' END::production_status_v2,
  'burkina_faso', 'Jeu de présentation — coulée hebdomadaire'
FROM coulees;

-- ---------------------------------------------------------------------------
-- 5. Licences d'exportation : quota dimensionné sur le budget, majoré de 15 %
-- ---------------------------------------------------------------------------
WITH mines AS (
  SELECT mc.id, mc.code,
    (SELECT sum(mb.budget_oz) FROM annual_budgets ab
       JOIN monthly_budgets mb ON mb.annual_budget_id = ab.id
      WHERE ab.mining_company_id = mc.id AND ab.year = 2026) AS budget_oz,
    coalesce((SELECT sum(dp.pure_gold_grams) FROM daily_production dp
      WHERE dp.mining_company_id = mc.id
        AND dp.production_date BETWEEN '2026-01-01' AND '2026-08-20'
        AND dp.status <> 'cancelled'), 0) AS produit_g
  FROM mining_companies mc WHERE mc.code IN ('ESK', 'HGO', 'SGO', 'BGO')
)
INSERT INTO export_licenses
  (license_number, mining_company_id, request_date, start_date, end_date, issuing_institution,
   authorized_quantity_grams, used_quantity_grams, remaining_quantity_grams,
   average_sale_price, status, notes)
SELECT 'EXP-' || code || '-2026-0001', id, DATE '2025-12-08', DATE '2026-01-01', DATE '2026-12-31',
  'Ministère de l’Énergie, des Mines et des Carrières',
  round(budget_oz * 1.15 * 31.1034768, 2), round(produit_g, 2),
  round(budget_oz * 1.15 * 31.1034768 - produit_g, 2),
  4450.00, 'active', 'Jeu de présentation — licence annuelle'
FROM mines
WHERE NOT EXISTS (
  SELECT 1 FROM export_licenses el WHERE el.license_number = 'EXP-' || mines.code || '-2026-0001');

-- Les licences déjà présentes ignoraient la production de l'année : leur quota
-- consommé restait à zéro alors que des barres étaient déclarées.
UPDATE export_licenses el
SET used_quantity_grams = c.produit_g,
    remaining_quantity_grams = el.authorized_quantity_grams - c.produit_g,
    updated_at = now()
FROM (
  SELECT dp.mining_company_id, round(sum(dp.pure_gold_grams), 2) AS produit_g
  FROM daily_production dp
  WHERE dp.production_date BETWEEN '2026-01-01' AND '2026-08-20' AND dp.status <> 'cancelled'
  GROUP BY dp.mining_company_id
) c
WHERE el.mining_company_id = c.mining_company_id
  AND el.start_date >= '2026-01-01' AND el.end_date <= '2026-12-31'
  AND el.authorized_quantity_grams >= c.produit_g
  AND el.notes IS DISTINCT FROM 'Jeu de présentation — licence annuelle';

-- ---------------------------------------------------------------------------
-- 6. Achats de la SONASP aux mines, mois par mois
--    Fiscalité appliquée : TVA 18 %, taxe de développement communal 1 %.
-- ---------------------------------------------------------------------------
WITH production_mensuelle AS (
  SELECT dp.mining_company_id,
    date_trunc('month', dp.production_date)::date AS debut,
    (date_trunc('month', dp.production_date) + interval '1 month - 1 day')::date AS fin,
    round(sum(dp.estimated_oz), 2) AS oz, round(sum(dp.pure_gold_grams), 2) AS grammes
  FROM daily_production dp
  JOIN mining_companies mc ON mc.id = dp.mining_company_id
  WHERE dp.production_date BETWEEN '2026-01-01' AND '2026-07-31'
    AND dp.status <> 'cancelled' AND mc.company_type = 'production_mine'
  GROUP BY 1, 2, 3
),
valorisee AS (
  SELECT pm.*, (pm.fin + 8) AS date_achat,
    (SELECT g.average_price FROM gold_prices_daily g WHERE g.price_date <= pm.fin + 8
      ORDER BY g.price_date DESC LIMIT 1) AS cours_usd,
    (SELECT f.rate FROM fx_rates_daily f
      WHERE f.currency_pair = 'USD/XOF' AND f.rate_date <= pm.fin + 8
      ORDER BY f.rate_date DESC LIMIT 1) AS taux
  FROM production_mensuelle pm
),
calcul AS (
  SELECT v.*, round(v.cours_usd * v.taux, 2) AS prix_once_fcfa,
         round(v.oz * v.cours_usd * v.taux, 0) AS brut
  FROM valorisee v WHERE v.cours_usd IS NOT NULL AND v.taux IS NOT NULL
)
INSERT INTO snp_achats_mines
  (numero_achat, mining_company_id, periode_debut, periode_fin, date_achat,
   quantite_oz, quantite_grammes, prix_once_fcfa, cours_once_usd, taux_usd_xof,
   montant_brut_fcfa, tva_taux, tva_montant_fcfa,
   taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_total_fcfa, statut, observations)
SELECT 'ACH-' || to_char(c.debut, 'YYYYMM') || '-' || mc.code, c.mining_company_id,
  c.debut, c.fin, c.date_achat, c.oz, c.grammes, c.prix_once_fcfa, c.cours_usd, c.taux,
  c.brut, 18.0, round(c.brut * 0.18, 0), 1.0, round(c.brut * 0.01, 0), round(c.brut * 1.19, 0),
  CASE WHEN c.debut < '2026-07-01' THEN 'payee' ELSE 'validee' END,
  'Jeu de présentation — achat mensuel de production'
FROM calcul c
JOIN mining_companies mc ON mc.id = c.mining_company_id
WHERE NOT EXISTS (
  SELECT 1 FROM snp_achats_mines a
  WHERE a.numero_achat = 'ACH-' || to_char(c.debut, 'YYYYMM') || '-' || mc.code);

-- ---------------------------------------------------------------------------
-- 7. Expéditions vers les affineurs
--
-- Les barres validées libres sont ordonnées de la plus ancienne à la plus
-- récente puis réparties par lots de douze, la plus ancienne partant la
-- première. Une barre ne peut appartenir qu'à une seule expédition —
-- `unique_production_per_shipment` y veille, et une allocation expédition par
-- expédition l'aurait violée : chacune aurait convoité les mêmes barres.
-- ---------------------------------------------------------------------------
WITH renumerotation AS (
  SELECT id, reference_number AS ancienne,
         'EXP-BF-' || to_char(shipment_date, 'YYYY') || '-'
           || lpad(row_number() OVER (PARTITION BY to_char(shipment_date, 'YYYY')
                                      ORDER BY shipment_date)::text, 3, '0') AS nouvelle
  FROM freight_shipments WHERE reference_number LIKE 'HUM-%'
)
UPDATE freight_shipments fs
SET reference_number = r.nouvelle,
    notes = trim(coalesce(fs.notes, '') || ' Ancienne référence : ' || r.ancienne)
FROM renumerotation r WHERE r.id = fs.id;

WITH departs AS (
  SELECT * FROM (VALUES
    (1, DATE '2026-03-05', 'Metalor Technologies SA'),
    (2, DATE '2026-04-23', 'Valcambi SA'),
    (3, DATE '2026-06-04', 'Rand Refinery Ltd.'),
    (4, DATE '2026-07-09', 'Argor-Heraeus SA'),
    (5, DATE '2026-08-06', 'Valcambi SA')
  ) AS d(rang, jour, affineur)
)
INSERT INTO freight_shipments
  (reference_number, expedition_number, status, shipment_date, shipped_at,
   number_of_boxes, box_type, gold_price_usd_per_oz, exchange_rate, local_currency, notes)
SELECT 'EXP-BF-2026-' || lpad((d.rang + 2)::text, 3, '0'),
  'LOT-2026-' || lpad((d.rang + 2)::text, 3, '0'),
  CASE WHEN d.jour < '2026-07-01' THEN 'processed'
       ELSE 'shipped_to_refinery' END::freight_shipment_status,
  d.jour, d.jour, 2 + d.rang % 3, 'Caisse scellée',
  (SELECT g.average_price FROM gold_prices_daily g WHERE g.price_date <= d.jour
    ORDER BY g.price_date DESC LIMIT 1),
  (SELECT f.rate FROM fx_rates_daily f
    WHERE f.currency_pair = 'USD/XOF' AND f.rate_date <= d.jour
    ORDER BY f.rate_date DESC LIMIT 1),
  'XOF', 'Jeu de présentation — expédition vers ' || d.affineur
FROM departs d
WHERE NOT EXISTS (
  SELECT 1 FROM freight_shipments fs
  WHERE fs.reference_number = 'EXP-BF-2026-' || lpad((d.rang + 2)::text, 3, '0'));

-- Le numéro de lot suit la référence, pour que les deux se lisent ensemble.
UPDATE freight_shipments
SET expedition_number = replace(reference_number, 'EXP-BF-', 'LOT-')
WHERE expedition_number IS DISTINCT FROM replace(reference_number, 'EXP-BF-', 'LOT-');

WITH expeditions AS (
  SELECT fs.id, row_number() OVER (ORDER BY fs.shipment_date) AS rang
  FROM freight_shipments fs WHERE fs.notes LIKE 'Jeu de présentation%'
),
libres AS (
  SELECT dp.*, row_number() OVER (ORDER BY dp.production_date, dp.bar_reference) AS place
  FROM daily_production dp
  WHERE dp.status = 'ready_for_customs' AND dp.production_date >= '2026-01-01'
    AND NOT EXISTS (SELECT 1 FROM freight_shipment_productions x WHERE x.production_id = dp.id)
),
affectation AS (
  SELECT l.*, ((l.place - 1) / 12) + 1 AS lot FROM libres l WHERE l.place <= 60
)
INSERT INTO freight_shipment_productions
  (freight_shipment_id, production_id, production_date, bar_reference, bullion_grams,
   estimated_fineness_pct, estimated_silver_pct, pure_gold_grams, pure_gold_oz, silver_content_grams)
SELECT e.id, a.id, a.production_date, a.bar_reference, a.bullion_grams,
  a.estimated_fineness_pct, a.estimated_silver_pct, a.pure_gold_grams, a.estimated_oz,
  a.silver_content_grams
FROM affectation a JOIN expeditions e ON e.rang = a.lot;

UPDATE freight_shipments fs
SET total_bullion_grams = t.dore, total_pure_gold_grams = t.fin, total_pure_gold_oz = t.oz,
    total_pure_silver_grams = t.argent, production_count = t.barres,
    total_value_usd = round(t.oz * fs.gold_price_usd_per_oz, 2),
    total_value_local = round(t.oz * fs.gold_price_usd_per_oz * fs.exchange_rate, 0),
    updated_at = now()
FROM (
  SELECT freight_shipment_id, round(sum(bullion_grams), 2) dore,
         round(sum(pure_gold_grams), 2) fin, round(sum(pure_gold_oz), 2) oz,
         round(sum(coalesce(silver_content_grams, 0)), 2) argent, count(*) barres
  FROM freight_shipment_productions GROUP BY freight_shipment_id
) t
WHERE t.freight_shipment_id = fs.id;

-- ---------------------------------------------------------------------------
-- 8. Ventes à l'export, valorisées au cours du jour, et leurs règlements
--
-- Les ventes parcourent tout le circuit d'approbation, des plus anciennes
-- (réglées) aux plus récentes (en attente de validation), pour que chaque étape
-- du flux ait un exemple à montrer. La redevance suit la convention déjà en
-- place dans la table : 3 % du produit brut.
--
-- Un déclencheur de la plateforme peut faire évoluer le statut à l'insertion :
-- deux ventes posées « customer_approved » ressortent en « virtual_payment ».
-- C'est la logique métier qui s'applique, non une erreur de ce fichier.
-- ---------------------------------------------------------------------------
WITH calendrier AS (
  SELECT rang, jour, quantite,
    (ARRAY['completed', 'completed', 'payment_received', 'payment_received',
           'customer_approved', 'customer_approved', 'management_approved',
           'management_approved', 'pending_for_customer_approval',
           'pending_for_customer_approval', 'pending_management_approval',
           'pending_management_approval'])[rang] AS etat
  FROM (VALUES
    (1, DATE '2026-02-06', 620), (2, DATE '2026-02-27', 540), (3, DATE '2026-03-20', 700),
    (4, DATE '2026-04-10', 480), (5, DATE '2026-04-30', 810), (6, DATE '2026-05-22', 560),
    (7, DATE '2026-06-12', 640), (8, DATE '2026-06-30', 720), (9, DATE '2026-07-17', 590),
    (10, DATE '2026-07-31', 880), (11, DATE '2026-08-07', 610), (12, DATE '2026-08-14', 750)
  ) AS v(rang, jour, quantite)
),
cotee AS (
  SELECT c.*,
    (SELECT g.london_am_rate FROM gold_prices_daily g WHERE g.price_date <= c.jour
      ORDER BY g.price_date DESC LIMIT 1) AS cours,
    (SELECT cu.id FROM customers cu
      WHERE cu.name = CASE WHEN c.rang % 2 = 1
                           THEN 'Auramet Trading LLC' ELSE 'StoneX Financial Inc.' END
      LIMIT 1) AS client
  FROM calendrier c
),
calcul AS (
  SELECT rang, jour, quantite, etat, cours, client,
         round(quantite * cours, 2) AS brut, round(quantite * cours * 0.03, 2) AS redevance
  FROM cotee
)
INSERT INTO sales
  (sale_number, customer_id, sale_date, quantity_oz, london_am_rate, final_price_per_oz,
   gross_proceeds, royalty_amount, net_proceeds, final_proceeds, total_amount,
   currency, status, seller_type, metal_type, pricing_mechanism)
SELECT 'SL-2026-' || lpad(rang::text, 3, '0'), client, jour, quantite, cours, cours,
  brut, redevance, brut, brut - redevance, brut - redevance,
  'USD', etat::sale_status, 'sonasp', 'gold', 'spot'
FROM calcul
WHERE client IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sales s WHERE s.sale_number = 'SL-2026-' || lpad(calcul.rang::text, 3, '0'));

INSERT INTO payments
  (sale_id, customer_id, expected_date, actual_date, amount, currency, payment_method,
   payment_type, status, reference_number, invoice_number, bank_name, notes)
SELECT s.id, s.customer_id, s.sale_date + 30,
  CASE WHEN s.status = 'completed' THEN s.sale_date + 28 ELSE NULL END,
  s.final_proceeds, 'USD', 'swift', 'actual',
  CASE WHEN s.status = 'completed' THEN 'approved' ELSE 'pending' END,
  'SWIFT-' || replace(s.sale_number, 'SL-', ''), 'FA-' || replace(s.sale_number, 'SL-', ''),
  'Coris Bank International', 'Jeu de présentation — règlement de vente à l’export'
FROM sales s
WHERE s.sale_number LIKE 'SL-2026-%'
  AND s.status IN ('completed', 'payment_received')
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.id);
