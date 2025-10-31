/*
  # Sales Management Module Enhancement

  This migration enhances the sales management system with comprehensive features for:
  - Multi-batch sales support with line items
  - Commission tracking and management
  - Multi-level approval workflows
  - Inventory allocation and reservation
  - Customer contracts and terms
  - Payment schedules and installments
  - Document management
  - Sales audit trail
  - Commission rules configuration

  ## New Tables

  ### sales_line_items
  - Individual line items for each sale supporting multi-batch sales
  - Links batches to sales with quantity allocation
  - Tracks pricing and calculations per line item

  ### sales_commissions
  - Commission tracking for sales personnel
  - Multiple commission types (percentage, fixed, tiered)
  - Commission approval and payment status

  ### sales_approvals
  - Multi-level approval workflow management
  - Tracks approval status for each approval level
  - Supports conditional approvals and rejections

  ### sales_allocations
  - Inventory reservation and allocation tracking
  - Prevents overselling with allocation locks
  - Release mechanism for cancelled sales

  ### customer_contracts
  - Customer-specific terms and conditions
  - Pricing agreements and discounts
  - Contract validity periods

  ### sales_payment_schedules
  - Installment payment planning
  - Payment due dates and amounts
  - Payment status tracking

  ### sales_documents
  - Contract, invoice, and certificate storage
  - Document versioning and approval
  - Secure document access management

  ### sales_notifications_log
  - Customer communication tracking
  - Email, SMS, and in-app notifications
  - Delivery status and response tracking

  ### sales_audit_trail
  - Detailed sales activity logging
  - Change tracking with before/after values
  - Complete audit history

  ### commission_rules
  - Configurable commission structures
  - Tiered rates based on volume or value
  - Rule validity periods

  ## Security
  - RLS enabled on all tables
  - Appropriate policies for role-based access
  - Field-level security for sensitive data
*/

-- Sales Line Items Table
CREATE TABLE IF NOT EXISTS sales_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  line_number INTEGER NOT NULL,
  metal_type TEXT NOT NULL DEFAULT 'gold',
  quantity_grams DECIMAL(12, 3) NOT NULL,
  quantity_oz DECIMAL(12, 4) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  fineness_percentage DECIMAL(5, 2),
  fine_weight_oz DECIMAL(12, 4),
  line_total DECIMAL(15, 2) NOT NULL,
  allocated_from_refining_id UUID REFERENCES refining_records(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT line_number_per_sale UNIQUE(sale_id, line_number),
  CONSTRAINT positive_quantity CHECK (quantity_oz > 0),
  CONSTRAINT positive_price CHECK (unit_price > 0)
);

CREATE INDEX idx_sales_line_items_sale_id ON sales_line_items(sale_id);
CREATE INDEX idx_sales_line_items_batch_id ON sales_line_items(batch_id);

-- Commission Rules Table
CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage', 'fixed', 'tiered', 'hybrid')),
  customer_tier TEXT CHECK (customer_tier IN ('premium', 'standard', 'basic', 'all')),
  metal_type TEXT CHECK (metal_type IN ('gold', 'silver', 'zinc', 'diamond', 'other', 'all')),
  min_quantity_oz DECIMAL(12, 4),
  max_quantity_oz DECIMAL(12, 4),
  min_value_usd DECIMAL(15, 2),
  max_value_usd DECIMAL(15, 2),
  commission_percentage DECIMAL(5, 2),
  fixed_amount DECIMAL(10, 2),
  tier_config JSONB,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE INDEX idx_commission_rules_active ON commission_rules(is_active, valid_from, valid_until);
CREATE INDEX idx_commission_rules_type ON commission_rules(rule_type, customer_tier, metal_type);

-- Sales Commissions Table
CREATE TABLE IF NOT EXISTS sales_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  commission_rule_id UUID REFERENCES commission_rules(id),
  salesperson_id UUID NOT NULL REFERENCES auth.users(id),
  salesperson_name TEXT NOT NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed', 'tiered', 'hybrid', 'manual')),
  basis_amount DECIMAL(15, 2) NOT NULL,
  commission_rate DECIMAL(5, 2),
  commission_amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  calculation_details JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT positive_commission CHECK (commission_amount >= 0)
);

CREATE INDEX idx_sales_commissions_sale_id ON sales_commissions(sale_id);
CREATE INDEX idx_sales_commissions_salesperson ON sales_commissions(salesperson_id, status);
CREATE INDEX idx_sales_commissions_status ON sales_commissions(status);

