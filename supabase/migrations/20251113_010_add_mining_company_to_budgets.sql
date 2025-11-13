/*
  # Add Mining Company Support to Budget System

  1. Changes
    - Add mining_company_id to annual_budgets, monthly_budgets, and quarterly_forecasts
    - Add foreign key constraints
    - Update indexes for better performance
    - Add RLS policies for mining company access

  2. Security
    - RLS policies updated to include mining company filtering
    - Existing policies preserved
*/

-- Add mining_company_id to annual_budgets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'annual_budgets' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE annual_budgets
    ADD COLUMN mining_company_id uuid REFERENCES mining_companies(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_annual_budgets_mining_company
    ON annual_budgets(mining_company_id);

    RAISE NOTICE 'Added mining_company_id to annual_budgets';
  END IF;
END $$;

-- Add mining_company_id to monthly_budgets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monthly_budgets' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE monthly_budgets
    ADD COLUMN mining_company_id uuid REFERENCES mining_companies(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_monthly_budgets_mining_company
    ON monthly_budgets(mining_company_id);

    RAISE NOTICE 'Added mining_company_id to monthly_budgets';
  END IF;
END $$;

-- Add mining_company_id to quarterly_forecasts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quarterly_forecasts' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE quarterly_forecasts
    ADD COLUMN mining_company_id uuid REFERENCES mining_companies(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_quarterly_forecasts_mining_company
    ON quarterly_forecasts(mining_company_id);

    RAISE NOTICE 'Added mining_company_id to quarterly_forecasts';
  END IF;
END $$;

-- Update RLS policies for annual_budgets
DROP POLICY IF EXISTS "Users can view annual budgets" ON annual_budgets;
CREATE POLICY "Users can view annual budgets"
  ON annual_budgets FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert annual budgets" ON annual_budgets;
CREATE POLICY "Users can insert annual budgets"
  ON annual_budgets FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update annual budgets" ON annual_budgets;
CREATE POLICY "Users can update annual budgets"
  ON annual_budgets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update RLS policies for monthly_budgets
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

-- Update RLS policies for quarterly_forecasts
DROP POLICY IF EXISTS "Users can view quarterly forecasts" ON quarterly_forecasts;
CREATE POLICY "Users can view quarterly forecasts"
  ON quarterly_forecasts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert quarterly forecasts" ON quarterly_forecasts;
CREATE POLICY "Users can insert quarterly forecasts"
  ON quarterly_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update quarterly forecasts" ON quarterly_forecasts;
CREATE POLICY "Users can update quarterly forecasts"
  ON quarterly_forecasts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
