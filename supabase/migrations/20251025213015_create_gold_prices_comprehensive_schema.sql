/*
  # Create Comprehensive Gold Prices Schema
  
  ## Overview
  This migration creates a complete gold price management system with:
  - Daily gold prices (London AM/PM, spot prices)
  - Monthly aggregate prices
  - Historical price tracking
  - Sales price comparison capabilities
  
  ## New Tables
  
  ### `gold_prices_daily`
  Stores daily gold price data with multiple price points
  
  ### `gold_prices_monthly`
  Stores monthly aggregate gold price data
  
  ## Security
  - Enable RLS on all tables
  - Policies for authenticated users to read
  - Management role can insert/update prices
*/

-- Create gold_prices_daily table
CREATE TABLE IF NOT EXISTS gold_prices_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date date NOT NULL UNIQUE,
  london_am_rate numeric(10,2) NOT NULL,
  london_pm_rate numeric(10,2),
  spot_price numeric(10,2),
  average_price numeric(10,2),
  high_price numeric(10,2),
  low_price numeric(10,2),
  source text DEFAULT 'manual',
  currency text DEFAULT 'USD',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gold_prices_daily_date ON gold_prices_daily(price_date DESC);
CREATE INDEX IF NOT EXISTS idx_gold_prices_daily_year_month ON gold_prices_daily(EXTRACT(YEAR FROM price_date), EXTRACT(MONTH FROM price_date));

-- Create gold_prices_monthly table
CREATE TABLE IF NOT EXISTS gold_prices_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  average_price numeric(10,2) NOT NULL,
  high_price numeric(10,2) NOT NULL,
  low_price numeric(10,2) NOT NULL,
  opening_price numeric(10,2),
  closing_price numeric(10,2),
  total_days integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_gold_prices_monthly_year_month ON gold_prices_monthly(year DESC, month DESC);

-- Enable RLS
ALTER TABLE gold_prices_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_prices_monthly ENABLE ROW LEVEL SECURITY;

-- Policies for gold_prices_daily
CREATE POLICY "Anyone can view daily gold prices"
  ON gold_prices_daily
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can insert daily gold prices"
  ON gold_prices_daily
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can update daily gold prices"
  ON gold_prices_daily
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Policies for gold_prices_monthly
CREATE POLICY "Anyone can view monthly gold prices"
  ON gold_prices_monthly
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can insert monthly gold prices"
  ON gold_prices_monthly
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can update monthly gold prices"
  ON gold_prices_monthly
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Function to calculate and update monthly aggregates
CREATE OR REPLACE FUNCTION calculate_monthly_gold_price_aggregate(p_year integer, p_month integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO gold_prices_monthly (
    year,
    month,
    average_price,
    high_price,
    low_price,
    opening_price,
    closing_price,
    total_days
  )
  SELECT
    p_year,
    p_month,
    AVG(london_am_rate),
    MAX(high_price),
    MIN(low_price),
    (SELECT london_am_rate FROM gold_prices_daily 
     WHERE EXTRACT(YEAR FROM price_date) = p_year 
     AND EXTRACT(MONTH FROM price_date) = p_month 
     ORDER BY price_date ASC LIMIT 1),
    (SELECT london_am_rate FROM gold_prices_daily 
     WHERE EXTRACT(YEAR FROM price_date) = p_year 
     AND EXTRACT(MONTH FROM price_date) = p_month 
     ORDER BY price_date DESC LIMIT 1),
    COUNT(*)
  FROM gold_prices_daily
  WHERE EXTRACT(YEAR FROM price_date) = p_year
    AND EXTRACT(MONTH FROM price_date) = p_month
  ON CONFLICT (year, month) 
  DO UPDATE SET
    average_price = EXCLUDED.average_price,
    high_price = EXCLUDED.high_price,
    low_price = EXCLUDED.low_price,
    opening_price = EXCLUDED.opening_price,
    closing_price = EXCLUDED.closing_price,
    total_days = EXCLUDED.total_days,
    updated_at = now();
END;
$$;

-- Trigger to auto-calculate monthly aggregates
CREATE OR REPLACE FUNCTION trigger_update_monthly_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM calculate_monthly_gold_price_aggregate(
    EXTRACT(YEAR FROM NEW.price_date)::integer,
    EXTRACT(MONTH FROM NEW.price_date)::integer
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_monthly_aggregate_on_insert
  AFTER INSERT ON gold_prices_daily
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_monthly_aggregate();

CREATE TRIGGER update_monthly_aggregate_on_update
  AFTER UPDATE ON gold_prices_daily
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_monthly_aggregate();

-- Create view for sales price analysis
CREATE OR REPLACE VIEW v_sales_price_analysis AS
SELECT
  s.id as sale_id,
  s.sale_number,
  s.created_at::date as sale_date,
  EXTRACT(YEAR FROM s.created_at)::integer as year,
  EXTRACT(MONTH FROM s.created_at)::integer as month,
  s.quantity_oz,
  s.london_am_rate as sale_price_per_oz,
  gp.london_am_rate as market_price_per_oz,
  gp.average_price as market_avg_price,
  (s.london_am_rate - gp.london_am_rate) as variance_usd,
  CASE 
    WHEN gp.london_am_rate > 0 AND s.london_am_rate IS NOT NULL THEN
      ((s.london_am_rate - gp.london_am_rate) / gp.london_am_rate * 100)
    ELSE 0
  END as variance_percent,
  s.gross_proceeds as total_sale_value,
  (gp.london_am_rate * s.quantity_oz) as total_market_value,
  (s.gross_proceeds - (gp.london_am_rate * s.quantity_oz)) as total_variance_usd,
  c.name as customer_name,
  s.status
FROM sales s
LEFT JOIN gold_prices_daily gp ON gp.price_date = s.created_at::date
LEFT JOIN customers c ON c.id = s.customer_id
WHERE s.status IN ('approved', 'completed', 'paid');

-- Create view for monthly sales vs market comparison
CREATE OR REPLACE VIEW v_monthly_sales_vs_market AS
SELECT
  EXTRACT(YEAR FROM s.created_at)::integer as year,
  EXTRACT(MONTH FROM s.created_at)::integer as month,
  COUNT(s.id) as total_sales,
  SUM(s.quantity_oz) as total_quantity_oz,
  AVG(s.london_am_rate) as avg_sale_price,
  gpm.average_price as avg_market_price,
  (AVG(s.london_am_rate) - gpm.average_price) as avg_variance_usd,
  CASE 
    WHEN gpm.average_price > 0 THEN
      ((AVG(s.london_am_rate) - gpm.average_price) / gpm.average_price * 100)
    ELSE 0
  END as avg_variance_percent,
  SUM(s.gross_proceeds - (COALESCE(gp.london_am_rate, gpm.average_price) * s.quantity_oz)) as total_variance_usd
FROM sales s
LEFT JOIN gold_prices_daily gp ON gp.price_date = s.created_at::date
LEFT JOIN gold_prices_monthly gpm ON gpm.year = EXTRACT(YEAR FROM s.created_at)::integer 
  AND gpm.month = EXTRACT(MONTH FROM s.created_at)::integer
WHERE s.status IN ('approved', 'completed', 'paid')
GROUP BY 
  EXTRACT(YEAR FROM s.created_at)::integer,
  EXTRACT(MONTH FROM s.created_at)::integer,
  gpm.average_price,
  gpm.high_price,
  gpm.low_price
ORDER BY year DESC, month DESC;
