/*
  # Enhance Daily Production System

  1. Changes
    - Add mining_company_id to daily_production table
    - Add auto-generation function for bar_reference
    - Add WTD (Week-To-Date) and MTD (Month-To-Date) aggregate views
    - Update RLS policies to support mining company filtering

  2. New Functions
    - generate_bar_reference() for automatic bar reference generation
    - get_wtd_summary() for week-to-date aggregates
    - get_mtd_summary() for month-to-date aggregates
*/

-- Add mining_company_id to daily_production
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE daily_production
    ADD COLUMN mining_company_id uuid REFERENCES mining_companies(id);
  END IF;
END $$;

-- Create index on mining_company_id
CREATE INDEX IF NOT EXISTS idx_daily_production_mining_company
ON daily_production(mining_company_id);

-- Create sequence for bar reference auto-generation
CREATE SEQUENCE IF NOT EXISTS bar_reference_seq START 1000;

-- Function to generate bar reference automatically
CREATE OR REPLACE FUNCTION generate_bar_reference(
  company_name text DEFAULT NULL,
  production_date date DEFAULT CURRENT_DATE
)
RETURNS text AS $$
DECLARE
  prefix text;
  sequence_num text;
  year_month text;
BEGIN
  -- Get company prefix (first 3-5 letters)
  IF company_name IS NOT NULL THEN
    prefix := UPPER(LEFT(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g'), 5));
  ELSE
    prefix := 'PROD';
  END IF;

  -- Get year-month
  year_month := TO_CHAR(production_date, 'YYMM');

  -- Get next sequence number
  sequence_num := LPAD(nextval('bar_reference_seq')::text, 4, '0');

  RETURN prefix || '-' || year_month || '-' || sequence_num;
END;
$$ LANGUAGE plpgsql;

-- Function to get week-to-date summary
CREATE OR REPLACE FUNCTION get_wtd_summary(
  reference_date date DEFAULT CURRENT_DATE,
  company_id uuid DEFAULT NULL,
  site text DEFAULT 'guinea'
)
RETURNS TABLE(
  week_start date,
  week_end date,
  total_bullion_grams numeric,
  total_pure_gold_grams numeric,
  total_estimated_oz numeric,
  avg_fineness_pct numeric,
  record_count bigint,
  forecast_oz numeric,
  budget_oz numeric,
  variance_vs_forecast numeric,
  variance_vs_budget numeric
) AS $$
DECLARE
  week_start_date date;
  week_end_date date;
BEGIN
  -- Calculate week boundaries (Monday to Sunday)
  week_start_date := reference_date - (EXTRACT(DOW FROM reference_date)::int - 1);
  week_end_date := week_start_date + 6;

  RETURN QUERY
  SELECT
    week_start_date,
    week_end_date,
    COALESCE(SUM(dp.bullion_grams), 0) as total_bullion_grams,
    COALESCE(SUM(dp.pure_gold_grams), 0) as total_pure_gold_grams,
    COALESCE(SUM(dp.estimated_oz), 0) as total_estimated_oz,
    COALESCE(AVG(dp.estimated_fineness_pct), 0) as avg_fineness_pct,
    COUNT(dp.*)::bigint as record_count,
    COALESCE(MAX(pf.forecast_oz), 0) as forecast_oz,
    COALESCE(MAX(pf.budget_oz), 0) as budget_oz,
    COALESCE(SUM(dp.estimated_oz), 0) - COALESCE(MAX(pf.forecast_oz), 0) as variance_vs_forecast,
    COALESCE(SUM(dp.estimated_oz), 0) - COALESCE(MAX(pf.budget_oz), 0) as variance_vs_budget
  FROM daily_production dp
  LEFT JOIN production_forecasts pf
    ON pf.forecast_date >= week_start_date
    AND pf.forecast_date <= week_end_date
    AND pf.period_type = 'weekly'
    AND pf.site_id = site
  WHERE dp.production_date >= week_start_date
    AND dp.production_date <= week_end_date
    AND dp.site_id = site
    AND (company_id IS NULL OR dp.mining_company_id = company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get month-to-date summary
CREATE OR REPLACE FUNCTION get_mtd_summary(
  reference_date date DEFAULT CURRENT_DATE,
  company_id uuid DEFAULT NULL,
  site text DEFAULT 'guinea'
)
RETURNS TABLE(
  month_start date,
  month_end date,
  total_bullion_grams numeric,
  total_pure_gold_grams numeric,
  total_estimated_oz numeric,
  avg_fineness_pct numeric,
  record_count bigint,
  forecast_oz numeric,
  budget_oz numeric,
  variance_vs_forecast numeric,
  variance_vs_budget numeric
) AS $$
DECLARE
  month_start_date date;
  month_end_date date;
BEGIN
  -- Calculate month boundaries
  month_start_date := DATE_TRUNC('month', reference_date)::date;
  month_end_date := (DATE_TRUNC('month', reference_date) + INTERVAL '1 month - 1 day')::date;

  RETURN QUERY
  SELECT
    month_start_date,
    month_end_date,
    COALESCE(SUM(dp.bullion_grams), 0) as total_bullion_grams,
    COALESCE(SUM(dp.pure_gold_grams), 0) as total_pure_gold_grams,
    COALESCE(SUM(dp.estimated_oz), 0) as total_estimated_oz,
    COALESCE(AVG(dp.estimated_fineness_pct), 0) as avg_fineness_pct,
    COUNT(dp.*)::bigint as record_count,
    COALESCE(MAX(pf.forecast_oz), 0) as forecast_oz,
    COALESCE(MAX(pf.budget_oz), 0) as budget_oz,
    COALESCE(SUM(dp.estimated_oz), 0) - COALESCE(MAX(pf.forecast_oz), 0) as variance_vs_forecast,
    COALESCE(SUM(dp.estimated_oz), 0) - COALESCE(MAX(pf.budget_oz), 0) as variance_vs_budget
  FROM daily_production dp
  LEFT JOIN production_forecasts pf
    ON DATE_TRUNC('month', pf.forecast_date) = DATE_TRUNC('month', reference_date)
    AND pf.period_type = 'monthly'
    AND pf.site_id = site
  WHERE dp.production_date >= month_start_date
    AND dp.production_date <= month_end_date
    AND dp.site_id = site
    AND (company_id IS NULL OR dp.mining_company_id = company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to allow factory and management access
DROP POLICY IF EXISTS "Factory and management can view production" ON daily_production;
CREATE POLICY "Factory and management can view production"
  ON daily_production
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('factory', 'management')
    )
  );

DROP POLICY IF EXISTS "Factory and management can insert production" ON daily_production;
CREATE POLICY "Factory and management can insert production"
  ON daily_production
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('factory', 'management')
    )
  );