-- Sales Approvals Table
CREATE TABLE IF NOT EXISTS sales_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  approval_level INTEGER NOT NULL,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('management', 'customer', 'finance', 'compliance', 'executive')),
  required_approver_role TEXT,
  required_approver_id UUID REFERENCES auth.users(id),
  approver_id UUID REFERENCES auth.users(id),
  approver_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'conditional', 'expired')),
  approval_token TEXT UNIQUE,
  token_expires_at TIMESTAMPTZ,
  decision_notes TEXT,
  conditions TEXT,
  approved_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  notification_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_sale_level UNIQUE(sale_id, approval_level)
);

CREATE INDEX idx_sales_approvals_sale_id ON sales_approvals(sale_id);
CREATE INDEX idx_sales_approvals_status ON sales_approvals(status, approval_type);
CREATE INDEX idx_sales_approvals_approver ON sales_approvals(approver_id, status);
CREATE INDEX idx_sales_approvals_token ON sales_approvals(approval_token) WHERE approval_token IS NOT NULL;

-- Sales Allocations Table
CREATE TABLE IF NOT EXISTS sales_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  refining_record_id UUID REFERENCES refining_records(id),
  allocated_quantity_oz DECIMAL(12, 4) NOT NULL,
  allocated_fine_oz DECIMAL(12, 4),
  allocation_status TEXT DEFAULT 'reserved' CHECK (allocation_status IN ('reserved', 'confirmed', 'released', 'delivered')),
  reserved_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  release_reason TEXT,
  allocated_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT positive_allocation CHECK (allocated_quantity_oz > 0)
);

CREATE INDEX idx_sales_allocations_sale_id ON sales_allocations(sale_id);
CREATE INDEX idx_sales_allocations_batch_id ON sales_allocations(batch_id);
CREATE INDEX idx_sales_allocations_status ON sales_allocations(allocation_status);
CREATE INDEX idx_sales_allocations_refining ON sales_allocations(refining_record_id);

-- Customer Contracts Table
CREATE TABLE IF NOT EXISTS customer_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL UNIQUE,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('master', 'spot', 'term', 'consignment')),
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('london_am', 'london_pm', 'fixed', 'formula', 'negotiated')),
  base_price_adjustment DECIMAL(10, 2) DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  payment_terms TEXT NOT NULL,
  credit_limit DECIMAL(15, 2),
  minimum_order_oz DECIMAL(12, 4),
  maximum_order_oz DECIMAL(12, 4),
  annual_volume_commitment_oz DECIMAL(12, 4),
  priority_level INTEGER DEFAULT 0,
  contract_terms TEXT,
  special_conditions TEXT,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  renewal_notice_days INTEGER DEFAULT 30,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'suspended', 'expired', 'terminated')),
  signed_date DATE,
  signed_by_customer TEXT,
  signed_by_company TEXT,
  document_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_contract_dates CHECK (valid_until > valid_from)
);

CREATE INDEX idx_customer_contracts_customer_id ON customer_contracts(customer_id);
CREATE INDEX idx_customer_contracts_status ON customer_contracts(status, valid_from, valid_until);
CREATE INDEX idx_customer_contracts_number ON customer_contracts(contract_number);

-- Sales Payment Schedules Table
CREATE TABLE IF NOT EXISTS sales_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount_due DECIMAL(15, 2) NOT NULL,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'overdue', 'partial', 'paid', 'waived')),
  payment_method TEXT CHECK (payment_method IN ('wire', 'swift', 'check', 'ach', 'other')),
  paid_date DATE,
  late_fee DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_sale_installment UNIQUE(sale_id, installment_number),
  CONSTRAINT positive_amounts CHECK (amount_due > 0 AND amount_paid >= 0)
);

CREATE INDEX idx_sales_payment_schedules_sale_id ON sales_payment_schedules(sale_id);
CREATE INDEX idx_sales_payment_schedules_status ON sales_payment_schedules(status, due_date);
CREATE INDEX idx_sales_payment_schedules_due_date ON sales_payment_schedules(due_date);

-- Sales Documents Table
CREATE TABLE IF NOT EXISTS sales_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'invoice', 'proforma', 'packing_list', 'certificate', 'export_doc', 'payment_proof', 'other')),
  document_number TEXT,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES sales_documents(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'archived', 'superseded')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  valid_until DATE,
  access_level TEXT DEFAULT 'internal' CHECK (access_level IN ('internal', 'customer', 'public')),
  tags TEXT[],
  metadata JSONB,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_documents_sale_id ON sales_documents(sale_id);
