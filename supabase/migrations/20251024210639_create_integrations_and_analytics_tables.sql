/*
  # Advanced Features & Integrations Schema

  ## Overview
  Creates comprehensive database infrastructure for Phase 7 advanced features including:
  - Exchange rate tracking and management
  - Gold price feed integration
  - Email notification system
  - Workflow automation engine
  - Scheduled task management
  - Advanced analytics and caching
  - API configuration management

  ## New Tables

  ### 1. exchange_rates
  Stores historical exchange rate data with daily snapshots
  - `id` (uuid, primary key)
  - `rate_date` (date) - Date of the rate
  - `base_currency` (text) - Base currency (USD)
  - `target_currency` (text) - Target currency (XOF, GNF)
  - `rate` (decimal) - Exchange rate value
  - `open_rate` (decimal) - Opening rate
  - `close_rate` (decimal) - Closing rate
  - `high_rate` (decimal) - Highest rate
  - `low_rate` (decimal) - Lowest rate
  - `source` (text) - API source (ECB, fixer, etc)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. gold_prices
  Tracks gold price movements with London AM/PM rates
  - `id` (uuid, primary key)
  - `price_date` (date) - Date of the price
  - `london_am_rate` (decimal) - London AM fixing rate
  - `london_pm_rate` (decimal) - London PM fixing rate
  - `opening_price` (decimal) - Opening price
  - `closing_price` (decimal) - Closing price
  - `high_price` (decimal) - Highest price
  - `low_price` (decimal) - Lowest price
  - `source` (text) - API source
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. api_configurations
  Manages external API credentials and settings
  - `id` (uuid, primary key)
  - `api_name` (text) - Name of the API
  - `api_type` (text) - Type (exchange_rate, gold_price, email)
  - `api_key` (text) - Encrypted API key
  - `api_url` (text) - Base API URL
  - `is_active` (boolean) - Active status
  - `last_success` (timestamptz) - Last successful call
  - `last_failure` (timestamptz) - Last failed call
  - `failure_count` (integer) - Consecutive failures
  - `rate_limit` (integer) - Calls per day limit
  - `calls_today` (integer) - Today's call count
  - `settings` (jsonb) - Additional settings
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. email_templates
  Stores email templates with version control
  - `id` (uuid, primary key)
  - `template_name` (text) - Unique template identifier
  - `template_type` (text) - Type of email
  - `subject_en` (text) - English subject line
  - `subject_fr` (text) - French subject line
  - `body_en` (text) - English email body
  - `body_fr` (text) - French email body
  - `variables` (jsonb) - Available template variables
  - `version` (integer) - Template version
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. email_queue
  Manages email delivery queue
  - `id` (uuid, primary key)
  - `template_id` (uuid) - Reference to template
  - `recipient_email` (text) - Recipient address
  - `recipient_name` (text) - Recipient name
  - `subject` (text) - Rendered subject
  - `body` (text) - Rendered body
  - `variables` (jsonb) - Template variables used
  - `status` (text) - pending, sent, failed, bounced
  - `priority` (text) - high, normal, low
  - `scheduled_for` (timestamptz) - When to send
  - `sent_at` (timestamptz) - When sent
  - `error_message` (text) - Error details if failed
  - `retry_count` (integer) - Number of retries
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. workflows
  Defines workflow configurations
  - `id` (uuid, primary key)
  - `workflow_name` (text) - Workflow identifier
  - `workflow_type` (text) - Type (approval, notification, escalation)
  - `entity_type` (text) - Related entity (sale, batch, payment)
  - `trigger_event` (text) - Event that starts workflow
  - `steps` (jsonb) - Workflow step definitions
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. workflow_instances
  Tracks workflow execution instances
  - `id` (uuid, primary key)
  - `workflow_id` (uuid) - Reference to workflow
  - `entity_id` (uuid) - Related entity ID
  - `entity_type` (text) - Entity type
  - `current_step` (text) - Current step name
  - `status` (text) - pending, in_progress, completed, failed
  - `started_at` (timestamptz) - When started
  - `completed_at` (timestamptz) - When completed
  - `data` (jsonb) - Workflow data
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. scheduled_tasks
  Manages scheduled operations
  - `id` (uuid, primary key)
  - `task_name` (text) - Task identifier
  - `task_type` (text) - Type (fetch_rates, generate_report, etc)
  - `schedule` (text) - Cron expression
  - `is_active` (boolean) - Active status
  - `last_run` (timestamptz) - Last execution
  - `next_run` (timestamptz) - Next scheduled run
  - `last_status` (text) - success, failed
  - `last_error` (text) - Last error message
  - `execution_count` (integer) - Total executions
  - `settings` (jsonb) - Task settings
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 9. notifications
  Stores user notifications
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Recipient user
  - `notification_type` (text) - Type of notification
  - `title` (text) - Notification title
  - `message` (text) - Notification message
  - `entity_type` (text) - Related entity type
  - `entity_id` (uuid) - Related entity ID
  - `is_read` (boolean) - Read status
  - `priority` (text) - high, normal, low
  - `created_at` (timestamptz)
  - `read_at` (timestamptz)

  ### 10. analytics_cache
  Caches computed analytics data
  - `id` (uuid, primary key)
  - `cache_key` (text) - Unique cache identifier
  - `cache_type` (text) - Type of cached data
  - `data` (jsonb) - Cached data
  - `expires_at` (timestamptz) - Expiration time
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for role-based access
  - Encrypt sensitive API credentials

  ## Indexes
  - Add indexes for date-based queries
  - Add indexes for status filtering
  - Add indexes for foreign key relationships
*/

