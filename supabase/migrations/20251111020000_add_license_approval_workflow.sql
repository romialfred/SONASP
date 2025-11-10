/*
  # Add License Approval Workflow

  1. New Function
    - approve_license_request: Converts an approved license request into an active license

  2. Changes
    - Add link from licenses to license_requests
    - Add workflow function for seamless conversion

  3. Purpose
    - Bridge the gap between license requests and active licenses
    - Automate license creation from approved requests
*/

-- Function to approve and convert a license request into an active license
CREATE OR REPLACE FUNCTION approve_license_request(
  p_request_id uuid,
  p_license_number text,
  p_issue_date date DEFAULT CURRENT_DATE,
  p_expiry_date date DEFAULT CURRENT_DATE + INTERVAL '90 days',
  p_issuer_signatory text DEFAULT 'Minister of Mines',
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid AS $$
DECLARE
  v_request RECORD;
  v_license_id uuid;
  v_mine_company RECORD;
BEGIN
  -- Get license request details
  SELECT * INTO v_request
  FROM license_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'License request not found';
  END IF;

  -- Check if request is approved
  IF v_request.status != 'APPROVED' THEN
    RAISE EXCEPTION 'License request must be APPROVED before creating license. Current status: %', v_request.status;
  END IF;

  -- Get mining company details
  SELECT * INTO v_mine_company
  FROM mining_companies
  WHERE id = v_request.mine_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mining company not found';
  END IF;

  -- Create the license
  INSERT INTO licenses (
    license_number,
    request_id,
    applicant_mine_id,
    applicant_company_name,
    applicant_signatory,
    issuer_organization,
    issuer_signatory,
    issuer_signatory_title,
    issuer_country,
    request_date,
    issue_date,
    expiry_date,
    authorized_qty_oz,
    authorized_qty_unit,
    status,
    notes,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    p_license_number,
    p_request_id,
    v_request.mine_id,
    v_mine_company.name,
    COALESCE(v_request.signatory_name, 'Company Representative'),
    CASE v_mine_company.country
      WHEN 'GN' THEN 'Ministry of Mines - Guinea'
      WHEN 'ML' THEN 'Ministry of Mines - Mali'
      WHEN 'CI' THEN 'Ministry of Mines - Côte d''Ivoire'
      ELSE 'Ministry of Mines'
    END,
    p_issuer_signatory,
    'Minister',
    v_mine_company.country,
    v_request.request_date,
    p_issue_date,
    p_expiry_date,
    v_request.planned_quantity_oz,
    'OZ',
    'ACTIVE',
    format('Generated from license request %s', v_request.request_number),
    p_user_id,
    now(),
    now()
  )
  RETURNING id INTO v_license_id;

  -- Create license event for registration
  INSERT INTO license_events (
    license_id,
    event_type,
    description,
    metadata,
    created_by
  )
  VALUES (
    v_license_id,
    'REGISTERED',
    format('License %s registered from approved request %s', p_license_number, v_request.request_number),
    jsonb_build_object(
      'request_id', p_request_id,
      'request_number', v_request.request_number,
      'authorized_qty_oz', v_request.planned_quantity_oz
    ),
    p_user_id
  );

  -- Create license event for activation
  INSERT INTO license_events (
    license_id,
    event_type,
    description,
    metadata,
    created_by
  )
  VALUES (
    v_license_id,
    'ACTIVATED',
    format('License %s activated', p_license_number),
    jsonb_build_object(
      'license_number', p_license_number,
      'issue_date', p_issue_date,
      'expiry_date', p_expiry_date
    ),
    p_user_id
  );

  RETURN v_license_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View to see approved license requests ready for conversion
CREATE OR REPLACE VIEW v_approved_license_requests AS
SELECT
  lr.id,
  lr.request_number,
  lr.title,
  lr.mine_id,
  lr.mine_name,
  mc.code as mine_code,
  mc.country as mine_country,
  lr.request_date,
  lr.planned_quantity_oz,
  lr.planned_start_date,
  lr.planned_end_date,
  lr.justification,
  lr.status,
  lr.approved_at,
  lr.approved_by,
  -- Check if already converted
  CASE
    WHEN EXISTS (
      SELECT 1 FROM licenses l WHERE l.request_id = lr.id
    ) THEN true
    ELSE false
  END as has_license,
  -- Get license if exists
  (
    SELECT l.id
    FROM licenses l
    WHERE l.request_id = lr.id
    LIMIT 1
  ) as license_id,
  (
    SELECT l.license_number
    FROM licenses l
    WHERE l.request_id = lr.id
    LIMIT 1
  ) as license_number
FROM license_requests lr
LEFT JOIN mining_companies mc ON lr.mine_id = mc.id
WHERE lr.status = 'APPROVED'
ORDER BY lr.approved_at DESC;

-- Grant access to view
GRANT SELECT ON v_approved_license_requests TO authenticated;

-- Helper function to generate next license number
CREATE OR REPLACE FUNCTION generate_license_number(
  p_country text DEFAULT 'GN'
)
RETURNS text AS $$
DECLARE
  v_year text;
  v_country_code text;
  v_sequence int;
  v_license_number text;
BEGIN
  -- Get current year
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get country code
  v_country_code := UPPER(p_country);

  -- Get next sequence for this year and country
  SELECT COALESCE(MAX(
    CAST(
      REGEXP_REPLACE(
        license_number,
        '^LIC-' || v_year || '-' || v_country_code || '-',
        ''
      ) AS INTEGER
    )
  ), 0) + 1
  INTO v_sequence
  FROM licenses
  WHERE license_number LIKE 'LIC-' || v_year || '-' || v_country_code || '-%';

  -- Generate license number
  v_license_number := format('LIC-%s-%s-%s', v_year, v_country_code, LPAD(v_sequence::text, 4, '0'));

  RETURN v_license_number;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION approve_license_request IS 'Converts an approved license request into an active license';
COMMENT ON FUNCTION generate_license_number IS 'Generates next sequential license number for a country';
COMMENT ON VIEW v_approved_license_requests IS 'View of approved license requests ready for conversion to active licenses';
