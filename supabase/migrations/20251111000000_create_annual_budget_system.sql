/*
  # Create Annual Budget and Forecast System

  1. New Tables
    - `annual_budgets`
      - `id` (uuid, primary key)
      - `year` (integer) - L'année budgétaire
      - `site_id` (text) - Site concerné (guinea, mali, etc.)
      - `created_by` (uuid) - Utilisateur créateur
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint sur (year, site_id)

    - `monthly_budgets`
      - `id` (uuid, primary key)
      - `annual_budget_id` (uuid) - Référence au budget annuel
      - `month` (integer) - Mois (1-12)
      - `budget_oz` (numeric) - Budget mensuel en onces
      - `days_in_month` (integer) - Nombre de jours dans le mois
      - `daily_budget_oz` (numeric) - Budget journalier calculé
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint sur (annual_budget_id, month)

    - `quarterly_forecasts`
      - `id` (uuid, primary key)
      - `annual_budget_id` (uuid) - Référence au budget annuel
      - `quarter` (integer) - Trimestre (1-4)
      - `revision_date` (date) - Date de révision (Mars, Juin, Septembre)
      - `month` (integer) - Mois concerné par le forecast
      - `forecast_oz` (numeric) - Forecast révisé en onces
      - `days_in_month` (integer) - Nombre de jours dans le mois
      - `daily_forecast_oz` (numeric) - Forecast journalier calculé
      - `notes` (text) - Notes sur la révision
      - `created_by` (uuid) - Utilisateur créateur
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Policies for management role only (create, update, view)

  3. Functions
    - Auto-calculate daily budgets based on month days
    - Auto-calculate daily forecasts based on month days
    - Get active budget/forecast for a given date
*/

-- Create annual_budgets table
CREATE TABLE IF NOT EXISTS annual_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  site_id text NOT NULL DEFAULT 'guinea',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_annual_budget UNIQUE (year, site_id)
);

ALTER TABLE annual_budgets ENABLE ROW LEVEL SECURITY;

-- Create monthly_budgets table
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_budget_id uuid NOT NULL REFERENCES annual_budgets(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  budget_oz numeric NOT NULL DEFAULT 0 CHECK (budget_oz >= 0),
  days_in_month integer NOT NULL DEFAULT 30,
  daily_budget_oz numeric GENERATED ALWAYS AS (
    CASE
      WHEN days_in_month > 0 THEN budget_oz / days_in_month
      ELSE 0
    END
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_monthly_budget UNIQUE (annual_budget_id, month)
);

ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

-- Create quarterly_forecasts table
CREATE TABLE IF NOT EXISTS quarterly_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_budget_id uuid NOT NULL REFERENCES annual_budgets(id) ON DELETE CASCADE,
  quarter integer NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  revision_date date NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  forecast_oz numeric NOT NULL DEFAULT 0 CHECK (forecast_oz >= 0),
  days_in_month integer NOT NULL DEFAULT 30,
  daily_forecast_oz numeric GENERATED ALWAYS AS (
    CASE
      WHEN days_in_month > 0 THEN forecast_oz / days_in_month
      ELSE 0
    END
  ) STORED,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_quarterly_forecast UNIQUE (annual_budget_id, quarter, month)
);

ALTER TABLE quarterly_forecasts ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_annual_budgets_year ON annual_budgets(year);
CREATE INDEX IF NOT EXISTS idx_annual_budgets_site ON annual_budgets(site_id);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_annual ON monthly_budgets(annual_budget_id);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_month ON monthly_budgets(month);
CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_annual ON quarterly_forecasts(annual_budget_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_quarter ON quarterly_forecasts(quarter);
CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_month ON quarterly_forecasts(month);
CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_revision ON quarterly_forecasts(revision_date);

-- RLS Policies for annual_budgets
CREATE POLICY "Management can view annual budgets"
  ON annual_budgets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('management', 'factory')
    )
  );

CREATE POLICY "Management can create annual budgets"
  ON annual_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  );

CREATE POLICY "Management can update annual budgets"
  ON annual_budgets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  );

