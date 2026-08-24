-- Jeu métier contrôlé pour valider le portail Mine avec SOPAMIB et Essakane.
-- La migration est idempotente : toutes les références portent le préfixe
-- PORTAIL-TEST et peuvent être retirées sans toucher aux données réelles.
--
-- Nettoyage manuel, si nécessaire :
--   DELETE FROM sales WHERE sale_number LIKE 'PORTAIL-TEST-SL-%';
--   DELETE FROM shipping_preparations WHERE expedition_lot_number LIKE 'PORTAIL-TEST-EXP-%';
--   DELETE FROM snp_achats_mines WHERE numero_achat LIKE 'PORTAIL-TEST-ACH-%';
--   DELETE FROM daily_production WHERE notes = 'Jeu portail Mine — validation locale';

-- Budgets 2026 : la courbe du tableau de bord reste lisible même si une société
-- n'avait encore défini aucun objectif.
INSERT INTO public.annual_budgets (year, site_id, mining_company_id)
SELECT 2026, 'burkina_faso', mc.id
FROM public.mining_companies mc
WHERE mc.code IN ('SOPAMIB', 'ESK')
  AND NOT EXISTS (
    SELECT 1 FROM public.annual_budgets ab
    WHERE ab.year = 2026 AND ab.mining_company_id = mc.id
  );

WITH objectifs(code, budget_mensuel) AS (
  VALUES ('SOPAMIB', 950::numeric), ('ESK', 3600::numeric)
), mois AS (
  SELECT generate_series(1, 12)::integer AS numero
)
INSERT INTO public.monthly_budgets (
  annual_budget_id, month, budget_oz, days_in_month, daily_budget_oz, mining_company_id
)
SELECT ab.id, mois.numero, objectifs.budget_mensuel,
  extract(day FROM (make_date(2026, mois.numero, 1) + interval '1 month - 1 day'))::integer,
  round(objectifs.budget_mensuel /
    extract(day FROM (make_date(2026, mois.numero, 1) + interval '1 month - 1 day')), 4),
  mc.id
FROM objectifs
JOIN public.mining_companies mc ON mc.code = objectifs.code
JOIN public.annual_budgets ab ON ab.mining_company_id = mc.id AND ab.year = 2026
CROSS JOIN mois
WHERE NOT EXISTS (
  SELECT 1 FROM public.monthly_budgets mb
  WHERE mb.annual_budget_id = ab.id AND mb.month = mois.numero
);

WITH previsions(code, mois, volume) AS (
  VALUES
    ('SOPAMIB', 3, 820::numeric), ('SOPAMIB', 4, 875::numeric),
    ('SOPAMIB', 5, 910::numeric), ('SOPAMIB', 6, 935::numeric),
    ('SOPAMIB', 7, 960::numeric), ('SOPAMIB', 8, 980::numeric),
    ('ESK', 3, 3280::numeric), ('ESK', 4, 3410::numeric),
    ('ESK', 5, 3500::numeric), ('ESK', 6, 3650::numeric),
    ('ESK', 7, 3720::numeric), ('ESK', 8, 3800::numeric)
)
INSERT INTO public.quarterly_forecasts (
  annual_budget_id, quarter, revision_date, month, forecast_oz,
  days_in_month, daily_forecast_oz, notes, mining_company_id
)
SELECT ab.id, ceil(p.mois / 3.0)::integer, DATE '2026-08-20', p.mois, p.volume,
  extract(day FROM (make_date(2026, p.mois, 1) + interval '1 month - 1 day'))::integer,
  round(p.volume /
    extract(day FROM (make_date(2026, p.mois, 1) + interval '1 month - 1 day')), 4),
  'Jeu portail Mine — prévision de validation', mc.id