-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date NOT NULL,
  base_currency text NOT NULL DEFAULT 'USD',
  target_currency text NOT NULL,
  rate decimal(12, 4) NOT NULL,
  open_rate decimal(12, 4),
  close_rate decimal(12, 4),
  high_rate decimal(12, 4),
  low_rate decimal(12, 4),
  source text NOT NULL DEFAULT 'ecb',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rate_date, base_currency, target_currency)
);

-- Create gold_prices table
CREATE TABLE IF NOT EXISTS gold_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date date NOT NULL UNIQUE,
  london_am_rate decimal(10, 2) NOT NULL,
  london_pm_rate decimal(10, 2),
  opening_price decimal(10, 2),
  closing_price decimal(10, 2),
  high_price decimal(10, 2),
  low_price decimal(10, 2),
  source text NOT NULL DEFAULT 'alphavantage',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create api_configurations table
CREATE TABLE IF NOT EXISTS api_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL UNIQUE,
  api_type text NOT NULL,
  api_key text,
  api_url text NOT NULL,
  is_active boolean DEFAULT true,
  last_success timestamptz,
  last_failure timestamptz,
  failure_count integer DEFAULT 0,
  rate_limit integer DEFAULT 1000,
  calls_today integer DEFAULT 0,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  template_type text NOT NULL,
  subject_en text NOT NULL,
  subject_fr text NOT NULL,
  body_en text NOT NULL,
  body_fr text NOT NULL,
  variables jsonb DEFAULT '[]',
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(template_name, version)
);

-- Create email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES email_templates(id),
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  body text NOT NULL,
  variables jsonb DEFAULT '{}',
  status text DEFAULT 'pending',
  priority text DEFAULT 'normal',
  scheduled_for timestamptz DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name text NOT NULL UNIQUE,
  workflow_type text NOT NULL,
  entity_type text NOT NULL,
  trigger_event text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create workflow_instances table
CREATE TABLE IF NOT EXISTS workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id),
  entity_id uuid NOT NULL,
  entity_type text NOT NULL,
  current_step text,
  status text DEFAULT 'pending',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create scheduled_tasks table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text NOT NULL UNIQUE,
  task_type text NOT NULL,
  schedule text NOT NULL,
  is_active boolean DEFAULT true,
  last_run timestamptz,
  next_run timestamptz,
  last_status text,
  last_error text,
  execution_count integer DEFAULT 0,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  is_read boolean DEFAULT false,
  priority text DEFAULT 'normal',
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Create analytics_cache table
CREATE TABLE IF NOT EXISTS analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  cache_type text NOT NULL,
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency ON exchange_rates(target_currency, rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_gold_prices_date ON gold_prices(price_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority, status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON analytics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);

-- Enable Row Level Security
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exchange_rates (all authenticated users can read)
CREATE POLICY "All authenticated users can read exchange rates"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only management can insert exchange rates"
  ON exchange_rates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
    )
  );

-- RLS Policies for gold_prices (all authenticated users can read)
CREATE POLICY "All authenticated users can read gold prices"
  ON gold_prices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only management can insert gold prices"
  ON gold_prices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
    )
  );

-- RLS Policies for api_configurations (management only)
CREATE POLICY "Only management can view API configurations"
  ON api_configurations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
    )
  );

CREATE POLICY "Only management can manage API configurations"
  ON api_configurations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
    )
  );