DROP POLICY IF EXISTS "Factory and management can update production" ON daily_production;
CREATE POLICY "Factory and management can update production"
  ON daily_production
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('factory', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('factory', 'management')
    )
  );

DROP POLICY IF EXISTS "Management can delete production" ON daily_production;
CREATE POLICY "Management can delete production"
  ON daily_production
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  );

-- Add trigger to auto-generate bar reference if not provided
CREATE OR REPLACE FUNCTION auto_generate_bar_reference()
RETURNS TRIGGER AS $$
DECLARE
  company_name text;
BEGIN
  IF NEW.bar_reference IS NULL OR NEW.bar_reference = '' THEN
    -- Get mining company name if available
    IF NEW.mining_company_id IS NOT NULL THEN
      SELECT name INTO company_name
      FROM mining_companies
      WHERE id = NEW.mining_company_id;
    END IF;

    NEW.bar_reference := generate_bar_reference(company_name, NEW.production_date);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_bar_reference ON daily_production;
CREATE TRIGGER trigger_auto_generate_bar_reference
  BEFORE INSERT ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_bar_reference();

-- Add mining_company_id to production_forecasts for company-specific forecasts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_forecasts' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE production_forecasts
    ADD COLUMN mining_company_id uuid REFERENCES mining_companies(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_forecasts_mining_company
ON production_forecasts(mining_company_id);

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION generate_bar_reference(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_wtd_summary(date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_mtd_summary(date, uuid, text) TO authenticated;
