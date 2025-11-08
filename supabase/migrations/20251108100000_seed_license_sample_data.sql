/*
  # Seed Export License Sample Data

  1. Sample Data
    - 10 licenses spanning 8 months (April 2024 - November 2024)
    - Mix of statuses: ACTIVE, EXPIRED, REGISTERED
    - Varying quota amounts and consumption levels
    - Associated with different mining companies

  2. Test Scenarios
    - Active licenses with available quota
    - Nearly exhausted licenses (RED alert)
    - Soon-to-expire licenses (YELLOW alert)
    - Expired licenses
    - New registered licenses
*/

-- Insert sample licenses for testing
INSERT INTO licenses (
  license_number,
  applicant_mine_id,
  applicant_company_name,
  applicant_signatory,
  issuer_organization,
  issuer_signatory,
  issuer_country,
  request_date,
  issue_date,
  expiry_date,
  authorized_qty_oz,
  consumed_qty_oz,
  license_type,
  status,
  notes,
  created_at,
  updated_at
)
SELECT
  'LIC-2024-' || LPAD(generate_series::text, 4, '0') as license_number,
  (SELECT id FROM mining_companies ORDER BY RANDOM() LIMIT 1) as applicant_mine_id,
  (SELECT name FROM mining_companies ORDER BY RANDOM() LIMIT 1) as applicant_company_name,
  'John Doe' as applicant_signatory,
  CASE (generate_series % 3)
    WHEN 0 THEN 'Ministry of Mines - Guinea'
    WHEN 1 THEN 'Ministry of Mines - Mali'
    ELSE 'Ministry of Mines - Côte d''Ivoire'
  END as issuer_organization,
  'Minister of Mines' as issuer_signatory,
  CASE (generate_series % 3)
    WHEN 0 THEN 'GN'
    WHEN 1 THEN 'ML'
    ELSE 'CI'
  END as issuer_country,
  DATE '2024-04-01' + (generate_series * 25 || ' days')::interval - INTERVAL '7 days' as request_date,
  DATE '2024-04-01' + (generate_series * 25 || ' days')::interval as issue_date,
  DATE '2024-04-01' + (generate_series * 25 || ' days')::interval + INTERVAL '90 days' as expiry_date,
  ((50000 + (generate_series * 15000)) / 31.1035)::numeric as authorized_qty_oz,
  CASE
    -- Some licenses heavily used (RED)
    WHEN generate_series IN (1, 2) THEN ((48000 + (generate_series * 15000)) / 31.1035)::numeric
    -- Some moderately used (YELLOW)
    WHEN generate_series IN (3, 4) THEN ((40000 + (generate_series * 10000)) / 31.1035)::numeric
    -- Some lightly used (GREEN)
    WHEN generate_series IN (5, 6) THEN ((20000 + (generate_series * 5000)) / 31.1035)::numeric
    -- Some unused (GREEN)
    ELSE 0
  END as consumed_qty_oz,
  CASE (generate_series % 3)
    WHEN 0 THEN 'GOLD_EXPORT'
    WHEN 1 THEN 'GOLD_EXPORT'
    ELSE 'GOLD_EXPORT'
  END as license_type,
  CASE
    -- Recently issued licenses still REGISTERED
    WHEN generate_series >= 9 THEN 'REGISTERED'::license_status
    -- Expired licenses (issue_date + 90 days < today)
    WHEN (DATE '2024-04-01' + (generate_series * 25 || ' days')::interval + INTERVAL '90 days') < CURRENT_DATE THEN 'EXPIRED'::license_status
    -- Active licenses
    ELSE 'ACTIVE'::license_status
  END as status,
  'Sample license for testing - Generated ' || generate_series as notes,
  DATE '2024-04-01' + (generate_series * 25 || ' days')::interval as created_at,
  CURRENT_TIMESTAMP as updated_at
FROM generate_series(1, 10);