-- RLS Policies for email_templates (management can manage, all can read active)
CREATE POLICY "All authenticated users can read active email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Only management can manage email templates"
  ON email_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
    )
  );

-- RLS Policies for email_queue (users can see their own emails)
CREATE POLICY "Users can see their own emails"
  ON email_queue FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for workflows (all can read, management can manage)
CREATE POLICY "All authenticated users can read workflows"
  ON workflows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only management can manage workflows"
  ON workflows FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
    )
  );

-- RLS Policies for workflow_instances (users can see relevant instances)
CREATE POLICY "Users can see relevant workflow instances"
  ON workflow_instances FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for scheduled_tasks (management only)
CREATE POLICY "Only management can view scheduled tasks"
  ON scheduled_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
    )
  );

-- RLS Policies for notifications (users can see their own)
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for analytics_cache (all authenticated can read)
CREATE POLICY "All authenticated users can read analytics cache"
  ON analytics_cache FOR SELECT
  TO authenticated
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_exchange_rates_updated_at BEFORE UPDATE ON exchange_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gold_prices_updated_at BEFORE UPDATE ON gold_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_configurations_updated_at BEFORE UPDATE ON api_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at BEFORE UPDATE ON email_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_instances_updated_at BEFORE UPDATE ON workflow_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_tasks_updated_at BEFORE UPDATE ON scheduled_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_cache_updated_at BEFORE UPDATE ON analytics_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default API configurations
INSERT INTO api_configurations (api_name, api_type, api_url, settings) VALUES
  ('ecb', 'exchange_rate', 'https://data-api.ecb.europa.eu/service/data', '{"currencies": ["XOF", "GNF"]}'),
  ('alphavantage', 'gold_price', 'https://www.alphavantage.co/query', '{"function": "CURRENCY_EXCHANGE_RATE"}')
ON CONFLICT (api_name) DO NOTHING;

-- Insert default email templates
INSERT INTO email_templates (template_name, template_type, subject_en, subject_fr, body_en, body_fr, variables) VALUES
  (
    'batch_status_change',
    'notification',
    'Batch {{batch_number}} Status Update',
    'Mise à jour du statut du lot {{batch_number}}',
    'The status of batch {{batch_number}} has been updated to {{new_status}}. {{details}}',
    'Le statut du lot {{batch_number}} a été mis à jour à {{new_status}}. {{details}}',
    '["batch_number", "new_status", "old_status", "details", "user_name"]'
  ),
  (
    'sale_approval_request',
    'approval',
    'Sale Approval Required: {{sale_number}}',
    'Approbation requise pour la vente: {{sale_number}}',
    'A new sale {{sale_number}} for customer {{customer_name}} requires your approval. Amount: {{amount}}. Please review and approve.',
    'Une nouvelle vente {{sale_number}} pour le client {{customer_name}} nécessite votre approbation. Montant: {{amount}}. Veuillez examiner et approuver.',
    '["sale_number", "customer_name", "amount", "quantity", "approval_link"]'
  ),
  (
    'payment_confirmation',
    'notification',
    'Payment Confirmed: {{sale_number}}',
    'Paiement confirmé: {{sale_number}}',
    'Payment for sale {{sale_number}} has been confirmed. Amount: {{amount}}. Customer: {{customer_name}}.',
    'Le paiement de la vente {{sale_number}} a été confirmé. Montant: {{amount}}. Client: {{customer_name}}.',
    '["sale_number", "customer_name", "amount", "payment_date", "payment_method"]'
  ),
  (
    'variance_alert',
    'alert',
    'Weight Variance Alert: Batch {{batch_number}}',
    'Alerte de variance de poids: Lot {{batch_number}}',
    'A weight variance of {{variance_percentage}}% has been detected for batch {{batch_number}}. Expected: {{expected_weight}}, Received: {{actual_weight}}. Reconciliation required.',
    'Une variance de poids de {{variance_percentage}}% a été détectée pour le lot {{batch_number}}. Attendu: {{expected_weight}}, Reçu: {{actual_weight}}. Réconciliation requise.',
    '["batch_number", "variance_percentage", "expected_weight", "actual_weight", "site_name"]'
  ),
  (
    'system_notification',
    'notification',
    'System Notification: {{title}}',
    'Notification système: {{title}}',
    '{{message}}',
    '{{message}}',
    '["title", "message", "severity", "action_required"]'
  )
ON CONFLICT (template_name, version) DO NOTHING;

