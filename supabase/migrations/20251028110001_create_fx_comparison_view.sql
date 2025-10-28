/*
  # Create FX Rate Comparison View

  1. New View
    - Creates a view to compare FX rates across different sources for the same date and currency pair
    - Allows easy comparison of rates from different banks

  2. Features
    - Shows all rates for a given date and currency pair
    - Calculates spread between highest and lowest rates
    - Shows percentage difference from average rate
*/

-- Create view for FX rate comparison
CREATE OR REPLACE VIEW fx_rate_comparison AS
WITH daily_stats AS (
  SELECT
    rate_date,
    currency_pair,
    AVG(rate) as avg_rate,
    MIN(rate) as min_rate,
    MAX(rate) as max_rate,
    MAX(rate) - MIN(rate) as spread,
    COUNT(*) as source_count
  FROM fx_rates_daily
  GROUP BY rate_date, currency_pair
)
SELECT
  d.id,
  d.rate_date,
  d.currency_pair,
  d.source_id,
  s.name as source_name,
  s.code as source_code,
  s.country as source_country,
  d.rate,
  d.bid_rate,
  d.ask_rate,
  d.spread as bid_ask_spread,
  ds.avg_rate,
  ds.min_rate,
  ds.max_rate,
  ds.spread as market_spread,
  ds.source_count,
  ROUND(((d.rate - ds.avg_rate) / ds.avg_rate * 100)::numeric, 4) as deviation_from_avg_pct,
  CASE
    WHEN d.rate = ds.min_rate THEN 'LOWEST'
    WHEN d.rate = ds.max_rate THEN 'HIGHEST'
    ELSE 'MIDDLE'
  END as rate_position,
  d.notes,
  d.created_at,
  d.updated_at
FROM fx_rates_daily d
INNER JOIN fx_rate_sources s ON d.source_id = s.id
INNER JOIN daily_stats ds ON d.rate_date = ds.rate_date AND d.currency_pair = ds.currency_pair
WHERE s.is_active = true
ORDER BY d.rate_date DESC, d.currency_pair, d.rate;

-- Grant access to authenticated users
GRANT SELECT ON fx_rate_comparison TO authenticated;
