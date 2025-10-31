/*
  # Fix Remaining Function Search Path Security Issues

  ## Overview
  This migration fixes search path security issues for all remaining database functions
  by adding explicit search_path settings to prevent search path injection attacks.

  ## Changes
  - Drop and recreate all calculation and utility functions with search_path
  - Drop and recreate all trigger functions with search_path
  - Drop and recreate all analytics and reporting functions with search_path

  ## Security Notes
  - All functions now use explicit search_path = public, pg_temp
  - This prevents malicious schema search path manipulation
  - Functions remain SECURITY DEFINER only where necessary for RLS bypass
*/

-- ============================================================================
-- Drop Existing Functions
-- ============================================================================

DROP FUNCTION IF EXISTS calculate_weight_in_ounces() CASCADE;
DROP FUNCTION IF EXISTS calculate_variance(numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS calculate_final_fine(numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS calculate_sale_proceeds(numeric, numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS trigger_log_batch_status_change() CASCADE;
DROP FUNCTION IF EXISTS trigger_calculate_weight_ounces() CASCADE;
DROP FUNCTION IF EXISTS trigger_calculate_receiving_variance() CASCADE;
DROP FUNCTION IF EXISTS trigger_calculate_refining_fine() CASCADE;
DROP FUNCTION IF EXISTS generate_sale_number() CASCADE;
DROP FUNCTION IF EXISTS set_sale_number() CASCADE;
DROP FUNCTION IF EXISTS refresh_sales_analytics() CASCADE;
DROP FUNCTION IF EXISTS get_available_inventory() CASCADE;
DROP FUNCTION IF EXISTS get_current_exchange_rate(text) CASCADE;
DROP FUNCTION IF EXISTS get_current_gold_price() CASCADE;
DROP FUNCTION IF EXISTS calculate_rate_change(text, integer) CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_cache() CASCADE;

-- ============================================================================
-- Weight and Calculation Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_weight_in_ounces()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.weight_ounces = NEW.weight_grams / 31.1035;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_variance(
  expected_weight numeric,
  actual_weight numeric
)
RETURNS TABLE(
  difference numeric,
  percentage numeric,
  is_significant boolean
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (actual_weight - expected_weight) AS difference,
    CASE
      WHEN expected_weight = 0 THEN 0
      ELSE ROUND(((actual_weight - expected_weight) / expected_weight * 100)::numeric, 2)
    END AS percentage,
    CASE
      WHEN expected_weight = 0 THEN false
      ELSE ABS((actual_weight - expected_weight) / expected_weight * 100) > 2
    END AS is_significant;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_final_fine(
  post_melt_weight numeric,
  fineness_pct numeric,
  metal_retained_pct numeric
)
RETURNS TABLE(
  final_fine_grams numeric,
  final_fine_ounces numeric
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND((post_melt_weight * fineness_pct / 100 * metal_retained_pct / 100)::numeric, 2) AS final_fine_grams,
    ROUND((post_melt_weight * fineness_pct / 100 * metal_retained_pct / 100 / 31.1035)::numeric, 2) AS final_fine_ounces;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_sale_proceeds(
  quantity_oz numeric,
  london_am_rate numeric,
  freight_cost numeric DEFAULT 0,
  other_costs numeric DEFAULT 0
)
RETURNS TABLE(
  gross_proceeds numeric,
  total_costs numeric,
  net_proceeds numeric,
  royalties numeric,
  final_proceeds numeric
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gross numeric;
  v_total_costs numeric;
  v_net numeric;
  v_royalties numeric;
BEGIN
  v_gross := quantity_oz * london_am_rate;
  v_total_costs := freight_cost + other_costs;
  v_net := v_gross - v_total_costs;
  v_royalties := v_net * 0.03;

  RETURN QUERY
  SELECT
    ROUND(v_gross::numeric, 2),
    ROUND(v_total_costs::numeric, 2),
    ROUND(v_net::numeric, 2),
    ROUND(v_royalties::numeric, 2),
    ROUND((v_net - v_royalties)::numeric, 2);
END;
$$;

-- ============================================================================
-- Trigger Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_log_batch_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO batch_status_history (batch_id, status, changed_by, notes)
    VALUES (NEW.id, NEW.status, (select auth.uid()), 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_calculate_weight_ounces()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.weight_ounces = ROUND((NEW.weight_grams / 31.1035)::numeric, 2);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_calculate_receiving_variance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.variance_grams = NEW.received_weight_grams - NEW.expected_weight_grams;
  NEW.variance_percentage = CASE
    WHEN NEW.expected_weight_grams = 0 THEN 0
    ELSE ROUND(((NEW.variance_grams / NEW.expected_weight_grams) * 100)::numeric, 2)
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_calculate_refining_fine()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.final_fine_grams = ROUND((NEW.post_melt_weight_grams * NEW.fineness_percentage / 100 * NEW.metal_retained_percentage / 100)::numeric, 2);
  NEW.final_fine_ounces = ROUND((NEW.final_fine_grams / 31.1035)::numeric, 2);
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Number Generation Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year text;
  v_month text;
  v_sequence text;
  v_count integer;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_month := TO_CHAR(CURRENT_DATE, 'MM');

  SELECT COUNT(*) + 1 INTO v_count
  FROM sales
  WHERE sale_number LIKE 'SL-' || v_year || v_month || '-%';

  v_sequence := LPAD(v_count::text, 4, '0');

  RETURN 'SL-' || v_year || v_month || '-' || v_sequence;
END;
$$;

CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.sale_number IS NULL THEN
    NEW.sale_number := generate_sale_number();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Analytics and Reporting Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_sales_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sales_analytics;
END;
$$;

CREATE OR REPLACE FUNCTION get_available_inventory()
RETURNS TABLE(
  site_id uuid,
  site_name text,
  total_weight_grams numeric,
  total_weight_ounces numeric,
  batch_count bigint
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    COALESCE(SUM(b.weight_grams), 0) AS total_weight_grams,
    COALESCE(SUM(b.weight_ounces), 0) AS total_weight_ounces,
    COUNT(b.id) AS batch_count
  FROM sites s
  LEFT JOIN batches b ON s.id = b.current_site_id
    AND b.status = 'ready_for_sale'
  GROUP BY s.id, s.name
  ORDER BY s.name;
END;
$$;

CREATE OR REPLACE FUNCTION get_current_exchange_rate(p_target_currency text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE target_currency = p_target_currency
    AND rate_date = CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_rate IS NULL THEN
    SELECT rate INTO v_rate
    FROM exchange_rates
    WHERE target_currency = p_target_currency
    ORDER BY rate_date DESC, created_at DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_rate, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_current_gold_price()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_price numeric;
BEGIN
  SELECT london_am_rate INTO v_price
  FROM gold_prices
  WHERE price_date = CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_price IS NULL THEN
    SELECT london_am_rate INTO v_price
    FROM gold_prices
    ORDER BY price_date DESC, created_at DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_price, 0);
END;
$$;

CREATE OR REPLACE FUNCTION calculate_rate_change(
  p_currency text,
  p_days integer
)
RETURNS TABLE(
  current_rate numeric,
  previous_rate numeric,
  change_amount numeric,
  change_percentage numeric
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current numeric;
  v_previous numeric;
BEGIN
  SELECT rate INTO v_current
  FROM exchange_rates
  WHERE target_currency = p_currency
  ORDER BY rate_date DESC, created_at DESC
  LIMIT 1;

  SELECT rate INTO v_previous
  FROM exchange_rates
  WHERE target_currency = p_currency
    AND rate_date <= CURRENT_DATE - p_days
  ORDER BY rate_date DESC, created_at DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    COALESCE(v_current, 0),
    COALESCE(v_previous, 0),
    COALESCE(v_current - v_previous, 0),
    CASE
      WHEN v_previous = 0 OR v_previous IS NULL THEN 0
      ELSE ROUND((((v_current - v_previous) / v_previous) * 100)::numeric, 2)
    END;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM analytics_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================================
-- Recreate Triggers
-- ============================================================================

-- Recreate batch weight calculation trigger
DROP TRIGGER IF EXISTS calculate_batch_weight_ounces ON batches;
CREATE TRIGGER calculate_batch_weight_ounces
  BEFORE INSERT OR UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_weight_ounces();

-- Recreate batch status change logging trigger
DROP TRIGGER IF EXISTS log_batch_status_change ON batches;
CREATE TRIGGER log_batch_status_change
  AFTER UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_batch_status_change();

-- Recreate receiving variance calculation trigger
DROP TRIGGER IF EXISTS calculate_receiving_variance ON receiving_records;
CREATE TRIGGER calculate_receiving_variance
  BEFORE INSERT OR UPDATE ON receiving_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_receiving_variance();

-- Recreate refining fine calculation trigger
DROP TRIGGER IF EXISTS calculate_refining_fine ON refining_records;
CREATE TRIGGER calculate_refining_fine
  BEFORE INSERT OR UPDATE ON refining_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_refining_fine();

-- Recreate sale number generation trigger
DROP TRIGGER IF EXISTS set_sale_number_trigger ON sales;
CREATE TRIGGER set_sale_number_trigger
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number();

-- ============================================================================
-- Add Function Comments for Documentation
-- ============================================================================

COMMENT ON FUNCTION calculate_weight_in_ounces() IS 'Trigger function to automatically calculate weight in ounces from grams';
COMMENT ON FUNCTION calculate_variance(numeric, numeric) IS 'Calculates weight variance with percentage and significance flag';
COMMENT ON FUNCTION calculate_final_fine(numeric, numeric, numeric) IS 'Calculates final fine weight after refining process';
COMMENT ON FUNCTION calculate_sale_proceeds(numeric, numeric, numeric, numeric) IS 'Calculates all sale financial metrics including royalties';
COMMENT ON FUNCTION get_available_inventory() IS 'Returns available inventory summary by site';
COMMENT ON FUNCTION get_current_exchange_rate(text) IS 'Gets most recent exchange rate for specified currency';
COMMENT ON FUNCTION get_current_gold_price() IS 'Gets most recent London AM gold price';
COMMENT ON FUNCTION calculate_rate_change(text, integer) IS 'Calculates exchange rate change over specified number of days';
COMMENT ON FUNCTION cleanup_expired_cache() IS 'Removes expired entries from analytics cache';
COMMENT ON FUNCTION refresh_sales_analytics() IS 'Refreshes materialized view for sales analytics';