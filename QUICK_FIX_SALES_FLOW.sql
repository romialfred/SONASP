/*
  ============================================
  QUICK FIX - GOLD SALES FLOW UPDATE
  ============================================

  This is a simplified version without verification queries.
  Just creates customers, table, and configures relationships.

  COPY AND PASTE INTO SUPABASE SQL EDITOR AND RUN

  ============================================
*/

-- Create new customers
INSERT INTO customers (name, email, phone, country, address, contact_person, tax_id, payment_terms, credit_limit, status) VALUES
('Mansa Management Middle East', 'contact@mansa-me.com', '+971 4 XXX XXXX', 'United Arab Emirates', 'Dubai', 'TBD', 'UAE-MMME-001', 'Net 30 days', 5000000, 'active'),
('Hummingbird Resources', 'contact@hummingbirdresources.com', '+44 20 XXXX XXXX', 'United Kingdom', 'London', 'TBD', 'UK-HBR-001', 'Net 30 days', 5000000, 'active'),
('Auranet International', 'contact@auranet.com', '+1 XXX XXX XXXX', 'United States', 'New York', 'TBD', 'US-AURANET-001', 'Net 30 days', 10000000, 'active'),
('Aurion Trading', 'contact@aurion-trading.com', '+41 XX XXX XX XX', 'Switzerland', 'Geneva', 'TBD', 'CH-AURION-001', 'Net 30 days', 2000000, 'active'),
('Coris Investment Group', 'contact@corisinvestment.com', '+226 XX XX XX XX', 'Burkina Faso', 'Ouagadougou', 'TBD', 'BF-CIG-001', 'Net 30 days', 1000000, 'active')
ON CONFLICT (email) DO NOTHING;

