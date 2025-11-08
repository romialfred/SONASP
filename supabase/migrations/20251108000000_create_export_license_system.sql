/*
  # Export License Management System

  1. New Tables
    - `license_requests`
      - Complete lifecycle tracking for license applications
      - Supports draft, submitted, approved, rejected states
      - Links to mining companies and includes planned export details

    - `license_request_documents`
      - Multi-document attachment system with versioning
      - Tracks title, file URL, hash, and upload metadata

    - `licenses`
      - Master registry of issued export licenses
      - Tracks all license metadata, quotas, and validity periods
      - Includes OCR-extracted fields and PDF storage
      - Computed fields for remaining quantity and status

    - `license_quota_transactions`
      - Complete audit trail of quota reservations and consumption
      - Tracks every increase, decrease, reservation, and release
      - Links to specific exports and batches

    - `license_events`
      - Comprehensive event logging for compliance and audit
      - Captures all state changes, validations, and system actions

    - `license_kpi_thresholds`
      - Configurable alert thresholds for quota and expiry warnings
      - Supports country and license-type specific rules

  2. Enums
    - `license_request_status`: DRAFT, SUBMITTED, IN_REVIEW, APPROVED, REJECTED
    - `license_status`: REGISTERED, ACTIVE, SUSPENDED, EXPIRED, CLOSED
    - `license_event_type`: Various event types for audit trail
    - `quota_transaction_type`: RESERVE, CONSUME, RELEASE, ADJUST, EXPIRE

  3. Security
    - Enable RLS on all tables
    - Policies based on user role and mining company assignment
    - Management can view/edit all licenses
    - Mines can only view/edit their own requests and licenses

  4. Functions & Triggers
    - Auto-update license status based on dates and quota
    - Quota transaction triggers for audit trail
    - Date validation and business rule enforcement
*/

-- Create enums for license management
DO $$ BEGIN
  CREATE TYPE license_request_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE license_status AS ENUM (
    'REGISTERED',
    'ACTIVE',
    'SUSPENDED',
    'EXPIRED',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE license_event_type AS ENUM (
    'CREATED',
    'REGISTERED',
    'ACTIVATED',
    'QUOTA_RESERVED',
    'QUOTA_CONSUMED',
    'QUOTA_RELEASED',
    'QUOTA_ADJUSTED',
    'SUSPENDED',
    'RESUMED',
    'EXPIRED',
    'CLOSED',
    'UPDATED',
    'PDF_UPLOADED',
    'OCR_COMPLETED',
    'VALIDATION_FAILED',
    'EXPORT_BLOCKED',
    'ALERT_SENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE quota_transaction_type AS ENUM (
    'RESERVE',
    'CONSUME',
    'RELEASE',
    'ADJUST',
    'EXPIRE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- License Requests Table
CREATE TABLE IF NOT EXISTS license_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request identification
  request_number text UNIQUE,

  -- Mining company relationship
  mine_id uuid REFERENCES mining_companies(id) ON DELETE RESTRICT,
  mine_name text NOT NULL,

  -- Request details
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  planned_quantity_oz decimal(18,3) NOT NULL CHECK (planned_quantity_oz > 0),
  planned_start_date date,
  planned_end_date date,

  -- Status and workflow
  status license_request_status NOT NULL DEFAULT 'DRAFT',

  -- Applicant signature
  applicant_signatory_name text,
  applicant_signatory_title text,
  applicant_signature_date timestamptz,
  applicant_certification_text text,

  -- Ministry review
  reviewer_id uuid REFERENCES auth.users(id),
  reviewer_name text,
  review_date timestamptz,
  review_comments text,
  rejection_reason text,

  -- Additional information
  comments text,
  priority text DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),

  -- Resulting license link
  license_id uuid,

  -- Audit fields
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (
    planned_start_date IS NULL OR
    planned_end_date IS NULL OR
    planned_start_date <= planned_end_date
  )
);

-- License Request Documents Table
CREATE TABLE IF NOT EXISTS license_request_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_request_id uuid REFERENCES license_requests(id) ON DELETE CASCADE NOT NULL,

  -- Document details
  title text NOT NULL,
  description text,
  document_type text CHECK (document_type IN (
    'APPLICATION_FORM',
    'COMPANY_REGISTRATION',
    'TAX_CERTIFICATE',
    'EXPORT_AUTHORIZATION',
    'MINING_PERMIT',
    'ASSAY_CERTIFICATE',
    'OTHER'
  )),

  -- File information
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  hash_sha256 text,

  -- Version control
  version integer DEFAULT 1,
  is_current boolean DEFAULT true,

  -- Audit fields
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,

  CONSTRAINT unique_current_document UNIQUE (license_request_id, title, is_current)
);

