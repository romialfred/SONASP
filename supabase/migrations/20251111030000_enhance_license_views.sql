/*
  # Enhance License Management Views

  1. New Views
    - v_license_requests_detailed: Complete license request information
    - v_licenses_with_shipments: Licenses with shipping details
    - v_license_quota_usage: Quota consumption tracking

  2. Purpose
    - Optimize data retrieval for frontend
    - Provide computed fields for UI
    - Enable better reporting and analytics
*/

-- View for detailed license requests with all information
CREATE OR REPLACE VIEW v_license_requests_detailed AS
SELECT
  lr.id,
  lr.request_number,
  lr.title,
  lr.mine_id,
  lr.mine_name,
  mc.code as mine_code,
  mc.country as mine_country,
  mc.contact_person_name as mine_contact,
  lr.request_date,
  lr.planned_quantity_oz,
  lr.planned_start_date,
  lr.planned_end_date,
  lr.comments,
  lr.priority,
  lr.status,
  -- Applicant signature
  lr.applicant_signatory_name,
  lr.applicant_signatory_title,
  lr.applicant_signature_date,
  -- Review information
  lr.reviewer_id,
  lr.reviewer_name,
  lr.review_date,
  lr.review_comments,
  lr.rejection_reason,
  -- Approval tracking
  lr.approved_at,
  lr.approved_by,
  -- Timestamps
  lr.created_at,
  lr.created_by,
  lr.updated_at,
  lr.updated_by,
  -- Check if converted to license
  CASE
    WHEN EXISTS (SELECT 1 FROM licenses l WHERE l.request_id = lr.id)
    THEN true
    ELSE false
  END as has_license,
  -- Get license details if exists
  (SELECT l.id FROM licenses l WHERE l.request_id = lr.id LIMIT 1) as license_id,
  (SELECT l.license_number FROM licenses l WHERE l.request_id = lr.id LIMIT 1) as license_number,
  (SELECT l.status FROM licenses l WHERE l.request_id = lr.id LIMIT 1) as license_status,
  -- Document count
  (SELECT COUNT(*) FROM license_request_documents lrd WHERE lrd.license_request_id = lr.id) as document_count
FROM license_requests lr
LEFT JOIN mining_companies mc ON lr.mine_id = mc.id;

-- View for licenses with shipping and consumption details
CREATE OR REPLACE VIEW v_licenses_with_shipments AS
SELECT
  l.id,
  l.license_number,
  l.request_id,
  l.applicant_mine_id,
  l.applicant_company_name,
  mc.code as mine_code,
  mc.country as mine_country,
  l.applicant_signatory,
  l.issuer_organization,
  l.issuer_signatory,
  l.issuer_country,
  l.request_date,
  l.issue_date,
  l.expiry_date,
  l.start_date,
  -- Quantities
  l.authorized_qty_oz,
  l.authorized_qty_unit,
  l.reserved_qty_oz,
  l.consumed_qty_oz,
  l.remaining_qty_oz,
  -- Status
  l.status,
  l.suspension_reason,
  -- Computed fields
  CASE
    WHEN l.remaining_qty_oz <= 0 THEN 'EXHAUSTED'
    WHEN l.remaining_qty_oz < (l.authorized_qty_oz * 0.1) THEN 'CRITICAL'
    WHEN l.remaining_qty_oz < (l.authorized_qty_oz * 0.25) THEN 'LOW'
    ELSE 'OK'
  END as quota_alert_level,
  CASE
    WHEN l.expiry_date < CURRENT_DATE THEN 'EXPIRED'
    WHEN l.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'EXPIRING_SOON'
    WHEN l.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'WARNING'
    ELSE 'OK'
  END as expiry_alert_level,
  (l.expiry_date - CURRENT_DATE) as days_to_expiry,
  ROUND((l.consumed_qty_oz / NULLIF(l.authorized_qty_oz, 0) * 100)::numeric, 2) as consumption_percentage,
  -- Shipping counts
  (
    SELECT COUNT(DISTINCT sp.id)
    FROM shipping_preparations sp
    WHERE sp.license_id = l.id
  ) as shipment_count,
  (
    SELECT COALESCE(SUM(spi.pure_gold_grams / 31.1035), 0)
    FROM shipping_preparations sp
    JOIN shipping_production_items spi ON sp.id = spi.shipping_preparation_id
    WHERE sp.license_id = l.id
  ) as total_shipped_oz,
  -- Latest shipment
  (
    SELECT sp.shipping_date
    FROM shipping_preparations sp
    WHERE sp.license_id = l.id
    ORDER BY sp.shipping_date DESC
    LIMIT 1
  ) as last_shipment_date,
  -- Timestamps
  l.created_at,
  l.created_by,
  l.updated_at,
  l.notes