-- Create secondary_distributions table
CREATE TABLE IF NOT EXISTS secondary_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intermediary_customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  end_customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  distribution_percentage numeric(5, 2) NOT NULL CHECK (distribution_percentage > 0 AND distribution_percentage <= 100),
  is_active boolean NOT NULL DEFAULT true,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  updated_by uuid REFERENCES user_profiles(id),
  CONSTRAINT no_self_distribution CHECK (intermediary_customer_id != end_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_secondary_distributions_intermediary ON secondary_distributions(intermediary_customer_id);
CREATE INDEX IF NOT EXISTS idx_secondary_distributions_end_customer ON secondary_distributions(end_customer_id);
CREATE INDEX IF NOT EXISTS idx_secondary_distributions_active ON secondary_distributions(is_active);

ALTER TABLE secondary_distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all distributions" ON secondary_distributions;
DROP POLICY IF EXISTS "Authenticated users can insert distributions" ON secondary_distributions;
DROP POLICY IF EXISTS "Authenticated users can update distributions" ON secondary_distributions;
DROP POLICY IF EXISTS "Authenticated users can delete distributions" ON secondary_distributions;

CREATE POLICY "Authenticated users can view all distributions" ON secondary_distributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert distributions" ON secondary_distributions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update distributions" ON secondary_distributions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete distributions" ON secondary_distributions FOR DELETE TO authenticated USING (true);

-- Validation function
CREATE OR REPLACE FUNCTION validate_distribution_percentages()
RETURNS TRIGGER AS $$
DECLARE
  total_percentage numeric;
BEGIN
  SELECT COALESCE(SUM(distribution_percentage), 0) INTO total_percentage
  FROM secondary_distributions
  WHERE intermediary_customer_id = NEW.intermediary_customer_id
    AND is_active = true
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  total_percentage := total_percentage + NEW.distribution_percentage;

  IF total_percentage > 100 THEN
    RAISE EXCEPTION 'Total distribution percentage cannot exceed 100%%. Current: %%', total_percentage;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_distribution_percentages ON secondary_distributions;
CREATE TRIGGER check_distribution_percentages BEFORE INSERT OR UPDATE ON secondary_distributions
FOR EACH ROW EXECUTE FUNCTION validate_distribution_percentages();

-- Configure relationships
DO $$
DECLARE
  v_kgm_id uuid; v_smk_id uuid; v_mmme_id uuid; v_hbr_id uuid;
  v_auranet_id uuid; v_aurion_id uuid; v_cig_id uuid; v_auramet_id uuid;
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_kgm_id FROM mining_companies WHERE abbreviation = 'KGM' LIMIT 1;
  SELECT id INTO v_smk_id FROM mining_companies WHERE abbreviation = 'SMK' LIMIT 1;
  SELECT id INTO v_mmme_id FROM customers WHERE name = 'Mansa Management Middle East' LIMIT 1;
  SELECT id INTO v_hbr_id FROM customers WHERE name = 'Hummingbird Resources' LIMIT 1;
  SELECT id INTO v_auranet_id FROM customers WHERE name = 'Auranet International' LIMIT 1;
  SELECT id INTO v_aurion_id FROM customers WHERE name = 'Aurion Trading' LIMIT 1;
  SELECT id INTO v_cig_id FROM customers WHERE name = 'Coris Investment Group' LIMIT 1;
  SELECT id INTO v_auramet_id FROM customers WHERE name LIKE 'Auramet%' LIMIT 1;
  SELECT id INTO v_admin_id FROM user_profiles ORDER BY created_at LIMIT 1;

  DELETE FROM gold_sales_settings WHERE mining_company_id = v_kgm_id;
  DELETE FROM gold_sales_settings WHERE mining_company_id = v_smk_id AND customer_id = v_auramet_id;
  DELETE FROM secondary_distributions WHERE intermediary_customer_id IN (v_mmme_id, v_hbr_id);

  -- KGM → MMME
  IF v_kgm_id IS NOT NULL AND v_mmme_id IS NOT NULL THEN
    INSERT INTO gold_sales_settings (mining_company_id, customer_id, max_stock_percentage, sale_method, refining_fees_paid_by_customer, transport_fees_paid_by_customer, is_active, effective_date, created_by, updated_by, notes)
    VALUES (v_kgm_id, v_mmme_id, 100, 'standard', true, true, true, CURRENT_DATE, v_admin_id, v_admin_id, 'KGM sells 100% to MMME');
  END IF;

  -- SMK → HBR
  IF v_smk_id IS NOT NULL AND v_hbr_id IS NOT NULL THEN
    INSERT INTO gold_sales_settings (mining_company_id, customer_id, max_stock_percentage, sale_method, refining_fees_paid_by_customer, transport_fees_paid_by_customer, is_active, effective_date, created_by, updated_by, notes)
    VALUES (v_smk_id, v_hbr_id, 100, 'standard', false, false, true, CURRENT_DATE, v_admin_id, v_admin_id, 'SMK sells 100% to HBR');
  END IF;

  -- MMME distributions
  IF v_mmme_id IS NOT NULL THEN
    IF v_auranet_id IS NOT NULL THEN
      INSERT INTO secondary_distributions (intermediary_customer_id, end_customer_id, distribution_percentage, is_active, effective_date, created_by, updated_by, notes)
      VALUES (v_mmme_id, v_auranet_id, 93.00, true, CURRENT_DATE, v_admin_id, v_admin_id, 'MMME distributes 93% to Auranet');
    END IF;
    IF v_aurion_id IS NOT NULL THEN
      INSERT INTO secondary_distributions (intermediary_customer_id, end_customer_id, distribution_percentage, is_active, effective_date, created_by, updated_by, notes)
      VALUES (v_mmme_id, v_aurion_id, 5.00, true, CURRENT_DATE, v_admin_id, v_admin_id, 'MMME distributes 5% to Aurion');
    END IF;
    IF v_cig_id IS NOT NULL THEN
      INSERT INTO secondary_distributions (intermediary_customer_id, end_customer_id, distribution_percentage, is_active, effective_date, created_by, updated_by, notes)
      VALUES (v_mmme_id, v_cig_id, 2.00, true, CURRENT_DATE, v_admin_id, v_admin_id, 'MMME distributes 2% to CIG');
    END IF;
  END IF;

  -- HBR distribution
  IF v_hbr_id IS NOT NULL AND v_auramet_id IS NOT NULL THEN
    INSERT INTO secondary_distributions (intermediary_customer_id, end_customer_id, distribution_percentage, is_active, effective_date, created_by, updated_by, notes)
    VALUES (v_hbr_id, v_auramet_id, 100.00, true, CURRENT_DATE, v_admin_id, v_admin_id, 'HBR distributes 100% to Auramet');
  END IF;
END $$;