-- Insert sample license events for audit trail
INSERT INTO license_events (
  license_id,
  event_type,
  event_description,
  payload,
  user_id,
  event_at
)
SELECT
  l.id,
  'REGISTERED'::license_event_type,
  'License registered: ' || l.license_number,
  jsonb_build_object(
    'license_number', l.license_number,
    'authorized_qty_oz', l.authorized_qty_oz,
    'issue_date', l.issue_date,
    'expiry_date', l.expiry_date
  ),
  (SELECT id FROM auth.users LIMIT 1),
  l.created_at
FROM licenses l
WHERE l.license_number LIKE 'LIC-2024-%';

-- Activate licenses that are not in REGISTERED status
INSERT INTO license_events (
  license_id,
  event_type,
  event_description,
  payload,
  user_id,
  event_at
)
SELECT
  l.id,
  'ACTIVATED'::license_event_type,
  'License activated: ' || l.license_number,
  jsonb_build_object(
    'license_number', l.license_number,
    'activation_date', l.issue_date + INTERVAL '1 day'
  ),
  (SELECT id FROM auth.users LIMIT 1),
  l.issue_date + INTERVAL '1 day'
FROM licenses l
WHERE l.license_number LIKE 'LIC-2024-%'
  AND l.status IN ('ACTIVE', 'EXPIRED');

-- Insert quota consumption transactions for used licenses
INSERT INTO license_quota_transactions (
  license_id,
  transaction_type,
  quantity_oz,
  reserved_qty_after,
  consumed_qty_after,
  remaining_qty_after,
  reason,
  performed_by,
  transaction_date
)
SELECT
  l.id,
  'CONSUME'::quota_transaction_type,
  l.consumed_qty_oz,
  0,
  l.consumed_qty_oz,
  l.authorized_qty_oz - l.consumed_qty_oz,
  'Initial consumption for sample data',
  (SELECT id FROM auth.users LIMIT 1),
  l.issue_date + INTERVAL '15 days'
FROM licenses l
WHERE l.license_number LIKE 'LIC-2024-%'
  AND l.consumed_qty_oz > 0;

-- KPI thresholds are already inserted in the main migration file

-- Link some existing batches to licenses (if batches exist)
DO $$
DECLARE
  license_rec RECORD;
  batch_rec RECORD;
  batch_counter INT := 0;
BEGIN
  -- Link batches to licenses for realistic test data
  FOR license_rec IN
    SELECT id, license_number, status
    FROM licenses
    WHERE license_number LIKE 'LIC-2024-%'
      AND status IN ('ACTIVE', 'EXPIRED')
    ORDER BY created_at
    LIMIT 6
  LOOP
    -- Assign 1-3 batches per license
    FOR batch_rec IN
      SELECT id
      FROM batches
      WHERE license_id IS NULL
      ORDER BY created_at
      LIMIT (1 + (RANDOM() * 2)::INT)
    LOOP
      UPDATE batches
      SET license_id = license_rec.id
      WHERE id = batch_rec.id;

      batch_counter := batch_counter + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Linked % batches to licenses', batch_counter;
END $$;

-- Add some sample license requests
INSERT INTO license_requests (
  request_number,
  mine_id,
  mine_name,
  request_date,
  planned_quantity_oz,
  planned_start_date,
  planned_end_date,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'REQ-2024-' || LPAD(generate_series::text, 4, '0') as request_number,
  (SELECT id FROM mining_companies ORDER BY RANDOM() LIMIT 1),
  (SELECT name FROM mining_companies ORDER BY RANDOM() LIMIT 1),
  CURRENT_DATE - (generate_series * 5 || ' days')::interval,
  ((60000 + (generate_series * 20000)) / 31.1035)::numeric as planned_quantity_oz,
  CURRENT_DATE + (generate_series * 30 || ' days')::interval,
  CURRENT_DATE + (generate_series * 30 || ' days')::interval + INTERVAL '90 days',
  CASE
    WHEN generate_series <= 2 THEN 'APPROVED'::license_request_status
    WHEN generate_series <= 4 THEN 'IN_REVIEW'::license_request_status
    ELSE 'SUBMITTED'::license_request_status
  END as status,
  (SELECT id FROM auth.users LIMIT 1),
  CURRENT_TIMESTAMP - (generate_series * 2 || ' days')::interval,
  CURRENT_TIMESTAMP
FROM generate_series(1, 5);