-- RLS Policies for monthly_budgets
CREATE POLICY "Management and factory can view monthly budgets"
  ON monthly_budgets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('management', 'factory')
    )
  );

CREATE POLICY "Management can insert monthly budgets"
  ON monthly_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  );

CREATE POLICY "Management can update monthly budgets"
  ON monthly_budgets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  );

-- RLS Policies for quarterly_forecasts
CREATE POLICY "Management and factory can view quarterly forecasts"
  ON quarterly_forecasts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('management', 'factory')
    )
  );

CREATE POLICY "Management can insert quarterly forecasts"
  ON quarterly_forecasts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  );

CREATE POLICY "Management can update quarterly forecasts"
  ON quarterly_forecasts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'management'
    )
  );

-- Function to auto-update days_in_month when month changes
CREATE OR REPLACE FUNCTION update_days_in_month()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the number of days for the given month in the budget year
  SELECT EXTRACT(DAY FROM
    (DATE_TRUNC('month', make_date(ab.year, NEW.month, 1)) + INTERVAL '1 month - 1 day')
  )::integer
  INTO NEW.days_in_month
  FROM annual_budgets ab
  WHERE ab.id = NEW.annual_budget_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for monthly_budgets
DROP TRIGGER IF EXISTS trigger_update_days_monthly ON monthly_budgets;
CREATE TRIGGER trigger_update_days_monthly
  BEFORE INSERT OR UPDATE OF month, annual_budget_id
  ON monthly_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_days_in_month();

-- Trigger for quarterly_forecasts
DROP TRIGGER IF EXISTS trigger_update_days_quarterly ON quarterly_forecasts;
CREATE TRIGGER trigger_update_days_quarterly
  BEFORE INSERT OR UPDATE OF month, annual_budget_id
  ON quarterly_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_days_in_month();

-- Function to get active budget or forecast for a specific date
CREATE OR REPLACE FUNCTION get_daily_target(
  target_date date,
  site text DEFAULT 'guinea'
)
RETURNS TABLE(
  budget_oz numeric,
  forecast_oz numeric,
  daily_budget_oz numeric,
  daily_forecast_oz numeric,
  source text
) AS $$
DECLARE
  target_year integer;
  target_month integer;
  target_quarter integer;
  budget_id uuid;
BEGIN
  target_year := EXTRACT(YEAR FROM target_date);
  target_month := EXTRACT(MONTH FROM target_date);
  target_quarter := CEIL(target_month / 3.0)::integer;

  -- Get annual budget ID
  SELECT ab.id INTO budget_id
  FROM annual_budgets ab
  WHERE ab.year = target_year
    AND ab.site_id = site
  LIMIT 1;

  IF budget_id IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 'none'::text;
    RETURN;
  END IF;

  -- Check if there's a quarterly forecast for this month
  RETURN QUERY
  SELECT
    mb.budget_oz,
    COALESCE(qf.forecast_oz, mb.budget_oz) as forecast_oz,
    mb.daily_budget_oz,
    COALESCE(qf.daily_forecast_oz, mb.daily_budget_oz) as daily_forecast_oz,
    CASE
      WHEN qf.id IS NOT NULL THEN 'forecast'
      ELSE 'budget'
    END as source
  FROM monthly_budgets mb
  LEFT JOIN quarterly_forecasts qf
    ON qf.annual_budget_id = mb.annual_budget_id
    AND qf.month = mb.month
    AND qf.quarter <= target_quarter
  WHERE mb.annual_budget_id = budget_id
    AND mb.month = target_month
  ORDER BY qf.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_annual_budgets_updated_at ON annual_budgets;
CREATE TRIGGER update_annual_budgets_updated_at
  BEFORE UPDATE ON annual_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_budgets_updated_at ON monthly_budgets;
CREATE TRIGGER update_monthly_budgets_updated_at
  BEFORE UPDATE ON monthly_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quarterly_forecasts_updated_at ON quarterly_forecasts;
CREATE TRIGGER update_quarterly_forecasts_updated_at
  BEFORE UPDATE ON quarterly_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_daily_target(date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_days_in_month() TO authenticated;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated;