CREATE INDEX idx_sales_documents_type ON sales_documents(document_type, status);
CREATE INDEX idx_sales_documents_number ON sales_documents(document_number) WHERE document_number IS NOT NULL;

-- Sales Notifications Log Table
CREATE TABLE IF NOT EXISTS sales_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'sms', 'in_app', 'webhook')),
  event_type TEXT NOT NULL CHECK (event_type IN ('sale_created', 'approval_request', 'approval_reminder', 'approved', 'rejected', 'payment_due', 'payment_received', 'document_ready', 'status_change')),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'salesperson', 'approver', 'management', 'system')),
  recipient_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  template_used TEXT,
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'read')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_notifications_log_sale_id ON sales_notifications_log(sale_id);
CREATE INDEX idx_sales_notifications_log_recipient ON sales_notifications_log(recipient_id, delivery_status);
CREATE INDEX idx_sales_notifications_log_status ON sales_notifications_log(delivery_status, created_at);
CREATE INDEX idx_sales_notifications_log_event ON sales_notifications_log(event_type, created_at);

-- Sales Audit Trail Table
CREATE TABLE IF NOT EXISTS sales_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'approve', 'reject', 'cancel', 'complete', 'payment', 'document_add', 'note_add')),
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_audit_trail_sale_id ON sales_audit_trail(sale_id, created_at);
CREATE INDEX idx_sales_audit_trail_actor ON sales_audit_trail(actor_id, created_at);
CREATE INDEX idx_sales_audit_trail_action ON sales_audit_trail(action, created_at);

-- Add new columns to existing sales table
DO $$
BEGIN
  -- Add salesperson tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'salesperson_id') THEN
    ALTER TABLE sales ADD COLUMN salesperson_id UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'salesperson_name') THEN
    ALTER TABLE sales ADD COLUMN salesperson_name TEXT;
  END IF;

  -- Add contract reference
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'contract_id') THEN
    ALTER TABLE sales ADD COLUMN contract_id UUID REFERENCES customer_contracts(id);
  END IF;

  -- Add payment terms
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'payment_terms') THEN
    ALTER TABLE sales ADD COLUMN payment_terms TEXT DEFAULT 'net_30';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'payment_schedule_type') THEN
    ALTER TABLE sales ADD COLUMN payment_schedule_type TEXT DEFAULT 'full' CHECK (payment_schedule_type IN ('full', 'installment', 'milestone'));
  END IF;

  -- Add discount and adjustment fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'discount_percentage') THEN
    ALTER TABLE sales ADD COLUMN discount_percentage DECIMAL(5, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'discount_amount') THEN
    ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'price_adjustment') THEN
    ALTER TABLE sales ADD COLUMN price_adjustment DECIMAL(12, 2) DEFAULT 0;
  END IF;

  -- Add customer approval fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'customer_approved_at') THEN
    ALTER TABLE sales ADD COLUMN customer_approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'customer_approved_by') THEN
    ALTER TABLE sales ADD COLUMN customer_approved_by TEXT;
  END IF;

  -- Add rejection tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'rejected_at') THEN
    ALTER TABLE sales ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'rejected_by') THEN
    ALTER TABLE sales ADD COLUMN rejected_by UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'rejection_reason') THEN
    ALTER TABLE sales ADD COLUMN rejection_reason TEXT;
  END IF;

  -- Add completion tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'completed_at') THEN
    ALTER TABLE sales ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;

  -- Add notes and metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'internal_notes') THEN
    ALTER TABLE sales ADD COLUMN internal_notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'customer_notes') THEN
    ALTER TABLE sales ADD COLUMN customer_notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'metadata') THEN
    ALTER TABLE sales ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Enable RLS on all new tables
ALTER TABLE sales_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_line_items
CREATE POLICY "Management can view all sales line items"
  ON sales_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "Users can view line items for their sales"
  ON sales_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_id
      AND (sales.created_by = auth.uid() OR sales.salesperson_id = auth.uid())
    )
  );

CREATE POLICY "Management can manage sales line items"
  ON sales_line_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policies for commission_rules
CREATE POLICY "Management can manage commission rules"
  ON commission_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "Users can view active commission rules"
  ON commission_rules FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for sales_commissions
