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
  mining_company_id,
  issuing_authority,
  issue_date,
  expiry_date,
  authorized_quantity_grams,
  authorized_quantity_oz,
  used_quantity_grams,
  destination_country,
  destination_buyer,
  license_type,
  status,
  notes,
  created_at,
  updated_at
)
SELECT
  'LIC-2024-' || LPAD(generate_series::text, 4, '0') as license_number,
  (SELECT id FROM mining_companies ORDER BY RANDOM() LIMIT 1),
  CASE (generate_series % 3)
    WHEN 0 THEN 'Ministry of Mines - Guinea'
    WHEN 1 THEN 'Ministry of Mines - Mali'
    ELSE 'Ministry of Mines - Côte d''Ivoire'
  END as issuing_authority,
  DATE '2024-04-01' + (generate_series * 25 || ' days')::interval as issue_date,
  DATE '2024-04-01' + (generate_series * 25 || ' days')::interval + INTERVAL '90 days' as expiry_date,
  (50000 + (generate_series * 15000))::numeric as authorized_quantity_grams,
  ((50000 + (generate_series * 15000)) / 31.1035)::numeric as authorized_quantity_oz,
  CASE
    -- Some licenses heavily used (RED)
    WHEN generate_series IN (1, 2) THEN (48000 + (generate_series * 15000))::numeric
    -- Some moderately used (YELLOW)
    WHEN generate_series IN (3, 4) THEN (40000 + (generate_series * 10000))::numeric
    -- Some lightly used (GREEN)
    WHEN generate_series IN (5, 6) THEN (20000 + (generate_series * 5000))::numeric
    -- Some unused (GREEN)
    ELSE 0
  END as used_quantity_grams,
  CASE (generate_series % 5)
    WHEN 0 THEN 'United Arab Emirates'
    WHEN 1 THEN 'Switzerland'
    WHEN 2 THEN 'United Kingdom'
    WHEN 3 THEN 'United States'
    ELSE 'Belgium'
  END as destination_country,
  CASE (generate_series % 5)
    WHEN 0 THEN 'Emirates Gold DMCC'
    WHEN 1 THEN 'Metalor Technologies SA'
    WHEN 2 THEN 'Baird & Co.'
    WHEN 3 THEN 'Auramet International'
    ELSE 'Umicore Precious Metals'
  END as destination_buyer,
  CASE (generate_series % 3)
    WHEN 0 THEN 'STANDARD_EXPORT'
    WHEN 1 THEN 'RE_EXPORT'
    ELSE 'TEMPORARY_EXPORT'
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
  event_data,
  user_id,
  created_at
)
SELECT
  l.id,
  'REGISTERED'::license_event_type,
  jsonb_build_object(
    'license_number', l.license_number,
    'authorized_quantity_grams', l.authorized_quantity_grams,
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
  event_data,
  user_id,
  created_at
)
SELECT
  l.id,
  'ACTIVATED'::license_event_type,
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
  quantity_grams,
  quantity_oz,
  reference_type,
  reference_id,
  notes,
  created_by,
  created_at
)
SELECT
  l.id,
  'CONSUME'::quota_transaction_type,
  l.used_quantity_grams,
  l.used_quantity_grams / 31.1035,
  'EXPORT',
  gen_random_uuid()::text,
  'Initial consumption for sample data',
  (SELECT id FROM auth.users LIMIT 1),
  l.issue_date + INTERVAL '15 days'
FROM licenses l
WHERE l.license_number LIKE 'LIC-2024-%'
  AND l.used_quantity_grams > 0;

-- Insert KPI thresholds if not exists
INSERT INTO license_kpi_thresholds (
  country,
  license_type,
  quota_usage_warning_pct,
  quota_usage_critical_pct,
  days_to_expiry_warning,
  days_to_expiry_critical,
  created_at,
  updated_at
)
VALUES
  ('GN', 'STANDARD_EXPORT', 70, 90, 30, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ML', 'STANDARD_EXPORT', 70, 90, 30, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CI', 'STANDARD_EXPORT', 70, 90, 30, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (country, license_type) DO NOTHING;

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
  mining_company_id,
  destination_country,
  destination_buyer,
  planned_quantity_grams,
  planned_quantity_oz,
  planned_export_date,
  license_type,
  justification,
  status,
  submitted_at,
  created_by,
  created_at,
  updated_at
)
SELECT
  'REQ-2024-' || LPAD(generate_series::text, 4, '0') as request_number,
  (SELECT id FROM mining_companies ORDER BY RANDOM() LIMIT 1),
  CASE (generate_series % 4)
    WHEN 0 THEN 'United Arab Emirates'
    WHEN 1 THEN 'Switzerland'
    WHEN 2 THEN 'United Kingdom'
    ELSE 'United States'
  END as destination_country,
  CASE (generate_series % 4)
    WHEN 0 THEN 'Emirates Gold DMCC'
    WHEN 1 THEN 'Metalor Technologies SA'
    WHEN 2 THEN 'Baird & Co.'
    ELSE 'Auramet International'
  END as destination_buyer,
  (60000 + (generate_series * 20000))::numeric as planned_quantity_grams,
  ((60000 + (generate_series * 20000)) / 31.1035)::numeric as planned_quantity_oz,
  CURRENT_DATE + (generate_series * 30 || ' days')::interval as planned_export_date,
  'STANDARD_EXPORT' as license_type,
  'Request for export license - Sample ' || generate_series as justification,
  CASE
    WHEN generate_series <= 2 THEN 'APPROVED'::license_request_status
    WHEN generate_series <= 4 THEN 'IN_REVIEW'::license_request_status
    ELSE 'SUBMITTED'::license_request_status
  END as status,
  CASE
    WHEN generate_series <= 4 THEN CURRENT_TIMESTAMP - (generate_series || ' days')::interval
    ELSE NULL
  END as submitted_at,
  (SELECT id FROM auth.users LIMIT 1),
  CURRENT_TIMESTAMP - (generate_series * 2 || ' days')::interval,
  CURRENT_TIMESTAMP
FROM generate_series(1, 5);
