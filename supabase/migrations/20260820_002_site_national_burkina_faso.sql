-- ============================================================================
-- Identité du site national : Burkina Faso, non Guinée
--
-- `daily_production`, `annual_budgets` et `production_forecasts` portaient
-- `site_id = 'guinea'`, hérité d'un autre déploiement. Le code filtrait sur la
-- même valeur, si bien que rien ne se voyait comme anormal : la plateforme
-- burkinabè rangeait sa production sous un site guinéen.
--
-- La valeur devient `burkina_faso`, alignée sur `SITE_NATIONAL`
-- (`src/constants/site.ts`). Aucune ligne n'est perdue : seule la clé change.
--
-- Retour arrière :
--   UPDATE daily_production SET site_id = 'guinea' WHERE site_id = 'burkina_faso';
--   UPDATE annual_budgets SET site_id = 'guinea' WHERE site_id = 'burkina_faso';
--   UPDATE production_forecasts SET site_id = 'guinea' WHERE site_id = 'burkina_faso';
-- ============================================================================

UPDATE daily_production
SET site_id = 'burkina_faso'
WHERE site_id IS NULL OR lower(site_id) IN ('guinea', 'guinée', 'guinee');

UPDATE annual_budgets
SET site_id = 'burkina_faso'
WHERE site_id IS NULL OR lower(site_id) IN ('guinea', 'guinée', 'guinee');

UPDATE production_forecasts
SET site_id = 'burkina_faso'
WHERE site_id IS NULL OR lower(site_id) IN ('guinea', 'guinée', 'guinee');
