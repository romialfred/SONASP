/*
  # Enhanced Database Functions, Triggers, and Views

  ## Overview
  Adds comprehensive business logic functions, automated triggers, and optimized views
  for the Gold Shipper application.

  ## New Functions
  - Weight conversion and calculation functions
  - Variance detection and significance checking
  - Sales proceeds calculation with all components
  - Inventory availability queries
  - Dashboard metrics aggregation by role
  - Approval workflow queries

  ## New Triggers
  - Automatic batch status history logging
  - Automatic weight conversion on batch changes
  - Automatic variance calculation on receiving
  - Automatic final fine calculation on refining

  ## New Views
  - v_batch_summary - Complete batch information with related data
  - v_sales_summary - Sales with customer and payment details
  - v_customer_performance - Aggregated customer metrics
  - v_inventory_status - Current inventory by site
*/

-- Weight conversion function
CREATE OR REPLACE FUNCTION calculate_weight_in_ounces(grams numeric)
RETURNS numeric AS $$
BEGIN
  RETURN ROUND((grams * 0.03527396195)::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Variance calculation function
CREATE OR REPLACE FUNCTION calculate_variance(
  expected numeric,
  actual numeric,
  OUT difference numeric,
  OUT percentage numeric,
  OUT is_significant boolean
)
AS $$
BEGIN
  difference := actual - expected;
  IF expected != 0 THEN
    percentage := ROUND(((difference / expected) * 100)::numeric, 2);
  ELSE
    percentage := 0;
  END IF;
  is_significant := ABS(percentage) > 2;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Final fine calculation function
CREATE OR REPLACE FUNCTION calculate_final_fine(
  post_melting_weight numeric,
  fineness_percentage numeric,
  metal_retained_percentage numeric,
  OUT final_fine_grams numeric,
  OUT final_fine_ounces numeric
)
AS $$
BEGIN
  final_fine_grams := ROUND((post_melting_weight * (fineness_percentage / 100) * (metal_retained_percentage / 100))::numeric, 2);
  final_fine_ounces := calculate_weight_in_ounces(final_fine_grams);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Sale proceeds calculation function
CREATE OR REPLACE FUNCTION calculate_sale_proceeds(
  quantity_oz numeric,
  london_am_rate numeric,
  freight_cost numeric DEFAULT 0,
  other_costs numeric DEFAULT 0,
  OUT gross_proceeds numeric,
  OUT net_proceeds numeric,
  OUT royalties numeric,
  OUT final_proceeds numeric
)
AS $$
BEGIN
  gross_proceeds := ROUND((quantity_oz * london_am_rate)::numeric, 2);
  net_proceeds := ROUND((gross_proceeds - freight_cost - other_costs)::numeric, 2);
  royalties := ROUND((net_proceeds * 0.03)::numeric, 2);
  final_proceeds := ROUND((net_proceeds - royalties)::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get available inventory
CREATE OR REPLACE FUNCTION get_available_inventory()
RETURNS TABLE(
  batch_id uuid,
  batch_number text,
  available_ounces numeric,
  site_name text,
  processed_date timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.batch_number,
    COALESCE(rr.final_fine_ounces, b.weight_ounces) - COALESCE(sold.total_sold, 0) as available_ounces,
    s.name,
    rr.approved_at
  FROM batches b
  LEFT JOIN sites s ON b.current_site_id = s.id
  LEFT JOIN refining_records rr ON b.id = rr.batch_id AND rr.approved_at IS NOT NULL
  LEFT JOIN (
    SELECT batch_id, SUM(quantity_oz) as total_sold
    FROM sales
    WHERE status IN ('approved', 'customer_approved', 'payment_received', 'completed')
    GROUP BY batch_id
  ) sold ON b.id = sold.batch_id
  WHERE b.status = 'ready_for_sale'
    AND (COALESCE(rr.final_fine_ounces, b.weight_ounces) - COALESCE(sold.total_sold, 0)) > 0
  ORDER BY rr.approved_at ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log batch status changes
CREATE OR REPLACE FUNCTION trigger_log_batch_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO batch_status_history (batch_id, status, changed_by, previous_status, comments)
    VALUES (NEW.id, NEW.status, NEW.created_by, OLD.status, 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS batch_status_change_logger ON batches;
CREATE TRIGGER batch_status_change_logger
  AFTER UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_batch_status_change();

-- Trigger to calculate weight in ounces
CREATE OR REPLACE FUNCTION trigger_calculate_weight_ounces()
RETURNS TRIGGER AS $$
BEGIN
  NEW.weight_ounces := calculate_weight_in_ounces(NEW.weight_grams);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS batch_weight_calculator ON batches;
CREATE TRIGGER batch_weight_calculator
  BEFORE INSERT OR UPDATE OF weight_grams ON batches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_weight_ounces();

-- Trigger to calculate receiving variance
CREATE OR REPLACE FUNCTION trigger_calculate_receiving_variance()
RETURNS TRIGGER AS $$
DECLARE
  variance_result RECORD;
BEGIN
  SELECT * INTO variance_result
  FROM calculate_variance(NEW.expected_weight_grams, NEW.actual_weight_grams);
  
  NEW.variance_grams := variance_result.difference;
  NEW.variance_percentage := variance_result.percentage;
  NEW.is_significant_variance := variance_result.is_significant;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS receiving_variance_calculator ON receiving_records;
CREATE TRIGGER receiving_variance_calculator
  BEFORE INSERT OR UPDATE ON receiving_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_receiving_variance();

-- Trigger to calculate refining final fine
CREATE OR REPLACE FUNCTION trigger_calculate_refining_fine()
RETURNS TRIGGER AS $$
DECLARE
  fine_result RECORD;
BEGIN
  SELECT * INTO fine_result
  FROM calculate_final_fine(
    NEW.post_melting_weight_grams,
    NEW.fineness_percentage,
    NEW.metal_retained_percentage
  );
  
  NEW.final_fine_grams := fine_result.final_fine_grams;
  NEW.final_fine_ounces := fine_result.final_fine_ounces;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refining_fine_calculator ON refining_records;
CREATE TRIGGER refining_fine_calculator
  BEFORE INSERT OR UPDATE ON refining_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_refining_fine();

-- Batch summary view
CREATE OR REPLACE VIEW v_batch_summary AS
SELECT 
  b.id,
  b.batch_number,
  b.status,
  b.weight_grams,
  b.weight_ounces,
  b.shipping_date,
  b.created_at,
  os.name as origin_site_name,
  os.country as origin_country,
  cs.name as current_site_name,
  cs.site_type as current_site_type,
  rr.final_fine_ounces,
  rr.approved_at as refining_approved_at,
  (SELECT COUNT(*) FROM batch_status_history WHERE batch_id = b.id) as status_change_count
FROM batches b
LEFT JOIN sites os ON b.origin_site_id = os.id
LEFT JOIN sites cs ON b.current_site_id = cs.id
LEFT JOIN refining_records rr ON b.id = rr.batch_id;

-- Sales summary view
CREATE OR REPLACE VIEW v_sales_summary AS
SELECT 
  s.id,
  s.sale_number,
  s.status,
  s.quantity_oz,
  s.london_am_rate,
  s.gross_proceeds,
  s.net_proceeds,
  s.final_proceeds,
  s.created_at,
  s.approved_at,
  c.name as customer_name,
  c.email as customer_email,
  c.country as customer_country,
  b.batch_number,
  (SELECT COUNT(*) FROM payments WHERE sale_id = s.id) as payment_count,
  (SELECT status FROM payments WHERE sale_id = s.id ORDER BY created_at DESC LIMIT 1) as latest_payment_status
FROM sales s
JOIN customers c ON s.customer_id = c.id
LEFT JOIN batches b ON s.batch_id = b.id;

-- Customer performance view
CREATE OR REPLACE VIEW v_customer_performance AS
SELECT 
  c.id,
  c.name,
  c.email,
  c.country,
  c.status,
  COUNT(DISTINCT s.id) as total_purchases,
  COALESCE(SUM(s.final_proceeds), 0) as total_spent,
  COALESCE(AVG(s.final_proceeds), 0) as average_order_value,
  MAX(s.created_at) as last_purchase_date,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'approved') as completed_payments,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'pending') as pending_payments
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
LEFT JOIN payments p ON s.id = p.sale_id
GROUP BY c.id, c.name, c.email, c.country, c.status;

-- Inventory status view
CREATE OR REPLACE VIEW v_inventory_status AS
SELECT 
  s.id as site_id,
  s.name as site_name,
  s.site_type,
  s.country,
  COUNT(DISTINCT b.id) as total_batches,
  SUM(b.weight_ounces) as total_weight_oz,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'ready_for_sale') as ready_for_sale_count,
  SUM(COALESCE(rr.final_fine_ounces, b.weight_ounces)) FILTER (WHERE b.status = 'ready_for_sale') as available_inventory_oz
FROM sites s
LEFT JOIN batches b ON s.id = b.current_site_id
LEFT JOIN refining_records rr ON b.id = rr.batch_id
WHERE s.is_active = true
GROUP BY s.id, s.name, s.site_type, s.country;

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at);
CREATE INDEX IF NOT EXISTS idx_refining_records_approved_at ON refining_records(approved_at);
CREATE INDEX IF NOT EXISTS idx_batch_status_history_changed_at ON batch_status_history(changed_at);
