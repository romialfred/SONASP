/*
  # FIX - Fonctions RPC pour les Résumés de Production

  ## Problème
  Les fonctions existent déjà avec une signature différente.

  ## Solution
  1. Supprimer les anciennes fonctions (DROP)
  2. Créer les nouvelles avec la bonne signature
*/

-- =====================================================
-- ÉTAPE 1: SUPPRIMER LES ANCIENNES FONCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS get_wtd_summary(date, uuid, text);
DROP FUNCTION IF EXISTS get_mtd_summary(date, uuid, text);
DROP FUNCTION IF EXISTS get_ytd_summary(date, uuid, text);

-- =====================================================
-- ÉTAPE 2: CRÉER LES NOUVELLES FONCTIONS
-- =====================================================

-- FONCTION: get_wtd_summary (Week to Date)
CREATE OR REPLACE FUNCTION get_wtd_summary(
  reference_date date DEFAULT CURRENT_DATE,
  company_id uuid DEFAULT NULL,
  site text DEFAULT 'guinea'
)
RETURNS TABLE (
  total_bullion_grams numeric,
  total_pure_gold_grams numeric,
  total_estimated_oz numeric,
  avg_fineness_pct numeric,
  record_count bigint,
  forecast_oz numeric,
  budget_oz numeric,
  variance_vs_forecast numeric,
  variance_vs_budget numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  week_start date;
  week_end date;
  current_year integer;
  current_month integer;
  actual_oz numeric;
  budget_value numeric;
  forecast_value numeric;
BEGIN
  -- Calculer le début de la semaine (lundi)
  week_start := date_trunc('week', reference_date)::date;
  week_end := reference_date;

  -- Extraire année et mois
  current_year := EXTRACT(YEAR FROM reference_date);
  current_month := EXTRACT(MONTH FROM reference_date);

  -- Calculer le total réalisé (Actual) depuis daily_production
  SELECT
    COALESCE(SUM(bullion_grams), 0),
    COALESCE(SUM(pure_gold_grams), 0),
    COALESCE(SUM(estimated_oz), 0),
    CASE WHEN COUNT(*) > 0
      THEN AVG(estimated_fineness_pct)
      ELSE 0
    END,
    COUNT(*)
  INTO
    total_bullion_grams,
    total_pure_gold_grams,
    actual_oz,
    avg_fineness_pct,
    record_count
  FROM daily_production
  WHERE production_date >= week_start
    AND production_date <= week_end
    AND site_id = site
    AND (company_id IS NULL OR mining_company_id = company_id)
    AND status != 'cancelled';

  -- Récupérer le Budget du mois en cours
  SELECT COALESCE(mb.budget_oz, 0)
  INTO budget_value
  FROM monthly_budgets mb
  JOIN annual_budgets ab ON ab.id = mb.annual_budget_id
  WHERE ab.year = current_year
    AND mb.month = current_month
    AND ab.site_id = site
    AND (company_id IS NULL OR mb.mining_company_id = company_id)
  LIMIT 1;

  -- Récupérer le Forecast du trimestre en cours
  SELECT COALESCE(qf.forecast_oz, 0)
  INTO forecast_value
  FROM quarterly_forecasts qf
  JOIN annual_budgets ab ON ab.id = qf.annual_budget_id
  WHERE ab.year = current_year
    AND qf.month = current_month
    AND ab.site_id = site
    AND (company_id IS NULL OR qf.mining_company_id = company_id)
  ORDER BY qf.revision_date DESC
  LIMIT 1;

  -- Si pas de forecast, utiliser le budget
  IF forecast_value = 0 THEN
    forecast_value := budget_value;
  END IF;

  -- Calculer les variances
  total_estimated_oz := actual_oz;
  forecast_oz := forecast_value;
  budget_oz := budget_value;
  variance_vs_forecast := actual_oz - forecast_value;
  variance_vs_budget := actual_oz - budget_value;

  RETURN NEXT;
END;
$$;

-- FONCTION: get_mtd_summary (Month to Date)
CREATE OR REPLACE FUNCTION get_mtd_summary(
  reference_date date DEFAULT CURRENT_DATE,
  company_id uuid DEFAULT NULL,
  site text DEFAULT 'guinea'
)
RETURNS TABLE (
  total_bullion_grams numeric,
  total_pure_gold_grams numeric,
  total_estimated_oz numeric,
  avg_fineness_pct numeric,
  record_count bigint,
  forecast_oz numeric,
  budget_oz numeric,
  variance_vs_forecast numeric,
  variance_vs_budget numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  month_start date;
  month_end date;
  current_year integer;
  current_month integer;
  actual_oz numeric;
  budget_value numeric;
  forecast_value numeric;
BEGIN
  -- Calculer le début du mois
  month_start := date_trunc('month', reference_date)::date;
  month_end := reference_date;

  -- Extraire année et mois
  current_year := EXTRACT(YEAR FROM reference_date);
  current_month := EXTRACT(MONTH FROM reference_date);

  -- Calculer le total réalisé (Actual) depuis daily_production
  SELECT
    COALESCE(SUM(bullion_grams), 0),
    COALESCE(SUM(pure_gold_grams), 0),
    COALESCE(SUM(estimated_oz), 0),
    CASE WHEN COUNT(*) > 0
      THEN AVG(estimated_fineness_pct)
      ELSE 0
    END,
    COUNT(*)
  INTO
    total_bullion_grams,
    total_pure_gold_grams,
    actual_oz,
    avg_fineness_pct,
    record_count
  FROM daily_production
  WHERE production_date >= month_start
    AND production_date <= month_end
    AND site_id = site
    AND (company_id IS NULL OR mining_company_id = company_id)
    AND status != 'cancelled';

  -- Récupérer le Budget du mois en cours
  SELECT COALESCE(mb.budget_oz, 0)
  INTO budget_value
  FROM monthly_budgets mb
  JOIN annual_budgets ab ON ab.id = mb.annual_budget_id
  WHERE ab.year = current_year
    AND mb.month = current_month
    AND ab.site_id = site
    AND (company_id IS NULL OR mb.mining_company_id = company_id)
  LIMIT 1;

  -- Récupérer le Forecast du trimestre en cours
  SELECT COALESCE(qf.forecast_oz, 0)
  INTO forecast_value
  FROM quarterly_forecasts qf
  JOIN annual_budgets ab ON ab.id = qf.annual_budget_id
  WHERE ab.year = current_year
    AND qf.month = current_month
    AND ab.site_id = site
    AND (company_id IS NULL OR qf.mining_company_id = company_id)
  ORDER BY qf.revision_date DESC
  LIMIT 1;

  -- Si pas de forecast, utiliser le budget
  IF forecast_value = 0 THEN
    forecast_value := budget_value;
  END IF;

  -- Calculer les variances
  total_estimated_oz := actual_oz;
  forecast_oz := forecast_value;
  budget_oz := budget_value;
  variance_vs_forecast := actual_oz - forecast_value;
  variance_vs_budget := actual_oz - budget_value;

  RETURN NEXT;
END;
$$;

-- FONCTION: get_ytd_summary (Year to Date)
CREATE OR REPLACE FUNCTION get_ytd_summary(
  reference_date date DEFAULT CURRENT_DATE,
  company_id uuid DEFAULT NULL,
  site text DEFAULT 'guinea'
)
RETURNS TABLE (
  total_bullion_grams numeric,
  total_pure_gold_grams numeric,
  total_estimated_oz numeric,
  avg_fineness_pct numeric,
  record_count bigint,
  forecast_oz numeric,
  budget_oz numeric,
  variance_vs_forecast numeric,
  variance_vs_budget numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  year_start date;
  year_end date;
  current_year integer;
  actual_oz numeric;
  budget_value numeric;
  forecast_value numeric;
BEGIN
  -- Calculer le début de l'année
  year_start := date_trunc('year', reference_date)::date;
  year_end := reference_date;

  -- Extraire année
  current_year := EXTRACT(YEAR FROM reference_date);

  -- Calculer le total réalisé (Actual) depuis daily_production
  SELECT
    COALESCE(SUM(bullion_grams), 0),
    COALESCE(SUM(pure_gold_grams), 0),
    COALESCE(SUM(estimated_oz), 0),
    CASE WHEN COUNT(*) > 0
      THEN AVG(estimated_fineness_pct)
      ELSE 0
    END,
    COUNT(*)
  INTO
    total_bullion_grams,
    total_pure_gold_grams,
    actual_oz,
    avg_fineness_pct,
    record_count
  FROM daily_production
  WHERE production_date >= year_start
    AND production_date <= year_end
    AND site_id = site
    AND (company_id IS NULL OR mining_company_id = company_id)
    AND status != 'cancelled';

  -- Récupérer le Budget total de l'année
  SELECT COALESCE(SUM(mb.budget_oz), 0)
  INTO budget_value
  FROM monthly_budgets mb
  JOIN annual_budgets ab ON ab.id = mb.annual_budget_id
  WHERE ab.year = current_year
    AND ab.site_id = site
    AND (company_id IS NULL OR mb.mining_company_id = company_id);

  -- Récupérer le Forecast total de l'année (somme de tous les mois)
  SELECT COALESCE(SUM(qf.forecast_oz), 0)
  INTO forecast_value
  FROM (
    SELECT DISTINCT ON (qf.month) qf.forecast_oz
    FROM quarterly_forecasts qf
    JOIN annual_budgets ab ON ab.id = qf.annual_budget_id
    WHERE ab.year = current_year
      AND ab.site_id = site
      AND (company_id IS NULL OR qf.mining_company_id = company_id)
    ORDER BY qf.month, qf.revision_date DESC
  ) qf;

  -- Si pas de forecast, utiliser le budget
  IF forecast_value = 0 THEN
    forecast_value := budget_value;
  END IF;

  -- Calculer les variances
  total_estimated_oz := actual_oz;
  forecast_oz := forecast_value;
  budget_oz := budget_value;
  variance_vs_forecast := actual_oz - forecast_value;
  variance_vs_budget := actual_oz - budget_value;

  RETURN NEXT;
END;
$$;

-- =====================================================
-- ÉTAPE 3: DONNER LES PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION get_wtd_summary(date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_mtd_summary(date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ytd_summary(date, uuid, text) TO authenticated;

-- =====================================================
-- ÉTAPE 4: VÉRIFICATION
-- =====================================================

-- Cette requête doit retourner 3 lignes
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE 'get_%td_summary'
ORDER BY routine_name;