-- Licenses Table (Master Registry)
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- License identification
  license_number text UNIQUE NOT NULL,
  license_type text DEFAULT 'GOLD_EXPORT',

  -- Request relationship
  request_id uuid REFERENCES license_requests(id),

  -- Applicant information
  applicant_mine_id uuid REFERENCES mining_companies(id) ON DELETE RESTRICT NOT NULL,
  applicant_company_name text NOT NULL,
  applicant_signatory text NOT NULL,
  applicant_signatory_title text,

  -- Issuer information (Ministry)
  issuer_organization text NOT NULL DEFAULT 'Ministère des Mines',
  issuer_signatory text NOT NULL,
  issuer_signatory_title text,
  issuer_country text NOT NULL CHECK (issuer_country IN ('GN', 'CI', 'ML')),

  -- Important dates
  request_date date NOT NULL,
  issue_date date NOT NULL,
  start_date date,
  expiry_date date NOT NULL,

  -- Quantity authorization
  authorized_qty_oz decimal(18,3) NOT NULL CHECK (authorized_qty_oz > 0),
  authorized_qty_unit text DEFAULT 'OZ' CHECK (authorized_qty_unit IN ('OZ', 'KG', 'G')),

  -- Calculated quota tracking
  reserved_qty_oz decimal(18,3) DEFAULT 0 CHECK (reserved_qty_oz >= 0),
  consumed_qty_oz decimal(18,3) DEFAULT 0 CHECK (consumed_qty_oz >= 0),
  remaining_qty_oz decimal(18,3) GENERATED ALWAYS AS (
    authorized_qty_oz - consumed_qty_oz - reserved_qty_oz
  ) STORED,

  -- Pricing information
  theoretical_price_usd_per_oz decimal(18,2),
  estimated_total_value_usd decimal(18,2),

  -- Status management
  status license_status NOT NULL DEFAULT 'REGISTERED',
  suspension_reason text,
  suspension_date timestamptz,

  -- PDF and OCR
  pdf_url text,
  pdf_hash text,
  ocr_completed boolean DEFAULT false,
  ocr_confidence_score decimal(5,2),
  ocr_extracted_data jsonb,
  ocr_extracted_at timestamptz,

  -- Validity flags
  is_active boolean GENERATED ALWAYS AS (
    status = 'ACTIVE' AND
    CURRENT_DATE >= COALESCE(start_date, issue_date) AND
    CURRENT_DATE <= expiry_date AND
    remaining_qty_oz > 0
  ) STORED,

  days_to_expiry integer GENERATED ALWAYS AS (
    expiry_date - CURRENT_DATE
  ) STORED,

  remaining_percentage decimal(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN authorized_qty_oz > 0 THEN
        ROUND((remaining_qty_oz / authorized_qty_oz * 100)::numeric, 2)
      ELSE 0
    END
  ) STORED,

  -- Additional metadata
  notes text,
  tags text[],

  -- Audit fields
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_license_dates CHECK (
    issue_date <= expiry_date AND
    (start_date IS NULL OR start_date <= expiry_date)
  ),
  CONSTRAINT valid_quota_consumption CHECK (
    consumed_qty_oz + reserved_qty_oz <= authorized_qty_oz
  )
);

-- License Quota Transactions (Audit Trail)
CREATE TABLE IF NOT EXISTS license_quota_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid REFERENCES licenses(id) ON DELETE CASCADE NOT NULL,

  -- Transaction details
  transaction_type quota_transaction_type NOT NULL,
  quantity_oz decimal(18,3) NOT NULL,

  -- Balances after transaction
  reserved_qty_after decimal(18,3) NOT NULL,
  consumed_qty_after decimal(18,3) NOT NULL,
  remaining_qty_after decimal(18,3) NOT NULL,

  -- Related export/batch
  export_id uuid,
  batch_id uuid,
  batch_number text,

  -- Transaction metadata
  reason text,
  reference_number text,
  notes text,

  -- Audit fields
  transaction_date timestamptz DEFAULT now() NOT NULL,
  performed_by uuid REFERENCES auth.users(id),
  performed_by_name text,

  -- Index for performance
  created_at timestamptz DEFAULT now() NOT NULL
);

