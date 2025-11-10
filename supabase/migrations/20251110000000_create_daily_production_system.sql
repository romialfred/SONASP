/*
  # Create Daily Production Management System
  
  1. New Tables
    - `daily_production`
      - `id` (uuid, primary key)
      - `production_date` (date, not null)
      - `bullion_grams` (numeric, total bullion weight in grams)
      - `estimated_fineness_pct` (numeric, estimated fineness percentage)
      - `pure_gold_grams` (numeric, calculated pure gold)
      - `estimated_oz` (numeric, calculated ounces)
      - `bar_reference` (text, bar identifier)
      - `notes` (text, additional notes)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `production_forecasts`
      - `id` (uuid, primary key)
      - `forecast_date` (date, not null)
      - `period_type` (text, 'daily', 'weekly', 'monthly')
      - `forecast_oz` (numeric, forecasted production in oz)
      - `budget_oz` (numeric, budgeted production in oz)
      - `notes` (text)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Security
    - Enable RLS on both tables
    - Add policies for factory and management roles
    
  3. Functions
    - Auto-calculate pure gold and ounces
    - Aggregate weekly/monthly totals
*/

-- Create daily_production table
CREATE TABLE IF NOT EXISTS daily_production (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_date date NOT NULL,
  bullion_grams numeric(12,2) NOT NULL CHECK (bullion_grams >= 0),
  estimated_fineness_pct numeric(5,2) NOT NULL CHECK (estimated_fineness_pct >= 0 AND estimated_fineness_pct <= 100),
  pure_gold_grams numeric(12,2) GENERATED ALWAYS AS (bullion_grams * estimated_fineness_pct / 100) STORED,
  estimated_oz numeric(12,4) GENERATED ALWAYS AS (bullion_grams * estimated_fineness_pct / 100 / 31.1035) STORED,
  bar_reference text,
  notes text,
  site_id text DEFAULT 'guinea',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(production_date, bar_reference, site_id)
);

-- Create production_forecasts table
CREATE TABLE IF NOT EXISTS production_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date date NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  forecast_oz numeric(12,4) CHECK (forecast_oz >= 0),
  budget_oz numeric(12,4) CHECK (budget_oz >= 0),
  notes text,
  site_id text DEFAULT 'guinea',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(forecast_date, period_type, site_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_production_date ON daily_production(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_production_site ON daily_production(site_id);
CREATE INDEX IF NOT EXISTS idx_daily_production_created_by ON daily_production(created_by);
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON production_forecasts(forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_period ON production_forecasts(period_type);
CREATE INDEX IF NOT EXISTS idx_forecasts_site ON production_forecasts(site_id);

-- Enable Row Level Security
ALTER TABLE daily_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_forecasts ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_daily_production_updated_at ON daily_production;
CREATE TRIGGER update_daily_production_updated_at
  BEFORE UPDATE ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_production_forecasts_updated_at ON production_forecasts;
CREATE TRIGGER update_production_forecasts_updated_at
  BEFORE UPDATE ON production_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for daily_production

-- Factory and management can view all production records
CREATE POLICY "Factory and management can view daily production"
  ON daily_production
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('factory', 'management')
        AND user_profiles.is_active = true
    )
  );

-- Factory can insert production records
CREATE POLICY "Factory can insert daily production"
  ON daily_production
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('factory', 'management')
        AND user_profiles.is_active = true
    )
  );

-- Factory can update own records from same day, management can update all
CREATE POLICY "Factory can update daily production"
  ON daily_production
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_active = true
        AND (
          user_profiles.role = 'management'
          OR (
            user_profiles.role = 'factory'
            AND daily_production.created_by = auth.uid()
            AND daily_production.production_date = CURRENT_DATE
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_active = true
        AND (
          user_profiles.role = 'management'
          OR (
            user_profiles.role = 'factory'
            AND daily_production.created_by = auth.uid()
            AND daily_production.production_date = CURRENT_DATE
          )
        )
    )
  );

-- Management can delete production records
CREATE POLICY "Management can delete daily production"
  ON daily_production
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'management'
        AND user_profiles.is_active = true
    )
  );

-- RLS Policies for production_forecasts

-- Factory and management can view forecasts
CREATE POLICY "Factory and management can view forecasts"
  ON production_forecasts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('factory', 'management')
        AND user_profiles.is_active = true
    )
  );

-- Management can insert forecasts
CREATE POLICY "Management can insert forecasts"
  ON production_forecasts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'management'
        AND user_profiles.is_active = true
    )
  );

-- Management can update forecasts
CREATE POLICY "Management can update forecasts"
  ON production_forecasts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'management'
        AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'management'
        AND user_profiles.is_active = true
    )
  );

-- Management can delete forecasts
CREATE POLICY "Management can delete forecasts"
  ON production_forecasts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'management'
        AND user_profiles.is_active = true
    )
  );

-- Create function to get production summary
CREATE OR REPLACE FUNCTION get_production_summary(
  start_date date,
  end_date date,
  site text DEFAULT 'guinea'
)
RETURNS TABLE(
  total_bullion_grams numeric,
  total_pure_gold_grams numeric,
  total_estimated_oz numeric,
  avg_fineness_pct numeric,
  record_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(bullion_grams), 0) as total_bullion_grams,
    COALESCE(SUM(pure_gold_grams), 0) as total_pure_gold_grams,
    COALESCE(SUM(estimated_oz), 0) as total_estimated_oz,
    COALESCE(AVG(estimated_fineness_pct), 0) as avg_fineness_pct,
    COUNT(*) as record_count
  FROM daily_production
  WHERE production_date BETWEEN start_date AND end_date
    AND site_id = site;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to compare actuals vs forecast
CREATE OR REPLACE FUNCTION get_production_variance(
  check_date date,
  period text DEFAULT 'daily',
  site text DEFAULT 'guinea'
)
RETURNS TABLE(
  actual_oz numeric,
  forecast_oz numeric,
  budget_oz numeric,
  variance_vs_forecast numeric,
  variance_vs_budget numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(dp.estimated_oz), 0) as actual_oz,
    COALESCE(pf.forecast_oz, 0) as forecast_oz,
    COALESCE(pf.budget_oz, 0) as budget_oz,
    COALESCE(SUM(dp.estimated_oz), 0) - COALESCE(pf.forecast_oz, 0) as variance_vs_forecast,
    COALESCE(SUM(dp.estimated_oz), 0) - COALESCE(pf.budget_oz, 0) as variance_vs_budget
  FROM daily_production dp
  LEFT JOIN production_forecasts pf ON pf.forecast_date = check_date AND pf.period_type = period AND pf.site_id = site
  WHERE dp.production_date = check_date
    AND dp.site_id = site
  GROUP BY pf.forecast_oz, pf.budget_oz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample data for testing
INSERT INTO daily_production (production_date, bullion_grams, estimated_fineness_pct, bar_reference, site_id)
VALUES 
  ('2025-10-27', 11270, 92.1, 'HUMSMK-1204', 'guinea'),
  ('2025-10-31', 11602, 92.1, 'HUMSMK-1205', 'guinea')
ON CONFLICT (production_date, bar_reference, site_id) DO NOTHING;

-- Insert sample forecasts
INSERT INTO production_forecasts (forecast_date, period_type, forecast_oz, budget_oz, site_id)
VALUES 
  ('2025-11-10', 'daily', 340, 350, 'guinea'),
  ('2025-11-10', 'weekly', 732, 807, 'guinea'),
  ('2025-11-10', 'monthly', 2368, 2735, 'guinea')
ON CONFLICT (forecast_date, period_type, site_id) DO NOTHING;
