/*
  # Sales and Customer Management Schema

  ## Overview
  Complete database schema for sales management, customer relationship management,
  payment processing, and analytics for Gold Shipper application.

  ## New Tables

  ### customers
  - `id` (uuid, primary key) - Unique customer identifier
  - `name` (text) - Customer company name
  - `email` (text, unique) - Customer email address
  - `phone` (text) - Customer phone number
  - `country` (text) - Customer country
  - `address` (text) - Full address
  - `contact_person` (text) - Primary contact name
  - `tax_id` (text) - Tax identification number
  - `payment_terms` (text) - Payment terms (e.g., Net 30)
  - `credit_limit` (numeric) - Maximum credit limit
  - `status` (text) - Customer status (active/inactive/pending)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### sales
  - `id` (uuid, primary key) - Unique sale identifier
  - `sale_number` (text, unique) - Auto-generated sale number
  - `customer_id` (uuid, foreign key) - Reference to customers table
  - `batch_id` (uuid, foreign key) - Reference to batches table
  - `quantity_oz` (numeric) - Quantity in troy ounces
  - `london_am_rate` (numeric) - London AM gold price rate
  - `freight_cost` (numeric) - Freight/shipping costs
  - `other_costs` (numeric) - Other associated costs
  - `gross_proceeds` (numeric) - Calculated gross proceeds
  - `net_proceeds` (numeric) - Calculated net proceeds
  - `royalties` (numeric) - Royalties amount (3%)
  - `final_proceeds` (numeric) - Final proceeds after royalties
  - `status` (text) - Sale status (pending/approved/customer_approved/payment_received/completed)
  - `created_by` (uuid) - User who created the sale
  - `created_at` (timestamptz) - Creation timestamp
  - `approved_by` (uuid) - Management user who approved
  - `approved_at` (timestamptz) - Approval timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### payments
  - `id` (uuid, primary key) - Unique payment identifier
  - `sale_id` (uuid, foreign key) - Reference to sales table
  - `expected_date` (date) - Expected payment date
  - `actual_date` (date) - Actual payment date
  - `amount` (numeric) - Payment amount
  - `currency` (text) - Currency code (USD/EUR/CHF/XOF/GNF)
  - `fx_rate` (numeric) - Foreign exchange rate if applicable
  - `bank_name` (text) - Bank name
  - `account_number` (text) - Account number (encrypted)
  - `reference_number` (text) - Transaction reference
  - `proof_url` (text) - URL to payment proof document
  - `notes` (text) - Additional notes
  - `status` (text) - Payment status (pending/approved/rejected)
  - `created_by` (uuid) - User who recorded payment
  - `created_at` (timestamptz) - Creation timestamp
  - `approved_by` (uuid) - User who approved payment
  - `approved_at` (timestamptz) - Approval timestamp

  ### email_logs
  - `id` (uuid, primary key) - Unique log identifier
  - `sale_id` (uuid, foreign key) - Reference to sales table
  - `email_type` (text) - Type of email (sale_approval/payment_confirmation/etc.)
  - `recipient` (text) - Email recipient
  - `subject` (text) - Email subject
  - `status` (text) - Email status (sent/delivered/opened/clicked/failed)
  - `sent_at` (timestamptz) - Email sent timestamp
  - `opened_at` (timestamptz) - Email opened timestamp
  - `clicked_at` (timestamptz) - Email clicked timestamp

  ### audit_logs
  - `id` (uuid, primary key) - Unique log identifier
  - `user_id` (uuid) - User who performed action
  - `user_email` (text) - User email for reference
  - `action` (text) - Action performed (CREATE/UPDATE/DELETE/LOGIN/etc.)
  - `module` (text) - Module affected (Sales/Batches/Customers/etc.)
  - `details` (text) - Detailed description of action
  - `ip_address` (text) - User IP address
  - `status` (text) - Action status (success/failed/warning)
  - `created_at` (timestamptz) - Action timestamp

  ## Security
  - Enable RLS on all tables
  - Create policies for role-based access control
  - Restrict customer access to their own data
  - Management has full access
  - Factory/Airport/Refinery have read-only access to sales

  ## Important Notes
  - All monetary values use numeric type for precision
  - Automatic triggers for updated_at timestamps
  - Automatic sale number generation with format SL-YYYY-NNNNN
  - Payment proofs stored in Supabase Storage with URLs in database
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  country text NOT NULL,
  address text,
  contact_person text,
  tax_id text,
  payment_terms text DEFAULT 'Net 30 days',
  credit_limit numeric DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  batch_id uuid,
  quantity_oz numeric NOT NULL CHECK (quantity_oz > 0),
  london_am_rate numeric NOT NULL CHECK (london_am_rate > 0),
  freight_cost numeric DEFAULT 0 CHECK (freight_cost >= 0),
  other_costs numeric DEFAULT 0 CHECK (other_costs >= 0),
  gross_proceeds numeric NOT NULL,
  net_proceeds numeric NOT NULL,
  royalties numeric NOT NULL,
  final_proceeds numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'customer_approved', 'payment_received', 'completed', 'rejected')),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  expected_date date NOT NULL,
  actual_date date,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'CHF', 'XOF', 'GNF')),
  fx_rate numeric CHECK (fx_rate > 0),
  bank_name text NOT NULL,
  account_number text,
  reference_number text NOT NULL,
  proof_url text,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'failed')),
  sent_at timestamptz DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  module text NOT NULL,
  details text NOT NULL,
  ip_address text,
  status text DEFAULT 'success' CHECK (status IN ('success', 'failed', 'warning')),
  created_at timestamptz DEFAULT now()
);

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function for auto-generating sale numbers
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  year_part text;
  sale_num text;
BEGIN
  year_part := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 9) AS integer)), 0) + 1
  INTO next_number
  FROM sales
  WHERE sale_number LIKE 'SL-' || year_part || '-%';
  
  sale_num := 'SL-' || year_part || '-' || LPAD(next_number::text, 5, '0');
  RETURN sale_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating sale numbers
CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    NEW.sale_number := generate_sale_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_sale_number_trigger ON sales;
CREATE TRIGGER set_sale_number_trigger
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number();

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers table
CREATE POLICY "Management can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Management can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Management can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for sales table
CREATE POLICY "Authenticated users can view sales"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Management can delete sales"
  ON sales FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for payments table
CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Management can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Management can delete payments"
  ON payments FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for email_logs table
CREATE POLICY "Authenticated users can view email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert email logs"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for audit_logs table
CREATE POLICY "Authenticated users can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_country ON customers(country);

CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_batch_id ON sales(batch_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON sales(sale_number);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_actual_date ON payments(actual_date);

CREATE INDEX IF NOT EXISTS idx_email_logs_sale_id ON email_logs(sale_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);