FROM licenses l
LEFT JOIN mining_companies mc ON l.applicant_mine_id = mc.id;

-- View for quota usage analysis
CREATE OR REPLACE VIEW v_license_quota_usage AS
SELECT
  l.id as license_id,
  l.license_number,
  l.applicant_company_name,
  l.authorized_qty_oz,
  l.consumed_qty_oz,
  l.remaining_qty_oz,
  -- Transaction summary
  (
    SELECT COUNT(*)
    FROM license_quota_transactions lqt
    WHERE lqt.license_id = l.id
    AND lqt.transaction_type = 'RESERVE'
  ) as reserve_transaction_count,
  (
    SELECT COUNT(*)
    FROM license_quota_transactions lqt
    WHERE lqt.license_id = l.id
    AND lqt.transaction_type = 'CONSUME'
  ) as consume_transaction_count,
  (
    SELECT COUNT(*)
    FROM license_quota_transactions lqt
    WHERE lqt.license_id = l.id
    AND lqt.transaction_type = 'RELEASE'
  ) as release_transaction_count,
  -- Latest transaction
  (
    SELECT lqt.transaction_date
    FROM license_quota_transactions lqt
    WHERE lqt.license_id = l.id
    ORDER BY lqt.transaction_date DESC
    LIMIT 1
  ) as last_transaction_date,
  (
    SELECT lqt.transaction_type
    FROM license_quota_transactions lqt
    WHERE lqt.license_id = l.id
    ORDER BY lqt.transaction_date DESC
    LIMIT 1
  ) as last_transaction_type,
  -- Daily consumption rate (last 30 days)
  CASE
    WHEN l.issue_date >= CURRENT_DATE - INTERVAL '30 days' THEN
      l.consumed_qty_oz / GREATEST(EXTRACT(day FROM (CURRENT_DATE - l.issue_date)), 1)
    ELSE
      (
        SELECT COALESCE(SUM(lqt.quantity_oz), 0) / 30.0
        FROM license_quota_transactions lqt
        WHERE lqt.license_id = l.id
        AND lqt.transaction_type = 'CONSUME'
        AND lqt.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
      )
  END as avg_daily_consumption_oz,
  -- Estimated days until exhaustion
  CASE
    WHEN l.remaining_qty_oz <= 0 THEN 0
    WHEN l.consumed_qty_oz = 0 THEN NULL
    ELSE
      ROUND(
        l.remaining_qty_oz / NULLIF(
          (l.consumed_qty_oz / GREATEST(EXTRACT(day FROM (CURRENT_DATE - l.issue_date)), 1)),
          0
        )
      )::integer
  END as estimated_days_to_exhaustion
FROM licenses l
WHERE l.status IN ('ACTIVE', 'REGISTERED');

-- Grant permissions
GRANT SELECT ON v_license_requests_detailed TO authenticated;
GRANT SELECT ON v_licenses_with_shipments TO authenticated;
GRANT SELECT ON v_license_quota_usage TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_licenses_request_id ON licenses(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_license_quota_transactions_license_id_date
  ON license_quota_transactions(license_id, transaction_date DESC);

-- Comments
COMMENT ON VIEW v_license_requests_detailed IS 'Detailed view of license requests with all related information';
COMMENT ON VIEW v_licenses_with_shipments IS 'Licenses with shipping details and consumption tracking';
COMMENT ON VIEW v_license_quota_usage IS 'Quota usage analysis for active licenses';