FROM previsions p
JOIN public.mining_companies mc ON mc.code = p.code
JOIN public.annual_budgets ab ON ab.mining_company_id = mc.id AND ab.year = 2026
WHERE NOT EXISTS (
  SELECT 1 FROM public.quarterly_forecasts qf
  WHERE qf.annual_budget_id = ab.id
    AND qf.quarter = ceil(p.mois / 3.0)::integer
    AND qf.month = p.mois
);

-- Six déclarations par société, réparties sur les six derniers mois visibles.
WITH productions(code, jour, once, titre_or, titre_argent) AS (
  VALUES
    ('SOPAMIB', DATE '2026-03-18', 760::numeric, 91.20::numeric, 5.10::numeric),
    ('SOPAMIB', DATE '2026-04-17', 805::numeric, 91.80::numeric, 4.80::numeric),
    ('SOPAMIB', DATE '2026-05-19', 842::numeric, 92.10::numeric, 4.60::numeric),
    ('SOPAMIB', DATE '2026-06-16', 890::numeric, 91.70::numeric, 4.90::numeric),
    ('SOPAMIB', DATE '2026-07-21', 925::numeric, 92.40::numeric, 4.30::numeric),
    ('SOPAMIB', DATE '2026-08-18', 948::numeric, 92.00::numeric, 4.70::numeric),
    ('ESK', DATE '2026-03-14', 3260::numeric, 92.30::numeric, 4.20::numeric),
    ('ESK', DATE '2026-04-15', 3375::numeric, 92.60::numeric, 4.00::numeric),
    ('ESK', DATE '2026-05-13', 3460::numeric, 91.90::numeric, 4.50::numeric),
    ('ESK', DATE '2026-06-17', 3585::numeric, 92.20::numeric, 4.10::numeric),
    ('ESK', DATE '2026-07-16', 3690::numeric, 92.80::numeric, 3.90::numeric),
    ('ESK', DATE '2026-08-19', 3775::numeric, 92.50::numeric, 4.00::numeric)
), calculees AS (
  SELECT mc.id AS mine_id, mc.code AS company_code, mc.abbreviation,
    p.jour, p.once, p.titre_or, p.titre_argent,
    round(p.once * 31.1034768, 3) AS or_fin_g,
    round((p.once * 31.1034768) / (p.titre_or / 100), 3) AS dore_g
  FROM productions p
  JOIN public.mining_companies mc ON mc.code = p.code AND mc.is_active
)
INSERT INTO public.daily_production (
  production_date, mining_company_id, bullion_grams, estimated_fineness_pct,
  pure_gold_grams, estimated_oz, estimated_gold_pct, estimated_silver_pct,
  silver_content_grams, bar_reference, status, site_id, notes
)
SELECT c.jour, c.mine_id, c.dore_g, c.titre_or, c.or_fin_g, c.once,
  c.titre_or, c.titre_argent, round(c.dore_g * c.titre_argent / 100, 3),
  coalesce(c.abbreviation, c.company_code) || '-P' || to_char(c.jour, 'MM'),
  'ready_for_customs', 'burkina_faso', 'Jeu portail Mine — validation locale'
FROM calculees c
WHERE NOT EXISTS (
  SELECT 1 FROM public.daily_production dp
  WHERE dp.mining_company_id = c.mine_id
    AND dp.bar_reference = coalesce(c.abbreviation, c.company_code) || '-P' || to_char(c.jour, 'MM')
);