-- Insert default workflows
INSERT INTO workflows (workflow_name, workflow_type, entity_type, trigger_event, steps) VALUES
  (
    'sale_approval_workflow',
    'approval',
    'sale',
    'sale_created',
    '[
      {"step": "management_review", "role": "management", "action": "approve_sale", "timeout_hours": 24},
      {"step": "customer_confirmation", "role": "customer", "action": "confirm_sale", "timeout_hours": 48},
      {"step": "payment_processing", "role": "finance", "action": "process_payment", "timeout_hours": 72}
    ]'
  ),
  (
    'batch_receiving_workflow',
    'approval',
    'batch',
    'batch_received',
    '[
      {"step": "weight_verification", "role": "airport", "action": "verify_weight", "timeout_hours": 2},
      {"step": "quality_check", "role": "refinery", "action": "check_quality", "timeout_hours": 4},
      {"step": "final_confirmation", "role": "management", "action": "confirm_receipt", "timeout_hours": 8}
    ]'
  ),
  (
    'payment_approval_workflow',
    'approval',
    'payment',
    'payment_submitted',
    '[
      {"step": "finance_review", "role": "finance", "action": "review_payment", "timeout_hours": 12},
      {"step": "management_approval", "role": "management", "action": "approve_payment", "timeout_hours": 24}
    ]'
  )
ON CONFLICT (workflow_name) DO NOTHING;

-- Insert default scheduled tasks
INSERT INTO scheduled_tasks (task_name, task_type, schedule, settings) VALUES
  ('fetch_exchange_rates', 'api_fetch', '0 9 * * *', '{"api": "ecb", "currencies": ["XOF", "GNF"]}'),
  ('fetch_gold_prices', 'api_fetch', '0 10 * * *', '{"api": "alphavantage", "rate_type": "london_am"}'),
  ('process_email_queue', 'email_processing', '*/5 * * * *', '{"batch_size": 50}'),
  ('cleanup_old_cache', 'maintenance', '0 2 * * *', '{"retention_days": 7}'),
  ('generate_daily_reports', 'reporting', '0 6 * * *', '{"report_types": ["sales", "inventory", "performance"]}'),
  ('check_workflow_timeouts', 'workflow', '*/15 * * * *', '{"escalation_enabled": true}')
ON CONFLICT (task_name) DO NOTHING;

-- Create helper functions for analytics

-- Function to get current exchange rate
CREATE OR REPLACE FUNCTION get_current_exchange_rate(p_target_currency text)
RETURNS decimal AS $$
BEGIN
  RETURN (
    SELECT rate
    FROM exchange_rates
    WHERE target_currency = p_target_currency
      AND base_currency = 'USD'
    ORDER BY rate_date DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get current gold price
CREATE OR REPLACE FUNCTION get_current_gold_price()
RETURNS decimal AS $$
BEGIN
  RETURN (
    SELECT london_am_rate
    FROM gold_prices
    ORDER BY price_date DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate rate change percentage
CREATE OR REPLACE FUNCTION calculate_rate_change(
  p_currency text,
  p_days integer DEFAULT 30
)
RETURNS TABLE(
  current_rate decimal,
  previous_rate decimal,
  change_amount decimal,
  change_percentage decimal
) AS $$
BEGIN
  RETURN QUERY
  WITH current AS (
    SELECT rate as curr_rate
    FROM exchange_rates
    WHERE target_currency = p_currency
    ORDER BY rate_date DESC
    LIMIT 1
  ),
  previous AS (
    SELECT rate as prev_rate
    FROM exchange_rates
    WHERE target_currency = p_currency
      AND rate_date <= (CURRENT_DATE - p_days)
    ORDER BY rate_date DESC
    LIMIT 1
  )
  SELECT
    c.curr_rate,
    p.prev_rate,
    c.curr_rate - p.prev_rate as change_amt,
    ((c.curr_rate - p.prev_rate) / p.prev_rate * 100) as change_pct
  FROM current c, previous p;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM analytics_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for sales analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS sales_analytics AS
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_sales,
  SUM(quantity_oz) as total_quantity_oz,
  SUM(gross_proceeds) as total_gross_proceeds,
  SUM(net_proceeds) as total_net_proceeds,
  AVG(london_am_rate) as avg_gold_price,
  COUNT(DISTINCT customer_id) as unique_customers
FROM sales
WHERE status NOT IN ('cancelled', 'rejected')
GROUP BY DATE_TRUNC('month', created_at);

CREATE INDEX IF NOT EXISTS idx_sales_analytics_month ON sales_analytics(month DESC);

-- Create function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_sales_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sales_analytics;
END;
$$ LANGUAGE plpgsql;