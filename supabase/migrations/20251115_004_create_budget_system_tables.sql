/*
  # Create Budget System Tables

  1. Tables
    - annual_budgets: Store annual budget configuration per year/site/company
    - monthly_budgets: Store monthly budget allocations
    - quarterly_forecasts: Store quarterly forecast revisions

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- =====================================================
-- TABLE: annual_budgets
-- =====================================================

CREATE TABLE IF NOT EXISTS annual_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  site_id text NOT NULL DEFAULT 'guinea',
  mining_company_id uuid REFERENCES mining_companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint: One budget per year/site/company combination
-- Using unique index with NULLS NOT DISTINCT for proper NULL handling
CREATE UNIQUE INDEX IF NOT EXISTS unique_annual_budget_with_company
  ON annual_budgets (year, site_id, mining_company_id)
  WHERE mining_company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_annual_budget_without_company
  ON annual_budgets (year, site_id)
  WHERE mining_company_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_annual_budgets_year ON annual_budgets(year);
CREATE INDEX IF NOT EXISTS idx_annual_budgets_site ON annual_budgets(site_id);
CREATE INDEX IF NOT EXISTS idx_annual_budgets_company ON annual_budgets(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_annual_budgets_created_by ON annual_budgets(created_by);

-- Enable RLS
ALTER TABLE annual_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view annual budgets" ON annual_budgets;
CREATE POLICY "Users can view annual budgets"
  ON annual_budgets FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert annual budgets" ON annual_budgets;
CREATE POLICY "Users can insert annual budgets"
  ON annual_budgets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update annual budgets" ON annual_budgets;
CREATE POLICY "Users can update annual budgets"
  ON annual_budgets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete annual budgets" ON annual_budgets;
CREATE POLICY "Users can delete annual budgets"
  ON annual_budgets FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- TABLE: monthly_budgets
-- =====================================================

CREATE TABLE IF NOT EXISTS monthly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_budget_id uuid NOT NULL REFERENCES annual_budgets(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  budget_oz numeric(12, 4) NOT NULL DEFAULT 0,
  days_in_month integer NOT NULL,
  daily_budget_oz numeric(12, 4) NOT NULL DEFAULT 0,
  mining_company_id uuid REFERENCES mining_companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint: One budget per annual_budget/month
  CONSTRAINT unique_monthly_budget UNIQUE (annual_budget_id, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_annual ON monthly_budgets(annual_budget_id);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_month ON monthly_budgets(month);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_company ON monthly_budgets(mining_company_id);

-- Enable RLS
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view monthly budgets" ON monthly_budgets;
CREATE POLICY "Users can view monthly budgets"
  ON monthly_budgets FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert monthly budgets" ON monthly_budgets;
CREATE POLICY "Users can insert monthly budgets"
  ON monthly_budgets FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update monthly budgets" ON monthly_budgets;
CREATE POLICY "Users can update monthly budgets"
  ON monthly_budgets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete monthly budgets" ON monthly_budgets;
CREATE POLICY "Users can delete monthly budgets"
  ON monthly_budgets FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- TABLE: quarterly_forecasts
-- =====================================================

CREATE TABLE IF NOT EXISTS quarterly_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_budget_id uuid NOT NULL REFERENCES annual_budgets(id) ON DELETE CASCADE,
  quarter integer NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  revision_date date NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  forecast_oz numeric(12, 4) NOT NULL DEFAULT 0,
  days_in_month integer NOT NULL,
  daily_forecast_oz numeric(12, 4) NOT NULL DEFAULT 0,
  notes text,
  mining_company_id uuid REFERENCES mining_companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint: One forecast per annual_budget/quarter/month
  CONSTRAINT unique_quarterly_forecast UNIQUE (annual_budget_id, quarter, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_annual ON quarterly_forecasts(annual_budget_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_quarter ON quarterly_forecasts(quarter);
CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_month ON quarterly_forecasts(month);
CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_company ON quarterly_forecasts(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_created_by ON quarterly_forecasts(created_by);

-- Enable RLS
ALTER TABLE quarterly_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view quarterly forecasts" ON quarterly_forecasts;
CREATE POLICY "Users can view quarterly forecasts"
  ON quarterly_forecasts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert quarterly forecasts" ON quarterly_forecasts;
CREATE POLICY "Users can insert quarterly forecasts"
  ON quarterly_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update quarterly forecasts" ON quarterly_forecasts;
CREATE POLICY "Users can update quarterly forecasts"
  ON quarterly_forecasts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete quarterly forecasts" ON quarterly_forecasts;
CREATE POLICY "Users can delete quarterly forecasts"
  ON quarterly_forecasts FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- TRIGGERS: Auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