-- Un achat SONASP par mine, volontairement limité à une fraction de la
-- production afin de laisser un reliquat vendable par la société.
WITH achats(code, quantite, prix) AS (
  VALUES ('SOPAMIB', 420::numeric, 2680000::numeric), ('ESK', 1250::numeric, 2680000::numeric)
), valeurs AS (
  SELECT mc.id AS mine_id, a.code, a.quantite, a.prix,
    round(a.quantite * a.prix, 0) AS brut
  FROM achats a JOIN public.mining_companies mc ON mc.code = a.code
)
INSERT INTO public.snp_achats_mines (
  numero_achat, mining_company_id, periode_debut, periode_fin, date_achat,
  quantite_oz, quantite_grammes, prix_once_fcfa, montant_brut_fcfa,
  tva_taux, tva_montant_fcfa, taxe_dev_comm_taux,
  taxe_dev_comm_montant_fcfa, montant_total_fcfa, statut, observations
)
SELECT 'PORTAIL-TEST-ACH-' || v.code, v.mine_id, DATE '2026-08-01', DATE '2026-08-31',
  DATE '2026-08-22', v.quantite, round(v.quantite * 31.1034768, 3), v.prix,
  v.brut, 18, round(v.brut * 0.18, 0), 1, round(v.brut * 0.01, 0),
  round(v.brut * 1.19, 0), 'validee', 'Jeu portail Mine — achat partiel SONASP'
FROM valeurs v
WHERE NOT EXISTS (
  SELECT 1 FROM public.snp_achats_mines a
  WHERE a.numero_achat = 'PORTAIL-TEST-ACH-' || v.code
);

-- Une préparation d'expédition directement rattachée à une production de la mine.
WITH sources AS (
  SELECT DISTINCT ON (mc.id) mc.id AS mine_id, mc.code, dp.id AS production_id,
    dp.bullion_grams, dp.estimated_oz
  FROM public.mining_companies mc
  JOIN public.daily_production dp ON dp.mining_company_id = mc.id
  WHERE mc.code IN ('SOPAMIB', 'ESK')
    AND dp.notes = 'Jeu portail Mine — validation locale'
  ORDER BY mc.id, dp.production_date DESC
)
INSERT INTO public.shipping_preparations (
  daily_production_id, mining_company_id, expedition_lot_number, status,
  total_net_weight_grams, total_gross_weight_grams, total_weight_oz,
  total_boxes, notes
)
SELECT s.production_id, s.mine_id, 'PORTAIL-TEST-EXP-' || s.code,
  'waiting_for_customs_approval', s.bullion_grams, s.bullion_grams + 1450,
  s.estimated_oz, 2, 'Jeu portail Mine — expédition de validation'
FROM sources s
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipping_preparations sp
  WHERE sp.expedition_lot_number = 'PORTAIL-TEST-EXP-' || s.code
);

-- Une vente internationale par mine. Les montants respectent le calcul de la
-- plateforme (frais, produit net puis redevance de 3 %).
WITH client AS (
  SELECT id FROM public.customers WHERE is_active IS DISTINCT FROM false ORDER BY created_at LIMIT 1
), ventes(code, quantite, cours, fret, autres) AS (
  VALUES
    ('SOPAMIB', 180::numeric, 2365::numeric, 5400::numeric, 1800::numeric),
    ('ESK', 520::numeric, 2365::numeric, 9800::numeric, 3200::numeric)
), calculees AS (
  SELECT mc.id AS vendeur, v.*, round(v.quantite * v.cours, 2) AS brut,
    round(v.quantite * v.cours - v.fret - v.autres, 2) AS net
  FROM ventes v JOIN public.mining_companies mc ON mc.code = v.code
)
INSERT INTO public.sales (
  sale_number, sale_date, customer_id, seller_id, seller_type, is_internal_sale,
  quantity_oz, london_am_rate, final_price_per_oz, freight_cost, other_costs,
  gross_proceeds, net_proceeds, royalty_amount, final_proceeds, total_amount,
  currency, status, mechanism_type
)
SELECT 'PORTAIL-TEST-SL-' || c.code, DATE '2026-08-21', client.id,
  c.vendeur, 'mining_company', false, c.quantite, c.cours, c.cours,
  c.fret, c.autres, c.brut, c.net, round(c.net * 0.03, 2),
  round(c.net * 0.97, 2), round(c.net * 0.97, 2), 'USD', 'completed', 'spot'
FROM calculees c CROSS JOIN client
WHERE NOT EXISTS (
  SELECT 1 FROM public.sales s WHERE s.sale_number = 'PORTAIL-TEST-SL-' || c.code
);
