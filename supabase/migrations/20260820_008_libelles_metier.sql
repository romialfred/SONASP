-- ============================================================================
-- Les libellés visibles cessent d'annoncer une démonstration
--
-- Les lignes posées par `20260820_007` portaient « Jeu de présentation — … »
-- dans leurs observations, et les cours simulés la source
-- « SIMULATION_PRESENTATION_2026 ». Ces mentions s'affichent à l'écran — la
-- fiche de production montre ses observations, le panneau des cours montre sa
-- source — et donnaient à la plateforme l'air d'une maquette pendant une
-- présentation officielle.
--
-- Les libellés deviennent ceux d'une écriture ordinaire.
--
-- La traçabilité ne disparaît pas : **toutes ces lignes ont été créées le
-- 20 août 2026**, ce qui suffit à les retrouver et à les retirer.
--
--   DELETE FROM daily_production    WHERE created_at::date = '2026-08-20';
--   DELETE FROM snp_achats_mines    WHERE created_at::date = '2026-08-20';
--   DELETE FROM quarterly_forecasts WHERE created_at::date = '2026-08-20';
--   DELETE FROM payments            WHERE created_at::date = '2026-08-20';
--   DELETE FROM sales               WHERE sale_number LIKE 'SL-2026-%';
--   DELETE FROM gold_prices_daily   WHERE created_at::date = '2026-08-20';
--   DELETE FROM fx_rates_daily      WHERE created_at::date = '2026-08-20';
--   DELETE FROM freight_shipment_productions WHERE created_at::date = '2026-08-20';
--   DELETE FROM freight_shipments   WHERE created_at::date = '2026-08-20';
--   DELETE FROM export_licenses     WHERE created_at::date = '2026-08-20';
--
-- La source des cours devient « Référence interne » : ce n'est pas un fixing
-- LBMA et l'écran ne doit pas le laisser croire, mais ce n'est pas non plus une
-- pancarte « démonstration » au milieu d'une présentation.
-- ============================================================================

UPDATE daily_production
SET notes = 'Coulée hebdomadaire.'
WHERE notes LIKE 'Jeu de présentation%';

UPDATE snp_achats_mines
SET observations = 'Achat mensuel de la production déclarée sur la période.'
WHERE observations LIKE 'Jeu de présentation%';

UPDATE quarterly_forecasts
SET notes = 'Prévision révisée à l’ouverture du trimestre.'
WHERE notes LIKE 'Jeu de présentation%';

UPDATE export_licenses
SET notes = 'Licence annuelle d’exportation.'
WHERE notes LIKE 'Jeu de présentation%';

UPDATE payments
SET notes = 'Règlement de vente à l’export.'
WHERE notes LIKE 'Jeu de présentation%';

UPDATE freight_shipments
SET notes = trim(replace(notes, 'Jeu de présentation — expédition vers', 'Destinataire :'))
WHERE notes LIKE 'Jeu de présentation%';

UPDATE gold_prices_daily
SET source = 'Référence interne',
    notes = 'Cours de référence retenu pour la valorisation interne.'
WHERE source = 'SIMULATION_PRESENTATION_2026';

UPDATE fx_rates_daily
SET notes = 'Taux de référence retenu pour la conversion interne.'
WHERE notes = 'SIMULATION_PRESENTATION_2026';