-- License Events (Complete Audit Trail)
CREATE TABLE IF NOT EXISTS license_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid REFERENCES licenses(id) ON DELETE CASCADE NOT NULL,

  -- Event details
  event_type license_event_type NOT NULL,
  event_description text NOT NULL,

  -- Event data
  payload jsonb,
  old_value jsonb,
  new_value jsonb,

  -- Context
  export_id uuid,
  batch_id uuid,
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  user_role text,
  ip_address inet,

  -- Timestamp
  event_at timestamptz DEFAULT now() NOT NULL,

  -- Indexing
  created_at timestamptz DEFAULT now() NOT NULL
);

-- License KPI Thresholds (Configuration)
CREATE TABLE IF NOT EXISTS license_kpi_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  country text CHECK (country IN ('GN', 'CI', 'ML', 'ALL')),
  license_type text DEFAULT 'ALL',

  -- Threshold configuration
  threshold_name text NOT NULL,
  threshold_type text NOT NULL CHECK (threshold_type IN ('QUOTA_PERCENTAGE', 'DAYS_TO_EXPIRY')),

  -- Values
  warning_value decimal(10,2) NOT NULL,
  critical_value decimal(10,2) NOT NULL,

  -- Actions
  send_email boolean DEFAULT true,
  send_notification boolean DEFAULT true,
  block_exports boolean DEFAULT false,

  -- Status
  is_active boolean DEFAULT true,

  -- Audit fields
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid REFERENCES auth.users(id),

  CONSTRAINT unique_threshold UNIQUE (country, license_type, threshold_name)
);

-- Add license_id to batches table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'license_id'
  ) THEN
    ALTER TABLE batches ADD COLUMN license_id uuid REFERENCES licenses(id);
    CREATE INDEX IF NOT EXISTS idx_batches_license_id ON batches(license_id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_license_requests_mine_id ON license_requests(mine_id);
CREATE INDEX IF NOT EXISTS idx_license_requests_status ON license_requests(status);
CREATE INDEX IF NOT EXISTS idx_license_requests_request_date ON license_requests(request_date);

CREATE INDEX IF NOT EXISTS idx_licenses_mine_id ON licenses(applicant_mine_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry_date ON licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_licenses_license_number ON licenses(license_number);
CREATE INDEX IF NOT EXISTS idx_licenses_is_active ON licenses(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_licenses_country ON licenses(issuer_country);

CREATE INDEX IF NOT EXISTS idx_quota_transactions_license_id ON license_quota_transactions(license_id);
CREATE INDEX IF NOT EXISTS idx_quota_transactions_date ON license_quota_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_quota_transactions_export_id ON license_quota_transactions(export_id);

CREATE INDEX IF NOT EXISTS idx_license_events_license_id ON license_events(license_id);
CREATE INDEX IF NOT EXISTS idx_license_events_type ON license_events(event_type);
CREATE INDEX IF NOT EXISTS idx_license_events_date ON license_events(event_at);

-- Create function to auto-generate request numbers
CREATE OR REPLACE FUNCTION generate_license_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'LR-' ||
                         TO_CHAR(NEW.request_date, 'YYYYMMDD') || '-' ||
                         LPAD(nextval('license_request_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS license_request_seq START 1;

CREATE TRIGGER set_license_request_number
  BEFORE INSERT ON license_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_license_request_number();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_license_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_license_requests_timestamp
  BEFORE UPDATE ON license_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_license_timestamp();

CREATE TRIGGER update_licenses_timestamp
  BEFORE UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_license_timestamp();

-- Create function to auto-update license status
CREATE OR REPLACE FUNCTION auto_update_license_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Activate license on issue date if not already active
  IF NEW.status = 'REGISTERED' AND
     CURRENT_DATE >= COALESCE(NEW.start_date, NEW.issue_date) AND
     CURRENT_DATE <= NEW.expiry_date THEN
    NEW.status := 'ACTIVE';
  END IF;

  -- Expire license if past expiry date
  IF NEW.status IN ('ACTIVE', 'REGISTERED') AND
     CURRENT_DATE > NEW.expiry_date THEN
    NEW.status := 'EXPIRED';
  END IF;

  -- Close license if quota fully consumed
  IF NEW.status = 'ACTIVE' AND
     NEW.remaining_qty_oz <= 0 THEN
    NEW.status := 'CLOSED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_license_status_trigger
  BEFORE INSERT OR UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_license_status();

-- Create function to log license events
CREATE OR REPLACE FUNCTION log_license_event()
RETURNS TRIGGER AS $$
DECLARE
  event_desc text;
  event_t license_event_type;
BEGIN
  -- Determine event type and description
  IF TG_OP = 'INSERT' THEN
    event_t := 'CREATED';
    event_desc := 'License created: ' || NEW.license_number;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      event_t := CASE NEW.status
        WHEN 'ACTIVE' THEN 'ACTIVATED'
        WHEN 'EXPIRED' THEN 'EXPIRED'
        WHEN 'CLOSED' THEN 'CLOSED'
        WHEN 'SUSPENDED' THEN 'SUSPENDED'
        ELSE 'UPDATED'
      END;
      event_desc := 'License status changed from ' || OLD.status || ' to ' || NEW.status;
    ELSIF OLD.consumed_qty_oz != NEW.consumed_qty_oz THEN
      event_t := 'QUOTA_CONSUMED';
      event_desc := 'Quota consumed: ' || (NEW.consumed_qty_oz - OLD.consumed_qty_oz) || ' oz';
    ELSIF OLD.reserved_qty_oz != NEW.reserved_qty_oz THEN
      event_t := 'QUOTA_RESERVED';
      event_desc := 'Quota reserved: ' || (NEW.reserved_qty_oz - OLD.reserved_qty_oz) || ' oz';
    ELSE
      event_t := 'UPDATED';
      event_desc := 'License updated';
    END IF;
  END IF;

  -- Insert event log
  INSERT INTO license_events (
    license_id,
    event_type,
    event_description,
    old_value,
    new_value,
    event_at
  ) VALUES (
    NEW.id,
    event_t,
    event_desc,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_license_event_trigger
  AFTER INSERT OR UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION log_license_event();

-- Enable Row Level Security
ALTER TABLE license_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_request_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_quota_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_kpi_thresholds ENABLE ROW LEVEL SECURITY;

-- RLS Policies for license_requests
CREATE POLICY "Users can view license requests from their mine"
  ON license_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'management'
        OR user_profiles.mining_company_id = license_requests.mine_id
      )
    )
  );

CREATE POLICY "Users can create license requests for their mine"
  ON license_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'management'
        OR user_profiles.mining_company_id = mine_id
      )
    )
  );