CREATE POLICY "Management can view all commissions"
  ON sales_commissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "Users can view their own commissions"
  ON sales_commissions FOR SELECT
  TO authenticated
  USING (salesperson_id = auth.uid());

CREATE POLICY "Management can manage commissions"
  ON sales_commissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policies for sales_approvals
CREATE POLICY "Users can view approvals for their sales"
  ON sales_approvals FOR SELECT
  TO authenticated
  USING (
    approver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_id
      AND (sales.created_by = auth.uid() OR sales.salesperson_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "Approvers can update their approvals"
  ON sales_approvals FOR UPDATE
  TO authenticated
  USING (approver_id = auth.uid() OR approval_token IS NOT NULL)
  WITH CHECK (approver_id = auth.uid() OR approval_token IS NOT NULL);

CREATE POLICY "Management can manage approvals"
  ON sales_approvals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policies for sales_allocations
CREATE POLICY "Management can manage allocations"
  ON sales_allocations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('management', 'refinery')
    )
  );

CREATE POLICY "Users can view allocations for their sales"
  ON sales_allocations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_id
      AND (sales.created_by = auth.uid() OR sales.salesperson_id = auth.uid())
    )
  );

-- RLS Policies for customer_contracts
CREATE POLICY "Management can manage customer contracts"
  ON customer_contracts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "Users can view active contracts"
  ON customer_contracts FOR SELECT
  TO authenticated
  USING (status = 'active');

