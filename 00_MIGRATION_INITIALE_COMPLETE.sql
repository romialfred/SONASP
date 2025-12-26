/*
  ===================================================================
  MIGRATION INITIALE COMPLÈTE - GOLD SHIPPER SYSTEM
  ===================================================================

  Cette migration crée TOUTES les tables de base nécessaires au
  fonctionnement du système Gold Shipper.

  IMPORTANT: À exécuter dans le SQL Editor de Supabase
  URL: https://ngqipcqoutsedhtvrjbj.supabase.co

  Ordre d'exécution: PREMIÈRE MIGRATION (00)
  ===================================================================
*/

-- ============================================================================
-- 1. TABLE: profiles (Profils utilisateurs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  role text CHECK (role IN ('Factory', 'Airport', 'Refinery', 'Customer', 'Management')),
  site text,
  mining_company_id uuid,

  -- Permissions
  can_approve_sales boolean DEFAULT false,
  can_manage_users boolean DEFAULT false,
  can_view_analytics boolean DEFAULT false,
  can_export_data boolean DEFAULT false,

  -- Métadonnées
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_mining_company ON profiles(mining_company_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. TABLE: mining_companies (Compagnies minières)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mining_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  abbreviation text,
  country text DEFAULT 'Mali',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mining_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mining companies"
  ON mining_companies FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 3. TABLE: sites (Sites d'exploitation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mining_company_id uuid REFERENCES mining_companies(id),
  country text DEFAULT 'Mali',

  created_at timestamptz DEFAULT now(),

  UNIQUE(name, mining_company_id)
);

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sites"
  ON sites FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 4. TABLE: depositors (Déposants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS depositors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  id_number text,
  phone text,
  mining_company_id uuid REFERENCES mining_companies(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_depositors_mining_company ON depositors(mining_company_id);

ALTER TABLE depositors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view depositors"
  ON depositors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert depositors"
  ON depositors FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 5. TABLE: daily_production (Production quotidienne)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_production (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_date date NOT NULL,
  site_id uuid REFERENCES sites(id),
  mining_company_id uuid REFERENCES mining_companies(id),
  depositor_id uuid REFERENCES depositors(id),

  -- Poids
  gross_weight_grams decimal(10,3),
  net_weight_grams decimal(10,3),
  net_weight_oz decimal(10,3),

  -- Statut
  status text DEFAULT 'prepared',

  -- Documents
  assay_certificate_url text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_production_date ON daily_production(production_date);
CREATE INDEX IF NOT EXISTS idx_production_site ON daily_production(site_id);
CREATE INDEX IF NOT EXISTS idx_production_mining_company ON daily_production(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_production_status ON daily_production(status);

ALTER TABLE daily_production ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view production"
  ON daily_production FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert production"
  ON daily_production FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update production"
  ON daily_production FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. TABLE: gold_inventory (Inventaire or)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gold_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mining_company_id uuid REFERENCES mining_companies(id),

  quantity_grams decimal(15,3) DEFAULT 0,
  quantity_oz decimal(15,3) DEFAULT 0,

  last_updated timestamptz DEFAULT now()
);

ALTER TABLE gold_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inventory"
  ON gold_inventory FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 7. TABLE: shipping_preparations (Préparations d'expédition)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipping_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_date date,
  mining_company_id uuid REFERENCES mining_companies(id),

  total_weight_grams decimal(15,3),
  total_weight_oz decimal(15,3),

  status text DEFAULT 'draft',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_shipping_mining_company ON shipping_preparations(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_shipping_status ON shipping_preparations(status);

ALTER TABLE shipping_preparations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shipping"
  ON shipping_preparations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert shipping"
  ON shipping_preparations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update shipping"
  ON shipping_preparations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 8. TABLE: refineries (Raffineries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS refineries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  country text,
  city text,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE refineries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view refineries"
  ON refineries FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 9. TABLE: customers (Clients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  email text,
  phone text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 10. TABLE: sales (Ventes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date date,
  customer_id uuid REFERENCES customers(id),
  mining_company_id uuid REFERENCES mining_companies(id),

  quantity_grams decimal(10,3),
  quantity_oz decimal(10,3),

  gold_price_usd decimal(10,2),
  gross_proceeds_usd decimal(15,2),

  status text DEFAULT 'pending',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_mining_company ON sales(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 11. TABLE: payments (Paiements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id),

  amount_usd decimal(15,2),
  currency text DEFAULT 'USD',

  payment_date date,
  payment_proof_url text,

  status text DEFAULT 'pending',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 12. TABLE: transport_companies (Compagnies de transport)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transport_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  country text,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transport companies"
  ON transport_companies FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 13. TABLE: gold_prices (Prix de l'or)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gold_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date date NOT NULL UNIQUE,
  price_usd_oz decimal(10,2),
  source text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gold_prices_date ON gold_prices(price_date);

ALTER TABLE gold_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view gold prices"
  ON gold_prices FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 14. TABLE: fx_rates_daily (Taux de change quotidiens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fx_rates_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date NOT NULL,
  currency_pair text NOT NULL,
  rate decimal(15,6),
  source text,

  created_at timestamptz DEFAULT now(),

  UNIQUE(rate_date, currency_pair)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_date ON fx_rates_daily(rate_date);
CREATE INDEX IF NOT EXISTS idx_fx_rates_pair ON fx_rates_daily(currency_pair);

ALTER TABLE fx_rates_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fx rates"
  ON fx_rates_daily FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 15. TABLE: modules (Modules système)
-- ============================================================================
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  icon text,
  route text,
  category text,
  is_active boolean DEFAULT true,
  display_order int,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view modules"
  ON modules FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 16. TABLE: user_permissions (Permissions utilisateurs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,

  can_view boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_approve boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),

  UNIQUE(user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module ON user_permissions(module_id);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 17. Trigger: updated_at automatique
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mining_companies_updated_at ON mining_companies;
CREATE TRIGGER update_mining_companies_updated_at
  BEFORE UPDATE ON mining_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_depositors_updated_at ON depositors;
CREATE TRIGGER update_depositors_updated_at
  BEFORE UPDATE ON depositors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_production_updated_at ON daily_production;
CREATE TRIGGER update_production_updated_at
  BEFORE UPDATE ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipping_updated_at ON shipping_preparations;
CREATE TRIGGER update_shipping_updated_at
  BEFORE UPDATE ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 18. Données initiales: Compagnies minières
-- ============================================================================
INSERT INTO mining_companies (name, abbreviation, country)
VALUES
  ('Yanfolila', 'YAN', 'Mali'),
  ('Morila', 'MOR', 'Mali'),
  ('Kalana', 'KAL', 'Mali')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- FIN DE LA MIGRATION INITIALE
-- ============================================================================