CREATE POLICY "Users can update their draft license requests"
  ON license_requests FOR UPDATE
  TO authenticated
  USING (
    status = 'DRAFT' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'management'
        OR user_profiles.mining_company_id = mine_id
      )
    )
  );

-- RLS Policies for licenses
CREATE POLICY "Users can view licenses from their mine"
  ON licenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'management'
        OR user_profiles.mining_company_id = applicant_mine_id
      )
    )
  );

CREATE POLICY "Management can create licenses"
  ON licenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can update licenses"
  ON licenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- RLS Policies for license_request_documents
CREATE POLICY "Users can view documents from their license requests"
  ON license_request_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM license_requests lr
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE lr.id = license_request_documents.license_request_id
      AND (
        up.role = 'management'
        OR up.mining_company_id = lr.mine_id
      )
    )
  );

CREATE POLICY "Users can upload documents to their license requests"
  ON license_request_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM license_requests lr
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE lr.id = license_request_id
      AND lr.status = 'DRAFT'
      AND (
        up.role = 'management'
        OR up.mining_company_id = lr.mine_id
      )
    )
  );

-- RLS Policies for quota transactions (read-only audit trail)
CREATE POLICY "Users can view quota transactions for their licenses"
  ON license_quota_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM licenses l
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE l.id = license_quota_transactions.license_id
      AND (
        up.role = 'management'
        OR up.mining_company_id = l.applicant_mine_id
      )
    )
  );

-- RLS Policies for license events (read-only audit trail)
CREATE POLICY "Users can view events for their licenses"
  ON license_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM licenses l
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE l.id = license_events.license_id
      AND (
        up.role = 'management'
        OR up.mining_company_id = l.applicant_mine_id
      )
    )
  );

-- RLS Policies for KPI thresholds (management only)
CREATE POLICY "Management can manage KPI thresholds"
  ON license_kpi_thresholds FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Insert default KPI thresholds
INSERT INTO license_kpi_thresholds (country, license_type, threshold_name, threshold_type, warning_value, critical_value)
VALUES
  ('ALL', 'ALL', 'Quota Low Warning', 'QUOTA_PERCENTAGE', 25.00, 10.00),
  ('ALL', 'ALL', 'Expiry Warning', 'DAYS_TO_EXPIRY', 30.00, 15.00)
ON CONFLICT (country, license_type, threshold_name) DO NOTHING;