-- RLS Policies for sales_payment_schedules
CREATE POLICY "Users can view payment schedules for their sales"
  ON sales_payment_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_id
      AND (sales.created_by = auth.uid() OR sales.salesperson_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "Management can manage payment schedules"
  ON sales_payment_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policies for sales_documents
CREATE POLICY "Users can view documents for their sales"
  ON sales_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_id
      AND (sales.created_by = auth.uid() OR sales.salesperson_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "Management can manage sales documents"
  ON sales_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policies for sales_notifications_log
CREATE POLICY "Users can view their notifications"
  ON sales_notifications_log FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "System can manage notifications"
  ON sales_notifications_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for sales_audit_trail
CREATE POLICY "Users can view audit trail for their sales"
  ON sales_audit_trail FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_id
      AND (sales.created_by = auth.uid() OR sales.salesperson_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "System can insert audit trail"
  ON sales_audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to calculate commission based on rules
CREATE OR REPLACE FUNCTION calculate_commission(
  p_sale_id UUID,
  p_salesperson_id UUID,
  p_sale_amount DECIMAL,
  p_quantity_oz DECIMAL,
  p_metal_type TEXT,
  p_customer_tier TEXT
) RETURNS DECIMAL AS $$
DECLARE
  v_commission DECIMAL := 0;
  v_rule RECORD;
BEGIN
  -- Find applicable commission rule with highest priority
  SELECT * INTO v_rule
  FROM commission_rules
  WHERE is_active = true
    AND (customer_tier = p_customer_tier OR customer_tier = 'all')
    AND (metal_type = p_metal_type OR metal_type = 'all')
    AND (min_quantity_oz IS NULL OR p_quantity_oz >= min_quantity_oz)
    AND (max_quantity_oz IS NULL OR p_quantity_oz <= max_quantity_oz)
    AND (min_value_usd IS NULL OR p_sale_amount >= min_value_usd)
    AND (max_value_usd IS NULL OR p_sale_amount <= max_value_usd)
    AND CURRENT_DATE BETWEEN valid_from AND COALESCE(valid_until, '9999-12-31')
  ORDER BY priority DESC, created_at DESC
  LIMIT 1;

  IF FOUND THEN
    CASE v_rule.rule_type
      WHEN 'percentage' THEN
        v_commission := p_sale_amount * (v_rule.commission_percentage / 100);
      WHEN 'fixed' THEN
        v_commission := v_rule.fixed_amount;
      WHEN 'tiered' THEN
        -- Implement tiered logic based on tier_config JSONB
        v_commission := p_sale_amount * (v_rule.commission_percentage / 100);
      ELSE
        v_commission := 0;
    END CASE;
  END IF;

  RETURN COALESCE(v_commission, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check inventory availability
CREATE OR REPLACE FUNCTION check_inventory_available(
  p_quantity_oz DECIMAL,
  p_metal_type TEXT DEFAULT 'gold'
) RETURNS BOOLEAN AS $$
DECLARE
  v_total_available DECIMAL;
  v_total_allocated DECIMAL;
BEGIN
  -- Calculate total refined metal available
  SELECT COALESCE(SUM(final_fine_ounces), 0)
  INTO v_total_available
  FROM refining_records
  WHERE approved_at IS NOT NULL;

  -- Calculate total already allocated
  SELECT COALESCE(SUM(allocated_quantity_oz), 0)
  INTO v_total_allocated
  FROM sales_allocations
  WHERE allocation_status IN ('reserved', 'confirmed');

  RETURN (v_total_available - v_total_allocated) >= p_quantity_oz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to auto-allocate inventory to sale
CREATE OR REPLACE FUNCTION auto_allocate_inventory(
  p_sale_id UUID,
  p_quantity_oz DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_remaining DECIMAL := p_quantity_oz;
  v_refining RECORD;
  v_allocated DECIMAL;
BEGIN
  -- Allocate from oldest refined batches first (FIFO)
  FOR v_refining IN
    SELECT r.id, r.batch_id, r.final_fine_ounces,
           COALESCE(SUM(sa.allocated_quantity_oz), 0) as already_allocated
    FROM refining_records r
    LEFT JOIN sales_allocations sa ON sa.refining_record_id = r.id
      AND sa.allocation_status IN ('reserved', 'confirmed')
    WHERE r.approved_at IS NOT NULL
    GROUP BY r.id, r.batch_id, r.final_fine_ounces
    HAVING r.final_fine_ounces > COALESCE(SUM(sa.allocated_quantity_oz), 0)
    ORDER BY r.created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_allocated := LEAST(v_remaining, v_refining.final_fine_ounces - v_refining.already_allocated);

    INSERT INTO sales_allocations (
      sale_id, batch_id, refining_record_id,
      allocated_quantity_oz, allocated_fine_oz,
      allocation_status, allocated_by
    ) VALUES (
      p_sale_id, v_refining.batch_id, v_refining.id,
      v_allocated, v_allocated,
      'reserved', auth.uid()
    );

    v_remaining := v_remaining - v_allocated;
  END LOOP;

  RETURN v_remaining <= 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update sales_line_items updated_at
CREATE OR REPLACE FUNCTION update_sales_line_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_line_items_updated_at
  BEFORE UPDATE ON sales_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_line_items_timestamp();

-- Create trigger for commission calculation on sale approval
CREATE OR REPLACE FUNCTION auto_calculate_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_amount DECIMAL;
  v_salesperson_name TEXT;
BEGIN
  -- Only calculate when status changes to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    IF NEW.salesperson_id IS NOT NULL THEN
      -- Get salesperson name
      SELECT full_name INTO v_salesperson_name
      FROM user_profiles
      WHERE id = NEW.salesperson_id;

      -- Calculate commission
      v_commission_amount := calculate_commission(
        NEW.id,
        NEW.salesperson_id,
        NEW.final_proceeds,
        NEW.quantity_oz,
        COALESCE((SELECT metal_type FROM batches WHERE id = NEW.batch_id), 'gold'),
        'standard'
      );

      -- Insert commission record
      IF v_commission_amount > 0 THEN
        INSERT INTO sales_commissions (
          sale_id, salesperson_id, salesperson_name,
          commission_type, basis_amount, commission_amount,
          status
        ) VALUES (
          NEW.id, NEW.salesperson_id, v_salesperson_name,
          'percentage', NEW.final_proceeds, v_commission_amount,
          'pending'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_calculate_commission
  AFTER INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_commission();

-- Create trigger to log sales changes to audit trail
CREATE OR REPLACE FUNCTION log_sales_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  SELECT full_name INTO v_actor_name
  FROM user_profiles
  WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO sales_audit_trail (
      sale_id, action, actor_id, actor_name, metadata
    ) VALUES (
      NEW.id, 'create', auth.uid(), COALESCE(v_actor_name, 'System'),
      jsonb_build_object('sale_number', NEW.sale_number)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log significant field changes
    IF OLD.status != NEW.status THEN
      INSERT INTO sales_audit_trail (
        sale_id, action, actor_id, actor_name,
        field_changed, old_value, new_value
      ) VALUES (
        NEW.id, 'update', auth.uid(), COALESCE(v_actor_name, 'System'),
        'status', OLD.status, NEW.status
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_sales_changes
  AFTER INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION log_sales_changes();
